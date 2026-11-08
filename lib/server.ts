// Helpers só de servidor. As chaves vêm de variáveis de ambiente, nunca do cliente.
export function checkAccess(req: Request): Response | null {
  // O código só é exigido se ACCESS_ENFORCE=1 (desligado por padrão: sem fricção).
  const code = process.env.ACCESS_ENFORCE === "1" ? process.env.ACCESS_CODE : "";
  if (!code) return null;
  if (req.headers.get("x-access-code") === code) return null;
  return Response.json({ error: "Código de acesso inválido." }, { status: 401 });
}

export function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

export function fail(e: unknown, status = 500): Response {
  const message = e instanceof Error ? e.message : "Erro inesperado";
  return Response.json({ error: message }, { status });
}

// Consumo REAL medido em cada chamada (sai no cabeçalho x-usage e é gravado por pedido).
export function billingHeaders(res: Response): Record<string, string> {
  const o: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    if (/cost|character|credit|usage|token|duration|request-id/i.test(k)) o[k] = v;
  });
  return o;
}
export function withUsage(body: BodyInit | null, usage: unknown, init: ResponseInit & { headers?: Record<string, string> } = {}): Response {
  return new Response(body, { ...init, headers: { ...(init.headers || {}), "x-usage": JSON.stringify(usage).slice(0, 3500) } });
}
// `debug` (prompts, entradas e saídas brutas) viaja no corpo, não no cabeçalho, e o app grava por etapa.
export function jsonUsage(data: Record<string, unknown>, usage: unknown, debug?: unknown, status = 200): Response {
  return withUsage(JSON.stringify(debug === undefined ? data : { ...data, debug }), usage, { status, headers: { "Content-Type": "application/json" } });
}

export async function luna(system: string, user: string): Promise<{ out: any; usage: any }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${need("OPENAI_API_KEY")}`,
    },
    body: JSON.stringify({
      model: process.env.LUNA_MODEL || "gpt-6-luna",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Luna falhou (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const u = data?.usage || {};
  const usage = {
    provider: "openai-chat",
    model: data?.model || process.env.LUNA_MODEL || "gpt-6-luna",
    prompt_tokens: u.prompt_tokens ?? null,
    completion_tokens: u.completion_tokens ?? null,
    total_tokens: u.total_tokens ?? null,
    cached_tokens: u.prompt_tokens_details?.cached_tokens ?? null,
    reasoning_tokens: u.completion_tokens_details?.reasoning_tokens ?? null,
  };
  try {
    return { out: JSON.parse(content), usage };
  } catch {
    throw new Error("A Luna não devolveu JSON válido.");
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Imagem inválida.");
  const bytes = Buffer.from(m[2], "base64");
  return new Blob([bytes], { type: m[1] });
}
