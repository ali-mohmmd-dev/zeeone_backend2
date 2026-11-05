import type { Prisma, PrismaClient } from '@prisma/client';
import type { DueLead, LeadEvent, MetaSettings } from './meta-lead.schema.js';

export interface MetaInbox {
  enqueue(events: LeadEvent[]): Promise<void>;
  due(pageId: string, ids?: string[]): Promise<DueLead[]>;
  routingIsValid(settings: MetaSettings): Promise<boolean>;
  complete(id: string, create: (tx: Prisma.TransactionClient) => Promise<{ id: string }>): Promise<boolean>;
  fail(event: DueLead, reason: string, needsAttention: boolean): Promise<void>;
}

export class MetaLeadRepository implements MetaInbox {
  constructor(private prisma: PrismaClient) {}

  async enqueue(events: LeadEvent[]): Promise<void> {
    if (events.length) await this.prisma.metaLead.createMany({ data: events, skipDuplicates: true });
  }

  async due(pageId: string, ids?: string[]): Promise<DueLead[]> {
    return this.prisma.metaLead.findMany({
      where: { pageId, ...(ids ? { id: { in: ids } } : {}), status: { in: ['PENDING', 'RETRY'] }, nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: 3,
      select: { id: true, pageId: true, formId: true, attempts: true },
    });
  }

  async routingIsValid(settings: MetaSettings): Promise<boolean> {
    const [branch, creator, assignee] = await Promise.all([
      this.prisma.branch.findUnique({ where: { id: settings.branchId }, select: { isActive: true } }),
      this.prisma.user.findUnique({ where: { id: settings.integrationUserId }, select: { banned: true, isActive: true } }),
      settings.assigneeId ? this.prisma.user.findUnique({ where: { id: settings.assigneeId }, select: { banned: true, isActive: true, branch: true } }) : null,
    ]);
    if (!branch?.isActive || !creator || creator.isActive === false || creator.banned) return false;
    if (settings.assigneeId && (!assignee || assignee.isActive === false || assignee.banned || (assignee.branch && assignee.branch !== settings.branchId))) return false;
    return true;
  }

  async complete(id: string, create: (tx: Prisma.TransactionClient) => Promise<{ id: string }>): Promise<boolean> {
    return this.prisma.$transaction(async tx => {
      // Two deliveries may fetch concurrently, but only one may create the enquiry.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "meta_lead" WHERE id = ${id} FOR UPDATE SKIP LOCKED`;
      if (!locked.length) return false;
      const event = await tx.metaLead.findUnique({ where: { id } });
      if (!event || event.status === 'IMPORTED') return false;
      const enquiry = await create(tx);
      await tx.metaLead.update({
        where: { id },
        data: { enquiryId: enquiry.id, status: 'IMPORTED', lastError: null, attempts: { increment: 1 } },
      });
      return true;
    });
  }

  async fail(event: DueLead, reason: string, needsAttention: boolean): Promise<void> {
    const delay = Math.min(60, 2 ** Math.min(event.attempts, 6)) * 60_000;
    await this.prisma.metaLead.updateMany({
      where: { id: event.id, status: { in: ['PENDING', 'RETRY'] } },
      data: {
        status: needsAttention ? 'NEEDS_ATTENTION' : 'RETRY',
        attempts: { increment: 1 },
        lastError: reason,
        nextAttemptAt: new Date(Date.now() + delay),
      },
    });
  }
}
