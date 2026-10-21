// Verificación en navegador real (Chrome sin ventana) del portafolio y de la barra dentro de cada demo.
// Una suite verde no basta si la app no carga, así que aquí se abre cada página y se observa lo que pasa.
// Uso: node tools/verificar.mjs   (requiere `pnpm build` antes y Google Chrome instalado)
import { chromium } from "playwright";
import { startServer } from "./servir.mjs";
import { demoMounts } from "./rutas.mjs";

/** Puerto propio del verificador, distinto al de la vista previa para poder correr ambos. */
const PORT = 4410;
const BASE = `http://127.0.0.1:${PORT}`;

/** Hosts externos que las demos usan por diseño (portadas de catálogos y miniaturas de video). */
const ALLOWED_HOSTS = new Set(["images.igdb.com", "image.tmdb.org", "i.ytimg.com"]);

/** Tamaños de pantalla en los que se revisa la portada. */
const VIEWPORTS = [
  { name: "escritorio", width: 1440, height: 900 },
  { name: "móvil", width: 390, height: 844 },
];

const server = await startServer(PORT);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const failures = [];

/**
 * Abre una página y junta todo lo que salga mal: errores de consola o de script, respuestas 4xx/5xx
 * y peticiones a hosts no permitidos.
 * @param {import("playwright").BrowserContext} context
 * @param {string} path
 * @param {boolean} allowExternal si se aceptan los hosts de catálogo (solo en demos)
 */
async function openPage(context, path, allowExternal) {
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 160)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
  });
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.origin === BASE || url.protocol === "data:" || url.protocol === "blob:") return;
    if (allowExternal && ALLOWED_HOSTS.has(url.hostname)) return;
    problems.push(`external request: ${r.url()}`);
  });
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60_000 });
  return { page, problems };
}

// ---- 1. Portada en ambos idiomas y tamaños ----

/**
 * Cuenta los píxeles con tinta de un lienzo: si un emblema no se pintó, sale casi cero.
 * En escritorio mira el lienzo que está a la vista; en móvil, el de la página indicada.
 */
async function inkedPixels(page, slide = -1) {
  return page.evaluate((index) => {
    // En móvil la página 0 es el árbol; las demás llevan el emblema de su proyecto, en orden.
    const canvas =
      index === 0
        ? document.querySelector("[data-pager] [data-tree-ink]")
        : index > 0
          ? document.querySelectorAll("[data-slide-ink]")[index - 1]?.querySelector('[data-layer="ink"]')
          : [...document.querySelectorAll("[data-ink-group]")].find((g) => !g.classList.contains("is-leaving"))?.querySelector('[data-layer="ink"]');
    if (!canvas || !canvas.width) return 0;
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let inked = 0;
    for (let i = 3; i < data.length; i += 16) if (data[i] > 40) inked++;
    return inked;
  }, slide);
}

/** Mínimo de píxeles con tinta (muestreados) para dar un emblema por pintado. */
const MIN_INKED = 400;
/** Elementos esperados: Akyrion (en móvil, el árbol) y los cinco proyectos. */
const EMBLEMS = 6;

