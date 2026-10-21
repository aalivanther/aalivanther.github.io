// Motor de pincel: pinta trazos de tinta sobre un lienzo 2D, en vivo, como un pincel de sumi-e.
//
// Cómo se forma un trazo:
// 1. Una curva suave (Catmull-Rom centrípeta) pasa por los puntos de control del diseño.
// 2. La presión cambia a lo largo del trazo: entra con fuerza, sostiene y se afila al salir.
// 3. El pincel es un haz de cerdas. Cada cerda tiene su carga de tinta y se seca a su ritmo. Cuando
//    se seca, deja una veta blanca: el «pincel seco» (飛白) que da velocidad e intención al trazo.
// 4. El trazo se pinta en una capa propia, opaca. Al terminar se funde con lo ya pintado con un halo
//    difuso, que simula la tinta absorbida por el papel.
//
// Las coordenadas de diseño van de 0 a 1000 en ambos ejes; el pintor las escala al tamaño del lienzo.

/** Color de la tinta: el sepia gris oscuro de las ramas de la pintura (Wang Guxiang), no negro de pantalla. */
const INK_RGB = "52, 45, 39";
/** Bermellón del sello, el único color de la página. */
const SEAL_RGB = "196, 52, 38";
/** Rojo de ciruelo: tomado de las flores de la pintura del árbol (Wang Guxiang), para que todo sea del mismo rojo. */
const BLOSSOM_RGB = "212, 74, 90";

/** Ruta de la textura de seda que genera tools/arbol.mjs. */
const SILK_SRC = "/art/silk.png";

/**
 * Imagen de la textura de seda, compartida por todos los pinceles. Se pide una sola vez al cargar el módulo;
 * si no carga, los trazos salen sin textura y todo lo demás sigue igual.
 */
const silkImage: HTMLImageElement | null = typeof Image === "undefined" ? null : Object.assign(new Image(), { src: SILK_SRC, decoding: "async" });

/** Colores que puede llevar una marca. */
export type InkColor = "ink" | "seal" | "blossom";

/** Componentes RGB de cada color de marca. */
const COLORS: Record<InkColor, string> = { ink: INK_RGB, seal: SEAL_RGB, blossom: BLOSSOM_RGB };
/** Número de cerdas del pincel: más cerdas dan un borde más rico, a costa de más líneas por cuadro. */
const BRISTLES = 34;
/** Distancia entre muestras del trazo, en unidades de diseño. */
const SAMPLE_SPACING = 1.6;
/** Cuánto aclara el grano de absorción la tinta (0–1). */
const GRAIN_STRENGTH = 0.26;
/** Fracción del ancho que ocupa el núcleo sólido; el resto del borde lo forman las cerdas, irregulares. */
const CORE_RATIO = 0.82;

/** Un punto en el espacio de diseño. */
export type Point = readonly [number, number];

/** Descripción de un trazo, tal como la escribe quien diseña un emblema. */
export interface Stroke {
  /** Puntos de control por los que pasa el pincel, en orden. */
  points: readonly Point[];
  /** Radio máximo del pincel, en unidades de diseño. */
  width: number;
  /** Cuánto tarda en pintarse, en milisegundos. */
  duration: number;
  /** Pausa antes de empezar, en milisegundos: el respiro entre un trazo y el siguiente. */
  pause?: number;
  /** Presión al entrar, a mitad y al salir (0–1). */
  pressure?: readonly [number, number, number];
  /** Cuánto se seca el pincel hacia el final (0 = siempre cargado, 1 = muy seco). */
  dry?: number;
  /** Intensidad de la tinta (1 = negro pleno; valores bajos dan aguadas grises). */
  tone?: number;
  /** Si el trazo cierra sobre sí mismo (hexágono, estrella). */
  closed?: boolean;
  /** Tramos rectos con esquinas vivas, y el pincel se apoya en cada vértice (estrella, hexágono). */
  corners?: boolean;
  /** Color: tinta o bermellón del sello. */
  color?: InkColor;
}

/** Una toque de pincel: una gota de tinta apretada en un punto. */
export interface Dab {
  dab: Point;
  /** Radio de la gota, en unidades de diseño. */
  radius: number;
  /** Cuánto tarda en aparecer, en milisegundos. */
  duration: number;
  pause?: number;
  tone?: number;
  color?: InkColor;
}

/** Aguada: una mancha amplia de tinta muy diluida que se tiende bajo el emblema antes de los trazos. */
export interface Wash {
  wash: Point;
  /** Radio de la aguada, en unidades de diseño. */
  radius: number;
  duration: number;
  pause?: number;
  /** Intensidad; las aguadas son muy tenues (0.05–0.15). */
  tone?: number;
  color?: InkColor;
}

/**
 * Flor de ciruelo en una sola marca: halo rosado de agua, cinco pétalos rojos y el centro con sus estambres
 * en tinta. Con `bud`, es un botón cerrado. Ser una sola marca permite pintar decenas de flores rápido.
 */
export interface Flower {
  flower: Point;
  /** Radio de la flor abierta, en unidades de diseño. */
  radius: number;
  duration: number;
  pause?: number;
  /** Giro de la flor en radianes, para que no todas miren igual. */
  turn?: number;
  bud?: boolean;
  tone?: number;
  color?: InkColor;
}

/** Un emblema es una secuencia de aguadas, trazos, toques y flores que se pintan uno tras otro. */
export type Mark = Stroke | Dab | Wash | Flower;

/** Una muestra del trazo ya calculado: posición, dirección normal, avance (0–1) y radio. */
interface Sample {
  x: number;
  y: number;
  nx: number;
  ny: number;
  t: number;
  radius: number;
  /** Cuánto se ha secado el pincel aquí (0–1): crece solo en el tramo final del trazo. */
  fade: number;
}

/** Generador pseudoaleatorio con semilla: cada emblema se pinta igual en cada visita. */
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

/**
 * Variación a mano: cada vez que se pinta, el arranque y el final del trazo cambian un poco de sitio,
 * de presión y de sequedad. El cuerpo del trazo se mantiene, así el emblema se reconoce siempre
 * pero nunca sale idéntico.
 */
function vary(stroke: Stroke, random: () => number): Stroke {
  const jitter = (amount: number) => (random() * 2 - 1) * amount;
  const points = stroke.points.map((point) => [point[0], point[1]] as [number, number]);
  const first = points[0];
  const last = points[points.length - 1];
  const reach = Math.max(4, stroke.width * 0.35);
  if (first) {
    first[0] += jitter(reach);
    first[1] += jitter(reach);
  }
  if (last && !stroke.closed) {
    last[0] += jitter(reach * 1.6);
    last[1] += jitter(reach * 1.6);
  }
  const [start, middle, end] = stroke.pressure ?? [0.85, 0.85, 0.2];
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return {
    ...stroke,
    points,
    width: stroke.width * (1 + jitter(0.07)),
    pressure: [clamp(start + jitter(0.12)), clamp(middle + jitter(0.06)), clamp(end + jitter(0.05))],
    dry: clamp((stroke.dry ?? 0.5) + jitter(0.12)),
  };
}

/** Curva suave de 0 a 1. */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Velocidad del pincel: arranca, acelera y frena al final, como una mano que sabe a dónde va. */
function brushEase(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Presión en el punto t del trazo: entrada, cuerpo y salida afilada.
 * La entrada y la salida miden una distancia parecida en cualquier trazo (`attack` y `release` son
 * fracciones ya calculadas según su longitud): un contorno largo no se adelgaza durante un lado entero.
 */
function pressureAt(t: number, [start, middle, end]: readonly [number, number, number], attack: number, release: number): number {
  if (t < attack) return start + (1 - start) * smooth(t / attack);
  if (t > 1 - release) return middle + (end - middle) * smooth((t - (1 - release)) / release);
  return 1 + (middle - 1) * ((t - attack) / (1 - attack - release));
}

/**
 * Pasa una curva Catmull-Rom centrípeta por los puntos y la devuelve como polilínea densa.
 * La variante centrípeta evita bucles y picos raros en las esquinas cerradas.
 */
function spline(points: readonly Point[], closed: boolean): Point[] {
  if (points.length < 2) return [...points];
  const p = closed ? [points[points.length - 1]!, ...points, points[0]!, points[1]!] : [points[0]!, ...points, points[points.length - 1]!];
  const out: Point[] = [];
  const STEPS = 24;
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[i + 2]!;
    const d = (a: Point, b: Point) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t1 = d(p0, p1);
    const t2 = t1 + d(p1, p2);
    const t3 = t2 + d(p2, p3);
    for (let s = 0; s < STEPS; s++) {
      const u = t1 + ((t2 - t1) * s) / STEPS;
      const lerp = (a: Point, b: Point, ta: number, tb: number): [number, number] => {
        const w = (u - ta) / (tb - ta);
        return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
      };
      const a1 = lerp(p0, p1, 0, t1);
      const a2 = lerp(p1, p2, t1, t2);
      const a3 = lerp(p2, p3, t2, t3);
      const b1 = lerp(a1, a2, 0, t2);
      const b2 = lerp(a2, a3, t1, t3);
      out.push(lerp(b1, b2, t1, t2));
    }
  }
  out.push(closed ? points[0]! : points[points.length - 1]!);
  return out;
}

