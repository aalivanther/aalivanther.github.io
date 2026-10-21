// Genera /sitemap.xml: la portada en sus dos idiomas, las demos y la documentación de ThePredict.
// Se arma en el build con la misma lista de proyectos del sitio, así un proyecto nuevo entra solo.
import type { APIRoute } from "astro";
import { projects } from "../data/projects";
import { homePath } from "../i18n/ui";

/** Rutas públicas del dominio, sin repetir. */
function paths(): string[] {
  const all = [homePath.en, homePath.es, ...projects.flatMap((p) => [p.demoPath, p.docsPath ?? ""])];
  return [...new Set(all.filter((path) => path !== ""))];
}

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("sitemap.xml needs `site` in astro.config");
  const urls = paths()
    .map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`)
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
