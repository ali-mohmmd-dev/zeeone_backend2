import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getUserEffectivePermissions } from './permissions.js';

export const installationProgressSchema = z.object({
  id: z.string().min(1),
  stage: z.enum([
    'SURVEY_COMPLETED', 'DOCUMENTS_VERIFIED', 'MATERIAL_DISPATCHED',
    'INSTALLATION_IN_PROGRESS', 'INSTALLED',
  ]),
}).strict();

type ProgressUser = {
  id: string;
  role?: string | null;
  branch?: string | null;
  permissions?: string[];
  userRole?: { permissions: string[] } | null;
};

// Staff can update only assigned surveys; managers are limited to their branch.
export function installationProgressScope(user: ProgressUser): Prisma.AdmissionWhereInput | null {
  const role = (user.role || '').toLowerCase().trim();
  if (role === 'admin') return {};
  if (['manager', 'branch manager'].includes(role)) {
    if (!user.branch) return { id: '__no_branch_access__' };
    return {
      OR: [
        { enquiry: { branchId: user.branch } },
        { enquiryId: null, createdBy: { branch: user.branch } },
      ],
    };
  }
  const permissions = getUserEffectivePermissions(user);
  if (!permissions.some((permission) => ['*', 'all', 'projects'].includes(permission))) return null;
  return { assignedToUserId: user.id };
}

export function installationProgressData(stage: z.infer<typeof installationProgressSchema>['stage'], existingNotes: string | null) {
  let notes: Record<string, unknown> = {};
  if (existingNotes) {
    try {
      const parsed: unknown = JSON.parse(existingNotes);
      notes = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown> : { notes: existingNotes };
    } catch {
      notes = { notes: existingNotes };
    }
  }
  const status = stage === 'INSTALLED' ? 'COMPLETED' as const
    : stage === 'MATERIAL_DISPATCHED' || stage === 'INSTALLATION_IN_PROGRESS'
      ? 'CONFIRMED' as const : 'PENDING' as const;
  const now = new Date().toISOString();
  return {
    status,
    additionalNotes: JSON.stringify({
      ...notes,
      timelineStep: stage,
      timelineUpdatedAt: now,
      ...(stage === 'INSTALLED' ? { installedAt: now } : {}),
    }),
  };
}

export async function saveInstallationProgress(
  tx: Pick<Prisma.TransactionClient, 'admission'>,
  user: ProgressUser,
  input: z.infer<typeof installationProgressSchema>,
) {
  const { id, stage } = installationProgressSchema.parse(input ?? {});
  const scope = installationProgressScope(user);
  if (!scope) throw new Error('Insufficient permissions');
  const where = { id, ...scope };
  const project = await tx.admission.findFirst({ where, select: { additionalNotes: true } });
  if (!project) throw new Error('Project not found');
  const result = await tx.admission.updateMany({
    where,
    data: installationProgressData(stage, project.additionalNotes),
  });
  if (result.count !== 1) throw new Error('Project not found');
}
