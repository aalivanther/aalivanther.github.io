// Vista móvil: un elemento por pantalla, con desplazamiento horizontal que encaja página a página
// (scroll-snap nativo). La primera página es el árbol: tocar una rama lleva a la página de su proyecto.
// Cada página de proyecto pinta su emblema al llegar y lo borra al irse, para que al volver se pinte otra vez.
// Los puntos de abajo indican y llevan a cada página.

import { SingleEmblem } from "./stage";
import { InkTree } from "./painting";
import { InkDrop, centerOf, wantsNewTab } from "./drop";

/** Fracción de la página que debe verse para considerarla «llegada». */
const VISIBLE_RATIO = 0.6;

/** Monta el paginador y devuelve la función que lo desmonta. */
export function mountPager(root: HTMLElement, drop: InkDrop, reducedMotion: boolean): () => void {
  const track = root.querySelector<HTMLElement>("[data-pager]");
  const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-slide]"));
  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-dot]"));
  if (!track || slides.length === 0) return () => {};
  const cleanups: Array<() => void> = [];

  // La página del árbol tiene su árbol; cada página de proyecto, su pintor de emblema.
  const treeRoot = root.querySelector<HTMLElement>("[data-pager] [data-tree]");
  const tree = treeRoot ? new InkTree(treeRoot, reducedMotion) : null;
  const painters = slides.map((slide) => {
    const group = slide.querySelector<HTMLElement>("[data-slide-ink]");
    return group ? new SingleEmblem(group, slide.dataset.emblem ?? "akyrion", reducedMotion) : null;
  });
  let active = -1;

  /** Lleva la pista a una página. */
  const goTo = (index: number): void => {
    slides[index]?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", inline: "start", block: "nearest" });
  };

  /** Marca una página como activa: pinta su emblema (o el árbol), borra el de la anterior y actualiza los puntos. */
  const activate = (index: number): void => {
    if (index === active) return;
    if (active >= 0) painters[active]?.clear();
    active = index;
    // El árbol se mide con la tipografía real: se pinta cuando las fuentes ya cargaron.
    if (slides[index]?.contains(treeRoot)) {
      void document.fonts.ready.then(() => {
        if (active === index) tree?.grow();
      });
    } else {
      painters[index]?.paint();
    }
    dots.forEach((dot, i) => dot.setAttribute("aria-current", i === index ? "true" : "false"));
  };

  // Tocar una rama del árbol lleva a la página de su proyecto.
  root.querySelectorAll<HTMLButtonElement>("[data-pager] [data-goto]").forEach((button) => {
    const handler = () => goTo(Number(button.dataset.goto));
    button.addEventListener("click", handler);
    cleanups.push(() => button.removeEventListener("click", handler));
  });

  // La página que entra en la vista se activa.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO) activate(slides.indexOf(entry.target as HTMLElement));
      }
    },
    { root: track, threshold: [VISIBLE_RATIO] },
  );
  slides.forEach((slide) => observer.observe(slide));
  cleanups.push(() => observer.disconnect());

  // Los puntos llevan a su página.
  dots.forEach((dot, i) => {
    const handler = () => goTo(i);
    dot.addEventListener("click", handler);
    cleanups.push(() => dot.removeEventListener("click", handler));
  });

  // En cada página de proyecto, tocar el emblema, el nombre o el icono de demo entra con la gota.
  slides.forEach((slide) => {
    const demo = slide.querySelector<HTMLAnchorElement>("[data-title]");
    if (!demo || slide.dataset.emblem === "akyrion") return;
    const enter = (event: MouseEvent, from: [number, number]) => {
      if (wantsNewTab(event)) return;
      event.preventDefault();
      drop.go(demo.href, ...from);
    };
    const onTitle = (event: MouseEvent) => enter(event, centerOf(demo));
    const onArt = (event: MouseEvent) => enter(event, [event.clientX, event.clientY]);
    demo.addEventListener("click", onTitle);
    const art = slide.querySelector<HTMLElement>("[data-slide-art]");
    art?.addEventListener("click", onArt);
    const icon = slide.querySelector<HTMLAnchorElement>("[data-enter]");
    const onIcon = (event: MouseEvent) => icon && enter(event, centerOf(icon));
    icon?.addEventListener("click", onIcon);
    cleanups.push(() => {
      demo.removeEventListener("click", onTitle);
      art?.removeEventListener("click", onArt);
      icon?.removeEventListener("click", onIcon);
    });
  });

  // Al cambiar el tamaño (girar el teléfono), el árbol se vuelve a medir y a pintar.
  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (slides[active]?.contains(treeRoot)) tree?.grow(true);
    }, 150);
  };
  window.addEventListener("resize", onResize);
  cleanups.push(() => {
    window.clearTimeout(resizeTimer);
    window.removeEventListener("resize", onResize);
  });

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    painters.forEach((painter) => painter?.clear());
    tree?.dispose();
  };
}
