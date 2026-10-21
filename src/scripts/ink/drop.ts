// Gota de tinta: al entrar a una demo, una mancha de borde orgánico se extiende desde el punto del clic
// hasta cubrir la pantalla, y entonces se navega. Con movimiento reducido se navega directo.

/** Cuánto tarda la gota en cubrir la pantalla, en milisegundos. */
const DROP_MS = 620;

/** Gota reutilizable: el SVG con su círculo y el filtro de borde vive en la portada. */
export class InkDrop {
  private busy = false;

  constructor(
    private readonly circle: SVGCircleElement | null,
    private readonly reducedMotion: boolean,
  ) {
    // Al volver con «atrás», el navegador puede restaurar la página con la gota puesta: se retira.
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      this.busy = false;
      this.circle?.setAttribute("r", "0");
    });
  }

  /** Deja caer la gota desde (x, y) y navega a `href` cuando cubre la pantalla. */
  go(href: string, x: number, y: number): void {
    if (this.busy) return;
    const circle = this.circle;
    if (this.reducedMotion || !circle) {
      window.location.assign(href);
      return;
    }
    this.busy = true;
    const maxRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) * 1.25;
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    const startedAt = performance.now();
    const grow = (now: number) => {
      // El primer cuadro puede llegar con una marca de tiempo anterior al inicio: se acota a 0.
      const t = Math.min(1, Math.max(0, (now - startedAt) / DROP_MS));
      // Cae lenta y luego se extiende de golpe, como tinta que encuentra el papel mojado.
      circle.setAttribute("r", String(maxRadius * t * t * t));
      if (t < 1) requestAnimationFrame(grow);
      else window.location.assign(href);
    };
    requestAnimationFrame(grow);
  }

  /** Indica si ya hay una salida en curso (para ignorar más gestos). */
  get leaving(): boolean {
    return this.busy;
  }
}

/** Centro de un elemento en pantalla: de ahí sale la gota cuando se entra con un enlace. */
export function centerOf(element: Element): [number, number] {
  const rect = element.getBoundingClientRect();
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}

/** Indica si un clic pide abrir en otra pestaña o ventana: se respeta, sin animación. */
export function wantsNewTab(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}
