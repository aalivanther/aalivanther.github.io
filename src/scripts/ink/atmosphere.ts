// Atmósfera del papel libre: unas pocas manchas de tinta y pétalos sueltos a la derecha, en tres profundidades.
// Las aguadas lejanas se mueven poco con el parallax, las salpicaduras algo más y los pétalos, al frente, mucho:
// el lado del papel también tiene volumen. Se pintan una sola vez con el motor de pincel, cuando la pintura ya
// creció, y se repintan al instante si cambia el tamaño.

import { InkPainter, type Mark, type Point } from "./brush";

/** Retraso antes de pintar la atmósfera: entra cuando la pintura ya casi terminó de crecer. */
const ENTER_DELAY_MS = 2600;

/** Generador pseudoaleatorio con semilla: las salpicaduras quedan siempre en el mismo sitio. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Salpicadura: una gota principal y gotitas alrededor, más pequeñas cuanto más lejos. */
function splash(center: Point, size: number, random: () => number): Mark[] {
  const marks: Mark[] = [{ dab: center, radius: size, duration: 60, pause: 40, tone: 0.85 }];
  for (let i = 0; i < 9; i++) {
    const angle = random() * Math.PI * 2;
    const distance = size * (1.6 + random() * 3.2);
    const radius = Math.max(0.8, size * (0.12 + random() * 0.3) * (1 - distance / (size * 6)));
    marks.push({ dab: [center[0] + Math.cos(angle) * distance, center[1] + Math.sin(angle) * distance], radius, duration: 20, pause: 6, tone: 0.8 });
  }
  return marks;
}

/** Marcas de cada profundidad, en unidades de diseño (ancho 1000, alto según la pantalla). */
function layers(height: number): [Mark[], Mark[], Mark[]] {
  const random = createRandom(42);
  const far: Mark[] = [
    { wash: [1010, height * 0.03], radius: 150, duration: 600, tone: 0.05 },
    { wash: [575, height * 1.0], radius: 120, duration: 600, pause: 120, tone: 0.045 },
  ];
  const mid: Mark[] = [
    // Una pincelada seca, rápida, que entra por la esquina inferior derecha.
    {
      points: [
        [770, height * 0.95],
        [880, height * 0.9],
        [990, height * 0.86],
      ],
      width: 14,
      duration: 260,
      pressure: [1, 0.7, 0],
      dry: 1,
      tone: 0.75,
    },
    ...splash([952, height * 0.1], 7, random),
    ...splash([600, height * 0.06], 4, random),
  ];
  const near: Mark[] = [
    { flower: [990, height * 0.3], radius: 10, turn: 0.4, duration: 90, pause: 200 },
    { flower: [572, height * 0.22], radius: 7, turn: 1.3, duration: 80, pause: 90 },
    { flower: [978, height * 0.72], radius: 8, turn: 2.1, duration: 80, pause: 90 },
    { flower: [636, height * 0.97], radius: 6, bud: true, duration: 60, pause: 90 },
  ];
  return [far, mid, near];
}

/** Las tres capas de la atmósfera y sus pintores. */
export class Atmosphere {
  private readonly painters: InkPainter[];
  private timer = 0;

  constructor(
    root: HTMLElement,
    private readonly reducedMotion: boolean,
  ) {
    const canvases = Array.from(root.querySelectorAll<HTMLCanvasElement>("canvas"));
    if (canvases.length !== 3) throw new Error(`atmosphere needs 3 canvases, got ${canvases.length}`);
    this.painters = canvases.map((canvas) => new InkPainter(canvas));
  }

  /** Pinta la atmósfera: con animación la primera vez (tras un retraso) y al instante al redimensionar. */
  paint(instant = this.reducedMotion): void {
    window.clearTimeout(this.timer);
    const run = () => {
      this.painters.forEach((painter, i) => {
        painter.resize();
        const marks = layers(painter.designHeight)[i] ?? [];
        void painter.paint(marks, 7 + i, instant);
      });
    };
    if (instant) run();
    else this.timer = window.setTimeout(run, ENTER_DELAY_MS);
  }

  /** Detiene y borra (al desmontar la vista). */
  dispose(): void {
    window.clearTimeout(this.timer);
    this.painters.forEach((painter) => painter.clear());
  }
}
