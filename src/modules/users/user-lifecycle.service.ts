import { Prisma, type PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../errors/app-error.js';
import { cacheService } from '../workflows/support/lib/cache/cache-service.js';
import { invalidateDashboardCache } from '../workflows/support/lib/cache/cache-invalidation.js';
import { getUserEffectivePermissions } from '../workflows/support/lib/permissions.js';

type Actor = { id: string; name: string; role: string | null };
type Client = Prisma.TransactionClient;
const active = { isActive: true, OR: [{ banned: false }, { banned: null }] };
const pendingFollowUp = { status: { in: ['PENDING', 'RESCHEDULED'] as ('PENDING' | 'RESCHEDULED')[] } };

// Follow-ups are owned through their enquiry, never through their creator.
async function pendingWork(db: Client, userId: string) {
  const [jobs, leads, enquiries, surveys, followUps] = await Promise.all([
    db.jobOrder.findMany({ where: { managerId: userId, OR: [
      { jobLeads: { some: { status: 'PENDING' } } },
      { jobLeads: { none: {} }, endDate: { gte: new Date() } },
    ] }, select: { id: true, name: true, branchId: true }, orderBy: { id: 'asc' } }),
    db.jobLead.findMany({ where: { assigneeId: userId, status: 'PENDING' }, select: { id: true, job: { select: { name: true, branchId: true } } }, orderBy: { id: 'asc' } }),
    db.enquiry.findMany({ where: { assignedToUserId: userId, OR: [
      { status: { in: ['NEW', 'CONTACTED', 'FOLLOW_UP'] } },
      { followUps: { some: pendingFollowUp } },
      { jobLeads: { some: { status: 'PENDING' } } },
    ] }, select: { id: true, candidateName: true, branchId: true }, orderBy: { id: 'asc' } }),
    db.admission.findMany({ where: { status: { in: ['PENDING', 'CONFIRMED'] }, OR: [{ assignedToUserId: userId }, { handledByUserId: userId }] }, select: { id: true, assignedToUserId: true, handledByUserId: true, enquiry: { select: { branchId: true } } }, orderBy: { id: 'asc' } }),
    db.followUp.findMany({ where: { ...pendingFollowUp, enquiry: { assignedToUserId: userId } }, select: { id: true, enquiryId: true }, orderBy: { id: 'asc' } }),
  ]);
  const transfers = { jobs, leads, enquiries, surveys, followUps };
  return { ...transfers, revision: createHash('sha256').update(JSON.stringify(transfers)).digest('hex') };
}

export function createUserLifecycleService(prisma: PrismaClient, actor: Actor) {
  function authorize(userId: string) {
    if (actor.role !== 'admin') throw new ForbiddenError('Administrator access required');
    if (userId === actor.id) throw new BadRequestError('You cannot deactivate your own account');
  }
  async function target(db: Client, userId: string) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');
    if (user.role === 'admin' || user.email === 'admin@elevate.com') throw new BadRequestError('Administrator accounts cannot be deactivated or deleted');
    return user;
  }
  async function preview(input: unknown) {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(input);
    authorize(userId);
    const targetUser = await target(prisma, userId);
    const [work, candidates, history, linked, previousTransfers] = await Promise.all([
      pendingWork(prisma, userId),
      prisma.user.findMany({ where: { ...active, id: { not: userId } }, select: { id: true, name: true, role: true, branch: true, userRole: { select: { permissions: true } } }, orderBy: { name: 'asc' } }),
      prisma.userLifecycleEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.user.findUnique({ where: { id: userId }, select: { _count: true } }),
      prisma.userLifecycleEvent.findMany({ where: { userId, action: 'DEACTIVATED' }, select: { transfers: true } }),
    ]);
    return { ...work, candidates: candidates.filter(candidate => eligible(candidate, work) && (candidate.role === 'admin' || workBranches(work, targetUser.branch).every(branch => branch === candidate.branch))).map(({ userRole, ...candidate }) => candidate), history, canPermanentlyDelete: !hasRecords(linked?._count) && !hadTransferredWork(previousTransfers) };
  }
  function hadTransferredWork(events: { transfers: Prisma.JsonValue }[]) {
    return events.some(event => event.transfers && typeof event.transfers === 'object' && Object.values(event.transfers).some(value => Array.isArray(value) && value.length > 0));
  }
  function hasRecords(counts?: Record<string, number>) {
    return !counts || Object.entries(counts).some(([key, count]) => !['accounts', 'sessions', 'notifications'].includes(key) && count > 0);
  }
  function workBranches(work: Awaited<ReturnType<typeof pendingWork>>, fallback: string | null) {
    return [...work.jobs.map(x => x.branchId), ...work.leads.map(x => x.job.branchId), ...work.enquiries.map(x => x.branchId), ...work.surveys.map(x => x.enquiry?.branchId ?? fallback)].filter(Boolean);
  }
  function eligible(user: Parameters<typeof getUserEffectivePermissions>[0], work: Awaited<ReturnType<typeof pendingWork>>) {
    const permissions = getUserEffectivePermissions(user);
    if (permissions.includes('*') || permissions.includes('all')) return true;
    if (work.surveys.length && (!permissions.includes('projects') || ['manager', 'branch manager'].includes(user?.role || ''))) return false;
    if ((work.jobs.length || work.leads.length || work.enquiries.length) && !permissions.some(p => ['job_orders', 'enquiries'].includes(p))) return false;
    if (work.followUps.length && !permissions.some(p => ['follow_ups', 'enquiries', 'job_orders'].includes(p))) return false;
    return true;
  }
  async function clearUserCache(userId: string, email: string) {
    await Promise.all([cacheService.delete(`user:${userId}`), cacheService.delete(`user:email:${email}`), invalidateDashboardCache()]);
  }
  async function deactivate(input: unknown) {
    const { userId, replacementId, revision } = z.object({ userId: z.string().min(1), replacementId: z.string().min(1).optional(), revision: z.string().min(1) }).parse(input);
    authorize(userId);
    const user = await prisma.$transaction(async db => {
      const user = await target(db, userId);
      if (!user.isActive) throw new BadRequestError('This user is already inactive');
      const work = await pendingWork(db, userId);
      if (work.revision !== revision) throw new BadRequestError('Pending work changed. Close and reopen this window to review the latest assignments.');
      const needsTransfer = work.jobs.length + work.leads.length + work.enquiries.length + work.surveys.length > 0;
      const replacement = replacementId ? await db.user.findFirst({ where: { id: replacementId, ...active }, include: { userRole: true } }) : null;
      if (needsTransfer && (!replacement || replacement.id === userId)) throw new BadRequestError('Select another active user to receive pending work');
      if (replacement) {
        if (!eligible(replacement, work)) throw new BadRequestError('The replacement needs permission to access all transferred work');
        if (replacement.id === userId) throw new BadRequestError('Select another active user');
        const branches = workBranches(work, user.branch);
        if (replacement.role !== 'admin' && branches.some(branch => branch !== replacement.branch)) throw new BadRequestError('The replacement must belong to the work’s branch, or be an administrator');
        const ids = (rows: { id: string }[]) => ({ in: rows.map(row => row.id) });
        await db.jobOrder.updateMany({ where: { id: ids(work.jobs) }, data: { managerId: replacement.id } });
        await db.jobLead.updateMany({ where: { id: ids(work.leads) }, data: { assigneeId: replacement.id } });
        await db.enquiry.updateMany({ where: { id: ids(work.enquiries) }, data: { assignedToUserId: replacement.id } });
        await db.admission.updateMany({ where: { id: ids(work.surveys), assignedToUserId: userId }, data: { assignedToUserId: replacement.id } });
        await db.admission.updateMany({ where: { id: ids(work.surveys), handledByUserId: userId }, data: { handledByUserId: replacement.id } });
        if (needsTransfer) await db.notification.create({ data: { userId: replacement.id, title: 'Pending work transferred', message: `${actor.name} transferred pending work from ${user.name} to you.`, type: 'GENERAL', link: '/enquiries/job-orders' } });
      }
      await db.user.update({ where: { id: userId }, data: { isActive: false, authVersion: { increment: 1 } } });
      await db.session.deleteMany({ where: { userId } });
      await db.userLifecycleEvent.create({ data: { userId, userName: user.name, actorId: actor.id, actorName: actor.name, action: 'DEACTIVATED', replacementId: replacement?.id, replacementName: replacement?.name, transfers: JSON.parse(JSON.stringify(work)) } });
      return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await clearUserCache(user.id, user.email);
    return { success: true, message: 'User deactivated. Pending work transferred and history preserved.' };
  }
  async function reactivate(input: unknown) {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(input);
    authorize(userId);
    const user = await prisma.$transaction(async db => {
      const user = await target(db, userId);
      if (user.isActive) throw new BadRequestError('This user is already active');
      await db.user.update({ where: { id: userId }, data: { isActive: true } });
      await db.userLifecycleEvent.create({ data: { userId, userName: user.name, actorId: actor.id, actorName: actor.name, action: 'REACTIVATED', transfers: {} } });
      return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await clearUserCache(user.id, user.email);
    return { success: true, message: 'User reactivated. Previously transferred work remains with its current owner.' };
  }
  async function permanentlyDelete(input: unknown) {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(input);
    authorize(userId);
    const user = await prisma.$transaction(async db => {
      const user = await target(db, userId);
      const linked = await db.user.findUnique({ where: { id: userId }, select: { _count: true } });
      const previousTransfers = await db.userLifecycleEvent.findMany({ where: { userId, action: 'DEACTIVATED' }, select: { transfers: true } });
      const hadWork = hadTransferredWork(previousTransfers);
      if (hasRecords(linked?._count) || hadWork) throw new BadRequestError('This account has CRM records or work history. Deactivate it to preserve history.');
      await db.userLifecycleEvent.create({ data: { userId, userName: user.name, actorId: actor.id, actorName: actor.name, action: 'DELETED_UNUSED_ACCOUNT', transfers: {} } });
      await db.user.delete({ where: { id: userId } });
      return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await clearUserCache(user.id, user.email);
    return { success: true, message: 'Unused account permanently deleted' };
  }
  return { preview, deactivate, reactivate, permanentlyDelete };
}
