(function () {
"use strict";

const IMG_SIZE = 800;
let imageURL = '';
let cols = 4, rows = 4;
let totalPieces = 16;
let boardState = [];
let trayPieces = [];
let selectedPiece = null;

let moves = 0;
let seconds = 0;
let timerId = null;
let started = false;
let solved = false;
let winModal = null;

let boardEl, trayEl, statusEl, timeEl, movesEl, correctEl, sliderEl, numberEl, countEl, previewEl, fileInput, uploadZone;

const PRESETS = [
    { name: 'Neon Sunset', draw: drawSunset },
    { name: 'Cyber City', draw: drawCity },
    { name: 'Galaxy', draw: drawGalaxy },
    { name: 'Circuit', draw: drawCircuit }
];

function seeded(seed) {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function drawSunset(c, S) {
    let g = c.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#1a0638'); g.addColorStop(0.55, '#7b2cbf'); g.addColorStop(1, '#ff4d9d');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    g = c.createLinearGradient(0, S * 0.25, 0, S * 0.62);
    g.addColorStop(0, '#ffe66d'); g.addColorStop(1, '#ff4d9d');
    c.fillStyle = g; c.beginPath(); c.arc(S / 2, S * 0.45, S * 0.22, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7b2cbf';
    for (let i = 0; i < 6; i++) c.fillRect(S * 0.25, S * (0.42 + i * 0.03), S * 0.5, 3 + i * 2);
    c.fillStyle = '#0a0813'; c.fillRect(0, S * 0.62, S, S * 0.38);
    c.strokeStyle = '#c77dff'; c.lineWidth = 2;
    for (let i = 0; i <= 14; i++) {
        c.beginPath(); c.moveTo(S / 2, S * 0.62); c.lineTo((i / 14) * S * 3 - S, S); c.stroke();
    }
}

function drawCity(c, S) {
    const r = seeded(7);
    let g = c.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#05010f'); g.addColorStop(1, '#3c096c');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    c.fillStyle = '#fff';
    for (let i = 0; i < 80; i++) c.fillRect(r() * S, r() * S * 0.5, 2, 2);
    for (let layer = 0; layer < 3; layer++) {
        let x = -20;
        while (x < S) {
            const w = 50 + r() * 70, h = S * (0.25 + r() * 0.4) - layer * 30;
            c.fillStyle = ['#10002b', '#240046', '#3c096c'][layer];
            c.fillRect(x, S - h, w, h);
            c.fillStyle = ['#00f5d4', '#c77dff', '#ff4d9d'][Math.floor(r() * 3)];
            for (let wy = S - h + 14; wy < S - 10; wy += 22)
                for (let wx = x + 8; wx < x + w - 10; wx += 16)
                    if (r() > 0.55) c.fillRect(wx, wy, 6, 9);
            x += w + 4;
        }
    }
}

function drawGalaxy(c, S) {
    const r = seeded(21);
    c.fillStyle = '#05010f'; c.fillRect(0, 0, S, S);
    [['#9d4edd', 0.3, 0.35], ['#00f5d4', 0.75, 0.7], ['#ff4d9d', 0.6, 0.2]].forEach(([col, x, y]) => {
        const g = c.createRadialGradient(S * x, S * y, 0, S * x, S * y, S * 0.5);
        g.addColorStop(0, col + 'aa'); g.addColorStop(1, 'transparent');
        c.fillStyle = g; c.fillRect(0, 0, S, S);
    });
    const g = c.createRadialGradient(S * 0.38, S * 0.6, 10, S * 0.45, S * 0.67, S * 0.2);
    g.addColorStop(0, '#ffe66d'); g.addColorStop(0.5, '#ff7b00'); g.addColorStop(1, '#5a189a');
    c.fillStyle = g; c.beginPath(); c.arc(S * 0.45, S * 0.67, S * 0.17, 0, 7); c.fill();
    c.strokeStyle = 'rgba(199,125,255,0.85)'; c.lineWidth = 8;
    c.beginPath(); c.ellipse(S * 0.45, S * 0.67, S * 0.3, S * 0.07, -0.4, 0, 7); c.stroke();
}

function drawCircuit(c, S) {
    const r = seeded(99);
    c.fillStyle = '#0a0813'; c.fillRect(0, 0, S, S);
    const colsArr = ['#00f5d4', '#c77dff', '#ff4d9d', '#ffe66d'];
    c.lineWidth = 4; c.lineCap = 'round';
    for (let i = 0; i < 38; i++) {
        let x = Math.floor(r() * 10) * 80 + 40, y = Math.floor(r() * 10) * 80 + 40;
        const col = colsArr[Math.floor(r() * 4)];
        c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 12;
        c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
            if (r() > 0.5) x += (r() > 0.5 ? 1 : -1) * 80 * (1 + Math.floor(r() * 2));
            else y += (r() > 0.5 ? 1 : -1) * 80 * (1 + Math.floor(r() * 2));
            c.lineTo(x, y);
        }
        c.stroke();
        c.fillStyle = col; c.beginPath(); c.arc(x, y, 10, 0, 7); c.fill();
    }
}

function makePresetCanvas(preset, size) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.scale(size / IMG_SIZE, size / IMG_SIZE);
    preset.draw(ctx, IMG_SIZE);
    return cv;
}

document.addEventListener('DOMContentLoaded', () => {
    boardEl = document.getElementById('board');
    trayEl = document.getElementById('tray-grid');
    statusEl = document.getElementById('status-text');
    timeEl = document.getElementById('stat-time');
    movesEl = document.getElementById('stat-moves');
    correctEl = document.getElementById('stat-correct');
    sliderEl = document.getElementById('piece-slider');
    numberEl = document.getElementById('piece-number');
    countEl = document.getElementById('piece-count');
    previewEl = document.getElementById('preview-box');
    fileInput = document.getElementById('file-input');
    uploadZone = document.getElementById('upload-zone');
    winModal = new bootstrap.Modal(document.getElementById('winModal'));

    buildPresetGallery();
    bindEvents();
    updateSliderLabel();
    selectPreset(0);
});

function buildPresetGallery() {
    const wrap = document.getElementById('preset-grid');
    PRESETS.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset-thumb';
        btn.appendChild(makePresetCanvas(p, 200));
        const label = document.createElement('span');
        label.textContent = p.name;
        btn.appendChild(label);
        btn.addEventListener('click', () => selectPreset(i));
        wrap.appendChild(btn);
    });
}

function bindEvents() {
    sliderEl.addEventListener('input', () => { numberEl.value = sliderEl.value; updateSliderLabel(); });
    numberEl.addEventListener('input', () => {
        const v = parseInt(numberEl.value, 10);
        if (isNaN(v)) return;
        sliderEl.value = Math.min(400, Math.max(1, v));
        updateSliderLabel();
    });

    document.getElementById('apply-btn').addEventListener('click', () => newGame());
    document.getElementById('shuffle-btn').addEventListener('click', () => newGame());

    const peekBtn = document.getElementById('peek-btn');
    const startPeek = e => { e.preventDefault(); if (imageURL) { setPeek(true); peekBtn.classList.add('active'); } };
    const endPeek = () => { setPeek(false); peekBtn.classList.remove('active'); };
    peekBtn.addEventListener('mousedown', startPeek);
    peekBtn.addEventListener('touchstart', startPeek, { passive: false });
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel', 'blur'].forEach(ev => peekBtn.addEventListener(ev, endPeek));

    const numBtn = document.getElementById('num-btn');
    numBtn.addEventListener('click', () => {
        const on = boardEl.classList.toggle('show-numbers');
        trayEl.classList.toggle('show-numbers');
        numBtn.classList.toggle('active', on);
    });

    document.getElementById('hint-btn').addEventListener('click', giveHint);

    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });

    document.getElementById('win-again').addEventListener('click', () => { winModal.hide(); newGame(); });
    document.getElementById('win-close').addEventListener('click', () => winModal.hide());
}

