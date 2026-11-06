import { checkAccess, fail } from "@/lib/server";
import { HF_HOST, hfHeaders } from "@/lib/higgsfield";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(new Error("ID inválido."), 400);
    const res = await fetch(`${HF_HOST}/requests/${id}/status`, { headers: hfHeaders(), cache: "no-store" });
    const text = await res.text();
    if (!res.ok) throw new Error(`Higgsfield (${res.status}): ${text.slice(0, 400)}`);
    return Response.json(JSON.parse(text));
  } catch (e) {
    return fail(e);
  }
}
