// xai.js handles the X (Twitter) AI Analysis tab using xAI Grok API
const xApiTokenInput = document.getElementById('x-api-token');
const xSearchBtn = document.getElementById('x-search-btn');
const xLoading = document.getElementById('x-loading');
const xResults = document.getElementById('x-results');
const xEmpty = document.getElementById('x-empty');

let favoriteCodes = [];
let isSearching = false;
let progressTimer = null;

function initXai() {
    const savedToken = localStorage.getItem('xApiToken');
    if (savedToken) xApiTokenInput.value = savedToken;

    xSearchBtn.addEventListener('click', handleXSearch);
}

function saveToken() {
    const token = xApiTokenInput.value.trim();
    if (token) localStorage.setItem('xApiToken', token);
    return token;
}

async function loadFavorites() {
    try {
        const response = await fetch('/api/favorites');
        if (response.ok) {
            favoriteCodes = await response.json();
        }
    } catch (err) {
        console.error('Favoriler yüklenemedi:', err);
    }
}

function appendLog(message) {
    let logContainer = document.getElementById('x-log-container');
    if (!logContainer) {
        logContainer = document.createElement('div');
        logContainer.id = 'x-log-container';
        logContainer.style.cssText = 'background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem; margin-top: 1rem; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 0.8rem; color: var(--text-muted);';
        const logTitle = document.createElement('div');
        logTitle.style.cssText = 'font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; font-size: 0.85rem;';
        logTitle.textContent = 'İlerleme:';
        logContainer.appendChild(logTitle);
        xLoading.appendChild(logContainer);
    }

    const entry = document.createElement('div');
    entry.style.cssText = 'padding: 0.15rem 0;';
    entry.textContent = `> ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function clearLog() {
    const logContainer = document.getElementById('x-log-container');
    if (logContainer) {
        logContainer.innerHTML = '';
        const logTitle = document.createElement('div');
        logTitle.style.cssText = 'font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; font-size: 0.85rem;';
        logTitle.textContent = 'İlerleme:';
        logContainer.appendChild(logTitle);
    }
}

function appendFundCard(code, text, error) {
    const card = document.createElement('div');
    card.className = 'x-fund-card';
    card.style.animation = 'fadeIn 0.5s ease';

    if (error) {
        card.innerHTML = `
          <div class="x-fund-header">
            <div>
              <h4 style="margin: 0; color: var(--danger);">${escapeHtml(code)}</h4>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Hata oluştu</span>
            </div>
          </div>
          <div class="x-tweets-list">
            <div class="empty-state" style="padding: 1rem; color: var(--danger);">${escapeHtml(error)}</div>
          </div>
        `;
    } else {
        const paragraphs = text.split('\n').filter(p => p.trim()).map(p => 
            `<p style="margin: 0 0 0.5rem 0; color: var(--text-main); font-size: 0.85rem; line-height: 1.5;">${escapeHtml(p)}</p>`
        ).join('');

        card.innerHTML = `
          <div class="x-fund-header">
            <div>
              <h4 style="margin: 0; color: var(--text-main);">${escapeHtml(code)}</h4>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Grok özeti hazır</span>
            </div>
          </div>
          <div class="x-tweets-list">
            <div style="padding: 0.5rem 0; color: var(--text-main); font-size: 0.85rem; line-height: 1.6;">
              ${paragraphs}
            </div>
          </div>
        `;
    }

    xResults.appendChild(card);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function handleXSearch() {
    if (isSearching) return;

    const token = saveToken();
    if (!token) {
        alert('Lütfen xAI API Bearer Token giriniz.');
        xApiTokenInput.focus();
        return;
    }

    await loadFavorites();
    if (favoriteCodes.length === 0) {
        alert('Favorilerinizde fon bulunamadı. Lütfen önce favorilere fon ekleyin.');
        return;
    }

    isSearching = true;
    xSearchBtn.disabled = true;
    xEmpty.style.display = 'none';
    xResults.style.display = 'block';
    xResults.innerHTML = '';
    xLoading.style.display = 'block';

    clearLog();
    appendLog(`${favoriteCodes.length} fon için Grok araması başlatılıyor...`);

    for (let i = 0; i < favoriteCodes.length; i++) {
        const code = favoriteCodes[i];
        appendLog(`"${code}" için arama yapılıyor (${i + 1}/${favoriteCodes.length})...`);

        try {
            const response = await fetch('/api/x-search-fund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, code })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                appendLog(`"${code}" sonuçları alındı.`);
                appendFundCard(code, result.text, null);
            } else {
                appendLog(`"${code}" hata: ${result.error || 'Bilinmeyen hata'}`);
                appendFundCard(code, null, result.error || 'Bilinmeyen hata');
            }
        } catch (err) {
            appendLog(`"${code}" istem hatası: ${err.message}`);
            appendFundCard(code, null, err.message);
        }
    }

    appendLog('Tüm aramalar tamamlandı.');
    isSearching = false;
    xSearchBtn.disabled = false;
    xLoading.style.display = 'none';
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initXai);
} else {
    initXai();
}
