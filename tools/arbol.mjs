// Prepara la pintura del árbol para la portada, a partir de la obra original de dominio público:
// Wang Guxiang, «White and Red Plum Blossom» (1546), Minneapolis Institute of Art (97.133.2), vía Wikimedia Commons.
//
// Qué hace:
// 1. Recorta el encuadre vertical alrededor del tronco, el mismo para escritorio y teléfono.
// 2. Convierte la seda envejecida en blanco: divide cada píxel entre el color local del soporte. Así la pintura
//    se funde con el papel de la página (mix-blend-mode: multiply) conservando la tinta y los rojos.
// 3. Separa cinco capas para el parallax (aguadas, ramitas, ramas, tronco y flores rojas).
// 4. Calcula los mapas: crecimiento (cuándo aparece cada zona si la pintura «crece» desde la base del tronco
//    siguiendo la tinta) y máscara orgánica (dónde existe la pintura; se deshilacha hacia el papel).
// 5. Calcula los caminos de rama: la rama real que une cada racimo de flores con el tronco (para remarcarla).
// 6. Genera una textura de seda del tronco para que los emblemas tengan la misma textura que la pintura.
//
// Uso: node tools/arbol.mjs   (lee art-source/wang-guxiang-1546.jpg y escribe en public/art/)
// Si falta el original, se descarga de:
// https://upload.wikimedia.org/wikipedia/commons/8/86/Wang_Guxiang_-_White_and_Red_Plum_Blossom_-_97.133.2_-_Minneapolis_Institute_of_Art.jpg
import sharp from "sharp";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "./rutas.mjs";

const SOURCE = join(projectRoot, "art-source", "wang-guxiang-1546.jpg");
const SOURCE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/8/86/Wang_Guxiang_-_White_and_Red_Plum_Blossom_-_97.133.2_-_Minneapolis_Institute_of_Art.jpg";
const OUT = join(projectRoot, "public", "art");

/**
 * Encuadres, en fracciones del original (sin el montaje blanco de arriba y abajo ni la caligrafía de la izquierda).
 * `width` es el ancho final de la imagen publicada; `seed` es la base del tronco dentro del encuadre (0–1).
 */
const CROPS = {
  plum: { left: 0.165, top: 0.068, right: 0.6, bottom: 0.942, width: 1500, seed: [0.3, 0.98] },
};
/** Lado de la celda con la que se estima el color local de la seda, en píxeles de la imagen publicada. */
const PAPER_CELL = 48;
/** Por encima de este valor normalizado, el píxel se considera soporte limpio (quita la trama de la seda). */
const PAPER_CUTOFF = 0.9;
/** Escala del mapa de crecimiento respecto de la imagen publicada (la GPU lo interpola). */
const REVEAL_SCALE = 1 / 4;
/**
 * Racimos de flores rojas de la pintura donde se anclan los proyectos, en orden de uso (fracciones 0–1).
 * Hay más que proyectos: uno nuevo toma el siguiente. Se eligieron entre los racimos más densos, repartidos.
 */
const ANCHORS = [
  [0.72, 0.31],
  [0.17, 0.28],
  [0.8, 0.77],
  [0.1, 0.58],
  [0.23, 0.82],
  [0.82, 0.64],
  [0.13, 0.07],
  [0.68, 0.67],
  [0.23, 0.45],
];
/** Resolución de los mapas de camino respecto de la imagen publicada. */
const PATH_SCALE = 0.5;

/** Retraso con que aparecen las flores rojas respecto de su rama, en fracción del tiempo total. */
const BLOSSOM_DELAY = 0.08;

/** Garantiza que el original esté en disco: si no, lo descarga una vez. */
async function ensureSource() {
  if (existsSync(SOURCE)) return;
  const response = await fetch(SOURCE_URL, { headers: { "User-Agent": "AkyrionPortfolio/0.1" } });
  if (!response.ok) throw new Error(`download failed: HTTP ${response.status} for ${SOURCE_URL}`);
  await mkdir(join(projectRoot, "art-source"), { recursive: true });
  await writeFile(SOURCE, Buffer.from(await response.arrayBuffer()));
}

/** Percentil de un arreglo de números (modifica el orden del arreglo). */
function percentile(values, p) {
  values.sort((a, b) => a - b);
  return values[Math.min(values.length - 1, Math.floor(values.length * p))] ?? 255;
}

