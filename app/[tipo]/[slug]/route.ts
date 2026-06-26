import { after } from "next/server";
import type { NextRequest } from "next/server";

import { pool } from "@/lib/db/pool";
import { REGISTRY } from "@/lib/registry";
import { recordOpen } from "@/lib/track";

export const runtime = "nodejs"; // `pg` es Node-only, NUNCA edge
export const dynamic = "force-dynamic"; // jamas cachear un artefacto privado

// Lee SOLO lo necesario por slug, y SOLO si la version esta publicada (la RLS de lead_pages_serving
// lo impone tambien en DB: doble candado app + RLS).
const SELECT = `
  select pv.id, pv.proposal_id, pv.artefacto_html, p.company_id, p.tipo
  from proposal_versions pv
  join proposals p on p.id = pv.proposal_id
  where pv.slug = $1 and pv.estado = 'publicada'
  limit 1`;

const PRIVACY_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "private, no-store",
};

function notFound(): Response {
  return new Response("No encontrado", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...PRIVACY_HEADERS },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tipo: string; slug: string }> },
): Promise<Response> {
  const { tipo, slug } = await ctx.params;
  const entry = REGISTRY[tipo];
  if (!entry) return notFound(); // tipo de pagina no registrado

  try {
    const { rows } = await pool.query(SELECT, [slug]);
    const row = rows[0];
    // 404 si: no existe / no publicada (filtrado por la query) / sin artefacto / tipo no casa con la ruta
    if (!row || !row.artefacto_html || row.tipo !== entry.proposalTipo) return notFound();

    // tracking server-side TRAS responder (0 latencia para el HTML); nunca rompe el servido
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "")
      .split(",")[0]
      .trim();
    const ua = req.headers.get("user-agent") || "";
    const referrer = req.headers.get("referer") || "";
    after(async () => {
      try {
        await recordOpen({
          versionId: row.id,
          proposalId: row.proposal_id,
          companyId: row.company_id,
          ip,
          ua,
          referrer,
        });
      } catch {
        // el tracking es best-effort: un fallo aqui no afecta a lo ya servido
      }
    });

    return new Response(row.artefacto_html as string, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVACY_HEADERS },
    });
  } catch {
    // un fallo de DB devuelve 503 SOLO en esta ruta; no hay nada mas que romper en este proyecto
    return new Response("No disponible", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", ...PRIVACY_HEADERS } });
  }
}
