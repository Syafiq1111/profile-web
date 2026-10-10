let timer = null;
let totalSeconds = 25 * 60;
let timeLeft = totalSeconds;
let isRunning = false;

let audioCtx = null;
let alarmInterval = null;
let finishModal = null;

let display;
let startBtn;
let inputMinutes;

document.addEventListener('DOMContentLoaded', () => {
    display = document.getElementById('time-display');
    startBtn = document.getElementById('start-btn');
    inputMinutes = document.getElementById('custom-minutes');
    finishModal = new bootstrap.Modal(document.getElementById('finishModal'));

    updateDisplay();
});

// Alarm Suara 10 Detik
function play10SecAlarm() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        let elapsed = 0;
        
        function playBeep() {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch neon beep
            
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }

        playBeep();
        alarmInterval = setInterval(() => {
            elapsed += 0.6;
            if (elapsed >= 10) {
                clearInterval(alarmInterval);
                alarmInterval = null;
            } else {
                playBeep();
            }
        }, 600);

    } catch (e) {
        console.log("Audio Error / Blocked by browser");
    }
}

function stopAlarmAndCloseModal() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
    finishModal.hide();
}

function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.title = `${display.textContent} - Custom Timer`;
}

function setCustomTime() {
    const val = parseFloat(inputMinutes.value);
    if (isNaN(val) || val <= 0) {
        alert("Masukkan jumlah menit yang valid!");
        return;
    }
    pauseTimer();
    totalSeconds = Math.round(val * 60);
    timeLeft = totalSeconds;
    updateDisplay();
}

function quickSet(minutes) {
    inputMinutes.value = minutes;
    setCustomTime();
}

function toggleTimer() {
    if (isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function startTimer() {
    if (timeLeft <= 0) return;

    isRunning = true;
    startBtn.innerHTML = `<i class="fa-solid fa-pause me-2"></i> Jeda`;
    startBtn.classList.replace('btn-start', 'btn-outline-warning');

    timer = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            updateDisplay();
        } else {
            pauseTimer();
            play10SecAlarm();
            finishModal.show();
        }
    }, 1000);
}

function pauseTimer() {
    isRunning = false;
    clearInterval(timer);
    startBtn.innerHTML = `<i class="fa-solid fa-play me-2"></i> Mulai`;
    startBtn.className = "btn control-btn btn-start";
}

function resetTimer() {
    pauseTimer();
    timeLeft = totalSeconds;
    updateDisplay();
}