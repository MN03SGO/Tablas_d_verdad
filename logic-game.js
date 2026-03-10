/* ================================================================
   logic-game.js — Logic Puzzle Game: Truth Tables
   ================================================================
   Sections:
     · Level definitions  (13 levels, 1-3 variables)
     · State management   (localStorage persistence)
     · UI rendering       (table, status, progress, achievements)
     · Game actions       (generate, validate, hint, reset, classify)
     · Drag-and-drop      (mouse + touch)
     · Intermediate cols  (modal, insert/remove user-defined columns)
     · Event listeners
   ================================================================ */

(function () {
  "use strict";

  // ── Constants ───────────────────────────────────────────────────
  const STORAGE_KEY  = "logic_game_state";
  const HINT_PENALTY = 2; // points deducted per hint

  // ── Level definitions ───────────────────────────────────────────
  /**
   * Each level object:
   *   id             {string}   — unique key used for progress tracking
   *   name           {string}   — human-readable display name
   *   statement      {string}   — expression shown as the Resultado column header
   *   vars           {1|2|3}    — number of propositional variables
   *   fn(row)        {Function} — truth function; row has boolean props {p, q, r}
   *   classification {string}   — 'tautology' | 'contradiction' | 'contingency'
   */
  const LEVELS = [
    { id: "single-p",      name: "Variable simple",  statement: "P",                  vars: 1, fn: r => r.p,                           classification: "contingency"    },
    { id: "and",           name: "Conjunción",        statement: "P ∧ Q",              vars: 2, fn: r => r.p && r.q,                     classification: "contingency"    },
    { id: "or",            name: "Disyunción",        statement: "P ∨ Q",              vars: 2, fn: r => r.p || r.q,                     classification: "contingency"    },
    { id: "not",           name: "Negación",          statement: "¬P",                 vars: 1, fn: r => !r.p,                           classification: "contingency"    },
    { id: "xor",           name: "O exclusivo",       statement: "P ⊕ Q",              vars: 2, fn: r => r.p !== r.q,                    classification: "contingency"    },
    { id: "impl",          name: "Implicación",       statement: "P → Q",              vars: 2, fn: r => !r.p || r.q,                    classification: "contingency"    },
    { id: "bicond",        name: "Bicondicional",     statement: "P ↔ Q",              vars: 2, fn: r => r.p === r.q,                    classification: "contingency"    },
    { id: "nand",          name: "NAND",              statement: "¬(P ∧ Q)",           vars: 2, fn: r => !(r.p && r.q),                  classification: "contingency"    },
    { id: "nor",           name: "NOR",               statement: "¬(P ∨ Q)",           vars: 2, fn: r => !(r.p || r.q),                  classification: "contingency"    },
    { id: "tautology",     name: "Tautología",        statement: "P ∨ ¬P",             vars: 1, fn: ()  => true,                         classification: "tautology"      },
    { id: "contradiction", name: "Contradicción",     statement: "P ∧ ¬P",             vars: 1, fn: ()  => false,                        classification: "contradiction"  },
    { id: "complex1",      name: "Compuesta",         statement: "(P → Q) ∧ (Q → P)", vars: 2, fn: r => (!r.p || r.q) && (!r.q || r.p), classification: "contingency"    },
    { id: "complex2",      name: "Tres variables",    statement: "(P ∧ Q) ∨ R",        vars: 3, fn: r => (r.p && r.q) || r.r,            classification: "contingency"    },
  ];

  /** Spanish labels for each classification type */
  const CLASS_LABELS = {
    tautology:    "tautología",
    contradiction:"contradicción",
    contingency:  "contingencia",
  };

  // ── Helpers ─────────────────────────────────────────────────────

  /**
   * Parses a user-typed cell value (V, F, 1, 0, T, TRUE, FALSE).
   * @param {string|null|undefined} s
   * @returns {boolean|null}
   */
  function parseValue(s) {
    const t = String(s ?? "").trim().toUpperCase();
    if (t === "V" || t === "T" || t === "1" || t === "TRUE")  return true;
    if (t === "F" || t === "0" || t === "FALSE")               return false;
    return null;
  }

  /** Converts a boolean to its Spanish display label */
  function vf(b) { return b ? "V" : "F"; }

  /**
   * Builds 2^n truth-table rows for n variables (p, q, r…).
   * Rows go from all-true to all-false (standard logical order).
   * @param {number} n - number of variables (1–3)
   * @returns {Array<Object>} array of row objects with boolean props per variable
   */
  function getRows(n) {
    const vars = ["p", "q", "r", "s"].slice(0, n);
    const len  = Math.pow(2, n);
    return Array.from({ length: len }, (_, i) => {
      const bits = len - 1 - i;
      return Object.fromEntries(vars.map((v, j) => [v, ((bits >> (n - 1 - j)) & 1) === 1]));
    });
  }

  // ── State management ────────────────────────────────────────────

  /** @returns {Object|null} parsed state from localStorage, or null */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return {
        score:        Number(d.score) || 0,
        levelIndex:   Math.max(0, Math.min(LEVELS.length - 1, Number(d.levelIndex) || 0)),
        completed:    Array.isArray(d.completed)    ? d.completed    : [],
        achievements: Array.isArray(d.achievements) ? d.achievements : [],
      };
    } catch { return null; }
  }

  /** @param {Object} state */
  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  let state = loadState() || { score: 0, levelIndex: -1, completed: [], achievements: [] };
  if (!Array.isArray(state.completed))    state.completed    = [];
  if (!Array.isArray(state.achievements)) state.achievements = [];
  state.levelIndex = -1; // always start fresh; user must click "Generar"

  // ── DOM references ───────────────────────────────────────────────
  const theadEl            = document.getElementById("truth-thead");
  const tbodyEl            = document.getElementById("truth-tbody");
  const tableStatusEl      = document.getElementById("table-status");
  const classifyStatusEl   = document.getElementById("classify-status");
  const levelNumEl         = document.getElementById("game-level-num");
  const levelTotalEl       = document.getElementById("game-level-total");
  const scoreEl            = document.getElementById("game-score");
  const levelStatementEl   = document.getElementById("level-statement");
  const levelMetaEl        = document.getElementById("level-meta");
  const progressFillEl     = document.getElementById("progress-fill");
  const progressTextEl     = document.getElementById("progress-text");
  const achievementsListEl = document.getElementById("achievements-list");

  // ── Level helper ─────────────────────────────────────────────────

  /** @returns {Object|null} current level definition, or null if none selected */
  function getLevel() {
    if (state.levelIndex < 0 || state.levelIndex >= LEVELS.length) return null;
    return LEVELS[state.levelIndex];
  }

  // ── UI rendering ─────────────────────────────────────────────────

  /** Updates all UI elements that reflect game state (score, level, progress, achievements) */
  function updateUI() {
    const level = getLevel();

    if (levelNumEl)  levelNumEl.textContent  = state.levelIndex >= 0 ? state.levelIndex + 1 : "—";
    if (levelTotalEl) levelTotalEl.textContent = LEVELS.length;
    if (scoreEl)      scoreEl.textContent      = state.score;

    if (levelStatementEl)
      levelStatementEl.textContent = level
        ? level.statement
        : "Pulsa «Generar enunciado» para obtener un reto aleatorio.";
    if (levelMetaEl)
      levelMetaEl.textContent = level
        ? `Variables: ${level.vars}. Completa la columna resultado y clasifica.`
        : "";

    // Progress bar
    const pct = LEVELS.length ? Math.round((state.completed.length / LEVELS.length) * 100) : 0;
    if (progressFillEl) progressFillEl.style.width = pct + "%";
    if (progressTextEl) progressTextEl.textContent = `${state.completed.length} nivel(es) completados`;

    // Achievements
    const ACHIEV_DEF = [
      { id: "first",   label: "Primer nivel",     check: () => state.completed.length >= 1 },
      { id: "five",    label: "5 niveles",         check: () => state.completed.length >= 5 },
      { id: "all",     label: "Todos los niveles", check: () => state.completed.length >= LEVELS.length },
      { id: "no_hint", label: "Nivel sin pista",   check: () => state.achievements.includes("no_hint") },
    ];
    if (achievementsListEl) {
      achievementsListEl.innerHTML = ACHIEV_DEF.map(a => {
        const unlocked = state.achievements.includes(a.id) || a.check();
        if (unlocked && !state.achievements.includes(a.id)) state.achievements.push(a.id);
        return `<span class="logic-achievement ${unlocked ? "logic-achievement--unlocked" : ""}">${a.label}</span>`;
      }).join("");
    }
  }

  /**
   * Renders the truth table header and body for the current level.
   * Any intermediate columns added by the user are cleared here.
   */
  function renderTable() {
    const level = getLevel();

    if (!level) {
      if (theadEl) theadEl.innerHTML = "<tr><th>#</th><th>P</th><th>Q</th><th>Resultado</th></tr>";
      if (tbodyEl) tbodyEl.innerHTML = '<tr><td colspan="4" class="logic-table-placeholder">Genera un enunciado para ver la tabla del reto.</td></tr>';
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
          ${vars.map(v => `<th>${v.toUpperCase()}</th>`).join("")}
          <th>Resultado (${level.statement})</th>
        </tr>`;
    }

    if (tbodyEl) {
      tbodyEl.innerHTML = rows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          ${vars.map(v => `<td>${vf(r[v])}</td>`).join("")}
          <td class="logic-drop-cell" data-result-cell="true" data-row-idx="${i}" data-value="" droppable="true"></td>
        </tr>`
      ).join("");
    }

    setTableStatus("Arrastra V o F a cada celda de resultado y pulsa Validar.", null);
    setClassifyEnabled(false);
    clearClassifyFeedback();
  }

  // ── Game actions ─────────────────────────────────────────────────

  /** Picks a random level, saves state, and re-renders the full table */
  function generateRandomChallenge() {
    if (!LEVELS.length) return;
    state.levelIndex = Math.floor(Math.random() * LEVELS.length);
    saveState(state);
    updateUI();
    renderTable();
  }

  /**
   * Validates all result cells against the correct answers.
   * Marks each cell green (correct) or red (wrong).
   * Enables the classification buttons only when all cells are correct.
   * @returns {boolean} true if all cells are correct
   */
  function validateTable() {
    const level = getLevel();
    if (!level) return false;

    const expected = getRows(level.vars).map(r => level.fn(r));
    const cells    = document.querySelectorAll("[data-result-cell='true']");
    let filled = 0, correct = 0;

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

  /**
   * Scores the player's classification choice.
   * On a correct answer: awards points, marks the level complete,
   * advances to the next level index, and re-renders after 1.5s.
   * @param {string} choice - 'tautology' | 'contradiction' | 'contingency'
   */
  function checkClassification(choice) {
    const level = getLevel();
    if (!level) return;

    const correct = choice === level.classification;

    document.querySelectorAll(".logic-classify-btn").forEach(btn => {
      btn.classList.remove("logic-classify-btn--correct", "logic-classify-btn--wrong");
      if      (btn.getAttribute("data-classify") === level.classification) btn.classList.add("logic-classify-btn--correct");
      else if (btn.getAttribute("data-classify") === choice)               btn.classList.add("logic-classify-btn--wrong");
    });

    if (!classifyStatusEl) return;
    classifyStatusEl.classList.remove("status--good", "status--bad", "status--warn");

    if (correct) {
      classifyStatusEl.classList.add("status--good");
      classifyStatusEl.textContent = `¡Correcto! Esta proposición es una ${CLASS_LABELS[level.classification]}.`;

      state.score += 10 + (level.vars === 3 ? 5 : 0);
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
      classifyStatusEl.textContent = `Incorrecto. La respuesta correcta es: ${CLASS_LABELS[level.classification]}.`;
    }
  }

  /**
   * Fills the first empty result cell with the correct answer as a hint.
   * Deducts HINT_PENALTY points from the score.
   */
  function giveHint() {
    const level = getLevel();
    if (!level) return;

    const expected = getRows(level.vars).map(r => level.fn(r));
    const cells    = document.querySelectorAll("[data-result-cell='true']");
    let hinted = 0;

    cells.forEach((cell, i) => {
      if (hinted >= 1 || cell.getAttribute("data-value")) return;
      cell.setAttribute("data-value", vf(expected[i]));
      cell.textContent = vf(expected[i]);
      hinted++;
    });

    state.score = Math.max(0, state.score - HINT_PENALTY);
    saveState(state);
    updateUI();
    setTableStatus("Se rellenó una celda. Completa el resto y valida.", "status--warn");
  }

  /** Empties all drop cells (result + intermediate) and resets validation state */
  function resetCells() {
    document.querySelectorAll(".logic-drop-cell").forEach(cell => {
      cell.setAttribute("data-value", "");
      cell.textContent = "";
      cell.classList.remove("cell-ok", "cell-bad");
    });
    setClassifyEnabled(false);
    setTableStatus("Arrastra V o F a cada celda de resultado y pulsa Validar.", null);
  }

  // ── Status helpers ────────────────────────────────────────────────

  function setTableStatus(msg, kind) {
    if (!tableStatusEl) return;
    tableStatusEl.textContent = msg;
    tableStatusEl.classList.remove("status--good", "status--bad", "status--warn");
    if (kind) tableStatusEl.classList.add(kind);
  }

  function setClassifyEnabled(enabled) {
    document.querySelectorAll(".logic-classify-btn").forEach(btn => { btn.disabled = !enabled; });
  }

  function clearClassifyFeedback() {
    document.querySelectorAll(".logic-classify-btn").forEach(btn => {
      btn.classList.remove("logic-classify-btn--correct", "logic-classify-btn--wrong");
    });
    if (classifyStatusEl) {
      classifyStatusEl.textContent = "";
      classifyStatusEl.classList.remove("status--good", "status--bad");
    }
  }

  // ── Drag-and-drop (mouse) ────────────────────────────────────────
  const paletteValues = document.getElementById("palette-values");

  if (paletteValues) {
    paletteValues.addEventListener("dragstart", e => {
      const block = e.target.closest(".logic-block--value");
      if (!block) return;
      const v = block.getAttribute("data-block-value") || "";
      e.dataTransfer.setData("text/plain", v === "1" ? "V" : v === "0" ? "F" : v);
      e.dataTransfer.effectAllowed = "copy";
      block.classList.add("logic-block--dragging");
    });

    paletteValues.addEventListener("dragend", e => {
      e.target.closest(".logic-block--value")?.classList.remove("logic-block--dragging");
    });
  }

  const tableEl = document.getElementById("truth-table");

  if (tableEl) {
    tableEl.addEventListener("dragover", e => {
      const cell = e.target.closest(".logic-drop-cell");
      if (!cell) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      cell.classList.add("logic-drop-cell--over");
    });

    tableEl.addEventListener("dragleave", e => {
      e.target.closest(".logic-drop-cell")?.classList.remove("logic-drop-cell--over");
    });

    tableEl.addEventListener("drop", e => {
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

  // ── Drag-and-drop (touch / mobile) ──────────────────────────────
  // The HTML5 DnD API is unreliable on mobile, so we replicate the same
  // mechanic using pointer/touch events.
  let _touchBlock = null;
  let _touchValue = null;

  const _clearDropOver = () =>
    document.querySelectorAll(".logic-drop-cell--over").forEach(c => c.classList.remove("logic-drop-cell--over"));

  const _placeValueAt = (clientX, clientY) => {
    const cell = document.elementFromPoint(clientX, clientY)?.closest(".logic-drop-cell");
    if (cell && _touchValue) {
      cell.setAttribute("data-value", _touchValue);
      cell.textContent = _touchValue;
      cell.classList.remove("cell-ok", "cell-bad");
    }
    _clearDropOver();
  };

  if (paletteValues) {
    paletteValues.addEventListener("touchstart", e => {
      const block = e.target.closest(".logic-block--value");
      if (!block) return;
      const v = block.getAttribute("data-block-value") || "";
      _touchValue = v === "1" ? "V" : v === "0" ? "F" : v;
      _touchBlock = block;
      block.classList.add("logic-block--dragging");
    }, { passive: true });
  }

  document.addEventListener("touchmove", e => {
    if (!_touchBlock) return;
    e.preventDefault();
    const t = e.touches[0];
    _clearDropOver();
    document.elementFromPoint(t.clientX, t.clientY)?.closest(".logic-drop-cell")?.classList.add("logic-drop-cell--over");
  }, { passive: false });

  document.addEventListener("touchend", e => {
    if (!_touchBlock) return;
    _touchBlock.classList.remove("logic-block--dragging");
    const t = e.changedTouches[0];
    _placeValueAt(t.clientX, t.clientY);
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

  // ── Intermediate columns ─────────────────────────────────────────
  // Users can add their own work columns (e.g. ¬P, P ∧ Q) before the
  // Resultado column. Each column gets a unique colId so its th and tds
  // can be removed as a group when the × button is clicked.

  let colCount = 0;

  /** Default expression suggestions per operator symbol */
  const OP_SUGGESTIONS = {
    "∧": "P ∧ Q", "∨": "P ∨ Q", "¬": "¬P",
    "⊕": "P ⊕ Q", "⊼": "P ⊼ Q", "⊽": "P ⊽ Q",
    "→": "P → Q", "↔": "P ↔ Q",
  };

  const colModal       = document.getElementById("col-modal");
  const colModalInput  = document.getElementById("col-modal-input");
  const colModalOp     = document.getElementById("col-modal-op");
  const colModalAdd    = document.getElementById("col-modal-add");
  const colModalCancel = document.getElementById("col-modal-cancel");

  /** @param {string} op - the operator symbol that triggered the modal */
  function openColModal(op) {
    if (!colModal) return;
    colModalOp.textContent = op;
    colModalInput.value    = OP_SUGGESTIONS[op] || op;
    colModal.hidden = false;
    colModalInput.focus();
    colModalInput.select();
  }

  function closeColModal() {
    if (colModal) colModal.hidden = true;
  }

  // Wire operator buttons in the palette → open modal on click
  document.querySelectorAll(".logic-block--op-btn").forEach(btn => {
    btn.addEventListener("click", () =>
      openColModal(btn.getAttribute("data-op") || btn.textContent.trim())
    );
  });

  colModalCancel?.addEventListener("click", closeColModal);
  colModal?.addEventListener("click", e => { if (e.target === colModal) closeColModal(); });
  colModalInput?.addEventListener("keydown", e => {
    if (e.key === "Enter")  colModalAdd?.click();
    if (e.key === "Escape") closeColModal();
  });
  colModalAdd?.addEventListener("click", () => {
    const label = (colModalInput.value || "").trim();
    if (label) { addIntermediateColumn(label); closeColModal(); }
  });

  /**
   * Inserts a new intermediate column before the Resultado column.
   * Alerts the user if no level has been generated yet.
   * @param {string} label - the expression to display as the column header
   */
  function addIntermediateColumn(label) {
    const thead    = document.getElementById("truth-thead");
    const tbody    = document.getElementById("truth-tbody");
    if (!thead || !tbody) return;

    const bodyRows = tbody.querySelectorAll("tr");
    if (!bodyRows.length || bodyRows[0].querySelectorAll("td").length <= 1) {
      alert("Primero genera un enunciado para tener una tabla de verdad.");
      return;
    }

    const colId     = `icol-${++colCount}`;
    const headerRow = thead.querySelector("tr");
    const lastTh    = headerRow?.lastElementChild;
    if (!lastTh) return;

    // Insert <th> before the last header cell (Resultado)
    const th = document.createElement("th");
    th.className = "intermediate-col-th";
    th.dataset.colId = colId;
    th.innerHTML = `
      <span class="intermediate-col-label">${label}</span>
      <button class="remove-col-btn" data-col-id="${colId}" title="Eliminar columna">×</button>`;
    headerRow.insertBefore(th, lastTh);

    // Insert <td> in every body row before the Resultado cell
    bodyRows.forEach((tr, idx) => {
      const td = document.createElement("td");
      td.className          = "logic-drop-cell logic-intermediate-cell";
      td.dataset.colId      = colId;
      td.dataset.rowIdx     = idx;
      td.dataset.value      = "";
      td.setAttribute("droppable", "true");
      tr.insertBefore(td, tr.lastElementChild);
    });
  }

  // Remove a column when its × button is clicked (event delegation)
  tableEl?.addEventListener("click", e => {
    const btn = e.target.closest(".remove-col-btn");
    if (!btn) return;
    const colId = btn.getAttribute("data-col-id");
    document.querySelectorAll(`[data-col-id="${colId}"]`).forEach(el => el.remove());
  });

  // ── Event listeners ───────────────────────────────────────────────
  document.getElementById("btn-generate-statement")?.addEventListener("click", generateRandomChallenge);
  document.getElementById("btn-validate-table")?.addEventListener("click", () => validateTable());
  document.getElementById("btn-hint")?.addEventListener("click", giveHint);
  document.getElementById("btn-reset-cells")?.addEventListener("click", resetCells);

  document.querySelectorAll(".logic-classify-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const choice = btn.getAttribute("data-classify");
      if (choice) checkClassification(choice);
    });
  });

  // ── Init ─────────────────────────────────────────────────────────
  updateUI();
  renderTable();

})();
