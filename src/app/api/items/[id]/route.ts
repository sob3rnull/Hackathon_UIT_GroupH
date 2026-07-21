import { NextResponse } from "next/server";
import { deleteItem } from "@/lib/store";

/** Note: in Next 16 route params arrive as a Promise. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await deleteItem(id);
    return NextResponse.json({ ok: true, data: { id } });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Delete failed",
      },
      { status: 500 },
    );
  }
}
