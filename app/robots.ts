import type { MetadataRoute } from "next";

// Todo el proyecto es privado por enlace (paginas de cliente). Fuera de buscadores por completo
// (refuerzo del header X-Robots-Tag de cada respuesta).
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
