import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import Fastify from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import { errorHandler } from '../../middleware/error.middleware.js';
import { MetaLeadClient } from './meta-lead.client.js';
import { mapMetaLead } from './meta-lead.mapper.js';
import { MetaLeadRepository, type MetaInbox } from './meta-lead.repository.js';
import { metaLeadRoutes } from './meta-lead.routes.js';
import type { DueLead, GraphLead, LeadEvent, MetaSettings } from './meta-lead.schema.js';
import { MetaLeadService } from './meta-lead.service.js';

const settings: MetaSettings = {
  verifyToken: 'verification-secret', appSecret: 'app-secret', pageId: '100',
  pageAccessToken: 'private-page-token', graphVersion: 'v25.0', branchId: 'branch-1',
  integrationUserId: 'integration-user', assigneeId: '', formIds: ['200'], processSecret: 'worker-secret',
};
const lead: GraphLead = {
  id: '300', form_id: '200', created_time: '2026-11-05T12:00:00+0000',
  field_data: [
    { name: 'full_name', values: ['Example Person'] },
    { name: 'phone_number', values: ['+91 (98765) 43210'] },
    { name: 'email', values: ['person@example.com'] },
    { name: 'required_capacity', values: ['5 kW'] },
  ],
};
const payload = { object: 'page', entry: [{ id: '100', changes: [{ field: 'leadgen', value: { leadgen_id: '300', page_id: '100', form_id: '200' } }] }] };
const sign = (body: string) => `sha256=${createHmac('sha256', settings.appSecret).update(body).digest('hex')}`;

class MemoryInbox implements MetaInbox {
  events = new Map<string, DueLead & { status: string; reason?: string }>();
  validRouting = true;
  failEnqueue = false;
  failCompletion = false;
  imported = 0;
  async enqueue(events: LeadEvent[]): Promise<void> {
    if (this.failEnqueue) throw new Error('Database unavailable');
    for (const event of events) if (!this.events.has(event.id)) this.events.set(event.id, { ...event, attempts: 0, status: 'PENDING' });
  }
  async due(pageId: string, ids?: string[]): Promise<DueLead[]> {
    return [...this.events.values()].filter(event => event.pageId === pageId
      && (!ids || ids.includes(event.id)) && ['PENDING', 'RETRY'].includes(event.status)).slice(0, 3);
  }
  async routingIsValid(): Promise<boolean> { return this.validRouting; }
  async complete(id: string, create: (tx: Prisma.TransactionClient) => Promise<{ id: string }>): Promise<boolean> {
    if (this.failCompletion) throw new Error('Transaction unavailable');
    const event = this.events.get(id);
    if (!event || event.status === 'IMPORTED') return false;
    await create({} as Prisma.TransactionClient);
    event.status = 'IMPORTED';
    this.imported++;
    return true;
  }
  async fail(event: DueLead, reason: string, needsAttention: boolean): Promise<void> {
    const stored = this.events.get(event.id);
    if (!stored || stored.status === 'IMPORTED') return;
    stored.status = needsAttention ? 'NEEDS_ATTENTION' : 'RETRY';
    stored.reason = reason;
  }
}

async function fixture(overrides: Partial<MetaSettings> = {}, request: typeof fetch = async () => Response.json(lead)) {
  const configuration = { ...settings, ...overrides };
  const inbox = new MemoryInbox();
  const enquiries: NonNullable<ReturnType<typeof mapMetaLead>>[] = [];
  const service = new MetaLeadService(inbox, configuration, new MetaLeadClient(configuration, request), async (_tx, input) => {
    enquiries.push(input);
    return { id: 'enquiry-1' };
  });
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  await app.register(metaLeadRoutes, { prefix: '/api/v1/integrations/meta', settings: configuration, service });
  app.post('/echo', async request => request.body);
  return { app, inbox, enquiries, service };
}

