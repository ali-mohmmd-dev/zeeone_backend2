import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware.js';
import { installationProgressScope } from './support/lib/installation-progress.js';
export const uiRoutes: FastifyPluginAsync = async (app) => {
    app.addHook('preHandler', authenticate);
    app.get('/sidebar-counts', async (request) => {
        const user = request.currentUser;
        const isAdmin = user.role === 'admin';
        const isManager = user.role === 'manager';
        const jobWhere: Prisma.JobLeadWhereInput = { status: 'PENDING' };
        const followUpWhere: Prisma.FollowUpWhereInput = { status: 'PENDING' };
        if (!isAdmin) {
            if (isManager && user.branch) {
                jobWhere.job = { branchId: user.branch };
                followUpWhere.enquiry = { branchId: user.branch };
            }
            else {
                jobWhere.lead = { assignedToUserId: user.id };
                followUpWhere.enquiry = { assignedToUserId: user.id };
            }
        }
        const [enquiries, jobOrdersPending, followUps] = await Promise.all([
            isAdmin || isManager ? app.prisma.enquiry.count({ where: { assignedToUserId: null, ...(isManager && user.branch ? { branchId: user.branch } : {}) } }) : 0,
            app.prisma.jobLead.count({ where: jobWhere }),
            app.prisma.followUp.count({ where: followUpWhere }),
        ]);
        return { enquiries, jobOrdersPending, followUps };
    });
    app.get('/job-order-options', async (request) => {
        const user = request.currentUser;
        const canAssign = ['admin', 'manager', 'executive', 'branch manager'].includes(user.role || '');
        const branches = user.role === 'admin'
            ? await app.prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : [];
        const availableManagers = canAssign ? await app.prisma.user.findMany({
            where: { role: { in: ['executive', 'manager', 'telecaller', 'job_orders', 'joborders'] }, OR: [{ banned: false }, { banned: null }], ...(user.role !== 'admin' ? { branch: user.branch } : {}) },
            select: { id: true, name: true, email: true }, orderBy: { name: 'asc' },
        }) : [];
        return { branches, availableManagers };
    });
    app.get('/my-branch', async (request) => {
        if (!request.currentUser.branch)
            return null;
        return app.prisma.branch.findUnique({ where: { id: request.currentUser.branch }, select: { name: true } });
    });
    app.get<{
        Params: {
            id: string;
        };
    }>('/admissions/:id/can-update-progress', async (request) => {
        const scope = installationProgressScope(request.currentUser);
        if (!scope)
            return false;
        return Boolean(await app.prisma.admission.findFirst({ where: { id: request.params.id, ...scope }, select: { id: true } }));
    });
};
