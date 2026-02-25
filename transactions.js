// ===== TRANSACTIONS MANAGEMENT =====
// transactions.js — handles portfolio CRUD and calculations

const PORTFOLIO_KEY = 'tefasPortfolio';

// --- State ---
let portfolio = loadPortfolio();
let dashboardSort = { col: 'code', dir: 'asc' };
let weightChartInstance = null;
let pnlChartInstance = null;

// --- DOM elements ---
const pfFundSearch = document.getElementById('pf-fund-search');
const pfSuggestions = document.getElementById('pf-fund-suggestions');
const pfLots = document.getElementById('pf-lots');
const pfBuyPrice = document.getElementById('pf-buy-price');
const pfBuyDate = document.getElementById('pf-buy-date');
const pfAddBtn = document.getElementById('pf-add-btn');
const portfolioBody = document.getElementById('portfolio-body');
const dashboardBody = document.getElementById('dashboard-body');
const transactionsFilter = document.getElementById('transactions-filter');
const pfBadge = document.getElementById('portfolio-count-badge');

// Edit Modal refs
const editModal = document.getElementById('edit-modal');
const editFundTitle = document.getElementById('edit-fund-title');
const editEntryId = document.getElementById('edit-entry-id');
const editLots = document.getElementById('edit-lots');
const editPrice = document.getElementById('edit-price');
const editDate = document.getElementById('edit-date');
const editSaveBtn = document.getElementById('edit-save-btn');
const editCloseBtn = document.getElementById('edit-close-btn');

// Default buy date to today
pfBuyDate.value = new Date().toISOString().split('T')[0];

let selectedFund = null; // { code, name }

// --- Tab Switching ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.tab;

        // Update UI
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(target).classList.add('active');

        if (target === 'tab-portfolio') {
            renderPortfolio();
        } else if (target === 'tab-dashboard') {
            renderDashboard();
        }
    });
});

// --- Fund Search Suggestions ---
pfFundSearch.addEventListener('input', () => {
    selectedFund = null;
    const q = pfFundSearch.value.trim().toUpperCase();

    const data = window.fullData || [];
    if (!q || data.length === 0) {
        pfSuggestions.style.display = 'none';
        return;
    }

    const matches = data.filter(row =>
        row[0].includes(q) || (row[1] && row[1].toUpperCase().includes(q))
    ).slice(0, 8);

    if (matches.length === 0) {
        pfSuggestions.style.display = 'none';
        return;
    }

    pfSuggestions.innerHTML = '';
    matches.forEach(row => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `<strong>${row[0]}</strong><span>${row[1]}</span>`;
        item.addEventListener('mousedown', () => {
            selectedFund = { code: row[0], name: row[1] };
            pfFundSearch.value = `${row[0]} — ${row[1]}`;
            // Pre-fill price if available
            if (row[15]) pfBuyPrice.value = row[15].toFixed(4);
            pfSuggestions.style.display = 'none';
        });
        pfSuggestions.appendChild(item);
    });

    pfSuggestions.style.display = 'block';
});

// Hide suggestions when clicking outside
document.addEventListener('click', e => {
    if (!pfFundSearch.contains(e.target)) pfSuggestions.style.display = 'none';
});

// --- Add Fund ---
pfAddBtn.addEventListener('click', () => {
    if (!selectedFund) {
        alert('Lütfen listeden bir fon seçin.');
        return;
    }

    const lots = parseFloat(pfLots.value);
    const buyPrice = parseFloat(pfBuyPrice.value);
    const buyDate = pfBuyDate.value;
    const type = document.querySelector('input[name="pf-type"]:checked').value;

    if (!lots || lots <= 0) { alert('Lütfen geçerli bir lot girin.'); return; }
    if (!buyPrice || buyPrice <= 0) { alert('Lütfen geçerli bir alış fiyatı girin.'); return; }
    if (!buyDate) { alert('Lütfen bir tarih seçin.'); return; }

    const entry = {
        id: Date.now(),
        code: selectedFund.code,
        name: selectedFund.name,
        lots,
        buyPrice,
        buyDate,
        type // AL or SAT
    };

    portfolio.push(entry);
    savePortfolio();
    updateBadge();

    if (document.getElementById('tab-portfolio').classList.contains('active')) renderPortfolio();
    if (document.getElementById('tab-dashboard').classList.contains('active')) renderDashboard();

    // Reset Form
    pfFundSearch.value = '';
    pfLots.value = '';
    pfBuyPrice.value = '';
    selectedFund = null;
});

