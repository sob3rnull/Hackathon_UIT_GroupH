import { NextResponse } from "next/server";
import { createItem, listItems } from "@/lib/store";
import { newItemSchema } from "@/lib/types";

/**
 * ── Drop your topic logic in here ──────────────────────────────────────
 * POST already validates, persists and returns the created record. If the
 * topic needs enrichment (an API call, a model, a scrape, a calculation),
 * do it between `parsed.data` and `createItem` and store the result.
 */

export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: await listItems() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: message(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = newItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    // ← topic logic goes here, before the write
    const item = await createItem(parsed.data);
    return NextResponse.json({ ok: true, data: item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: message(error) },
      { status: 500 },
    );
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}
