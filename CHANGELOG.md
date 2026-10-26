# Registro de cambios

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado propio: +1 para un cambio normal y +10 para una funcionalidad grande validada.

## [0.1.91] - 2026-10-26

### Cambiado
- Rendimiento en equipos modestos, sin cambios visibles. Medido con CPU 6× más lenta y 4G lento:
  - en reposo, el hilo principal pasa de 345 a 21 ms por segundo;
  - el primer pintado pasa de 2,0 a 0,6 s y la pintura completa, de 12,3 a 8,8 s;
  - el bloqueo total al cargar baja de 2,8 a 0,5 s en escritorio y de 0,37 a 0,04 s en el teléfono;
  - se descargan 1053 KB en lugar de 1702 KB;
  - los lienzos ocupan 85 MB en lugar de 229 MB en una pantalla de alta densidad.
- La profundidad (`--sx`/`--sy`) se publica en cada elemento con `data-depth`, registrada sin herencia. Antes se publicaba en la portada, y cada cuadro recalculaba el estilo de toda la página y forzaba un recálculo síncrono al leer el tamaño de la pintura.
- En reposo, la pintura solo se vuelve a dibujar cuando lo que más se mueve avanza medio píxel del dispositivo. Sin proyecto elegido usa un programa WebGL con 5 lecturas por píxel en lugar de 31; da el mismo resultado.
- El pincel solo compone, aplica el grano y difumina el rectángulo que cambió. Sus capas fuera de pantalla existen solo mientras pinta, y un lienzo borrado suelta su memoria.
- Las texturas de la pintura se decodifican fuera del hilo principal (`createImageBitmap`) y se piden al montar la vista. Ya subidas a la GPU, se sueltan. Al desmontar la vista se liberan los recursos WebGL.
- Fuente: solo los subconjuntos latinos de Yuji Syuku, y se precarga el latino. Antes el CSS de la fuente pesaba 123 KB y bloqueaba el primer pintado.
- Los mapas de la pintura y la seda pasan a WebP sin pérdida: los mismos píxeles en 198 KB en lugar de 479 KB. `tools/arbol.mjs` ya los genera así.
- La imagen quieta de la pintura (335 KB) solo se descarga si no hay WebGL o sin JavaScript.

### Corregido
- Con movimiento reducido, el emblema inicial y a veces la atmósfera salían sin la trama de la seda: se pintaban antes de que cargara. Ahora el pincel la espera.

## [0.1.90] - 2026-10-20

### Agregado
- En el árbol, cada proyecto lleva solo su concepto en cursiva bajo el nombre (por ejemplo, «IA predictiva»).
- Al elegir un proyecto, a la derecha:
  - sobre el emblema: sus tecnologías (de cuatro a ocho, tomadas del código de cada repositorio), en líneas equilibradas;
  - bajo el emblema: sus accesos (demo, código y docs). Siguen en el HTML junto a su proyecto, así el orden con el teclado no cambia.
- En el teléfono, la página de cada proyecto sigue el mismo orden: tecnologías, emblema, nombre, concepto y accesos. En horizontal, el emblema queda a la izquierda y los textos a la derecha.
- Línea de marca bajo «Akyrion»: «Laboratorio de software experimental e interactivo».
- Barra superior con el perfil de GitHub y un botón de contacto que abre el correo (la dirección no aparece entera en el HTML).
- Para compartir y buscadores:
  - imagen de 1200×630 por idioma (`tools/og.mjs`);
  - etiquetas Open Graph y Twitter completas;
  - datos estructurados JSON-LD (perfil y lista de proyectos);
  - `sitemap.xml`, enlazado desde `robots.txt`.

### Cambiado
- Inglés es el idioma principal: vive en la raíz y el español pasa a `/es/`. La antigua `/en/` redirige a la raíz.
- Un solo `h1` en la página. La vista que no se usa (escritorio o teléfono) queda `inert` y oculta a lectores de pantalla.
- La pintura deja de animarse cuando sale de la pantalla.
- `theme-color` toma el color del papel.

### Quitado
- Formulario de contacto con Pageclip y la variable `PAGECLIP_KEY`.

## [0.1.80] - 2026-10-20

### Cambiado
- Parallax más profundo:
  - la pintura pasa a cinco planos (aguadas, ramitas, ramas, tronco y flores rojas), con más separación y una escala ligeramente distinta por plano;
  - todo lo que flota usa una profundidad compartida (`--sx`/`--sy` con `data-depth` y `--d`).
- Atmósfera en el papel libre: aguadas lejanas, una pincelada seca, salpicaduras y pétalos sueltos, en tres profundidades.
- Emblemas en tres capas (aguada, tinta y acentos de color) que se separan con el parallax, conservando el orden de pintura.
- Iconos de acceso con aguada detrás del trazo: al pasar el puntero se separan y la aguada toma el rojo de las flores.
- El remarcado de rama:
  - lleva toda la tinta del camino a sepia oscuro, incluidas las ramitas claras, sin marcar la trama de la seda;
  - su alcance es el máximo del camino, así la rama se remarca entera.

## [0.1.70] - 2026-10-20

### Cambiado
- La pintura es un panel lateral de profundidad, como una foto 3D:
  - ocupa toda la altura y se disuelve hacia el papel libre (hacia abajo en el teléfono);
  - sus tres planos se desplazan con el puntero, con la inclinación del teléfono o, en reposo, con una deriva lenta.
- Los proyectos flotan encima de la pintura, en el plano más cercano, anclados a racimos reales de flores. Ya no hay rama pintada aparte.
- Al elegir un proyecto se remarca sobre la misma imagen su rama real, del tronco al racimo:
  - el camino lo calcula `tools/arbol.mjs` siguiendo la tinta;
  - la tinta la recorre con un segundo pase y las flores se encienden;
  - el resto se aclara y se desenfoca.
- Hay 9 racimos preparados: los proyectos nuevos toman el siguiente.

### Corregido
- La gota de tinta podía calcular un radio negativo en su primer cuadro.

## [0.1.60] - 2026-10-20

### Cambiado
- Pintura por capas con parallax:
  - fondo (aguadas y flores blancas), ramas y tronco, y flores rojas;
  - cada capa se mueve distinto con el puntero, y la rama, los nombres y las flores acompañan a la capa media.
- La pintura ya no es un recuadro: una máscara orgánica la deja solo donde hay tinta y la deshilacha en el papel con ruido. Alrededor del punto de donde sale la rama, se mantiene visible.
- Al elegir un proyecto:
  - la tinta recorre de nuevo la rama desde la pintura hasta su nudo, remarcando el camino;
  - la pintura se aclara y se difumina hacia el papel;
  - florece el nudo.
- Iconografía y emblemas:
  - tinta sepia gris como la de la pintura;
  - trazos más limpios (menos temblor y menos ruido en las cerdas);
  - textura de seda con la trama de la pintura (`public/art/silk.png`, generada por `tools/arbol.mjs`).

## [0.1.50] - 2026-10-20

### Cambiado
- Fuera las cajas de los proyectos.
  - De una rama de la pintura sale, pintada a pincel en el mismo gris de la pintura, una rama larga hacia el papel libre.
  - Cada proyecto nace de un nudo de esa rama, escrito directo sobre el papel, con sus iconos al lado.
- Los nudos se reparten según cuántos proyectos haya.
- Cada nombre busca el hueco libre más cercano: nunca toca la rama, otro nombre ni el borde.
- Composición con aire:
  - en escritorio, la pintura a la izquierda, el emblema arriba a la derecha y la rama con los proyectos abajo a la derecha;
  - en el teléfono, la pintura arriba (acotada por la altura) y la rama bajando por la izquierda con los nombres a su derecha.
- Un solo encuadre vertical de la pintura para las dos vistas.

### Corregido
- El lienzo de la rama no se redimensionaba antes de pintarse y la rama no se veía.

## [0.1.40] - 2026-10-20

### Cambiado
- El árbol generado por código se sustituye por una pintura real de dominio público: Wang Guxiang, «White and Red Plum Blossom» (1546), Minneapolis Institute of Art.
  - Crece en pantalla con WebGL desde la base del tronco siguiendo la tinta, con frente húmedo y borde irregular.
  - Mapa de crecimiento geodésico calculado por `tools/arbol.mjs`.
- Los proyectos cuelgan de las ramas como tiras de papel (tanzaku), con su hilo de tinta.
  - Se reparten sin encimarse.
  - Hay puntos de rama reservados para proyectos futuros.
- Al elegir un proyecto, brotan flores en su rama, del mismo rojo de la pintura (el rojo de ciruelo pasa a tomarse de ella).
- En móvil se usa un encuadre vertical de la misma pintura, con las tiras colgando debajo.

### Añadido
- `tools/arbol.mjs` prepara la pintura:
  - dos encuadres;
  - la seda llevada a blanco para fundirse con el papel;
  - bordes difuminados;
  - mapas de crecimiento.
- Crédito de la obra en `LICENSE`.

### Corregido
- Un `transform` en el marco de la pintura aislaba el `mix-blend-mode` y dejaba un rectángulo blanco sobre el papel.

## [0.1.30] - 2026-10-20

### Añadido
- Árbol de tinta: un ciruelo pintado a pincel.
  - El tronco es nudoso: aguada seca, contornos en tramos rotos, nudos y musgo.
  - «Akyrion» va en la copa y cada proyecto es una rama principal con su nombre y sus iconos encima.
  - Después del nombre, la rama se ramifica y florece.
  - Se genera a partir de la lista de proyectos: uno nuevo agrega su rama solo, y el árbol se pinta siempre en unos 2,8 s.
