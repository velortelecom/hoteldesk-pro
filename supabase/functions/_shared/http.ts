export function buildCorsHeaders() {
  const origin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(),
      'Content-Type': 'application/json',
    },
  });
}

export async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
