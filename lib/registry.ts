/**
 * Registro de TIPOS de pagina-para-leads. Este servidor es generico: anadir un tipo nuevo
 * (p. ej. /propuesta-consultoria/<slug>) = UNA entrada aqui + UNA linea de rewrite en
 * agenflow-web. Nunca un proyecto nuevo.
 *
 * Hoy una sola fuente: las PROPUESTAS (tabla proposal_versions). `proposalTipo` valida que un
 * slug solo se sirva bajo su vanity URL correcta (un slug de mejora_web no se sirve como
 * /propuesta-consultoria/...). Tipos futuros que lean de OTRAS tablas anaden su propio resolver.
 */
export type LeadPageType = {
  /** valor esperado de proposals.tipo para este segmento de ruta */
  proposalTipo: string;
};

export const REGISTRY: Record<string, LeadPageType> = {
  "propuesta-web": { proposalTipo: "mejora_web_primer_contacto" },
  // futuro: "propuesta-consultoria": { proposalTipo: "consultoria_ia_primer_contacto" },
};
