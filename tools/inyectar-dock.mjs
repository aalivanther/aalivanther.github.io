// Inyecta la barra del portafolio (/dock.js) en todas las páginas HTML de las demos.
// Es idempotente: una página que ya la tiene no se toca. Hay que correrlo cada vez que se regenera una demo.
// Uso: node tools/inyectar-dock.mjs [--check]   (--check solo reporta, no escribe; sale con 1 si falta alguna)
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { demoMounts } from "./rutas.mjs";

/** Etiqueta que se inserta. El atributo data-akyrion-dock permite reconocerla y no duplicarla. */
const TAG = '<script src="/dock.js" defer data-akyrion-dock></script>';
const MARKER = "data-akyrion-dock";

/**
 * Recorre una carpeta y devuelve todas las rutas de archivos .html.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith(".html")).map((e) => join(e.parentPath, e.name));
}

/**
 * Inserta la etiqueta justo antes de </head>. Si la página no tiene </head> se reporta y no se modifica,
 * porque insertar a ciegas podría romper un documento con estructura inesperada.
 * @param {string} html
 * @returns {string | null} el HTML nuevo, o null si no hay dónde insertar
 */
function inject(html) {
  const at = html.search(/<\/head>/i);
  if (at < 0) return null;
  return html.slice(0, at) + TAG + html.slice(at);
}

const checkOnly = process.argv.includes("--check");
let missing = 0;

for (const mount of demoMounts) {
  // Una demo que aún no existe (no se ha generado) se reporta y cuenta como falla, sin detener las demás.
  const files = await listHtml(mount.dir).catch((error) => {
    console.error(`cannot read demo ${mount.name} at ${mount.dir}: ${error.message}`);
    return null;
  });
  if (files === null) {
    missing++;
    continue;
  }
  let added = 0;
  let already = 0;
  const skipped = [];
  for (const file of files) {
    const html = await readFile(file, "utf8");
    if (html.includes(MARKER)) {
      already++;
      continue;
    }
    if (checkOnly) {
      missing++;
      continue;
    }
    const next = inject(html);
    if (next === null) {
      skipped.push(file);
      continue;
    }
    await writeFile(file, next);
    added++;
  }
  console.log(`${mount.name.padEnd(18)} ${files.length} html · ${checkOnly ? "" : `${added} inyectadas · `}${already} ya tenían la barra${skipped.length ? ` · ${skipped.length} sin </head>` : ""}`);
  for (const file of skipped.slice(0, 5)) console.log(`    sin </head>: ${file}`);
  missing += skipped.length;
}

if (missing > 0) {
  console.error(`missing dock in ${missing} pages or demos`);
  process.exit(1);
}
