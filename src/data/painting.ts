// La pintura de la portada y sus racimos, donde se anclan los proyectos.
//
// Obra: Wang Guxiang, «White and Red Plum Blossom» (1546). Minneapolis Institute of Art, 97.133.2.
// Dominio público (vía Wikimedia Commons). tools/arbol.mjs prepara todo lo que hay en public/art/ y escribe
// painting-anchors.json con los racimos y su camino por la rama real.

import anchors from "./painting-anchors.json";

/** Punto dentro de la pintura, en fracciones de su ancho y alto (0–1). */
export type PaintingPoint = readonly [number, number];

/** Un racimo de flores de la pintura donde se ancla un proyecto. */
export interface PaintingAnchor {
  /** Posición del racimo en la pintura. */
  at: PaintingPoint;
  /** Hasta dónde llega el trazo animado (valor del mapa de crecimiento en el racimo). */
  reach: number;
}

/** La pintura lista para la portada. */
export interface PaintingVariant {
  /** Imagen completa para navegadores sin WebGL. */
  src: string;
  /** Capas para la profundidad, de la más lejana a la más cercana. */
  layers: { wash: string; twig: string; branch: string; trunk: string; bloom: string };
  /** Mapas: rojo = crecimiento (0 = aparece primero); verde = máscara orgánica sobre el papel. */
  maps: string;
  /** Caminos de rama: cada imagen guarda tres racimos, uno por canal (rojo, verde, azul). */
  paths: readonly string[];
  /** Tamaño de la imagen publicada, en píxeles; da la proporción. */
  width: number;
  height: number;
  /** Racimos en orden de uso: el proyecto i se ancla en el racimo i. */
  anchors: readonly PaintingAnchor[];
}

/** Crédito de la obra, para la página y la licencia. */
export const paintingCredit = {
  artist: "Wang Guxiang",
  title: "White and Red Plum Blossom",
  year: 1546,
  holder: "Minneapolis Institute of Art",
  license: "Public domain",
} as const;

/** El encuadre vertical alrededor del tronco, con sus ramas rojas. */
export const plumPainting: PaintingVariant = {
  src: "/art/plum.webp",
  layers: {
    wash: "/art/plum-wash.webp",
    twig: "/art/plum-twig.webp",
    branch: "/art/plum-branch.webp",
    trunk: "/art/plum-trunk.webp",
    bloom: "/art/plum-bloom.webp",
  },
  maps: "/art/plum-maps.webp",
  paths: ["/art/plum-paths-0.webp", "/art/plum-paths-1.webp", "/art/plum-paths-2.webp"],
  width: 1500,
  height: 1568,
  anchors: anchors.map((anchor) => ({ at: [anchor.at[0] ?? 0.5, anchor.at[1] ?? 0.5] as const, reach: anchor.reach })),
};
