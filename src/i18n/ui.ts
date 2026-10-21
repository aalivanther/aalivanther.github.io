// Textos de la interfaz en cada idioma. Casi todos son etiquetas para lectores de pantalla:
// en pantalla solo se ven los nombres de los proyectos, la firma y el selector de idioma.

import type { Lang } from "../data/projects";

/** Todas las cadenas del sitio, agrupadas por idioma. */
export const ui = {
  es: {
    metaTitle: "Akyrion — Portafolio",
    metaDescription: "Laboratorio de software experimental e interactivo de Adrian / Akyrion: cinco proyectos con demo en vivo y código abierto.",
    brandLine: "Laboratorio de software experimental e interactivo",
    profile: "Perfil de GitHub de Adrian / Akyrion",
    tagsLabel: "Tecnologías",
    projectsLabel: "Proyectos",
    demo: "Abrir la demo de",
    code: "Código de",
    docs: "Documentación de",
    rights: "MIT",
    contact: "Contacto",
    contactSubject: "Hola desde akyrion.tech",
    switchTo: "English",
    skip: "Saltar a los proyectos",
  },
  en: {
    metaTitle: "Akyrion — Portfolio",
    metaDescription: "Adrian / Akyrion's experimental, interactive software lab: five projects with live demos and open source code.",
    brandLine: "Experimental, interactive software lab",
    profile: "Adrian / Akyrion on GitHub",
    tagsLabel: "Technologies",
    projectsLabel: "Projects",
    demo: "Open the demo of",
    code: "Source code of",
    docs: "Documentation of",
    rights: "MIT",
    contact: "Contact",
    contactSubject: "Hello from akyrion.tech",
    switchTo: "Español",
    skip: "Skip to projects",
  },
} as const satisfies Record<Lang, Record<string, string>>;

/** Ruta de la página principal en cada idioma. */
export const homePath: Record<Lang, string> = { en: "/", es: "/es/" };

/** Devuelve el otro idioma, para el selector. */
export function otherLang(lang: Lang): Lang {
  return lang === "es" ? "en" : "es";
}
