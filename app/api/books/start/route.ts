import { checkAccess, fail } from "@/lib/server";
import { rpc } from "@/lib/supabase";
import { requirePaid } from "@/lib/books";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const { id } = await req.json();
    await requirePaid(id);
    await rpc("book_set_generating", { p_id: id });
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
