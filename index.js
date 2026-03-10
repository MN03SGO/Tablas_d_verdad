/* ================================================================
   index.js — Interactive logic for the Logic Engine landing page
   Sections:
     · Logic Playground  (real-time P/Q operator demo)
     · Expression Parser (recursive-descent, supports ∧ ∨ ¬ ⊕ → ↔)
     · Table Generator   (truth table + auto-classification)
     · Accordion         (Acerca del Proyecto section)
   ================================================================ */

// ── DOM references ─────────────────────────────────────────────────
const toggleP    = document.getElementById('toggleP');
const toggleQ    = document.getElementById('toggleQ');
const labelP     = document.getElementById('labelP');
const labelQ     = document.getElementById('labelQ');
const liveResult = document.getElementById('liveResults');

// ── Shared helpers ─────────────────────────────────────────────────

/** Returns 'V' for true, 'F' for false */
const vf   = b => b ? 'V' : 'F';

/** Returns the CSS class for coloring V/F values in the playground */
const vcls = b => b ? 'v-true' : 'v-false';

// ── Logic Playground ───────────────────────────────────────────────

/**
 * Re-renders all operator result rows based on the current
 * P and Q toggle states. Called on every checkbox change.
 */
function updatePlayground() {
  const P = toggleP.checked, Q = toggleQ.checked;

  labelP.textContent = vf(P);
  labelP.style.color = P ? 'var(--green)' : 'var(--red)';
  labelQ.textContent = vf(Q);
  labelQ.style.color = Q ? 'var(--green)' : 'var(--red)';

  const ops = [
    { sym: '¬P',    r: !P       },
    { sym: '¬Q',    r: !Q       },
    { sym: 'P ∧ Q', r: P && Q   },
    { sym: 'P ∨ Q', r: P || Q   },
    { sym: 'P ⊕ Q', r: P !== Q  },
    { sym: 'P → Q', r: !P || Q  },
    { sym: 'P ↔ Q', r: P === Q  },
  ];

  liveResult.innerHTML = ops
    .map(o => `<div class="live-row">
      <span class="op">${o.sym}</span>
      <span class="${vcls(o.r)}">${vf(o.r)}</span>
    </div>`)
    .join('');
}

toggleP.addEventListener('change', updatePlayground);
toggleQ.addEventListener('change', updatePlayground);
updatePlayground(); // initial render

// ── Recursive Descent Parser ────────────────────────────────────────
// Supports: AND OR NOT XOR IMPLIES IFF (and Unicode: ∧ ∨ ¬ ⊕ → ↔)
// Operator precedence (lowest → highest):
//   IFF → IMPLIES → OR → XOR → AND → NOT → atom / parentheses

/** Splits an expression string into tokens (words and parentheses) */
function tokenize(expr) {
  return expr.match(/\(|\)|[A-Za-z]+/g) || [];
}

// Each parse* function advances pos.i and returns a boolean result.

function parseExpr(tokens, pos, P, Q)    { return parseIFF(tokens, pos, P, Q); }

function parseIFF(tokens, pos, P, Q) {
  let l = parseIMPLIES(tokens, pos, P, Q);
  while (pos.i < tokens.length && tokens[pos.i].toUpperCase() === 'IFF') {
    pos.i++;
    l = (l === parseIMPLIES(tokens, pos, P, Q));
  }
  return l;
}

function parseIMPLIES(tokens, pos, P, Q) {
  let l = parseOR(tokens, pos, P, Q);
  while (pos.i < tokens.length && tokens[pos.i].toUpperCase() === 'IMPLIES') {
    pos.i++;
    l = (!l || parseOR(tokens, pos, P, Q));
  }
  return l;
}

function parseOR(tokens, pos, P, Q) {
  let l = parseXOR(tokens, pos, P, Q);
  while (pos.i < tokens.length && tokens[pos.i].toUpperCase() === 'OR') {
    pos.i++;
    l = (l || parseXOR(tokens, pos, P, Q));
  }
  return l;
}

function parseXOR(tokens, pos, P, Q) {
  let l = parseAND(tokens, pos, P, Q);
  while (pos.i < tokens.length && tokens[pos.i].toUpperCase() === 'XOR') {
    pos.i++;
    l = (l !== parseAND(tokens, pos, P, Q));
  }
  return l;
}

function parseAND(tokens, pos, P, Q) {
  let l = parseNOT(tokens, pos, P, Q);
  while (pos.i < tokens.length && tokens[pos.i].toUpperCase() === 'AND') {
    pos.i++;
    l = (l && parseNOT(tokens, pos, P, Q));
  }
  return l;
}

function parseNOT(tokens, pos, P, Q) {
  if (pos.i < tokens.length && tokens[pos.i].toUpperCase() === 'NOT') {
    pos.i++;
    return !parseNOT(tokens, pos, P, Q);
  }
  return parseAtom(tokens, pos, P, Q);
}