for (const viewport of VIEWPORTS) {
  const mobile = viewport.width <= 820;
  const context = await browser.newContext({ viewport, reducedMotion: "no-preference", hasTouch: mobile, isMobile: mobile });
  for (const path of ["/", "/es/"]) {
    const { page, problems } = await openPage(context, path, false);
    // Sin scroll horizontal de la página (el paginador desplaza su propia pista, no la página).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) problems.push(`horizontal overflow of ${overflow}px`);
    // Enlaces visibles: los internos deben responder; los de GitHub, apuntar al usuario configurado.
    const scope = mobile ? "[data-pager]" : "[data-entry]";
    const links = await page.$$eval(`${scope} a`, (as) => [...new Set(as.map((a) => a.getAttribute("href") ?? ""))]);
    for (const href of links) {
      if (href.startsWith("/")) {
        const response = await context.request.get(BASE + href);
        if (response.status() !== 200) problems.push(`link ${href} answered ${response.status()}`);
      } else if (!/^https:\/\/github\.com\/aalivanther\/[a-z]+$/.test(href)) {
        problems.push(`unexpected external link ${href}`);
      }
    }
    // El árbol de la vista activa debe terminar de crecer (y, en escritorio, haberse dibujado con WebGL).
    const treePainted = await page
      .waitForSelector(`${mobile ? "[data-pager] " : ".desktop "}[data-tree-painted]`, { state: "attached", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!treePainted) problems.push("ink tree did not finish painting");
    // Cada emblema debe quedar pintado: en escritorio eligiendo en la lista, en móvil pasando de página.
    let painted = 0;
    for (let i = 0; i < EMBLEMS; i++) {
      if (mobile) {
        await page.evaluate((k) => {
          const track = document.querySelector("[data-pager]");
          track?.scrollTo({ left: track.clientWidth * k });
        }, i);
      } else {
        await page.locator("[data-entry]").nth(i).locator("[data-title]").focus();
      }
      await page.waitForTimeout(2300);
      if (mobile && i === 0) {
        // La página del árbol es la pintura en WebGL: se comprueba que creció y que se dibujó con WebGL.
        const grown = await page.$eval("[data-pager] [data-tree]", (tree) => tree.hasAttribute("data-tree-painted") && tree.hasAttribute("data-gl"));
        if (!grown) problems.push("mobile painting tree did not grow with WebGL");
        else painted++;
        continue;
      }
      const inked = await inkedPixels(page, mobile ? i : -1);
      if (inked < MIN_INKED) problems.push(`emblem ${i} not painted (${inked})`);
      else painted++;
    }
    const lang = await page.getAttribute("html", "lang");
    console.log(`${problems.length ? "FALLA" : "ok   "} portada ${path} · ${viewport.name} · lang=${lang} · ${links.length} enlaces · ${painted}/${EMBLEMS} emblemas`);
    if (problems.length) failures.push({ where: `${path} ${viewport.name}`, problems });
    await page.close();
  }
  await context.close();
}

// ---- 1b. Entrada a una demo: la gota de tinta cubre la pantalla y navega ----
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const { page, problems } = await openPage(context, "/", true);
  // Los proyectos flotan con la profundidad (nunca están del todo quietos): se fuerza el gesto.
  await page.waitForSelector(".desktop [data-tree-painted]", { state: "attached", timeout: 15000 });
  await page.locator(".desktop [data-entry]").nth(3).locator("[data-title]").hover({ force: true });
  await page.locator(".desktop [data-entry]").nth(3).locator("[data-enter]").click({ force: true });
  await page.waitForURL(`${BASE}/btb/`, { timeout: 5000 }).catch(() => problems.push("ink drop did not navigate to /btb/"));
  console.log(`${problems.length ? "FALLA" : "ok   "} entrada con gota de tinta`);
  if (problems.length) failures.push({ where: "entrada", problems });
  await context.close();
}

// ---- 2. Barra dentro de cada demo: aparece, abre, navega y no rompe la hidratación ----
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
for (const mount of demoMounts) {
  const { page, problems } = await openPage(context, mount.path, true);
  const dock = await page
    .waitForFunction(() => document.querySelector("akyrion-dock")?.shadowRoot?.querySelector(".pill"), null, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!dock) {
    problems.push("dock not mounted");
  } else {
    // Abrir con clic, comprobar los seis enlaces (portafolio + cinco) y cerrar con Esc.
    await page.locator("akyrion-dock .pill").click();
    const count = await page.locator("akyrion-dock .panel a").count();
    if (count !== 6) problems.push(`dock panel has ${count} links, expected 6`);
    const current = await page.locator('akyrion-dock .panel a[aria-current="page"]').count();
    if (current !== 1) problems.push(`dock marks ${current} current projects, expected 1`);
    await page.keyboard.press("Escape");
    const closed = await page.locator("akyrion-dock .panel").isHidden();
    if (!closed) problems.push("Escape did not close the dock");
  }
  // Las demos de Next.js avisan en consola si la hidratación falla; ya lo recoge el escucha de consola.
  console.log(`${problems.length ? "FALLA" : "ok   "} barra en ${mount.path}`);
  if (problems.length) failures.push({ where: mount.path, problems });
  await page.close();
}
await context.close();

await browser.close();
server.close();

if (failures.length) {
  console.log("\nProblemas:");
  for (const f of failures) {
    console.log(`  ${f.where}`);
    for (const p of [...new Set(f.problems)].slice(0, 8)) console.log(`      ${p}`);
  }
  process.exit(1);
}
console.log("\nTodo en orden.");
