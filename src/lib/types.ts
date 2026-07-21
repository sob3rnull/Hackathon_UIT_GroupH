import { z } from "zod";

/**
 * The one record type the shell moves around.
 * Rename `Item` → your topic noun and add fields; the form, list and
 * API routes all derive their shape from the schemas below.
 */
export const itemStatuses = ["new", "active", "done"] as const;
export type ItemStatus = (typeof itemStatuses)[number];

/** What the client is allowed to send when creating a record. */
export const newItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(140),
  notes: z.string().trim().max(2000).optional().default(""),
  status: z.enum(itemStatuses).optional().default("new"),
});

export type NewItem = z.infer<typeof newItemSchema>;

/** What comes back out of the store. */
export interface Item {
  id: string;
  title: string;
  notes: string;
  status: ItemStatus;
  created_at: string;
}

/** Every API route answers in this envelope, so the client has one shape to handle. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };
