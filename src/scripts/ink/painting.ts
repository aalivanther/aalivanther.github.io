// La pintura de la portada como un panel de profundidad, al estilo de una foto 3D.
//
// - Obra real de dominio público (Wang Guxiang, 1546) separada en cinco planos: aguadas, ramitas, ramas, tronco
//   y flores rojas, del más lejano al más cercano. Cada plano se desplaza distinto con el puntero (o con la inclinación del
//   teléfono) y, en reposo, deriva muy despacio: la pintura se siente viva y con volumen.
// - Los proyectos flotan encima, en el plano más cercano, anclados a racimos reales de flores.
// - Al elegir un proyecto, sobre la misma imagen se remarca su rama real: la tinta la recorre desde la base del
//   tronco hasta el racimo, que se enciende, mientras el resto de la pintura se aclara y se desenfoca.
// - La pintura crece al cargar siguiendo la tinta (mapa de crecimiento) y se disuelve en el papel con una máscara
//   orgánica, más hacia el lado del papel libre.
// - Sin WebGL se muestra la imagen quieta y todo lo demás funciona igual.

import { plumPainting, type PaintingVariant } from "../../data/painting";

/** Duración del crecimiento de la pintura al cargar, en milisegundos. */
const REVEAL_MS = 3200;
/** Duración del trazo que remarca la rama al elegir un proyecto, en milisegundos. */
const TRACE_MS = 1100;
/** Desplazamiento máximo de la capa media con el puntero, en fracción de la pintura. */
const PARALLAX = 0.026;
/**
 * Profundidad compartida: el bucle publica el desplazamiento de la capa media en píxeles como --sx y --sy sobre
 * la portada; todo lo que flota (proyectos, emblemas, manchas, iconos) se mueve con calc(var(--sx) × su --d).
 */
const DEPTH_HOST = "[data-stage]";
/** Deriva en reposo: fracción del parallax máximo y periodo, en segundos. */
const DRIFT_AMOUNT = 0.3;
const DRIFT_PERIOD = 14;

