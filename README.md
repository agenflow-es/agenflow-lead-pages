# agenflow-lead-pages

Servidor **aislado** de páginas personalizadas para leads (propuestas y futuros tipos). Es un
**proxy fino**: lee el HTML ya construido (`proposal_versions.artefacto_html`) por slug como rol
nativo `lead_pages_serving` (mínimo privilegio), lo hace **stream** con cabeceras de privacidad, y
registra la apertura en `proposal_events` (tracking server-side). **No renderiza, no usa Python, no
toca S3.** La web de marca (agenflow.es) solo hace un *rewrite* a este proyecto.

## Por qué aislado

Genérico por tipo: añadir un tipo nuevo (`/propuesta-consultoria/<slug>`, etc.) = una entrada en
`lib/registry.ts` + una línea de rewrite en agenflow-web. Nunca un proyecto nuevo. La web de marca
queda **tonta** (sin credenciales ni datos de cliente); aquí vive el único acceso a los datos.

## Ruta

`GET /[tipo]/[slug]` (`app/[tipo]/[slug]/route.ts`, `runtime=nodejs`, `force-dynamic`):
- valida el `tipo` contra `lib/registry.ts`;
- `select artefacto_html ... where slug=$1 and estado='publicada'` (doble candado app + RLS);
- 404 si no existe / no publicada / sin artefacto / el tipo no casa;
- responde el HTML con `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`,
  `Cache-Control: private, no-store`;
- `after()` → registra la apertura (debounce 15 min por `(version, ip_hash)`), sin pixel JS.

## Seguridad

- Rol `lead_pages_serving`: SELECT acotado de `artefacto_html`/slug, INSERT/SELECT de
  `proposal_events`, UPDATE de rollups. **Cero** acceso a `companies`/`estado`/`contenido`.
- `PROPOSALS_SERVING_DB_URL` **server-only**, sin `NEXT_PUBLIC_` → nunca llega al bundle del cliente.
- **SSL real**: el pooler de Supabase usa su propia CA (`lib/db/supabase-ca.ts`, cert público);
  verificamos con `rejectUnauthorized: true`. Sin atajos (`rejectUnauthorized:false`).

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellena PROPOSALS_SERVING_DB_URL (rol lead_pages_serving, pooler 5432)
npm run dev            # http://localhost:3002
# probar:  http://localhost:3002/propuesta-web/<slug-de-una-propuesta-publicada>
```

## Deploy (Vercel)

Proyecto Vercel propio. Única variable de entorno: **`PROPOSALS_SERVING_DB_URL`** (Production +
Preview). `agenflow.es/propuesta-web/<slug>` llega aquí vía *rewrite* de agenflow-web
(`LEAD_PAGES_ORIGIN` = la URL de este proyecto). Todo el proyecto es `noindex` (`app/robots.ts`).
