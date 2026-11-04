import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
export function createEnquiryActionService(prisma: PrismaClient, _currentUser: WorkflowUser) {
    const getBranchesSchema = z.object({});
    async function getBranches(input: unknown) {
        getBranchesSchema.parse(input ?? {});
        try {
            const branches = await prisma.branch.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
            });
            return { success: true, data: branches };
        }
        catch (error) {
            console.error('Error fetching branches:', error);
            throw new Error('Failed to fetch branches');
        }
    }
    const getCoursesSchema = z.object({});
    async function getCourses(input: unknown) {
        getCoursesSchema.parse(input ?? {});
        try {
            const courses = await prisma.course.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
            });
            return { success: true, data: courses };
        }
        catch (error) {
            console.error('Error fetching courses:', error);
            throw new Error('Failed to fetch courses');
        }
    }
    const getEnquirySourcesSchema = z.object({});
    async function getEnquirySources(input: unknown) {
        getEnquirySourcesSchema.parse(input ?? {});
        try {
            const sources = await prisma.enquirySource.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
            });
            return { success: true, data: sources };
        }
        catch (error) {
            console.error('Error fetching enquiry sources:', error);
            throw new Error('Failed to fetch enquiry sources');
        }
    }
    const getRequiredServicesSchema = z.object({});
    async function getRequiredServices(input: unknown) {
        getRequiredServicesSchema.parse(input ?? {});
        try {
            const services = await prisma.service.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
            });
            return { success: true, data: services };
        }
        catch (error) {
            console.error('Error fetching required services:', error);
            throw new Error('Failed to fetch required services');
        }
    }
    const getUsersSchema = z.object({ branchId: z.string().optional() });
    async function getUsers(input: unknown) {
        const parsedInput = getUsersSchema.parse(input ?? {});
        try {
            const where: Prisma.UserWhereInput = {};
            if (parsedInput.branchId) {
                where.branch = parsedInput.branchId;
            }
            const users = await prisma.user.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    role: true,
                    branch: true,
                },
                orderBy: { name: 'asc' },
            });
            return { success: true, data: users };
        }
        catch (error) {
            console.error('Error fetching users:', error);
            throw new Error('Failed to fetch users');
        }
    }
    return { getBranches, getCourses, getEnquirySources, getRequiredServices, getUsers };
}