/** Sombreadores: un rectángulo que cubre el lienzo, y la pintura compuesta por planos. */
const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uWash;
uniform sampler2D uTwig;
uniform sampler2D uBranch;
uniform sampler2D uTrunk;
uniform sampler2D uBloom;
uniform sampler2D uMaps;
uniform sampler2D uPath;
uniform vec4 uChannel;
uniform float uTime;
uniform float uFocus;
uniform float uTrace;
uniform float uReach;
uniform vec2 uShift;
uniform vec2 uTexel;
uniform vec2 uFade;
in vec2 vUv;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Lectura suave: con foco, la capa se desenfoca (promedio de cinco muestras separadas).
vec3 soft(sampler2D layer, vec2 uv, float amount) {
  vec2 d = uTexel * amount;
  vec3 c = texture(layer, uv).rgb * 0.4;
  c += texture(layer, uv + vec2(d.x, 0.0)).rgb * 0.15;
  c += texture(layer, uv - vec2(d.x, 0.0)).rgb * 0.15;
  c += texture(layer, uv + vec2(0.0, d.y)).rgb * 0.15;
  c += texture(layer, uv - vec2(0.0, d.y)).rgb * 0.15;
  return c;
}
void main() {
  // Cinco planos a distinta profundidad: cuanto más cerca, más se desplaza y algo más grande se ve.
  vec2 c = vUv - 0.5;
  vec2 uvWash = c * 1.0 + 0.5 + uShift * 0.25;
  vec2 uvTwig = c * 0.995 + 0.5 + uShift * 0.6;
  vec2 uvMid = c * 0.99 + 0.5 + uShift;
  vec2 uvTrunk = c * 0.985 + 0.5 + uShift * 1.35;
  vec2 uvBloom = c * 0.978 + 0.5 + uShift * 1.65;
  // Rama elegida: su intensidad en este punto (el canal de su imagen) y hasta dónde ha llegado el trazo.
  float growth = texture(uMaps, uvMid).r;
  float reached = smoothstep(growth - 0.04, growth, uTrace * (uReach + 0.06));
  float traced = dot(texture(uPath, uvMid), uChannel) * reached;
  // Resplandor: la rama elegida brilla un poco hacia fuera (muestras alrededor).
  float glow = 0.0;
  for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472;
    glow += dot(texture(uPath, uvMid + vec2(cos(a), sin(a)) * uTexel * 9.0), uChannel);
  }
  glow = clamp(glow / 6.0, 0.0, 1.0) * reached;
  // Pintura: lo que no es la rama elegida se aclara y se desenfoca con el foco.
  float calm = uFocus * (1.0 - traced);
  vec3 wash = mix(soft(uWash, uvWash, 8.0 * calm), vec3(1.0), 0.7 * calm);
  vec3 twig = mix(soft(uTwig, uvTwig, 6.0 * calm), vec3(1.0), 0.6 * calm);
  vec3 branch = mix(soft(uBranch, uvMid, 5.0 * calm), vec3(1.0), 0.52 * calm);
  vec3 trunk = mix(soft(uTrunk, uvTrunk, 4.0 * calm), vec3(1.0), 0.45 * calm);
  vec3 bloom = mix(texture(uBloom, uvBloom).rgb, vec3(1.0), 0.45 * calm);
  // La rama elegida, remarcada encima de la pintura: la tinta se carga como un segundo pase de pincel (más
  // oscura y densa) y las flores se encienden. Solo se remarca la tinta, no la aguada de fondo (si no, la trama
  // de la seda se marcaría como rayas).
  vec3 strokes = twig * branch * trunk * bloom;
  // Cualquier tinta del camino, aunque sea una ramita clara, pasa a sepia oscuro; lo más denso, casi negro.
  float ink = 1.0 - min(strokes.r, min(strokes.g, strokes.b));
  vec3 inked = mix(strokes, vec3(0.2, 0.17, 0.15) * (1.0 - 0.4 * smoothstep(0.4, 0.8, ink)), smoothstep(0.03, 0.22, ink));
  float isRed = smoothstep(0.08, 0.22, strokes.r - strokes.g);
  inked = mix(inked, vec3(0.86, 0.2, 0.26) * pow(strokes.r, 1.5), isRed);
  vec3 art = wash * mix(strokes, inked, traced * uFocus);
  art *= mix(vec3(1.0), vec3(1.0, 0.86, 0.84), glow * (1.0 - traced) * uFocus * 0.8);
  // Crecimiento al cargar, con borde irregular y frente húmedo.
  vec4 maps = texture(uMaps, vUv);
  float edge = maps.r + (hash(floor(vUv * vec2(900.0, 940.0))) - 0.5) * 0.035;
  float visible = smoothstep(edge - 0.03, edge + 0.005, uTime);
  float wet = (1.0 - smoothstep(0.0, 0.05, uTime - edge)) * visible;
  // Máscara orgánica, y un desvanecido extra hacia el papel libre (derecha en escritorio, abajo en el teléfono).
  float fade = smoothstep(1.0, 1.0 - uFade.x, vUv.x) * smoothstep(1.0, 1.0 - uFade.y, vUv.y);
  float mask = maps.g * fade;
  outColor = vec4(mix(vec3(1.0), art * (1.0 - 0.12 * wet), visible * mask), 1.0);
}`;

/** Carga una imagen y resuelve cuando ya se puede usar como textura. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`cannot load ${src}`));
    image.src = src;
  });
}

/** Curva suave de 0 a 1. */
function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Estado que se dibuja en cada cuadro. */
interface PaintState {
  time: number;
  focus: number;
  trace: number;
  shift: [number, number];
}

/** Dibuja la pintura por planos con WebGL; si algo falla, deja que se vea la imagen quieta. */
class PaintingCanvas {
  private gl: WebGL2RenderingContext | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private pathTextures: WebGLTexture[] = [];
  private state: PaintState = { time: 0, focus: 0, trace: 0, shift: [0, 0] };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly fade: [number, number],
  ) {}

  /** Prepara WebGL con los planos, los mapas y los caminos. Devuelve false si el navegador no puede. */
  async init(variant: PaintingVariant): Promise<boolean> {
    const gl = this.canvas.getContext("webgl2", { premultipliedAlpha: false, antialias: false });
    if (!gl) return false;
    const l = variant.layers;
    const [wash, twig, branch, trunk, bloom, maps, ...paths] = await Promise.all([l.wash, l.twig, l.branch, l.trunk, l.bloom, variant.maps, ...variant.paths].map(loadImage));
    if (!wash || !twig || !branch || !trunk || !bloom || !maps) return false;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("cannot create shader");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`shader error: ${gl.getShaderInfoLog(shader) ?? ""}`);
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`program error: ${gl.getProgramInfoLog(program) ?? ""}`);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    /** Sube una imagen como textura en la unidad indicada, con filtrado suave. */
    const upload = (unit: number, image: HTMLImageElement, mipmaps: boolean): WebGLTexture => {
      const handle = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, handle);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (mipmaps) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      return handle;
    };
    upload(0, wash, true);
    upload(1, twig, true);
    upload(2, branch, true);
    upload(3, trunk, true);
    upload(4, bloom, true);
    upload(5, maps, false);
    // Cada imagen de caminos queda en su unidad (7, 8, 9…); la de la rama elegida se enlaza en la 6.
    this.pathTextures = paths.map((image, i) => upload(7 + i, image, false));
    const units: ReadonlyArray<readonly [string, number]> = [
      ["uWash", 0],
      ["uTwig", 1],
      ["uBranch", 2],
      ["uTrunk", 3],
      ["uBloom", 4],
      ["uMaps", 5],
      ["uPath", 6],
    ];
    for (const [name, unit] of units) gl.uniform1i(gl.getUniformLocation(program, name), unit);
    for (const name of ["uTime", "uFocus", "uTrace", "uReach", "uShift", "uChannel", "uTexel", "uFade"]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.uniform2f(this.uniforms["uTexel"] ?? null, 1 / wash.naturalWidth, 1 / wash.naturalHeight);
    gl.uniform2f(this.uniforms["uFade"] ?? null, this.fade[0], this.fade[1]);
    gl.uniform4f(this.uniforms["uChannel"] ?? null, 0, 0, 0, 0);
    this.gl = gl;
    return true;
  }

  /** Elige qué rama se remarca: su imagen de caminos y su canal; un hueco sin camino apaga el remarcado. */
  selectPath(slot: number, reach: number): void {
    const gl = this.gl;
    if (!gl) return;
    const texture = this.pathTextures[Math.floor(slot / 3)];
    if (slot < 0 || !texture) {
      gl.uniform4f(this.uniforms["uChannel"] ?? null, 0, 0, 0, 0);
      return;
    }
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const channel = slot % 3;
    gl.uniform4f(this.uniforms["uChannel"] ?? null, channel === 0 ? 1 : 0, channel === 1 ? 1 : 0, channel === 2 ? 1 : 0, 0);
    gl.uniform1f(this.uniforms["uReach"] ?? null, reach);
  }

  /** Ajusta el lienzo a su tamaño en pantalla y vuelve a dibujar. */
  resize(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(this.canvas.clientWidth * ratio);
    const height = Math.round(this.canvas.clientHeight * ratio);
    if (width && height && (this.canvas.width !== width || this.canvas.height !== height)) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.render();
  }

  /** Cambia parte del estado y vuelve a dibujar. */
  draw(change: Partial<PaintState>): void {
    Object.assign(this.state, change);
    this.render();
  }

  /** Dibuja un cuadro con el estado actual. */
  private render(): void {
    const gl = this.gl;
    if (!gl) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms["uTime"] ?? null, this.state.time);
    gl.uniform1f(this.uniforms["uFocus"] ?? null, this.state.focus);
    gl.uniform1f(this.uniforms["uTrace"] ?? null, this.state.trace);
    gl.uniform2f(this.uniforms["uShift"] ?? null, this.state.shift[0], this.state.shift[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

/** La pintura con los proyectos flotando encima; interfaz que usan las vistas: grow, bloom, dispose. */
export class InkTree {
  private readonly variant: PaintingVariant = plumPainting;
  private readonly frame: HTMLElement;
  private readonly painting: PaintingCanvas | null;
  private readonly labels: HTMLElement[];
  private readonly depthHost: HTMLElement | null;
  private ready: Promise<boolean> | null = null;
  private grown = false;
  private selected = -1;
  private frameId = 0;
  private motionId = 0;
  // Profundidad: desplazamiento actual y entrada del usuario; foco y trazo del remarcado.
  private shift: [number, number] = [0, 0];
  private input: [number, number] = [0, 0];
  private lastInput = -Infinity;
  private focus = 0;
  private focusTarget = 0;
  private trace = 1;
  private traceStart = 0;
  private running = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly reducedMotion: boolean,
  ) {
    const frame = root.querySelector<HTMLElement>("[data-painting-frame]");
    if (!frame) throw new Error("painting needs its frame");
    this.frame = frame;
    const tall = root.dataset.variant === "tall";
    const gl = frame.querySelector<HTMLCanvasElement>("[data-painting-gl]");
    // En escritorio la pintura se disuelve hacia la derecha; en el teléfono, hacia abajo.
    this.painting = gl ? new PaintingCanvas(gl, tall ? [0, 0.3] : [0.36, 0]) : null;
    this.labels = Array.from(root.querySelectorAll<HTMLElement>("[data-branch]"));
    this.depthHost = root.closest<HTMLElement>(DEPTH_HOST);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    window.addEventListener("deviceorientation", this.onTilt);
    document.addEventListener("visibilitychange", this.onVisibility);
    // Fuera de pantalla (en el teléfono, al pasar a la página de un proyecto) el bucle se pausa.
    this.observer = new IntersectionObserver(([entry]) => {
      this.onScreen = Boolean(entry?.isIntersecting);
      if (!this.onScreen) this.stop();
      else if (!document.hidden && this.root.hasAttribute("data-tree-painted")) this.start();
    });
    this.observer.observe(this.frame);
  }

  private readonly observer: IntersectionObserver;
  private onScreen = true;

  /** El puntero inclina la escena: cada plano se desplaza según su profundidad. */
  private readonly onPointer = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") return;
    this.input = [event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5];
    this.lastInput = performance.now();
  };

  /** En el teléfono, la inclinación del aparato hace lo mismo que el puntero (si el navegador la ofrece). */
  private readonly onTilt = (event: DeviceOrientationEvent): void => {
    if (event.gamma === null || event.beta === null) return;
    this.input = [Math.max(-0.5, Math.min(0.5, event.gamma / 50)), Math.max(-0.5, Math.min(0.5, (event.beta - 45) / 60))];
    this.lastInput = performance.now();
  };

  /** Con la pestaña oculta no se anima nada. */
  private readonly onVisibility = (): void => {
    if (document.hidden) this.stop();
    else if (this.onScreen && this.root.hasAttribute("data-tree-painted")) this.start();
  };

  /** Coloca los proyectos y, la primera vez, hace crecer la pintura. Después solo recoloca. */
  grow(instant = this.reducedMotion): void {
    this.layout();
    this.root.setAttribute("data-tree-ready", "");
    if (this.grown) {
      this.painting?.resize();
      return;
    }
    this.grown = true;
    this.ready ??= (this.painting?.init(this.variant) ?? Promise.resolve(false)).catch((error: unknown) => {
      console.error(`painting disabled: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    });
    void this.ready.then((ok) => {
      this.root.toggleAttribute("data-gl", ok);
      this.painting?.resize();
      if (!ok || instant) {
        this.painting?.draw({ time: 1.05 });
        this.finish();
        return;
      }
      const started = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / REVEAL_MS);
        this.painting?.draw({ time: -0.02 + ease(t) * 1.07 });
        if (t < 1) this.frameId = requestAnimationFrame(tick);
        else this.finish();
      };
      this.frameId = requestAnimationFrame(tick);
    });
  }

  /** Remarca la rama del proyecto `index` (0 = Akyrion: ninguna) y aclara el resto de la pintura. */
  bloom(index: number, instant = this.reducedMotion): void {
    if (index === this.selected) return;
    this.selected = index;
    const slot = index - 1;
    const anchor = this.variant.anchors[slot];
    this.focusTarget = anchor ? 1 : 0;
    this.labels.forEach((label, i) => label.toggleAttribute("data-lit", i === index));
    if (anchor) {
      this.painting?.selectPath(slot, anchor.reach);
      this.trace = instant ? 1 : 0;
      this.traceStart = performance.now();
    }
    if (instant || !this.running) {
      this.focus = this.focusTarget;
      this.trace = 1;
      this.painting?.draw({ focus: this.focus, trace: this.trace });
    }
  }

  /** Detiene todo y retira los escuchas (al desmontar la vista). */
  dispose(): void {
    cancelAnimationFrame(this.frameId);
    this.stop();
    window.removeEventListener("pointermove", this.onPointer);
    window.removeEventListener("deviceorientation", this.onTilt);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.observer.disconnect();
    this.root.removeAttribute("data-tree-ready");
    this.root.removeAttribute("data-tree-painted");
    this.grown = false;
  }

  /** Termina el crecimiento: muestra los proyectos y arranca el bucle de profundidad. */
  private finish(): void {
    this.root.setAttribute("data-tree-painted", "");
    this.start();
    if (this.selected > 0) {
      const index = this.selected;
      this.selected = -1;
      this.bloom(index);
    }
  }

  /** Arranca el bucle de profundidad (con movimiento reducido no hay bucle: todo queda quieto). */
  private start(): void {
    if (this.running || this.reducedMotion || !this.onScreen) return;
    this.running = true;
    let last = performance.now();
    const step = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Sin puntero ni inclinación reciente, la escena deriva despacio en un óvalo.
      const idle = now - this.lastInput > 2500;
      const phase = (now / 1000 / DRIFT_PERIOD) * Math.PI * 2;
      const target: [number, number] = idle ? [Math.sin(phase) * DRIFT_AMOUNT * 0.5, Math.cos(phase * 0.7) * DRIFT_AMOUNT * 0.35] : this.input;
      const k = 1 - Math.exp(-dt * (idle ? 1.2 : 4));
      this.shift = [this.shift[0] + (-target[0] * PARALLAX - this.shift[0]) * k, this.shift[1] + (-target[1] * PARALLAX - this.shift[1]) * k];
      this.focus += (this.focusTarget - this.focus) * (1 - Math.exp(-dt * 4));
      if (this.trace < 1) this.trace = ease(Math.min(1, (now - this.traceStart) / TRACE_MS));
      this.painting?.draw({ shift: this.shift, focus: this.focus, trace: this.trace });
      // Profundidad compartida para todo lo que flota sobre el papel.
      if (this.depthHost) {
        this.depthHost.style.setProperty("--sx", `${(-this.shift[0] * this.frame.clientWidth).toFixed(2)}px`);
        this.depthHost.style.setProperty("--sy", `${(-this.shift[1] * this.frame.clientHeight).toFixed(2)}px`);
      }
      this.motionId = requestAnimationFrame(step);
    };
    this.motionId = requestAnimationFrame(step);
  }

  /** Detiene el bucle de profundidad. */
  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.motionId);
  }

  /**
   * Coloca cada proyecto sobre su racimo de la pintura: un punto en el racimo y el nombre al lado, hacia dentro de
   * la pintura para que nunca se salga. La copa (Akyrion) va arriba a la izquierda.
   */
  private layout(): void {
    const rootBox = this.root.getBoundingClientRect();
    const frameBox = this.frame.getBoundingClientRect();
    if (rootBox.width === 0 || frameBox.width === 0) return;
    const left = frameBox.left - rootBox.left;
    const top = frameBox.top - rootBox.top;
    const [crown, ...projects] = this.labels;
    if (crown) {
      crown.style.left = `${Math.max(12, left + frameBox.width * 0.05)}px`;
      crown.style.top = `${Math.max(0, top + frameBox.height * 0.03)}px`;
    }
    projects.forEach((label, i) => {
      const anchor = this.variant.anchors[i];
      // Un proyecto sin racimo libre se coloca al pie de la pintura, sin romper nada.
      const [ax, ay] = anchor ? anchor.at : [0.1 + (i % 4) * 0.2, 0.96];
      const x = left + ax * frameBox.width;
      const width = (label.querySelector<HTMLElement>(".label")?.offsetWidth ?? 0) + 20;
      const towardLeft = ax >= 0.55 ? x - width >= 8 : x + width > rootBox.width - 8;
      label.toggleAttribute("data-left", towardLeft);
      label.style.left = `${x}px`;
      label.style.top = `${top + ay * frameBox.height}px`;
    });
  }
}
