// flow.js handles the Para Akışı tab calculations and rendering
const flowBody = document.getElementById('flow-body');
const flowTable = document.getElementById('flow-table');
const refreshFlowBtn = document.getElementById('refresh-flow-btn');
const flowSettingsBtn = document.getElementById('flow-settings-btn');
const flowSettingsModal = document.getElementById('flow-settings-modal');
const flowSettingsSaveBtn = document.getElementById('flow-settings-save-btn');
const flowSettingsCloseBtn = document.getElementById('flow-settings-close-btn');
const flowSettingsDefaultBtn = document.getElementById('flow-settings-default-btn');

const settingTodayInput = document.getElementById('flow-setting-today');
const settingYesterdayInput = document.getElementById('flow-setting-yesterday');

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

function getFlowDates() {
    // Check for manual overrides in localStorage
    const manualToday = localStorage.getItem('flowManualToday');
    const manualYesterday = localStorage.getItem('flowManualYesterday');

    if (manualToday && manualYesterday) {
        // manualToday is already YYYY-MM-DD from input, 
        // bittarih (currentDate) needs DD.MM.YYYY
        const d1 = new Date(manualToday);
        const day1 = String(d1.getDate()).padStart(2, '0');
        const month1 = String(d1.getMonth() + 1).padStart(2, '0');
        const year1 = d1.getFullYear();
        const currentDate = `${day1}.${month1}.${year1}`;

        // formattedThreeDaysAgo is YYYY-MM-DD
        const formattedThreeDaysAgo = manualYesterday;

        return { formattedThreeDaysAgo, currentDate };
    }

    const now = new Date();

    // API bitis tarihi dd.MM.yyyy istiyor
    const formatDateTR = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const currentDateTR = formatDateTR(now);

    const threeDaysAgo = new Date(now);
    const today = now.getDay(); // 0=Pazar, 1=Pazartesi, ...

    if (today === 1) {
        threeDaysAgo.setDate(now.getDate() - 3);
    } else {
        threeDaysAgo.setDate(now.getDate() - 1);
    }
    const formattedThreeDaysAgoTR = formatDateTR(threeDaysAgo);

    return { formattedThreeDaysAgo: formattedThreeDaysAgoTR, currentDate: currentDateTR };
}

async function fetchFlowData() {
    const activeFunds = getActiveFunds();
    if (activeFunds.length === 0) {
        flowBody.innerHTML = '<tr><td colspan="5" class="empty-state">Portföyünüzde aktif fon bulunamadı.</td></tr>';
        return;
    }

    const { formattedThreeDaysAgo, currentDate } = getFlowDates();
    const apiUrl = '/api/DB/BindHistoryInfo';

    const results = [];

    // Show loading
    refreshFlowBtn.disabled = true;
    const spinner = refreshFlowBtn.querySelector('.loader-spinner');
    const btnIcon = refreshFlowBtn.querySelector('.btn-icon');
    if (spinner) spinner.style.display = 'block';
    if (btnIcon) btnIcon.style.display = 'none';

    try {
        for (const code of activeFunds) {
            try {
                // Determine if EMK or YAT based on code (standard is 3 letters)
                // However, for simplicity and since TEFAS usually uses YAT for both or separate,
                // but EMK funds usually fail with fontip=YAT.
                // Let's check fullData to guess fontip if available.
                const fullData = window.fullData || JSON.parse(localStorage.getItem('tefasData')) || [];
                const besData = JSON.parse(localStorage.getItem('tefasData-bes')) || [];

                let fontip = "YAT";
                if (besData.find(f => f[0] === code)) fontip = "EMK";

                const payload = new URLSearchParams({
                    "fontip": fontip,
                    "sfontur": "",
                    "fonkod": code.toUpperCase(),
                    "fongrup": "",
                    "bastarih": formattedThreeDaysAgo,
                    "bittarih": currentDate,
                    "fonturkod": "",
                    "fonunvantip": "",
                    "kurucukod": ""
                });

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: payload.toString()
                });

                if (!response.ok) continue;

                const data = await response.json();

                if (data && data.data && data.data.length >= 2) {
                    // Today is data[0], Yesterday is data[1]
                    const todayData = data.data[0];
                    const yesterdayData = data.data[1];

                    results.push({
                        code: code,
                        today: parseFloat(todayData.PORTFOYBUYUKLUK) || 0,
                        yesterday: parseFloat(yesterdayData.PORTFOYBUYUKLUK) || 0
                    });
                } else if (data && data.data && data.data.length === 1) {
                    results.push({
                        code: code,
                        today: parseFloat(data.data[0].PORTFOYBUYUKLUK) || 0,
                        yesterday: 0
                    });
                }
            } catch (err) {
                console.error(`Error fetching flow for ${code}:`, err);
            }
        }

        localStorage.setItem('tefasFlowData-YAT', JSON.stringify(results));
        renderFlowTable(results);
    } catch (e) {
        console.error(e);
    } finally {
        refreshFlowBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnIcon) btnIcon.style.display = 'block';
    }
}

