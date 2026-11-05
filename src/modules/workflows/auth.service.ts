import { createUserLifecycleService } from '../users/user-lifecycle.service.js';
import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { withPrismaRetry } from './database-retry.js';
import bcrypt from 'bcryptjs';
import { userFormSchema } from './support/schema/user-schema.js';
import { z } from 'zod';
import { SOFTWARE_POSITIONS } from './support/constants/permissions.js';
import { cacheService } from './support/lib/cache/cache-service.js';
import { CACHE_TTL } from './support/lib/cache/cache-keys.js';
import { AppError, BadRequestError, ConflictError } from '../../errors/app-error.js';
export function createAuthService(prisma: PrismaClient, currentUser: WorkflowUser) {
    const workflowSession = { user: currentUser, session: { id: currentUser.id, userId: currentUser.id } };
    async function ensureStandardRolesExist() {
        try {
            for (const pos of SOFTWARE_POSITIONS) {
                const existing = await prisma.role.findFirst({
                    where: {
                        OR: [{ id: `role_${pos.id}` }, { name: pos.id }],
                    },
                });
                if (!existing) {
                    await prisma.role.create({
                        data: {
                            id: `role_${pos.id}`,
                            name: pos.id,
                            description: pos.description,
                            permissions: pos.defaultPermissions,
                            updatedAt: new Date(),
                        },
                    });
                }
            }
        }
        catch (err) {
            console.error('Error syncing standard software positions:', err);
        }
    }
    const createUserActionSchema = userFormSchema;
    async function createUserAction(input: unknown, logStep?: (step: string, fields?: Record<string, unknown>) => void) {
        logStep?.('input_validation_started');
        const { name, email, password, role, branch, permissions } = createUserActionSchema.parse(input ?? {});
        logStep?.('input_validation_succeeded', { role });
        try {
            const normalizedEmail = email.toLowerCase().trim();
            // Check duplicate early to return clean validation error
            logStep?.('duplicate_email_check_started');
            const existing = await prisma.user.findUnique({
                where: { email: normalizedEmail },
            });
            if (existing) {
                throw new ConflictError('Email already exists');
            }
            logStep?.('duplicate_email_check_succeeded');
            logStep?.('standard_roles_sync_started');
            await ensureStandardRolesExist();
            logStep?.('standard_roles_sync_succeeded');
            const defaultPos = SOFTWARE_POSITIONS.find((p) => p.id === role);
            const effectivePermissions = permissions && permissions.length > 0
                ? permissions
                : defaultPos?.defaultPermissions || ['dashboard'];
            const hashedPassword = await bcrypt.hash(password, 10);
            logStep?.('password_hash_generated');
            // Create user, custom role (if customized), and credential account record atomically
            const createdUser = await prisma.$transaction(async (tx) => {
                logStep?.('transaction_started');
                let roleRecord = await tx.role.findFirst({
                    where: {
                        OR: [{ id: `role_${role}` }, { name: role }],
                    },
                });
                const isCustomPermissions = permissions &&
                    permissions.length > 0 &&
                    JSON.stringify(permissions.sort()) !== JSON.stringify((defaultPos?.defaultPermissions || []).sort());
                const newUser = await tx.user.create({
                    data: {
                        name: name.trim(),
                        email: normalizedEmail,
                        role,
                        branch: branch || null,
                        password: hashedPassword,
                        emailVerified: true,
                    },
                });
                logStep?.('user_row_created', { userId: newUser.id });
                let targetRoleId = roleRecord?.id;
                if (isCustomPermissions) {
                    const customRole = await tx.role.create({
                        data: {
                            id: `role_${newUser.id}`,
                            name: `${role}_${newUser.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                            description: `Custom permissions for ${newUser.name}`,
                            permissions: effectivePermissions,
                            updatedAt: new Date(),
                        },
                    });
                    logStep?.('custom_role_created', { roleId: customRole.id });
                    targetRoleId = customRole.id;
                }
                if (targetRoleId) {
                    await tx.user.update({
                        where: { id: newUser.id },
                        data: {
                            roleId: targetRoleId,
                        },
                    });
                    logStep?.('user_role_linked', { roleId: targetRoleId });
                }
                // Create credential account record for Better-Auth compatibility
                await tx.account.create({
                    data: {
                        id: `acc_${newUser.id}`,
                        userId: newUser.id,
                        accountId: normalizedEmail,
                        providerId: 'credential',
                        password: hashedPassword,
                        updatedAt: new Date(),
                    },
                });
                logStep?.('credential_account_created');
                return tx.user.findUnique({
                    where: { id: newUser.id },
                    include: { userRole: true },
                });
            }, { maxWait: 15000, timeout: 30000 });
            logStep?.('transaction_succeeded', { userId: createdUser?.id });
            if (!createdUser) {
                throw new BadRequestError('User could not be created');
            }
            const { password: _, ...safeUser } = createdUser;
            return {
                success: true,
                message: `User account created successfully with ${defaultPos?.title || role} access`,
                user: safeUser,
            };
        }
        catch (error: any) {
            logStep?.('failed', { error: error instanceof Error ? error.message : String(error), code: error && typeof error === 'object' && 'code' in error ? error.code : undefined });
            console.error('Create user action error:', error);
            if (error instanceof AppError)
                throw error;
            throw new BadRequestError('User could not be created');
        }
    }
    const updateUserBranchActionSchema = z.object({
        userId: z.string(),
        branchId: z.string(),
    });
    async function updateUserBranchAction(input: unknown) {
        const { userId, branchId } = updateUserBranchActionSchema.parse(input ?? {});
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { branch: branchId },
            });
            await cacheService.delete(`user:${userId}`);
            return {
                success: true,
                message: 'User branch updated successfully',
            };
        }
        catch (error) {
            console.error('Update user branch error:', error);
            return {
                success: false,
                message: 'Failed to update user branch',
            };
        }
    }
    const updateUserRoleActionSchema = z.object({
        userId: z.string(),
        role: z.string(),
    });
    async function updateUserRoleAction(input: unknown) {
        const { userId, role } = updateUserRoleActionSchema.parse(input ?? {});
        try {
            await ensureStandardRolesExist();
            const defaultPos = SOFTWARE_POSITIONS.find((p) => p.id === role);
            const roleRecord = await prisma.role.findFirst({
                where: {
                    OR: [{ id: `role_${role}` }, { name: role }],
                },
            });
            await prisma.user.update({
                where: { id: userId },
                data: {
                    role,
                    ...(roleRecord ? { roleId: roleRecord.id } : {}),
                },
            });
            await cacheService.delete(`user:${userId}`);
            return {
                success: true,
                message: `User position updated to ${defaultPos?.title || role.toUpperCase()}`,
            };
        }
        catch (error) {
            console.error('Update user role error:', error);
            return {
                success: false,
                message: 'Failed to update user position',
            };
        }
    }
    const updateUserPermissionsActionSchema = z.object({
        userId: z.string(),
        role: z.string().optional(),
        permissions: z.array(z.string()),
    });
    async function updateUserPermissionsAction(input: unknown) {
        const { userId, role, permissions } = updateUserPermissionsActionSchema.parse(input ?? {});
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { userRole: true },
            });
            if (!user) {
                return { success: false, message: 'User not found' };
            }
            const activeRoleSlug = role || user.role || 'custom';
            // Check if user already has their own dedicated role or standard role
            let targetRoleId = user.roleId;
            if (user.userRole && user.userRole.id === `role_${userId}`) {
                // Update user's dedicated role permissions directly
                await prisma.role.update({
                    where: { id: user.userRole.id },
                    data: {
                        name: `${activeRoleSlug}_${user.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                        permissions,
                        updatedAt: new Date(),
                    },
                });
            }
            else {
                // Create or assign a dedicated role record for this user with exact custom permissions
                const customRole = await prisma.role.upsert({
                    where: { id: `role_${userId}` },
                    create: {
                        id: `role_${userId}`,
                        name: `${activeRoleSlug}_${user.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                        description: `Custom permissions for ${user.name}`,
                        permissions,
                        updatedAt: new Date(),
                    },
                    update: {
                        name: `${activeRoleSlug}_${user.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                        permissions,
                        updatedAt: new Date(),
                    },
                });
                targetRoleId = customRole.id;
            }
            await prisma.user.update({
                where: { id: userId },
                data: {
                    role: activeRoleSlug,
                    roleId: targetRoleId,
                },
            });
            // Clear caches
            await cacheService.delete(`user:${userId}`);
            if (user.email) {
                await cacheService.delete(`user:email:${user.email}`);
            }
            return {
                success: true,
                message: `Access permissions for ${user.name} successfully updated (${permissions.length} modules active)`,
            };
        }
        catch (error: any) {
            console.error('Update user permissions error:', error);
            return {
                success: false,
                message: error.message || 'Failed to update access permissions',
            };
        }
    }
    // Compatibility endpoint: removing a user now preserves records and deactivates access.
    async function deleteUserAction(input: unknown) {
        return createUserLifecycleService(prisma, currentUser).deactivate(input);
    }
    const updateProfileActionSchema = z.object({
        name: z.string().min(2),
        email: z.string().email(),
    });
    async function updateProfileAction(input: unknown) {
        const { name, email } = updateProfileActionSchema.parse(input ?? {});
        try {
            const session = workflowSession;
            if (!session) {
                return {
                    success: false,
                    message: 'Unauthorized',
                };
            }
            // Check if email is already taken by another user
            if (email !== session.user.email) {
                const existingUser = await prisma.user.findUnique({
                    where: { email },
                });
                if (existingUser) {
                    return {
                        success: false,
                        message: 'Email is already in use',
                    };
                }
            }
            await prisma.user.update({
                where: { id: session.user.id },
                data: {
                    name,
                    email,
                },
            });
            await cacheService.delete(`user:${session.user.id}`);
            await cacheService.delete(`user:email:${email}`);
            return {
                success: true,
                message: 'Profile updated successfully',
            };
        }
        catch (error) {
            console.error('Update profile error:', error);
            return {
                success: false,
                message: 'Failed to update profile',
            };
        }
    }
    async function getAllUsers() {
        try {
            return await withPrismaRetry(async () => {
                return await prisma.user.findMany({
                    where: { isActive: true, OR: [{ banned: false }, { banned: null }] },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        userRole: true,
                    },
                });
            }, 2, 350);
        }
        catch (error: any) {
            console.warn('[Users] Transient DB notice in getAllUsers:', error?.message || error);
            return [];
        }
    }
    async function getAllRoles() {
        try {
            return await cacheService.getOrSet('master:roles', CACHE_TTL.MASTER_DATA, async () => {
                return await withPrismaRetry(async () => {
                    await ensureStandardRolesExist();
                    return await prisma.role.findMany({
                        orderBy: { name: 'asc' },
                    });
                }, 2, 350);
            });
        }
        catch (error: any) {
            console.warn('[Roles] Transient DB notice in getAllRoles:', error?.message || error);
            return [];
        }
    }
    async function getAllBranches() {
        try {
            return await cacheService.getOrSet('master:branches', CACHE_TTL.MASTER_DATA, async () => {
                return await withPrismaRetry(async () => {
                    return await prisma.branch.findMany({
                        orderBy: { createdAt: 'desc' },
                    });
                }, 2, 350);
            });
        }
        catch (error: any) {
            console.warn('[Branches] Transient DB notice in getAllBranches:', error?.message || error);
            return [];
        }
    }
    const changePasswordActionSchema = z.object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    });
    async function changePasswordAction(input: unknown) {
        const { currentPassword, newPassword } = changePasswordActionSchema.parse(input ?? {});
        try {
            const session = workflowSession;
            if (!session?.user) {
                return {
                    success: false,
                    message: 'Unauthorized. Please sign in.',
                };
            }
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
            });
            if (!user || !user.password) {
                return {
                    success: false,
                    message: 'User account not found',
                };
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return {
                    success: false,
                    message: 'Incorrect current password',
                };
            }
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await prisma.$transaction(async (tx) => {
                await tx.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
                await tx.account.updateMany({ where: { userId: user.id, providerId: 'credential' }, data: { password: hashedPassword } });
            });
            await cacheService.delete(`user:${user.id}`);
            if (user.email) {
                await cacheService.delete(`user:email:${user.email}`);
            }
            return {
                success: true,
                message: 'Password changed successfully',
            };
        }
        catch (err: any) {
            console.error('Change password error:', err);
            return {
                success: false,
                message: err.message || 'Failed to change password',
            };
        }
    }
    return { createUserAction, updateUserBranchAction, updateUserRoleAction, updateUserPermissionsAction, deleteUserAction, updateProfileAction, getAllUsers, getAllRoles, getAllBranches, changePasswordAction };
}
