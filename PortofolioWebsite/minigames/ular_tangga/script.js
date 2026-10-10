const SnakesLadders = (() => {
    const SNAKES  = { 16: 6, 46: 25, 49: 11, 62: 19, 64: 60, 74: 53, 89: 68, 92: 88, 95: 75, 99: 80 };
    const LADDERS = { 2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98, 87: 94 };
    function cellXY(n) {
        const r = Math.floor((n - 1) / 10);
        let c = (n - 1) % 10;
        if (r % 2 === 1) c = 9 - c;
        return { x: (c + 0.5) * 10, y: (9 - r + 0.5) * 10 };
    }

    function resolveRoll(pos, roll, exact) {
        let target = pos + roll;
        if (target > 100) {
            if (exact) return { path: [], from: pos, landed: pos, final: pos, kind: null, win: false, blocked: true };
            target = 100;
        }
        const path = [];
        for (let n = pos + 1; n <= target; n++) path.push(n);
        let final = target, kind = null;
        if (LADDERS[target]) { final = LADDERS[target]; kind = 'ladder'; }
        else if (SNAKES[target]) { final = SNAKES[target]; kind = 'snake'; }
        return { path, from: pos, landed: target, final, kind, win: final === 100, blocked: false };
    }

    return { SNAKES, LADDERS, cellXY, resolveRoll };
})();

