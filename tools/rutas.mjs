// Mapa de rutas del dominio: qué carpeta local se sirve en cada ruta pública.
// Lo comparten el servidor de vista previa, el inyector de la barra y el verificador, para que la vista
// previa local tenga exactamente las mismas URL que el sitio publicado.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/** Carpeta raíz del proyecto del portafolio. */
export const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** Carpeta del espacio de trabajo donde viven las demos (hermana del portafolio). */
export const demosRoot = resolve(projectRoot, "..", "demos");

/** Salida del build de Astro: se sirve en la raíz del dominio. */
export const siteDir = resolve(projectRoot, "dist");

/**
 * Demos montadas bajo una ruta. El orden no importa: el servidor elige siempre la ruta más larga que coincide,
 * así /thepredict/docs/ gana sobre /thepredict/.
 * @type {ReadonlyArray<{ path: string, dir: string, name: string }>}
 */
export const demoMounts = [
  { path: "/thepredict/", dir: resolve(demosRoot, "thepredict", "site"), name: "ThePredict" },
  { path: "/thepredict/docs/", dir: resolve(demosRoot, "thepredict-docs", "site"), name: "ThePredict docs" },
  { path: "/seshat/", dir: resolve(demosRoot, "seshat"), name: "Seshat" },
  { path: "/btb/", dir: resolve(demosRoot, "btb"), name: "Be The Boss" },
  { path: "/tsk/", dir: resolve(demosRoot, "tsk"), name: "The Story Keeper" },
  { path: "/thevoidfiles/", dir: resolve(demosRoot, "thevoidfiles"), name: "The Void Files" },
];

/**
 * Traduce una ruta pública a una carpeta local y la ruta relativa dentro de ella.
 * @param {string} pathname ruta ya decodificada, empezando en «/»
 * @returns {{ dir: string, rest: string }}
 */
export function resolveMount(pathname) {
  const mount = demoMounts
    .filter((m) => pathname === m.path.slice(0, -1) || pathname.startsWith(m.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!mount) return { dir: siteDir, rest: pathname };
  return { dir: mount.dir, rest: pathname.slice(mount.path.length - 1) || "/" };
}
