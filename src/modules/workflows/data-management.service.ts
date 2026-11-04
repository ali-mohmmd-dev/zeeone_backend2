import { decimal } from '../../shared/utils/money.js';
import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { cacheService } from "./support/lib/cache/cache-service.js";
import { CACHE_KEYS, CACHE_TTL } from "./support/lib/cache/cache-keys.js";
import { invalidateMasterDataCache, invalidateUserPermissionCache, invalidateDashboardCache, } from "./support/lib/cache/cache-invalidation.js";
import { CreateRoleInput, UpdateRoleInput, CreateCourseInput, UpdateCourseInput, CreateBranchInput, UpdateBranchInput, CreateEnquirySourceInput, UpdateEnquirySourceInput, DeleteInput, CreateServiceInput, UpdateServiceInput, CreateRequiredServiceInput, UpdateRequiredServiceInput, } from "./support/types/data-management.js";
interface ActionResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
}
export function createDataManagementService(prisma: PrismaClient, _currentUser: WorkflowUser) {
    async function getAllRoles(): Promise<ActionResponse> {
        try {
            const roles = await cacheService.getOrSet("crm:master-data:roles", CACHE_TTL.MASTER_DATA, async () => await prisma.role.findMany({
                orderBy: { createdAt: "desc" },
            }));
            return {
                success: true,
                message: "Roles fetched successfully",
                data: roles,
            };
        }
        catch (error) {
            console.error("Error fetching roles:", error);
            return {
                success: false,
                message: "Failed to fetch roles",
            };
        }
    }
    async function createRole(input: CreateRoleInput): Promise<ActionResponse> {
        try {
            // Check if role name already exists
            const existingRole = await prisma.role.findUnique({
                where: { name: input.name },
            });
            if (existingRole) {
                return {
                    success: false,
                    message: "Role with this name already exists",
                };
            }
            const role = await prisma.role.create({
                data: {
                    id: crypto.randomUUID(),
                    updatedAt: new Date(),
                    ...input,
                },
            });
            await invalidateMasterDataCache('roles');
            await invalidateUserPermissionCache();
            return {
                success: true,
                message: "Role created successfully",
                data: role,
            };
        }
        catch (error) {
            console.error("Error creating role:", error);
            return {
                success: false,
                message: "Failed to create role",
            };
        }
    }
    async function updateRole(input: UpdateRoleInput): Promise<ActionResponse> {
        try {
            // Check if another role with the same name exists
            const existingRole = await prisma.role.findFirst({
                where: {
                    name: input.name,
                    NOT: { id: input.id },
                },
            });
            if (existingRole) {
                return {
                    success: false,
                    message: "Another role with this name already exists",
                };
            }
            const role = await prisma.role.update({
                where: { id: input.id },
                data: {
                    name: input.name,
                    description: input.description,
                },
            });
            await invalidateMasterDataCache('roles');
            await invalidateUserPermissionCache();
            return {
                success: true,
                message: "Role updated successfully",
                data: role,
            };
        }
        catch (error) {
            console.error("Error updating role:", error);
            return {
                success: false,
                message: "Failed to update role",
            };
        }
    }
    async function deleteRole(input: DeleteInput): Promise<ActionResponse> {
        try {
            await prisma.role.delete({
                where: { id: input.id },
            });
            await invalidateMasterDataCache('roles');
            await invalidateUserPermissionCache();
            return {
                success: true,
                message: "Role deleted successfully",
            };
        }
        catch (error) {
            console.error("Error deleting role:", error);
            return {
                success: false,
                message: "Failed to delete role",
            };
        }
    }
    async function getAllCourses(): Promise<ActionResponse> {
        try {
            const courses = await cacheService.getOrSet(CACHE_KEYS.courses, CACHE_TTL.MASTER_DATA, async () => await prisma.course.findMany({
                orderBy: { createdAt: "desc" },
            }));
            return {
                success: true,
                message: "Courses fetched successfully",
                data: courses,
            };
        }
        catch (error) {
            console.error("Error fetching courses:", error);
            return {
                success: false,
                message: "Failed to fetch courses",
            };
        }
    }
    async function createCourse(input: CreateCourseInput): Promise<ActionResponse> {
        try {
            const course = await prisma.course.create({
                data: {
                    name: input.name,
                    description: input.description,
                    duration: input.duration,
                    courseFee: input.courseFee,
                    admissionFee: input.admissionFee,
                    semesterFee: input.semesterFee != null && decimal(input.semesterFee).isZero() ? null : input.semesterFee,
                },
            });
            await invalidateMasterDataCache('courses');
            return {
                success: true,
                message: "Capacity created successfully",
                data: course,
            };
        }
        catch (error) {
            console.error("Error creating capacity:", error);
            return {
                success: false,
                message: "Failed to create capacity",
            };
        }
    }
    async function updateCourse(input: UpdateCourseInput): Promise<ActionResponse> {
        try {
            const course = await prisma.course.update({
                where: { id: input.id },
                data: {
                    name: input.name,
                    description: input.description,
                    duration: input.duration,
                    courseFee: input.courseFee,
                    admissionFee: input.admissionFee,
                    semesterFee: input.semesterFee != null && decimal(input.semesterFee).isZero() ? null : input.semesterFee,
                },
            });
            await invalidateMasterDataCache('courses');
            return {
                success: true,
                message: "Capacity updated successfully",
                data: course,
            };
        }
        catch (error) {
            console.error("Error updating capacity:", error);
            return {
                success: false,
                message: "Failed to update capacity",
            };
        }
    }
    async function deleteCourse(input: DeleteInput): Promise<ActionResponse> {
        try {
            console.log("Deleting capacity with ID:", input.id);
            await prisma.admission.deleteMany({
                where: {
                    courseId: input.id,
                },
            });
            await prisma.course.delete({
                where: { id: input.id },
            });
            await invalidateMasterDataCache('courses');
            return {
                success: true,
                message: "Capacity deleted successfully",
            };
        }
        catch (error) {
            console.error("Error deleting capacity:", error);
            return {
                success: false,
                message: "Failed to delete capacity",
            };
        }
    }
    async function toggleCourseStatus(input: DeleteInput): Promise<ActionResponse> {
        try {
            const course = await prisma.course.findUnique({
                where: { id: input.id },
            });
            if (!course) {
                return {
                    success: false,
                    message: "Course not found",
                };
            }
            const updatedCourse = await prisma.course.update({
                where: { id: input.id },
                data: { isActive: !course.isActive },
            });
            await invalidateMasterDataCache('courses');
            return {
                success: true,
                message: `Course ${updatedCourse.isActive ? "activated" : "deactivated"} successfully`,
                data: updatedCourse,
            };
        }
        catch (error) {
            console.error("Error toggling course status:", error);
            return {
                success: false,
                message: "Failed to toggle course status",
            };
        }
    }
    async function getAllBranches(): Promise<ActionResponse> {
        try {
            const branches = await cacheService.getOrSet(CACHE_KEYS.branches, CACHE_TTL.MASTER_DATA, async () => await prisma.branch.findMany({
                orderBy: { createdAt: "desc" },
            }));
            return {
                success: true,
                message: "Branches fetched successfully",
                data: branches,
            };
        }
        catch (error) {
            console.error("Error fetching branches:", error);
            return {
                success: false,
                message: "Failed to fetch branches",
            };
        }
    }
    async function createBranch(input: CreateBranchInput): Promise<ActionResponse> {
        try {
            const branch = await prisma.branch.create({
                data: input,
            });
            await invalidateMasterDataCache('branches');
            await invalidateDashboardCache();
            return {
                success: true,
                message: "Branch created successfully",
                data: branch,
            };
        }
        catch (error) {
            console.error("Error creating branch:", error);
            return {
                success: false,
                message: "Failed to create branch",
            };
        }
    }
    async function updateBranch(input: UpdateBranchInput): Promise<ActionResponse> {
        try {
            const branch = await prisma.branch.update({
                where: { id: input.id },
                data: {
                    name: input.name,
                    address: input.address,
                    phone: input.phone,
                    email: input.email,
                },
            });
            await invalidateMasterDataCache('branches');
            await invalidateDashboardCache();
            return {
                success: true,
                message: "Branch updated successfully",
                data: branch,
            };
        }
        catch (error) {
            console.error("Error updating branch:", error);
            return {
                success: false,
                message: "Failed to update branch",
            };
        }
    }
    async function deleteBranch(input: DeleteInput): Promise<ActionResponse> {
        try {
            await prisma.branch.delete({
                where: { id: input.id },
            });
            await invalidateMasterDataCache('branches');
            await invalidateDashboardCache();
            return {
                success: true,
                message: "Branch deleted successfully",
            };
        }
        catch (error) {
            console.error("Error deleting branch:", error);
            return {
                success: false,
                message: "Failed to delete branch",
            };
        }
    }
    async function toggleBranchStatus(input: DeleteInput): Promise<ActionResponse> {
        try {
            const branch = await prisma.branch.findUnique({
                where: { id: input.id },
            });
            if (!branch) {
                return {
                    success: false,
                    message: "Branch not found",
                };
            }
            const updatedBranch = await prisma.branch.update({
                where: { id: input.id },
                data: { isActive: !branch.isActive },
            });
            await invalidateMasterDataCache('branches');
            await invalidateDashboardCache();
            return {
                success: true,
                message: `Branch ${updatedBranch.isActive ? "activated" : "deactivated"} successfully`,
                data: updatedBranch,
            };
        }
        catch (error) {
            console.error("Error toggling branch status:", error);
            return {
                success: false,
                message: "Failed to toggle branch status",
            };
        }
    }
    async function getAllEnquirySources(): Promise<ActionResponse> {
        try {
            const sources = await cacheService.getOrSet(CACHE_KEYS.sources, CACHE_TTL.MASTER_DATA, async () => await prisma.enquirySource.findMany({
                orderBy: { createdAt: "desc" },
            }));
            return {
                success: true,
                message: "Enquiry sources fetched successfully",
                data: sources,
            };
        }
        catch (error) {
            console.error("Error fetching enquiry sources:", error);
            return {
                success: false,
                message: "Failed to fetch enquiry sources",
            };
        }
    }
    async function createEnquirySource(input: CreateEnquirySourceInput): Promise<ActionResponse> {
        try {
            const source = await prisma.enquirySource.create({
                data: {
                    id: crypto.randomUUID(),
                    updatedAt: new Date(),
                    ...input,
                },
            });
            await invalidateMasterDataCache('sources');
            return {
                success: true,
                message: "Enquiry source created successfully",
                data: source,
            };
        }
        catch (error) {
            console.error("Error creating enquiry source:", error);
            if (error instanceof Error && error.message.includes("duplicate key")) {
                return {
                    success: false,
                    message: "Enquiry source with this name already exists",
                };
            }
            return {
                success: false,
                message: "Failed to create enquiry source",
            };
        }
    }
    async function updateEnquirySource(input: UpdateEnquirySourceInput): Promise<ActionResponse> {
        try {
            const source = await prisma.enquirySource.update({
                where: { id: input.id },
                data: {
                    name: input.name,
                },
            });
            await invalidateMasterDataCache('sources');
            return {
                success: true,
                message: "Enquiry source updated successfully",
                data: source,
            };
        }
        catch (error) {
            console.error("Error updating enquiry source:", error);
            if (error instanceof Error && error.message.includes("duplicate key")) {
                return {
                    success: false,
                    message: "Another enquiry source with this name already exists",
                };
            }
            return {
                success: false,
                message: "Failed to update enquiry source",
            };
        }
    }
    async function deleteEnquirySource(input: DeleteInput): Promise<ActionResponse> {
        try {
            await prisma.enquirySource.delete({
                where: { id: input.id },
            });
            await invalidateMasterDataCache('sources');
            return {
                success: true,
                message: "Enquiry source deleted successfully",
            };
        }
        catch (error) {
            console.error("Error deleting enquiry source:", error);
            return {
                success: false,
                message: "Failed to delete enquiry source",
            };
        }
    }
    async function toggleEnquirySourceStatus(input: DeleteInput): Promise<ActionResponse> {
        try {
            const source = await prisma.enquirySource.findUnique({
                where: { id: input.id },
            });
            if (!source) {
                return {
                    success: false,
                    message: "Enquiry source not found",
                };
            }
            const updatedSource = await prisma.enquirySource.update({
                where: { id: input.id },
                data: { isActive: !source.isActive },
            });
            await invalidateMasterDataCache('sources');
            return {
                success: true,
                message: `Enquiry source ${updatedSource.isActive ? "activated" : "deactivated"} successfully`,
                data: updatedSource,
            };
        }
        catch (error) {
            console.error("Error toggling enquiry source status:", error);
            return {
                success: false,
                message: "Failed to toggle enquiry source status",
            };
        }
    }
    async function getAllRequiredServices(): Promise<ActionResponse> {
        try {
            const requiredServices = await prisma.service.findMany({
                orderBy: { createdAt: "desc" },
            });
            return {
                success: true,
                message: "Required services fetched successfully",
                data: requiredServices,
            };
        }
        catch (error) {
            console.error("Error fetching required services:", error);
            return {
                success: false,
                message: "Failed to fetch required services",
            };
        }
    }
    async function getAllServices() {
        try {
            const services = await cacheService.getOrSet(CACHE_KEYS.services, CACHE_TTL.MASTER_DATA, async () => await prisma.service.findMany({}));
            return {
                success: true,
                message: "Services fetched successfully",
                data: services,
            };
        }
        catch (error) {
            console.error("Error fetching services:", error);
            return {
                success: false,
                message: "Failed to fetch services",
            };
        }
    }
    async function createService(input: CreateServiceInput) {
        try {
            const service = await prisma.service.create({
                data: input,
            });
            if (!service) {
                return {
                    success: false,
                    message: "Failed to create service",
                };
            }
            await invalidateMasterDataCache('services');
            return {
                success: true,
                message: "Service created successfully",
                data: service,
            };
        }
        catch (error) {
            console.error("Error creating service:", error);
            return {
                success: false,
                message: "Failed to create service",
            };
        }
    }
    async function updateService(input: UpdateServiceInput) {
        try {
            if (!input.id) {
                return {
                    success: false,
                    message: "Service id is required",
                };
            }
            const service = await prisma.service.update({
                where: { id: input.id },
                data: {
                    name: input.name,
                    price: input.price
                },
            });
            if (!service) {
                return {
                    success: false,
                    message: "Failed to update service",
                };
            }
            await invalidateMasterDataCache('services');
            return {
                success: true,
                message: "Service updated successfully",
                data: service,
            };
        }
        catch (error) {
            console.error("Error updating service:", error);
            return {
                success: false,
                message: "Failed to update service",
            };
        }
    }
    async function deleteService(input: DeleteInput) {
        try {
            await prisma.service.delete({
                where: { id: input.id },
            });
            await invalidateMasterDataCache('services');
            return {
                success: true,
                message: "Service deleted successfully",
            };
        }
        catch (error) {
            console.error("Error deleting service:", error);
            return {
                success: false,
                message: "Failed to delete service",
            };
        }
    }
    async function createRequiredService(input: CreateRequiredServiceInput): Promise<ActionResponse> {
        return createService({ name: input.name, price: 0 });
    }
    async function updateRequiredService(input: UpdateRequiredServiceInput): Promise<ActionResponse> {
        return updateService({ id: input.id, name: input.name, price: 0 });
    }
    async function deleteRequiredService(input: DeleteInput): Promise<ActionResponse> {
        return deleteService(input);
    }
    return { getAllRoles, createRole, updateRole, deleteRole, getAllCourses, createCourse, updateCourse, deleteCourse, toggleCourseStatus, getAllBranches, createBranch, updateBranch, deleteBranch, toggleBranchStatus, getAllEnquirySources, createEnquirySource, updateEnquirySource, deleteEnquirySource, toggleEnquirySourceStatus, getAllRequiredServices, getAllServices, createService, updateService, deleteService, createRequiredService, updateRequiredService, deleteRequiredService };
}
