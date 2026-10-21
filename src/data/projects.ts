// Fuente única de los proyectos del portafolio.
// La usan la portada (lista y emblemas de tinta) y la barra de navegación que se inyecta en cada demo.
// El diseño pide lo mínimo: nombre, su concepto en pocas palabras, sus tecnologías y sus enlaces.

/** Idiomas que tiene el sitio. Español es el principal. */
export type Lang = "es" | "en";

/** Todo lo que el portafolio muestra de un proyecto. */
export interface Project {
  /** Identificador estable: es la ruta de su demo, el nombre de su emblema y el de su repositorio. */
  slug: string;
  /** Nombre del proyecto. */
  name: string;
  /** Ruta de la demo estática dentro del dominio. */
  demoPath: string;
  /** Ruta de la documentación, si el proyecto la tiene. */
  docsPath: string | null;
  /** Qué es, en dos a cuatro palabras: va en cursiva bajo el nombre. */
  concept: Localized;
  /** Tecnologías con que está hecho, de cuatro a ocho, de la más a la menos definitoria. */
  tags: readonly string[];
}

/** Texto con su versión en cada idioma del sitio. */
export type Localized = Record<Lang, string>;

/** Los cinco proyectos, en el orden en que aparecen. */
export const projects: readonly Project[] = [
  {
    slug: "thepredict",
    name: "ThePredict",
    demoPath: "/thepredict/",
    docsPath: "/thepredict/docs/",
    concept: { es: "IA predictiva", en: "Predictive AI" },
    tags: ["Java", "Paper", "MythicMobs", "Gradle", "TypeSafe"],
  },
  {
    slug: "seshat",
    name: "Seshat",
    demoPath: "/seshat/",
    docsPath: null,
    concept: { es: "Webapp de idiomas", en: "Language web app" },
    tags: ["Next.js", "React", "TypeScript", "Go", "Motion"],
  },
  {
    slug: "btb",
    name: "Be The Boss",
    demoPath: "/btb/",
    docsPath: null,
    concept: { es: "Estrenos de videojuegos", en: "Video game releases" },
    tags: ["Go", "Next.js", "React", "TypeScript", "Connect RPC", "Protobuf"],
  },
  {
    slug: "tsk",
    name: "The Story Keeper",
    demoPath: "/tsk/",
    docsPath: null,
    concept: { es: "Estrenos de cine y TV", en: "Film and TV premieres" },
    tags: ["Go", "Next.js", "React", "Connect RPC", "Protobuf", "SQLite", "D3"],
  },
  {
    slug: "thevoidfiles",
    name: "The Void Files",
    demoPath: "/thevoidfiles/",
    docsPath: null,
    concept: { es: "TTRPG con IA generativa", en: "Generative AI TTRPG" },
    tags: ["Python", "FastAPI", "SQLite", "React", "Vite", "GSAP", "ElevenLabs"],
  },
];
