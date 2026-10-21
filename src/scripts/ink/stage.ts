// Escenario de un emblema en tres profundidades. Cada emblema se pinta repartido en tres lienzos: la aguada al
// fondo, la tinta en medio y los acentos de color al frente; con el parallax de la portada se separan y el
// emblema gana volumen. En escritorio hay dos grupos que se relevan: el nuevo se pinta mientras el anterior se
// absorbe en el papel (la clase CSS «is-leaving» lo desenfoca y aclara).

import { InkPainter, type Mark } from "./brush";
import { emblems } from "./emblems";

/** Tiempo que tarda en desvanecerse el emblema anterior; después se borran sus lienzos. */
const FADE_MS = 800;

/** Profundidades de un emblema, en el orden de los lienzos de su grupo. */
const LAYERS = ["back", "ink", "accent"] as const;
type Layer = (typeof LAYERS)[number];

/**
 * Trazos del emblema de un elemento. Un proyecto recién agregado que aún no tiene emblema propio usa el de
 * Akyrion: la página sigue funcionando igual.
 */
function emblemFor(id: string): readonly Mark[] {
  return emblems[id] ?? emblems["akyrion"] ?? [];
}

/** Semilla nueva en cada pintura: el emblema se reconoce siempre, pero sus trazos nunca salen idénticos. */
function freshSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

/** A qué profundidad va una marca: las aguadas al fondo, lo que tiene color al frente y la tinta en medio. */
function layerOf(mark: Mark): Layer {
  if ("wash" in mark) return "back";
  if (mark.color && mark.color !== "ink") return "accent";
  if ("flower" in mark) return "accent";
  return "ink";
}

/**
 * Reparte un emblema entre sus tres lienzos sin perder el ritmo: cada lienzo recibe solo sus marcas, y el
 * tiempo de las que no son suyas se suma como pausa a su siguiente marca. Así, pintados a la vez, los tres
 * lienzos reproducen el mismo orden que si fuera uno solo.
 */
function splitByLayer(marks: readonly Mark[]): Record<Layer, Mark[]> {
  const out: Record<Layer, Mark[]> = { back: [], ink: [], accent: [] };
  const carry: Record<Layer, number> = { back: 0, ink: 0, accent: 0 };
  for (const mark of marks) {
    const own = layerOf(mark);
    const span = (mark.pause ?? 0) + mark.duration;
    for (const layer of LAYERS) {
      if (layer === own) {
        out[layer].push({ ...mark, pause: (mark.pause ?? 0) + carry[layer] });
        carry[layer] = 0;
      } else {
        carry[layer] += span;
      }
    }
  }
  return out;
}

/** Un grupo de tres lienzos (fondo, tinta y acentos) con sus pintores. */
class EmblemGroup {
  private readonly painters: InkPainter[];

  constructor(readonly element: HTMLElement) {
    const canvases = LAYERS.map((layer) => element.querySelector<HTMLCanvasElement>(`[data-layer="${layer}"]`));
    if (canvases.some((canvas) => !canvas)) throw new Error("emblem group needs back, ink and accent canvases");
    this.painters = canvases.map((canvas) => new InkPainter(canvas as HTMLCanvasElement));
  }

  /** Pinta un emblema repartido en sus tres profundidades. */
  paint(marks: readonly Mark[], instant: boolean): void {
    const layers = splitByLayer(marks);
    const seed = freshSeed();
    this.painters.forEach((painter, i) => {
      painter.resize();
      void painter.paint(layers[LAYERS[i]!], seed + i, instant);
    });
  }

  /** Borra los tres lienzos. */
  clear(): void {
    this.painters.forEach((painter) => painter.clear());
  }
}

/** Relevo entre dos grupos para pintar emblemas uno tras otro sin cortes. */
export class EmblemStage {
  private readonly groups: EmblemGroup[];
  private readonly timers: number[] = [0, 0];
  private front = 0;
  private current = "";

  constructor(
    groups: readonly HTMLElement[],
    private readonly reducedMotion: boolean,
  ) {
    if (groups.length !== 2) throw new Error(`emblem stage needs 2 groups, got ${groups.length}`);
    this.groups = groups.map((element) => new EmblemGroup(element));
  }

  /** Emblema que se ve ahora (o que se está pintando). */
  get showing(): string {
    return this.current;
  }

  /** Pinta un emblema y desvanece el anterior. Pedir el mismo que ya se ve no hace nada. */
  show(id: string): void {
    if (id === this.current) return;
    this.current = id;
    const back = this.front;
    const next = 1 - this.front;
    this.front = next;
    window.clearTimeout(this.timers[next]);
    this.groups[next]!.element.classList.remove("is-leaving");
    this.groups[back]!.element.classList.add("is-leaving");
    // El grupo que se va se borra cuando ya es invisible, para dejarlo listo para el siguiente relevo.
    this.timers[back] = window.setTimeout(() => this.groups[back]!.clear(), FADE_MS);
    this.groups[next]!.paint(emblemFor(id), this.reducedMotion);
  }

  /** Vuelve a pintar completo el emblema visible a la resolución actual (tras cambiar el tamaño de la ventana). */
  refresh(): void {
    if (!this.current) return;
    this.groups[this.front]!.paint(emblemFor(this.current), true);
  }

  /** Detiene todo y borra los lienzos (al desmontar la vista). */
  dispose(): void {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.groups.forEach((group) => group.clear());
    this.current = "";
  }
}

/** Pinta un emblema en un solo grupo, sin relevo: lo usa cada página del paginador móvil. */
export class SingleEmblem {
  private readonly group: EmblemGroup;

  constructor(
    element: HTMLElement,
    private readonly id: string,
    private readonly reducedMotion: boolean,
  ) {
    this.group = new EmblemGroup(element);
  }

  /** Pinta (o repinta) el emblema desde cero. */
  paint(): void {
    this.group.paint(emblemFor(this.id), this.reducedMotion);
  }

  /** Borra los lienzos; se usa al salir de la página para que al volver se pinte de nuevo. */
  clear(): void {
    this.group.clear();
  }
}
