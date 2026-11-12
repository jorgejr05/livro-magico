import { need } from "./server";

// Pix pela API do Asaas. ASAAS_ENV=sandbox usa o ambiente de testes (a chave precisa ser do mesmo ambiente).
const base = () => (process.env.ASAAS_ENV === "sandbox" ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3");

export class AsaasError extends Error {
  needCpf: boolean;
  constructor(message: string) {
    super(message);
    this.needCpf = /cpf|cnpj/i.test(message);
  }
}

export async function asaas(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${base()}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { access_token: need("ASAAS_API_KEY"), "Content-Type": "application/json", "User-Agent": "livro-magico" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* corpo não-JSON */ }
  if (!res.ok) throw new AsaasError(data?.errors?.[0]?.description || `Asaas ${res.status}`);
  return data;
}

export const asaasEnabled = () => Boolean(process.env.ASAAS_API_KEY);
export const bookPrice = () => Number(process.env.BOOK_PRICE || "29.90");
export const PAID_STATUS = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
