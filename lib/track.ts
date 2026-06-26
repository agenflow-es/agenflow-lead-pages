import "server-only";

import { createHash } from "node:crypto";

import { pool } from "./db/pool";

// Ventana de debounce: una misma persona (ip_hash) abriendo varias veces en 15 min cuenta 1 vez.
const DEBOUNCE_MIN = 15;

export type OpenCtx = {
  versionId: string;
  proposalId: string;
  companyId: string;
  ip: string;
  ua: string;
  referrer: string;
};

/**
 * Registro server-side de una APERTURA en proposal_events + rollups del hilo. Sin pixel JS ni
 * terceros (no lo bloquean adblockers). `ip_hash = sha256(ip|user_agent)` -> no guardamos la IP
 * en claro. Debounce de 15 min por (version, ip_hash). Se llama desde `after()` -> 0 latencia.
 */
export async function recordOpen(ctx: OpenCtx): Promise<void> {
  const ipHash = createHash("sha256").update(`${ctx.ip}|${ctx.ua}`).digest("hex");
  const client = await pool.connect();
  try {
    const dup = await client.query(
      `select 1 from proposal_events
         where proposal_version_id = $1 and tipo_evento = 'abierta' and ip_hash = $2
           and occurred_at > now() - interval '${DEBOUNCE_MIN} minutes'
         limit 1`,
      [ctx.versionId, ipHash],
    );
    if ((dup.rowCount ?? 0) > 0) return; // ya contada en la ventana

    await client.query(
      `insert into proposal_events
         (proposal_version_id, proposal_id, company_id, tipo_evento, canal, user_agent, ip_hash, referrer)
       values ($1, $2, $3, 'abierta', 'web', $4, $5, $6)`,
      [ctx.versionId, ctx.proposalId, ctx.companyId, ctx.ua.slice(0, 400), ipHash, ctx.referrer.slice(0, 400) || null],
    );
    await client.query(
      `update proposals
         set open_count = open_count + 1,
             first_opened_at = coalesce(first_opened_at, now()),
             last_opened_at = now()
       where id = $1`,
      [ctx.proposalId],
    );
  } finally {
    client.release();
  }
}
