(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
    const TEXT_MODE = '\uFE0E';   // paksa tampil sebagai teks, bukan emoji
    const NAMES = { 1: 'pion', 2: 'kuda', 3: 'gajah', 4: 'benteng', 5: 'ratu', 6: 'raja' };
    const LEVEL_DESC = {
        1: 'Pemula: sering salah langkah, cocok untuk belajar.',
        2: 'Mudah: bermain cepat tapi masih sering lengah.',
        3: 'Menengah: cukup menantang, jarang melepas bidak cuma-cuma.',
        4: 'Sulit: menghitung beberapa langkah ke depan dengan teliti.',
        5: 'Master: berpikir paling dalam (bisa sampai 5 detik per langkah).'
    };
    const FILES = 'abcdefgh';
    const MIN_THINK_MS = 450;

    // ---- state ----
    let st, legal = [], history = [], keys = [];
    let playerColor = 1, level = 3, flipped = false;
    let selected = -1, targets = [], lastMove = 0, popSq = -1, tip = 0;
    let over = false, thinking = false, hinting = false, token = 0;
    let pendingPromo = null, endInfo = null;

    const cells = [];
    const el = {
        board: $('board'), status: $('status'), moves: $('moves'),
        barTop: $('bar-top'), barBottom: $('bar-bottom'),
        whoTop: $('who-top'), whoBottom: $('who-bottom'),
        capTop: $('cap-top'), capBottom: $('cap-bottom'),
        advTop: $('adv-top'), advBottom: $('adv-bottom'),
        levelSelect: $('level-select'),
        btnNew: $('btn-new'), btnHint: $('btn-hint'), btnUndo: $('btn-undo'),
        btnFlip: $('btn-flip'), btnResign: $('btn-resign'),
        ovSetup: $('overlay-setup'), ovPromo: $('overlay-promo'), ovEnd: $('overlay-end'),
        promoChoices: $('promo-choices'), endTitle: $('end-title'), endText: $('end-text'),
        levelDesc: $('level-desc')
    };

    const mFrom = Chess.mFrom, mTo = Chess.mTo, mPromo = Chess.mPromo, mFlag = Chess.mFlag;
    const sign = p => (p > 0 ? 1 : -1);

    let worker = null;
    const pending = new Map();
    let reqId = 0;

    function createWorker() {
        try {
            worker = new Worker('worker.js');
            worker.onmessage = e => {
                const p = pending.get(e.data.id);
                if (p) { pending.delete(e.data.id); p.resolve(e.data.move); }
            };
            worker.onerror = () => {
                const list = Array.from(pending.values());
                pending.clear();
                worker = null;
                list.forEach(p => p.fallback());
            };
        } catch (err) {
            worker = null;
        }
    }

    function search(fen, cfg) {
        return new Promise(resolve => {
            const fallback = () => setTimeout(() => {
                const r = Chess.findBest(Chess.fromFEN(fen), cfg);
                resolve(r ? r.move : null);
            }, 30);
            if (!worker) return fallback();
            const id = ++reqId;
            pending.set(id, { resolve, fallback });
            worker.postMessage({ id, fen, cfg });
        });
    }

    function cancelSearch() {
        token++;
        thinking = false;
        pending.forEach(p => p.resolve(null));
        pending.clear();
        if (worker) { worker.terminate(); createWorker(); }
    }

    function sqOf(i) {
        const r = i >> 3, c = i & 7;
        return flipped ? (7 - r) * 16 + (7 - c) : r * 16 + c;
    }

    function buildBoard() {
        for (let i = 0; i < 64; i++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'sq';
            b.dataset.i = i;
            b.tabIndex = i === 0 ? 0 : -1;
            b.setAttribute('role', 'gridcell');
            el.board.appendChild(b);
            cells.push(b);
        }
        el.board.addEventListener('click', e => {
            const b = e.target.closest('.sq');
            if (b) onSquare(sqOf(Number(b.dataset.i)));
        });
        el.board.addEventListener('keydown', e => {
            const b = e.target.closest('.sq');
            if (!b) return;
            const i = Number(b.dataset.i);
            const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[e.key];
            if (d === undefined) return;
            e.preventDefault();
            const r = i >> 3, c = i & 7;
            if ((e.key === 'ArrowLeft' && c === 0) || (e.key === 'ArrowRight' && c === 7)) return;
            const n = i + d;
            if (n < 0 || n > 63) return;
            cells[i].tabIndex = -1;
            cells[n].tabIndex = 0;
            cells[n].focus();
        });
    }

    function render() {
        const kingSq = inCheckNow() ? st.kings[st.turn === 1 ? 0 : 1] : -1;
        const targetSet = new Set(targets.map(mTo));
        for (let i = 0; i < 64; i++) {
            const sq = sqOf(i), b = cells[i];
            const piece = st.board[sq];
            const r = i >> 3, c = i & 7;
            const isLight = (((sq >> 4) + (sq & 7)) & 1) === 0;

            let cls = 'sq ' + (isLight ? 'light' : 'dark');
            if (lastMove && (sq === mFrom(lastMove) || sq === mTo(lastMove))) cls += ' last';
            if (tip && (sq === mFrom(tip) || sq === mTo(tip))) cls += ' tip';
            if (sq === kingSq) cls += ' check';
            if (sq === selected) cls += ' sel';
            if (targetSet.has(sq)) cls += piece || isEpTarget(sq) ? ' move cap' : ' move';
            b.className = cls;

            let html = '';
            if (piece) {
                html += `<span class="piece ${piece > 0 ? 'w' : 'b'}${sq === popSq ? ' pop' : ''}" aria-hidden="true">${GLYPH[Math.abs(piece)]}${TEXT_MODE}</span>`;
            }
            if (c === 0) html += `<span class="coord rank" aria-hidden="true">${8 - (sq >> 4)}</span>`;
            if (r === 7) html += `<span class="coord file" aria-hidden="true">${FILES[sq & 7]}</span>`;
            b.innerHTML = html;

            const name = Chess.sqName(sq);
            b.setAttribute('aria-label', piece
                ? `${name}, ${NAMES[Math.abs(piece)]} ${piece > 0 ? 'putih' : 'hitam'}${targetSet.has(sq) ? ', bisa ditangkap' : ''}`
                : `${name}, kosong${targetSet.has(sq) ? ', tujuan langkah' : ''}`);
        }
        popSq = -1;
        renderBars();
        renderMoves();
        renderStatus();
        el.btnUndo.disabled = history.length === 0;
        el.btnHint.disabled = over || thinking || hinting || st.turn !== playerColor;
        el.btnResign.disabled = over || history.length === 0;
    }

    function isEpTarget(sq) {
        return targets.some(m => mTo(m) === sq && mFlag(m) === 2);
    }

    const inCheckNow = () => Chess.inCheck(st);

    /* ---------- Bar pemain ---------- */
    function capturedBy(color) {
        return history.filter(h => h.mover === color && h.cap)
            .map(h => Math.abs(h.cap))
            .sort((a, b) => b - a);
    }

    function renderBars() {
        const bottom = flipped ? -1 : 1, top = -bottom;
        const fill = (color, who, cap, adv, bar) => {
            const isMe = color === playerColor;
            const levelName = Chess.LEVELS[level].name;
            who.innerHTML = isMe
                ? '<i class="fa-solid fa-user" aria-hidden="true"></i>Kamu'
                : `<i class="fa-solid fa-robot" aria-hidden="true"></i>Bot · ${levelName}` +
                  (thinking ? ' <i class="fa-solid fa-spinner fa-spin spinner" aria-hidden="true"></i>' : '');
            const mine = capturedBy(color);
            cap.innerHTML = mine.map(t => `<span class="${color === 1 ? 'b' : 'w'}">${GLYPH[t]}${TEXT_MODE}</span>`).join('');
            const diff = mine.reduce((s, t) => s + Chess.VAL[t], 0) - capturedBy(-color).reduce((s, t) => s + Chess.VAL[t], 0);
            adv.textContent = diff > 0 ? `+${Math.round(diff / 100)}` : '';
            bar.classList.toggle('active', !over && st.turn === color);
        };
        fill(top, el.whoTop, el.capTop, el.advTop, el.barTop);
        fill(bottom, el.whoBottom, el.capBottom, el.advBottom, el.barBottom);
    }

    /* ---------- Daftar langkah ---------- */
    function renderMoves() {
        if (!history.length) {
            el.moves.innerHTML = '<div class="moves-empty">Belum ada langkah.</div>';
            return;
        }
        let html = '';
        for (let i = 0; i < history.length; i += 2) {
            const w = history[i], b = history[i + 1];
            const wCur = i === history.length - 1, bCur = i + 1 === history.length - 1;
            html += `<div class="mv-row"><span class="mv-n">${i / 2 + 1}.</span>
                <span class="${wCur ? 'mv-cur' : ''}">${w.san}</span>
                <span class="${bCur ? 'mv-cur' : ''}">${b ? b.san : ''}</span></div>`;
        }
        el.moves.innerHTML = html;
        el.moves.scrollTop = el.moves.scrollHeight;
    }

    /* ---------- Status ---------- */
    function renderStatus() {
        let text, cls = '';
        if (over && endInfo) { text = endInfo.status; cls = endInfo.cls; }
        else if (thinking) text = 'Bot sedang berpikir...';
        else if (hinting) text = 'Mencari langkah terbaik...';
        else if (st.turn === playerColor) {
            text = inCheckNow() ? 'Skak! Selamatkan rajamu.' : 'Giliranmu. Pilih bidak untuk melangkah.';
            if (inCheckNow()) cls = 'warn';
        } else text = 'Giliran bot...';
        el.status.textContent = text;
        el.status.className = 'status-box ' + cls;
    }

    /* ============================================================
       Alur permainan
       ============================================================ */
    function refreshLegal() { legal = Chess.legalMoves(st); }

    function onSquare(sq) {
        if (over || thinking || st.turn !== playerColor || pendingPromo) return;
        tip = 0;
        if (selected >= 0) {
            const cand = targets.filter(m => mTo(m) === sq);
            if (cand.length) {
                if (cand.length > 1) { openPromo(cand); return; }
                playMove(cand[0]);
                return;
            }
        }
        const p = st.board[sq];
        if (p && sign(p) === playerColor && sq !== selected) {
            selected = sq;
            targets = legal.filter(m => mFrom(m) === sq);
        } else {
            selected = -1;
            targets = [];
        }
        render();
    }

    function playMove(m) {
        const mover = st.turn, to = mTo(m);
        let cap = st.board[to];
        if (mFlag(m) === 2) cap = -mover;
        const text = Chess.san(st, m, legal);
        Chess.make(st, m);
        history.push({ m, san: text, cap, mover });
        keys.push(Chess.positionKey(st));
        selected = -1; targets = []; tip = 0;
        lastMove = m; popSq = to;
        afterMove();
    }

    function afterMove() {
        refreshLegal();
        const res = Chess.status(st, keys);
        if (res.over) { finish(res); return; }
        render();
        if (st.turn !== playerColor) botTurn();
    }

    function botTurn() {
        thinking = true;
        const my = ++token;
        render();
        const t0 = performance.now();
        search(Chess.toFEN(st), level).then(m => {
            if (my !== token) return;
            const wait = Math.max(0, MIN_THINK_MS - (performance.now() - t0));
            setTimeout(() => {
                if (my !== token) return;
                thinking = false;
                if (m == null || !legal.includes(m)) m = legal[0];
                playMove(m);
            }, wait);
        });
    }

    function finish(res) {
        over = true;
        selected = -1; targets = [];
        const youWin = res.winner === playerColor;
        const texts = {
            checkmate: youWin
                ? ['Skakmat! Kamu menang', 'Raja bot terkepung. Permainan yang hebat!', 'Skakmat, kamu menang!', 'good']
                : ['Skakmat, bot menang', 'Rajamu terkepung. Coba lagi, atau turunkan level bot.', 'Skakmat, bot menang.', 'warn'],
            resign: ['Kamu menyerah', 'Bot menang karena kamu menyerah.', 'Kamu menyerah.', 'warn'],
            stalemate: ['Remis (stalemate)', 'Raja tidak bisa melangkah tapi tidak sedang skak.', 'Remis: stalemate.', ''],
            insufficient: ['Remis', 'Bidak yang tersisa tidak cukup untuk skakmat.', 'Remis: materi tidak cukup.', ''],
            fifty: ['Remis', 'Aturan 50 langkah: tidak ada tangkapan atau gerak pion.', 'Remis: aturan 50 langkah.', ''],
            repetition: ['Remis', 'Posisi yang sama muncul tiga kali.', 'Remis: posisi berulang tiga kali.', '']
        }[res.result];
        endInfo = { title: texts[0], text: texts[1], status: texts[2], cls: texts[3] };
        el.endTitle.textContent = endInfo.title;
        el.endText.textContent = endInfo.text;
        render();
        showOverlay(el.ovEnd);
    }

    function openPromo(cand) {
        pendingPromo = cand;
        const order = [5, 4, 3, 2];
        el.promoChoices.innerHTML = order.map(t =>
            `<button type="button" class="promo-btn ${playerColor === 1 ? 'w' : 'b'}" data-t="${t}" aria-label="${NAMES[t]}">${GLYPH[t]}${TEXT_MODE}</button>`).join('');
        showOverlay(el.ovPromo);
    }

    el.promoChoices.addEventListener('click', e => {
        const b = e.target.closest('.promo-btn');
        if (!b || !pendingPromo) return;
        const m = pendingPromo.find(x => mPromo(x) === Number(b.dataset.t));
        pendingPromo = null;
        hideOverlay(el.ovPromo);
        if (m) playMove(m);
    });

    function popOne() {
        const h = history.pop();
        Chess.unmake(st, h.m);
        keys.pop();
    }

    el.btnUndo.addEventListener('click', () => {
        if (!history.length) return;
        cancelSearch();
        hinting = false;
        popOne();
        if (history.length && st.turn !== playerColor) popOne();
        over = false; endInfo = null; selected = -1; targets = []; tip = 0;
        lastMove = history.length ? history[history.length - 1].m : 0;
        hideOverlay(el.ovEnd);
        refreshLegal();
        render();
        if (st.turn !== playerColor) botTurn();
    });

    el.btnHint.addEventListener('click', async () => {
        if (over || thinking || hinting || st.turn !== playerColor) return;
        hinting = true;
        const my = token;
        render();
        const m = await search(Chess.toFEN(st), { depth: 4, noise: 0, time: 1200 });
        hinting = false;
        if (my === token && m && !over && st.turn === playerColor) { tip = m; selected = -1; targets = []; }
        render();
    });

    el.btnFlip.addEventListener('click', () => { flipped = !flipped; render(); });

    el.btnResign.addEventListener('click', () => {
        if (over || !history.length) return;
        if (!confirm('Yakin ingin menyerah?')) return;
        cancelSearch();
        finish({ over: true, result: 'resign', winner: -playerColor });
    });

    el.btnNew.addEventListener('click', () => { cancelSearch(); hinting = false; render(); showOverlay(el.ovSetup); });

    el.levelSelect.addEventListener('change', () => {
        level = Number(el.levelSelect.value);
        render();
    });

    $('btn-again').addEventListener('click', () => { hideOverlay(el.ovEnd); showOverlay(el.ovSetup); });
    $('btn-view').addEventListener('click', () => hideOverlay(el.ovEnd));

    /* ---------- Overlay pengaturan ---------- */
    function checkedValue(name) { return document.querySelector(`input[name="${name}"]:checked`).value; }

    function updateLevelDesc() { el.levelDesc.textContent = LEVEL_DESC[checkedValue('level')]; }
    document.querySelectorAll('input[name="level"]').forEach(r => r.addEventListener('change', updateLevelDesc));

    $('btn-start').addEventListener('click', () => {
        const c = checkedValue('color');
        playerColor = c === 'w' ? 1 : c === 'b' ? -1 : (Math.random() < 0.5 ? 1 : -1);
        level = Number(checkedValue('level'));
        el.levelSelect.value = String(level);
        newGame();
        hideOverlay(el.ovSetup);
    });

    function newGame() {
        cancelSearch();
        hinting = false;
        st = Chess.fromFEN(Chess.START);
        history = []; keys = [Chess.positionKey(st)];
        over = false; endInfo = null; pendingPromo = null;
        selected = -1; targets = []; lastMove = 0; tip = 0;
        flipped = playerColor === -1;
        refreshLegal();
        render();
        if (st.turn !== playerColor) botTurn();
    }

    /* ---------- Overlay util ---------- */
    function showOverlay(o) {
        o.hidden = false;
        const first = o.querySelector('input:checked, button');
        if (first) first.focus();
    }
    function hideOverlay(o) { o.hidden = true; }

    /* ---------- Mulai ---------- */
    buildBoard();
    createWorker();
    st = Chess.fromFEN(Chess.START);
    keys = [Chess.positionKey(st)];
    refreshLegal();
    updateLevelDesc();
    render();
    showOverlay(el.ovSetup);
})();