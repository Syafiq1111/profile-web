const Engine = (() => {
    const COLORS = ['red', 'yellow', 'green', 'blue'];
    const COLOR_NAME = { red: 'Merah', yellow: 'Kuning', green: 'Hijau', blue: 'Biru' };
    const TYPE_RANK = { number: 0, skip: 1, reverse: 2, draw2: 3, wild: 4, wild4: 5 };

    function buildDeck() {
        const deck = [];
        let id = 0;
        COLORS.forEach(color => {
            deck.push({ id: id++, color, type: 'number', value: 0 });
            for (let n = 1; n <= 9; n++) {
                deck.push({ id: id++, color, type: 'number', value: n });
                deck.push({ id: id++, color, type: 'number', value: n });
            }
            ['skip', 'reverse', 'draw2'].forEach(type => {
                deck.push({ id: id++, color, type });
                deck.push({ id: id++, color, type });
            });
        });
        for (let i = 0; i < 4; i++) {
            deck.push({ id: id++, color: null, type: 'wild' });
            deck.push({ id: id++, color: null, type: 'wild4' });
        }
        return deck;
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function sortHand(hand) {
        hand.sort((a, b) => {
            const ca = a.color ? COLORS.indexOf(a.color) : 9;
            const cb = b.color ? COLORS.indexOf(b.color) : 9;
            if (ca !== cb) return ca - cb;
            if (a.type !== b.type) return TYPE_RANK[a.type] - TYPE_RANK[b.type];
            return (a.value || 0) - (b.value || 0);
        });
    }

    function label(card) {
        switch (card.type) {
            case 'number':  return `${COLOR_NAME[card.color]} ${card.value}`;
            case 'skip':    return `${COLOR_NAME[card.color]} Lewati`;
            case 'reverse': return `${COLOR_NAME[card.color]} Balik Arah`;
            case 'draw2':   return `${COLOR_NAME[card.color]} +2`;
            case 'wild':    return 'Wild';
            case 'wild4':   return 'Wild +4';
        }
    }

    function newGame(botCount) {
        const players = [{ name: 'Kamu', human: true, hand: [] }];
        for (let i = 1; i <= botCount; i++) players.push({ name: `Bot ${i}`, human: false, hand: [] });

        const s = {
            players, deck: shuffle(buildDeck()), discard: [],
            current: 0, dir: 1, color: null,
            phase: 'play',
            drawnId: null, unoCalled: false, winner: null
        };

        for (let r = 0; r < 7; r++) players.forEach(p => p.hand.push(s.deck.pop()));
        players.forEach(p => sortHand(p.hand));

        let first = null;
        while (!first) {
            const c = s.deck.pop();
            if (c.type === 'number') first = c;
            else s.deck.unshift(c);
        }
        s.discard.push(first);
        s.color = first.color;
        return s;
    }

    const top = s => s.discard[s.discard.length - 1];

    function nextIndex(s, from, steps = 1) {
        const n = s.players.length;
        return (((from + s.dir * steps) % n) + n) % n;
    }

    function canPlay(s, card) {
        if (card.type === 'wild' || card.type === 'wild4') return true;
        if (card.color === s.color) return true;
        const t = top(s);
        if (card.type === 'number') return t.type === 'number' && card.value === t.value;
        return card.type === t.type;
    }

    function canPlayNow(s, card) {
        if (s.phase === 'afterDraw') return card.id === s.drawnId && canPlay(s, card);
        return canPlay(s, card);
    }

    const hasPlayable = (s, idx) => s.players[idx].hand.some(c => canPlayNow(s, c));

    function draw(s, idx, n) {
        const p = s.players[idx];
        const got = [];
        for (let i = 0; i < n; i++) {
            if (!s.deck.length) {
                const keep = s.discard.pop();
                s.deck = shuffle(s.discard);
                s.discard = [keep];
                if (!s.deck.length) break;
            }
            const c = s.deck.pop();
            p.hand.push(c);
            got.push(c);
        }
        sortHand(p.hand);
        return got;
    }

    function advance(s, skip) {
        s.current = nextIndex(s, s.current, 1 + skip);
        s.phase = 'play';
        s.drawnId = null;
        s.unoCalled = false;
    }

    function play(s, idx, card, chosenColor) {
        const p = s.players[idx];
        p.hand.splice(p.hand.findIndex(c => c.id === card.id), 1);
        s.discard.push(card);
        s.color = card.color || chosenColor;

        const msgs = [];
        let desc = `${p.name} memainkan ${label(card)}`;
        if (!card.color) desc += ` (warna ${COLOR_NAME[chosenColor]})`;
        msgs.push(desc);

        let skip = 0;
        if (card.type === 'reverse') {
            s.dir *= -1;
            if (s.players.length === 2) skip = 1;
        }
        const victim = s.players[nextIndex(s, idx, 1)];
        if (card.type === 'skip') {
            skip = 1;
            msgs.push(`${victim.name} dilewati`);
        } else if (card.type === 'draw2') {
            draw(s, nextIndex(s, idx, 1), 2);
            skip = 1;
            msgs.push(`${victim.name} mengambil 2 kartu`);
        } else if (card.type === 'wild4') {
            draw(s, nextIndex(s, idx, 1), 4);
            skip = 1;
            msgs.push(`${victim.name} mengambil 4 kartu`);
        }

        if (p.hand.length === 0) {
            s.winner = idx;
            return msgs;
        }
        if (p.hand.length === 1) {
            if (p.human && !s.unoCalled) {
                draw(s, idx, 2);
                msgs.push('Kamu lupa menekan UNO! Ambil 2 kartu sebagai denda');
            } else {
                msgs.push(`${p.name}: UNO!`);
            }
        }
        advance(s, skip);
        return msgs;
    }

    function drawTurn(s) {
        const idx = s.current;
        const p = s.players[idx];
        const got = draw(s, idx, 1);
        if (!got.length) {
            advance(s, 0);
            return { msgs: [`Tumpukan kosong, ${p.name} melewati giliran`], playable: false };
        }
        const card = got[0];
        if (canPlay(s, card)) {
            s.phase = 'afterDraw';
            s.drawnId = card.id;
            return { msgs: [`${p.name} mengambil 1 kartu`], playable: true, card };
        }
        advance(s, 0);
        return { msgs: [`${p.name} mengambil 1 kartu dan melewati giliran`], playable: false };
    }

    function pass(s) { advance(s, 0); }

    function botColor(hand) {
        const count = {};
        hand.forEach(c => { if (c.color) count[c.color] = (count[c.color] || 0) + 1; });
        const best = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
        return best || COLORS[Math.floor(Math.random() * 4)];
    }

    function chooseCard(s, p) {
        const playable = p.hand.filter(c => canPlayNow(s, c));
        if (!playable.length) return null;
        const nextP = s.players[nextIndex(s, s.current, 1)];
        const pressure = nextP.hand.length <= 2;
        let best = null, bestScore = -1;
        playable.forEach(c => {
            let sc = c.type === 'number' ? 1 + (c.value || 0) * 0.02
                   : c.type === 'wild' ? 0.5
                   : c.type === 'wild4' ? 0.2 : 3;
            if (pressure) {
                if (c.type === 'draw2') sc += 4;
                if (c.type === 'skip') sc += 2;
                if (c.type === 'reverse' && s.players.length === 2) sc += 2;
                if (c.type === 'wild4') sc += 5;
            }
            sc += Math.random() * 0.5;
            if (sc > bestScore) { bestScore = sc; best = c; }
        });
        return best;
    }

    function botTurn(s) {
        const idx = s.current;
        const p = s.players[idx];
        const msgs = [];
        let card = chooseCard(s, p);
        if (!card) {
            const r = drawTurn(s);
            msgs.push(...r.msgs);
            if (!r.playable) return msgs;
            card = r.card;
        }
        const rest = p.hand.filter(c => c.id !== card.id);
        const color = card.color ? null : botColor(rest);
        msgs.push(...play(s, idx, card, color));
        return msgs;
    }

    return { COLORS, COLOR_NAME, newGame, top, canPlay, canPlayNow, hasPlayable, play, drawTurn, pass, botTurn, label, buildDeck };
})();

if (typeof module !== 'undefined') module.exports = Engine;

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const $ = id => document.getElementById(id);
        const BOT_DELAY = 1100;

        let s = null;
        let botCount = 2;
        let timer = null;
        let pendingWild = null;
        let notice = '';
        let log = [];

        const el = {
            opponents: $('opponents'), hand: $('hand'), deck: $('deck-pile'), deckCount: $('deck-count'),
            discard: $('discard-pile'), colorName: $('color-name'), colorSwatch: $('color-swatch'),
            dir: $('dir-icon'), status: $('status'), log: $('log'),
            btnUno: $('btn-uno'), btnPass: $('btn-pass'), btnNew: $('btn-new'),
            ovStart: $('overlay-start'), ovColor: $('overlay-color'), ovEnd: $('overlay-end'),
            endTitle: $('end-title'), endText: $('end-text')
        };

        /* ---------- Render kartu ---------- */
        function faceHTML(card) {
            switch (card.type) {
                case 'number':  return String(card.value);
                case 'skip':    return '<i class="fa-solid fa-ban" aria-hidden="true"></i>';
                case 'reverse': return '<i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>';
                case 'draw2':   return '+2';
                case 'wild':    return '<i class="fa-solid fa-palette" aria-hidden="true"></i>';
                case 'wild4':   return '+4';
            }
        }

        function cardHTML(card, extraClass = '', asButton = true) {
            const face = faceHTML(card);
            const cls = `uno-card c-${card.color || 'wild'} ${extraClass}`;
            const inner = `<span class="oval" aria-hidden="true"></span>
                <span class="corner tl" aria-hidden="true">${face}</span>
                <span class="mid" aria-hidden="true">${face}</span>
                <span class="corner br" aria-hidden="true">${face}</span>`;
            return asButton
                ? `<button type="button" class="${cls}" data-id="${card.id}" aria-label="${Engine.label(card)}">${inner}</button>`
                : `<div class="${cls}" role="img" aria-label="Kartu teratas: ${Engine.label(card)}">${inner}</div>`;
        }

        function render() {
            if (!s) return;
            const human = s.players[0];
            const myTurn = s.current === 0 && s.winner === null && !pendingWild;

            // Lawan
            el.opponents.innerHTML = s.players.slice(1).map((p, i) => {
                const idx = i + 1;
                const active = s.current === idx && s.winner === null;
                return `<div class="opp ${active ? 'active' : ''}">
                    <div class="opp-name"><i class="fa-solid fa-robot" aria-hidden="true"></i> ${p.name}
                        ${p.hand.length === 1 ? '<span class="uno-badge">UNO!</span>' : ''}</div>
                    <div class="opp-cards" aria-label="${p.name} memegang ${p.hand.length} kartu">
                        <span class="mini-back"></span><span class="opp-count">${p.hand.length}</span> kartu
                    </div>
                </div>`;
            }).join('');

            // Tumpukan tengah
            el.deckCount.textContent = `${s.deck.length} kartu`;
            el.discard.innerHTML = cardHTML(Engine.top(s), '', false);
            el.colorName.textContent = Engine.COLOR_NAME[s.color];
            el.colorSwatch.className = `swatch c-${s.color}`;
            el.dir.className = `fa-solid ${s.dir === 1 ? 'fa-rotate-right' : 'fa-rotate-left'}`;
            el.dir.parentElement.setAttribute('aria-label', s.dir === 1 ? 'Arah putaran searah jarum jam' : 'Arah putaran berlawanan jarum jam');
            el.deck.disabled = !myTurn || s.phase !== 'play';

            // Kartu di tangan
            el.hand.innerHTML = human.hand.map(card => {
                const ok = myTurn && Engine.canPlayNow(s, card);
                return cardHTML(card, ok ? 'is-playable' : 'is-dim');
            }).join('');

            // Tombol
            el.btnUno.disabled = !(myTurn && human.hand.length === 2);
            el.btnUno.classList.toggle('called', s.unoCalled);
            el.btnPass.hidden = !(myTurn && s.phase === 'afterDraw');

            // Status
            let text;
            if (notice) text = notice;
            else if (s.winner !== null) text = `${s.players[s.winner].name} menang!`;
            else if (s.current === 0) {
                if (s.phase === 'afterDraw') text = 'Kartu yang kamu ambil bisa dimainkan. Mainkan atau pilih Lewati.';
                else if (Engine.hasPlayable(s, 0)) text = 'Giliranmu. Pilih salah satu kartu yang menyala.';
                else text = 'Tidak ada kartu yang cocok. Klik tumpukan kartu untuk mengambil satu.';
            } else text = `Giliran ${s.players[s.current].name}...`;
            el.status.textContent = text;
            el.status.classList.toggle('warn', !!notice);

            // Log
            el.log.innerHTML = log.slice(0, 6).map(m => `<li>${m}</li>`).join('');
        }

        function pushLog(msgs) {
            msgs.slice().reverse().forEach(m => log.unshift(m));
            log = log.slice(0, 20);
        }

        /* ---------- Alur permainan ---------- */
        function botLoop() {
            clearTimeout(timer);
            if (!s || s.winner !== null || s.players[s.current].human) return;
            timer = setTimeout(() => {
                pushLog(Engine.botTurn(s));
                render();
                if (s.winner !== null) return finish();
                botLoop();
            }, BOT_DELAY);
        }

        function afterAction() {
            render();
            if (s.winner !== null) return finish();
            botLoop();
        }

        function finish() {
            const won = s.winner === 0;
            el.endTitle.textContent = won ? 'Kamu menang!' : `${s.players[s.winner].name} menang`;
            el.endText.textContent = won
                ? 'Semua kartumu habis lebih dulu. Mantap!'
                : 'Kartunya habis lebih dulu. Coba lagi, pasti bisa.';
            showOverlay(el.ovEnd);
        }

        function startGame(n) {
            clearTimeout(timer);
            botCount = n;
            s = Engine.newGame(n);
            pendingWild = null; notice = ''; log = [];
            pushLog([`Game dimulai dengan ${n} bot. Kartu pertama: ${Engine.label(Engine.top(s))}`]);
            hideOverlay(el.ovStart); hideOverlay(el.ovEnd); hideOverlay(el.ovColor);
            render();
        }

        /* ---------- Aksi pemain ---------- */
        const humanTurn = () => s && s.winner === null && s.current === 0 && !pendingWild;

        function commit(card, color) {
            notice = '';
            pushLog(Engine.play(s, 0, card, color));
            afterAction();
        }

        el.hand.addEventListener('click', e => {
            const btn = e.target.closest('.uno-card');
            if (!btn || !humanTurn()) return;
            const card = s.players[0].hand.find(c => c.id === Number(btn.dataset.id));
            if (!card) return;

            if (!Engine.canPlayNow(s, card)) {
                notice = s.phase === 'afterDraw'
                    ? 'Hanya kartu yang baru kamu ambil yang boleh dimainkan.'
                    : 'Kartu itu tidak cocok. Cocokkan warna atau angka dengan kartu teratas.';
                render();
                return;
            }
            if (!card.color) {
                pendingWild = card;
                render();
                showOverlay(el.ovColor);
                return;
            }
            commit(card, null);
        });

        el.deck.addEventListener('click', () => {
            if (!humanTurn() || s.phase !== 'play') return;
            if (Engine.hasPlayable(s, 0)) {
                notice = 'Kamu masih punya kartu yang bisa dimainkan.';
                render();
                return;
            }
            notice = '';
            const r = Engine.drawTurn(s);
            pushLog(r.msgs);
            if (r.playable) render(); else afterAction();
        });

        el.btnPass.addEventListener('click', () => {
            if (!humanTurn() || s.phase !== 'afterDraw') return;
            notice = '';
            Engine.pass(s);
            pushLog(['Kamu melewati giliran']);
            afterAction();
        });

        el.btnUno.addEventListener('click', () => {
            if (!humanTurn() || s.players[0].hand.length !== 2) return;
            s.unoCalled = true;
            notice = 'UNO! Sekarang mainkan salah satu kartumu.';
            render();
        });

        document.querySelectorAll('[data-pick-color]').forEach(b => {
            b.addEventListener('click', () => {
                if (!pendingWild) return;
                const card = pendingWild;
                pendingWild = null;
                hideOverlay(el.ovColor);
                commit(card, b.dataset.pickColor);
            });
        });

        /* ---------- Overlay ---------- */
        function showOverlay(o) {
            o.hidden = false;
            const first = o.querySelector('button');
            if (first) first.focus();
        }
        function hideOverlay(o) { o.hidden = true; }

        document.querySelectorAll('[data-bots]').forEach(b => {
            b.addEventListener('click', () => startGame(Number(b.dataset.bots)));
        });
        $('btn-again').addEventListener('click', () => startGame(botCount));
        $('btn-change').addEventListener('click', () => { hideOverlay(el.ovEnd); showOverlay(el.ovStart); });
        el.btnNew.addEventListener('click', () => {
            clearTimeout(timer);
            showOverlay(el.ovStart);
        });

        showOverlay(el.ovStart);
    });
}