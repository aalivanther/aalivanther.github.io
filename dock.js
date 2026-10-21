/* Barra de navegación del portafolio de Akyrion. Generada en el build; no editar a mano. */
(function dock(config) {
	const TAG = "akyrion-dock";
	const STORAGE_KEY = "akyrion-dock-hidden";
	if (customElements.get(TAG)) return;
	/** Lee si el visitante ocultó la barra en esta sesión; sin almacenamiento disponible, se muestra. */
	const readHidden = () => {
		try {
			return sessionStorage.getItem(STORAGE_KEY) === "1";
		} catch {
			return false;
		}
	};
	/** Guarda la preferencia de ocultar; si el navegador bloquea el almacenamiento, solo dura hasta recargar. */
	const writeHidden = (value) => {
		try {
			sessionStorage.setItem(STORAGE_KEY, value ? "1" : "0");
		} catch {}
	};
	const lang = document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "es";
	const t = config.text[lang];
	const current = config.projects.filter((p) => location.pathname.startsWith(p.path)).sort((a, b) => b.path.length - a.path.length)[0];
	/** Elemento de la barra. */
	class Dock extends HTMLElement {
		connectedCallback() {
			const root = this.attachShadow({ mode: "open" });
			const mark = `<svg width="18" height="18" viewBox="0 0 100 100" aria-hidden="true"><rect x="6" y="6" width="88" height="88" rx="8" fill="#c43426" transform="rotate(-2.5 50 50)"/><text x="50" y="66" text-anchor="middle" font-family="Yuji Syuku, Georgia, serif" font-size="46" font-weight="600" fill="#f4f0e6">Ak</text></svg>`;
			const items = config.projects.map((p) => {
				const here = current?.slug === p.slug;
				return `<li><a href="${p.path}" ${here ? "aria-current=\"page\"" : ""}><i></i><span>${p.name}</span></a></li>`;
			}).join("");
			root.innerHTML = `
        <style>
          :host { all: initial; position: fixed; left: max(14px, env(safe-area-inset-left)); bottom: max(14px, env(safe-area-inset-bottom)); z-index: 2147483000; font: 500 14px/1.3 "Yuji Syuku", "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif; color: #0b0908; }
          :host([data-hidden]) .pill span { display: none; }
          :host([data-hidden]) .pill { padding: 0 10px; opacity: .6; }
          * { box-sizing: border-box; }
          button, a { font: inherit; color: inherit; }
          .pill { display: inline-flex; align-items: center; gap: 9px; height: 38px; padding: 0 14px 0 11px; border: 1px solid rgba(24,21,19,.16); border-radius: 3px; background: #f4f0e6; box-shadow: 0 6px 22px -10px rgba(24,21,19,.45); letter-spacing: .04em; cursor: pointer; transition: opacity .2s, border-color .2s, transform .2s; }
          .pill:hover { opacity: 1; border-color: rgba(24,21,19,.4); transform: translateY(-1px); }
          .panel { position: absolute; left: 0; bottom: 48px; width: 250px; padding: 8px; border: 1px solid rgba(24,21,19,.14); border-radius: 3px; background: #f4f0e6; box-shadow: 0 18px 48px -18px rgba(24,21,19,.5); transform-origin: bottom left; animation: in .22s cubic-bezier(.22,1,.36,1); }
          .panel[hidden] { display: none; }
          @keyframes in { from { opacity: 0; transform: translateY(6px); } }
          ul { margin: 0; padding: 0; list-style: none; }
          a { display: flex; align-items: center; gap: 12px; min-height: 38px; padding: 0 12px; text-decoration: none; letter-spacing: .03em; color: #6b655c; }
          a:hover, a:focus-visible { color: #181513; background: rgba(24,21,19,.05); }
          a[aria-current="page"] { color: #181513; }
          a i { width: 6px; height: 6px; border-radius: 50%; background: #181513; opacity: .35; flex: none; }
          a[aria-current="page"] i { background: #c43426; opacity: 1; }
          a span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .home { color: #181513; }
          hr { margin: 6px 4px; border: 0; border-top: 1px solid rgba(24,21,19,.12); }
          .hide { width: 100%; margin-top: 4px; min-height: 32px; border: 0; background: none; color: #6b655c; font-size: 12px; text-align: left; padding: 0 12px; cursor: pointer; }
          .hide:hover, .hide:focus-visible { color: #181513; background: rgba(24,21,19,.05); }
          :focus-visible { outline: 1.5px solid #181513; outline-offset: 2px; }
          @media (prefers-reduced-motion: reduce) { .panel { animation: none; } .pill { transition: none; } }
          @media print { :host { display: none; } }
        </style>
        <div class="panel" id="p" role="dialog" aria-label="${config.owner}" hidden>
          <ul>
            <li><a class="home" href="${config.home[lang]}">${mark}<span>${t.home}</span></a></li>
          </ul>
          <hr>
          <ul>${items}</ul>
          <button class="hide" type="button" data-hide>${t.hide}</button>
        </div>
        <button class="pill" type="button" aria-expanded="false" aria-controls="p" aria-label="${t.open}">
          ${mark}<span>${config.owner}</span>
        </button>`;
			const pill = root.querySelector(".pill");
			const panel = root.querySelector(".panel");
			const hide = root.querySelector("[data-hide]");
			if (!pill || !panel || !hide) return;
			if (readHidden()) this.setAttribute("data-hidden", "");
			/** Abre o cierra el panel y sincroniza el estado accesible del botón. */
			const setOpen = (open, restoreFocus = false) => {
				panel.hidden = !open;
				pill.setAttribute("aria-expanded", String(open));
				if (open) {
					this.removeAttribute("data-hidden");
					writeHidden(false);
					panel.querySelector("a")?.focus();
				} else if (restoreFocus) pill.focus();
			};
			pill.addEventListener("click", () => setOpen(panel.hidden !== false));
			hide.addEventListener("click", () => {
				setOpen(false, true);
				this.setAttribute("data-hidden", "");
				writeHidden(true);
			});
			root.addEventListener("keydown", (event) => {
				if (event.key === "Escape" && panel.hidden === false) setOpen(false, true);
			});
			document.addEventListener("pointerdown", (event) => {
				if (panel.hidden === false && !event.composedPath().includes(this)) setOpen(false);
			});
		}
	}
	customElements.define(TAG, Dock);
	/** Monta la barra una sola vez, colgada de <html> para quedar fuera del árbol que controla la demo. */
	const mount = () => {
		if (!document.querySelector(TAG)) document.documentElement.appendChild(document.createElement(TAG));
	};
	if (document.readyState === "complete") mount();
	else window.addEventListener("load", mount, { once: true });
})({"owner":"Akyrion","projects":[{"slug":"thepredict","name":"ThePredict","path":"/thepredict/"},{"slug":"seshat","name":"Seshat","path":"/seshat/"},{"slug":"btb","name":"Be The Boss","path":"/btb/"},{"slug":"tsk","name":"The Story Keeper","path":"/tsk/"},{"slug":"thevoidfiles","name":"The Void Files","path":"/thevoidfiles/"}],"text":{"es":{"open":"Abrir navegación del portafolio","home":"Portafolio","hide":"Ocultar barra"},"en":{"open":"Open portfolio navigation","home":"Portfolio","hide":"Hide bar"}},"home":{"en":"/","es":"/es/"}});
