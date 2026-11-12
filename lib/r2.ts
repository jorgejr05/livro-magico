import { need } from "@/lib/server";

// Armazenamento temporário de mídias no Cloudflare R2, pela API REST da Cloudflare (sem SDK).
const api = () => `https://api.cloudflare.com/client/v4/accounts/${need("CLOUDFLARE_ACCOUNT_ID")}/r2/buckets/${need("R2_BUCKET")}`;
const auth = () => ({ Authorization: `Bearer ${need("CLOUDFLARE_API_TOKEN")}` });
const obj = (key: string) => `${api()}/objects/${encodeURIComponent(key)}`;

export async function r2Put(key: string, body: ArrayBuffer | Uint8Array | Blob, contentType: string): Promise<void> {
  const res = await fetch(obj(key), { method: "PUT", headers: { ...auth(), "Content-Type": contentType }, body: body as BodyInit });
  if (!res.ok) throw new Error(`R2 PUT ${key} falhou (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

export async function r2Get(key: string): Promise<Response | null> {
  const res = await fetch(obj(key), { headers: auth() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 GET ${key} falhou (${res.status})`);
  return res;
}

export async function r2Delete(key: string): Promise<void> {
  await fetch(obj(key), { method: "DELETE", headers: auth() }).catch(() => {});
}

export { api as r2Api, auth as r2Auth };
