// supabase/functions/_shared/http.ts
// =====================================================================
// CORS multi-origines.
//
// POURQUOI
// L'ancienne version renvoyait la seule valeur d'ALLOWED_ORIGIN. Or un
// en-tete Access-Control-Allow-Origin n'accepte qu'UNE origine, et Vercel
// fabrique une URL differente par branche. Consequence : aucune Preview ne
// pouvait appeler les Edge Functions, donc aucune recette avant un merge.
//
// CE QUI CHANGE
// ALLOWED_ORIGIN accepte une LISTE separee par des virgules. La fonction
// renvoie l'origine de la requete si elle est autorisee.
//
//   ALLOWED_ORIGIN=https://hoteldesk-pro.vercel.app,https://app.velorone.app
//
// Les Previews du projet sont reconnues par motif, sans toucher au secret.
//
// RETROCOMPATIBLE : une valeur unique sans virgule se comporte comme avant,
// et un appel buildCorsHeaders() sans requete renvoie la premiere origine.
// =====================================================================
 
/** Previews Vercel : hoteldesk-pro-git-<branche>-<scope>.vercel.app */
const PREVIEW_RE = /^https:\/\/hoteldesk-pro-git-[a-z0-9-]+\.vercel\.app$/;
 
function originesAutorisees(): string[] {
  const brut = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
  return brut.split(',').map((o) => o.trim()).filter(Boolean);
}
 
function choisirOrigine(req?: Request): string {
  const liste = originesAutorisees();
  if (liste.includes('*')) return '*';
 
  const demandee = req?.headers.get('origin') ?? '';
  if (demandee && (liste.includes(demandee) || PREVIEW_RE.test(demandee))) {
    return demandee;
  }
  // Origine inconnue : on renvoie la premiere autorisee, le navigateur
  // bloquera l'appel. C'est exactement ce qu'on veut.
  return liste[0] ?? '*';
}
 
export function buildCorsHeaders(req?: Request) {
  return {
    'Access-Control-Allow-Origin': choisirOrigine(req),
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // Indispensable des que la reponse depend de l'origine.
    'Vary': 'Origin',
  };
}
 
export function jsonResponse(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
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