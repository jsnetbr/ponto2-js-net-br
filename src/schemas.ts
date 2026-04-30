import { z } from 'zod';

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string().nullable(),
  created_at: z.string().datetime(),
});

export const UserSettingsSchema = z.object({
  user_id: z.string().uuid(),
  expected_minutes: z.number().min(1).max(1440),
  lunch_minutes: z.number().min(0).max(1440).optional().default(60),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const PunchSchema = z.object({
  id: z.string(),
  user_id: z.string().uuid(),
  timestamp: z.string().datetime(),
  type: z.enum(['in', 'out', 'lunch_start', 'lunch_end']),
  created_at: z.string().datetime(),
  pending: z.boolean().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type PunchSupabase = z.infer<typeof PunchSchema>;
