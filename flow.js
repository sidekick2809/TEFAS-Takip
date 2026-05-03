// flow.js handles the Para Akışı tab calculations and rendering
const flowBody = document.getElementById('flow-body');
const flowTable = document.getElementById('flow-table');

// Sorting state
let flowSortColumn = 'code';
let flowSortDirection = 'asc';

function getActiveFunds() {
    const portfolio = JSON.parse(localStorage.getItem('tefasPortfolio')) || [];
    const aggregated = {};
    portfolio.forEach(e => {
        if (!aggregated[e.code]) aggregated[e.code] = 0;
        if (e.type === 'AL') {
            aggregated[e.code] += e.lots;
        } else {
            aggregated[e.code] -= e.lots;
        }
    });
    return Object.keys(aggregated).filter(code => aggregated[code] > 0.0001);
}

async function fetchFlowData() {
    const activeFunds = getActiveFunds();
    if (activeFunds.length === 0) {
        flowBody.innerHTML = '<tr><td colspan="5" class="empty-state">Portföyünüzde aktif fon bulunamadı.</td></tr>';
        return;
    }

    try {
        // Use data already in memory or fetch from local API
        let yatData = window.fullData || [];
        let besData = window.besData || [];

        // If memory is empty, try fetching from server
        if (yatData.length === 0) {
            const res = await fetch('/api/tefas-data?type=YAT');
            const result = await res.json();
            yatData = result.data || [];
        }
        if (besData.length === 0) {
            const res = await fetch('/api/tefas-data?type=EMK');
            const result = await res.json();
            besData = result.data || [];
        }

        const allData = [...yatData, ...besData];
        const activeSet = new Set(activeFunds.map(c => c.toUpperCase()));
        const results = [];

        activeSet.forEach(code => {
            const fund = allData.find(f => f[0] === code);
            if (fund) {
                // Index 20: portfoyBuyukluk (Today)
                // Index 22: portfoyBuyukluk1 (Yesterday)
                results.push({
                    code: code,
                    today: fund[20] || 0,
                    yesterday: fund[22] || 0
                });
            }
        });

        localStorage.setItem('tefasFlowData-YAT', JSON.stringify(results));
        renderFlowTable(results);
    } catch (e) {
        console.error('Unexpected error in fetchFlowData:', e);
        flowBody.innerHTML = '<tr><td colspan="5" class="empty-state">Veri işlenirken hata oluştu.</td></tr>';
    }
}

