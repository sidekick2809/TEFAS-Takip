// xai.js handles the X (Twitter) AI Analysis tab
const xApiTokenInput = document.getElementById('x-api-token');
const xSearchBtn = document.getElementById('x-search-btn');
const xLoading = document.getElementById('x-loading');
const xResults = document.getElementById('x-results');
const xEmpty = document.getElementById('x-empty');

let favoriteCodes = [];
let isSearching = false;

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

async function handleXSearch() {
    if (isSearching) return;

    const token = saveToken();
    if (!token) {
        alert('Lütfen X API Bearer Token giriniz.');
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
    xResults.style.display = 'none';
    xLoading.style.display = 'block';

    try {
        const response = await fetch('/api/x-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, codes: favoriteCodes })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Arama başarısız oldu');
        }

        renderXResults(result.data);
    } catch (err) {
        console.error('X search error:', err);
        xResults.innerHTML = `<div class="empty-state">Hata: ${escapeHtml(err.message)}</div>`;
        xResults.style.display = 'block';
    } finally {
        isSearching = false;
        xSearchBtn.disabled = false;
        xLoading.style.display = 'none';
    }
}

function renderXResults(data) {
    if (!data || data.length === 0) {
        xResults.innerHTML = '<div class="empty-state">Sonuç bulunamadı.</div>';
        xResults.style.display = 'block';
        return;
    }

    xResults.innerHTML = '';

    data.forEach(fund => {
        const card = document.createElement('div');
        card.className = 'x-fund-card';

        const tweetsHtml = fund.tweets && fund.tweets.length > 0
            ? fund.tweets.slice(0, 5).map(tweet => `
                <div class="x-tweet">
                  <div class="x-tweet-header">
                    <span class="x-tweet-author">${escapeHtml(tweet.author_name)}</span>
                    <span class="x-tweet-date">${formatDate(tweet.created_at)}</span>
                  </div>
                  <p class="x-tweet-text">${escapeHtml(tweet.text)}</p>
                  <div class="x-tweet-metrics">
                    <span>❤️ ${tweet.likes}</span>
                    <span>🔄 ${tweet.retweets}</span>
                    <span>💬 ${tweet.replies}</span>
                    <a href="${escapeHtml(tweet.url)}" target="_blank" class="fund-link" style="font-size: 0.75rem;">X'te Gör →</a>
                  </div>
                </div>
              `).join('')
            : `<div class="empty-state" style="padding: 1rem;">${fund.error ? escapeHtml(fund.error) : 'Bu fon için tweet bulunamadı.'}</div>`;

        card.innerHTML = `
          <div class="x-fund-header">
            <div>
              <h4 style="margin: 0; color: var(--text-main);">${escapeHtml(fund.code)}</h4>
              <span style="font-size: 0.8rem; color: var(--text-muted);">${fund.tweets ? fund.tweets.length : 0} tweet bulundu</span>
            </div>
          </div>
          <div class="x-tweets-list">${tweetsHtml}</div>
        `;

        xResults.appendChild(card);
    });

    xResults.style.display = 'block';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initXai);
} else {
    initXai();
}
