import "server-only";

import { createHash } from "node:crypto";

import { pool } from "./db/pool";

// Ventana de debounce: una misma persona (ip_hash) abriendo varias veces en 15 min cuenta 1 vez.
const DEBOUNCE_MIN = 15;

export type OpenCtx = {
  versionId: string;
  proposalId: string;
  // null en propuestas de creador (arco empresa_id XOR creador_id); el trigger de
  // propuesta_eventos rellena el sujeto desde el hilo e ignora lo que se mande aqui
  companyId: string | null;
  ip: string;
  ua: string;
  referrer: string;
};

/**
 * Registro server-side de una APERTURA en propuesta_eventos + acumulados del hilo. Sin pixel JS ni
 * terceros (no lo bloquean adblockers). `ip_hash = sha256(ip|agente_usuario)` -> no guardamos la IP
 * en claro. Debounce de 15 min por (version, ip_hash). Se llama desde `after()` -> 0 latencia.
 */
export async function recordOpen(ctx: OpenCtx): Promise<void> {
  const ipHash = createHash("sha256").update(`${ctx.ip}|${ctx.ua}`).digest("hex");
  const client = await pool.connect();
  try {
    const dup = await client.query(
      `select 1 from propuesta_eventos
         where propuesta_version_id = $1 and tipo_evento = 'abierta' and ip_hash = $2
           and ocurrido_at > now() - interval '${DEBOUNCE_MIN} minutes'
         limit 1`,
      [ctx.versionId, ipHash],
    );
    if ((dup.rowCount ?? 0) > 0) return; // ya contada en la ventana

    await client.query(
      `insert into propuesta_eventos
         (propuesta_version_id, propuesta_id, empresa_id, tipo_evento, canal, agente_usuario, ip_hash, referente)
       values ($1, $2, $3, 'abierta', 'web', $4, $5, $6)`,
      [ctx.versionId, ctx.proposalId, ctx.companyId, ctx.ua.slice(0, 400), ipHash, ctx.referrer.slice(0, 400) || null],
    );
    await client.query(
      `update propuestas
         set aperturas = aperturas + 1,
             primera_apertura_at = coalesce(primera_apertura_at, now()),
             ultima_apertura_at = now()
       where id = $1`,
      [ctx.proposalId],
    );
  } finally {
    client.release();
  }
}