function renderFlowTable(results) {
    if (!results || results.length === 0) {
        flowBody.innerHTML = '<tr><td colspan="5" class="empty-state">Veri bulunamadı. Ana sayfadan verileri güncelleyin.</td></tr>';
        return;
    }

    flowBody.innerHTML = '';

    // Get full data for returns
    const fullData = window.fullData || JSON.parse(localStorage.getItem('tefasData')) || [];

    // Add gunYuzde to results for sorting
    results.forEach(item => {
        const liveRow = fullData.find(r => r[0] === item.code);
        item.gunYuzde = liveRow ? liveRow[2] : null;
        item.netAkis = item.today - (item.yesterday * (1 + (item.gunYuzde || 0)));
    });

    // Sort results based on current sort column and direction
    results.sort((a, b) => {
        let valA, valB;

        switch (flowSortColumn) {
            case 'code':
                valA = a.code;
                valB = b.code;
                return flowSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            case 'today':
                valA = a.today;
                valB = b.today;
                break;
            case 'yesterday':
                valA = a.yesterday;
                valB = b.yesterday;
                break;
            case 'gunYuzde':
                valA = a.gunYuzde || 0;
                valB = b.gunYuzde || 0;
                break;
            case 'netAkis':
                valA = a.netAkis;
                valB = b.netAkis;
                break;
            default:
                valA = a.code;
                valB = b.code;
        }

        return flowSortDirection === 'asc' ? valA - valB : valB - valA;
    });

    results.forEach(item => {
        const formatPercent = (val) => {
            if (val === null || val === undefined) return '<span class="val-zero">-</span>';
            const num = val * 100;
            const cssClass = num > 0.005 ? 'val-up' : num < -0.005 ? 'val-down' : 'val-zero';
            return `<span class="${cssClass}">${num > 0 ? '+' : ''}${num.toFixed(2)}%</span>`;
        };

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <a href="https://www.tefas.gov.tr/tr/fon-detayli-analiz/${item.code}" target="_blank" class="fund-link">
                    <strong>${item.code}</strong>
                </a>
            </td>
            <td>
                <div style="font-weight: 600;">${item.today.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </td>
            <td>
                <div>${item.yesterday.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </td>
            <td>${formatPercent(item.gunYuzde)}</td>
            <td class="${item.netAkis > 1 ? 'val-up' : item.netAkis < -1 ? 'val-down' : 'val-zero'}">
                ${item.netAkis > 0 ? '+' : ''}${item.netAkis.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </td>
        `;
        flowBody.appendChild(tr);
    });

    updateFlowSortIcons();
}

function updateFlowSortIcons() {
    const headers = flowTable.querySelectorAll('thead th');
    headers.forEach((th, index) => {
        // Remove existing sort classes
        th.classList.remove('sort-asc', 'sort-desc');

        const columns = ['code', 'today', 'yesterday', 'gunYuzde', 'netAkis'];
        const colName = columns[index];

        if (colName === flowSortColumn) {
            th.classList.add(flowSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
}

function handleFlowSort(event) {
    const th = event.target.closest('th');
    if (!th) return;

    const headers = Array.from(flowTable.querySelectorAll('thead th'));
    const colIndex = headers.indexOf(th);

    const columns = ['code', 'today', 'yesterday', 'gunYuzde', 'netAkis'];
    const newColumn = columns[colIndex];

    if (flowSortColumn === newColumn) {
        flowSortDirection = flowSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        flowSortColumn = newColumn;
        flowSortDirection = 'asc';
    }

    // Re-render the table with saved data
    const saved = localStorage.getItem('tefasFlowData-YAT');
    if (saved) {
        renderFlowTable(JSON.parse(saved));
    }
}

// Export for transactions.js tab switching
window.renderFlow = function () {
    fetchFlowData();
};

// ==================== KAP BİLDİRİMLERİ ====================
const fetchKapBtn = document.getElementById('fetch-kap-btn');
const clearKapBtn = document.getElementById('clear-kap-btn');
const kapBody = document.getElementById('kap-body');

async function fetchKapData() {
    if (!fetchKapBtn) return;

    const spinner = fetchKapBtn.querySelector('.loader-spinner');
    const btnIcon = fetchKapBtn.querySelector('.btn-icon');

    // Show loading
    fetchKapBtn.disabled = true;
    if (spinner) spinner.style.display = 'block';
    if (btnIcon) btnIcon.style.display = 'none';

    try {
        // Use server proxy to fetch KAP data (avoids CORS issues)
        const response = await fetch('/api/kap-data/fetch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Veri çekilemedi');
        }

        if (!result.data || result.data.length === 0) {
            kapBody.innerHTML = '<tr><td colspan="5" class="empty-state">' + (result.message || 'Belirtilen tarihler için KAP\'ta (YF) bildirimi bulunamadı.') + '</td></tr>';
            showStatusMessage(result.message || 'KAP verisi bulunamadı', 'info');
            return;
        }

        // Render the data (already saved to database by server)
        renderKapTable(result.data);
        showStatusMessage(`${result.count} adet KAP bildirimi çekildi.`, 'success');

    } catch (error) {
        console.error('KAP veri çekme hatası:', error);
        showStatusMessage('KAP verileri çekilemedi: ' + error.message, 'error');
    } finally {
        fetchKapBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnIcon) btnIcon.style.display = 'block';
    }
}

function renderKapTable(data) {
    if (!kapBody) return;

    if (!data || data.length === 0) {
        kapBody.innerHTML = '<tr><td colspan="5" class="empty-state">Veri bulunamadı.</td></tr>';
        return;
    }

    // Get portfolio codes for matching
    const portfolio = JSON.parse(localStorage.getItem('tefasPortfolio')) || [];
    const portfolioCodes = new Set();
    portfolio.forEach(p => {
        if (p.code) portfolioCodes.add(p.code.toUpperCase());
    });

    kapBody.innerHTML = '';

    data.forEach(item => {
        const isInPortfolio = portfolioCodes.has((item.stockCode || '').toUpperCase());
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" class="fund-link">` : ''}
                <strong>${escapeHtml(item.stockCode)}</strong>
                ${item.url ? `</a>` : ''}
                ${isInPortfolio ? '<span class="kap-badge" title="Portföyünüzde bu fon var!"><svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>' : ''}
            </td>
            <td>${escapeHtml(item.publishDate)}</td>
            <td title="${escapeHtml(item.title)}">${truncateText(item.title, 50)}</td>
            <td>${escapeHtml(item.companyTitle)}</td>
            <td>${escapeHtml(item.disclosureCategory)}</td>
        `;
        kapBody.appendChild(tr);
    });
}

async function clearKapData() {
    if (!clearKapBtn) return;

    const spinner = clearKapBtn.querySelector('.loader-spinner');
    const btnIcon = clearKapBtn.querySelector('.btn-icon');

    // Show loading
    clearKapBtn.disabled = true;
    if (spinner) spinner.style.display = 'block';
    if (btnIcon) btnIcon.style.display = 'none';

    try {
        const response = await fetch('/api/kap-data', {
            method: 'DELETE'
        });

        if (response.ok) {
            kapBody.innerHTML = '<tr><td colspan="5" class="empty-state">Veri yüklemek için "Verileri Çek" butonuna tıklayın.</td></tr>';
            showStatusMessage('KAP verileri temizlendi.', 'success');
        } else {
            throw new Error('Veriler temizlenemedi');
        }
    } catch (error) {
        console.error('KAP veri temizleme hatası:', error);
        showStatusMessage('KAP verileri temizlenemedi: ' + error.message, 'error');
    } finally {
        clearKapBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnIcon) btnIcon.style.display = 'block';
    }
}

async function loadKapData() {
    try {
        const response = await fetch('/api/kap-data');
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                renderKapTable(data);
            }
        }
    } catch (error) {
        console.error('KAP veri yükleme hatası:', error);
    }
}

// Helper functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function showStatusMessage(message, type) {
    const statusEl = document.getElementById('status-message');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 5000);
}

// Event listeners
if (fetchKapBtn) {
    fetchKapBtn.addEventListener('click', fetchKapData);
}

if (clearKapBtn) {
    clearKapBtn.addEventListener('click', clearKapData);
}

// Load data on page load - combined with existing flow handler
window.addEventListener('DOMContentLoaded', () => {
    window.renderFlow();
    loadKapData();

    // Add sorting event listener to flow table
    if (flowTable) {
        const flowThead = flowTable.querySelector('thead');
        if (flowThead) {
            flowThead.addEventListener('click', handleFlowSort);
        }
    }
});