- Floración al elegir una rama, en el escritorio.
- En móvil, el árbol es la primera página: tocar una rama lleva a su proyecto.
- Flor de ciruelo como marca del motor de pincel (halo, pétalos desiguales, centro y estambres) y color rojo de ciruelo.
- Acentos en rojo de ciruelo en los emblemas:
  - el visor del Augur;
  - el anillo de Seshat;
  - los botones de Be The Boss;
  - el hito de The Story Keeper;
  - el núcleo de The Void Files;
  - una ramita en flor en la «A» de Akyrion.

### Cambiado
- El motor de pincel pinta en lienzos de cualquier proporción y sigue una línea de tiempo: ya no pierde un cuadro entre marcas.
- Un proyecto sin emblema propio usa el de Akyrion en lugar de fallar.
- Pie de página: «© 2026 Adrian / Akyrion · MIT».
- Licencia MIT.

## [0.1.20] - 2026-10-20

### Añadido
- Emblema propio de Akyrion: una «A» de tres trazos. Encabeza la lista como el nombre del sitio y se pinta al cargar.
- Paginador móvil con un elemento por pantalla: encaje nativo, puntos de navegación y emblema que se pinta al llegar a cada página.
- Variación por pintura: el arranque y el final de cada trazo cambian ligeramente de posición, presión, sequedad y grosor.
- Aguada tenue bajo cada emblema antes del primer trazo.
- Animación de selección:
  - el emblema anterior se disuelve en el papel (se expande, se difumina y se aclara);
  - el nuevo se asienta mientras se pinta;
  - una pincelada subraya el elemento activo.

### Cambiado
- Tinta más densa, como tinta china: negro más cerrado, menos grano que la aclare y más halo de difusión.
- Emblemas un 10 % más grandes y lienzo de escritorio más amplio (hasta el 84 % del alto), sin invadir la lista.
- Tipografía Yuji Syuku (letra de pincel) en lugar de Shippori Mincho.
- Código modular:
  - escenario, gota, vista de escritorio, paginador y entrada en módulos separados;
  - componentes Astro por pieza: vista de escritorio, paginador, accesos, firma, barra superior y filtros.
- Responsividad: el paginador también cubre tabletas en vertical y teléfonos en horizontal, y la portada ya no impone alto mínimo.

## [0.1.10] - 2026-10-20

### Cambiado
- Rediseño completo con la dirección de arte del dueño: hoja de papel washi, tinta sumi y un único color, el sello bermellón.
- Sustituye a la portada con capturas en tarjetas y, después, a la de partículas en WebGL; three.js sale de las dependencias.
- Mínimo texto: sin numeración ni descripciones.
- Accesos por icono a la demo, a GitHub (`aalivanther`) y a la documentación de ThePredict.
- Firma «Adrian / Akyrion» con «Todos los derechos reservados / All rights reserved».

### Añadido
- Motor de pincel propio en Canvas 2D:
  - curva Catmull-Rom centrípeta y modo de esquinas vivas;
  - presión con entrada, cuerpo y salida según la longitud del trazo;
  - 34 cerdas con carga de tinta y pincel seco;
  - grano de absorción del papel y halo de difusión.
- Emblemas pintados en vivo:
  - la pincelada bajo el nombre;
  - el yelmo con cuernos de El Augur;
  - la estrella de siete puntas de Seshat;
  - el control de Be The Boss;
  - el hexágono con la línea de tiempo de The Story Keeper;
  - el ensō con el punto bermellón de The Void Files.
- Relevo entre dos lienzos: el emblema anterior se absorbe en el papel mientras se pinta el nuevo.
- Entrada a una demo con una gota de tinta de borde orgánico que cubre la pantalla.
- La barra de navegación de las demos, la 404, el sello y el favicon, en el mismo estilo.
- El verificador comprueba que cada emblema quede pintado, los enlaces de GitHub y la entrada con la gota.

## [0.1.0] - 2026-10-20

### Añadido
- Portafolio estático en Astro 7.3.5, en español (`/`) y en inglés (`/en/`), con `hreflang` y canónica.
- Portada con constelación animada en canvas: un nodo de color por proyecto. Se pausa fuera de pantalla y respeta `prefers-reduced-motion`.
- Tarjetas de los cinco proyectos con captura real de la demo, una línea, un dato de escala, stack y enlaces.
- Barra flotante `/dock.js` para navegar entre demos. Usa Shadow DOM y se monta en `<html>` después de `load` para no interferir con la hidratación de React.
- Formulario de contacto con Pageclip y campo trampa. Solo se publica si existe `PAGECLIP_KEY`.
- Herramientas: servidor de vista previa con las mismas rutas que producción, inyector idempotente de la barra, verificador en Chrome, capturas de portada y generador de `favicon.ico`.
- Página 404 bilingüe.
