const boardElement = document.getElementById('board');
const statusDisplay = document.getElementById('game-status');
const scoreXEl = document.getElementById('score-x');
const scoreOEl = document.getElementById('score-o');
const scoreDrawEl = document.getElementById('score-draw');
const gridSizeSelect = document.getElementById('grid-size');
const aiDifficultySelect = document.getElementById('ai-difficulty');

let gridSize = 3;
let winLength = 3;
let board = [];
let currentPlayer = 'X';
let isGameActive = true;

let scores = { x: 0, o: 0, draw: 0 };

function changeSettings() {
    gridSize = parseInt(gridSizeSelect.value);
    if (gridSize === 3) winLength = 3;
    else if (gridSize === 4) winLength = 4;
    else if (gridSize === 5) winLength = 4;
    
    resetBoardCompletely();
}

function createBoard() {
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    
    let totalCells = gridSize * gridSize;
    board = Array(totalCells).fill('');

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.setAttribute('data-index', i);
        
        if (gridSize === 3) cell.style.fontSize = '2.8rem';
        else if (gridSize === 4) cell.style.fontSize = '2.2rem';
        else if (gridSize === 5) cell.style.fontSize = '1.7rem';

        cell.addEventListener('click', handleCellClick);
        boardElement.appendChild(cell);
    }
}

function handleCellClick(e) {
    const index = parseInt(e.target.getAttribute('data-index'));

    if (board[index] !== '' || !isGameActive || currentPlayer === 'O') return;

    makeMove(index, 'X');
    
    let winData = checkWin();
    if (winData.win) {
        endGame(winData.line, 'X');
        return;
    } else if (board.every(cell => cell !== '')) {
        endGame([], 'draw');
        return;
    }

    currentPlayer = 'O';
    statusDisplay.innerHTML = `<i class="fa-solid fa-robot fa-spin me-1"></i> AI sedang berpikir...`;
    
    setTimeout(makeAIMove, 500);
}

function makeMove(index, player) {
    board[index] = player;
    const cell = boardElement.children[index];
    cell.textContent = player;
    cell.classList.add(player.toLowerCase());
}

// Logika AI Berdasarkan Level
function makeAIMove() {
    if (!isGameActive) return;

    let difficulty = aiDifficultySelect.value;
    let bestMove = -1;

    if (difficulty === 'easy') {
        bestMove = getRandomMove();
    } else if (difficulty === 'medium') {
        bestMove = findSmartMove() ?? getRandomMove();
    } else {
        bestMove = findSmartMove() ?? getRandomMove();
    }

    if (bestMove !== -1) {
        makeMove(bestMove, 'O');
        
        let winData = checkWin();
        if (winData.win) {
            endGame(winData.line, 'O');
            return;
        } else if (board.every(cell => cell !== '')) {
            endGame([], 'draw');
            return;
        }

        currentPlayer = 'X';
        statusDisplay.innerHTML = `<i class="fa-solid fa-play me-1"></i> Giliran Kamu (X)`;
    }
}

function getRandomMove() {
    let emptyIndices = board.map((val, idx) => val === '' ? idx : null).filter(val => val !== null);
    if (emptyIndices.length === 0) return -1;
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
}

function findSmartMove() {
    // 1. Cek apakah AI bisa menang
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            board[i] = 'O';
            if (checkWin().win) {
                board[i] = '';
                return i;
            }
            board[i] = '';
        }
    }

    // 2. Cek apakah Player akan menang, lalu blokir
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            board[i] = 'X';
            if (checkWin().win) {
                board[i] = '';
                return i;
            }
            board[i] = '';
        }
    }

    // 3. Ambil tengah jika grid 3x3
    let center = Math.floor((gridSize * gridSize) / 2);
    if (gridSize === 3 && board[center] === '') return center;

    return null;
}

// Pengecekan Kemenangan Universal untuk Semua Ukuran Grid (3x3, 4x4, 5x5)
function checkWin() {
    const len = gridSize;
    const req = winLength;

    // Cek Horizontal
    for (let r = 0; r < len; r++) {
        for (let c = 0; c <= len - req; c++) {
            let p = board[r * len + c];
            if (p === '') continue;
            let match = true;
            let line = [];
            for (let i = 0; i < req; i++) {
                let idx = r * len + (c + i);
                line.push(idx);
                if (board[idx] !== p) { match = false; break; }
            }
            if (match) return { win: true, line: line };
        }
    }

    // Cek Vertikal
    for (let c = 0; c < len; c++) {
        for (let r = 0; r <= len - req; r++) {
            let p = board[r * len + c];
            if (p === '') continue;
            let match = true;
            let line = [];
            for (let i = 0; i < req; i++) {
                let idx = (r + i) * len + c;
                line.push(idx);
                if (board[idx] !== p) { match = false; break; }
            }
            if (match) return { win: true, line: line };
        }
    }

    for (let r = 0; r <= len - req; r++) {
        for (let c = 0; c <= len - req; c++) {
            let p = board[r * len + c];
            if (p === '') continue;
            let match = true;
            let line = [];
            for (let i = 0; i < req; i++) {
                let idx = (r + i) * len + (c + i);
                line.push(idx);
                if (board[idx] !== p) { match = false; break; }
            }
            if (match) return { win: true, line: line };
        }
    }

    for (let r = 0; r <= len - req; r++) {
        for (let c = req - 1; c < len; c++) {
            let p = board[r * len + c];
            if (p === '') continue;
            let match = true;
            let line = [];
            for (let i = 0; i < req; i++) {
                let idx = (r + i) * len + (c - i);
                line.push(idx);
                if (board[idx] !== p) { match = false; break; }
            }
            if (match) return { win: true, line: line };
        }
    }

    return { win: false, line: [] };
}

function endGame(winningLine, winner) {
    isGameActive = false;
    if (winner === 'X') {
        statusDisplay.innerHTML = `<i class="fa-solid fa-trophy text-warning me-1"></i> Selamat, Kamu Menang!`;
        scores.x++;
        scoreXEl.textContent = scores.x;
        winningLine.forEach(idx => boardElement.children[idx].classList.add('win'));
    } else if (winner === 'O') {
        statusDisplay.innerHTML = `<i class="fa-solid fa-robot text-danger me-1"></i> AI Menang! Coba lagi ya.`;
        scores.o++;
        scoreOEl.textContent = scores.o;
        winningLine.forEach(idx => boardElement.children[idx].classList.add('win'));
    } else {
        statusDisplay.innerHTML = `<i class="fa-solid fa-handshake me-1"></i> Permainan Seri (Draw)!`;
        scores.draw++;
        scoreDrawEl.textContent = scores.draw;
    }
}

function resetBoard() {
    isGameActive = true;
    currentPlayer = 'X';
    statusDisplay.innerHTML = `<i class="fa-solid fa-play me-1"></i> Giliran Kamu (X)`;
    createBoard();
}

function resetBoardCompletely() {
    scores = { x: 0, o: 0, draw: 0 };
    scoreXEl.textContent = '0';
    scoreOEl.textContent = '0';
    scoreDrawEl.textContent = '0';
    resetBoard();
}

document.addEventListener('DOMContentLoaded', () => {
    createBoard();
});