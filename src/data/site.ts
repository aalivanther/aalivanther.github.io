// Datos del dueño del sitio y de los servicios externos.

/** Marca que da nombre al portafolio. */
export const owner = "Akyrion";

/** Firma completa del pie de página. */
export const signature = "Adrian / Akyrion";

/** Lee una variable de entorno de build y la devuelve solo si trae texto. */
function readEnv(name: string): string | null {
  const value = import.meta.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Usuario de GitHub donde viven los repositorios públicos. GITHUB_USER permite cambiarlo sin tocar código. */
export const githubUser = readEnv("GITHUB_USER") ?? "aalivanther";

/** Perfil público de GitHub. */
export const githubProfile = `https://github.com/${githubUser}`;

/**
 * Correo de contacto, partido en dos para que no aparezca entero en el HTML: los bots que recolectan direcciones
 * leen el HTML; el botón une las partes con JavaScript al cargar.
 */
export const contactEmail = { user: "goncasheron", domain: "gmail.com" } as const;

/** URL del repositorio de un proyecto. */
export function repoUrl(slug: string): string {
  return `https://github.com/${githubUser}/${slug}`;
}
