(() => {

  // ── Unified collapsible / accordion ─────────────────────────────
  //
  // Mark-up API:
  //   [data-collapsible]              — self-contained toggle unit
  //     [data-collapsible-trigger]    — the clickable button inside it
  //     [data-collapsible-panel]      — the expandable panel inside it
  //   data-open="true|false"          — initial open state
  //   data-collapsible-class="cls"    — toggle a CSS class on the panel
  //                                     instead of maxHeight (e.g. "is-closed")
  //
  //   [data-accordion]                — exclusive group (one open at a time)
  //   [data-accordion="independent"]  — group where multiple can be open

  /**
   * Creates open / close / isOpen API for a single [data-collapsible] element.
   * Handles both maxHeight-based (default) and CSS-class-based panels.
   * Icon rotation is handled entirely by CSS via aria-expanded on the trigger.
   * @param {Element} el
   */
  function makeCollapsibleItem(el) {
    const trigger    = el.querySelector("[data-collapsible-trigger]");
    const panel      = el.querySelector("[data-collapsible-panel]");
    if (!trigger || !panel) return null;

    const closeClass = el.dataset.collapsibleClass || null;
    const isOpen     = () => el.getAttribute("data-open") === "true";

    const open = () => {
      el.setAttribute("data-open", "true");
      trigger.setAttribute("aria-expanded", "true");
      panel.setAttribute("aria-hidden", "false");
      if (closeClass) panel.classList.remove(closeClass);
      else panel.style.maxHeight = panel.scrollHeight + "px";
    };

    const close = () => {
      el.setAttribute("data-open", "false");
      trigger.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");
      if (closeClass) panel.classList.add(closeClass);
      else panel.style.maxHeight = "0px";
    };

    if (isOpen()) open(); else close();
    return { open, close, isOpen };
  }

  /**
   * Scans the document and wires up every collapsible / accordion.
   * Safe to call multiple times — listeners are only added once per element.
   */
  function initAllCollapsibles() {
    // 1. Accordion groups
    for (const group of document.querySelectorAll("[data-accordion]")) {
      const exclusive = group.dataset.accordion !== "independent";
      const items     = Array.from(group.querySelectorAll(":scope > [data-collapsible]"));
      const apis      = items.map(makeCollapsibleItem).filter(Boolean);

      items.forEach((item, i) => {
        const trigger = item.querySelector("[data-collapsible-trigger]");
        if (!trigger || !apis[i]) return;
        trigger.addEventListener("click", () => {
          const wasOpen = apis[i].isOpen();
          if (exclusive) apis.forEach((a) => a.close());
          if (!wasOpen) apis[i].open();
        });
      });
    }

    // 2. Standalone collapsibles (not inside any accordion group)
    const standalone = document.querySelectorAll(
      "[data-collapsible]:not([data-accordion] [data-collapsible])",
    );
    for (const el of standalone) {
      const api     = makeCollapsibleItem(el);
      const trigger = el.querySelector("[data-collapsible-trigger]");
      if (!api || !trigger) continue;
      trigger.addEventListener("click", () => {
        if (api.isOpen()) api.close(); else api.open();
      });
    }
  }

  initAllCollapsibles();

  // Auto-open Acerca de if the URL hash is #acerca
  if (window.location.hash === "#acerca") {
    const acercaEl = document.querySelector("#acerca[data-collapsible]");
    if (acercaEl && acercaEl.getAttribute("data-open") !== "true") {
      acercaEl.querySelector("[data-collapsible-trigger]")?.click();
    }
  }

  // Reveal on scroll
  const revealEls = Array.from(document.querySelectorAll(".reveal"));
  if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (!ent.isIntersecting) continue;
          const el = ent.target;
          if (el instanceof HTMLElement) el.classList.add("is-visible");
          io.unobserve(el);
        }
      },
      { threshold: 0.12 },
    );
    for (const el of revealEls) io.observe(el);
  }

  /** @param {unknown} v */
  const parseVF = (v) => {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s) return null;
    if (s === "v" || s === "verdadero" || s === "t" || s === "true" || s === "1")
      return true;
    if (s === "f" || s === "falso" || s === "false" || s === "0") return false;
    return null;
  };

  const vfLabel = (b) => (b ? "V" : "F");

  /** Toggles a collapsible table panel; syncs aria-hidden, aria-expanded, and button text. */
  const toggleTableWrap = (wrap, btn) => {
    const isVisible = wrap.classList.toggle("is-visible");
    wrap.setAttribute("aria-hidden", String(!isVisible));
    if (btn instanceof HTMLElement) {
      btn.setAttribute("aria-expanded", String(isVisible));
      btn.textContent = isVisible ? "Ocultar tabla" : "Mostrar tabla";
    }
  };

  const circuitHost = document.getElementById("circuit-game");
  if (circuitHost) initCircuitGame(circuitHost);

  function initBlocksGame(host) {
    const render = () => {
      const n = getTableSize();
      const rows = getRows(n);
      const vars = getVarNames(n);
      const exprStr = vars.join(" ∧ ");

      host.innerHTML = `
        <div class="game__top">
          <div class="game-question-row">
            <div>
              <h2 class="game__title">Completa la tabla con bloques</h2>
              <div class="game__meta">
                <strong>Pregunta:</strong> Debes completar la tabla de verdad para la fórmula <span style="font-family: ui-monospace, monospace; font-weight:800;">${exprStr}</span> (${rows.length} filas). Arrastra V o F a cada celda de resultado.
              </div>
            </div>
            <button class="btn btn--primary btn-show-table" type="button" data-blocks-action="show-table" aria-expanded="false">Mostrar tabla</button>
          </div>
        </div>

        <div class="game-table-wrap" aria-hidden="true">
          <div class="game__tools" style="margin-top: 12px;">
            <button class="btn btn--primary" type="button" data-blocks-action="check">Validar</button>
            <button class="btn btn--ghost" type="button" data-blocks-action="reset">Vaciar celdas</button>
          </div>
          <div class="blocks-pool" aria-label="Bloques V y F">
            <span class="block-drag" draggable="true" data-block-value="V" role="button" tabindex="0">V</span>
            <span class="block-drag" draggable="true" data-block-value="F" role="button" tabindex="0">F</span>
          </div>

          <div class="table-wrap" style="margin-top: 12px">
            <table class="truth blocks-table" aria-label="Tabla de verdad para completar con bloques">
              <thead>
                <tr>
                  <th>Fila</th>
                  ${vars.map((v) => `<th>${v}</th>`).join("")}
                  <th>Resultado (${exprStr})</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    (r, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    ${vars.map((v) => `<td>${vfLabel(r[v])}</td>`).join("")}
                    <td class="block-drop" data-idx="${i}" data-value="" droppable="true" aria-label="Suelta V o F aquí"></td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="status" data-blocks-status>Arrastra V o F a cada celda y presiona <b>Validar</b>.</div>
        </div>
      `;
    };

    const clearMarks = () => {
      host.querySelectorAll(".block-drop").forEach((cell) => {
        cell.classList.remove("cell-ok", "cell-bad");
      });
    };

    const setBlocksStatus = (kind, msg) => {
      const statusEl = host.querySelector("[data-blocks-status]");
      if (!(statusEl instanceof HTMLElement)) return;
      statusEl.classList.remove("status--good", "status--bad", "status--warn");
      if (kind) statusEl.classList.add(kind);
      statusEl.innerHTML = msg;
    };

    const blocksCheck = () => {
      const n = getTableSize();
      const rows = getRows(n);
      const vars = getVarNames(n);
      const expected = rows.map((r) => vars.every((v) => r[v]));
      const dropCells = host.querySelectorAll(".block-drop");
      clearMarks();
      const values = Array.from(dropCells).map((c) => (c.getAttribute("data-value") || "").toUpperCase());
      let filled = 0;
      let ok = 0;
      dropCells.forEach((cell, i) => {
        const val = values[i];
        const isV = val === "V";
        const isF = val === "F";
        if (!isV && !isF) return;
        filled += 1;
        const correct = expected[i];
        const good = (correct && isV) || (!correct && isF);
        cell.classList.add(good ? "cell-ok" : "cell-bad");
        if (good) ok += 1;
      });
      if (filled === 0) {
        setBlocksStatus("status--warn", "Arrastra <b>V</b> o <b>F</b> a las celdas de resultado.");
        return;
      }
      if (ok === expected.length) {
        setBlocksStatus("status--good", `Perfecto: <b>${ok}/${expected.length}</b> correctas.`);
        return;
      }
      setBlocksStatus("status--bad", `Vas bien: <b>${ok}/${expected.length}</b> correctas. Corrige las marcadas en rojo.`);
    };

    const blocksReset = () => {
      host.querySelectorAll(".block-drop").forEach((cell) => {
        cell.setAttribute("data-value", "");
        cell.textContent = "";
        cell.classList.remove("cell-ok", "cell-bad");
      });
      setBlocksStatus(null, "Arrastra V o F a cada celda y presiona <b>Validar</b>.");
    };

    host.addEventListener("click", (e) => {
      const act = e.target instanceof Element ? e.target.closest("[data-blocks-action]") : null;
      if (!act) return;
      const action = act.getAttribute("data-blocks-action");
      if (action === "show-table") {
        const wrap = host.querySelector(".game-table-wrap");
        const btn = host.querySelector("[data-blocks-action='show-table']");
        if (wrap && btn) toggleTableWrap(wrap, btn);
        return;
      }
      if (action === "check") blocksCheck();
      if (action === "reset") blocksReset();
    });

    host.addEventListener("dragstart", (e) => {
      const block = e.target instanceof Element ? e.target.closest(".block-drag") : null;
      if (!block) return;
      const v = block.getAttribute("data-block-value") || "";
      e.dataTransfer.setData("text/plain", v);
      e.dataTransfer.effectAllowed = "copy";
      block.classList.add("block-dragging");
    });

    host.addEventListener("dragend", (e) => {
      const block = e.target instanceof Element ? e.target.closest(".block-drag") : null;
      if (block) block.classList.remove("block-dragging");
    });

    host.addEventListener("dragover", (e) => {
      if (e.target instanceof Element && e.target.closest(".block-drop")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    });

    host.addEventListener("drop", (e) => {
      const cell = e.target instanceof Element ? e.target.closest(".block-drop") : null;
      if (!cell) return;
      e.preventDefault();
      const v = (e.dataTransfer.getData("text/plain") || "").trim().toUpperCase();
      if (v === "V" || v === "F") {
        cell.setAttribute("data-value", v);
        cell.textContent = v;
        cell.classList.remove("cell-ok", "cell-bad");
      }
    });

    render();
    const tableSizeEl = document.querySelector("[data-table-size]");
    if (tableSizeEl) {
      tableSizeEl.addEventListener("change", () => render());
    }
  }

  const blocksHost = document.getElementById("blocks-game");
  if (blocksHost) initBlocksGame(blocksHost);

  const gamesHost = document.getElementById("games");
  if (gamesHost) initTruthTableGames(gamesHost);

  /** @param {number} n 2, 3 or 4 */
  function getVarNames(n) {
    const names = ["p", "q", "r", "s"];
    return names.slice(0, n);
  }

  /** @param {number} n 2, 3 or 4 — returns 2^n rows with p, q, (r), (s) */
  function getRows(n) {
    const vars = getVarNames(n);
    const out = [];
    const len = Math.pow(2, n);
    for (let i = 0; i < len; i += 1) {
      const row = /** @type {Record<string, boolean>} */ ({});
      for (let v = 0; v < n; v += 1) {
        row[vars[v]] = ((i >> (n - 1 - v)) & 1) === 1;
      }
      out.push(row);
    }
    return out;
  }

  function getTableSize() {
    const sel = document.querySelector("[data-table-size]");
    if (sel instanceof HTMLSelectElement) {
      const v = Number(sel.value);
      return v >= 2 && v <= 4 ? v : 2;
    }
    return 2;
  }

  function initTruthTableGames(host) {
    const games = [
      {
        id: "and",
        name: "Reto 1 · Conjunción",
        expr: (n) => getVarNames(n).join(" ∧ "),
        desc: "Completa la columna resultado (V/F).",
        fn: (r, vars) => vars.every((v) => r[v]),
      },
      {
        id: "or",
        name: "Reto 2 · Disyunción",
        expr: (n) => getVarNames(n).join(" ∨ "),
        desc: "Completa la columna resultado (V/F).",
        fn: (r, vars) => vars.some((v) => r[v]),
      },
      {
        id: "xor",
        name: "Reto 3 · XOR (paridad)",
        expr: (n) => getVarNames(n).join(" ⊕ "),
        desc: "V si cantidad de V es impar (paridad).",
        fn: (r, vars) => vars.filter((v) => r[v]).length % 2 === 1,
      },
    ];

    const render = () => {
      const n = getTableSize();
      const rows = getRows(n);
      const vars = getVarNames(n);
      host.innerHTML = "";

      for (const g of games) {
        const exprStr = g.expr(n);
        const expected = rows.map((r) => g.fn(r, vars));

        const section = document.createElement("section");
        section.className = "card game reveal";
        section.dataset.gameId = g.id;

        const thVars = vars.map((v) => `<th>${v}</th>`).join("");
        const bodyRows = rows
          .map(
            (r, i) => `
              <tr>
                <td>${i + 1}</td>
                ${vars.map((v) => `<td>${vfLabel(r[v])}</td>`).join("")}
                <td>
                  <input
                    class="vf"
                    inputmode="text"
                    maxlength="1"
                    placeholder="V/F"
                    aria-label="Resultado fila ${i + 1}"
                    data-idx="${i}"
                  />
                </td>
              </tr>
            `,
          )
          .join("");

        section.innerHTML = `
        <div class="game__top">
          <div class="game-question-row">
            <div>
              <h2 class="game__title">${g.name} <span style="opacity:.8">·</span> <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace; font-weight:800;">${exprStr}</span></h2>
              <div class="game__meta"><strong>Pregunta:</strong> ${g.desc} Tabla 2<sup>${n}</sup> = ${rows.length} filas. Completa la columna resultado con V o F.</div>
            </div>
            <button class="btn btn--primary btn-show-table" type="button" data-action="show-table" data-game-id="${g.id}" aria-expanded="false">Mostrar tabla</button>
          </div>
        </div>

        <div class="game-table-wrap" data-game-table aria-hidden="true">
          <div class="game__tools" style="margin-top: 12px;">
            <button class="btn btn--primary" type="button" data-action="check">Validar</button>
            <button class="btn" type="button" data-action="show">Mostrar solución</button>
            <button class="btn btn--ghost" type="button" data-action="reset">Reiniciar</button>
          </div>
          <div class="table-wrap">
            <table class="truth" aria-label="Tabla de verdad ${exprStr}">
              <thead>
                <tr>
                  <th>Fila</th>
                  ${thVars}
                  <th>Resultado (${exprStr})</th>
                </tr>
              </thead>
              <tbody>
                ${bodyRows}
              </tbody>
            </table>
          </div>
          <div class="status" data-status>Escribe V/F y presiona <b>Validar</b>.</div>
        </div>
      `.trim();

        const statusEl = section.querySelector("[data-status]");
        const inputs = Array.from(section.querySelectorAll("input.vf"));

        const clearMarks = () => {
          for (const input of inputs) {
            input.classList.remove("cell-ok", "cell-bad");
          }
        };

        const setStatus = (kind, msg) => {
          if (!statusEl) return;
          statusEl.classList.remove("status--good", "status--bad", "status--warn");
          if (kind) statusEl.classList.add(kind);
          statusEl.innerHTML = msg;
        };

        const check = () => {
          clearMarks();
          let filled = 0;
          let ok = 0;

          for (const input of inputs) {
            const idx = Number(input.dataset.idx);
            const val = parseVF(input.value);
            if (val === null) continue;
            filled += 1;

            const exp = expected[idx];
            const good = val === exp;
            input.classList.add(good ? "cell-ok" : "cell-bad");
            ok += good ? 1 : 0;
          }

          if (filled === 0) {
            setStatus(
              "status--warn",
              "Primero escribe <b>V</b> o <b>F</b> en una o más filas.",
            );
            return;
          }

          if (ok === expected.length) {
            setStatus(
              "status--good",
              `Perfecto: <b>${ok}/${expected.length}</b> correctas.`,
            );
            return;
          }

          setStatus(
            "status--bad",
            `Vas bien: <b>${ok}/${expected.length}</b> correctas. Corrige las marcadas en rojo.`,
          );
        };

        const show = () => {
          clearMarks();
          for (const input of inputs) {
            const idx = Number(input.dataset.idx);
            input.value = vfLabel(expected[idx]);
            input.classList.add("cell-ok");
          }
          setStatus(
            "status--good",
            `Solución mostrada: <b>${expected.length}/${expected.length}</b>.`,
          );
        };

        const reset = () => {
          for (const input of inputs) input.value = "";
          clearMarks();
          setStatus(null, 'Escribe V/F y presiona <b>Validar</b>.');
        };

        section.addEventListener("click", (e) => {
          const el =
            e.target instanceof Element ? e.target.closest("[data-action]") : null;
          if (!el) return;
          const action = el.getAttribute("data-action");
          if (action === "show-table") {
            const wrap = section.querySelector("[data-game-table]");
            if (wrap) toggleTableWrap(wrap, el);
            return;
          }
          if (action === "check") check();
          if (action === "show") show();
          if (action === "reset") reset();
        });

        for (const input of inputs) {
          input.addEventListener("input", () => {
            input.value = String(input.value ?? "").toUpperCase().slice(0, 1);
            input.classList.remove("cell-ok", "cell-bad");
          });
        }

        host.appendChild(section);
      }
    };

    render();
    const tableSizeEl = document.querySelector("[data-table-size]");
    if (tableSizeEl) {
      tableSizeEl.addEventListener("change", () => render());
    }
  }

  function initCircuitGame(host) {
    host.classList.add("circuit");
    host.innerHTML = `
      <div class="short-circuit" aria-hidden="true"></div>
      <div class="game__top">
        <div class="game-question-row">
          <div>
            <h2 class="game__title">Modo Circuito · Puertas lógicas</h2>
            <div class="game__meta">
              <strong>Pregunta:</strong> Se plantea un objetivo. Debes construir la tabla <b>desde cero</b> agregando bloques (columnas) con ∧, ∨, →, ↔ y ¬ hasta cumplirlo.
            </div>
            <div class="circuit__row" style="margin-top: 10px;">
              <div class="circuit__label">Objetivo a cumplir</div>
              <div class="chip" data-c-goal>—</div>
            </div>
          </div>
          <button class="btn btn--primary btn-show-table" type="button" data-c-action="show-table" aria-expanded="false">Mostrar tabla</button>
        </div>
      </div>

      <div class="game-table-wrap" data-c-table-wrap aria-hidden="true">
        <div class="game__tools" style="margin-top: 12px;">
          <button class="btn btn--primary" type="button" data-c-action="checklevel">Validar</button>
          <button class="btn" type="button" data-c-action="add">+ Bloque</button>
          <button class="btn btn--ghost" type="button" data-c-action="reset">Nuevo problema</button>
        </div>

        <div class="circuit__grid">
          <div class="circuit__panel">
            <div class="circuit__row">
              <div class="circuit__label">Modo</div>
              <select class="select" data-c-mode>
                <option value="taut">Tautología (siempre encendido)</option>
                <option value="contra">Contradicción (nunca enciende)</option>
                <option value="cont">Contingencia (enciende en 1 caso)</option>
              </select>
            </div>
            <div class="circuit__row">
              <div class="circuit__label">Variables</div>
              <select class="select" data-c-vars>
                <option value="2">2 variables (p, q) → 4 filas</option>
                <option value="3">3 variables (p, q, r) → 8 filas</option>
              </select>
            </div>
          </div>

          <div class="circuit__panel">
            <div class="circuit__row">
              <div class="circuit__label">Salida</div>
              <select class="select" data-c-out></select>
            </div>

            <div class="circuit__row">
              <div class="circuit__label">Bloques</div>
              <div class="game__tools" style="justify-content:flex-end">
                <button class="btn btn--ghost" type="button" data-c-action="remove">- Quitar</button>
              </div>
            </div>

            <div class="gate-list" data-c-gates></div>
          </div>
        </div>

        <div class="table-wrap" style="margin-top:12px">
          <table class="truth table-dyn" aria-label="Tabla de verdad dinámica">
            <thead data-c-thead></thead>
            <tbody data-c-tbody></tbody>
          </table>
        </div>

        <div class="status" data-c-status>Agrega bloques (w1, w2, …) y luego elige la salida para validar.</div>
      </div>
    `.trim();

    const elMode = host.querySelector("[data-c-mode]");
    const elVars = host.querySelector("[data-c-vars]");
    const elGoal = host.querySelector("[data-c-goal]");
    const elOut = host.querySelector("[data-c-out]");
    const elGates = host.querySelector("[data-c-gates]");
    const elThead = host.querySelector("[data-c-thead]");
    const elTbody = host.querySelector("[data-c-tbody]");
    const elStatus = host.querySelector("[data-c-status]");

    /** @type {{vars: 2|3, mode: "taut"|"contra"|"cont", targetIdx: number, gates: Array<{op:string,a:string,b:string}>, out: string}} */
    const state = {
      vars: 2,
      mode: "taut",
      targetIdx: 0,
      gates: [],
      out: "p",
    };

    /** @param {"status--good"|"status--bad"|"status--warn"|null} kind @param {string} msg */
    const setStatus = (kind, msg) => {
      if (!(elStatus instanceof HTMLElement)) return;
      elStatus.classList.remove("status--good", "status--bad", "status--warn");
      if (kind) elStatus.classList.add(kind);
      elStatus.innerHTML = msg;
    };

    const short = () => {
      host.classList.add("is-short");
      window.setTimeout(() => host.classList.remove("is-short"), 360);
    };

    /** @param {number} n */
    const combos = (n) => {
      /** @type {Array<{p:boolean,q:boolean,r?:boolean}>} */
      const out = [];
      if (n === 2) {
        out.push(
          { p: true, q: true },
          { p: true, q: false },
          { p: false, q: true },
          { p: false, q: false },
        );
      } else {
        for (const p of [true, false]) {
          for (const q of [true, false]) {
            for (const r of [true, false]) {
              out.push({ p, q, r });
            }
          }
        }
      }
      return out;
    };

    /** @param {string} op @param {boolean} a @param {boolean} b */
    const evalBin = (op, a, b) => {
      if (op === "AND") return a && b;
      if (op === "OR") return a || b;
      if (op === "IMPLIES") return !a || b; // a → b
      if (op === "IFF") return a === b; // a ↔ b
      return false;
    };

    /** @param {string} op @param {Record<string, boolean>} values @param {{op:string,a:string,b:string}} gate */
    const evalGate = (op, values, gate) => {
      const a = values[gate.a];
      if (typeof a !== "boolean") return { ok: false, err: `Entrada inválida: ${gate.a}` };
      if (op === "NOT") return { ok: true, val: !a };
      const b = values[gate.b];
      if (typeof b !== "boolean") return { ok: false, err: `Entrada inválida: ${gate.b}` };
      return { ok: true, val: evalBin(op, a, b) };
    };

    const wires = () => {
      const base = state.vars === 2 ? ["p", "q"] : ["p", "q", "r"];
      const ws = state.gates.map((_, i) => `w${i + 1}`);
      return base.concat(ws);
    };

    const expectedForIdx = (idx) => {
      if (state.mode === "taut") return true;
      if (state.mode === "contra") return false;
      return idx === state.targetIdx;
    };

    const computeRow = (inputs) => {
      /** @type {Record<string, boolean>} */
      const values = { p: inputs.p, q: inputs.q };
      if (state.vars === 3) values.r = Boolean(inputs.r);

      for (let i = 0; i < state.gates.length; i += 1) {
        const gate = state.gates[i];
        const op = gate.op;
        const res = evalGate(op, values, gate);
        if (!res.ok) return { ok: false, err: res.err };
        values[`w${i + 1}`] = res.val;
      }
      return { ok: true, values };
    };

    const computeAll = () => {
      const cs = combos(state.vars);
      /** @type {Array<Record<string, boolean>>} */
      const rows = [];
      for (const c of cs) {
        const res = computeRow(c);
        if (!res.ok) return { ok: false, err: res.err };
        rows.push(res.values);
      }
      return { ok: true, rows };
    };

    const renderOut = () => {
      if (!(elOut instanceof HTMLSelectElement)) return;
      const ws = wires();
      elOut.innerHTML = ws.map((w) => `<option value="${w}">${w}</option>`).join("");
      if (!ws.includes(state.out)) state.out = ws[ws.length - 1];
      elOut.value = state.out;
    };

    const renderGates = () => {
      if (!(elGates instanceof HTMLElement)) return;
      const base = state.vars === 2 ? ["p", "q"] : ["p", "q", "r"];

      elGates.innerHTML = state.gates
        .map((g, i) => {
          const out = `w${i + 1}`;
          const unary = g.op === "NOT";
          const sources = base.concat(state.gates.slice(0, i).map((_, k) => `w${k + 1}`));
          const options = sources.map((w) => `<option value="${w}">${w}</option>`).join("");
          const opSel = `
            <select class="select" data-c-gop="${i}">
              <option value="AND">∧ (AND)</option>
              <option value="OR">∨ (OR)</option>
              <option value="IMPLIES">→ (COND)</option>
              <option value="IFF">↔ (BICOND)</option>
              <option value="NOT">¬ (NOT)</option>
            </select>
          `;
          const aSel = `<select class="select" data-c-ga="${i}">${options}</select>`;
          const bSel = `<select class="select" data-c-gb="${i}">${options}</select>`;

          const row = `
            <div class="gate-row" data-gate-row="${i}" data-unary="${unary}">
              <div class="gate-out">${out}</div>
              ${opSel}
              ${aSel}
              ${unary ? "" : bSel}
            </div>
          `;
          return row;
        })
        .join("");

      for (let i = 0; i < state.gates.length; i += 1) {
        const g = state.gates[i];
        const opEl = host.querySelector(`[data-c-gop="${i}"]`);
        const aEl = host.querySelector(`[data-c-ga="${i}"]`);
        const bEl = host.querySelector(`[data-c-gb="${i}"]`);
        if (opEl instanceof HTMLSelectElement) opEl.value = g.op;
        if (aEl instanceof HTMLSelectElement) aEl.value = g.a;
        if (bEl instanceof HTMLSelectElement) bEl.value = g.b;
      }
    };

    const renderTable = () => {
      const vars = state.vars === 2 ? ["p", "q"] : ["p", "q", "r"];
      const cs = combos(state.vars);
      const computed = computeAll();
      if (!computed.ok) {
        short();
        setStatus("status--warn", `Cortocircuito: <b>${computed.err}</b>`);
        return;
      }
      const rows = computed.rows;
      const cols = state.gates.map((_, i) => `w${i + 1}`);

      if (elThead instanceof HTMLElement) {
        elThead.innerHTML = `
          <tr>
            <th>Fila</th>
            ${vars.map((v) => `<th>${v}</th>`).join("")}
            ${cols
              .map((c) => `<th ${c === state.out ? 'data-out="true"' : ""}>${c}</th>`)
              .join("")}
            <th ${state.out === "p" || state.out === "q" || state.out === "r" ? 'data-out="true"' : ""}>
              Salida (${state.out})
            </th>
          </tr>
        `;
      }

      if (elTbody instanceof HTMLElement) {
        elTbody.innerHTML = cs
          .map((r, idx) => {
            const outVal = rows[idx][state.out];
            return `
              <tr data-c-row="${idx}">
                <td>${idx + 1}</td>
                ${vars.map((v) => `<td>${vfLabel(Boolean(r[v]))}</td>`).join("")}
                ${cols.map((c) => `<td>${vfLabel(rows[idx][c])}</td>`).join("")}
                <td data-state="ok">${vfLabel(Boolean(outVal))}</td>
              </tr>
            `;
          })
          .join("");
      }
    };

    const renderGoal = () => {
      if (!(elGoal instanceof HTMLElement)) return;
      if (state.mode === "taut") elGoal.textContent = "Siempre encendido (V)";
      else if (state.mode === "contra") elGoal.textContent = "Nunca enciende (F)";
      else {
        const cs = combos(state.vars);
        const t = cs[state.targetIdx];
        if (state.vars === 2) {
          elGoal.textContent = `Solo enciende cuando p=${vfLabel(t.p)}, q=${vfLabel(t.q)}`;
        } else {
          elGoal.textContent = `Solo enciende cuando p=${vfLabel(t.p)}, q=${vfLabel(t.q)}, r=${vfLabel(Boolean(t.r))}`;
        }
      }
    };

    const syncGateViews = () => {
      renderOut();
      renderGates();
      renderTable();
    };

    const rerender = () => {
      syncGateViews();
      renderGoal();
    };

    const newLevel = () => {
      state.targetIdx = Math.floor(Math.random() * (state.vars === 2 ? 4 : 8));
      state.gates = [];
      state.out = state.vars === 2 ? "p" : "p";
      rerender();
      setStatus(null, "Agrega bloques (w1, w2, …), elige la salida y valida.");
    };

    const checkLevel = () => {
      const cs = combos(state.vars);
      const computed = computeAll();
      if (!computed.ok) {
        short();
        setStatus("status--warn", `Cortocircuito: <b>${computed.err}</b>`);
        return;
      }
      const rows = computed.rows;

      for (let i = 0; i < cs.length; i += 1) {
        const outVal = rows[i][state.out];
        if (typeof outVal !== "boolean") {
          short();
          setStatus("status--warn", "Selecciona una salida válida.");
          return;
        }
        const exp = expectedForIdx(i);
        if (outVal !== exp) {
          short();
          setStatus(
            "status--bad",
            `Falla en la fila <b>${i + 1}</b>. Se esperaba <b>${vfLabel(exp)}</b> para cumplir el modo.`,
          );
          return;
        }
      }
      setStatus("status--good", "¡Correcto! Tu tabla/circuito cumple el objetivo del problema.");
    };

    // Events
    host.addEventListener("click", (e) => {
      const act = e.target instanceof Element ? e.target.closest("[data-c-action]") : null;
      if (act) {
        const a = act.getAttribute("data-c-action");
        if (a === "show-table") {
          const wrap = host.querySelector("[data-c-table-wrap]");
          if (wrap) toggleTableWrap(wrap, act);
          return;
        }
        if (a === "reset") newLevel();
        if (a === "checklevel") checkLevel();
        if (a === "add") {
          state.gates.push({ op: "AND", a: "p", b: "q" });
          state.out = `w${state.gates.length}`;
          syncGateViews();
        }
        if (a === "remove") {
          if (state.gates.length > 0) state.gates.pop();
          state.out = state.gates.length ? `w${state.gates.length}` : "p";
          syncGateViews();
        }
        return;
      }
    });

    host.addEventListener("change", (e) => {
      const target = e.target;

      if (target === elMode && elMode instanceof HTMLSelectElement) {
        state.mode = /** @type {any} */ (elMode.value);
        state.targetIdx = Math.floor(Math.random() * (state.vars === 2 ? 4 : 8));
        renderGoal();
        renderTable();
        setStatus(null, "Modo actualizado. Construye tu tabla con bloques.");
      }

      if (target === elVars && elVars instanceof HTMLSelectElement) {
        state.vars = elVars.value === "3" ? 3 : 2;
        state.targetIdx = Math.floor(Math.random() * (state.vars === 2 ? 4 : 8));
        state.gates = [];
        state.out = "p";
        rerender();
        setStatus(null, "Variables actualizadas. Empieza tu tabla desde cero.");
      }

      if (target === elOut && elOut instanceof HTMLSelectElement) {
        state.out = elOut.value;
        renderTable();
      }

      const opEl = target instanceof Element ? target.closest("[data-c-gop]") : null;
      if (opEl instanceof HTMLSelectElement) {
        const idx = Number(opEl.getAttribute("data-c-gop"));
        state.gates[idx].op = opEl.value;
        renderGates();
        renderTable();
      }

      const aEl = target instanceof Element ? target.closest("[data-c-ga]") : null;
      if (aEl instanceof HTMLSelectElement) {
        const idx = Number(aEl.getAttribute("data-c-ga"));
        state.gates[idx].a = aEl.value;
        renderTable();
      }

      const bEl = target instanceof Element ? target.closest("[data-c-gb]") : null;
      if (bEl instanceof HTMLSelectElement) {
        const idx = Number(bEl.getAttribute("data-c-gb"));
        state.gates[idx].b = bEl.value;
        renderTable();
      }
    });

    newLevel();
  }
})();
