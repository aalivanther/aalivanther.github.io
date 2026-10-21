// Genera public/favicon.ico a partir de public/favicon.svg.
// Hace falta porque los navegadores piden /favicon.ico en la raíz del dominio cuando una página no declara icono,
// y varias demos no lo declaran: sin este archivo, cada demo registraría un 404 en consola.
// El formato ICO admite imágenes PNG dentro desde hace años; aquí se empaquetan tamaños de 16, 32 y 48 px.
// Uso: node tools/favicon.mjs
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { projectRoot } from "./rutas.mjs";

/** Tamaños incluidos en el .ico, en píxeles. */
const SIZES = [16, 32, 48];
/** Bytes de la cabecera ICO y de cada entrada del directorio de imágenes. */
const HEADER_BYTES = 6;
const ENTRY_BYTES = 16;

const svg = await readFile(join(projectRoot, "public", "favicon.svg"));
const images = await Promise.all(SIZES.map((size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()));

// Cabecera: reservado (0), tipo 1 = icono, número de imágenes.
const header = Buffer.alloc(HEADER_BYTES);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

// Directorio: una entrada por imagen con su tamaño y la posición donde empiezan sus bytes.
let offset = HEADER_BYTES + ENTRY_BYTES * images.length;
const entries = images.map((png, i) => {
  const size = SIZES[i] ?? 0;
  const entry = Buffer.alloc(ENTRY_BYTES);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});

const output = join(projectRoot, "public", "favicon.ico");
await writeFile(output, Buffer.concat([header, ...entries, ...images]));
console.log(`favicon.ico escrito (${SIZES.join(", ")} px): ${output}`);