function layoutFor(n) {
    let best = { c: 1, r: 1, diff: Infinity, ratio: Infinity };
    for (let r = 1; r <= 20; r++) {
        for (let c = r; c <= Math.min(20, r * 2); c++) {
            const diff = Math.abs(c * r - n);
            const ratio = c / r;
            if (diff < best.diff || (diff === best.diff && ratio < best.ratio)) best = { c, r, diff, ratio };
        }
    }
    return best;
}

function updateSliderLabel() {
    const l = layoutFor(parseInt(sliderEl.value, 10));
    countEl.innerHTML = `${l.c * l.r} <small>pecahan (${l.c}×${l.r})</small>`;
}

function setStatus(icon, text) {
    statusEl.innerHTML = `<i class="fa-solid ${icon} me-1"></i> ${text}`;
}

function setImage(canvas) {
    imageURL = canvas.toDataURL('image/jpeg', 0.92);
    previewEl.innerHTML = '';
    const img = new Image();
    img.src = imageURL;
    previewEl.appendChild(img);
    newGame();
}

function selectPreset(i) {
    document.querySelectorAll('.preset-thumb').forEach((el, idx) => el.classList.toggle('active', idx === i));
    setImage(makePresetCanvas(PRESETS[i], IMG_SIZE));
}

function loadFile(file) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const side = Math.min(img.width, img.height);
            const cv = document.createElement('canvas');
            cv.width = cv.height = IMG_SIZE;
            cv.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, IMG_SIZE, IMG_SIZE);
            document.querySelectorAll('.preset-thumb').forEach(el => el.classList.remove('active'));
            setImage(cv);
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function newGame() {
    if (!imageURL) return;
    const l = layoutFor(parseInt(sliderEl.value, 10));
    cols = l.c; rows = l.r;
    totalPieces = cols * rows;

    stopTimer();
    seconds = 0; moves = 0; selectedPiece = null;
    started = false; solved = false;
    boardEl.classList.remove('solved');

    boardState = Array(totalPieces).fill(null);
    trayPieces = Array.from({ length: totalPieces }, (_, i) => i);

    for (let i = trayPieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [trayPieces[i], trayPieces[j]] = [trayPieces[j], trayPieces[i]];
    }

    updateStats();
    renderBoard();
    renderTray();
    setStatus('fa-hand-pointer', 'Pasangkan pecahan dari wadah ke bingkai');
}

function countCorrect() {
    return boardState.reduce((n, id, slot) => n + (id === slot ? 1 : 0), 0);
}

function renderBoard() {
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    boardEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    for (let slot = 0; slot < totalPieces; slot++) {
        const slotEl = document.createElement('div');
        slotEl.className = 'slot';
        slotEl.dataset.slot = slot;
        slotEl.dataset.num = slot + 1;

        const pieceId = boardState[slot];

        if (pieceId !== null) {
            const pieceEl = createPieceElement(pieceId, 'slot', slot);
            slotEl.appendChild(pieceEl);
        }

        slotEl.addEventListener('dragover', e => { e.preventDefault(); slotEl.classList.add('over'); });
        slotEl.addEventListener('dragleave', () => slotEl.classList.remove('over'));
        slotEl.addEventListener('drop', e => {
            e.preventDefault();
            slotEl.classList.remove('over');
            if (selectedPiece) {
                placePieceToSlot(selectedPiece, slot);
            }
        });

        slotEl.addEventListener('click', () => {
            if (selectedPiece) {
                placePieceToSlot(selectedPiece, slot);
            } else if (boardState[slot] !== null) {
                selectedPiece = { from: 'slot', index: slot, id: boardState[slot] };
                renderBoard();
                renderTray();
            }
        });

        boardEl.appendChild(slotEl);
    }
    updateStats();
}

