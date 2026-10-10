var Chess = (function () {
    'use strict';

    const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
    const KN = [-33, -31, -18, -14, 14, 18, 31, 33];
    const KG = [-17, -16, -15, -1, 1, 15, 16, 17];
    const BD = [-17, -15, 15, 17];
    const RD = [-16, -1, 1, 16];
    const WK = 1, WQ = 2, BK = 4, BQ = 8;
    const F_DOUBLE = 1, F_EP = 2, F_CK = 3, F_CQ = 4;
    const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const CMASK = new Array(128).fill(15);
    CMASK[116] = 15 & ~(WK | WQ); CMASK[112] = 15 & ~WQ; CMASK[119] = 15 & ~WK;
    CMASK[4] = 15 & ~(BK | BQ);   CMASK[0] = 15 & ~BQ;   CMASK[7] = 15 & ~BK;

    const mv = (f, t, p, fl) => f | (t << 7) | ((p || 0) << 14) | ((fl || 0) << 17);
    const sgn = p => (p > 0 ? 1 : -1);
    const kIdx = c => (c === 1 ? 0 : 1);
    const sqName = sq => 'abcdefgh'[sq & 7] + (8 - (sq >> 4));
    const nameToSq = n => (8 - Number(n[1])) * 16 + (n.charCodeAt(0) - 97);

    /* ---------- State & FEN ---------- */
    function newState() {
        return { board: new Int8Array(128), turn: 1, castling: 0, ep: -1, half: 0, full: 1,
                 kings: [116, 4], capH: [], castH: [], epH: [], halfH: [] };
    }

    function fromFEN(fen) {
        const st = newState();
        const [pos, side, cast, ep, half, full] = fen.trim().split(/\s+/);
        let r = 0, f = 0;
        for (const ch of pos) {
            if (ch === '/') { r++; f = 0; }
            else if (ch >= '1' && ch <= '8') f += Number(ch);
            else {
                const lower = ch.toLowerCase();
                const type = 'pnbrqk'.indexOf(lower) + 1;
                const color = ch === lower ? -1 : 1;
                const sq = r * 16 + f;
                st.board[sq] = color * type;
                if (type === K) st.kings[kIdx(color)] = sq;
                f++;
            }
        }
        st.turn = side === 'b' ? -1 : 1;
        if (cast && cast.includes('K')) st.castling |= WK;
        if (cast && cast.includes('Q')) st.castling |= WQ;
        if (cast && cast.includes('k')) st.castling |= BK;
        if (cast && cast.includes('q')) st.castling |= BQ;
        st.ep = ep && ep !== '-' ? nameToSq(ep) : -1;
        st.half = Number(half) || 0;
        st.full = Number(full) || 1;
        return st;
    }

    function toFEN(st) {
        let out = '';
        for (let r = 0; r < 8; r++) {
            let empty = 0;
            for (let f = 0; f < 8; f++) {
                const p = st.board[r * 16 + f];
                if (!p) { empty++; continue; }
                if (empty) { out += empty; empty = 0; }
                const ch = 'pnbrqk'[Math.abs(p) - 1];
                out += p > 0 ? ch.toUpperCase() : ch;
            }
            if (empty) out += empty;
            if (r < 7) out += '/';
        }
        const c = (st.castling & WK ? 'K' : '') + (st.castling & WQ ? 'Q' : '') +
                  (st.castling & BK ? 'k' : '') + (st.castling & BQ ? 'q' : '');
        return `${out} ${st.turn === 1 ? 'w' : 'b'} ${c || '-'} ${st.ep >= 0 ? sqName(st.ep) : '-'} ${st.half} ${st.full}`;
    }

    /* ---------- Serangan ---------- */
    function attacked(st, sq, by) {
        const b = st.board;
        const d = by === 1 ? 16 : -16;
        let s = sq + d - 1;
        if (!(s & 0x88) && b[s] === by * P) return true;
        s = sq + d + 1;
        if (!(s & 0x88) && b[s] === by * P) return true;
        for (let i = 0; i < 8; i++) { s = sq + KN[i]; if (!(s & 0x88) && b[s] === by * N) return true; }
        for (let i = 0; i < 8; i++) { s = sq + KG[i]; if (!(s & 0x88) && b[s] === by * K) return true; }
        for (let i = 0; i < 4; i++) {
            const dd = BD[i];
            for (s = sq + dd; !(s & 0x88); s += dd) {
                const p = b[s];
                if (p !== 0) { if (p === by * B || p === by * Q) return true; break; }
            }
        }
        for (let i = 0; i < 4; i++) {
            const dd = RD[i];
            for (s = sq + dd; !(s & 0x88); s += dd) {
                const p = b[s];
                if (p !== 0) { if (p === by * R || p === by * Q) return true; break; }
            }
        }
        return false;
    }

    const inCheck = st => attacked(st, st.kings[kIdx(st.turn)], -st.turn);

    /* ---------- Generator langkah ---------- */
    function pushPromos(moves, from, to) {
        moves.push(mv(from, to, Q), mv(from, to, R), mv(from, to, B), mv(from, to, N));
    }

    function genMoves(st, capsOnly) {
        const moves = [];
        const b = st.board, us = st.turn, them = -us;
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const sq = r * 16 + f, p = b[sq];
                if (p === 0 || sgn(p) !== us) continue;
                const t = p * us;
                if (t === P) {
                    const fwd = us === 1 ? -16 : 16, startRow = us === 1 ? 6 : 1, promoRow = us === 1 ? 0 : 7;
                    const s1 = sq + fwd;
                    if (!(s1 & 0x88) && b[s1] === 0) {
                        if ((s1 >> 4) === promoRow) pushPromos(moves, sq, s1);
                        else if (!capsOnly) {
                            moves.push(mv(sq, s1));
                            if (r === startRow && b[s1 + fwd] === 0) moves.push(mv(sq, s1 + fwd, 0, F_DOUBLE));
                        }
                    }
                    for (let dx = -1; dx <= 1; dx += 2) {
                        const s = sq + fwd + dx;
                        if (s & 0x88) continue;
                        const q = b[s];
                        if (q !== 0 && sgn(q) === them) {
                            if ((s >> 4) === promoRow) pushPromos(moves, sq, s); else moves.push(mv(sq, s));
                        } else if (q === 0 && s === st.ep) moves.push(mv(sq, s, 0, F_EP));
                    }
                } else if (t === N || t === K) {
                    const offs = t === N ? KN : KG;
                    for (let i = 0; i < 8; i++) {
                        const s = sq + offs[i];
                        if (s & 0x88) continue;
                        const q = b[s];
                        if (q === 0) { if (!capsOnly) moves.push(mv(sq, s)); }
                        else if (sgn(q) === them) moves.push(mv(sq, s));
                    }
                } else {
                    const diag = t === B || t === Q, line = t === R || t === Q;
                    for (let k = 0; k < 2; k++) {
                        if (k === 0 ? !diag : !line) continue;
                        const dirs = k === 0 ? BD : RD;
                        for (let i = 0; i < 4; i++) {
                            const dd = dirs[i];
                            for (let s = sq + dd; !(s & 0x88); s += dd) {
                                const q = b[s];
                                if (q === 0) { if (!capsOnly) moves.push(mv(sq, s)); }
                                else { if (sgn(q) === them) moves.push(mv(sq, s)); break; }
                            }
                        }
                    }
                }
            }
        }
        if (!capsOnly) {
            if (us === 1 && st.kings[0] === 116) {
                if ((st.castling & WK) && b[117] === 0 && b[118] === 0 && b[119] === R &&
                    !attacked(st, 116, -1) && !attacked(st, 117, -1)) moves.push(mv(116, 118, 0, F_CK));
                if ((st.castling & WQ) && b[115] === 0 && b[114] === 0 && b[113] === 0 && b[112] === R &&
                    !attacked(st, 116, -1) && !attacked(st, 115, -1)) moves.push(mv(116, 114, 0, F_CQ));
            } else if (us === -1 && st.kings[1] === 4) {
                if ((st.castling & BK) && b[5] === 0 && b[6] === 0 && b[7] === -R &&
                    !attacked(st, 4, 1) && !attacked(st, 5, 1)) moves.push(mv(4, 6, 0, F_CK));
                if ((st.castling & BQ) && b[3] === 0 && b[2] === 0 && b[1] === 0 && b[0] === -R &&
                    !attacked(st, 4, 1) && !attacked(st, 3, 1)) moves.push(mv(4, 2, 0, F_CQ));
            }
        }
        return moves;
    }

    function make(st, m) {
        const from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, fl = (m >> 17) & 7;
        const b = st.board, us = st.turn, p = b[from];
        st.capH.push(b[to]); st.castH.push(st.castling); st.epH.push(st.ep); st.halfH.push(st.half);
        const isPawn = p === P || p === -P;
        const wasCapture = b[to] !== 0 || fl === F_EP;
        b[to] = p; b[from] = 0;
        if (fl === F_EP) {
            const csq = to + (us === 1 ? 16 : -16);
            st.capH[st.capH.length - 1] = b[csq];
            b[csq] = 0;
        } else if (fl === F_CK) { b[to - 1] = b[to + 1]; b[to + 1] = 0; }
        else if (fl === F_CQ) { b[to + 1] = b[to - 2]; b[to - 2] = 0; }
        if (promo) b[to] = us * promo;
        if (p === K || p === -K) st.kings[kIdx(us)] = to;
        st.castling &= CMASK[from] & CMASK[to];
        st.ep = fl === F_DOUBLE ? (from + to) >> 1 : -1;
        st.half = isPawn || wasCapture ? 0 : st.half + 1;
        if (us === -1) st.full++;
        st.turn = -us;
    }

    function unmake(st, m) {
        const from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, fl = (m >> 17) & 7;
        const b = st.board;
        st.turn = -st.turn;
        const us = st.turn;
        const cap = st.capH.pop();
        st.castling = st.castH.pop(); st.ep = st.epH.pop(); st.half = st.halfH.pop();
        let p = b[to];
        if (promo) p = us * P;
        b[from] = p; b[to] = 0;
        if (fl === F_EP) b[to + (us === 1 ? 16 : -16)] = cap;
        else b[to] = cap;
        if (fl === F_CK) { b[to + 1] = b[to - 1]; b[to - 1] = 0; }
        else if (fl === F_CQ) { b[to - 2] = b[to + 1]; b[to + 1] = 0; }
        if (p === K || p === -K) st.kings[kIdx(us)] = from;
        if (us === -1) st.full--;
    }

    function legalMoves(st) {
        const us = st.turn, out = [];
        const moves = genMoves(st, false);
        for (let i = 0; i < moves.length; i++) {
            make(st, moves[i]);
            if (!attacked(st, st.kings[kIdx(us)], -us)) out.push(moves[i]);
            unmake(st, moves[i]);
        }
        return out;
    }

    function perft(st, depth) {
        if (depth === 0) return 1;
        let n = 0;
        const moves = legalMoves(st);
        if (depth === 1) return moves.length;
        for (const m of moves) { make(st, m); n += perft(st, depth - 1); unmake(st, m); }
        return n;
    }

    function san(st, m, legal) {
        const from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, fl = (m >> 17) & 7;
        const b = st.board, p = Math.abs(b[from]);
        let s;
        if (fl === F_CK) s = 'O-O';
        else if (fl === F_CQ) s = 'O-O-O';
        else {
            const cap = b[to] !== 0 || fl === F_EP;
            if (p === P) {
                s = (cap ? 'abcdefgh'[from & 7] + 'x' : '') + sqName(to);
                if (promo) s += '=' + ' PNBRQK'[promo].trim();
            } else {
                s = 'PNBRQK'[p - 1];
                const others = legal.filter(o => o !== m && Math.abs(b[o & 127]) === p && ((o >> 7) & 127) === to);
                if (others.length) {
                    const sameFile = others.some(o => (o & 7) === (from & 7));
                    const sameRank = others.some(o => ((o & 127) >> 4) === (from >> 4));
                    if (!sameFile) s += 'abcdefgh'[from & 7];
                    else if (!sameRank) s += 8 - (from >> 4);
                    else s += sqName(from);
                }
                if (cap) s += 'x';
                s += sqName(to);
            }
        }
        make(st, m);
        if (inCheck(st)) s += legalMoves(st).length === 0 ? '#' : '+';
        unmake(st, m);
        return s;
    }

    function insufficient(st) {
        const minors = [];
        for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
            const t = Math.abs(st.board[r * 16 + f]);
            if (t === 0 || t === K) continue;
            if (t === P || t === R || t === Q) return false;
            minors.push({ t, c: (r + f) & 1, side: sgn(st.board[r * 16 + f]) });
        }
        if (minors.length <= 1) return true;
        if (minors.length === 2 && minors.every(x => x.t === B) && minors[0].c === minors[1].c && minors[0].side !== minors[1].side) return true;
        return false;
    }

    function positionKey(st) {
        let ep = '-';
        if (st.ep >= 0) {
            const fwd = st.turn === 1 ? -16 : 16;
            for (let dx = -1; dx <= 1; dx += 2) {
                const from = st.ep - fwd + dx;
                if (!(from & 0x88) && st.board[from] === st.turn * P) ep = String(st.ep);
            }
        }
        return Array.prototype.join.call(st.board, ',') + `|${st.turn}|${st.castling}|${ep}`;
    }

    function status(st, keys) {
        const legal = legalMoves(st), check = inCheck(st);
        if (legal.length === 0) return check ? { over: true, result: 'checkmate', winner: -st.turn } : { over: true, result: 'stalemate' };
        if (insufficient(st)) return { over: true, result: 'insufficient' };
        if (st.half >= 100) return { over: true, result: 'fifty' };
        if (keys) {
            const k = positionKey(st);
            let c = 0;
            for (let i = 0; i < keys.length; i++) if (keys[i] === k) c++;
            if (c >= 3) return { over: true, result: 'repetition' };
        }
        return { over: false, check };
    }

    const VAL = [0, 100, 320, 330, 500, 900, 20000];
    const PST = [null,
        [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
         0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
        [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
         -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
        [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
         -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
        [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
         -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
        [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
         0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20]
    ];
    const KING_MID = [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
        20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20];
    const KING_END = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30,
        -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30,
        -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];

    function evaluate(st) {
        const b = st.board;
        let score = 0, material = 0, wB = 0, bB = 0;
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const p = b[r * 16 + f];
                if (p === 0) continue;
                const t = p > 0 ? p : -p, c = p > 0 ? 1 : -1;
                if (t === K) continue;
                if (t !== P) material += VAL[t];
                if (t === B) { if (c === 1) wB++; else bB++; }
                const idx = c === 1 ? r * 8 + f : (7 - r) * 8 + f;
                score += c * (VAL[t] + PST[t][idx]);
            }
        }
        const table = material < 2600 ? KING_END : KING_MID;
        for (let c = 1; c >= -1; c -= 2) {
            const ksq = st.kings[kIdx(c)];
            const r = ksq >> 4, f = ksq & 7;
            score += c * table[c === 1 ? r * 8 + f : (7 - r) * 8 + f];
        }
        if (wB >= 2) score += 30;
        if (bB >= 2) score += 30;
        return score * st.turn;
    }

    const INF = 1000000, MATE = 100000, MAXPLY = 40;
    let nodes = 0, deadline = 0, aborted = false;
    let killers = [];

    function scoreMove(st, m, ply) {
        const from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, fl = (m >> 17) & 7;
        const cap = st.board[to];
        if (cap !== 0) return 100000 + VAL[Math.abs(cap)] * 10 - VAL[Math.abs(st.board[from])] / 10;
        if (fl === F_EP) return 100900;
        if (promo) return 90000 + VAL[promo];
        const k = killers[ply];
        if (k) { if (k[0] === m) return 80000; if (k[1] === m) return 70000; }
        return 0;
    }

    function pick(moves, scores, i) {
        let bi = i;
        for (let j = i + 1; j < moves.length; j++) if (scores[j] > scores[bi]) bi = j;
        if (bi !== i) {
            let t = moves[i]; moves[i] = moves[bi]; moves[bi] = t;
            t = scores[i]; scores[i] = scores[bi]; scores[bi] = t;
        }
        return moves[i];
    }

    function tick() {
        if ((++nodes & 2047) === 0 && Date.now() > deadline) aborted = true;
    }

    function quiesce(st, alpha, beta, ply, qd) {
        tick();
        if (aborted) return 0;
        const stand = evaluate(st);
        if (stand >= beta) return stand;
        if (stand > alpha) alpha = stand;
        if (qd >= 8) return alpha;
        const us = st.turn;
        const moves = genMoves(st, true);
        const scores = moves.map(m => scoreMove(st, m, ply));
        for (let i = 0; i < moves.length; i++) {
            const m = pick(moves, scores, i);
            make(st, m);
            if (attacked(st, st.kings[kIdx(us)], -us)) { unmake(st, m); continue; }
            const sc = -quiesce(st, -beta, -alpha, ply + 1, qd + 1);
            unmake(st, m);
            if (aborted) return 0;
            if (sc >= beta) return sc;
            if (sc > alpha) alpha = sc;
        }
        return alpha;
    }

    function negamax(st, depth, alpha, beta, ply) {
        tick();
        if (aborted) return 0;
        if (st.half >= 100) return 0;
        const us = st.turn;
        const check = attacked(st, st.kings[kIdx(us)], -us);
        if (check && ply < MAXPLY) depth++;
        if (depth <= 0) return quiesce(st, alpha, beta, ply, 0);

        const moves = genMoves(st, false);
        const scores = moves.map(m => scoreMove(st, m, ply));
        let legal = 0, best = -INF;
        for (let i = 0; i < moves.length; i++) {
            const m = pick(moves, scores, i);
            make(st, m);
            if (attacked(st, st.kings[kIdx(us)], -us)) { unmake(st, m); continue; }
            legal++;
            const sc = -negamax(st, depth - 1, -beta, -alpha, ply + 1);
            unmake(st, m);
            if (aborted) return 0;
            if (sc > best) best = sc;
            if (sc > alpha) alpha = sc;
            if (alpha >= beta) {
                if (st.board[(m >> 7) & 127] === 0) {
                    const k = killers[ply] || (killers[ply] = [0, 0]);
                    if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
                }
                break;
            }
        }
        if (legal === 0) return check ? -MATE + ply : 0;
        return best;
    }

    const LEVELS = [null,
        { name: 'Pemula',   depth: 1, noise: 260, time: 500 },
        { name: 'Mudah',    depth: 2, noise: 110, time: 800 },
        { name: 'Menengah', depth: 3, noise: 30,  time: 1500 },
        { name: 'Sulit',    depth: 6, noise: 0,   time: 2500 },
        { name: 'Master',   depth: 10, noise: 0,  time: 5000 }
    ];

    function findBest(st, cfg) {
        if (typeof cfg === 'number') cfg = LEVELS[cfg];
        const rootMoves = legalMoves(st);
        if (!rootMoves.length) return null;
        if (rootMoves.length === 1) return { move: rootMoves[0], score: 0, depth: 0, nodes: 0 };

        nodes = 0; aborted = false; killers = [];
        deadline = Date.now() + cfg.time;
        const us = st.turn;
        let ordered = rootMoves.slice().sort((a, b) => scoreMove(st, b, 0) - scoreMove(st, a, 0));
        let bestMove = ordered[0], bestScore = 0, doneDepth = 0;

        for (let depth = 1; depth <= cfg.depth; depth++) {
            let alpha = -INF, iterBest = null, iterScore = -INF, iterNoisy = -INF;
            for (let i = 0; i < ordered.length; i++) {
                const m = ordered[i];
                make(st, m);
                const sc = -negamax(st, depth - 1, -INF, cfg.noise ? INF : -alpha, 1);
                unmake(st, m);
                if (aborted) break;
                const noisy = cfg.noise ? sc + (Math.random() * 2 - 1) * cfg.noise : sc;
                if (noisy > iterNoisy) { iterNoisy = noisy; iterScore = sc; iterBest = m; }
                if (!cfg.noise && sc > alpha) alpha = sc;
            }
            if (aborted) break;
            bestMove = iterBest; bestScore = iterScore; doneDepth = depth;
            ordered = [iterBest].concat(ordered.filter(x => x !== iterBest));
            if (Math.abs(bestScore) > MATE - 100) break;
        }
        return { move: bestMove, score: bestScore, depth: doneDepth, nodes };
    }

    return {
        START, LEVELS, fromFEN, toFEN, genMoves, legalMoves, make, unmake, attacked, inCheck,
        san, status, positionKey, perft, findBest, evaluate, sqName,
        mFrom: m => m & 127, mTo: m => (m >> 7) & 127, mPromo: m => (m >> 14) & 7, mFlag: m => (m >> 17) & 7,
        VAL
    };
})();

if (typeof module !== 'undefined') module.exports = Chess;