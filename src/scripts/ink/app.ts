// Entrada de la portada de tinta: monta la vista de escritorio o el paginador móvil según el ancho,
// y cambia de una a otra si la ventana cruza el límite (girar el teléfono, redimensionar).
// Si el navegador no tiene lienzo 2D, la página sigue funcionando: todo son enlaces normales.

import { mountDesktop } from "./desktop";
import { mountPager } from "./pager";
import { InkDrop } from "./drop";

/**
 * Cuándo se usa el paginador (un elemento por pantalla): pantallas estrechas, verticales (tabletas en
 * vertical) o muy bajas (teléfonos en horizontal). Debe coincidir con DesktopView.astro y MobilePager.astro.
 */
const MOBILE_QUERY = "(max-width: 820px), (max-aspect-ratio: 4/5), (max-height: 500px)";

/** Arranca la portada. */
function start(): void {
  const root = document.querySelector<HTMLElement>("[data-stage]");
  if (!root) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const drop = new InkDrop(root.querySelector<SVGCircleElement>("[data-drop-circle]"), reducedMotion);
  const mobile = window.matchMedia(MOBILE_QUERY);
  let unmount: () => void = () => {};

  /** Desmonta la vista actual y monta la que toca para el ancho de ahora. */
  const mount = (): void => {
    unmount();
    // La vista que no corresponde queda inerte y oculta para lectores de pantalla: el teclado no recorre
    // enlaces invisibles y no hay contenido duplicado para la accesibilidad.
    const desktop = root.querySelector<HTMLElement>("[data-desktop]");
    const phone = root.querySelector<HTMLElement>("[data-mobile]");
    const hidden = mobile.matches ? desktop : phone;
    const shown = mobile.matches ? phone : desktop;
    hidden?.setAttribute("inert", "");
    hidden?.setAttribute("aria-hidden", "true");
    shown?.removeAttribute("inert");
    shown?.removeAttribute("aria-hidden");
    try {
      unmount = mobile.matches ? mountPager(root, drop, reducedMotion) : mountDesktop(root, drop, reducedMotion);
      root.setAttribute("data-ready", "");
    } catch (error) {
      // Sin lienzo 2D no hay emblemas, pero la navegación sigue: se avisa en consola para diagnosticarlo.
      console.error(`ink views disabled: ${error instanceof Error ? error.message : String(error)}`);
      unmount = () => {};
    }
  };

  mobile.addEventListener("change", mount);
  mount();
}

start();
