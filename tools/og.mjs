// Genera las imágenes para compartir el sitio (Open Graph / Twitter), de 1200×630, en el mismo estilo de la
// portada: la pintura del ciruelo disolviéndose en el papel a la izquierda, la marca en caligrafía y el sello.
// Una por idioma: public/og-es.png y public/og-en.png.
// Uso: node tools/og.mjs   (necesita public/art/plum.webp, que genera tools/arbol.mjs)
import { chromium } from "playwright";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "./rutas.mjs";

/** Textos de cada imagen. */
const VARIANTS = {
  es: { line: "Laboratorio de software experimental e interactivo", list: "ThePredict · Seshat · Be The Boss · The Story Keeper · The Void Files" },
  en: { line: "Experimental, interactive software lab", list: "ThePredict · Seshat · Be The Boss · The Story Keeper · The Void Files" },
};

// La hoja de fontsource trae todos los subconjuntos de la letra; sus rutas relativas resuelven desde su carpeta.
const fontCss = pathToFileURL(join(projectRoot, "node_modules/@fontsource/yuji-syuku/400.css")).href;
const painting = pathToFileURL(join(projectRoot, "public/art/plum.webp")).href;

/** Página de una sola vista, con todo en línea, para fotografiarla. */
function page(line, list) {
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${fontCss}"><style>
    html, body { margin: 0; width: 1200px; height: 630px; background: #f4f0e6; overflow: hidden; }
    .art { position: absolute; left: -40px; top: -60px; height: 760px; mix-blend-mode: multiply;
      -webkit-mask-image: radial-gradient(65% 60% at 42% 50%, #000 55%, transparent 100%);
              mask-image: radial-gradient(65% 60% at 42% 50%, #000 55%, transparent 100%); }
    .text { position: absolute; left: 640px; top: 0; bottom: 0; width: 520px; display: flex; flex-direction: column;
      justify-content: center; font-family: "Yuji Syuku", serif; color: #342d27; }
    h1 { margin: 0; font-weight: 400; font-size: 96px; letter-spacing: 0.05em; line-height: 1; color: #1d1915; }
    .line { margin-top: 18px; font-size: 30px; letter-spacing: 0.03em; line-height: 1.3; }
    .list { margin-top: 26px; font-size: 18px; letter-spacing: 0.06em; color: #6b655c; line-height: 1.5; }
    .seal { position: absolute; right: 48px; bottom: 40px; width: 52px; height: 52px; border-radius: 6px; background: #c43426;
      transform: rotate(-2.5deg); color: #f4f0e6; font: 600 26px/52px "Yuji Syuku", serif; text-align: center; }
    .url { position: absolute; left: 640px; bottom: 48px; font: 18px "Yuji Syuku", serif; letter-spacing: 0.12em; color: #6b655c; }
  </style></head><body>
    <img class="art" src="${painting}">
    <div class="text"><h1>Akyrion</h1><div class="line">${line}</div><div class="list">${list}</div></div>
    <div class="url">akyrion.tech</div>
    <div class="seal">Ak</div>
  </body></html>`;
}

// La página se abre desde un archivo temporal: solo así el navegador puede leer la pintura y la letra locales.
const work = await mkdtemp(join(tmpdir(), "akyrion-og-"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const [lang, text] of Object.entries(VARIANTS)) {
    const tab = await context.newPage();
    const html = join(work, `og-${lang}.html`);
    await writeFile(html, page(text.line, text.list));
    await tab.goto(pathToFileURL(html).href, { waitUntil: "load" });
    await tab.evaluate(async () => {
      await document.fonts.load('96px "Yuji Syuku"', "Akyrion");
      await document.fonts.ready;
    });
    const painted = await tab.evaluate(() => {
      const img = document.querySelector("img");
      return Boolean(img && img.complete && img.naturalWidth > 0);
    });
    const inked = await tab.evaluate(() => document.fonts.check('96px "Yuji Syuku"', "Akyrion"));
    if (!painted || !inked) throw new Error(`og-${lang}: la pintura (${painted}) o la letra (${inked}) no cargaron`);
    const file = join(projectRoot, "public", `og-${lang}.png`);
    await tab.screenshot({ path: file });
    console.log(`imagen para compartir: ${file}`);
    await tab.close();
  }
} finally {
  await browser.close();
  await rm(work, { recursive: true, force: true });
}
