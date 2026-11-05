import type { Prisma } from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import { EnquiryService } from '../enquiries/enquiry.service.js';
import { MetaLeadClient } from './meta-lead.client.js';
import { mapMetaLead } from './meta-lead.mapper.js';
import type { MetaInbox } from './meta-lead.repository.js';
import { leadEventSchema, verificationSchema, webhookSchema, type DueLead, type LeadEvent, type MetaSettings } from './meta-lead.schema.js';
import { requireSecret } from './meta-lead.security.js';

type EnquiryWriter = (tx: Prisma.TransactionClient, input: NonNullable<ReturnType<typeof mapMetaLead>>) => Promise<{ id: string }>;

export class MetaLeadService {
  constructor(
    private inbox: MetaInbox,
    private settings: MetaSettings,
    private client = new MetaLeadClient(settings),
    private createEnquiry: EnquiryWriter = (tx, input) => new EnquiryService(tx).createEnquiry(input, {
      id: settings.integrationUserId, role: null, branch: settings.branchId,
    }),
  ) {}

  verify(query: unknown): string {
    const parsed = verificationSchema.parse(query);
    requireSecret(parsed['hub.verify_token'], this.settings.verifyToken);
    return parsed['hub.challenge'];
  }

  private events(body: unknown): LeadEvent[] {
    if (!this.settings.pageId) throw new AppError('Meta Page is not configured', 503, 'META_NOT_CONFIGURED');
    const payload = webhookSchema.parse(body);
    const events: LeadEvent[] = [];
    for (const entry of payload.entry) {
      if (entry.id !== this.settings.pageId) continue;
      for (const change of entry.changes) {
        if (change.field !== 'leadgen') continue;
        const value = leadEventSchema.parse(change.value);
        if (value.page_id && value.page_id !== entry.id) continue;
        if (this.settings.formIds.length && !this.settings.formIds.includes(value.form_id)) continue;
        events.push({ id: value.leadgen_id, pageId: entry.id, formId: value.form_id });
      }
    }
    return events;
  }

  async receive(body: unknown): Promise<{ received: true }> {
    const events = this.events(body);
    await this.inbox.enqueue(events);
    // Await bounded processing on serverless. The durable inbox retains overflow and failures.
    if (events.length && this.ready()) await this.process(events.map(event => event.id));
    return { received: true };
  }

  private ready(): boolean {
    return Boolean(this.settings.pageAccessToken && /^v\d+\.\d+$/.test(this.settings.graphVersion)
      && this.settings.branchId && this.settings.integrationUserId);
  }

  async process(ids?: string[]): Promise<{ imported: number; deferred: number }> {
    if (!this.settings.pageId || !this.ready()) throw new AppError('Meta lead import is not configured', 503, 'META_NOT_CONFIGURED');
    const events = await this.inbox.due(this.settings.pageId, ids);
    const results = await Promise.all(events.map(event => this.processOne(event)));
    const imported = results.filter(Boolean).length;
    return { imported, deferred: events.length - imported };
  }

  private async processOne(event: DueLead): Promise<boolean> {
    try {
      if (this.settings.formIds.length && !this.settings.formIds.includes(event.formId)) {
        await this.inbox.fail(event, 'FORM_NOT_ALLOWED', true);
        return false;
      }
      if (!await this.inbox.routingIsValid(this.settings)) {
        await this.inbox.fail(event, 'INVALID_BRANCH_CREATOR_OR_ASSIGNEE', false);
        return false;
      }
      const lead = await this.client.retrieve(event.id);
      if (lead.form_id !== event.formId) {
        await this.inbox.fail(event, 'FORM_MISMATCH', true);
        return false;
      }
      const input = mapMetaLead(lead, this.settings);
      if (!input) {
        await this.inbox.fail(event, 'INVALID_NAME_PHONE_OR_EMAIL', true);
        return false;
      }
      return await this.inbox.complete(event.id, tx => this.createEnquiry(tx, input));
    } catch {
      await this.inbox.fail(event, 'RETRIEVAL_OR_IMPORT_FAILED', false);
      return false;
    }
  }
}
