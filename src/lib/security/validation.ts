import { z } from "zod";
import { sanitizeBio } from "@/lib/security/sanitize";

export const MESSAGE_MAX = 10_000;
export const USERNAME_MAX = 32;
export const STATUS_MAX = 140;
export const BIO_MAX = 280;

export const messageContentSchema = z
  .string()
  .max(MESSAGE_MAX, `Message must be under ${MESSAGE_MAX} characters`);

export const usernameSchema = z
  .string()
  .min(2, "Username too short")
  .max(USERNAME_MAX, `Username must be under ${USERNAME_MAX} characters`)
  .regex(/^[\p{L}\p{N}_][\p{L}\p{N}_.\- ]*$/u, "Username contains invalid characters");

export const profilePatchSchema = z.object({
  username: usernameSchema.optional(),
  avatar_url: z.string().url().max(2048).optional().nullable(),
  status: z.string().max(STATUS_MAX).optional().nullable(),
  bio: z
    .string()
    .max(BIO_MAX, `Bio must be under ${BIO_MAX} characters`)
    .optional()
    .nullable()
    .transform((s) => {
      if (s === undefined) return undefined;
      if (s === null) return null;
      const t = sanitizeBio(s);
      return t.length ? t : null;
    }),
  discoverable: z.boolean().optional(),
  allow_incoming_messages: z.boolean().optional(),
  show_online_status: z.boolean().optional(),
});

export const sendMessageSchema = z.object({
  chat_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  content: z.string().max(MESSAGE_MAX),
  reply_to: z.string().uuid().nullable().optional(),
  attachment_url: z.string().url().max(2048).nullable().optional(),
  attachment_type: z.string().max(64).nullable().optional(),
  attachment_name: z.string().max(256).nullable().optional(),
  attachment_size: z.number().int().nonnegative().nullable().optional(),
  attachment_duration: z.number().nonnegative().nullable().optional(),
});

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.errors[0]?.message ?? "Invalid input";
    throw new Error(msg);
  }
  return result.data;
}
