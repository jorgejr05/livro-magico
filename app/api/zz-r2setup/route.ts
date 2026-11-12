import { need } from "@/lib/server";
import { r2Api, r2Auth } from "@/lib/r2";

export const runtime = "nodejs";

// TEMPORÁRIA: troca a regra de expiração do bucket (livros 90 dias, renders antigos 1 dia). Removida logo depois.
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("k") !== need("PAY_SECRET")) return new Response("no", { status: 401 });
  const rule = (id: string, prefix: string, maxAge: number) => ({ id, enabled: true, conditions: { prefix }, deleteObjectsTransition: { condition: { type: "Age", maxAge } } });
  const res = await fetch(`${r2Api()}/lifecycle`, {
    method: "PUT",
    headers: { ...r2Auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ rules: [rule("books-90d", "books/", 90 * 86400), rule("renders-1d", "renders/", 86400)] }),
  });
  const get = await fetch(`${r2Api()}/lifecycle`, { headers: r2Auth() });
  return Response.json({ put: res.status, putBody: (await res.text()).slice(0, 300), current: await get.json() });
}