/**
 * Lleva la seda a blanco: estima el color del soporte por celdas (el percentil alto de cada canal, que es la seda
 * y no la tinta), lo suaviza y divide cada píxel entre él. Lo muy claro queda blanco puro.
 */
function normalizePaper(data, width, height) {
  const cols = Math.ceil(width / PAPER_CELL);
  const rows = Math.ceil(height / PAPER_CELL);
  const grid = new Float32Array(cols * rows * 3);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const channels = [[], [], []];
      for (let y = gy * PAPER_CELL; y < Math.min(height, (gy + 1) * PAPER_CELL); y += 2) {
        for (let x = gx * PAPER_CELL; x < Math.min(width, (gx + 1) * PAPER_CELL); x += 2) {
          const i = (y * width + x) * 3;
          for (let c = 0; c < 3; c++) channels[c].push(data[i + c]);
        }
      }
      for (let c = 0; c < 3; c++) grid[(gy * cols + gx) * 3 + c] = percentile(channels[c], 0.85);
    }
  }
  // Suavizado de la rejilla: evita escalones entre celdas.
  const smooth = new Float32Array(grid.length);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let n = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const x = gx + dx;
            const y = gy + dy;
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            sum += grid[(y * cols + x) * 3 + c];
            n++;
          }
        }
        smooth[(gy * cols + gx) * 3 + c] = sum / n;
      }
    }
  }
  const out = Buffer.alloc(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Color de la seda en este punto, interpolado entre centros de celda.
      const fx = Math.min(cols - 1.001, Math.max(0, x / PAPER_CELL - 0.5));
      const fy = Math.min(rows - 1.001, Math.max(0, y / PAPER_CELL - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const i = (y * width + x) * 3;
      let ratio = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const at = (gx, gy) => smooth[(gy * cols + gx) * 3 + c];
        const paper = (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
        ratio[c] = Math.min(1, data[i + c] / Math.max(1, paper));
      }
      // Lo que ya es casi soporte se lleva a blanco, con una rampa suave para no recortar los bordes de la tinta.
      const lightness = Math.min(ratio[0], ratio[1], ratio[2]);
      const lift = lightness > PAPER_CUTOFF ? Math.min(1, (lightness - PAPER_CUTOFF) / (1 - PAPER_CUTOFF)) : 0;
      ratio = ratio.map((r) => r + (1 - r) * lift);
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(ratio[c] * 255);
    }
  }
  return out;
}

/** Fracción del ancho y alto en la que los bordes del encuadre se funden con el blanco (sin corte visible). */
const FEATHER = 0.045;

/**
 * Difumina los bordes izquierdo, derecho e inferior hacia el blanco, para que el encuadre no se note como un
 * rectángulo sobre el papel. El borde superior queda intacto: ahí la pintura sigue, fuera de pantalla.
 */
function featherEdges(rgb, width, height) {
  const out = Buffer.from(rgb);
  const fw = width * FEATHER;
  const fh = height * FEATHER;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = Math.min(x / fw, (width - 1 - x) / fw, (height - 1 - y) / fh, 1);
      if (edge >= 1) continue;
      const keep = edge * edge * (3 - 2 * edge);
      const i = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(255 - (255 - rgb[i + c]) * keep);
    }
  }
  return out;
}

/**
 * Mapa de crecimiento: distancia geodésica desde la base del tronco a través de la tinta; el soporte vacío
 * se alcanza desde la tinta más cercana, con más coste. Se normaliza a 0–255 (0 = aparece primero).
 */
