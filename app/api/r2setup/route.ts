import { fail } from "@/lib/server";
import { r2Api, r2Auth, r2Get, r2Put } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

// TEMPORÁRIO: confere se o token consegue gravar/ler no R2, liga o endereço público e a expiração de 1 dia.
export async function GET() {
  const out: Record<string, unknown> = {};
  try {
    try {
      await r2Put("setup/teste.txt", new TextEncoder().encode("ok"), "text/plain");
      const g = await r2Get("setup/teste.txt");
      out.putGet = g ? await g.text() : "não achou";
    } catch (e) {
      out.putGet = (e as Error).message;
    }
    const call = async (name: string, path: string, method: string, body?: unknown) => {
      const r = await fetch(`${r2Api()}${path}`, { method, headers: { ...r2Auth(), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      out[name] = { status: r.status, body: (await r.text()).slice(0, 400) };
    };
    await call("dominioPublico", "/domains/managed", "PUT", { enabled: true });
    await call("dominioLer", "/domains/managed", "GET");
    await call("expiracao", "/lifecycle", "PUT", {
      rules: [{ id: "expira-1-dia", enabled: true, conditions: { prefix: "" }, deleteObjectsTransition: { condition: { type: "Age", maxAge: 86400 } } }],
    });
    return Response.json(out);
  } catch (e) {
    return fail(e);
  }
}
