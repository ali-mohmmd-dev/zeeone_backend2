import { z } from 'zod';

export const notificationFilterSchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional().default('false'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;
