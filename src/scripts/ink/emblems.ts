// Emblemas de tinta: cada proyecto en pocos trazos, con su orden, su velocidad y su presión.
// Regla de diseño: el mínimo de trazos que basta para reconocer la identidad real del proyecto.
// Coordenadas en un cuadro de 1000 × 1000, con el origen arriba a la izquierda.

import type { Mark, Point } from "./brush";

/** Puntos sobre un arco de circunferencia, con un leve temblor de radio para que no parezca compás. */
function arc(cx: number, cy: number, radius: number, from: number, to: number, steps: number, wobble = 0): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = from + ((to - from) * i) / steps;
    // Temblor lento a lo largo del giro: la mano se abre y se cierra un poco, sin picos.
    const r = radius * (1 + Math.sin(angle * 2.3 + 1.1) * wobble);
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
  });
}

/** Vértices de un polígono regular (o de una estrella si se alternan dos radios). */
function polygon(cx: number, cy: number, radii: readonly number[], sides: number, rotation: number): Point[] {
  return Array.from({ length: sides * radii.length }, (_, i) => {
    const angle = rotation + (i / (sides * radii.length)) * Math.PI * 2;
    const r = radii[i % radii.length]!;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
  });
}

/**
 * Contorno de un polígono (o estrella) que no se cierra del todo: termina un poco antes del vértice de
 * partida. Así la cola seca del trazo no cae sobre su propio arranque, y el hueco deja respirar la forma.
 */
function openPolygon(cx: number, cy: number, radii: readonly number[], sides: number, rotation: number, stopAt = 0.9): Point[] {
  const vertices = polygon(cx, cy, radii, sides, rotation);
  const first = vertices[0]!;
  const last = vertices[vertices.length - 1]!;
  return [...vertices, [last[0] + (first[0] - last[0]) * stopAt, last[1] + (first[1] - last[1]) * stopAt]];
}

const DEG = Math.PI / 180;

/**
 * Akyrion: una «A» de tres trazos. La pierna izquierda cae con todo el peso, la derecha baja más ligera y
 * el travesaño es un tajo seco y rápido que se escapa más allá de la forma: la firma del portafolio.
 */
const akyrion: Mark[] = [
  {
    points: [
      [478, 172],
      [426, 330],
      [352, 548],
      [272, 782],
      [238, 862],
    ],
    width: 42,
    duration: 340,
    pause: 200,
    pressure: [1, 0.85, 0.05],
    dry: 0.7,
  },
  {
    points: [
      [508, 196],
      [562, 362],
      [640, 584],
      [718, 800],
      [768, 862],
    ],
    width: 34,
    duration: 330,
    pause: 90,
    pressure: [0.65, 0.9, 0.1],
    dry: 0.6,
  },
  {
    points: [
      [292, 600],
      [500, 572],
      [742, 546],
      [880, 536],
    ],
    width: 24,
    duration: 170,
    pause: 130,
    pressure: [1, 0.8, 0],
    dry: 1,
  },
  {
    points: [
      [812, 540],
      [846, 498],
      [866, 452],
    ],
    width: 7,
    duration: 90,
    pause: 80,
    pressure: [0.9, 0.6, 0],
    dry: 0.9,
  },
  { flower: [868, 444], radius: 22, turn: 0.4, duration: 90, pause: 40 },
  { flower: [826, 506], radius: 15, turn: 1.1, duration: 80, pause: 30 },
  { flower: [896, 492], radius: 7, bud: true, duration: 50, pause: 30 },
];

/** ThePredict: el yelmo de El Augur. La cúpula en un arco, dos cuernos curvos, el tajo del visor y la guarda de la nariz. */
const thepredict: Mark[] = [
  {
    points: [
      [318, 742],
      [302, 560],
      [338, 404],
      [500, 330],
      [662, 404],
      [698, 560],
      [684, 742],
    ],
    width: 38,
    duration: 520,
    pressure: [0.95, 0.75, 0.06],
    dry: 0.65,
  },
  {
    points: [
      [336, 430],
      [252, 380],
      [196, 286],
      [214, 182],
      [262, 130],
    ],
    width: 30,
    duration: 230,
    pause: 100,
    pressure: [1, 0.55, 0],
    dry: 0.9,
  },
  {
    points: [
      [664, 430],
      [748, 380],
      [804, 286],
      [786, 182],
      [738, 130],
    ],
    width: 30,
    duration: 230,
    pause: 60,
    pressure: [1, 0.55, 0],
    dry: 0.9,
  },
  {
    points: [
      [344, 532],
      [500, 520],
      [660, 506],
    ],
    width: 30,
    duration: 160,
    pause: 120,
    pressure: [1, 0.85, 0.06],
    dry: 1,
    color: "blossom",
  },
  {
    points: [
      [500, 548],
      [502, 690],
    ],
    width: 18,
    duration: 140,
    pause: 70,
    pressure: [1, 0.75, 0.04],
    dry: 0.8,
  },
];

/** Seshat: la estrella de siete puntas de su logo, de un trazo continuo, bajo el arco y sobre la vara. */
const seshat: Mark[] = [
  {
    points: arc(500, 300, 230, 200 * DEG, 340 * DEG, 14),
    width: 28,
    duration: 300,
    pressure: [0.5, 1, 0.02],
    dry: 0.8,
  },
  {
    points: openPolygon(500, 560, [238, 98], 7, -90 * DEG, 0.82),
    width: 21,
    duration: 880,
    pause: 110,
    pressure: [1, 0.7, 0.1],
    dry: 0.55,
    corners: true,
  },
  {
    points: arc(500, 560, 36, -90 * DEG, 250 * DEG, 14),
    width: 11,
    color: "blossom",
    duration: 190,
    pause: 70,
    pressure: [1, 0.85, 0.15],
    dry: 0.3,
  },
  {
    points: [
      [500, 810],
      [501, 936],
    ],
    width: 22,
    duration: 150,
    pause: 80,
    pressure: [1, 0.8, 0.02],
    dry: 0.8,
  },
];