function revealMap(rgb, width, height, seed) {
  const w = Math.max(2, Math.round(width * REVEAL_SCALE));
  const h = Math.max(2, Math.round(height * REVEAL_SCALE));
  const ink = new Uint8Array(w * h);
  const red = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.round(x / REVEAL_SCALE));
      const sy = Math.min(height - 1, Math.round(y / REVEAL_SCALE));
      const i = (sy * width + sx) * 3;
      const r = rgb[i] / 255;
      const g = rgb[i + 1] / 255;
      const b = rgb[i + 2] / 255;
      const dark = 1 - Math.min(r, g, b);
      ink[y * w + x] = dark > 0.16 ? 1 : 0;
      red[y * w + x] = r - g > 0.18 ? 1 : 0;
    }
  }
  // Dijkstra simplificado con cola por cubos (costes enteros pequeños): tinta = 2, soporte = 7, diagonal ×1.4.
  // Float64: con Float32 el redondeo movía nodos de cubo y la propagación se cortaba.
  const dist = new Float64Array(w * h).fill(Infinity);
  const buckets = [];
  const push = (index, d) => {
    const b = Math.floor(d);
    (buckets[b] ??= []).push(index);
  };
  const sx = Math.round(seed[0] * (w - 1));
  const sy = Math.round(seed[1] * (h - 1));
  // Semillas: la tinta más cercana a la base del tronco.
  let best = -1;
  let bestD = Infinity;
  for (let y = Math.max(0, sy - 40); y < h; y++) {
    for (let x = Math.max(0, sx - 60); x < Math.min(w, sx + 60); x++) {
      if (!ink[y * w + x]) continue;
      const d = Math.hypot(x - sx, y - sy);
      if (d < bestD) {
        bestD = d;
        best = y * w + x;
      }
    }
  }
  if (best < 0) best = sy * w + sx;
  dist[best] = 0;
  push(best, 0);
  const steps = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.4],
    [-1, 1, 1.4],
    [1, -1, 1.4],
    [-1, -1, 1.4],
  ];
  for (let b = 0; b < buckets.length; b++) {
    const bucket = buckets[b];
    if (!bucket) continue;
    for (const index of bucket) {
      const d = dist[index];
      if (Math.floor(d) !== b) continue;
      const x = index % w;
      const y = (index - x) / w;
      for (const [dx, dy, k] of steps) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        const nd = d + (ink[n] ? 2 : 7) * k;
        if (nd < dist[n]) {
          dist[n] = nd;
          push(n, nd);
        }
      }
    }
  }
  let max = 0;
  for (let i = 0; i < dist.length; i++) if (ink[i] && dist[i] > max) max = dist[i];
  const out = Buffer.alloc(w * h);
  for (let i = 0; i < dist.length; i++) {
    const t = Math.min(1, dist[i] / (max || 1) + (red[i] ? BLOSSOM_DELAY : 0));
    out[i] = Math.round(Math.min(1, t * 0.92) * 255);
  }
  return { data: out, width: w, height: h };
}

await ensureSource();
await mkdir(OUT, { recursive: true });
const meta = await sharp(SOURCE).metadata();
if (!meta.width || !meta.height) throw new Error("cannot read source painting size");