function renderTray() {
    trayEl.innerHTML = '';
    
    const boardWidth = boardEl.clientWidth || 500;
    const pieceSize = Math.max(35, Math.min(75, Math.floor(boardWidth / cols) - 4));

    trayPieces.forEach((pieceId, idx) => {
        const pieceEl = createPieceElement(pieceId, 'tray', idx);
        pieceEl.style.width = `${pieceSize}px`;
        pieceEl.style.height = `${pieceSize}px`;

        pieceEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedPiece && selectedPiece.from === 'tray' && selectedPiece.index === idx) {
                selectedPiece = null;
            } else {
                selectedPiece = { from: 'tray', index: idx, id: pieceId };
            }
            renderBoard();
            renderTray();
        });

        trayEl.appendChild(pieceEl);
    });
}

function createPieceElement(id, from, index) {
    const el = document.createElement('div');
    el.className = 'piece';
    el.dataset.num = id + 1;
    el.style.width = '100%';
    el.style.height = '100%';

    const col = id % cols, row = Math.floor(id / cols);
    el.style.backgroundImage = `url(${imageURL})`;
    el.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
    el.style.backgroundPosition = bgPos(col, row);

    if (selectedPiece && selectedPiece.from === from && selectedPiece.index === index) {
        el.classList.add('selected');
    }

    el.draggable = !solved;
    el.addEventListener('dragstart', () => {
        selectedPiece = { from, index, id };
        el.classList.add('dragging');
    });

    return el;
}

function placePieceToSlot(source, targetSlot) {
    if (solved) return;

    if (!started) {
        started = true;
        startTimer();
        setStatus('fa-bolt', 'Sedang bermain');
    }

    const existingPieceInSlot = boardState[targetSlot];

    if (source.from === 'tray') {
        boardState[targetSlot] = source.id;
        trayPieces.splice(source.index, 1);
        if (existingPieceInSlot !== null) {
            trayPieces.push(existingPieceInSlot);
        }
    } else if (source.from === 'slot') {
        boardState[source.index] = existingPieceInSlot;
        boardState[targetSlot] = source.id;
    }

    moves++;
    selectedPiece = null;
    renderBoard();
    renderTray();

    if (countCorrect() === totalPieces) {
        win();
    }
}

function bgPos(col, row) {
    const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
    const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    return `${x}% ${y}%`;
}

function giveHint() {
    if (solved || !imageURL || trayPieces.length === 0) return;
    
    const hintPieceId = trayPieces[0];
    const targetSlot = hintPieceId;

    const existingInSlot = boardState[targetSlot];
    boardState[targetSlot] = hintPieceId;
    
    trayPieces.shift();
    if (existingInSlot !== null) {
        trayPieces.push(existingInSlot);
    }

    renderBoard();
    renderTray();
    setStatus('fa-lightbulb', `Petunjuk dipasang otomatis!`);

    if (countCorrect() === totalPieces) win();
}

function setPeek(on) {
    if (!imageURL || solved) return;
    document.querySelectorAll('.slot').forEach(slotEl => {
        const slot = parseInt(slotEl.dataset.slot, 10);
        if (on) {
            slotEl.style.backgroundImage = `url(${imageURL})`;
            slotEl.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
            slotEl.style.backgroundPosition = bgPos(slot % cols, Math.floor(slot / cols));
            slotEl.style.opacity = '0.5';
        } else {
            slotEl.style.backgroundImage = 'none';
            slotEl.style.opacity = '1';
        }
    });
}

function win() {
    solved = true;
    stopTimer();
    selectedPiece = null;
    boardEl.classList.add('solved');
    renderBoard();
    renderTray();
    setStatus('fa-trophy', 'Selesai!');
    document.getElementById('win-summary').textContent = `${totalPieces} pecahan · ${formatTime(seconds)} · ${moves} langkah`;
    setTimeout(() => winModal.show(), 600);
}

function startTimer() {
    stopTimer();
    timerId = setInterval(() => { seconds++; timeEl.textContent = formatTime(seconds); }, 1000);
}

function stopTimer() {
    clearInterval(timerId);
    timerId = null;
}

function formatTime(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function updateStats() {
    timeEl.textContent = formatTime(seconds);
    movesEl.textContent = moves;
    correctEl.textContent = `${countCorrect()}/${totalPieces}`;
}

})();