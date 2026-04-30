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

let sessionFlowToday = null;
let sessionFlowYesterday = null;

function getFlowDates() {
    const manualToday = sessionFlowToday;
    const manualYesterday = sessionFlowYesterday;

    const formatDateTEFAS = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    };

    if (manualToday && manualYesterday) {
        const d1 = new Date(manualToday);
        const d2 = new Date(manualYesterday);
        return { 
            formattedYesterday: formatDateTEFAS(d2), 
            formattedToday: formatDateTEFAS(d1) 
        };
    }

    const now = new Date();
    // If it's early morning (before 10 AM), TEFAS usually doesn't have today's data yet.
    // However, the user specifically asked for yesterday/today.
    // We'll fetch a slightly wider range (last 4 days) to be safe and then pick the best matches.
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    // For the API call, we use a 4-day range to ensure we get at least 2 business days
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(today.getDate() - 4);

    return { 
        formattedYesterday: formatDateTEFAS(yesterday), 
        formattedToday: formatDateTEFAS(today),
        basTarih: formatDateTEFAS(fourDaysAgo),
        bitTarih: formatDateTEFAS(today)
    };
}

async function fetchFlowData() {
    const activeFunds = getActiveFunds();
    if (activeFunds.length === 0) {
        flowBody.innerHTML = '<tr><td colspan="5" class="empty-state">Portföyünüzde aktif fon bulunamadı.</td></tr>';
        return;
    }

    const { formattedYesterday, formattedToday } = getFlowDates();
    const apiUrl = '/api/tefas/fon-gnl-blgsirali';

    // Show loading
    refreshFlowBtn.disabled = true;
    const spinner = refreshFlowBtn.querySelector('.loader-spinner');
    const btnIcon = refreshFlowBtn.querySelector('.btn-icon');
    if (spinner) spinner.style.display = 'block';
    if (btnIcon) btnIcon.style.display = 'none';

    try {
        const fetchForDate = async (targetDate) => {
            const fetchSingle = async (fonTipi) => {
                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fontip: fonTipi,
                            fonkod: null,
                            bastarih: targetDate,
                            bitTarih: targetDate
                        })
                    });
                    if (!response.ok) return [];
                    const result = await response.json();
                    return (result && result.data && Array.isArray(result.data)) ? result.data : [];
                } catch (err) {
                    console.error(`Error fetching ${fonTipi} for ${targetDate}:`, err);
                    return [];
                }
            };

            const [yati, emk] = await Promise.all([fetchSingle('YAT'), fetchSingle('EMK')]);
            return [...yati, ...emk];
        };

        // We need data for at least 2 different business days.
        // We'll fetch today, yesterday, and 2 days ago to be sure we find 2 valid points for every fund.
        const d1 = new Date();
        const d2 = new Date(); d2.setDate(d1.getDate() - 1);
        const d3 = new Date(); d3.setDate(d1.getDate() - 2);
        const d4 = new Date(); d4.setDate(d1.getDate() - 3);
        const d5 = new Date(); d5.setDate(d1.getDate() - 4);

        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}${month}${day}`;
        };

        // If manual dates are set, use them as the primary targets
        const targetDates = (sessionFlowToday && sessionFlowYesterday) 
            ? [formatDate(new Date(sessionFlowToday)), formatDate(new Date(sessionFlowYesterday))]
            : [formatDate(d1), formatDate(d2), formatDate(d3), formatDate(d4), formatDate(d5)];

        const allResults = await Promise.all(targetDates.map(date => fetchForDate(date)));
        const allData = allResults.flat();

        const activeSet = new Set(activeFunds.map(c => c.toUpperCase()));

        // Robust date normalization
        const normalizeDate = (d) => {
            if (!d) return "";
            if (d.includes('-')) return d.replace(/-/g, ''); // YYYY-MM-DD
            if (d.includes('.')) { // DD.MM.YYYY
                const [day, month, year] = d.split('.');
                return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
            }
            return d;
        };

        const groupedByCode = {}; 
        allData.forEach(entry => {
            const code = entry.fonKodu ? entry.fonKodu.toUpperCase() : (entry.FONKODU || null);
            if (!code || !activeSet.has(code)) return;

            const dateNorm = normalizeDate(entry.tarih || entry.TARIH);
            if (!groupedByCode[code]) groupedByCode[code] = [];
            
            if (!groupedByCode[code].some(e => normalizeDate(e.tarih || e.TARIH) === dateNorm)) {
                groupedByCode[code].push(entry);
            }
        });

        const results = [];
        for (const [code, entries] of Object.entries(groupedByCode)) {
            // Sort entries by date descending
            entries.sort((a, b) => {
                const d1 = normalizeDate(b.tarih || b.TARIH);
                const d2 = normalizeDate(a.tarih || a.TARIH);
                return d1.localeCompare(d2);
            });

            // "Today" is the latest available entry
            const todayEntry = entries[0];
            // "Yesterday" is the one before it
            const yesterdayEntry = entries[1];

            results.push({
                code: code,
                today: todayEntry ? parseFloat(todayEntry.portfoyBuyukluk || todayEntry.PORTFOYBUYUKLUK) || 0 : 0,
                yesterday: yesterdayEntry ? parseFloat(yesterdayEntry.portfoyBuyukluk || yesterdayEntry.PORTFOYBUYUKLUK) || 0 : 0,
                todayDate: todayEntry ? (todayEntry.tarih || todayEntry.TARIH) : null,
                yesterdayDate: yesterdayEntry ? (yesterdayEntry.tarih || yesterdayEntry.TARIH) : null
            });
        }

        localStorage.setItem('tefasFlowData-YAT', JSON.stringify(results));
        renderFlowTable(results);
    } catch (e) {
        console.error('Unexpected error in fetchFlowData:', e);
        flowBody.innerHTML = '<tr><td colspan="5" class="empty-state">Veri çekilemedi. Lütfen daha sonra tekrar deneyin.</td></tr>';
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

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            if (dateStr.includes('-')) {
                const [y, m, d] = dateStr.split('-');
                return `${d}.${m}.${y.slice(-2)}`;
            }
            return dateStr;
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
                <div style="font-size: 0.65rem; color: var(--text-muted);">${formatDate(item.todayDate)}</div>
            </td>
            <td>
                <div>${item.yesterday.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                <div style="font-size: 0.65rem; color: var(--text-muted);">${formatDate(item.yesterdayDate)}</div>
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
        const currentToday = sessionFlowToday;
        const currentYesterday = sessionFlowYesterday;

        if (currentToday) settingTodayInput.value = currentToday;
        else {
            // Set defaults if nothing in session
            const d = new Date();
            const f = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            settingTodayInput.value = f(d);

            const yesterday = new Date(d);
            if (d.getDay() === 1) yesterday.setDate(d.getDate() - 3);
            else yesterday.setDate(d.getDate() - 1);
            settingYesterdayInput.value = f(yesterday);
        }
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

        if (valToday) sessionFlowToday = valToday;
        if (valYesterday) sessionFlowYesterday = valYesterday;

        flowSettingsModal.style.display = 'none';
        showStatusMessage('Tarih ayarları güncellendi. Verileri güncelle butonuna basarak yeni tarihlerle veri çekebilirsiniz.', 'success');
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