/** Valor de ruido suave (value noise bilineal) en (x, y) para una rejilla de `cell` píxeles y una semilla. */
function valueNoise(x, y, cell, seed) {
  const hash = (i, j) => {
    let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fx = x / cell;
  const fy = y / cell;
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(i, j);
  const b = hash(i + 1, j);
  const c = hash(i, j + 1);
  const d = hash(i + 1, j + 1);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

/**
 * Capas para el parallax, de la más lejana a la más cercana. Cada píxel se reparte entre cinco planos según lo
 * oscuro que es y si es rojo:
 * - wash: aguadas muy claras y la trama de la seda;
 * - twig: ramitas finas y el contorno de las flores blancas;
 * - branch: ramas de tinta media;
 * - trunk: la tinta más densa (tronco y nudos);
 * - bloom: las flores rojas.
 * Cada capa es blanca donde no tiene nada, así se componen multiplicándose y el producto ≈ el original.
 */
function splitLayers(rgb, width, height) {
  const names = ["wash", "twig", "branch", "trunk", "bloom"];
  const layers = Object.fromEntries(names.map((name) => [name, Buffer.alloc(rgb.length, 255)]));
  const ramp = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  for (let i = 0; i < width * height; i++) {
    const r = rgb[i * 3] / 255;
    const g = rgb[i * 3 + 1] / 255;
    const b = rgb[i * 3 + 2] / 255;
    const dark = 1 - Math.min(r, g, b);
    const bloom = ramp(0.06, 0.18, r - g);
    const rest = 1 - bloom;
    // Reparto suave por oscuridad: cada tramo entra y sale con rampas, sin cortes visibles.
    const trunk = rest * ramp(0.5, 0.64, dark);
    const branch = rest * ramp(0.3, 0.42, dark) * (1 - ramp(0.5, 0.64, dark));
    const twig = rest * ramp(0.14, 0.24, dark) * (1 - ramp(0.3, 0.42, dark));
    const wash = Math.max(0, 1 - bloom - trunk - branch - twig);
    const weights = { wash, twig, branch, trunk, bloom };
    for (const name of names) {
      const w = weights[name];
      for (let c = 0; c < 3; c++) layers[name][i * 3 + c] = Math.round(255 - (255 - rgb[i * 3 + c]) * w);
    }
  }
  return layers;
}

/**
 * Máscara orgánica: la pintura solo existe donde hay tinta cerca, y se deshilacha hacia el papel con ruido.
 * Así no queda ningún borde recto: ni el del encuadre ni el de la seda.
 */
function organicMask(rgb, width, height, mapW, mapH) {
  const presence = new Float32Array(mapW * mapH);
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const sx = Math.min(width - 1, Math.round((x / mapW) * width));
      const sy = Math.min(height - 1, Math.round((y / mapH) * height));
      const i = (sy * width + sx) * 3;
      const dark = 1 - Math.min(rgb[i], rgb[i + 1], rgb[i + 2]) / 255;
      presence[y * mapW + x] = dark > 0.07 ? 1 : 0;
    }
  }
  // Desenfoque de caja en varias pasadas: la presencia se expande en un halo suave alrededor de la tinta.
  let field = presence;
  const RADIUS = 4;
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(field.length);
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -RADIUS; dy <= RADIUS; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= mapH) continue;
          for (let dx = -RADIUS; dx <= RADIUS; dx += 1) {
            const xx = x + dx;
            if (xx < 0 || xx >= mapW) continue;
            sum += field[yy * mapW + xx];
            n++;
          }
        }
        next[y * mapW + x] = sum / n;
      }
    }
    field = next;
  }
  const out = Buffer.alloc(mapW * mapH);
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const noise = valueNoise(x, y, 14, 3) * 0.6 + valueNoise(x, y, 5, 7) * 0.4;
      // Borde del encuadre: se deshace con ruido en un margen del 10 %, nunca en línea recta.
      const edge = Math.min(x, mapW - 1 - x, y, mapH - 1 - y) / (Math.min(mapW, mapH) * 0.24);
      const edgeFade = Math.min(1, Math.max(0, edge + (noise - 0.5) * 0.7));
      // Dentro, la pintura se queda (donde no hay tinta ya es blanca); cerca del borde, solo sobrevive lo que
      // está junto a la tinta: así el contorno sigue a las ramas en lugar de ser un rectángulo.
      const body = Math.min(1, Math.max(0, (field[y * mapW + x] - 0.05 + (noise - 0.5) * 0.12) / 0.3));
      const fade = edgeFade;
      const shaped = fade * fade * (3 - 2 * fade);
      const v = shaped * (shaped + (1 - shaped) * body);
      out[y * mapW + x] = Math.round(v * 255);
    }
  }
  return out;
}

/**
 * Textura de seda para el motor de pincel, con la misma trama que la pintura: fibras horizontales finas, la
 * urdimbre vertical apenas marcada y vetas largas de pincel seco. Se genera en mosaico continuo (sin costuras)
 * y se guarda como negro con transparencia: el alfa es cuánta tinta quita la seda al pintar.
 */
function silkTexture() {
  const SIZE = 256;
  /** Ruido periódico: se repite exactamente cada SIZE píxeles, así el mosaico no tiene costuras. */
  const periodic = (x, y, cellX, cellY, seed) => {
    const nx = SIZE / cellX;
    const ny = SIZE / cellY;
    const hash = (i, j) => {
      let h = (((i % nx) + nx) % nx) * 374761393 + (((j % ny) + ny) % ny) * 668265263 + seed * 2246822519;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const fx = x / cellX;
    const fy = y / cellY;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    return (hash(i, j) * (1 - sx) + hash(i + 1, j) * sx) * (1 - sy) + (hash(i, j + 1) * (1 - sx) + hash(i + 1, j + 1) * sx) * sy;
  };
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const weft = periodic(x, y, 64, 2, 1);
      const warp = periodic(x, y, 2, 128, 2);
      const dry = periodic(x, y, 128, 4, 3);
      const grain = periodic(x, y, 2, 2, 4);
      // Las fibras claras y el pincel seco dejan asomar la seda; el grano fino rompe la regularidad.
      const lift = Math.max(0, weft - 0.58) * 1.6 + Math.max(0, warp - 0.72) * 0.6 + Math.max(0, dry - 0.62) * 1.8 + (grain - 0.5) * 0.12;
      out[(y * SIZE + x) * 4 + 3] = Math.round(Math.min(1, Math.max(0, lift)) * 255);
    }
  }
  return sharp(out, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png();
}

