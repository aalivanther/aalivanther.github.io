// Servidor de vista previa local: el portafolio en la raíz y cada demo en su ruta, igual que en producción.
// Uso: node tools/servir.mjs [puerto]   (por defecto 4400)
// Solo escucha en 127.0.0.1: es para revisar en esta máquina, no para exponer en la red.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { resolveMount, siteDir, demoMounts } from "./rutas.mjs";

/** Puerto por defecto de la vista previa. */
const DEFAULT_PORT = 4400;

/** Tipos MIME de los archivos que aparecen en el sitio y las demos. */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wasm": "application/wasm",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

/**
 * Busca el archivo que corresponde a una ruta: el archivo exacto, o su index.html si es carpeta.
 * Devuelve null si no existe o si la ruta intenta salir de la carpeta montada.
 * @param {string} dir carpeta montada
 * @param {string} rest ruta relativa dentro de ella
 */
async function findFile(dir, rest) {
  const candidate = normalize(join(dir, rest));
  // Defensa contra «../»: el archivo final tiene que quedar dentro de la carpeta montada.
  if (candidate !== dir && !candidate.startsWith(dir + sep)) return null;
  for (const path of [candidate, join(candidate, "index.html"), `${candidate}.html`]) {
    const info = await stat(path).catch(() => null);
    if (info?.isFile()) return path;
  }
  return null;
}

/**
 * Atiende una petición: redirige carpetas sin barra final (como GitHub Pages) y sirve el archivo o la 404.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handle(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }
  const { dir, rest } = resolveMount(pathname);
  const file = await findFile(dir, rest);
  // GitHub Pages redirige /carpeta a /carpeta/; se imita para detectar enlaces relativos rotos.
  if (file && file.endsWith(`${sep}index.html`) && !pathname.endsWith("/") && !rest.endsWith("index.html")) {
    res.writeHead(301, { Location: `${pathname}/` }).end();
    return;
  }
  if (!file) {
    const notFound = await findFile(siteDir, "/404.html");
    res.writeHead(404, { "Content-Type": MIME[".html"] });
    if (notFound) createReadStream(notFound).pipe(res);
    else res.end("404");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-cache" });
  createReadStream(file).pipe(res);
}

/**
 * Arranca el servidor y resuelve cuando ya escucha. Lo usa también el verificador.
 * @param {number} port
 * @returns {Promise<import("node:http").Server>}
 */
export function startServer(port) {
  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(`request failed: ${req.url}: ${error instanceof Error ? error.message : String(error)}`);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", () => done(server));
  });
}

// Ejecución directa: arranca y muestra las rutas disponibles.
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] ?? DEFAULT_PORT);
  await startServer(port);
  console.log(`portafolio en http://127.0.0.1:${port}/  (español: /es/)`);
  for (const mount of demoMounts) console.log(`  ${mount.name.padEnd(18)} http://127.0.0.1:${port}${mount.path}`);
}
