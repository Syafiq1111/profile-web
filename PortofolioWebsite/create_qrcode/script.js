document.addEventListener('DOMContentLoaded', () => {
    const input      = document.getElementById('qr-input');
    const sizeSel    = document.getElementById('qr-size');
    const levelSel   = document.getElementById('qr-level');
    const fgInput    = document.getElementById('qr-fg');
    const bgInput    = document.getElementById('qr-bg');
    const btnGen     = document.getElementById('btn-generate');
    const btnClear   = document.getElementById('btn-clear');
    const btnDl      = document.getElementById('btn-download');
    const btnCopyImg = document.getElementById('btn-copy-img');
    const stage      = document.getElementById('qr-stage');
    const empty      = document.getElementById('qr-empty');
    const frame      = document.getElementById('qr-frame');
    const output     = document.getElementById('qr-output');
    const hint       = document.getElementById('qr-hint');

    let debounceTimer = null;

    function setHint(message, isError = false) {
        hint.textContent = message;
        hint.style.color = isError ? '#ff758f' : '';
    }

    function showEmpty() {
        output.innerHTML = '';
        frame.style.display = 'none';
        empty.style.display = '';
        stage.classList.remove('has-qr');
        btnDl.disabled = true;
        btnCopyImg.disabled = true;
    }

    function generateQR() {
        const text = input.value.trim();

        if (!text) {
            showEmpty();
            setHint('');
            return;
        }

        if (typeof QRCode === 'undefined') {
            setHint('Library QR gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.', true);
            return;
        }

        const size = parseInt(sizeSel.value, 10);
        const displaySize = Math.min(size, 320);

        output.innerHTML = '';

        try {
            new QRCode(output, {
                text: text,
                width: size,
                height: size,
                colorDark: fgInput.value,
                colorLight: bgInput.value,
                correctLevel: QRCode.CorrectLevel[levelSel.value]
            });
        } catch (err) {
            showEmpty();
            setHint('Teks terlalu panjang untuk dijadikan QR code. Persingkat teks atau turunkan level koreksi error.', true);
            return;
        }

        output.querySelectorAll('canvas, img').forEach(el => {
            el.style.width = displaySize + 'px';
            el.style.height = displaySize + 'px';
        });

        frame.style.background = bgInput.value;
        frame.style.display = 'block';
        empty.style.display = 'none';
        stage.classList.add('has-qr');
        btnDl.disabled = false;
        btnCopyImg.disabled = !(navigator.clipboard && window.ClipboardItem);
        setHint(`QR code siap, ukuran unduhan ${size} × ${size} px.`);
    }

    function getFinalCanvas() {
        const source = output.querySelector('canvas');
        if (!source) return null;

        const margin = Math.round(source.width * 0.06);
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = source.width + margin * 2;
        finalCanvas.height = source.height + margin * 2;

        const ctx = finalCanvas.getContext('2d');
        ctx.fillStyle = bgInput.value;
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        ctx.drawImage(source, margin, margin);
        return finalCanvas;
    }

    function downloadQR() {
        const canvas = getFinalCanvas();
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = 'qr-code.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        setHint('QR code berhasil diunduh.');
    }

    function copyQRImage() {
        const canvas = getFinalCanvas();
        if (!canvas) return;

        canvas.toBlob(async (blob) => {
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                setHint('Gambar QR code disalin ke clipboard.');
            } catch (err) {
                console.error('Gagal menyalin gambar:', err);
                setHint('Gagal menyalin gambar. Gunakan tombol Unduh PNG.', true);
            }
        }, 'image/png');
    }

    function clearAll() {
        input.value = '';
        showEmpty();
        setHint('');
        input.focus();
    }

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(generateQR, 350);
    });

    [sizeSel, levelSel, fgInput, bgInput].forEach(el => el.addEventListener('change', generateQR));

    btnGen.addEventListener('click', () => {
        if (!input.value.trim()) {
            setHint('Isi link atau teks terlebih dahulu.', true);
            input.focus();
            return;
        }
        generateQR();
    });

    btnDl.addEventListener('click', downloadQR);
    btnCopyImg.addEventListener('click', copyQRImage);
    btnClear.addEventListener('click', clearAll);
});