import { need } from "./server";
import { rpc } from "./supabase";
import { r2Get, r2Put } from "./r2";

export const UUID = /^[0-9a-f-]{36}$/i;
// Arquivos permitidos por livro (tudo fica em books/{id}/ no R2 e some sozinho em 90 dias).
export const ASSET = /^(photo\d{1,2}\.jpg|img_[lp]\d{1,2}\.webp|narration\.mp3|music\.mp3|story\.json|narr\.json|lyric\.json|job\.json|video_[hv]\.mp4)$/;
export const TYPES: Record<string, string> = { jpg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", json: "application/json", mp4: "video/mp4" };

export type Book = {
  id: string;
  status: "awaiting_payment" | "paid" | "generating" | "done" | "partial" | "failed" | "expired";
  created_at: string;
  paid_at: string | null;
  expires_at: string | null;
  child_name: string;
  age: number;
  birth: string | null;
  parents: string;
  theme_id: string;
  custom_theme: string | null;
  loves: string[];
  traits: string[];
  memory: string | null;
  luna_question: string | null;
  luna_answer: string | null;
  photo_count: number;
  manifest: string[];
  guardian_name: string;
  amount: number | null;
  asaas_payment_id: string | null;
};

const PAID = ["paid", "generating", "done", "partial", "failed"];
export const isPaid = (b: Book) => PAID.includes(b.status);

export async function getBook(id: string): Promise<Book | null> {
  if (!UUID.test(id)) return null;
  return (await rpc("get_book", { p_id: id })) as Book | null;
}

/** Só deixa gerar/entregar mídia de livro pago e dentro da validade (protege o custo das APIs). */
export async function requirePaid(id: unknown): Promise<Book> {
  const b = typeof id === "string" ? await getBook(id) : null;
  if (!b) throw new Error("Livro não encontrado.");
  if (b.status === "expired") throw new Error("Este livro expirou (guardamos por 90 dias).");
  if (!isPaid(b)) throw new Error("Pagamento ainda não confirmado.");
  return b;
}

export async function saveAsset(id: string, name: string, body: ArrayBuffer | Uint8Array | Blob, type?: string): Promise<void> {
  if (!ASSET.test(name)) throw new Error("Arquivo inválido.");
  await r2Put(`books/${id}/${name}`, body, type || TYPES[name.split(".").pop() || ""] || "application/octet-stream");
  await rpc("book_add_asset", { p_id: id, p_name: name });
}

export async function loadAsset(id: string, name: string): Promise<Response | null> {
  if (!ASSET.test(name)) return null;
  return r2Get(`books/${id}/${name}`);
}

export const paySecret = () => need("PAY_SECRET");
export async function markPaid(id: string): Promise<void> {
  await rpc("book_mark_paid", { p_secret: paySecret(), p_id: id });
}

export const normKey = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/)[0] || "";
export const onlyDigits = (s: string) => s.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
