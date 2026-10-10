document.addEventListener('DOMContentLoaded', () => {
    const counterInput = document.getElementById('counter-input');
    const wordCount = document.getElementById('word-count');
    const charCount = document.getElementById('char-count');
    const paraCount = document.getElementById('para-count');
    const readTime = document.getElementById('read-time');
    const charNoSpaceCount = document.getElementById('char-no-space-count');

    // Analisis Teks Real-time Khusus Section Penghitung Kata
    if (counterInput) {
        counterInput.addEventListener('input', () => {
            const text = counterInput.value;

            charCount.textContent = text.length;

            const charsNoSpace = text.replace(/\s/g, '').length;
            charNoSpaceCount.textContent = `Karakter (tanpa spasi): ${charsNoSpace}`;

            const trimmedText = text.trim();
            const words = trimmedText ? trimmedText.split(/\s+/).length : 0;
            wordCount.textContent = words;

            const paragraphs = trimmedText ? trimmedText.split(/\n+/).filter(para => para.trim().length > 0).length : 0;
            paraCount.textContent = paragraphs;

            if (words === 0) {
                readTime.textContent = '0s';
            } else {
                const totalSeconds = Math.ceil((words / 200) * 60);
                if (totalSeconds < 60) {
                    readTime.textContent = `${totalSeconds}s`;
                } else {
                    const mins = Math.floor(totalSeconds / 60);
                    const secs = totalSeconds % 60;
                    readTime.textContent = `${mins}m ${secs}s`;
                }
            }
        });
    }
});

async function translateText() {
    const translateInput = document.getElementById('translate-input').value.trim();
    const translateOutput = document.getElementById('translate-output');
    const langPair = document.getElementById('lang-pair').value;
    const btnTranslate = document.getElementById('btn-translate');

    if (!translateInput) {
        alert('Masukkan teks pada kotak Teks Asal terlebih dahulu!');
        return;
    }

    btnTranslate.disabled = true;
    btnTranslate.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i> Menerjemahkan...`;
    translateOutput.value = "Sedang menerjemahkan...";

    try {
        function chunkText(str, maxLength = 450) {
            const chunks = [];
            let currentChunk = '';
            const sentences = str.split(/(?<=[.?!/])\s+|\n/);

            for (let sentence of sentences) {
                if ((currentChunk + ' ' + sentence).length > maxLength) {
                    if (currentChunk) chunks.push(currentChunk);
                    currentChunk = sentence;
                } else {
                    currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
                }
            }
            if (currentChunk) chunks.push(currentChunk);
            return chunks;
        }

        const textChunks = chunkText(translateInput);
        let translatedResults = [];

        for (let chunk of textChunks) {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${langPair}`);
            const data = await response.json();

            if (data.responseData && data.responseData.translatedText) {
                translatedResults.push(data.responseData.translatedText);
            } else {
                translatedResults.push(chunk);
            }
        }

        translateOutput.value = translatedResults.join(' ');

    } catch (error) {
        console.error("Translation error:", error);
        translateOutput.value = "Terjadi kesalahan koneksi saat menerjemahkan.";
    } finally {
        btnTranslate.disabled = false;
        btnTranslate.innerHTML = `<i class="fa-solid fa-bolt me-1"></i> Terjemahkan`;
    }
}

// Clear Section Penghitung Kata
function clearCounterText() {
    const counterInput = document.getElementById('counter-input');
    if (counterInput) {
        counterInput.value = '';
        counterInput.dispatchEvent(new Event('input'));
        counterInput.focus();
    }
}

// Clear Section Penerjemah
function clearTranslateText() {
    const translateInput = document.getElementById('translate-input');
    const translateOutput = document.getElementById('translate-output');
    if (translateInput) translateInput.value = '';
    if (translateOutput) translateOutput.value = '';
}

function copyText(elementId) {
    const element = document.getElementById(elementId);
    if (!element || !element.value.trim()) {
        alert('Tidak ada teks untuk disalin!');
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(element.value).then(() => {
            alert('Teks berhasil disalin ke clipboard!');
        }).catch(err => {
            console.error('Gagal menyalin:', err);
        });
    } else {
        element.select();
        document.execCommand('copy');
        alert('Teks berhasil disalin ke clipboard!');
    }
}