/**
 * Polilínea de tramos rectos con un redondeo mínimo en cada vértice. Devuelve también en qué punto
 * de la polilínea cae cada vértice, para que el pincel se apoye ahí.
 */
function cornered(points: readonly Point[], closed: boolean): { line: Point[]; vertexIndices: number[] } {
  const ROUNDING = 0.07;
  const path = closed ? [...points, points[0]!] : [...points];
  const line: Point[] = [];
  const vertexIndices: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
    const startAt = i === 0 && !closed ? 0 : ROUNDING;
    const endAt = i === path.length - 2 && !closed ? 1 : 1 - ROUNDING;
    if (i > 0 || closed) vertexIndices.push(line.length);
    for (let k = 0; k <= steps; k++) {
      const w = startAt + ((endAt - startAt) * k) / steps;
      line.push([a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]);
    }
  }
  if (closed) line.push(line[0]!);
  return { line, vertexIndices };
}

/** Convierte un trazo en muestras equiespaciadas con su radio ya aplicado. */
function sampleStroke(stroke: Stroke, random: () => number): Sample[] {
  const closed = stroke.closed ?? false;
  const shaped = stroke.corners ? cornered(stroke.points, closed) : { line: spline(stroke.points, closed), vertexIndices: [] };
  const line = shaped.line;
  // Longitud acumulada para remuestrear a distancia constante.
  const lengths = [0];
  for (let i = 1; i < line.length; i++) {
    lengths.push(lengths[i - 1]! + Math.hypot(line[i]![0] - line[i - 1]![0], line[i]![1] - line[i - 1]![1]));
  }
  const total = lengths[lengths.length - 1]!;
  const count = Math.max(2, Math.ceil(total / SAMPLE_SPACING));
  // Distancias de entrada, salida y secado en unidades de diseño, convertidas a fracción de este trazo.
  const attack = Math.min(0.1, Math.max(0.03, 60 / (total || 1)));
  const release = Math.min(0.32, Math.max(0.12, 230 / (total || 1)));
  const dryZone = Math.min(1, Math.max(0.3, 520 / (total || 1)));
  // Avance (0–1) de cada vértice: ahí el pincel se detiene un instante y la tinta se carga más.
  const vertexAt = shaped.vertexIndices.map((index) => (lengths[index] ?? 0) / (total || 1));
  const pressure = stroke.pressure ?? [0.85, 0.85, 0.2];
  // Temblor de la mano: dos ondas lentas desfasadas modulan el ancho un poco.
  const wobbleA = random() * Math.PI * 2;
  const wobbleB = random() * Math.PI * 2;
  const samples: Sample[] = [];
  let segment = 1;
  for (let k = 0; k <= count; k++) {
    const target = (k / count) * total;
    while (segment < lengths.length - 1 && lengths[segment]! < target) segment++;
    const a = line[segment - 1]!;
    const b = line[segment]!;
    const span = lengths[segment]! - lengths[segment - 1]! || 1;
    const w = (target - lengths[segment - 1]!) / span;
    const x = a[0] + (b[0] - a[0]) * w;
    const y = a[1] + (b[1] - a[1]) * w;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const t = k / count;
    // La mano no aprieta igual todo el trazo: una onda lenta amplia y otra rápida pequeña.
    const wobble = 1 + Math.sin(t * 5.5 + wobbleA) * 0.05 + Math.sin(t * 19 + wobbleB) * 0.012;
    let press = 1;
    for (const at of vertexAt) press += 0.3 * Math.exp(-Math.pow((t - at) / 0.018, 2));
    const fade = Math.max(0, (t - (1 - dryZone)) / dryZone);
    samples.push({ x, y, nx: -dy / len, ny: dx / len, t, fade, radius: stroke.width * pressureAt(t, pressure, attack, release) * wobble * press });
  }
  return samples;
}

