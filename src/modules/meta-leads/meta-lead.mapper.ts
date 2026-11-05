import { createEnquirySchema, type CreateEnquiryInput } from '../enquiries/enquiry.schema.js';
import type { GraphLead, MetaSettings } from './meta-lead.schema.js';

export function mapMetaLead(lead: GraphLead, settings: MetaSettings): CreateEnquiryInput | null {
  const fields = new Map(lead.field_data.map(field => [field.name, field.values.join(', ')]));
  const fullName = fields.get('full_name') || [fields.get('first_name'), fields.get('last_name')].filter(Boolean).join(' ');
  const known = new Set(['full_name', 'first_name', 'last_name', 'phone_number', 'phone', 'email', 'street_address', 'city', 'state', 'zip_code', 'country']);
  const customAnswers = lead.field_data.filter(field => !known.has(field.name))
    .map(field => `${field.name}: ${field.values.join(', ')}`);
  const address = ['street_address', 'city', 'state', 'zip_code', 'country'].map(key => fields.get(key)).filter(Boolean).join(', ');
  const parsed = createEnquirySchema.safeParse({
    candidateName: fullName?.trim(),
    phone: (fields.get('phone_number') || fields.get('phone') || '').replace(/[^0-9]/g, ''),
    email: fields.get('email')?.trim() || null,
    address: address || null,
    notes: [`Meta lead ${lead.id}; form ${lead.form_id}`, ...customAnswers].join('\n'),
    source: 'Meta Lead Ads',
    branchId: settings.branchId,
    assignedToUserId: settings.assigneeId || null,
    status: 'NEW',
  });
  return parsed.success ? parsed.data : null;
}