/** Be The Boss: el control en un solo contorno que no llega a cerrarse, la cruceta y los cuatro botones. */
const btb: Mark[] = [
  {
    points: [
      [500, 404],
      [330, 414],
      [226, 462],
      [180, 636],
      [204, 728],
      [276, 722],
      [354, 642],
      [500, 632],
      [646, 642],
      [724, 722],
      [796, 728],
      [822, 636],
      [776, 462],
      [670, 416],
      [566, 406],
    ],
    width: 26,
    duration: 900,
    pressure: [1, 0.72, 0.08],
    dry: 0.6,
  },
  {
    points: [
      [282, 524],
      [394, 520],
    ],
    width: 22,
    duration: 110,
    pause: 120,
    pressure: [1, 0.85, 0.1],
    dry: 0.6,
  },
  {
    points: [
      [338, 466],
      [340, 580],
    ],
    width: 22,
    duration: 110,
    pause: 50,
    pressure: [1, 0.85, 0.1],
    dry: 0.6,
  },
  { dab: [652, 468], radius: 20, duration: 70, pause: 90, color: "blossom" },
  { dab: [706, 522], radius: 20, duration: 70, pause: 40, color: "blossom" },
  { dab: [652, 576], radius: 20, duration: 70, pause: 40, color: "blossom" },
  { dab: [598, 522], radius: 20, duration: 70, pause: 40, color: "blossom" },
];

/** The Story Keeper: su hexágono de un trazo, el eje del tiempo en aguada y los tres hitos. */
const tsk: Mark[] = [
  {
    points: openPolygon(500, 520, [300], 6, -90 * DEG, 0.86),
    width: 24,
    duration: 800,
    pressure: [1, 0.65, 0.05],
    dry: 0.65,
    corners: true,
  },
  {
    points: [
      [500, 300],
      [500, 520],
      [501, 742],
    ],
    width: 9,
    duration: 260,
    pause: 110,
    pressure: [0.3, 1, 0.1],
    tone: 0.5,
  },
  {
    points: arc(500, 402, 26, -90 * DEG, 255 * DEG, 12),
    width: 9,
    duration: 150,
    pause: 70,
    pressure: [1, 0.9, 0.3],
  },
  { dab: [500, 520], radius: 44, duration: 110, pause: 60, color: "blossom" },
  {
    points: arc(500, 638, 26, -90 * DEG, 255 * DEG, 12),
    width: 9,
    duration: 150,
    pause: 70,
    pressure: [1, 0.9, 0.3],
  },
];

/** The Void Files: un ensō, el círculo zen de un trazo, con el punto bermellón de su logo en el vacío. */
const thevoidfiles: Mark[] = [
  {
    points: arc(500, 520, 300, 200 * DEG, 512 * DEG, 40, 0.025),
    width: 50,
    duration: 760,
    pressure: [1, 0.85, 0.06],
    dry: 1,
  },
  { dab: [500, 520], radius: 40, duration: 140, pause: 180, color: "blossom" },
];

/** Factor de escala de los emblemas dentro de su cuadro: los diseños se dibujan algo pequeños y se agrandan aquí. */
const EMBLEM_SCALE = 1.1;
/** Centro respecto del cual se escala (el centro óptico, un poco por encima del geométrico). */
const SCALE_CENTER: Point = [500, 520];

/** Agranda un emblema respecto del centro: posiciones, radios y grosores. */
function scaled(marks: readonly Mark[], factor: number): Mark[] {
  const at = ([x, y]: Point): Point => [SCALE_CENTER[0] + (x - SCALE_CENTER[0]) * factor, SCALE_CENTER[1] + (y - SCALE_CENTER[1]) * factor];
  return marks.map((mark) => {
    if ("flower" in mark) return { ...mark, flower: at(mark.flower), radius: mark.radius * factor };
    if ("dab" in mark) return { ...mark, dab: at(mark.dab), radius: mark.radius * factor };
    if ("wash" in mark) return { ...mark, wash: at(mark.wash), radius: mark.radius * factor };
    return { ...mark, points: mark.points.map(at), width: mark.width * factor };
  });
}

/** Aguada que se tiende bajo cada emblema antes del primer trazo: da profundidad sin competir con la tinta. */
const UNDERWASH: Mark = { wash: [520, 540], radius: 400, duration: 320, tone: 0.07 };

/** Escala propia de los emblemas que, agrandados del todo, se saldrían del cuadro (el arco de Seshat). */
const SCALE_OVERRIDES: Record<string, number> = { seshat: 1 };

/** Todos los emblemas por nombre: «akyrion» para la portada y el slug para cada proyecto. */
export const emblems: Record<string, readonly Mark[]> = Object.fromEntries(
  Object.entries({ akyrion, thepredict, seshat, btb, tsk, thevoidfiles }).map(([id, marks]) => [
    id,
    [UNDERWASH, ...scaled(marks, SCALE_OVERRIDES[id] ?? EMBLEM_SCALE)],
  ]),
);
