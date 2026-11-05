export const runtime = "nodejs";

// GET: diz se a tela de código de acesso deve aparecer. POST: confere o código.
export async function GET() {
  return Response.json({ accessRequired: Boolean(process.env.ACCESS_CODE) });
}

export async function POST(req: Request) {
  const code = process.env.ACCESS_CODE;
  if (!code) return Response.json({ ok: true });
  const body = await req.json().catch(() => ({}));
  return Response.json({ ok: body?.code === code });
}