function parseAtom(tokens, pos, P, Q) {
  if (pos.i >= tokens.length) return false;
  const t = tokens[pos.i];
  if (t === '(') {
    pos.i++;
    const v = parseExpr(tokens, pos, P, Q);
    if (pos.i < tokens.length && tokens[pos.i] === ')') pos.i++;
    return v;
  }
  pos.i++;
  if (t.toUpperCase() === 'P') return P;
  if (t.toUpperCase() === 'Q') return Q;
  return false;
}

/**
 * Evaluates a logical expression string for given P and Q values.
 * Normalizes Unicode symbols to their keyword equivalents first.
 * @param {string} raw - expression string (e.g. "P AND Q" or "P ∧ Q")
 * @param {boolean} P
 * @param {boolean} Q
 * @returns {boolean|null} result, or null on parse error
 */
function evalExpr(raw, P, Q) {
  const expr = raw.trim()
    .replace(/¬/g, ' NOT ')
    .replace(/∧/g, ' AND ')
    .replace(/∨/g, ' OR ')
    .replace(/⊕/g, ' XOR ')
    .replace(/→/g, ' IMPLIES ')
    .replace(/↔/g, ' IFF ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = tokenize(expr);
  const pos    = { i: 0 };
  try {
    const v = parseExpr(tokens, pos, P, Q);
    return typeof v === 'boolean' ? v : null;
  } catch { return null; }
}

// ── Table Generator ─────────────────────────────────────────────────

/**
 * Reads the expression input, evaluates it for all P/Q combinations,
 * renders a truth table and a classification banner.
 * Called by the "Generar" button and on initial page load.
 */
function generateTable() {
  const raw = document.getElementById('exprInput').value.trim();
  if (!raw) return;

  const combos = [[true,true],[true,false],[false,true],[false,false]];
  const rows   = combos.map(([P,Q]) => ({ P, Q, r: evalExpr(raw, P, Q) }));
  const out    = document.getElementById('tableOutput');

  if (rows.some(r => r.r === null)) {
    out.innerHTML = `
      <div style="color:var(--red);font-size:.88rem;padding:.75rem 1rem;
                  background:rgba(243,139,168,.08);border:1px solid rgba(243,139,168,.25);
                  border-radius:10px;">
        ⚠ No se pudo evaluar la expresión. Revisa la sintaxis e inténtalo de nuevo.
      </div>`;
    return;
  }

  const allV = rows.every(r => r.r === true);
  const allF = rows.every(r => r.r === false);
  const type = allV ? 'tautology' : allF ? 'contradiction' : 'contingency';

  const INFO = {
    tautology:    { label: '⊤ Tautología',    cls: 'cls-tautology',     desc: 'Todos los resultados son V. La proposición es siempre verdadera sin importar los valores de P y Q.' },
    contradiction:{ label: '⊥ Contradicción', cls: 'cls-contradiction', desc: 'Todos los resultados son F. La proposición es siempre falsa sin importar los valores de P y Q.' },
    contingency:  { label: '◑ Contingencia',  cls: 'cls-contingency',   desc: 'Hay mezcla de V y F. El resultado depende de los valores asignados a P y Q.' },
  };
  const info  = INFO[type];
  const label = raw.length > 32 ? raw.substring(0, 30) + '…' : raw;
  const cell  = b => `<td class="${b ? 't' : 'f'}">${b ? 'V' : 'F'}</td>`;

  out.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="truth-table" style="margin-bottom:.75rem;">
        <thead><tr><th>P</th><th>Q</th><th style="max-width:200px;">${label}</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr>${cell(r.P)}${cell(r.Q)}${cell(r.r)}</tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="cls-result ${info.cls}">
      ${info.label}
      <span style="font-weight:400;font-size:.88rem;opacity:.9;"> — ${info.desc}</span>
    </div>`;
}

/**
 * Loads an example expression into the input field and immediately
 * generates its table. Called from onclick attributes on quick-example chips.
 * @param {string} expr - expression string to load
 */
function setExpr(expr) {
  document.getElementById('exprInput').value = expr;
  generateTable();
}

generateTable(); // run once on page load

// ── Accordion (Acerca section) ──────────────────────────────────────

/**
 * Toggles an accordion panel open/closed.
 * The panel must be the immediate next sibling of the trigger button,
 * and the button must contain a [data-icon] span for the ± indicator.
 * @param {HTMLButtonElement} btn - the accordion trigger button
 */
function toggleAcc(btn) {
  const panel = btn.nextElementSibling;
  const icon  = btn.querySelector('[data-icon]');
  const open  = panel.classList.toggle('open');
  icon.textContent = open ? '−' : '+';
}