const webhook = '/api/v1/integrations/meta/webhook';
test('verification returns exactly the plain-text challenge without requiring a CRM session', async t => {
  const { app } = await fixture();
  t.after(() => app.close());
  const response = await app.inject({ url: `${webhook}?hub.mode=subscribe&hub.verify_token=${settings.verifyToken}&hub.challenge=001234` });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, '001234');
  assert.match(response.headers['content-type'] as string, /text\/plain/);
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('verification rejects wrong tokens, invalid mode and missing challenge', async t => {
  const { app } = await fixture();
  t.after(() => app.close());
  for (const [query, expected] of [
    ['hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1', 403],
    ['hub.mode=unsubscribe&hub.verify_token=verification-secret&hub.challenge=1', 400],
    ['hub.mode=subscribe&hub.verify_token=verification-secret', 400],
  ] as const) assert.equal((await app.inject({ url: `${webhook}?${query}` })).statusCode, expected);
});

test('unconfigured verification, signatures and worker credentials fail closed', async t => {
  const { app } = await fixture({ verifyToken: '', appSecret: '', processSecret: '' });
  t.after(() => app.close());
  const verify = await app.inject({ url: `${webhook}?hub.mode=subscribe&hub.verify_token=x&hub.challenge=1` });
  assert.equal(verify.statusCode, 503);
  const body = JSON.stringify(payload);
  assert.equal((await app.inject({ method: 'POST', url: webhook, payload: body, headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(body) } })).statusCode, 503);
  assert.equal((await app.inject({ url: '/api/v1/integrations/meta/process' })).statusCode, 503);
});

test('a signed notification imports one mapped enquiry; redelivery is idempotent', async t => {
  const { app, inbox, enquiries } = await fixture();
  t.after(() => app.close());
  const body = JSON.stringify(payload, null, 2);
  for (let i = 0; i < 2; i++) {
    const response = await app.inject({ method: 'POST', url: webhook, payload: body, headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(body) } });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json(), { received: true });
  }
  assert.equal(inbox.imported, 1);
  assert.equal(enquiries.length, 1);
  assert.equal(enquiries[0].candidateName, 'Example Person');
  assert.equal(enquiries[0].phone, '919876543210');
  assert.equal(enquiries[0].branchId, 'branch-1');
  assert.equal(enquiries[0].status, 'NEW');
  assert.equal(enquiries[0].source, 'Meta Lead Ads');
  assert.match(enquiries[0].notes ?? '', /required_capacity: 5 kW/);
  assert.equal(enquiries[0].assignedToUserId, null);
});

test('missing, malformed and altered-body signatures cause no inbox or enquiry writes', async t => {
  const { app, inbox } = await fixture();
  t.after(() => app.close());
  const body = JSON.stringify(payload);
  for (const signature of [undefined, 'sha256=x', `sha256=${'0'.repeat(64)}`, sign(body + ' ')]) {
    const response = await app.inject({ method: 'POST', url: webhook, payload: body, headers: { 'content-type': 'application/json', ...(signature ? { 'x-hub-signature-256': signature } : {}) } });
    assert.equal(response.statusCode, 403);
  }
  assert.equal(inbox.events.size, 0);
});

test('malformed signed JSON and invalid lead IDs are rejected without writes', async t => {
  const { app, inbox } = await fixture();
  t.after(() => app.close());
  for (const body of ['{invalid', JSON.stringify({ ...payload, entry: [{ id: '100', changes: [{ field: 'leadgen', value: { leadgen_id: '../me', form_id: '200' } }] }] })]) {
    const response = await app.inject({ method: 'POST', url: webhook, payload: body, headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(body) } });
    assert.equal(response.statusCode, 400);
  }
  assert.equal(inbox.events.size, 0);
});

test('unrelated Pages, form IDs and change types are acknowledged without importing', async t => {
  const { service, inbox, app } = await fixture();
  t.after(() => app.close());
  for (const entry of [
    { id: '999', changes: payload.entry[0].changes },
    { id: '100', changes: [{ field: 'feed', value: {} }] },
    { id: '100', changes: [{ field: 'leadgen', value: { leadgen_id: '300', page_id: '999', form_id: '200' } }] },
    { id: '100', changes: [{ field: 'leadgen', value: { leadgen_id: '300', form_id: '999' } }] },
  ]) assert.deepEqual(await service.receive({ object: 'page', entry: [entry] }), { received: true });
  assert.equal(inbox.events.size, 0);
});

test('missing required contact fields are retained for attention rather than fabricated', async t => {
  const invalid = { ...lead, field_data: [{ name: 'full_name', values: ['No phone'] }] };
  const { app, service, inbox, enquiries } = await fixture({}, async () => Response.json(invalid));
  t.after(() => app.close());
  await service.receive(payload);
  assert.equal(inbox.events.get('300')?.status, 'NEEDS_ATTENTION');
  assert.equal(inbox.events.get('300')?.reason, 'INVALID_NAME_PHONE_OR_EMAIL');
  assert.equal(enquiries.length, 0);
});