function renderFlowTable(results) {
    if (!results || results.length === 0) {
        flowBody.innerHTML = '<tr><td colspan="5" class="empty-state">Veri bulunamadı. Verileri güncelle butonuna basın.</td></tr>';
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
                <a href="https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${item.code}" target="_blank" class="fund-link">
                    <strong>${item.code}</strong>
                </a>
            </td>
            <td>${item.today.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
            <td>${item.yesterday.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
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
    const saved = localStorage.getItem('tefasFlowData-YAT');
    if (saved) {
        renderFlowTable(JSON.parse(saved));
    }
};

if (refreshFlowBtn) {
    refreshFlowBtn.addEventListener('click', fetchFlowData);
}

// Modal Logic
if (flowSettingsBtn) {
    flowSettingsBtn.addEventListener('click', () => {
        // Set current values to inputs
        const currentToday = localStorage.getItem('flowManualToday');
        const currentYesterday = localStorage.getItem('flowManualYesterday');

        if (currentToday) settingTodayInput.value = currentToday;
        if (currentYesterday) settingYesterdayInput.value = currentYesterday;

        flowSettingsModal.style.display = 'flex';
    });
}

if (flowSettingsCloseBtn) {
    flowSettingsCloseBtn.addEventListener('click', () => {
        flowSettingsModal.style.display = 'none';
    });
}

if (flowSettingsSaveBtn) {
    flowSettingsSaveBtn.addEventListener('click', () => {
        const valToday = settingTodayInput.value;
        const valYesterday = settingYesterdayInput.value;

        if (valToday) localStorage.setItem('flowManualToday', valToday);
        if (valYesterday) localStorage.setItem('flowManualYesterday', valYesterday);

        flowSettingsModal.style.display = 'none';
        showStatusMessage('Tarih ayarları kaydedildi. Verileri güncelle butonuna basarak yeni tarihlerle veri çekebilirsiniz.', 'success');
    });
}

if (flowSettingsDefaultBtn) {
    flowSettingsDefaultBtn.addEventListener('click', () => {
        const f = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${year}-${month}-${day}`;
        };

        // Bugünün tarihi
        const today = new Date();
        settingTodayInput.value = f(today);

        // Dün (target) - Pazartesi ise 3 gün önce, değilse 1 gün önce
        const yesterday = new Date();
        if (yesterday.getDay() === 1) {
            yesterday.setDate(yesterday.getDate() - 3);
        } else {
            yesterday.setDate(yesterday.getDate() - 1);
        }
        settingYesterdayInput.value = f(yesterday);

        showStatusMessage('Tarihler varsayılan değerlere sıfırlandı.', 'success');
    });
}

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
            kapBody.innerHTML = '<tr><td colspan="6" class="empty-state">' + (result.message || 'Belirtilen tarihler için KAP\'ta (YF) bildirimi bulunamadı.') + '</td></tr>';
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
        kapBody.innerHTML = '<tr><td colspan="6" class="empty-state">Veri bulunamadı.</td></tr>';
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
                <strong>${escapeHtml(item.stockCode)}</strong>
                ${isInPortfolio ? '<span class="kap-badge" title="Portföyünüzde bu fon var!"><svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>' : ''}
            </td>
            <td>${escapeHtml(item.publishDate)}</td>
            <td title="${escapeHtml(item.title)}">${truncateText(item.title, 50)}</td>
            <td>${escapeHtml(item.companyTitle)}</td>
            <td>${escapeHtml(item.disclosureCategory)}</td>
            <td>
                ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" class="fund-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>` : '-'}
            </td>
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
            kapBody.innerHTML = '<tr><td colspan="6" class="empty-state">Veri yüklemek için "Verileri Çek" butonuna tıklayın.</td></tr>';
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