// --- Remove Fund ---
function removeFund(id) {
    portfolio = portfolio.filter(item => item.id !== id);
    savePortfolio();
    updateBadge();

    if (document.getElementById('tab-portfolio').classList.contains('active')) renderPortfolio();
    if (document.getElementById('tab-dashboard').classList.contains('active')) renderDashboard();
}

// --- Render Portfolio ---
function renderPortfolio() {
    const data = window.fullData || [];
    const filterText = transactionsFilter.value.trim().toUpperCase();

    // Filter displayed portfolio for table
    let filteredPortfolio = portfolio;
    if (filterText) {
        filteredPortfolio = portfolio.filter(p => p.code.toUpperCase().includes(filterText));
    }

    if (filteredPortfolio.length === 0) {
        portfolioBody.innerHTML = `<tr><td colspan="10" class="empty-state">${filterText ? 'Arama sonucu bulunamadı.' : 'İşlem listeniz boş. Yukarıdan fon ekleyebilirsiniz.'}</td></tr>`;
        updateSummary([], data);
        return;
    }

    portfolioBody.innerHTML = '';

    // Sort portfolio by Buy Date descending (Z to A) for display
    const displayList = [...filteredPortfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);

    // --- Pre-calculate Realized Profit & Cumulative Totals ---
    // We need chronological order (A to Z) for cost and aggregate calculation
    const realizedProfits = {};
    const statsById = {}; // { id: { rowNo, prevLots, cumLots, profit } }
    const runningStats = {}; // { code: { lots, cost } }

    const chronological = [...portfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);

    chronological.forEach((e, index) => {
        if (!runningStats[e.code]) runningStats[e.code] = { lots: 0, cost: 0 };
        const stats = runningStats[e.code];

        const prevLots = stats.lots;
        let profit = 0;

        if (e.type === 'AL') {
            stats.lots += e.lots;
            stats.cost += e.lots * e.buyPrice;
            profit = 0;
        } else {
            const avg = stats.lots > 0 ? (stats.cost / stats.lots) : 0;
            profit = (e.buyPrice - avg) * e.lots;

            // Adjust running total cost
            stats.lots -= e.lots;
            stats.cost -= e.lots * avg;
            if (stats.lots <= 0) { stats.lots = 0; stats.cost = 0; }
        }

        statsById[e.id] = {
            rowNo: index + 1,
            prevLots: prevLots,
            cumLots: stats.lots,
            profit: profit
        };
    });

    displayList.forEach((entry) => {
        const buyValue = entry.lots * entry.buyPrice;
        const stats = statsById[entry.id];

        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td class="val-neutral" style="font-size: 0.85rem; color: var(--text-muted);">${stats.rowNo}</td>
        <td>
            <a href="https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${entry.code}" target="_blank" class="fund-link">
                <strong>${entry.code}</strong>
            </a>
        </td>
        <td><span class="type-badge ${entry.type}">${entry.type === 'AL' ? 'ALIŞ' : 'SATIŞ'}</span></td>
        <td>${entry.lots.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
        <td class="val-neutral">${stats.prevLots.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
        <td class="val-neutral"><strong>${stats.cumLots.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></td>
        <td>${fmtNum(entry.buyPrice, 4)}</td>
        <td class="val-neutral">₺${fmtNum(buyValue)}</td>
        <td class="${stats.profit > 0 ? 'val-up' : stats.profit < 0 ? 'val-down' : 'val-neutral'}">
            ${entry.type === 'SAT' ? '₺' + fmtNum(stats.profit) : '0'}
        </td>
        <td>${entry.buyDate}</td>
        <td>
            <div style="display: flex; gap: 0.4rem;">
                <button class="edit-btn" data-id="${entry.id}" title="Düzenle">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="remove-btn" data-id="${entry.id}" title="Kaldır">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
            </div>
        </td>
    `;
        portfolioBody.appendChild(tr);
    });

    // Update Summary Cards for Dashboard
    const processedForSummary = [];
    portfolio.forEach(e => {
        const liveRow = data.find(r => r[0] === e.code);
        const currentPrice = liveRow ? (liveRow[15] || e.buyPrice) : e.buyPrice;
        const buyValue = e.lots * e.buyPrice;
        const currValue = e.lots * currentPrice;
        const pnl = e.type === 'AL' ? (currValue - buyValue) : (buyValue - currValue);
        processedForSummary.push({ entry: e, currValue, buyValue, pnl });
    });
    attachTransactionListeners();
    updateSummary(processedForSummary, data);
}

// --- Render Dashboard ---
function renderDashboard() {
    const data = window.fullData || [];
    if (portfolio.length === 0) {
        dashboardBody.innerHTML = '<tr><td colspan="11" class="empty-state">Henüz bir işleminiz bulunmuyor.</td></tr>';
        updateSummary([], data);
        return;
    }

    // Aggregate by Code using chronological order for accurate average cost and realized profit
    const aggregated = {};
    const chronological = [...portfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);

    chronological.forEach(e => {
        if (!aggregated[e.code]) {
            aggregated[e.code] = {
                code: e.code,
                name: e.name,
                totalLots: 0,
                totalCost: 0,
                realizedProfit: 0
            };
        }
        const fund = aggregated[e.code];
        if (e.type === 'AL') {
            fund.totalLots += e.lots;
            fund.totalCost += (e.lots * e.buyPrice);
        } else {
            const avg = fund.totalLots > 0 ? (fund.totalCost / fund.totalLots) : 0;
            const profit = (e.buyPrice - avg) * e.lots;
            fund.realizedProfit += profit;

            fund.totalLots -= e.lots;
            fund.totalCost -= (e.lots * avg);
            if (fund.totalLots <= 0) {
                fund.totalLots = 0;
                fund.totalCost = 0;
            }
        }
    });

    const fundRows = [];
    let totalPortfolioValue = 0;

    Object.values(aggregated).forEach(fund => {
        if (fund.totalLots <= 0) return; // Skip funds with 0 or negative lots

        const liveRow = data.find(r => r[0] === fund.code);
        const currentPrice = liveRow ? (liveRow[15] || 0) : 0;
        const currentValue = fund.totalLots * currentPrice;

        const avgCost = fund.totalLots !== 0 ? (fund.totalCost / fund.totalLots) : 0;
        const pnl = currentValue - fund.totalCost;
        const pnlPct = fund.totalCost !== 0 ? (pnl / fund.totalCost) : 0;
        const totalProfit = pnl + fund.realizedProfit;

        const g1 = liveRow ? liveRow[2] : null;
        const h1 = liveRow ? liveRow[3] : null;
        const ay3 = liveRow ? liveRow[5] : null;
        const yil1 = liveRow ? liveRow[8] : null;

        totalPortfolioValue += currentValue;
        fundRows.push({
            ...fund,
            currentPrice,
            currentValue,
            avgCost,
            pnl,
            pnlPct,
            totalProfit,
            g1, h1, ay3, yil1
        });
    });

    // Apply Sort
    fundRows.sort((a, b) => {
        let valA = a[dashboardSort.col];
        let valB = b[dashboardSort.col];

        // Handle potential undefined/null
        if (valA === undefined || valA === null) valA = 0;
        if (valB === undefined || valB === null) valB = 0;

        if (typeof valA === 'string') {
            const comp = valA.localeCompare(valB, 'tr');
            return dashboardSort.dir === 'asc' ? comp : -comp;
        } else {
            return dashboardSort.dir === 'asc' ? valA - valB : valB - valA;
        }
    });

    // Update Header UI
    document.querySelectorAll('#dashboard-header-row th.sortable').forEach(th => {
        th.classList.remove('active-sort', 'sort-asc', 'sort-desc');
        if (th.dataset.sort === dashboardSort.col) {
            th.classList.add('active-sort', 'sort-' + dashboardSort.dir);
        }
    });

    dashboardBody.innerHTML = '';
    fundRows.forEach(row => {
        const weight = totalPortfolioValue > 0 ? (row.currentValue / totalPortfolioValue) : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <a href="https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${row.code}" target="_blank" class="fund-link">
                    <strong>${row.code}</strong>
                </a>
            </td>
            <td class="has-tooltip" data-tooltip="${row.name}">
                <div class="wrap-text unvan-text">${row.name}</div>
            </td>
            <td>₺${fmtNum(row.currentPrice, 4)}</td>
            <td>${row.totalLots.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
            <td>₺${fmtNum(row.avgCost, 4)}</td>
            <td>₺${fmtNum(row.currentValue)}</td>
            <td class="${row.pnl >= 0 ? 'val-up' : 'val-down'}">₺${row.pnl >= 0 ? '+' : ''}${fmtNum(row.pnl)}</td>
            <td>${fmtPercent(row.pnlPct)}</td>
            <td class="${row.realizedProfit > 0 ? 'val-up' : row.realizedProfit < 0 ? 'val-down' : 'val-neutral'}">₺${fmtNum(row.realizedProfit)}</td>
            <td class="${row.totalProfit > 0 ? 'val-up' : row.totalProfit < 0 ? 'val-down' : 'val-neutral'}"><strong>₺${fmtNum(row.totalProfit)}</strong></td>
            <td class="advanced-hidden">${fmtPercent(row.g1)}</td>
            <td class="advanced-hidden">${fmtPercent(row.h1)}</td>
            <td class="advanced-hidden">${fmtPercent(row.ay3)}</td>
            <td class="advanced-hidden">${fmtPercent(row.yil1)}</td>
            <td>%${fmtNum(weight * 100, 2)}</td>
        `;
        dashboardBody.appendChild(tr);
    });

    // Update Summary Cards (Total based on ALL rows)
    const processedForSummary = [];
    portfolio.forEach(e => {
        const liveRow = data.find(r => r[0] === e.code);
        const currentPrice = liveRow ? (liveRow[15] || e.buyPrice) : e.buyPrice;
        const buyValue = e.lots * e.buyPrice;
        const currValue = e.lots * currentPrice;
        const pnl = e.type === 'AL' ? (currValue - buyValue) : (buyValue - currValue);
        processedForSummary.push({ entry: e, currValue, buyValue, pnl });
    });
    updateSummary(processedForSummary, data);
    renderCharts(fundRows);
}

function renderCharts(fundRows) {
    if (typeof Chart === 'undefined') return;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#2a2e45' : '#cbd5e1';
    const gridColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

    // Chart 1: Weight Chart (Sorted by Current Value)
    const totalVal = fundRows.reduce((acc, f) => acc + (f.currentValue || 0), 0);
    const weightData = [...fundRows].sort((a, b) => b.currentValue - a.currentValue);
    const weightLabels = weightData.map(f => f.code);
    const weightValues = weightData.map(f => totalVal > 0 ? (f.currentValue / totalVal * 100) : 0);

    if (weightChartInstance) weightChartInstance.destroy();

    const ctxWeight = document.getElementById('weight-chart');
    if (ctxWeight) {
        weightChartInstance = new Chart(ctxWeight, {
            type: 'bar',
            data: {
                labels: weightLabels,
                datasets: [{
                    label: 'Portföy Ağırlığı (%)',
                    data: weightValues,
                    backgroundColor: 'rgba(99, 102, 241, 0.7)',
                    borderColor: 'rgb(99, 102, 241)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'x',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Ağırlık: %${context.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    },
                    y: {
                        ticks: {
                            color: textColor,
                            callback: (value) => `%${value}`
                        },
                        grid: { color: gridColor },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Chart 2: PnL Chart (Sorted by Total Profit)
    const pnlData = [...fundRows].sort((a, b) => b.totalProfit - a.totalProfit);
    const pnlLabels = pnlData.map(f => f.code);
    const pnlValues = pnlData.map(f => f.totalProfit);

    if (pnlChartInstance) pnlChartInstance.destroy();

    const ctxPnl = document.getElementById('pnl-chart');
    if (ctxPnl) {
        pnlChartInstance = new Chart(ctxPnl, {
            type: 'bar',
            data: {
                labels: pnlLabels,
                datasets: [{
                    label: 'Toplam Kâr (₺)',
                    data: pnlValues,
                    backgroundColor: pnlValues.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                    borderColor: pnlValues.map(v => v >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'x',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    }
}

function attachTransactionListeners() {
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeFund(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id)));
    });
}

function updateSummary(rows, data) {
    document.getElementById('pf-total-funds').textContent = portfolio.length;

    // --- Calculate Grand Total Realized Profit ---
    let totalRealized = 0;
    const runningStats = {}; // { code: { lots, cost } }
    const chronological = [...portfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);

    chronological.forEach(e => {
        if (!runningStats[e.code]) runningStats[e.code] = { lots: 0, cost: 0 };
        const stats = runningStats[e.code];
        if (e.type === 'AL') {
            stats.lots += e.lots;
            stats.cost += e.lots * e.buyPrice;
        } else {
            const avg = stats.lots > 0 ? (stats.cost / stats.lots) : 0;
            totalRealized += (e.buyPrice - avg) * e.lots;
            stats.lots -= e.lots;
            stats.cost -= e.lots * avg;
            if (stats.lots <= 0) { stats.lots = 0; stats.cost = 0; }
        }
    });

    const realizedEl = document.getElementById('pf-realized-profit');
    realizedEl.textContent = `₺${fmtNum(totalRealized)}`;
    realizedEl.className = `summary-value ${totalRealized > 0 ? 'val-up' : totalRealized < 0 ? 'val-down' : 'val-neutral'}`;

    // Aggregate by code to find holdings with lots > 1 for "Toplam Yatırım"
    const aggLots = {};
    portfolio.forEach(e => {
        if (!aggLots[e.code]) aggLots[e.code] = 0;
        aggLots[e.code] += (e.lots * (e.type === 'AL' ? 1 : -1));
    });

    if (portfolio.length === 0) {
        document.getElementById('pf-total-investment').textContent = '₺0.00';
        document.getElementById('pf-total-cost').textContent = '₺0.00';
        document.getElementById('pf-daily-change').textContent = '-';
        document.getElementById('pf-total-pnl').textContent = '-';
        return;
    }

    let totalRequestedInvestment = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 1) {
            const liveRow = data.find(r => r[0] === code);
            const currentPrice = liveRow ? (liveRow[15] || 0) : 0;
            totalRequestedInvestment += (netLots * currentPrice);
        }
    });

    // Maliyet calculation (Net cash out)
    const totalCost = rows.reduce((acc, r) => {
        const mult = r.entry.type === 'AL' ? 1 : -1;
        return acc + (r.buyValue * mult);
    }, 0);

    document.getElementById('pf-total-investment').textContent = `₺${fmtNum(totalRequestedInvestment)}`;
    document.getElementById('pf-total-cost').textContent = `₺${fmtNum(totalCost)}`;

    // Total Daily Change (₺)
    let dailyChangeTl = 0;
    rows.forEach(r => {
        const liveRow = data.find(live => live[0] === r.entry.code);
        if (liveRow && liveRow[2] !== null) {
            dailyChangeTl += r.currValue * liveRow[2];
        }
    });

    const dailyEl = document.getElementById('pf-daily-change');
    dailyEl.textContent = `${dailyChangeTl >= 0 ? '+' : ''}₺${fmtNum(dailyChangeTl)}`;
    dailyEl.className = `summary-value ${dailyChangeTl >= 0 ? 'val-up' : 'val-down'}`;

    // Total Profit/Loss
    const totalPnl = rows.reduce((acc, r) => acc + r.pnl, 0);
    const pnlEl = document.getElementById('pf-total-pnl');
    pnlEl.textContent = `${totalPnl >= 0 ? '+' : ''}₺${fmtNum(totalPnl)}`;
    pnlEl.className = `summary-value ${totalPnl >= 0 ? 'val-up' : 'val-down'}`;
}

function updateBadge() {
    pfBadge.textContent = portfolio.length;
    pfBadge.style.display = portfolio.length > 0 ? 'inline-flex' : 'none';
}

// --- Helpers ---
function fmtNum(val, dec = 2) {
    if (val === null || val === undefined) return '-';
    return val.toLocaleString('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtPercent(val) {
    if (val === null || val === undefined) return '<span class="val-zero">-</span>';
    const num = val * 100;
    const cssClass = num > 0.005 ? 'val-up' : num < -0.005 ? 'val-down' : 'val-zero';
    return `<span class="${cssClass}">${num > 0 ? '+' : ''}${num.toFixed(2)}%</span>`;
}

// --- Persistence ---
function loadPortfolio() {
    try {
        return JSON.parse(localStorage.getItem(PORTFOLIO_KEY)) || [];
    } catch { return []; }
}

function savePortfolio() {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
}

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    updateBadge();
    initDashboardSorting();
    renderDashboard(); // Default tab is now dashboard
});

function initDashboardSorting() {
    const headers = document.querySelectorAll('#dashboard-header-row th.sortable');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (dashboardSort.col === col) {
                dashboardSort.dir = dashboardSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                dashboardSort.col = col;
                dashboardSort.dir = 'asc';
            }
            renderDashboard();
        });
    });
}

// Dashboard Column Toggle
const dashboardToggleBtn = document.getElementById('dashboard-toggle-btn');
const dashboardTableContainer = document.getElementById('dashboard-table-container');

if (dashboardToggleBtn) {
    dashboardToggleBtn.addEventListener('click', () => {
        dashboardTableContainer.classList.toggle('advanced-hidden');
        dashboardToggleBtn.textContent = dashboardTableContainer.classList.contains('advanced-hidden')
            ? 'Detayları Göster'
            : 'Detayları Gizle';
    });
}

// Transaction filtering
if (transactionsFilter) {
    transactionsFilter.addEventListener('input', () => {
        renderPortfolio();
    });
}

// --- Edit Modal Logic ---
function openEditModal(id) {
    const entry = portfolio.find(e => e.id === id);
    if (!entry) return;

    editEntryId.value = entry.id;
    editFundTitle.textContent = `${entry.code} — ${entry.name}`;
    editLots.value = entry.lots;
    editPrice.value = entry.buyPrice;
    editDate.value = entry.buyDate;

    // Set type
    if (entry.type === 'AL') document.getElementById('edit-type-buy').checked = true;
    else document.getElementById('edit-type-sell').checked = true;

    editModal.style.display = 'flex';
}

editCloseBtn.addEventListener('click', () => {
    editModal.style.display = 'none';
});

editSaveBtn.addEventListener('click', () => {
    const id = parseInt(editEntryId.value);
    const index = portfolio.findIndex(e => e.id === id);
    if (index === -1) return;

    const lots = parseFloat(editLots.value);
    const price = parseFloat(editPrice.value);
    const date = editDate.value;
    const type = document.querySelector('input[name="edit-pf-type"]:checked').value;

    if (!lots || lots <= 0) { alert('Geçerli bir lot girin.'); return; }
    if (!price || price <= 0) { alert('Geçerli bir fiyat girin.'); return; }
    if (!date) { alert('Tarih seçin.'); return; }

    portfolio[index].lots = lots;
    portfolio[index].buyPrice = price;
    portfolio[index].buyDate = date;
    portfolio[index].type = type;

    savePortfolio();
    if (document.getElementById('tab-portfolio').classList.contains('active')) renderPortfolio();
    if (document.getElementById('tab-dashboard').classList.contains('active')) renderDashboard();
    editModal.style.display = 'none';
});

// Watch for data updates from main.js
document.addEventListener('tefas-data-updated', () => {
    if (document.getElementById('tab-dashboard').classList.contains('active')) {
        renderDashboard();
    } else if (document.getElementById('tab-portfolio').classList.contains('active')) {
        renderPortfolio();
    }
    updateBadge();
});
// --- Export Listeners ---
document.getElementById('export-dashboard-csv')?.addEventListener('click', () => {
    const data = window.fullData || [];
    const aggregated = getAggregatedData(data);
    const headers = ['KOD', 'UNVAN', 'FİYAT', 'LOT', 'ORT. MALİYET', 'GÜNCEL DEĞER', 'K/Z (₺)', 'K/Z %', 'SATIŞ KARI', 'TOPLAM KAR', '1G %', '1H %', '3AY %', '1YIL %', 'AĞIRLIK (%)'];

    let totalVal = aggregated.reduce((acc, f) => acc + f.currentValue, 0);

    const exportData = aggregated.map(f => [
        f.code, f.name, f.currentPrice.toFixed(4), f.totalLots, f.avgCost.toFixed(4),
        f.currentValue.toFixed(2), f.pnl.toFixed(2), (f.pnlPct * 100).toFixed(2) + '%',
        f.realizedProfit.toFixed(2), f.totalProfit.toFixed(2),
        f.g1 !== null ? (f.g1 * 100).toFixed(2) + '%' : '-',
        f.h1 !== null ? (f.h1 * 100).toFixed(2) + '%' : '-',
        f.ay3 !== null ? (f.ay3 * 100).toFixed(2) + '%' : '-',
        f.yil1 !== null ? (f.yil1 * 100).toFixed(2) + '%' : '-',
        (totalVal > 0 ? (f.currentValue / totalVal * 100).toFixed(2) : '0') + '%'
    ]);
    window.downloadCSV(exportData, headers, 'TEFAS_Dashboard_' + new Date().toISOString().split('T')[0]);
});

document.getElementById('export-dashboard-xls')?.addEventListener('click', () => {
    const data = window.fullData || [];
    const aggregated = getAggregatedData(data);
    const headers = ['KOD', 'UNVAN', 'FİYAT', 'LOT', 'ORT. MALİYET', 'GÜNCEL DEĞER', 'K/Z (₺)', 'K/Z %', 'SATIŞ KARI', 'TOPLAM KAR', '1G %', '1H %', '3AY %', '1YIL %', 'AĞIRLIK (%)'];

    let totalVal = aggregated.reduce((acc, f) => acc + f.currentValue, 0);

    const exportData = aggregated.map(f => [
        f.code, f.name, f.currentPrice.toFixed(4), f.totalLots, f.avgCost.toFixed(4),
        f.currentValue.toFixed(2), f.pnl.toFixed(2), (f.pnlPct * 100).toFixed(2) + '%',
        f.realizedProfit.toFixed(2), f.totalProfit.toFixed(2),
        f.g1 !== null ? (f.g1 * 100).toFixed(2) + '%' : '-',
        f.h1 !== null ? (f.h1 * 100).toFixed(2) + '%' : '-',
        f.ay3 !== null ? (f.ay3 * 100).toFixed(2) + '%' : '-',
        f.yil1 !== null ? (f.yil1 * 100).toFixed(2) + '%' : '-',
        (totalVal > 0 ? (f.currentValue / totalVal * 100).toFixed(2) : '0') + '%'
    ]);
    window.downloadXLS(exportData, headers, 'TEFAS_Dashboard_' + new Date().toISOString().split('T')[0]);
});

document.getElementById('export-transactions-csv')?.addEventListener('click', () => {
    const headers = ['NO', 'KOD', 'TIP', 'LOT', 'ÖNCEKİ LOT', 'KÜM LOT', 'BİRİM FİYAT', 'MALİYET', 'SATIŞ KARI', 'TARİH'];
    const chronological = [...portfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);
    const runningStats = {};
    const exportData = chronological.map((e, index) => {
        if (!runningStats[e.code]) runningStats[e.code] = { lots: 0, cost: 0 };
        const stats = runningStats[e.code];
        const prevLots = stats.lots;
        let profit = 0;
        if (e.type === 'AL') {
            stats.lots += e.lots;
            stats.cost += e.lots * e.buyPrice;
        } else {
            const avg = stats.lots > 0 ? (stats.cost / stats.lots) : 0;
            profit = (e.buyPrice - avg) * e.lots;
            stats.lots -= e.lots;
            stats.cost -= e.lots * avg;
        }
        return [
            index + 1, e.code, e.type, e.lots, prevLots, stats.lots,
            e.buyPrice.toFixed(4), (e.lots * e.buyPrice).toFixed(2),
            e.type === 'SAT' ? profit.toFixed(2) : '0', e.buyDate
        ];
    });
    window.downloadCSV(exportData, headers, 'TEFAS_Islemler_' + new Date().toISOString().split('T')[0]);
});

document.getElementById('export-transactions-xls')?.addEventListener('click', () => {
    const headers = ['NO', 'KOD', 'TIP', 'LOT', 'ÖNCEKİ LOT', 'KÜM LOT', 'BİRİM FİYAT', 'MALİYET', 'SATIŞ KARI', 'TARİH'];
    const chronological = [...portfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);
    const runningStats = {};
    const exportData = chronological.map((e, index) => {
        if (!runningStats[e.code]) runningStats[e.code] = { lots: 0, cost: 0 };
        const stats = runningStats[e.code];
        const prevLots = stats.lots;
        let profit = 0;
        if (e.type === 'AL') {
            stats.lots += e.lots;
            stats.cost += e.lots * e.buyPrice;
        } else {
            const avg = stats.lots > 0 ? (stats.cost / stats.lots) : 0;
            profit = (e.buyPrice - avg) * e.lots;
            stats.lots -= e.lots;
            stats.cost -= e.lots * avg;
        }
        return [
            index + 1, e.code, e.type, e.lots, prevLots, stats.lots,
            e.buyPrice.toFixed(4), (e.lots * e.buyPrice).toFixed(2),
            e.type === 'SAT' ? profit.toFixed(2) : '0', e.buyDate
        ];
    });
    window.downloadXLS(exportData, headers, 'TEFAS_Islemler_' + new Date().toISOString().split('T')[0]);
});

// Helper for aggregation (similar logic as in renderDashboard but returns raw data)
function getAggregatedData(data) {
    const aggregated = {};
    const chronological = [...portfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);
    chronological.forEach(e => {
        if (!aggregated[e.code]) {
            aggregated[e.code] = { code: e.code, name: e.name, totalLots: 0, totalCost: 0, realizedProfit: 0 };
        }
        const fund = aggregated[e.code];
        if (e.type === 'AL') {
            fund.totalLots += e.lots;
            fund.totalCost += (e.lots * e.buyPrice);
        } else {
            const avg = fund.totalLots > 0 ? (fund.totalCost / fund.totalLots) : 0;
            fund.realizedProfit += (e.buyPrice - avg) * e.lots;
            fund.totalLots -= e.lots;
            fund.totalCost -= (e.lots * avg);
        }
    });
    return Object.values(aggregated).filter(f => f.totalLots > 0).map(fund => {
        const liveRow = data.find(r => r[0] === fund.code);
        const currentPrice = liveRow ? (liveRow[15] || 0) : 0;
        const currentValue = fund.totalLots * currentPrice;
        const avgCost = fund.totalLots > 0 ? (fund.totalCost / fund.totalLots) : 0;
        const pnl = currentValue - fund.totalCost;
        const pnlPct = fund.totalCost !== 0 ? (pnl / fund.totalCost) : 0;
        return {
            ...fund, currentPrice, currentValue, avgCost, pnl, pnlPct,
            totalProfit: pnl + fund.realizedProfit,
            g1: liveRow ? liveRow[2] : null,
            h1: liveRow ? liveRow[3] : null,
            ay3: liveRow ? liveRow[5] : null,
            yil1: liveRow ? liveRow[8] : null
        };
    });
}