/**
 * Caminos de rama: para cada racimo, la rama real de la pintura que lo une con la base del tronco.
 * Se busca el camino más corto a través de la tinta (Dijkstra) y se marca la tinta alrededor de ese camino y
 * las flores rojas del racimo. Devuelve una intensidad 0–255 por anclaje y, para animar el trazo, el valor del
 * mapa de crecimiento en cada anclaje.
 */
function branchPaths(rgb, width, height, seed, revealData, revealW, revealH) {
  const w = Math.round(width * PATH_SCALE);
  const h = Math.round(height * PATH_SCALE);
  const dark = new Float32Array(w * h);
  const red = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (Math.min(height - 1, Math.round(y / PATH_SCALE)) * width + Math.min(width - 1, Math.round(x / PATH_SCALE))) * 3;
      const r = rgb[i] / 255;
      const g = rgb[i + 1] / 255;
      const b = rgb[i + 2] / 255;
      dark[y * w + x] = 1 - Math.min(r, g, b);
      red[y * w + x] = r - g > 0.12 ? 1 : 0;
    }
  }
  const ink = (i) => dark[i] > 0.16 || red[i] === 1;
  // Dijkstra desde la base del tronco: moverse por tinta cuesta poco; saltar por papel, mucho.
  const dist = new Float64Array(w * h).fill(Infinity);
  const prev = new Int32Array(w * h).fill(-1);
  const buckets = [];
  const push = (index, d) => (buckets[Math.floor(d)] ??= []).push(index);
  const nearestInk = (fx, fy, radius) => {
    const cx = Math.round(fx * (w - 1));
    const cy = Math.round(fy * (h - 1));
    let best = cy * w + cx;
    let bestD = Infinity;
    for (let y = Math.max(0, cy - radius); y < Math.min(h, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x < Math.min(w, cx + radius); x++) {
        const i = y * w + x;
        if (!ink(i)) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    return best;
  };
  const start = nearestInk(seed[0], seed[1], 60);
  dist[start] = 0;
  push(start, 0);
  const steps = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.4],
    [-1, 1, 1.4],
    [1, -1, 1.4],
    [-1, -1, 1.4],
  ];
  for (let bucket = 0; bucket < buckets.length; bucket++) {
    for (const index of buckets[bucket] ?? []) {
      const d = dist[index];
      if (Math.floor(d) !== bucket) continue;
      const x = index % w;
      const y = (index - x) / w;
      for (const [dx, dy, k] of steps) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        // La tinta oscura es el camino natural (el tronco y las ramas); la clara cuesta algo más; el papel, mucho.
        const cost = (dark[n] > 0.3 ? 1 : ink(n) ? 2 : 30) * k;
        if (d + cost < dist[n]) {
          dist[n] = d + cost;
          prev[n] = index;
          push(n, d + cost);
        }
      }
    }
  }
  const RADIUS = Math.round(9 * PATH_SCALE * 2);
  const FLOWER_RADIUS = Math.round(70 * PATH_SCALE * 2);
  return ANCHORS.map(([ax, ay]) => {
    const out = new Float32Array(w * h);
    const target = nearestInk(ax, ay, 30);
    // Recorre el camino hacia atrás y marca la tinta de la rama a su alrededor.
    for (let i = target; i >= 0; i = prev[i]) {
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -RADIUS; dy <= RADIUS; dy++) {
        for (let dx = -RADIUS; dx <= RADIUS; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (!ink(n)) continue;
          const fall = 1 - Math.hypot(dx, dy) / (RADIUS + 1);
          if (fall > out[n]) out[n] = fall;
        }
      }
      if (i === start) break;
    }
    // Las flores del racimo.
    const tx = target % w;
    const ty = (target - tx) / w;
    for (let dy = -FLOWER_RADIUS; dy <= FLOWER_RADIUS; dy++) {
      for (let dx = -FLOWER_RADIUS; dx <= FLOWER_RADIUS; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (!red[n] && dark[n] < 0.1) continue;
        const fall = Math.max(0, 1 - Math.hypot(dx, dy) / FLOWER_RADIUS);
        if (fall > out[n]) out[n] = Math.min(1, fall * 1.6);
      }
    }
    const bytes = Buffer.alloc(w * h);
    for (let i = 0; i < out.length; i++) bytes[i] = Math.round(out[i] * 255);
    // Hasta dónde llega el trazo animado al remarcar: el mayor valor del mapa de crecimiento en todo el camino
    // (no solo en el racimo; algunos tramos de rama se alcanzan más tarde que el propio racimo).
    let reach = 0;
    for (let i = 0; i < out.length; i++) {
      if (out[i] < 0.3) continue;
      const x = i % w;
      const y = (i - x) / w;
      const rx = Math.min(revealW - 1, Math.round((x / (w - 1)) * (revealW - 1)));
      const ry = Math.min(revealH - 1, Math.round((y / (h - 1)) * (revealH - 1)));
      reach = Math.max(reach, revealData[ry * revealW + rx] / 255);
    }
    return { bytes, reach, at: [tx / (w - 1), ty / (h - 1)] };
  }).map((path) => ({ ...path, width: w, height: h }));
}

