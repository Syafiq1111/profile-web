var Sudoku = (function () {
    'use strict';

    const ROW = [], COL = [], BOX = [], PEERS = [], UNITS = [];
    for (let i = 0; i < 81; i++) {
        ROW[i] = Math.floor(i / 9);
        COL[i] = i % 9;
        BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
    }
    for (let i = 0; i < 81; i++) {
        const p = [];
        for (let j = 0; j < 81; j++) {
            if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) p.push(j);
        }
        PEERS[i] = p;
    }
    for (let k = 0; k < 9; k++) {
        const r = [], c = [], b = [];
        for (let i = 0; i < 81; i++) {
            if (ROW[i] === k) r.push(i);
            if (COL[i] === k) c.push(i);
            if (BOX[i] === k) b.push(i);
        }
        UNITS.push({ type: 'baris', index: k, cells: r });
        UNITS.push({ type: 'kolom', index: k, cells: c });
        UNITS.push({ type: 'kotak', index: k, cells: b });
    }

    const POP = new Uint8Array(1024);
    for (let m = 1; m < 1024; m++) POP[m] = POP[m >> 1] + (m & 1);

    function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    /* ---------- Pemecah ---------- */
    function search(g, R, C, B, limit, rand, out) {
        let best = -1, bm = 0, bc = 10;
        for (let i = 0; i < 81; i++) {
            if (g[i]) continue;
            const m = ~(R[ROW[i]] | C[COL[i]] | B[BOX[i]]) & 0x3FE;
            const n = POP[m];
            if (n === 0) return 0;
            if (n < bc) { bc = n; bm = m; best = i; if (n === 1) break; }
        }
        if (best < 0) { if (out) out.sol = Int8Array.from(g); return 1; }

        const r = ROW[best], c = COL[best], b = BOX[best];
        const vals = [];
        for (let v = 1; v <= 9; v++) if (bm & (1 << v)) vals.push(v);
        if (rand) shuffle(vals);

        let total = 0;
        for (let k = 0; k < vals.length; k++) {
            const v = vals[k], bit = 1 << v;
            g[best] = v; R[r] |= bit; C[c] |= bit; B[b] |= bit;
            total += search(g, R, C, B, limit, rand, out);
            g[best] = 0; R[r] &= ~bit; C[c] &= ~bit; B[b] &= ~bit;
            if (total >= limit) return total;
        }
        return total;
    }

    function initMasks(g) {
        const R = new Int16Array(9), C = new Int16Array(9), B = new Int16Array(9);
        for (let i = 0; i < 81; i++) {
            const v = g[i];
            if (!v) continue;
            const bit = 1 << v;
            if ((R[ROW[i]] | C[COL[i]] | B[BOX[i]]) & bit) return null;
            R[ROW[i]] |= bit; C[COL[i]] |= bit; B[BOX[i]] |= bit;
        }
        return { R, C, B };
    }

    function countSolutions(grid, limit) {
        const g = Int8Array.from(grid);
        const m = initMasks(g);
        if (!m) return 0;
        return search(g, m.R, m.C, m.B, limit || 2, false, null);
    }

    function solve(grid) {
        const g = Int8Array.from(grid);
        const m = initMasks(g);
        if (!m) return null;
        const out = {};
        return search(g, m.R, m.C, m.B, 1, false, out) ? out.sol : null;
    }

    /* ---------- Pemecah logika ---------- */
    function cand(g, i) {
        let used = 0;
        const p = PEERS[i];
        for (let k = 0; k < p.length; k++) used |= 1 << g[p[k]];
        return ~used & 0x3FE;
    }

    function solveBySingles(grid, hiddenToo) {
        const g = Int8Array.from(grid);
        let progress = true;
        while (progress) {
            progress = false;
            for (let i = 0; i < 81; i++) {
                if (g[i]) continue;
                const m = cand(g, i);
                if (m === 0) return false;
                if (POP[m] === 1) { g[i] = 31 - Math.clz32(m); progress = true; }
            }
            if (!progress && hiddenToo) {
                for (let u = 0; u < UNITS.length && !progress; u++) {
                    const cells = UNITS[u].cells;
                    for (let v = 1; v <= 9 && !progress; v++) {
                        let placed = false, count = 0, at = -1;
                        for (let k = 0; k < 9; k++) {
                            const i = cells[k];
                            if (g[i] === v) { placed = true; break; }
                            if (!g[i] && (cand(g, i) & (1 << v))) { count++; at = i; }
                        }
                        if (!placed && count === 1) { g[at] = v; progress = true; }
                    }
                }
            }
        }
        for (let i = 0; i < 81; i++) if (!g[i]) return false;
        return true;
    }

    const LEVELS = [null,
        { name: 'Pemula',   clues: 44, mode: 'naked',      desc: 'Banyak angka awal. Cukup logika paling dasar.' },
        { name: 'Mudah',    clues: 38, mode: 'singles',    desc: 'Masih santai, tapi kamu perlu teliti membaca baris, kolom, dan kotak.' },
        { name: 'Menengah', clues: 32, mode: 'singles',    desc: 'Angka awal makin sedikit. Mulai butuh catatan kandidat.' },
        { name: 'Sulit',    clues: 30, mode: 'hard',       desc: 'Butuh teknik lebih dari sekadar angka tunggal.' },
        { name: 'Master',   clues: 25, mode: 'hard',       desc: 'Angka awal paling sedikit dan butuh teknik lanjutan.' }
    ];

    function generateFull() {
        const g = new Int8Array(81);
        const m = initMasks(g);
        const out = {};
        search(g, m.R, m.C, m.B, 1, true, out);
        return out.sol;
    }

    function dig(solution, target) {
        const g = Int8Array.from(solution);
        const order = shuffle(Array.from({ length: 41 }, (_, i) => i));
        let clues = 81;
        for (let k = 0; k < order.length; k++) {
            const i = order[k], j = 80 - i, dec = i === j ? 1 : 2;
            if (clues - dec < target) continue;
            const a = g[i], b = g[j];
            g[i] = 0; g[j] = 0;
            if (countSolutions(g, 2) !== 1) { g[i] = a; g[j] = b; }
            else clues -= dec;
        }
        return { puzzle: g, clues };
    }

    function matches(mode, p) {
        switch (mode) {
            case 'naked':    return solveBySingles(p, false);
            case 'singles':  return solveBySingles(p, true) && !solveBySingles(p, false);
            case 'notnaked': return !solveBySingles(p, false);
            case 'hard':     return !solveBySingles(p, true);
            default: return true;
        }
    }

    function generate(level, maxMs) {
        const cfg = LEVELS[level];
        const t0 = Date.now();
        let best = null;
        for (let attempt = 0; attempt < 60; attempt++) {
            const solution = generateFull();
            const d = dig(solution, cfg.clues);
            best = { puzzle: d.puzzle, solution, clues: d.clues, level };
            if (matches(cfg.mode, d.puzzle) || Date.now() - t0 > (maxMs || 2000)) break;
        }
        return best;
    }

    function findHint(cur, solution) {
        const g = Int8Array.from(cur);
        let fewest = -1, fewestN = 10;
        for (let i = 0; i < 81; i++) {
            if (g[i]) continue;
            const m = cand(g, i);
            if (POP[m] === 1) return { i, v: 31 - Math.clz32(m), type: 'naked' };
            if (POP[m] < fewestN) { fewestN = POP[m]; fewest = i; }
        }
        for (let u = 0; u < UNITS.length; u++) {
            const unit = UNITS[u];
            for (let v = 1; v <= 9; v++) {
                let placed = false, count = 0, at = -1;
                for (let k = 0; k < 9; k++) {
                    const i = unit.cells[k];
                    if (g[i] === v) { placed = true; break; }
                    if (!g[i] && (cand(g, i) & (1 << v))) { count++; at = i; }
                }
                if (!placed && count === 1) return { i: at, v, type: 'hidden', unit: unit.type, unitIndex: unit.index };
            }
        }
        if (fewest < 0) return null;
        return { i: fewest, v: solution[fewest], type: 'reveal' };
    }

    return { ROW, COL, BOX, PEERS, LEVELS, POP, countSolutions, solve, solveBySingles, generate, generateFull, findHint, cand };
})();

if (typeof module !== 'undefined') module.exports = Sudoku;