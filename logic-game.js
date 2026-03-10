/**
 * Logic Puzzle Game - Truth Tables
 * Level-based game: complete truth table with drag-and-drop V/F, then classify
 * (tautology, contradiction, contingency). Scoring, hints, progress, achievements.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "logic_game_state";
  const HINT_PENALTY = 2;

  /** Normalize user input to boolean (V/F, 1/0, T/F) */
  function parseValue(s) {
    const t = String(s ?? "").trim().toUpperCase();
    if (t === "V" || t === "T" || t === "1" || t === "TRUE") return true;
    if (t === "F" || t === "0" || t === "FALSE") return false;
    return null;
  }

  function valueToLabel(b) {
    return b ? "V" : "F";
  }

  /** Get 2^n rows for n variables (p, q, r, ...) — V first (V,V … F,F) */
  function getRows(n) {
    const vars = ["p", "q", "r", "s"].slice(0, n);
    const len = Math.pow(2, n);
    const out = [];
    for (let i = 0; i < len; i++) {
      const row = {};
      const bits = len - 1 - i;
      vars.forEach((v, j) => {
        row[v] = ((bits >> (n - 1 - j)) & 1) === 1;
      });
      out.push(row);
    }
    return out;
  }

  /** Etiquetas de clasificación en español */
  const CLASS_LABELS = { tautology: "tautología", contradiction: "contradicción", contingency: "contingencia" };

  /**
   * Definición de niveles.
   * id, name, statement (mostrado), vars, fn(fila) -> boolean, classification
   */
  const LEVELS = [
    {
      id: "single-p",
      name: "Variable simple",
      statement: "P",
      vars: 1,
      fn: (r) => r.p,
      classification: "contingency",
    },
    {
      id: "and",
      name: "Conjunción",
      statement: "P ∧ Q",
      vars: 2,
      fn: (r) => r.p && r.q,
      classification: "contingency",
    },
    {
      id: "or",
      name: "Disyunción",
      statement: "P ∨ Q",
      vars: 2,
      fn: (r) => r.p || r.q,
      classification: "contingency",
    },
    {
      id: "not",
      name: "Negación",
      statement: "¬P",
      vars: 1,
      fn: (r) => !r.p,
      classification: "contingency",
    },
    {
      id: "xor",
      name: "O exclusivo",
      statement: "P ⊕ Q",
      vars: 2,
      fn: (r) => r.p !== r.q,
      classification: "contingency",
    },
    {
      id: "impl",
      name: "Implicación",
      statement: "P → Q",
      vars: 2,
      fn: (r) => !r.p || r.q,
      classification: "contingency",
    },
    {
      id: "bicond",
      name: "Bicondicional",
      statement: "P ↔ Q",
      vars: 2,
      fn: (r) => r.p === r.q,
      classification: "contingency",
    },
    {
      id: "nand",
      name: "NAND",
      statement: "¬(P ∧ Q)",
      vars: 2,
      fn: (r) => !(r.p && r.q),
      classification: "contingency",
    },
    {
      id: "nor",
      name: "NOR",
      statement: "¬(P ∨ Q)",
      vars: 2,
      fn: (r) => !(r.p || r.q),
      classification: "contingency",
    },
    {
      id: "tautology",
      name: "Tautología",
      statement: "P ∨ ¬P",
      vars: 1,
      fn: () => true,
      classification: "tautology",
    },
    {
      id: "contradiction",
      name: "Contradicción",
      statement: "P ∧ ¬P",
      vars: 1,
      fn: () => false,
      classification: "contradiction",
    },
    {
      id: "complex1",
      name: "Compuesta",
      statement: "(P → Q) ∧ (Q → P)",
      vars: 2,
      fn: (r) => (!r.p || r.q) && (!r.q || r.p),
      classification: "contingency",
    },
    {
      id: "complex2",
      name: "Tres variables",
      statement: "(P ∧ Q) ∨ R",
      vars: 3,
      fn: (r) => (r.p && r.q) || r.r,
      classification: "contingency",
    },
  ];

  /** Load persisted state */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return {
        score: Number(data.score) || 0,
        levelIndex: Math.max(0, Math.min(LEVELS.length - 1, Number(data.levelIndex) || 0)),
        completed: Array.isArray(data.completed) ? data.completed : [],
        achievements: Array.isArray(data.achievements) ? data.achievements : [],
      };
    } catch (_) {
      return null;
    }
  }

  /** Persist state */
  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  const defaultState = {
    score: 0,
    levelIndex: -1,
    completed: [],
    achievements: [],
  };

  let state = loadState() || { ...defaultState };
  if (!Array.isArray(state.completed)) state.completed = [];
  if (!Array.isArray(state.achievements)) state.achievements = [];
  state.levelIndex = -1;

  const levelNumEl = document.getElementById("game-level-num");
  const levelTotalEl = document.getElementById("game-level-total");
  const scoreEl = document.getElementById("game-score");
  const levelStatementEl = document.getElementById("level-statement");
  const levelMetaEl = document.getElementById("level-meta");
  const theadEl = document.getElementById("truth-thead");
  const tbodyEl = document.getElementById("truth-tbody");
  const tableStatusEl = document.getElementById("table-status");
  const classifyStatusEl = document.getElementById("classify-status");
  const progressFillEl = document.getElementById("progress-fill");
  const progressTextEl = document.getElementById("progress-text");
  const achievementsListEl = document.getElementById("achievements-list");

  function getLevel() {
    if (typeof window.__levelIndex === "number" && window.__levelIndex >= 0 && window.__levelIndex < LEVELS.length) {
      state.levelIndex = window.__levelIndex;
    }
    if (state.levelIndex < 0 || state.levelIndex >= LEVELS.length) return null;
    return LEVELS[state.levelIndex];
  }

  function generateRandomChallenge() {
    if (!LEVELS.length) return;
    state.levelIndex = Math.floor(Math.random() * LEVELS.length);
    saveState(state);
    updateUI();
    renderTable();
  }

  window.generateEnunciadoAleatorio = generateRandomChallenge;

  function updateUI() {
    const level = getLevel();
    const total = LEVELS.length;
    if (levelNumEl) levelNumEl.textContent = state.levelIndex >= 0 ? state.levelIndex + 1 : "—";
    if (levelTotalEl) levelTotalEl.textContent = total;
    if (scoreEl) scoreEl.textContent = state.score;
    if (levelStatementEl) {
      levelStatementEl.textContent = level
        ? level.statement
        : "Pulsa «Generar enunciado» para obtener un reto aleatorio.";
    }
    if (levelMetaEl) {
      levelMetaEl.textContent = level
        ? `Variables: ${level.vars}. Completa la columna resultado y clasifica.`
        : "";
    }

    const completed = state.completed.length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    if (progressFillEl) progressFillEl.style.width = pct + "%";
    if (progressTextEl) progressTextEl.textContent = `${completed} nivel(es) completados`;

    const achievements = [
      { id: "first", label: "Primer nivel", check: () => state.completed.length >= 1 },
      { id: "five", label: "5 niveles", check: () => state.completed.length >= 5 },
      { id: "all", label: "Todos los niveles", check: () => state.completed.length >= LEVELS.length },
      { id: "no_hint", label: "Nivel sin pista", check: () => state.achievements.includes("no_hint") },
    ];
    if (achievementsListEl) {
      achievementsListEl.innerHTML = achievements
        .map((a) => {
          const unlocked = state.achievements.includes(a.id) || a.check();
          if (unlocked && !state.achievements.includes(a.id)) state.achievements.push(a.id);
          return `<span class="logic-achievement ${unlocked ? "logic-achievement--unlocked" : ""}">${a.label}</span>`;
        })
        .join("");
    }
  }

  function renderTable() {
    const level = getLevel();
    if (!level) {
      if (theadEl) {
        theadEl.innerHTML = "<tr><th>#</th><th>P</th><th>Q</th><th>Resultado</th></tr>";
      }
      if (tbodyEl) {
        tbodyEl.innerHTML =
          '<tr><td colspan="4" class="logic-table-placeholder">Genera un enunciado para ver la tabla del reto.</td></tr>';
      }
      setTableStatus("Pulsa «Generar enunciado» para crear un reto aleatorio.", null);
      clearClassifyFeedback();
      return;
    }

    const rows = getRows(level.vars);
    const vars = ["p", "q", "r", "s"].slice(0, level.vars);

    if (theadEl) {
      theadEl.innerHTML = `
        <tr>
          <th>#</th>
          ${vars.map((v) => `<th>${v.toUpperCase()}</th>`).join("")}
          <th>Resultado (${level.statement})</th>
        </tr>
      `;
    }

    if (tbodyEl) {
      tbodyEl.innerHTML = rows
        .map(
          (r, i) => `
        <tr>
          <td>${i + 1}</td>
          ${vars.map((v) => `<td>${valueToLabel(r[v])}</td>`).join("")}
          <td class="logic-drop-cell" data-result-cell="true" data-row-idx="${i}" data-value="" droppable="true">—</td>
        </tr>
      `
        )
        .join("");
    }

    setTableStatus("Arrastra V o F a cada celda de resultado y pulsa Validar.", null);
    setClassifyEnabled(false);
    clearClassifyFeedback();
  }

  function setTableStatus(msg, kind) {
    if (!tableStatusEl) return;
    tableStatusEl.textContent = msg;
    tableStatusEl.classList.remove("status--good", "status--bad", "status--warn");
    if (kind) tableStatusEl.classList.add(kind);
  }

  function setClassifyEnabled(enabled) {
    document.querySelectorAll(".logic-classify-btn").forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  function clearClassifyFeedback() {
    document.querySelectorAll(".logic-classify-btn").forEach((btn) => {
      btn.classList.remove("logic-classify-btn--correct", "logic-classify-btn--wrong");
    });
    if (classifyStatusEl) classifyStatusEl.textContent = "";
    classifyStatusEl?.classList.remove("status--good", "status--bad");
  }

  function validateTable() {
    const level = getLevel();
    if (!level) return false;
    const rows = getRows(level.vars);
    const expected = rows.map((r) => level.fn(r));
    const cells = document.querySelectorAll("[data-result-cell='true']");
    let filled = 0;
    let correct = 0;

    cells.forEach((cell, i) => {
      cell.classList.remove("cell-ok", "cell-bad");
      const val = parseValue(cell.getAttribute("data-value") ?? cell.textContent);
      if (val === null) return;
      filled++;
      const ok = val === expected[i];
      cell.classList.add(ok ? "cell-ok" : "cell-bad");
      if (ok) correct++;
    });

    if (filled === 0) {
      setTableStatus("Primero arrastra V o F a las celdas de resultado.", "status--warn");
      setClassifyEnabled(false);
      return false;
    }
    if (correct === expected.length) {
      setTableStatus(`Correcto: ${correct}/${expected.length}. Ahora elige la clasificación.`, "status--good");
      setClassifyEnabled(true);
      return true;
    }
    setTableStatus(`${correct}/${expected.length} correctas. Corrige las celdas en rojo.`, "status--bad");
    setClassifyEnabled(false);
    return false;
  }

  function checkClassification(choice) {
    const level = getLevel();
    if (!level) return;

    const correct = choice === level.classification;
    document.querySelectorAll(".logic-classify-btn").forEach((btn) => {
      btn.classList.remove("logic-classify-btn--correct", "logic-classify-btn--wrong");
      if (btn.getAttribute("data-classify") === level.classification) btn.classList.add("logic-classify-btn--correct");
      else if (btn.getAttribute("data-classify") === choice) btn.classList.add("logic-classify-btn--wrong");
    });

    if (classifyStatusEl) {
      classifyStatusEl.classList.remove("status--good", "status--bad", "status--warn");
      if (correct) {
        classifyStatusEl.classList.add("status--good");
        classifyStatusEl.textContent = "¡Correcto! Esta proposición es una " + CLASS_LABELS[level.classification] + ".";
        const points = 10 + (level.vars === 3 ? 5 : 0);
        state.score += points;
        if (!state.completed.includes(level.id)) state.completed.push(level.id);
        state.levelIndex = Math.min(state.levelIndex + 1, LEVELS.length - 1);
        saveState(state);
        updateUI();
        setTimeout(() => {
          renderTable();
          clearClassifyFeedback();
          setClassifyEnabled(false);
          setTableStatus("¡Reto completado! Pulsa «Generar enunciado» para un nuevo reto aleatorio.", "status--good");
        }, 1500);
      } else {
        classifyStatusEl.classList.add("status--bad");
        classifyStatusEl.textContent = "Incorrecto. La respuesta correcta es: " + CLASS_LABELS[level.classification] + ".";
      }
    }
  }

  function giveHint() {
    const level = getLevel();
    if (!level) return;
    const rows = getRows(level.vars);
    const expected = rows.map((r) => level.fn(r));
    const cells = document.querySelectorAll("[data-result-cell='true']");
    let hinted = 0;
    cells.forEach((cell, i) => {
      if (cell.getAttribute("data-value")) return;
      cell.setAttribute("data-value", valueToLabel(expected[i]));
      cell.textContent = valueToLabel(expected[i]);
      hinted++;
      if (hinted >= 1) return;
    });
    state.score = Math.max(0, state.score - HINT_PENALTY);
    saveState(state);
    updateUI();
    setTableStatus("Se rellenó una celda. Completa el resto y valida.", "status--warn");
  }

  function resetCells() {
    document.querySelectorAll(".logic-drop-cell").forEach((cell) => {
      cell.setAttribute("data-value", "");
      cell.textContent = "";
      cell.classList.remove("cell-ok", "cell-bad");
    });
    setClassifyEnabled(false);
    setTableStatus("Arrastra V o F a cada celda de resultado y pulsa Validar.", null);
  }

  // ── Mouse drag-and-drop ──────────────────────────────────────────
  const paletteValues = document.getElementById("palette-values");
  if (paletteValues) {
    paletteValues.addEventListener("dragstart", (e) => {
      const block = e.target.closest(".logic-block--value");
      if (!block) return;
      const v = block.getAttribute("data-block-value") || "";
      const norm = v === "1" ? "V" : v === "0" ? "F" : v;
      e.dataTransfer.setData("text/plain", norm);
      e.dataTransfer.effectAllowed = "copy";
      block.classList.add("logic-block--dragging");
    });

    paletteValues.addEventListener("dragend", (e) => {
      const block = e.target.closest(".logic-block--value");
      if (block) block.classList.remove("logic-block--dragging");
    });
  }

  // ── Touch drag-and-drop fallback (iOS / Android) ─────────────────
  // The HTML5 DnD API does not fire on mobile browsers, so we replicate
  // the same mechanic with pointer/touch events.
  let _touchBlock = null;
  let _touchValue = null;

  const _clearDropOver = () => {
    document.querySelectorAll(".logic-drop-cell--over").forEach((c) => {
      c.classList.remove("logic-drop-cell--over");
    });
  };

  const _placeValue = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    const cell = el ? el.closest(".logic-drop-cell") : null;
    if (cell && _touchValue) {
      cell.setAttribute("data-value", _touchValue);
      cell.textContent = _touchValue;
      cell.classList.remove("cell-ok", "cell-bad");
    }
    _clearDropOver();
  };

  if (paletteValues) {
    paletteValues.addEventListener("touchstart", (e) => {
      const block = e.target.closest(".logic-block--value");
      if (!block) return;
      const v = block.getAttribute("data-block-value") || "";
      _touchValue = v === "1" ? "V" : v === "0" ? "F" : v;
      _touchBlock = block;
      block.classList.add("logic-block--dragging");
    }, { passive: true });
  }

  document.addEventListener("touchmove", (e) => {
    if (!_touchBlock) return;
    e.preventDefault();
    const t = e.touches[0];
    _clearDropOver();
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const cell = el ? el.closest(".logic-drop-cell") : null;
    if (cell) cell.classList.add("logic-drop-cell--over");
  }, { passive: false });

  document.addEventListener("touchend", (e) => {
    if (!_touchBlock) return;
    _touchBlock.classList.remove("logic-block--dragging");
    const t = e.changedTouches[0];
    _placeValue(t.clientX, t.clientY);
    _touchBlock = null;
    _touchValue = null;
  });

  document.addEventListener("touchcancel", () => {
    if (!_touchBlock) return;
    _touchBlock.classList.remove("logic-block--dragging");
    _clearDropOver();
    _touchBlock = null;
    _touchValue = null;
  });

  const tableEl = document.getElementById("truth-table");
  if (tableEl) {
    tableEl.addEventListener("dragover", (e) => {
      const cell = e.target.closest(".logic-drop-cell");
      if (cell) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        cell.classList.add("logic-drop-cell--over");
      }
    });

    tableEl.addEventListener("dragleave", (e) => {
      const cell = e.target.closest(".logic-drop-cell");
      if (cell) cell.classList.remove("logic-drop-cell--over");
    });

    tableEl.addEventListener("drop", (e) => {
      const cell = e.target.closest(".logic-drop-cell");
      if (!cell) return;
      e.preventDefault();
      cell.classList.remove("logic-drop-cell--over");
      const v = (e.dataTransfer.getData("text/plain") || "").trim().toUpperCase();
      if (v === "V" || v === "F") {
        cell.setAttribute("data-value", v);
        cell.textContent = v;
        cell.classList.remove("cell-ok", "cell-bad");
      }
    });
  }

  document.querySelector(".logic-game-main")?.addEventListener("click", (e) => {
    const generateBtn = e.target.closest("[data-action='generate-statement']");
    if (generateBtn) {
      e.preventDefault();
      generateRandomChallenge();
    }
  });
  document.getElementById("btn-validate-table")?.addEventListener("click", () => validateTable());
  document.getElementById("btn-hint")?.addEventListener("click", giveHint);
  document.getElementById("btn-reset-cells")?.addEventListener("click", resetCells);

  document.querySelectorAll(".logic-classify-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = btn.getAttribute("data-classify");
      if (choice) checkClassification(choice);
    });
  });

  updateUI();
  renderTable();
})();