test('Graph failures are saved for retry without storing returned secrets or lead data', async t => {
  const { app, service, inbox } = await fixture({}, async () => new Response('private-page-token customer@example.com', { status: 401 }));
  t.after(() => app.close());
  await service.receive(payload);
  assert.equal(inbox.events.get('300')?.status, 'RETRY');
  assert.equal(inbox.events.get('300')?.reason, 'RETRIEVAL_OR_IMPORT_FAILED');
  assert.doesNotMatch(JSON.stringify([...inbox.events.values()]), /private-page-token|customer@example.com/);
});

test('events are durable if retrieval settings are not ready and the worker can recover later', async t => {
  const { app, service, inbox } = await fixture({ pageAccessToken: '' });
  t.after(() => app.close());
  await service.receive(payload);
  assert.equal(inbox.events.get('300')?.status, 'PENDING');
  const ready = new MetaLeadService(inbox, settings, new MetaLeadClient(settings, async () => Response.json(lead)), async () => ({ id: 'e' }));
  assert.equal((await ready.process()).imported, 1);
});

test('recovery endpoint requires its bearer secret and imports pending events', async t => {
  const { app, inbox } = await fixture();
  t.after(() => app.close());
  await inbox.enqueue([{ id: '300', pageId: '100', formId: '200' }]);
  for (const authorization of [undefined, 'Bearer wrong']) {
    assert.equal((await app.inject({ url: '/api/v1/integrations/meta/process', headers: authorization ? { authorization } : {} })).statusCode, 403);
  }
  assert.equal(inbox.imported, 0);
  const response = await app.inject({ url: '/api/v1/integrations/meta/process', headers: { authorization: 'Bearer worker-secret' } });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().data.imported, 1);
});

test('batch overflow remains queued and each worker invocation imports at most three', async t => {
  const { app, service, inbox } = await fixture({}, async url => Response.json({ ...lead, id: new URL(String(url)).pathname.split('/').at(-1) }));
  t.after(() => app.close());
  const changes = [300, 301, 302, 303].map(id => ({ field: 'leadgen', value: { leadgen_id: String(id), form_id: '200' } }));
  await service.receive({ object: 'page', entry: [{ id: '100', changes }] });
  assert.equal(inbox.imported, 3);
  assert.equal(inbox.events.get('303')?.status, 'PENDING');
  assert.equal((await service.process()).imported, 1);
});

test('inbox database failure returns non-success so Meta can redeliver', async t => {
  const { app, inbox } = await fixture();
  t.after(() => app.close());
  inbox.failEnqueue = true;
  const body = JSON.stringify(payload);
  const response = await app.inject({ method: 'POST', url: webhook, payload: body, headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(body) } });
  assert.equal(response.statusCode, 500);
  assert.equal(inbox.imported, 0);
});

test('invalid routing, form mismatches and import failures never create an enquiry', async t => {
  for (const scenario of ['routing', 'form', 'transaction']) {
    const { app, service, inbox, enquiries } = await fixture({}, async () => Response.json({ ...lead, form_id: scenario === 'form' ? '999' : '200' }));
    t.after(() => app.close());
    inbox.validRouting = scenario !== 'routing';
    inbox.failCompletion = scenario === 'transaction';
    await service.receive(payload);
    assert.equal(enquiries.length, 0);
    assert.equal(inbox.events.get('300')?.status, scenario === 'form' ? 'NEEDS_ATTENTION' : 'RETRY');
  }
});

test('JSON signature parser is encapsulated and does not affect regular CRM routes', async t => {
  const { app } = await fixture();
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/echo', payload: { regular: true } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { regular: true });
});

test('Graph requests use bearer authentication, proof and a timeout without tokens in the URL', async () => {
  let called = false;
  const request: typeof fetch = async (input, init) => {
    called = true;
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://graph.facebook.com');
    assert.equal(url.pathname, '/v25.0/300');
    assert.equal(url.searchParams.has('access_token'), false);
    assert.ok(url.searchParams.get('appsecret_proof'));
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer private-page-token');
    assert.ok(init?.signal);
    assert.equal(init?.redirect, 'error');
    return Response.json(lead);
  };
  assert.equal((await new MetaLeadClient(settings, request).retrieve('300')).id, '300');
  assert.equal(called, true);
});

test('Graph mismatched IDs, timeouts and invalid payloads expose only a safe error', async () => {
  for (const request of [
    async () => Response.json({ ...lead, id: '999' }),
    async () => Response.json({ field_data: 'private-content' }),
    async () => { throw new Error('private-page-token'); },
  ]) {
    await assert.rejects(new MetaLeadClient(settings, request).retrieve('300'), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'Meta lead retrieval failed; check Page access and token validity');
      return true;
    });
  }
});

test('mapping supports split names, configured assignees and rejects invalid email/phone', () => {
  const fields = lead.field_data.filter(field => field.name !== 'full_name');
  fields.push({ name: 'first_name', values: ['First'] }, { name: 'last_name', values: ['Last'] });
  const mapped = mapMetaLead({ ...lead, field_data: fields }, { ...settings, assigneeId: 'staff-1' });
  assert.equal(mapped?.candidateName, 'First Last');
  assert.equal(mapped?.assignedToUserId, 'staff-1');
  assert.equal(mapMetaLead({ ...lead, field_data: fields.map(field => field.name === 'email' ? { ...field, values: ['invalid'] } : field) }, settings), null);
});

test('repository imports exactly once under a transaction lock and retains replay protection after enquiry deletion', async () => {
  let status = 'PENDING';
  let writes = 0;
  let locked = false;
  const tx = {
    $queryRaw: async () => { locked = true; return [{ id: '300' }]; },
    metaLead: {
      findUnique: async () => ({ id: '300', status, enquiryId: null }),
      update: async () => { assert.equal(locked, true); status = 'IMPORTED'; },
    },
  };
  const prisma = { $transaction: async <T>(run: (value: typeof tx) => Promise<T>) => run(tx) } as unknown as PrismaClient;
  const repository = new MetaLeadRepository(prisma);
  const create = async () => { assert.equal(locked, true); writes++; return { id: 'enquiry-1' }; };
  assert.equal(await repository.complete('300', create), true);
  assert.equal(await repository.complete('300', create), false);
  assert.equal(writes, 1);
});

test('repository enqueue uses the external unique ID and failure updates cannot overwrite imported rows', async () => {
  let enqueued = false;
  let failed = false;
  const prisma = {
    metaLead: {
      createMany: async (args: { skipDuplicates: boolean; data: LeadEvent[] }) => { assert.equal(args.skipDuplicates, true); assert.equal(args.data[0].id, '300'); enqueued = true; },
      updateMany: async (args: { where: { status: { in: string[] } }; data: { lastError: string; nextAttemptAt: Date } }) => {
        assert.equal(args.where.status.in.includes('IMPORTED'), false);
        assert.equal(args.data.lastError, 'SAFE_ERROR');
        assert.ok(args.data.nextAttemptAt > new Date());
        failed = true;
      },
    },
  } as unknown as PrismaClient;
  const repository = new MetaLeadRepository(prisma);
  await repository.enqueue([{ id: '300', pageId: '100', formId: '200' }]);
  await repository.fail({ id: '300', pageId: '100', formId: '200', attempts: 0 }, 'SAFE_ERROR', false);
  assert.ok(enqueued && failed);
});

test('concurrent repository deliveries cannot both create an enquiry', async () => {
  let locked = false;
  let status = 'PENDING';
  let creates = 0;
  const prisma = {
    $transaction: async <T>(run: (tx: unknown) => Promise<T>) => {
      let ownsLock = false;
      const tx = {
        $queryRaw: async () => {
          if (locked) return [];
          locked = true;
          ownsLock = true;
          return [{ id: '300' }];
        },
        metaLead: {
          findUnique: async () => ({ status }),
          update: async () => { status = 'IMPORTED'; },
        },
      };
      try { return await run(tx); }
      finally { if (ownsLock) locked = false; }
    },
  } as unknown as PrismaClient;
  const repository = new MetaLeadRepository(prisma);
  const create = async () => { creates++; return { id: 'one-enquiry' }; };
  const results = await Promise.all([repository.complete('300', create), repository.complete('300', create)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(creates, 1);
});

test('repository rejects missing/inactive branches, banned creators and cross-branch assignees', async () => {
  for (const scenario of ['branch', 'creator', 'assignee']) {
    const prisma = {
      branch: { findUnique: async () => ({ isActive: scenario !== 'branch' }) },
      user: { findUnique: async ({ where }: { where: { id: string } }) => where.id === settings.integrationUserId
        ? { banned: scenario === 'creator' }
        : { banned: false, branch: 'different-branch' } },
    } as unknown as PrismaClient;
    assert.equal(await new MetaLeadRepository(prisma).routingIsValid({ ...settings, assigneeId: scenario === 'assignee' ? 'staff-1' : '' }), false);
  }
});
