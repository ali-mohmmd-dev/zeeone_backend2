import { z } from 'zod';

const metaId = z.string().regex(/^\d{1,64}$/);
export const verificationSchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string().min(1).max(1024),
  'hub.challenge': z.string().min(1).max(200),
});
export const webhookSchema = z.object({
  object: z.literal('page'),
  entry: z.array(z.object({
    id: metaId,
    changes: z.array(z.object({ field: z.string(), value: z.unknown() })).max(100),
  })).max(100),
});
export const leadEventSchema = z.object({
  leadgen_id: metaId,
  page_id: metaId.optional(),
  form_id: metaId,
});
export const graphLeadSchema = z.object({
  id: metaId,
  form_id: metaId,
  created_time: z.string().optional(),
  field_data: z.array(z.object({
    name: z.string().max(200),
    values: z.array(z.string().max(10000)).max(20),
  })).max(100),
});
export type GraphLead = z.infer<typeof graphLeadSchema>;
export type MetaSettings = {
  verifyToken: string;
  appSecret: string;
  pageId: string;
  pageAccessToken: string;
  graphVersion: string;
  branchId: string;
  integrationUserId: string;
  assigneeId: string;
  formIds: string[];
  processSecret: string;
};
export type LeadEvent = { id: string; pageId: string; formId: string };
export type DueLead = LeadEvent & { attempts: number };