/** Cerda del pincel: posición relativa en el ancho (−1 a 1), carga de tinta y ritmo de secado. */
interface Bristle {
  offset: number;
  load: number;
  thirst: number;
}

/** Crea el haz de cerdas: más juntas al centro, como un pincel real. */
function createBristles(random: () => number): Bristle[] {
  return Array.from({ length: BRISTLES }, (_, i) => {
    const u = (i + 0.5) / BRISTLES;
    const centered = Math.sign(u - 0.5) * Math.pow(Math.abs(u - 0.5) * 2, 0.85);
    return { offset: centered + (random() - 0.5) * 0.04, load: 0.6 + random() * 0.4, thirst: 0.5 + random() * 0.9 };
  });
}

/**
 * Pinta emblemas en un lienzo, trazo a trazo y en tiempo real.
 * Usa dos capas fuera de pantalla: lo ya pintado y el trazo en curso.
 */
export class InkPainter {
  private readonly context: CanvasRenderingContext2D;
  private readonly committed: HTMLCanvasElement;
  private readonly committedContext: CanvasRenderingContext2D;
  private readonly layer: HTMLCanvasElement;
  private readonly layerContext: CanvasRenderingContext2D;
  private scale = 1;
  private width = 0;
  private height = 0;
  private frame = 0;
  private token = 0;
  /** Intensidad del trazo en curso: la capa se muestra ya con su tono final mientras se pinta. */
  private currentTone = 1;
  /** Patrón de la textura de seda; null mientras la imagen no ha cargado. */
  private grain: CanvasPattern | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    this.committed = document.createElement("canvas");
    this.layer = document.createElement("canvas");
    const committedContext = this.committed.getContext("2d");
    const layerContext = this.layer.getContext("2d");
    if (!context || !committedContext || !layerContext) throw new Error("2d canvas unavailable for ink painter");
    this.context = context;
    this.committedContext = committedContext;
    this.layerContext = layerContext;
  }

  /**
   * Ajusta las tres capas al tamaño del lienzo en pantalla, con la densidad de píxeles real.
   * El ancho siempre mide 1000 unidades de diseño; el alto, lo que corresponda a la proporción del lienzo
   * (1000 en los emblemas, que son cuadrados; más en un árbol vertical).
   */
  resize(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(this.canvas.clientWidth * ratio);
    const height = Math.round(this.canvas.clientHeight * ratio);
    if ((width === this.width && height === this.height) || width === 0 || height === 0) return;
    this.width = width;
    this.height = height;
    for (const target of [this.canvas, this.committed, this.layer]) {
      target.width = width;
      target.height = height;
    }
    this.scale = width / 1000;
  }

  /** Alto del lienzo en unidades de diseño (el ancho siempre es 1000). */
  get designHeight(): number {
    return this.width ? (this.height / this.width) * 1000 : 1000;
  }

  /** Borra todo y detiene cualquier pintura en curso. */
  clear(): void {
    this.token++;
    cancelAnimationFrame(this.frame);
    this.context.clearRect(0, 0, this.width, this.height);
    this.committedContext.clearRect(0, 0, this.width, this.height);
    this.layerContext.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Pinta un emblema completo. `seed` fija las imperfecciones; con una semilla nueva cada vez, el
   * emblema varía un poco en cada pintura. Con `instant` (movimiento reducido) todo aparece en un solo cuadro.
   * La promesa se cumple cuando termina el último trazo, o de inmediato si otra pintura la interrumpe.
   */
  paint(marks: readonly Mark[], seed: number, instant: boolean): Promise<void> {
    this.clear();
    const token = this.token;
    const random = createRandom(seed);
    // Se precalcula todo el emblema antes de empezar para que la animación no tenga tirones.
    // Cada trazo se varía una vez y el resultado se usa para todo: forma, sequedad y grosor.
    const plan = marks.map((mark) => {
      if ("dab" in mark || "wash" in mark || "flower" in mark) return { mark, samples: null, bristles: null };
      const varied = vary(mark, random);
      return { mark: varied as Mark, samples: sampleStroke(varied, random), bristles: createBristles(random) };
    });

    if (instant) {
      for (const step of plan) this.drawMark(step.mark, step.samples, step.bristles, 1, 0, random, true);
      this.compose();
      return Promise.resolve();
    }

    // Línea de tiempo: cada marca empieza cuando termina la anterior más su pausa. En cada cuadro se pintan
    // todas las marcas cuyo turno ya llegó, así una marca corta no hace esperar un cuadro entero a la siguiente.
    const starts: number[] = [];
    let clock = 0;
    for (const step of plan) {
      clock += step.mark.pause ?? 0;
      starts.push(clock);
      clock += step.mark.duration;
    }

    return new Promise((resolve) => {
      let index = 0;
      let drawnUntil = 0;
      let origin = -1;
      const tick = (now: number) => {
        if (token !== this.token) {
          resolve();
          return;
        }
        if (origin < 0) origin = now;
        const elapsed = now - origin;
        let drew = false;
        while (index < plan.length && elapsed >= starts[index]!) {
          const step = plan[index]!;
          const progress = Math.min(1, (elapsed - starts[index]!) / step.mark.duration);
          drawnUntil = this.drawMark(step.mark, step.samples, step.bristles, brushEase(progress), drawnUntil, random, progress >= 1);
          drew = true;
          if (progress < 1) break;
          index++;
          drawnUntil = 0;
        }
        if (drew) this.compose();
        if (index >= plan.length) {
          resolve();
          return;
        }
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    });
  }

  /**
   * Pinta en la capa del trazo en curso hasta el avance `reach` (0–1), desde la muestra `from`.
   * Devuelve hasta qué muestra quedó pintado, para seguir desde ahí en el siguiente cuadro.
   * Con `finish`, funde la capa con lo ya pintado.
   */
  private drawMark(
    mark: Mark,
    samples: Sample[] | null,
    bristles: Bristle[] | null,
    reach: number,
    from: number,
    random: () => number,
    finish: boolean,
  ): number {
    const ctx = this.layerContext;
    const s = this.scale;
    const rgb = COLORS[mark.color ?? "ink"];
    this.currentTone = mark.tone ?? 1;
    let drawn = from;

    if ("flower" in mark) {
      this.drawFlower(mark, reach, random);
    } else if ("wash" in mark) {
      this.drawWash(mark, reach, rgb, random);
    } else if ("dab" in mark) {
      this.drawDab(mark, reach, rgb, random);
    } else if (samples && bristles) {
      const until = Math.max(1, Math.floor(reach * (samples.length - 1)));
      const dry = mark.dry ?? 0.5;
      ctx.lineCap = "round";
      // Entrada: el pincel se posa y deja un apoyo redondeado, un poco más ancho que el trazo.
      if (from <= 1 && samples[0]) {
        const first = samples[0];
        this.blob(first.x, first.y, first.radius * 1.04, rgb, random);
      }
      for (let i = Math.max(1, from); i <= until; i++) {
        const a = samples[i - 1]!;
        const b = samples[i]!;
        // Núcleo: un cuadrilátero sólido entre las dos muestras, más estrecho que el pincel. Cuando el
        // pincel se seca, el núcleo también adelgaza: la tinta que queda está en las cerdas, no en el centro.
        const coreA = CORE_RATIO * (1 - 0.55 * dry * a.fade * a.fade);
        const coreB = CORE_RATIO * (1 - 0.55 * dry * b.fade * b.fade);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.beginPath();
        ctx.moveTo((a.x + a.nx * a.radius * coreA) * s, (a.y + a.ny * a.radius * coreA) * s);
        ctx.lineTo((b.x + b.nx * b.radius * coreB) * s, (b.y + b.ny * b.radius * coreB) * s);
        ctx.lineTo((b.x - b.nx * b.radius * coreB) * s, (b.y - b.ny * b.radius * coreB) * s);
        ctx.lineTo((a.x - a.nx * a.radius * coreA) * s, (a.y - a.ny * a.radius * coreA) * s);
        ctx.closePath();
        ctx.fill();

        // Cerdas: las cargadas extienden el borde con irregularidad; las secas abren vetas blancas.
        const width = Math.max(0.6, ((b.radius * 2) / BRISTLES) * 1.7 * s);
        const wet = new Path2D();
        const parched = new Path2D();
        for (const bristle of bristles) {
          const ink = bristle.load - dry * Math.pow(b.fade, 1.6) * bristle.thirst - random() * 0.03;
          const ax = (a.x + a.nx * a.radius * bristle.offset) * s;
          const ay = (a.y + a.ny * a.radius * bristle.offset) * s;
          const bx = (b.x + b.nx * b.radius * bristle.offset) * s;
          const by = (b.y + b.ny * b.radius * bristle.offset) * s;
          const target = ink > 0.12 ? wet : parched;
          target.moveTo(ax, ay);
          target.lineTo(bx, by);
        }
        ctx.lineWidth = width;
        ctx.strokeStyle = `rgb(${rgb})`;
        ctx.stroke(wet);
        // En trazos finos las vetas secas se suavizan: si no, un trazo delgado se parte en dos líneas.
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = width * 0.8;
        ctx.strokeStyle = `rgba(0, 0, 0, ${(0.92 * Math.min(1, mark.width / 34)).toFixed(3)})`;
        ctx.stroke(parched);
      }
      ctx.globalCompositeOperation = "source-over";
      drawn = until;
    }

    if (finish) this.commit(mark.tone ?? 1);
    return drawn;
  }

  /**
   * Aguada: una mancha amplia que se extiende desde el centro, con el centro más cargado y el borde
   * irregular que se pierde en el papel. La capa se pinta opaca y su tono (muy bajo) se aplica al componer.
   */
  private drawWash(mark: Wash, reach: number, rgb: string, random: () => number): void {
    const ctx = this.layerContext;
    const s = this.scale;
    const [cx, cy] = mark.wash;
    const radius = mark.radius * (0.4 + 0.6 * Math.sqrt(reach)) * s;
    const VERTICES = 40;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= VERTICES; i++) {
      const angle = (i / VERTICES) * Math.PI * 2;
      // Contorno de aguada: ondas lentas de distinta frecuencia más un poco de ruido, nunca un óvalo limpio.
      const r = radius * (0.8 + Math.sin(angle * 3 + 1.7) * 0.07 + Math.sin(angle * 7 + 0.4) * 0.04 + random() * 0.07);
      const x = cx * s + Math.cos(angle) * r;
      const y = cy * s + Math.sin(angle) * r * 0.86;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const gradient = ctx.createRadialGradient(cx * s, cy * s, 0, cx * s, cy * s, radius);
    gradient.addColorStop(0, `rgba(${rgb}, 1)`);
    gradient.addColorStop(0.65, `rgba(${rgb}, 0.7)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  }

  /** Gota de tinta: un borde irregular que crece rápido desde el centro. */
  private drawDab(mark: Dab, reach: number, rgb: string, random: () => number): void {
    const [cx, cy] = mark.dab;
    this.blob(cx, cy, mark.radius * (0.35 + 0.65 * Math.sqrt(reach)), rgb, random);
  }

  /**
   * Flor de ciruelo: se abre desde el centro. La capa se repinta entera en cada cuadro (solo contiene esta
   * flor), así el crecimiento no deja rastros. Los pétalos varían de intensidad: unos más rojos, otros
   * más rosados, como pintados con más o menos agua.
   */
  private drawFlower(mark: Flower, reach: number, random: () => number): void {
    const ctx = this.layerContext;
    const s = this.scale;
    const [cx, cy] = mark.flower;
    const radius = mark.radius * (0.35 + 0.65 * Math.sqrt(reach));
    const red = COLORS[mark.color ?? "blossom"];
    const turn = mark.turn ?? 0;
    ctx.clearRect(0, 0, this.width, this.height);
    if (mark.bud) {
      this.blob(cx, cy, radius * 0.55, red, random, 0.92);
      this.blob(cx, cy + radius * 0.5, radius * 0.18, INK_RGB, random);
      return;
    }
    // Halo de agua rosada alrededor de la flor.
    const halo = ctx.createRadialGradient(cx * s, cy * s, 0, cx * s, cy * s, radius * 2 * s);
    halo.addColorStop(0, `rgba(${red}, 0.22)`);
    halo.addColorStop(1, `rgba(${red}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx * s, cy * s, radius * 2 * s, 0, Math.PI * 2);
    ctx.fill();
    // Cinco pétalos con intensidad desigual.
    const PETALS = 5;
    for (let i = 0; i < PETALS; i++) {
      const angle = turn + (i / PETALS) * Math.PI * 2;
      this.blob(cx + Math.cos(angle) * radius * 0.62, cy + Math.sin(angle) * radius * 0.62, radius * 0.5, red, random, 0.62 + random() * 0.33);
    }
    // Centro y estambres en tinta.
    this.blob(cx, cy, radius * 0.2, INK_RGB, random, 0.85);
    for (let i = 0; i < PETALS; i++) {
      const angle = turn + 0.3 + (i / PETALS) * Math.PI * 2;
      this.blob(cx + Math.cos(angle) * radius * 0.42, cy + Math.sin(angle) * radius * 0.42, radius * 0.07, INK_RGB, random);
    }
  }

  /** Mancha redonda de borde irregular, en coordenadas de diseño; `alpha` permite pétalos más aguados. */
  private blob(cx: number, cy: number, radius: number, rgb: string, random: () => number, alpha = 1): void {
    const ctx = this.layerContext;
    const s = this.scale;
    const VERTICES = 30;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = alpha >= 1 ? `rgb(${rgb})` : `rgba(${rgb}, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    for (let i = 0; i <= VERTICES; i++) {
      const angle = (i / VERTICES) * Math.PI * 2;
      const r = radius * (0.9 + random() * 0.14);
      const x = (cx + Math.cos(angle) * r) * s;
      const y = (cy + Math.sin(angle) * r) * s;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Grano de absorción: una trama de ruido que aclara la tinta de forma desigual, como el papel que
   * absorbe más en unas fibras que en otras. Se genera una vez y se repite como patrón.
   */
  private grainPattern(): CanvasPattern | null {
    if (this.grain) return this.grain;
    // La textura de seda real (la misma trama que la pintura) en cuanto está cargada.
    if (silkImage?.complete && silkImage.naturalWidth > 0) {
      this.grain = this.layerContext.createPattern(silkImage, "repeat");
      return this.grain;
    }
    return null;
  }

  /** Funde la capa del trazo con lo ya pintado: primero un halo difuso (la tinta que se corre) y luego el trazo nítido. */
  private commit(tone: number): void {
    // Antes de fundir, el grano aclara la tinta de forma desigual.
    const pattern = this.grainPattern();
    if (pattern) {
      this.layerContext.save();
      this.layerContext.globalCompositeOperation = "destination-out";
      this.layerContext.globalAlpha = GRAIN_STRENGTH;
      this.layerContext.fillStyle = pattern;
      this.layerContext.fillRect(0, 0, this.width, this.height);
      this.layerContext.restore();
    }
    const ctx = this.committedContext;
    ctx.save();
    ctx.globalAlpha = 0.42 * tone;
    ctx.filter = `blur(${Math.max(1, 1.6 * this.scale * 1.4)}px)`;
    ctx.drawImage(this.layer, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = tone;
    ctx.drawImage(this.layer, 0, 0);
    ctx.restore();
    this.layerContext.clearRect(0, 0, this.width, this.height);
  }

  /** Dibuja en pantalla lo ya pintado más el trazo en curso. */
  private compose(): void {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    // El trazo en curso ya lleva su tono y su grano (el mismo patrón que se aplica al fundir, así no «salta»).
    ctx.globalAlpha = this.currentTone;
    ctx.drawImage(this.layer, 0, 0);
    const pattern = this.grainPattern();
    if (pattern) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = GRAIN_STRENGTH;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    // Lo ya pintado va detrás del trazo en curso; su grano ya quedó aplicado al fundirlo.
    ctx.globalCompositeOperation = "destination-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(this.committed, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }
}
