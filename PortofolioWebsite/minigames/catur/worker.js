importScripts('engine.js');

self.onmessage = function (e) {
    const { id, fen, cfg } = e.data;
    const res = Chess.findBest(Chess.fromFEN(fen), cfg);
    self.postMessage({ id, move: res ? res.move : null });
};