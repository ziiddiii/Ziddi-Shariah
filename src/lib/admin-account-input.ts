import { z } from "zod";

export const adminAccountInput = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a name").max(150),
  username: z.string().trim().min(1, "Enter a username").max(100),
  email: z.string().trim().email("Enter a valid email address").max(254),
  phone: z.string().trim().max(30).refine((v) => !v || /^\+?[\d\s()-]{7,30}$/.test(v), "Enter a valid phone number"),
  password: z.string().max(128).refine((v) => !v || v.length >= 6, "Password must be at least 6 characters"),
});
export type AdminAccountInput = z.infer<typeof adminAccountInput>;