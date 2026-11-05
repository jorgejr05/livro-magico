import { need } from "./server";

// Chamada de função (RPC) no Supabase pelo servidor, com a chave publicável.
// O banco tem RLS ligado e sem policies: só estas funções criam/finalizam pedidos.
export async function rpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const url = need("SUPABASE_URL");
  const key = need("SUPABASE_PUBLISHABLE_KEY");
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_publishable_")) headers.Authorization = `Bearer ${key}`; // chave antiga (JWT)
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`Supabase ${fn} falhou (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
