(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const S = Sudoku;

    // ---- state ----
    let puzzle = null, solution = null;
    let vals = new Int8Array(81);
    let notes = new Int16Array(81);
    let selected = -1, notesMode = false, autoCheck = true;
    let mistakes = 0, hints = 0, level = 3;
    let elapsed = 0, lastTick = 0, running = false;
    let undoStack = [];
    let hintInfo = null;
    let showErrors = false, finished = false, busy = false;
    let statusText = '', statusCls = '';
    let maxMistakes = 3, kbdMode = false, lost = false;

    const cells = [];
    const el = {
        board: $('board'), panel: $('panel'), status: $('status'), numpad: $('numpad'),
        time: $('stat-time'), miss: $('stat-miss'), hint: $('stat-hint'),
        progress: $('progress'), bar: $('progress-bar'),
        btnNotes: $('btn-notes'), btnUndo: $('btn-undo'), btnHint: $('btn-hint'), btnNew: $('btn-new'),
        ovSetup: $('overlay-setup'), ovWin: $('overlay-win'), levelDesc: $('level-desc'),
        winText: $('win-text'), winTime: $('win-time'), winMiss: $('win-miss'), winHint: $('win-hint'),
        missBox: $('stat-miss-box'), miniTime: $('mini-time'), miniMiss: $('mini-miss'), miniHint: $('mini-hint'), miniMissBox: $('mini-miss-box'),
        btnKbd: $('btn-kbd'), kbd: $('kbd-input'),
        ovLose: $('overlay-lose'), loseText: $('lose-text'), loseTime: $('lose-time'), loseMiss: $('lose-miss'), loseFill: $('lose-fill'),
        optMax: $('opt-max'), maxBlock: $('max-block'), maxDesc: $('max-desc')
    };

    /* ============================================================
       Membangun papan & numpad
       ============================================================ */
    function buildBoard() {
        for (let i = 0; i < 81; i++) {
            const r = S.ROW[i], c = S.COL[i];
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'cell';
            if (c === 2 || c === 5) b.classList.add('rb');
            if (r === 2 || r === 5) b.classList.add('bb');
            if (c === 8) b.classList.add('rl');
            if (r === 8) b.classList.add('bl');
            b.dataset.i = i;
            b.style.setProperty('--d', r + c);
            b.tabIndex = i === 0 ? 0 : -1;
            el.board.appendChild(b);
            cells.push(b);
        }
        el.board.addEventListener('click', e => {
            const b = e.target.closest('.cell');
            if (b) select(Number(b.dataset.i), true);
        });

        let html = '';
        for (let v = 1; v <= 9; v++) html += `<button type="button" class="num-btn" data-v="${v}">${v}<small></small></button>`;
        html += '<button type="button" class="num-btn erase" data-v="0" aria-label="Hapus isi kotak"><i class="fa-solid fa-delete-left"></i></button>';
        el.numpad.innerHTML = html;
        // Saat mode keyboard HP aktif, jangan ambil fokus dari input agar keyboard tidak menutup
        el.panel.addEventListener('mousedown', e => { if (kbdMode && e.target.closest('button')) e.preventDefault(); });
        el.numpad.addEventListener('click', e => {
            const b = e.target.closest('.num-btn');
            if (!b) return;
            const v = Number(b.dataset.v);
            if (v === 0) erase(); else enter(v);
        });
    }

    /* ============================================================
       Render
       ============================================================ */
    function conflicts(i) {
        const v = vals[i];
        if (!v) return false;
        const p = S.PEERS[i];
        for (let k = 0; k < p.length; k++) if (vals[p[k]] === v) return true;
        return false;
    }

    function render() {
        const sv = selected >= 0 ? vals[selected] : 0;
        const peerSet = selected >= 0 ? new Set(S.PEERS[selected]) : null;
        let filled = 0;
        const count = new Int8Array(10);

        for (let i = 0; i < 81; i++) {
            const b = cells[i], v = vals[i], given = puzzle && puzzle[i] !== 0;
            if (v) { filled++; count[v]++; }

            let cls = b.className.split(' ').filter(c => ['cell', 'rb', 'bb', 'rl', 'bl'].includes(c));
            if (given) cls.push('given');
            if (i === selected) cls.push('sel');
            else if (peerSet && peerSet.has(i)) cls.push('peer');
            if (sv && v === sv && i !== selected) cls.push('same');
            if (hintInfo && hintInfo.i === i) cls.push('hint');
            if (v && !given && ((autoCheck || showErrors) && solution && v !== solution[i] || conflicts(i))) cls.push('bad');
            b.className = cls.join(' ');

            let html = '';
            if (v) html = String(v);
            else if (notes[i]) {
                html = '<span class="notes" aria-hidden="true">';
                for (let n = 1; n <= 9; n++) html += `<i>${notes[i] & (1 << n) ? n : ''}</i>`;
                html += '</span>';
            }
            if (b.dataset.html !== html) { b.innerHTML = html; b.dataset.html = html; }

            const pos = `Baris ${S.ROW[i] + 1}, kolom ${S.COL[i] + 1}`;
            b.setAttribute('aria-label', v
                ? `${pos}, ${given ? 'angka awal' : 'isian'} ${v}`
                : `${pos}, kosong${notes[i] ? ', ada catatan' : ''}`);
        }

        // Numpad: sisa angka
        el.numpad.querySelectorAll('.num-btn:not(.erase)').forEach(b => {
            const v = Number(b.dataset.v), left = 9 - count[v];
            b.disabled = busy || finished || left <= 0;
            b.querySelector('small').textContent = left > 0 ? left : '';
            b.setAttribute('aria-label', `Isi angka ${v}, sisa ${Math.max(left, 0)}`);
        });
        el.numpad.querySelector('.erase').disabled = busy || finished || selected < 0;
        el.panel.classList.toggle('notes-mode', notesMode);

        el.btnNotes.setAttribute('aria-pressed', String(notesMode));
        el.btnNotes.innerHTML = `<i class="fa-solid fa-pencil me-1"></i> Catatan: ${notesMode ? 'Aktif' : 'Mati'}`;
        el.btnUndo.disabled = busy || finished || undoStack.length === 0;
        el.btnHint.disabled = busy || finished;
        const missTxt = limitActive() ? `${mistakes}/${maxMistakes}` : String(mistakes);
        const danger = limitActive() && !finished && mistakes >= maxMistakes - 1 && mistakes > 0;
        el.miss.textContent = missTxt;
        el.hint.textContent = hints;
        el.miniMiss.textContent = missTxt;
        el.miniHint.textContent = hints;
        el.missBox.classList.toggle('danger', danger);
        el.miniMissBox.classList.toggle('danger', danger);
        el.bar.style.width = (filled / 81 * 100) + '%';
        el.progress.setAttribute('aria-valuenow', filled);
        el.time.textContent = fmt(elapsed);
        el.miniTime.textContent = fmt(elapsed);
    }

    function limitActive() { return autoCheck && maxMistakes > 0; }

    function setStatus(text, cls) {
        statusText = text; statusCls = cls || '';
        el.status.textContent = text;
        el.status.className = 'status-box ' + statusCls;
    }

    const fmt = ms => {
        const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        const p = n => String(n).padStart(2, '0');
        return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
    };

    /* ============================================================
       Aksi pemain
       ============================================================ */
    function select(i, focus) {
        if (finished || busy) return;
        selected = i;
        cells.forEach((c, k) => { c.tabIndex = k === i ? 0 : -1; });
        if (focus) { if (kbdMode) focusKbd(); else cells[i].focus(); }
        render();
    }

    // Menyimpan keadaan kotak yang akan berubah supaya bisa diurungkan
    function snapshot(indices) {
        return indices.map(i => ({ i, v: vals[i], n: notes[i] }));
    }

    function enter(v) {
        if (finished || busy || selected < 0) {
            if (selected < 0 && !finished) setStatus('Pilih kotak dulu, lalu isi angkanya.');
            return;
        }
        const i = selected;
        if (puzzle[i] !== 0) { setStatus('Kotak ini angka awal dan tidak bisa diubah.'); return; }
        clearHint();

        if (notesMode) {
            if (vals[i]) { setStatus('Hapus isian kotak ini dulu untuk memakai catatan.'); return; }
            undoStack.push(snapshot([i]));
            notes[i] ^= (1 << v);
            render();
            return;
        }

        if (vals[i] === v) { erase(); return; }
        const affected = [i].concat(S.PEERS[i].filter(p => notes[p] & (1 << v)));
        undoStack.push(snapshot(affected));
        vals[i] = v;
        notes[i] = 0;
        S.PEERS[i].forEach(p => { notes[p] &= ~(1 << v); });

        let over = false;
        if (autoCheck && v !== solution[i]) {
            mistakes++;
            shakeBoard();
            over = limitActive() && mistakes >= maxMistakes;
            const left = limitActive() ? ` Sisa kesempatan: ${Math.max(0, maxMistakes - mistakes)}.` : '';
            setStatus(`Angka ${v} di baris ${S.ROW[i] + 1}, kolom ${S.COL[i] + 1} salah.${left}`, 'warn');
        } else if (statusCls === 'warn' || statusCls === 'tip') setStatus('Lanjutkan, kamu di jalur yang benar.');

        render();
        if (over) { lose(); return; }
        checkWin();
    }

    function erase() {
        if (finished || busy || selected < 0) return;
        const i = selected;
        if (puzzle[i] !== 0) return;
        if (!vals[i] && !notes[i]) return;
        clearHint();
        undoStack.push(snapshot([i]));
        vals[i] = 0; notes[i] = 0;
        render();
    }

    function undo() {
        if (finished || busy || !undoStack.length) return;
        const step = undoStack.pop();
        step.forEach(s => { vals[s.i] = s.v; notes[s.i] = s.n; });
        clearHint();
        render();
    }

    function clearHint() { hintInfo = null; if (statusCls === 'tip') setStatus(''); }

    function checkWin() {
        for (let i = 0; i < 81; i++) if (!vals[i]) return;
        let ok = true;
        for (let i = 0; i < 81; i++) if (vals[i] !== solution[i]) { ok = false; break; }
        if (ok) { win(); return; }
        if (!showErrors) { showErrors = true; render(); }
        setStatus('Papan sudah penuh, tapi masih ada angka yang salah (merah). Perbaiki dulu ya.', 'warn');
    }

    function win() {
        finished = true; running = false;
        selected = -1; hintInfo = null;
        el.board.classList.add('won');
        render();
        setStatus('Selamat! Puzzle selesai dengan benar.', 'good');
        el.winTime.textContent = fmt(elapsed);
        el.winMiss.textContent = mistakes;
        el.winHint.textContent = hints;
        el.winText.textContent = `Level ${S.LEVELS[level].name} berhasil kamu selesaikan.` +
            (mistakes === 0 && hints === 0 ? ' Tanpa salah dan tanpa petunjuk. Luar biasa!' : '');
        setTimeout(() => { if (finished) showOverlay(el.ovWin); }, 1100);
    }

    function shakeBoard() {
        el.board.classList.remove('shake');
        void el.board.offsetWidth;
        el.board.classList.add('shake');
        if (navigator.vibrate) navigator.vibrate(60);
    }

    function lose() {
        finished = true; lost = true; running = false;
        selected = -1; hintInfo = null;
        el.kbd.blur();
        el.board.classList.add('lost');
        render();
        setStatus(`Game over: kesalahan sudah mencapai batas (${maxMistakes}). Mulai lagi untuk mencoba puzzle baru.`, 'warn');
        let filled = 0;
        for (let i = 0; i < 81; i++) if (vals[i]) filled++;
        el.loseText.textContent = `Kamu mencapai batas ${maxMistakes} kesalahan di level ${S.LEVELS[level].name}.`;
        el.loseTime.textContent = fmt(elapsed);
        el.loseMiss.textContent = mistakes;
        el.loseFill.textContent = Math.round(filled / 81 * 100) + '%';
        setTimeout(() => { if (lost) showOverlay(el.ovLose); }, 700);
    }

    /* ---------- Petunjuk ---------- */
    function trustedGrid() {
        const g = new Int8Array(81);
        for (let i = 0; i < 81; i++) g[i] = vals[i] && vals[i] === solution[i] ? vals[i] : 0;
        return g;
    }

    function cellName(i) { return `baris ${S.ROW[i] + 1}, kolom ${S.COL[i] + 1}`; }

    function giveHint() {
        if (finished || busy) return;

        // Tekan lagi saat petunjuk aktif: isi otomatis
        if (hintInfo && !vals[hintInfo.i]) {
            const h = hintInfo;
            hintInfo = null;
            selected = h.i;
            undoStack.push(snapshot([h.i].concat(S.PEERS[h.i].filter(p => notes[p] & (1 << h.v)))));
            vals[h.i] = h.v; notes[h.i] = 0;
            S.PEERS[h.i].forEach(p => { notes[p] &= ~(1 << h.v); });
            setStatus(`Terisi: angka ${h.v} di ${cellName(h.i)}.`, 'tip');
            render();
            checkWin();
            return;
        }

        const h = S.findHint(trustedGrid(), solution);
        if (!h) { setStatus('Tidak ada petunjuk lagi. Periksa isianmu.'); return; }
        hints++;
        hintInfo = { i: h.i, v: h.v };
        selected = h.i;
        cells.forEach((c, k) => { c.tabIndex = k === h.i ? 0 : -1; });

        let msg;
        if (h.type === 'naked') {
            msg = `Petunjuk: ${cellName(h.i)} hanya bisa diisi ${h.v}, karena angka lainnya sudah ada di baris, kolom, atau kotaknya.`;
        } else if (h.type === 'hidden') {
            const where = h.unit === 'kotak' ? `kotak ${h.unitIndex + 1}` : `${h.unit} ${h.unitIndex + 1}`;
            msg = `Petunjuk: di ${where}, angka ${h.v} hanya punya satu tempat yang mungkin, yaitu ${cellName(h.i)}.`;
        } else {
            msg = `Petunjuk: tidak ada langkah logika sederhana. Kotak di ${cellName(h.i)} berisi ${h.v}.`;
        }
        setStatus(msg + ' Tekan Petunjuk lagi untuk mengisinya.', 'tip');
        render();
    }

    /* ============================================================
       Permainan baru
       ============================================================ */
    function newGame() {
        busy = true; finished = false; running = false; lost = false;
        el.board.classList.remove('won', 'lost', 'shake');
        el.board.classList.add('loading');
        setStatus('Membuat puzzle...');
        selected = -1; hintInfo = null; showErrors = false;
        render();

        setTimeout(() => {
            const p = S.generate(level, 2500);
            puzzle = p.puzzle; solution = p.solution;
            vals = Int8Array.from(puzzle);
            notes = new Int16Array(81);
            undoStack = []; mistakes = 0; hints = 0; elapsed = 0;
            notesMode = false;
            busy = false;
            el.board.classList.remove('loading');
            lastTick = performance.now(); running = true;
            // pilih kotak kosong pertama
            const first = vals.findIndex(v => v === 0);
            selected = first >= 0 ? first : 0;
            cells.forEach((c, k) => { c.tabIndex = k === selected ? 0 : -1; c.dataset.html = '\u0000'; });
            setStatus(`Level ${S.LEVELS[level].name}: ${p.clues} angka awal. Pilih kotak lalu isi angkanya.`);
            render();
        }, 40);
    }

    /* ---------- Waktu ---------- */
    setInterval(() => {
        const now = performance.now();
        if (running && !document.hidden) elapsed += now - lastTick;
        lastTick = now;
        if (running) { el.time.textContent = fmt(elapsed); el.miniTime.textContent = fmt(elapsed); }
    }, 250);

    /* ---------- Keyboard ---------- */
    document.addEventListener('keydown', e => {
        if (!el.ovSetup.hidden || !el.ovWin.hidden || !el.ovLose.hidden) return;
        if (e.target && e.target.matches && e.target.matches('input, textarea, select')) return;
        const k = e.key;

        if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (k >= '1' && k <= '9') { enter(Number(k)); return; }
        if (k === 'Backspace' || k === 'Delete' || k === '0') { e.preventDefault(); erase(); return; }
        if (k === 'n' || k === 'N') { notesMode = !notesMode; render(); return; }
        if (k === 'h' || k === 'H') { giveHint(); return; }

        const move = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[k];
        if (move && !finished && !busy) {
            e.preventDefault();
            const from = selected < 0 ? 0 : selected;
            const r = Math.min(8, Math.max(0, S.ROW[from] + move[0]));
            const c = Math.min(8, Math.max(0, S.COL[from] + move[1]));
            select(r * 9 + c, true);
        }
    });

    /* ---------- Tombol & overlay ---------- */
    el.btnNotes.addEventListener('click', () => { notesMode = !notesMode; render(); });
    el.btnUndo.addEventListener('click', undo);
    el.btnHint.addEventListener('click', giveHint);
    el.btnNew.addEventListener('click', () => showOverlay(el.ovSetup));

    /* ---------- Keyboard HP (input angka lewat keyboard bawaan ponsel) ---------- */
    const SENTINEL = ' ';
    function resetKbd() { el.kbd.value = SENTINEL; }
    function modalOpen() { return !el.ovSetup.hidden || !el.ovWin.hidden || !el.ovLose.hidden; }
    function focusKbd() {
        if (!kbdMode || modalOpen() || finished || busy) return;
        resetKbd();
        el.kbd.focus({ preventScroll: true });
    }
    function updateKbdBtn() {
        el.btnKbd.setAttribute('aria-pressed', String(kbdMode));
        el.btnKbd.innerHTML = `<i class="fa-solid fa-keyboard me-1"></i> Keyboard HP: ${kbdMode ? 'Aktif' : 'Mati'}`;
    }
    el.btnKbd.addEventListener('click', () => {
        kbdMode = !kbdMode;
        updateKbdBtn();
        if (kbdMode) {
            if (selected < 0 && !finished && !busy) { const f = vals.findIndex(v => v === 0); if (f >= 0) select(f, false); }
            focusKbd();
            setStatus('Keyboard HP aktif. Ketuk kotak, lalu ketik angkanya.');
        } else {
            el.kbd.blur();
            setStatus('Keyboard HP dimatikan.');
        }
    });
    resetKbd();
    el.kbd.addEventListener('input', e => {
        const v = el.kbd.value;
        resetKbd();
        if (modalOpen()) return;
        if (v.length === 0 || e.inputType === 'deleteContentBackward') { erase(); return; }
        const ch = v.slice(-1);
        if (ch >= '1' && ch <= '9') enter(Number(ch));
        else if (ch === '0') erase();
        else if (ch === 'n' || ch === 'N') { notesMode = !notesMode; render(); }
        else if (ch === 'h' || ch === 'H') giveHint();
    });
    el.kbd.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
        const move = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
        if (move && !finished && !busy) {
            e.preventDefault();
            const from = selected < 0 ? 0 : selected;
            select(Math.min(8, Math.max(0, S.ROW[from] + move[0])) * 9 + Math.min(8, Math.max(0, S.COL[from] + move[1])), true);
        }
    });

    /* ---------- Batas kesalahan (pengaturan) ---------- */
    function readMax() {
        const n = parseInt(el.optMax.value, 10);
        return isNaN(n) ? 0 : Math.min(99, Math.max(0, n));
    }
    function syncMaxUI() {
        const n = readMax();
        document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(Number(c.dataset.v) === n && String(n) === el.optMax.value.trim())));
        el.maxDesc.textContent = !$('opt-check').checked
            ? 'Aktifkan "Tandai kesalahan otomatis" agar batas kesalahan bisa dipakai.'
            : (n === 0 ? 'Tidak ada batas. Kamu boleh salah sebanyak apa pun.'
                       : `Permainan berakhir jika kamu membuat ${n} kesalahan.`);
        el.maxBlock.classList.toggle('off', !$('opt-check').checked);
    }
    document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { el.optMax.value = c.dataset.v; syncMaxUI(); }));
    el.optMax.addEventListener('input', syncMaxUI);
    el.optMax.addEventListener('change', () => { el.optMax.value = readMax(); syncMaxUI(); });
    $('opt-check').addEventListener('change', syncMaxUI);
    syncMaxUI();

    $('btn-retry').addEventListener('click', () => { hideOverlay(el.ovLose); showOverlay(el.ovSetup); });
    $('btn-lose-view').addEventListener('click', () => hideOverlay(el.ovLose));

    function checkedLevel() { return Number(document.querySelector('input[name="level"]:checked').value); }
    function updateLevelDesc() {
        const l = checkedLevel();
        el.levelDesc.textContent = `${S.LEVELS[l].desc} (sekitar ${S.LEVELS[l].clues} angka awal)`;
    }
    document.querySelectorAll('input[name="level"]').forEach(r => r.addEventListener('change', updateLevelDesc));

    $('btn-start').addEventListener('click', () => {
        level = checkedLevel();
        autoCheck = $('opt-check').checked;
        maxMistakes = readMax();
        el.optMax.value = maxMistakes;
        hideOverlay(el.ovSetup);
        newGame();
    });
    $('btn-again').addEventListener('click', () => { hideOverlay(el.ovWin); showOverlay(el.ovSetup); });
    $('btn-view').addEventListener('click', () => hideOverlay(el.ovWin));

    function showOverlay(o) {
        o.hidden = false;
        const first = o.querySelector('input:checked, button');
        if (first) first.focus();
    }
    function hideOverlay(o) {
        o.hidden = true;
        if (kbdMode) { if (selected >= 0) focusKbd(); }
        else if (selected >= 0 && cells[selected]) cells[selected].focus();
    }

    /* ---------- Mulai ---------- */
    buildBoard();
    puzzle = new Int8Array(81); solution = new Int8Array(81);
    updateLevelDesc();
    setStatus('Atur level untuk memulai.');
    render();
    showOverlay(el.ovSetup);
})();