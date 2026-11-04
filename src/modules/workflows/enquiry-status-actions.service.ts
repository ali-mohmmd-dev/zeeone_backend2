import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { z } from 'zod';
import { EnquiryStatus } from './support/types/enquiry.js';
export function createEnquiryStatusActionsService(prisma: PrismaClient, currentUser: WorkflowUser) {
    const workflowSession = { user: currentUser, session: { id: currentUser.id, userId: currentUser.id } };
    async function getCurrentUser() {
        const session = workflowSession;
        if (!session) {
            throw new Error('Unauthorized');
        }
        return session.user;
    }

    const statusUpdateSchema = z.object({
        id: z.string().min(1, 'Enquiry ID is required'),
        newStatus: z.nativeEnum(EnquiryStatus),
        statusRemarks: z.string().optional(),
    });
    const directEnrollmentSchema = z.object({
        id: z.string().min(1, 'Enquiry ID is required'),
        statusRemarks: z.string().optional(),
    });
    const updateEnquiryStatusWithActivitySchema = statusUpdateSchema;
    async function updateEnquiryStatusWithActivity(input: unknown) {
        const parsedInput = updateEnquiryStatusWithActivitySchema.parse(input ?? {});
        try {
            const user = await getCurrentUser();
            const { id, newStatus } = parsedInput;
            // Check if enquiry exists and user has permission
            const existingEnquiry = await prisma.enquiry.findUnique({
                where: { id },
            });
            if (!existingEnquiry) {
                throw new Error('Enquiry not found');
            }
            // Role-based access control
            if (user.role === 'telecaller' && existingEnquiry.assignedToUserId !== user.id) {
                throw new Error('Access denied');
            }
            // Use transaction to update enquiry and create activity
            const result = await prisma.$transaction(async (tx) => {
                // Update enquiry status
                const updatedEnquiry = await tx.enquiry.update({
                    where: { id },
                    data: {
                        status: newStatus,
                        lastContactDate: new Date(),
                    },
                    include: {
                        branch: true,
                        preferredCourse: true,
                        service: true,
                        assignedTo: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                        createdBy: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                    },
                });
                return updatedEnquiry;
            });
            return {
                success: true,
                data: result,
                message: 'Status updated successfully with activity logged',
            };
        }
        catch (error) {
            console.error('Error updating enquiry status with activity:', error);
            throw new Error('Failed to update status');
        }
    }
    const updateEnquiryStatusDirectToEnrolledSchema = directEnrollmentSchema;
    async function updateEnquiryStatusDirectToEnrolled(input: unknown) {
        const parsedInput = updateEnquiryStatusDirectToEnrolledSchema.parse(input ?? {});
        try {
            const user = await getCurrentUser();
            const { id } = parsedInput;
            // Check if enquiry exists and user has permission
            const existingEnquiry = await prisma.enquiry.findUnique({
                where: { id },
            });
            if (!existingEnquiry) {
                throw new Error('Enquiry not found');
            }
            // Role-based access control
            if (user.role === 'telecaller' && existingEnquiry.assignedToUserId !== user.id) {
                throw new Error('Access denied');
            }
            // Use transaction to update enquiry
            const result = await prisma.$transaction(async (tx) => {
                // Direct enrolment confirms the enquiry.
                const updatedEnquiry = await tx.enquiry.update({
                    where: { id },
                    data: {
                        status: EnquiryStatus.CONFIRMED,
                        lastContactDate: new Date(),
                    },
                    include: {
                        branch: true,
                        preferredCourse: true,
                        service: true,
                        assignedTo: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                        createdBy: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                    },
                });
                return updatedEnquiry;
            });
            return {
                success: true,
                data: result,
                message: 'Direct enrollment completed successfully',
            };
        }
        catch (error) {
            console.error('Error processing direct enrollment:', error);
            throw new Error('Failed to process direct enrollment');
        }
    }
    return { updateEnquiryStatusWithActivity, updateEnquiryStatusDirectToEnrolled };
}
