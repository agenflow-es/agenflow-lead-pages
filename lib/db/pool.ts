import "server-only";

import { Pool } from "pg";

import { SUPABASE_CA } from "./supabase-ca";

/**
 * Pool de Postgres del servidor de paginas-para-leads, conectado como rol NATIVO
 * `lead_pages_serving` (minimo privilegio). Frontera de seguridad:
 *   - `import "server-only"`: si un componente de cliente importa esto por error, el build FALLA
 *     en vez de filtrar la credencial al navegador.
 *   - PROPOSALS_SERVING_DB_URL SIN prefijo NEXT_PUBLIC_: Next nunca la mete en el bundle de cliente.
 *   - `pg` es Node-only: no compila para el navegador (la ruta usa runtime "nodejs").
 *
 * SSL REAL: este servidor es internet-facing -> verificamos el certificado del pooler de Supabase
 * (rejectUnauthorized: true). NO heredamos el `rejectUnauthorized:false` del panel (que corre en
 * local). Si el pooler exigiera su CA propia, se anade aqui via `ssl.ca`.
 */

declare global {
  // eslint-disable-next-line no-var
  var __leadPagesPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.PROPOSALS_SERVING_DB_URL;
  if (!connectionString) {
    throw new Error(
      "[agenflow-lead-pages] Falta PROPOSALS_SERVING_DB_URL (rol nativo `lead_pages_serving`, " +
        "session pooler 5432). server-only, NUNCA con NEXT_PUBLIC_, NUNCA la admin ni service_role.",
    );
  }
  return new Pool({
    connectionString,
    // Verificacion REAL del certificado: el pooler de Supabase usa su propia CA (no esta en el
    // store publico de Node), asi que la fijamos. rejectUnauthorized:true => si el cert no valida
    // contra la CA de Supabase, NO conecta. Nada de rejectUnauthorized:false.
    ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

// Singleton en globalThis: el hot-reload de `next dev` re-evalua modulos; sin cache se
// acumularian Pools y se agotarian las conexiones del pooler.
export const pool: Pool = globalThis.__leadPagesPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  globalThis.__leadPagesPool = pool;
}
