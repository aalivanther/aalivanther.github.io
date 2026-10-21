// Vista de escritorio: el árbol a la izquierda (Akyrion en la copa y una rama por proyecto) y un solo
// escenario de emblema a la derecha. Pasar el puntero o enfocar elige y hace florecer la rama; las flechas
// y la rueda recorren; Esc vuelve a Akyrion; el clic en un nombre, en su icono de demo o en el emblema
// entra con la gota de tinta.

import { EmblemStage } from "./stage";
import { InkTree } from "./painting";
import { Atmosphere } from "./atmosphere";
import { InkDrop, centerOf, wantsNewTab } from "./drop";

/** Pausa mínima entre dos cambios con la rueda, para que un gesto no salte varios elementos. */
const WHEEL_COOLDOWN_MS = 650;

/** Monta la vista de escritorio y devuelve la función que la desmonta. */
export function mountDesktop(root: HTMLElement, drop: InkDrop, reducedMotion: boolean): () => void {
  // Todo se busca dentro de la vista de escritorio: el móvil tiene sus propias tiras con los mismos atributos.
  const view = root.querySelector<HTMLElement>("[data-desktop]");
  if (!view) return () => {};
  const groups = Array.from(view.querySelectorAll<HTMLElement>("[data-ink-group]"));
  const captions = Array.from(view.querySelectorAll<HTMLElement>("[data-caption]"));
  const art = view.querySelector<HTMLElement>("[data-art]");
  const items = Array.from(view.querySelectorAll<HTMLElement>("[data-entry]"));
  if (!art || items.length === 0) return () => {};
  const stage = new EmblemStage(groups, reducedMotion);
  const treeRoot = view.querySelector<HTMLElement>("[data-tree]");
  const tree = treeRoot ? new InkTree(treeRoot, reducedMotion) : null;
  const atmosphereRoot = view.querySelector<HTMLElement>("[data-atmosphere]");
  const atmosphere = atmosphereRoot ? new Atmosphere(atmosphereRoot, reducedMotion) : null;
  // El primer elemento es Akyrion (la portada); los demás, los proyectos con su demo.
  const titles = items.map((item) => item.querySelector<HTMLAnchorElement>("[data-title]"));
  let selected = 0;
  const cleanups: Array<() => void> = [];

  /** Registra un escucha y guarda cómo quitarlo al desmontar. */
  const listen = <K extends keyof HTMLElementEventMap>(target: HTMLElement | Document | Window, type: K, handler: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) => {
    target.addEventListener(type, handler as EventListener, options);
    cleanups.push(() => target.removeEventListener(type, handler as EventListener, options));
  };

  /** Elige un elemento de la lista y pinta su emblema. */
  const select = (index: number): void => {
    if (drop.leaving) return;
    selected = index;
    items.forEach((item, i) => item.toggleAttribute("data-active", i === index));
    root.toggleAttribute("data-project", index > 0);
    const emblem = items[index]?.dataset.emblem ?? "akyrion";
    stage.show(emblem);
    captions.forEach((caption) => caption.toggleAttribute("data-active", caption.dataset.caption === emblem));
    tree?.bloom(index);
  };

  /** Pasa al elemento anterior o siguiente, con vuelta en los extremos. */
  const step = (direction: 1 | -1): void => {
    select((selected + direction + items.length) % items.length);
    titles[selected]?.focus({ preventScroll: true });
  };

  items.forEach((item, i) => {
    listen(item, "pointerenter", (event) => {
      if (event.pointerType === "mouse") select(i);
    });
    listen(item, "focusin", () => select(i));
    // Los proyectos entran a su demo con la gota; Akyrion es un enlace normal a la portada.
    if (i === 0) return;
    const title = titles[i];
    if (title) {
      listen(title, "click", (event) => {
        if (wantsNewTab(event)) return;
        event.preventDefault();
        drop.go(title.href, ...centerOf(title));
      });
    }
    const enter = item.querySelector<HTMLAnchorElement>("[data-enter]");
    if (enter) {
      listen(enter, "click", (event) => {
        if (wantsNewTab(event)) return;
        event.preventDefault();
        drop.go(enter.href, ...centerOf(enter));
      });
    }
  });

  // Clic en el emblema de un proyecto: entra desde el punto del clic.
  listen(art, "click", (event) => {
    const href = selected > 0 ? titles[selected]?.href : undefined;
    if (href) drop.go(href, event.clientX, event.clientY);
  });

  listen(document, "keydown", (event) => {
    if (document.querySelector("dialog[open]")) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Escape") {
      (document.activeElement as HTMLElement | null)?.blur();
      select(0);
    }
  });

  let lastWheel = 0;
  listen(
    window,
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) < 8) return;
      const now = performance.now();
      if (now - lastWheel < WHEEL_COOLDOWN_MS) return;
      lastWheel = now;
      step(event.deltaY > 0 ? 1 : -1);
    },
    { passive: true },
  );

  let resizeTimer = 0;
  listen(window, "resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      stage.refresh();
      tree?.grow(true);
      atmosphere?.paint(true);
    }, 150);
  });

  // El árbol se mide con la tipografía real: se pinta cuando las fuentes ya cargaron.
  let disposed = false;
  void document.fonts.ready.then(() => {
    if (disposed) return;
    tree?.grow();
    atmosphere?.paint();
  });
  select(0);
  return () => {
    disposed = true;
    window.clearTimeout(resizeTimer);
    cleanups.forEach((cleanup) => cleanup());
    stage.dispose();
    tree?.dispose();
    atmosphere?.dispose();
  };
}