for (const [name, crop] of Object.entries(CROPS)) {
  const left = Math.round(crop.left * meta.width);
  const top = Math.round(crop.top * meta.height);
  const width = Math.round((crop.right - crop.left) * meta.width);
  const height = Math.round((crop.bottom - crop.top) * meta.height);
  const { data, info } = await sharp(SOURCE)
    .extract({ left, top, width, height })
    .resize({ width: crop.width })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const clean = normalizePaper(data, info.width, info.height);
  const raw = { raw: { width: info.width, height: info.height, channels: 3 } };
  // Imagen completa: respaldo sin WebGL (con los bordes difuminados).
  await sharp(featherEdges(clean, info.width, info.height), raw).webp({ quality: 82 }).toFile(join(OUT, `${name}.webp`));
  // Capas del parallax.
  const layers = splitLayers(clean, info.width, info.height);
  for (const [layer, buffer] of Object.entries(layers)) {
    await sharp(buffer, raw).webp({ quality: 80 }).toFile(join(OUT, `${name}-${layer}.webp`));
  }
  // Mapas: rojo = crecimiento, verde = máscara orgánica.
  const map = revealMap(clean, info.width, info.height, crop.seed);
  const reveal = await sharp(map.data, { raw: { width: map.width, height: map.height, channels: 1 } }).blur(1.2).raw().toBuffer();
  const mask = organicMask(clean, info.width, info.height, map.width, map.height);
  const maps = Buffer.alloc(map.width * map.height * 3);
  for (let i = 0; i < map.width * map.height; i++) {
    maps[i * 3] = reveal[i];
    maps[i * 3 + 1] = mask[i];
  }
  await sharp(maps, { raw: { width: map.width, height: map.height, channels: 3 } }).png().toFile(join(OUT, `${name}-maps.png`));
  // Caminos de rama: tres anclajes por imagen (uno por canal RGB), suavizados.
  const paths = branchPaths(clean, info.width, info.height, crop.seed, reveal, map.width, map.height);
  const sheets = Math.ceil(paths.length / 3);
  for (let sheet = 0; sheet < sheets; sheet++) {
    const { width: pw, height: ph } = paths[0];
    const rgbSheet = Buffer.alloc(pw * ph * 3);
    for (let c = 0; c < 3; c++) {
      const path = paths[sheet * 3 + c];
      if (!path) continue;
      for (let i = 0; i < pw * ph; i++) rgbSheet[i * 3 + c] = path.bytes[i];
    }
    await sharp(rgbSheet, { raw: { width: pw, height: ph, channels: 3 } }).blur(1.4).png().toFile(join(OUT, `${name}-paths-${sheet}.png`));
  }
  const anchorsFile = join(projectRoot, "src", "data", "painting-anchors.json");
  const anchorData = paths.map((path) => ({ at: path.at.map((v) => Number(v.toFixed(4))), reach: Number(path.reach.toFixed(4)) }));
  await writeFile(anchorsFile, `${JSON.stringify(anchorData, null, 2)}\n`);
  await silkTexture().toFile(join(OUT, "silk.png"));
  console.log(`${name}: ${info.width}×${info.height} · capas, mapas ${map.width}×${map.height} y seda`);
}
