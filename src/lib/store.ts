import "server-only";

import { env, isSupabaseConfigured } from "@/lib/env";
import { createDataClient } from "@/lib/supabase/server";
import type { Item, NewItem } from "@/lib/types";

/**
 * The only place the app talks to storage.
 *
 * With no Supabase keys it runs entirely in memory, so `npm run dev` works
 * on a fresh clone with zero setup. Add the keys to `.env.local` and every
 * call below transparently hits Postgres instead — no component changes.
 *
 * To adapt: rename the table in `.env.local` (SUPABASE_TABLE) and widen the
 * column list in `select()` as you add fields.
 */

/* ── In-memory fallback ─────────────────────────────────────────────── */

// Stashed on globalThis so hot reloads in dev don't wipe the demo data.
const globalStore = globalThis as unknown as { __items?: Item[] };

function seed(): Item[] {
  const now = Date.now();
  return [
    {
      id: "seed-1",
      title: "Replace me with something from the real topic",
      notes:
        "This row proves the whole path works: form → API route → store → list.",
      status: "active",
      created_at: new Date(now - 1000 * 60 * 42).toISOString(),
    },
    {
      id: "seed-2",
      title: "Wire the topic logic into /api/items",
      notes: "Everything around it is already built.",
      status: "new",
      created_at: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
    },
  ];
}

function memory(): Item[] {
  globalStore.__items ??= seed();
  return globalStore.__items;
}

/* ── Public API ─────────────────────────────────────────────────────── */

export async function listItems(): Promise<Item[]> {
  const db = createDataClient();

  if (!db) {
    return [...memory()].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  }

  const { data, error } = await db
    .from(env.table)
    .select("id, title, notes, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as Item[];
}

export async function createItem(input: NewItem): Promise<Item> {
  const db = createDataClient();

  if (!db) {
    const item: Item = {
      id: crypto.randomUUID(),
      title: input.title,
      notes: input.notes ?? "",
      status: input.status ?? "new",
      created_at: new Date().toISOString(),
    };
    memory().unshift(item);
    return item;
  }

  const { data, error } = await db
    .from(env.table)
    .insert({
      title: input.title,
      notes: input.notes ?? "",
      status: input.status ?? "new",
    })
    .select("id, title, notes, status, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as Item;
}

export async function deleteItem(id: string): Promise<void> {
  const db = createDataClient();

  if (!db) {
    const items = memory();
    const index = items.findIndex((item) => item.id === id);
    if (index !== -1) items.splice(index, 1);
    return;
  }

  const { error } = await db.from(env.table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Powers the "Demo data" / "Supabase" badge in the header. */
export function storeMode(): "supabase" | "memory" {
  return isSupabaseConfigured ? "supabase" : "memory";
}
