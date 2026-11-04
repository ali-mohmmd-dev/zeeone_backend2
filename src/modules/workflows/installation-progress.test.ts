import assert from 'node:assert/strict';
import test from 'node:test';
import { installationProgressData, installationProgressScope, saveInstallationProgress } from './support/lib/installation-progress.js';

const input = { id: 'project-1', stage: 'INSTALLED' as const };
const fieldUser = { id: 'field-1', role: 'job_orders' };

test('admins, managers, and project staff receive the correct update scope', () => {
  assert.deepEqual(installationProgressScope({ id: 'admin-1', role: 'admin' }), {});
  assert.deepEqual(installationProgressScope({ id: 'manager-1', role: 'manager', branch: 'branch-1' }), {
    OR: [
      { enquiry: { branchId: 'branch-1' } },
      { enquiryId: null, createdBy: { branch: 'branch-1' } },
    ],
  });
  for (const role of ['telecaller', 'accounts', 'custom', null]) {
    assert.equal(installationProgressScope({ id: 'other', role }), null);
  }
  assert.deepEqual(installationProgressScope(fieldUser), { assignedToUserId: 'field-1' });
  assert.deepEqual(installationProgressScope({ id: 'exec-1', role: 'executive' }), { assignedToUserId: 'exec-1' });
  assert.deepEqual(installationProgressScope({ id: 'svc-1', role: 'services' }), { assignedToUserId: 'svc-1' });
});

test('field staff progress updates are scoped to their assigned survey', () => {
  assert.deepEqual(installationProgressScope({ id: 'field-2', role: 'job_orders' }), { assignedToUserId: 'field-2' });
  assert.deepEqual(installationProgressScope({ id: 'legacy-field', role: 'joborders' }), { assignedToUserId: 'legacy-field' });
});

function database(project: { additionalNotes: string | null } | null, count = 1) {
  const writes: any[] = [];
  const reads: any[] = [];
  const tx = {
    admission: {
      async findFirst(query: any) { reads.push(query); return project; },
      async updateMany(query: any) { writes.push(query); return { count }; },
    },
  } as unknown as Parameters<typeof saveInstallationProgress>[0];
  return { tx, writes, reads };
}

test('an unauthorized role cannot read or write through the save operation', async () => {
  const db = database({ additionalNotes: null });
  await assert.rejects(saveInstallationProgress(db.tx, { id: 'other', role: 'telecaller' }, input), /permissions/);
  assert.equal(db.reads.length, 0);
  assert.equal(db.writes.length, 0);
});

test('a missing project cannot be written', async () => {
  const db = database(null);
  await assert.rejects(saveInstallationProgress(db.tx, fieldUser, input), /Project not found/);
  assert.equal(db.writes.length, 0);
  assert.deepEqual(db.reads[0].where, { id: input.id, ...installationProgressScope(fieldUser) });
});

test('field staff save progress only for assigned surveys without changing documents or financial fields', async () => {
  const db = database({ additionalNotes: JSON.stringify({ documents: { bill: '/bill.pdf' }, notes: 'Keep this' }) });
  await saveInstallationProgress(db.tx, fieldUser, input);
  assert.deepEqual(db.reads[0].where, { id: input.id, assignedToUserId: 'field-1' });
  assert.deepEqual(db.writes[0].where, db.reads[0].where);
  assert.deepEqual(Object.keys(db.writes[0].data).sort(), ['additionalNotes', 'status']);
  assert.equal(db.writes[0].data.status, 'COMPLETED');
  const notes = JSON.parse(db.writes[0].data.additionalNotes);
  assert.deepEqual(notes.documents, { bill: '/bill.pdf' });
  assert.equal(notes.notes, 'Keep this');
  assert.equal(notes.timelineStep, 'INSTALLED');
  assert.ok(notes.installedAt);
});

test('project removal before the write rejects the save', async () => {
  const db = database({ additionalNotes: null }, 0);
  await assert.rejects(saveInstallationProgress(db.tx, fieldUser, input), /Project not found/);
});

test('admins can update a project without an assignment', async () => {
  const db = database({ additionalNotes: null });
  await saveInstallationProgress(db.tx, { id: 'admin-1', role: 'admin' }, input);
  assert.deepEqual(db.writes[0].where, { id: input.id });
});

test('invalid stages and extra writable fields are rejected', async () => {
  const db = database({ additionalNotes: null });
  await assert.rejects(saveInstallationProgress(db.tx, fieldUser, { ...input, stage: 'INVALID' } as any));
  await assert.rejects(saveInstallationProgress(db.tx, fieldUser, { ...input, balance: 0 } as any));
  assert.equal(db.writes.length, 0);
});

test('all stages map to project status and preserve legacy notes', () => {
  for (const [stage, expected] of [
    ['SURVEY_COMPLETED', 'PENDING'], ['DOCUMENTS_VERIFIED', 'PENDING'],
    ['MATERIAL_DISPATCHED', 'CONFIRMED'], ['INSTALLATION_IN_PROGRESS', 'CONFIRMED'], ['INSTALLED', 'COMPLETED'],
  ] as const) {
    const data = installationProgressData(stage, 'Legacy site notes');
    assert.equal(data.status, expected);
    assert.equal(JSON.parse(data.additionalNotes).notes, 'Legacy site notes');
  }
});
