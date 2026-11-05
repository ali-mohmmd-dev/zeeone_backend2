import { createHmac } from 'node:crypto';
import { AppError } from '../../errors/app-error.js';
import { graphLeadSchema, type GraphLead, type MetaSettings } from './meta-lead.schema.js';

export class MetaLeadClient {
  constructor(private settings: MetaSettings, private request: typeof fetch = fetch) {}

  async retrieve(id: string): Promise<GraphLead> {
    if (!/^v\d+\.\d+$/.test(this.settings.graphVersion) || !this.settings.pageAccessToken) {
      throw new AppError('Meta retrieval credentials or API version are missing', 503, 'META_NOT_CONFIGURED');
    }
    const url = new URL(`https://graph.facebook.com/${this.settings.graphVersion}/${encodeURIComponent(id)}`);
    url.searchParams.set('fields', 'id,created_time,form_id,field_data');
    url.searchParams.set('appsecret_proof', createHmac('sha256', this.settings.appSecret).update(this.settings.pageAccessToken).digest('hex'));
    try {
      const response = await this.request(url, {
        headers: { Authorization: `Bearer ${this.settings.pageAccessToken}` },
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Graph request failed');
      const parsed = graphLeadSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.id !== id) throw new Error('Unexpected lead response');
      return parsed.data;
    } catch {
      // Never propagate Graph errors, tokens, URLs or customer fields into logs.
      throw new AppError('Meta lead retrieval failed; check Page access and token validity', 502, 'META_RETRIEVAL_FAILED');
    }
  }
}
