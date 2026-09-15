/**
 * Registro de TIPOS de pagina-para-leads. Este servidor es generico: anadir un tipo nuevo
 * (p. ej. /propuesta-consultoria/<slug>) = UNA entrada aqui + UNA linea de rewrite en
 * agenflow-web. Nunca un proyecto nuevo.
 *
 * Hoy una sola fuente: las PROPUESTAS (tabla propuesta_versiones). `proposalTipos` valida que un
 * slug solo se sirva bajo su vanity URL correcta (un slug de /propuesta-consultoria no se
 * serviria aqui). Una vanity URL puede cubrir VARIAS familias internas de propuesta (el
 * prospecto no distingue "remodelado" de "web desde cero" por la URL — es un detalle interno,
 * ver docs/SERVICIO-mejora-presencia-online.md, "Familia" en el glosario): por eso es un
 * array, no un valor unico. Tipos futuros que lean de OTRAS tablas anaden su propio resolver.
 */
export type LeadPageType = {
  /** valores validos de `propuestas.tipo` (catalogo `propuesta_tipos`) para este segmento de ruta (una o mas familias) */
  proposalTipos: string[];
};

export const REGISTRY: Record<string, LeadPageType> = {
  "propuesta-web": {
    proposalTipos: ["mejora_web_primer_contacto", "web_nueva_primer_contacto"],
  },
  // futuro: "propuesta-consultoria": { proposalTipos: ["consultoria_ia_primer_contacto"] },
};

/**
 * Los segmentos de ruta que agenflow-web tiene que reenviar aqui.
 *
 * Se DERIVA del REGISTRY a proposito: si fuese una segunda lista escrita a mano,
 * el dia que alguien anadiera un tipo aqui y se olvidara alli, el enlace daria 404
 * sin que nadie supiera por que. Asi, anadir un tipo es anadir UNA PALABRA arriba
 * y ya queda enrutado.
 */
export const TIPOS_SERVIDOS = Object.keys(REGISTRY);
