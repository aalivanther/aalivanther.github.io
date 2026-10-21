// Configuración de Astro para el portafolio.
// El sitio es 100 % estático: Astro genera HTML en dist/ y no hay servidor en producción.
import { defineConfig } from "astro/config";

// URL pública del sitio, para las etiquetas canónicas y hreflang. SITE_URL permite cambiarla al compilar.
const site = process.env.SITE_URL ?? "https://akyrion.tech";

export default defineConfig({
  site,
  output: "static",
  // Inglés es el idioma principal y vive en la raíz; el español vive bajo /es/.
  i18n: {
    defaultLocale: "en",
    locales: ["es", "en"],
    routing: { prefixDefaultLocale: false },
  },
  // Sin telemetría ni barra de desarrollo: el sitio no debe hacer peticiones a terceros.
  devToolbar: { enabled: false },
  // El inglés vivió antes bajo /en/: esa ruta lleva a la raíz para no romper enlaces ya compartidos.
  redirects: { "/en": "/" },
  build: { format: "directory" },
});