if (typeof module !== 'undefined') module.exports = SnakesLadders;

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const SL = SnakesLadders;
        const $ = id => document.getElementById(id);
        const SPEED = typeof window.SL_SPEED === 'number' ? window.SL_SPEED : 1;
        const COLORS = ['#00f5d4', '#ffd166', '#c77dff', '#ff9f1c'];
        const SNAKE_COLORS = ['#ff4d6d', '#ff9f1c', '#c77dff', '#ff6b9d', '#f15bb5'];
        const SVG_NS = 'http://www.w3.org/2000/svg';

        const el = {
            board: $('board'), art: $('art'), tokens: $('tokens'), status: $('status'),
            dice: $('dice'), btnRoll: $('btn-roll'), players: $('players'), log: $('log'),
            btnNew: $('btn-new'), ovSetup: $('overlay-setup'), ovEnd: $('overlay-end'),
            endTitle: $('end-title'), endText: $('end-text'), name: $('player-name'),
            ruleSix: $('rule-six'), ruleExact: $('rule-exact'),
            listLadders: $('list-ladders'), listSnakes: $('list-snakes')
        };

        // ---- state ----
        let players = [];
        let cur = 0;
        let rules = { six: true, exact: false };
        let gameToken = 0;
        let busy = false, over = false, started = false;
        let log = [];
        let statusText = '', statusCls = '';
        let tokenEls = [];

        /* ---------- Papan ---------- */
        function buildBoard() {
            let html = '';
            for (let ri = 0; ri < 10; ri++) {
                const rr = 9 - ri;
                for (let ci = 0; ci < 10; ci++) {
                    const n = rr * 10 + (rr % 2 === 0 ? ci + 1 : 10 - ci);
                    const cls = (rr + ci) % 2 === 0 ? 'a' : 'b';
                    html += n === 100
                        ? `<div class="cell ${cls} goal" aria-hidden="true"><i class="fa-solid fa-flag-checkered"></i></div>`
                        : `<div class="cell ${cls}" aria-hidden="true">${n}</div>`;
                }
            }
            el.board.innerHTML = html;
        }

        const make = (tag, attrs) => {
            const e = document.createElementNS(SVG_NS, tag);
            Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k]));
            return e;
        };

        function drawLadder(from, to) {
            const a = SL.cellXY(from), b = SL.cellXY(to);
            const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
            const ux = dx / len, uy = dy / len, nx = -uy * 1.1, ny = ux * 1.1;
            const g = make('g', { stroke: '#00f5d4', 'stroke-linecap': 'round', fill: 'none' });
            g.appendChild(make('line', { x1: a.x + nx, y1: a.y + ny, x2: b.x + nx, y2: b.y + ny, 'stroke-width': 0.75 }));
            g.appendChild(make('line', { x1: a.x - nx, y1: a.y - ny, x2: b.x - nx, y2: b.y - ny, 'stroke-width': 0.75 }));
            const rungs = Math.max(3, Math.floor(len / 3.6));
            for (let i = 1; i < rungs; i++) {
                const t = i / rungs, px = a.x + dx * t, py = a.y + dy * t;
                g.appendChild(make('line', { x1: px + nx, y1: py + ny, x2: px - nx, y2: py - ny, 'stroke-width': 0.55 }));
            }
            el.art.appendChild(g);
        }

        function drawSnake(head, tail, color) {
            const a = SL.cellXY(head), b = SL.cellXY(tail);
            const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
            const nx = -dy / len, ny = dx / len;
            const waves = Math.max(2, Math.round(len / 13));
            const amp = Math.min(3.4, 1.5 + len / 38);
            const steps = Math.max(18, Math.round(len / 1.6));
            let d = '';
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const off = amp * Math.sin(t * waves * Math.PI) * (0.4 + 0.6 * Math.sin(Math.PI * t));
                d += (i ? 'L' : 'M') + (a.x + dx * t + nx * off).toFixed(2) + ' ' + (a.y + dy * t + ny * off).toFixed(2);
            }
            const g = make('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.95 });
            g.appendChild(make('path', { d, stroke: '#1a1530', 'stroke-width': 2.6 }));
            g.appendChild(make('path', { d, stroke: color, 'stroke-width': 1.9 }));
            g.appendChild(make('path', { d, stroke: 'rgba(255,255,255,0.55)', 'stroke-width': 0.7, 'stroke-dasharray': '0.9 1.9' }));
            // kepala + mata
            g.appendChild(make('circle', { cx: a.x, cy: a.y, r: 2.1, fill: color, stroke: '#1a1530', 'stroke-width': 0.5 }));
            g.appendChild(make('circle', { cx: a.x - 0.8, cy: a.y - 0.5, r: 0.55, fill: '#fff', stroke: 'none' }));
            g.appendChild(make('circle', { cx: a.x + 0.8, cy: a.y - 0.5, r: 0.55, fill: '#fff', stroke: 'none' }));
            g.appendChild(make('circle', { cx: a.x - 0.8, cy: a.y - 0.5, r: 0.22, fill: '#1a1530', stroke: 'none' }));
            g.appendChild(make('circle', { cx: a.x + 0.8, cy: a.y - 0.5, r: 0.22, fill: '#1a1530', stroke: 'none' }));
            el.art.appendChild(g);
        }

        function drawArt() {
            el.art.innerHTML = '';
            Object.keys(SL.LADDERS).forEach(k => drawLadder(Number(k), SL.LADDERS[k]));
            Object.keys(SL.SNAKES).forEach((k, i) => drawSnake(Number(k), SL.SNAKES[k], SNAKE_COLORS[i % SNAKE_COLORS.length]));
            el.listLadders.innerHTML = '<strong class="l">Tangga:</strong> ' +
                Object.keys(SL.LADDERS).map(k => `${k} naik ke ${SL.LADDERS[k]}`).join(', ') + '.';
            el.listSnakes.innerHTML = '<strong class="s">Ular:</strong> ' +
                Object.keys(SL.SNAKES).map(k => `${k} turun ke ${SL.SNAKES[k]}`).join(', ') + '.';
        }

        /* ---------- Dadu ---------- */
        const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
        function showFace(v) {
            let html = '';
            for (let i = 1; i <= 9; i++) html += `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`;
            el.dice.innerHTML = html;
            el.dice.setAttribute('aria-label', `Dadu: ${v}`);
        }

        /* ---------- Bidak ---------- */
        function buildTokens() {
            el.tokens.innerHTML = '';
            tokenEls = players.map((p, i) => {
                const t = document.createElement('div');
                t.className = 'token';
                t.style.setProperty('--tc', p.color);
                t.textContent = i + 1;
                el.tokens.appendChild(t);
                return t;
            });
            placeTokens();
        }

        function placeTokens() {
            players.forEach((p, i) => {
                let x, y;
                if (p.pos === 0) { x = 5 + i * 6.5; y = 105.5; }
                else {
                    const c = SL.cellXY(p.pos);
                    x = c.x; y = c.y;
                    const mates = players.filter(q => q.pos === p.pos);
                    if (mates.length > 1) {
                        const k = mates.indexOf(p);
                        x += [-2, 2, -2, 2][k]; y += [-2, -2, 2, 2][k];
                    }
                }
                tokenEls[i].style.left = x + '%';
                tokenEls[i].style.top = y + '%';
                tokenEls[i].classList.toggle('active', started && !over && i === cur);
            });
        }

        /* ---------- Panel ---------- */
        function renderPlayers() {
            el.players.innerHTML = players.map((p, i) => `
                <li class="${started && !over && i === cur ? 'active' : ''}" style="--tc:${p.color}">
                    <span class="p-dot" aria-hidden="true">${i + 1}</span>
                    <div><span class="p-name">${p.name}</span>
                        <div class="p-bar"><span style="width:${p.pos}%"></span></div></div>
                    <span class="p-pos">${p.pos === 0 ? 'Start' : 'Kotak ' + p.pos}</span>
                </li>`).join('');
        }

        function renderLog() {
            el.log.innerHTML = log.slice(0, 8).map(m => `<li>${m}</li>`).join('');
        }

        function setStatus(text, cls) {
            statusText = text; statusCls = cls || '';
            el.status.textContent = text;
            el.status.className = 'status-box ' + statusCls;
        }

        function addLog(m) { log.unshift(m); log = log.slice(0, 30); renderLog(); }

        function updateControls() {
            const myTurn = started && !over && !busy && players[cur] && players[cur].human;
            el.btnRoll.disabled = !myTurn;
            renderPlayers();
            placeTokens();
        }

        /* ---------- Alur giliran ---------- */
        const wait = (ms, my) => new Promise(r => setTimeout(() => r(my === gameToken), ms * SPEED));

        async function rollDice(my) {
            el.dice.classList.add('rolling');
            for (let i = 0; i < 8; i++) {
                showFace(Math.floor(Math.random() * 6) + 1);
                if (!await wait(70, my)) return null;
            }
            el.dice.classList.remove('rolling');
            const v = Math.floor(Math.random() * 6) + 1;
            showFace(v);
            return v;
        }

        async function turn() {
            const my = gameToken;
            const p = players[cur];
            busy = true;
            setStatus(p.human ? 'Melempar dadu...' : `${p.name} melempar dadu...`);
            updateControls();

            const v = await rollDice(my);
            if (v === null) return;
            addLog(`${p.name} melempar dadu: <strong>${v}</strong>`);

            const res = SL.resolveRoll(p.pos, v, rules.exact);
            if (res.blocked) {
                addLog(`${p.name} butuh angka pas untuk sampai 100, tetap di ${p.pos}`);
                setStatus(`${p.name} dapat ${v}, tapi harus pas di 100.`);
            } else {
                setStatus(`${p.name} dapat ${v}.`);
                for (const n of res.path) {
                    p.pos = n;
                    placeTokens();
                    if (!await wait(170, my)) return;
                }
                renderPlayers();
                if (res.kind) {
                    if (!await wait(350, my)) return;
                    const up = res.kind === 'ladder';
                    addLog(up ? `${p.name} naik tangga dari ${res.landed} ke ${res.final}!`
                              : `${p.name} digigit ular di ${res.landed}, turun ke ${res.final}`);
                    setStatus(up ? `Tangga! ${p.name} naik ke ${res.final}.` : `Ular! ${p.name} turun ke ${res.final}.`, up ? 'good' : 'warn');
                    tokenEls[cur].classList.add('slide');
                    p.pos = res.final;
                    placeTokens();
                    if (!await wait(750, my)) return;
                    tokenEls[cur].classList.remove('slide');
                    renderPlayers();
                }
            }

            if (res.win) { finish(p); return; }

            if (v === 6 && rules.six) {
                addLog(`${p.name} dapat angka 6, main lagi!`);
            } else {
                cur = (cur + 1) % players.length;
            }
            busy = false;
            nextPrompt();
            updateControls();
            if (!players[cur].human) {
                setTimeout(() => { if (my === gameToken) turn(); }, 800 * SPEED);
            }
        }

        function nextPrompt() {
            const p = players[cur];
            setStatus(p.human ? 'Giliranmu. Tekan Lempar Dadu!' : `Giliran ${p.name}...`);
        }

        function finish(winner) {
            over = true; busy = false;
            const you = winner.human;
            addLog(`${winner.name} sampai di kotak 100!`);
            el.endTitle.textContent = you ? 'Kamu menang!' : `${winner.name} menang`;
            el.endText.textContent = you
                ? 'Kamu yang pertama sampai kotak 100. Keberuntungan ada di pihakmu!'
                : 'Kali ini dadu berpihak ke lawan. Coba lagi!';
            setStatus(you ? 'Kamu menang!' : `${winner.name} menang.`, you ? 'good' : 'warn');
            updateControls();
            showOverlay(el.ovEnd);
        }

        function newGame(botCount) {
            gameToken++;
            const name = (el.name.value || '').replace(/[<>]/g, '').trim().slice(0, 14) || 'Kamu';
            players = [{ name, human: true, pos: 0, color: COLORS[0] }];
            for (let i = 1; i <= botCount; i++) players.push({ name: `Bot ${i}`, human: false, pos: 0, color: COLORS[i] });
            rules = { six: el.ruleSix.checked, exact: el.ruleExact.checked };
            cur = 0; busy = false; over = false; started = true; log = [];
            addLog('Game dimulai. Semua bidak di Start.');
            showFace(1);
            el.dice.classList.remove('rolling');
            buildTokens();
            nextPrompt();
            updateControls();
        }

        /* ---------- Tombol & overlay ---------- */
        el.btnRoll.addEventListener('click', () => {
            if (started && !over && !busy && players[cur].human) turn();
        });

        el.btnNew.addEventListener('click', () => { gameToken++; busy = false; showOverlay(el.ovSetup); });

        $('btn-start').addEventListener('click', () => {
            const n = Number(document.querySelector('input[name="bots"]:checked').value);
            hideOverlay(el.ovSetup);
            newGame(n);
        });

        $('btn-again').addEventListener('click', () => { hideOverlay(el.ovEnd); showOverlay(el.ovSetup); });
        $('btn-view').addEventListener('click', () => hideOverlay(el.ovEnd));

        function showOverlay(o) {
            o.hidden = false;
            const first = o.querySelector('input[type="text"], input:checked, button');
            if (first) first.focus();
        }
        function hideOverlay(o) { o.hidden = true; }

        /* ---------- Mulai ---------- */
        buildBoard();
        drawArt();
        showFace(1);
        players = [{ name: 'Kamu', human: true, pos: 0, color: COLORS[0] }];
        buildTokens();
        renderPlayers();
        setStatus('Atur permainan untuk memulai.');
        el.btnRoll.disabled = true;
        showOverlay(el.ovSetup);
    });
}