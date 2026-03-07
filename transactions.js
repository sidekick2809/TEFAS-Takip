// ===== TRANSACTIONS MANAGEMENT =====
// transactions.js — handles portfolio CRUD and calculations

const PORTFOLIO_KEY = 'tefasPortfolio';

// --- State ---
let portfolio = [];
let dashboardSort = { col: 'currentValue', dir: 'desc' };
let weightChartInstance = null;
let pnlChartInstance = null;
let dailyPerfChartInstance = null;
let weeklyPerfChartInstance = null;

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
        const tabName = btn.textContent.trim();

        // Update breadcrumb and title
        const breadcrumbEl = document.getElementById('current-tab-name');
        const mainTitleEl = document.getElementById('main-title');
        if (breadcrumbEl) breadcrumbEl.textContent = tabName;
        if (mainTitleEl) {
            if (target === 'tab-dashboard') mainTitleEl.textContent = 'Dashboard';
            else if (target === 'tab-veriler') mainTitleEl.textContent = 'FON Verileri';
            else if (target === 'tab-veriler-bes') mainTitleEl.textContent = 'BES Fonları';
            else if (target === 'tab-portfolio') mainTitleEl.textContent = 'FON İşlemleri';
            else if (target === 'tab-bes-portfolio') mainTitleEl.textContent = 'BES İşlemleri';
            else if (target === 'tab-flow') mainTitleEl.textContent = 'Para Akışı Analizi';
            else if (target === 'tab-kap') mainTitleEl.textContent = 'KAP Bildirimleri';
            else if (target === 'tab-fvt') mainTitleEl.textContent = 'FVT Data';
        }

        // Update UI
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');

        // Also activate the corresponding mobile nav button if exists
        const correspondingMobileBtn = document.querySelector(`.mobile-nav-btn[data-tab="${target}"]`);
        if (correspondingMobileBtn) correspondingMobileBtn.classList.add('active');

        document.getElementById(target).classList.add('active');

        if (target === 'tab-portfolio') {
            renderPortfolio();
        } else if (target === 'tab-bes-portfolio') {
            renderBesPortfolio();
        } else if (target === 'tab-dashboard') {
            renderDashboard();
        } else if (target === 'tab-flow') {
            if (window.renderFlow) window.renderFlow();
        }

        // Close mobile sidebar if open
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && window.innerWidth <= 1200) sidebar.classList.remove('open');
    });
});

// --- Mobile Bottom Navigation ---
document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        const tabName = btn.dataset.tooltip || btn.textContent.trim();

        // Update breadcrumb and title
        const breadcrumbEl = document.getElementById('current-tab-name');
        const mainTitleEl = document.getElementById('main-title');
        if (breadcrumbEl) breadcrumbEl.textContent = tabName;
        if (mainTitleEl) {
            if (target === 'tab-dashboard') mainTitleEl.textContent = 'Dashboard';
            else if (target === 'tab-veriler') mainTitleEl.textContent = 'FON Verileri';
            else if (target === 'tab-veriler-bes') mainTitleEl.textContent = 'BES Fonları';
            else if (target === 'tab-portfolio') mainTitleEl.textContent = 'FON İşlemleri';
            else if (target === 'tab-bes-portfolio') mainTitleEl.textContent = 'BES İşlemleri';
            else if (target === 'tab-flow') mainTitleEl.textContent = 'Para Akışı Analizi';
            else if (target === 'tab-kap') mainTitleEl.textContent = 'KAP Bildirimleri';
            else if (target === 'tab-fvt') mainTitleEl.textContent = 'FVT Data';
        }

        // Update UI - both sidebar and mobile nav
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');

        // Also activate the corresponding sidebar button if exists
        const correspondingSidebarBtn = document.querySelector(`.tab-btn[data-tab="${target}"]`);
        if (correspondingSidebarBtn) correspondingSidebarBtn.classList.add('active');

        document.getElementById(target).classList.add('active');

        if (target === 'tab-portfolio') {
            renderPortfolio();
        } else if (target === 'tab-bes-portfolio') {
            renderBesPortfolio();
        } else if (target === 'tab-dashboard') {
            renderDashboard();
        } else if (target === 'tab-flow') {
            if (window.renderFlow) window.renderFlow();
        }

        // Close mobile sidebar if open
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && window.innerWidth <= 1200) sidebar.classList.remove('open');
    });
});

// --- Function to sync both navs when tab changes from sidebar ---
function syncNavigation(targetTab) {
    // Remove active from all
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));

    // Add active to matching buttons
    const sidebarBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
    const mobileBtn = document.querySelector(`.mobile-nav-btn[data-tab="${targetTab}"]`);

    if (sidebarBtn) sidebarBtn.classList.add('active');
    if (mobileBtn) mobileBtn.classList.add('active');
}

// --- Sidebar Toggle ---
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.querySelector('.sidebar');

if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });

    // Load saved state
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }
}

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
        portfolioBody.innerHTML = `<tr><td colspan="16" class="empty-state">${filterText ? 'Arama sonucu bulunamadı.' : 'İşlem listeniz boş. Yukarıdan fon ekleyebilirsiniz.'}</td></tr>`;
        updateSummary([], data);
        return;
    }

    portfolioBody.innerHTML = '';

    // Sort portfolio by Buy Date descending (Z to A) for display
    const displayList = [...filteredPortfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);

    // --- Pre-calculate Realized Profit & Cumulative Totals ---
    // We need chronological order (A to Z) for cost and aggregate calculation
    const realizedProfits = {};
    const statsById = {}; // { id: { rowNo, prevLots, cumLots, profit, islemPara, oncekiMaliyet, satisDegeri, ortFiyat, cumCost, karYuzdesi } }
    const runningStats = {}; // { code: { lots, cost } }

    const chronological = [...portfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);

    chronological.forEach((e, index) => {
        if (!runningStats[e.code]) runningStats[e.code] = { lots: 0, cost: 0 };
        const stats = runningStats[e.code];

        const prevLots = stats.lots;
        const prevCost = stats.cost;
        const islemPara = e.lots * e.buyPrice;
        let profit = 0;
        let satisDegeri = '-';
        let ortFiyat = '-';
        let cumCost = 0;
        let karYuzdesi = '-';

        if (e.type === 'AL') {
            // Buy: add to running totals
            stats.lots += e.lots;
            stats.cost += islemPara;
            cumCost = stats.cost;
            profit = 0;
        } else {
            // Sell: calculate based on previous average
            ortFiyat = prevLots > 0 ? (prevCost / prevLots) : 0;
            satisDegeri = e.lots * ortFiyat;
            profit = islemPara - satisDegeri;

            // Update running totals
            stats.lots -= e.lots;
            stats.cost -= satisDegeri;
            if (stats.lots <= 0) { stats.lots = 0; stats.cost = 0; }
            cumCost = stats.cost;

            // Calculate profit percentage
            if (satisDegeri > 0) {
                karYuzdesi = (profit / satisDegeri);
            }
        }

        statsById[e.id] = {
            rowNo: index + 1,
            prevLots: prevLots,
            cumLots: stats.lots,
            profit: profit,
            islemPara: islemPara,
            oncekiMaliyet: prevCost,
            satisDegeri: satisDegeri,
            ortFiyat: ortFiyat,
            cumCost: cumCost,
            karYuzdesi: karYuzdesi
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
        <td>${fmtNum(entry.buyPrice, 4)}</td>
        <td class="val-neutral">₺${fmtNum(stats.islemPara)}</td>
        <td class="val-neutral">₺${fmtNum(stats.oncekiMaliyet)}</td>
        <td class="val-neutral">${stats.prevLots.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
        <td class="val-neutral"><strong>${stats.cumLots.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></td>
        <td>${typeof stats.ortFiyat === 'number' ? fmtNum(stats.ortFiyat, 4) : stats.ortFiyat}</td>
        <td>${typeof stats.satisDegeri === 'number' ? '₺' + fmtNum(stats.satisDegeri) : stats.satisDegeri}</td>
        <td class="val-neutral">₺${fmtNum(stats.cumCost)}</td>
        <td class="${stats.profit > 0 ? 'val-up' : stats.profit < 0 ? 'val-down' : 'val-neutral'}">
            ${entry.type === 'SAT' ? '₺' + fmtNum(stats.profit) : '0'}
        </td>
        <td class="${typeof stats.karYuzdesi === 'number' ? (stats.karYuzdesi > 0 ? 'val-up' : stats.karYuzdesi < 0 ? 'val-down' : 'val-neutral') : 'val-neutral'}">
            ${typeof stats.karYuzdesi === 'number' ? '%' + fmtNum(stats.karYuzdesi * 100, 2) : stats.karYuzdesi}
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

    // Update FON Summary and Charts
    updateFonSummary(processedForSummary, data);

    // Aggregate for FON charts
    const aggregated = {};
    const chron = [...portfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);
    chron.forEach(e => {
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

    const fonFundRows = [];
    Object.values(aggregated).forEach(fund => {
        if (fund.totalLots <= 0) return;

        const liveRow = data.find(r => r[0] === fund.code);
        const currentPrice = liveRow ? (liveRow[15] || 0) : 0;
        const currentValue = fund.totalLots * currentPrice;

        const avgCost = fund.totalLots !== 0 ? (fund.totalCost / fund.totalLots) : 0;
        const pnl = currentValue - fund.totalCost;

        fonFundRows.push({
            ...fund,
            currentPrice,
            currentValue,
            avgCost,
            pnl
        });
    });

    renderFonCharts(fonFundRows);
}

// --- Render Dashboard ---
function renderDashboard() {
    const data = window.fullData || [];
    if (portfolio.length === 0) {
        dashboardBody.innerHTML = '<tr><td colspan="13" class="empty-state">Henüz bir işleminiz bulunmuyor.</td></tr>';
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
            <td class="has-tooltip" data-tooltip="${row.name}">
                <a href="https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${row.code}" target="_blank" class="fund-link">
                    <strong>${row.code}</strong>
                </a>
                <div class="wrap-text unvan-text fund-name-sub">${row.name}</div>
            </td>
            <td class="detail-col">₺${fmtNum(row.currentPrice, 4)}</td>
            <td>
                <span class="lot-value-main">${row.totalLots.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} lot</span>
                <div class="lot-value-sub">₺${fmtNum(row.currentValue)}</div>
            </td>
            <td class="detail-col">₺${fmtNum(row.avgCost, 4)}</td>
            <td class="detail-col ${row.pnl >= 0 ? 'val-up' : 'val-down'}">
                ₺${row.pnl >= 0 ? '+' : ''}${fmtNum(row.pnl)}
                <div class="lot-value-sub ${row.realizedProfit > 0 ? 'val-up' : row.realizedProfit < 0 ? 'val-down' : 'val-neutral'}">₺${fmtNum(row.realizedProfit)}</div>
            </td>
            <td class="detail-col ${row.totalProfit > 0 ? 'val-up' : row.totalProfit < 0 ? 'val-down' : 'val-neutral'}"><strong>₺${fmtNum(row.totalProfit)}</strong></td>
            <td>${fmtPercent(row.pnlPct)}</td>
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
    const textColor = isLight ? '#1B2559' : '#A3AED0';
    const gridColor = isLight ? '#E9EDF7' : '#1B254B';
    const primaryColor = isLight ? '#4318FF' : '#7551FF';

    // Color palette for charts
    const chartColors = [
        '#7551FF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'
    ];


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
                    backgroundColor: chartColors.slice(0, weightLabels.length),
                    borderColor: chartColors.slice(0, weightLabels.length),
                    borderWidth: 0,
                    borderRadius: 10

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

    // Chart 2: PnL Chart (Sorted by Profit Percentage)
    const pnlData = [...fundRows].sort((a, b) => b.pnlPct - a.pnlPct);
    const pnlLabels = pnlData.map(f => f.code);
    const pnlValues = pnlData.map(f => f.pnlPct * 100);

    if (pnlChartInstance) pnlChartInstance.destroy();

    const ctxPnl = document.getElementById('pnl-chart');
    if (ctxPnl) {
        pnlChartInstance = new Chart(ctxPnl, {
            type: 'bar',
            data: {
                labels: pnlLabels,
                datasets: [{
                    label: 'Kâr / Zarar (%)',
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
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `K/Z: %${context.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor, font: { weight: '500' } },
                        grid: { display: false }
                    },
                    y: {
                        ticks: {
                            color: textColor,
                            font: { weight: '500' },
                            callback: (value) => `%${value}`
                        },
                        grid: { color: gridColor, drawBorder: false },
                        beginAtZero: true
                    }
                }

            }
        });
    }

    // Chart 3: Daily Performance Chart (1G %)
    if (dailyPerfChartInstance) dailyPerfChartInstance.destroy();

    const ctxDailyPerf = document.getElementById('daily-perf-chart');
    if (ctxDailyPerf) {
        const dailyPerfData = [...fundRows].filter(f => f.g1 !== null).sort((a, b) => b.g1 - a.g1);
        const dailyPerfLabels = dailyPerfData.map(f => f.code);
        const dailyPerfValues = dailyPerfData.map(f => f.g1 * 100);
        const dailyPerfColors = dailyPerfValues.map(v => v >= 0 ? '#10B981' : '#EF4444');

        dailyPerfChartInstance = new Chart(ctxDailyPerf, {
            type: 'bar',
            data: {
                labels: dailyPerfLabels,
                datasets: [{
                    label: '1G %',
                    data: dailyPerfValues,
                    backgroundColor: dailyPerfColors,
                    borderColor: dailyPerfColors,
                    borderWidth: 0,
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
                            label: (context) => `%${context.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor, font: { weight: '500' } },
                        grid: { display: false }
                    },
                    y: {
                        ticks: {
                            color: textColor,
                            font: { weight: '500' },
                            callback: (value) => `%${value}`
                        },
                        grid: { color: gridColor, drawBorder: false },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Chart 4: Weekly Performance Chart (1H %)
    if (weeklyPerfChartInstance) weeklyPerfChartInstance.destroy();

    const ctxWeeklyPerf = document.getElementById('weekly-perf-chart');
    if (ctxWeeklyPerf) {
        const weeklyPerfData = [...fundRows].filter(f => f.h1 !== null).sort((a, b) => b.h1 - a.h1);
        const weeklyPerfLabels = weeklyPerfData.map(f => f.code);
        const weeklyPerfValues = weeklyPerfData.map(f => f.h1 * 100);
        const weeklyPerfColors = weeklyPerfValues.map(v => v >= 0 ? '#10B981' : '#EF4444');

        weeklyPerfChartInstance = new Chart(ctxWeeklyPerf, {
            type: 'bar',
            data: {
                labels: weeklyPerfLabels,
                datasets: [{
                    label: '1H %',
                    data: weeklyPerfValues,
                    backgroundColor: weeklyPerfColors,
                    borderColor: weeklyPerfColors,
                    borderWidth: 0,
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
                            label: (context) => `%${context.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor, font: { weight: '500' } },
                        grid: { display: false }
                    },
                    y: {
                        ticks: {
                            color: textColor,
                            font: { weight: '500' },
                            callback: (value) => `%${value}`
                        },
                        grid: { color: gridColor, drawBorder: false },
                        beginAtZero: true
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
    // Aggregate by code to find holdings (net lots)
    const aggLots = {};
    portfolio.forEach(e => {
        if (!aggLots[e.code]) aggLots[e.code] = 0;
        aggLots[e.code] += (e.lots * (e.type === 'AL' ? 1 : -1));
    });

    // Count funds with positive balance
    const heldFundsCount = Object.values(aggLots).filter(lots => lots > 0.0001).length;
    document.getElementById('pf-total-funds').textContent = heldFundsCount;

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
    realizedEl.textContent = `₺${fmtNum(totalRealized, 0)}`;
    realizedEl.className = `summary-value ${totalRealized > 0 ? 'val-up' : totalRealized < 0 ? 'val-down' : 'val-neutral'}`;

    if (portfolio.length === 0) {
        document.getElementById('pf-total-investment').textContent = '₺0';
        document.getElementById('pf-total-cost').textContent = '₺0';
        document.getElementById('pf-daily-change').textContent = '-';
        document.getElementById('pf-weekly-change').textContent = '-';
        document.getElementById('pf-total-pnl').textContent = '-';
        return;
    }

    let totalRequestedInvestment = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
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

    document.getElementById('pf-total-investment').textContent = `₺${fmtNum(totalRequestedInvestment, 0)}`;
    document.getElementById('pf-total-cost').textContent = `₺${fmtNum(totalCost, 0)}`;

    // Total Daily Change (₺) - using formula: GD - (LOT * price1)
    let dailyChangeTl = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
            const liveRow = data.find(r => r[0] === code);
            if (liveRow) {
                const currentPrice = liveRow[15] || 0; // FIYAT (current)
                const price1 = liveRow[16] || 0; // FIYAT1 (1 day ago)
                const GD = netLots * currentPrice; // Güncel Değer
                if (price1 > 0 && currentPrice > 0) {
                    dailyChangeTl += GD - (netLots * price1);
                }
            }
        }
    });

    const dailyEl = document.getElementById('pf-daily-change');
    dailyEl.textContent = `${dailyChangeTl >= 0 ? '+' : ''}₺${fmtNum(dailyChangeTl, 0)}`;
    dailyEl.className = `summary-value ${dailyChangeTl >= 0 ? 'val-up' : 'val-down'}`;

    // Total Weekly Change (₺) - using formula: GD - (LOT * price7)
    let weeklyChangeTl = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
            const liveRow = data.find(r => r[0] === code);
            if (liveRow) {
                const currentPrice = liveRow[15] || 0; // FIYAT (current)
                const price7 = liveRow[17] || 0; // FIYAT7 (7 days ago)
                const GD = netLots * currentPrice; // Güncel Değer
                if (price7 > 0 && currentPrice > 0) {
                    weeklyChangeTl += GD - (netLots * price7);
                }
            }
        }
    });

    const weeklyEl = document.getElementById('pf-weekly-change');
    weeklyEl.textContent = `${weeklyChangeTl >= 0 ? '+' : ''}₺${fmtNum(weeklyChangeTl, 0)}`;
    weeklyEl.className = `summary-value ${weeklyChangeTl >= 0 ? 'val-up' : 'val-down'}`;

    // Güncel Kar (Unrealized PnL of active holdings)
    let guncelKar = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
            // Find average cost for this code
            const chron = portfolio.filter(p => p.code === code).sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);
            let runningLots = 0;
            let runningCost = 0;
            chron.forEach(e => {
                if (e.type === 'AL') {
                    runningLots += e.lots;
                    runningCost += e.lots * e.buyPrice;
                } else {
                    const avg = runningLots > 0 ? (runningCost / runningLots) : 0;
                    runningLots -= e.lots;
                    runningCost -= e.lots * avg;
                    if (runningLots < 0) { runningLots = 0; runningCost = 0; }
                }
            });
            const liveRow = data.find(r => r[0] === code);
            const currentPrice = liveRow ? (liveRow[15] || 0) : 0;
            const currentValue = runningLots * currentPrice;
            guncelKar += (currentValue - runningCost);
        }
    });

    const pnlEl = document.getElementById('pf-total-pnl');
    pnlEl.textContent = `${guncelKar >= 0 ? '+' : ''}₺${fmtNum(guncelKar, 0)}`;
    pnlEl.className = `summary-value ${guncelKar >= 0 ? 'val-up' : 'val-down'}`;
}

function updateBadge() {
    if (!pfBadge) return;
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
async function loadPortfolio() {
    try {
        // Try to get from Server first - load both YAT and EMK
        const yatResponse = await fetch('/api/local-portfolio?fundType=YAT');
        const emkResponse = await fetch('/api/local-portfolio?fundType=EMK');

        let yatData = [];
        let emkData = [];

        if (yatResponse.ok) {
            yatData = await yatResponse.json();
        }
        if (emkResponse.ok) {
            emkData = await emkResponse.json();
        }

        // Merge both types
        portfolio = [...yatData, ...emkData];

        // Save merged data to localStorage
        localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
        return portfolio;
    } catch (e) {
        console.warn('Backend connection failed, using localStorage');
    }

    try {
        const local = JSON.parse(localStorage.getItem(PORTFOLIO_KEY)) || [];
        portfolio = local;
        return local;
    } catch { return []; }
}

async function savePortfolio() {
    // Save to localStorage
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));

    // Separate portfolio by fundType - determine based on fund code
    const besData = window.besData || JSON.parse(localStorage.getItem('tefasData-bes') || '[]');
    const yatPortfolio = portfolio.filter(p => {
        const fundCode = p.code;
        // Check if fund exists in BES data
        return !besData.some(f => f[0] === fundCode);
    });

    const emkPortfolio = portfolio.filter(p => {
        const fundCode = p.code;
        // Check if fund exists in BES data
        return besData.some(f => f[0] === fundCode);
    });

    // Save to Server - both types
    try {
        if (yatPortfolio.length > 0) {
            await fetch('/api/local-portfolio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: yatPortfolio, fundType: 'YAT' })
            });
        }
        if (emkPortfolio.length > 0) {
            await fetch('/api/local-portfolio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: emkPortfolio, fundType: 'EMK' })
            });
        }
    } catch (e) {
        console.error('Failed to sync with backend');
    }
}

// Custom async initialization
async function initApp() {
    await loadPortfolio();
    await initBesPortfolio();
    updateBadge();
    initDashboardSorting();
    renderDashboard();
}

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    initApp();
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
        dashboardTableContainer.classList.toggle('detail-hidden');
        dashboardToggleBtn.setAttribute('data-tooltip',
            dashboardTableContainer.classList.contains('detail-hidden')
                ? 'Detayları Göster'
                : 'Detayları Gizle'
        );
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
    const headers = ['KOD', 'UNVAN', 'FİYAT', 'LOT', 'ORT. MALİYET', 'GÜNCEL DEĞER', 'GÜNCEL KAR', 'SATIŞ KARI', 'TOPLAM KAR', 'K/Z %', '1G %', '1H %', '3AY %', '1YIL %', 'AĞIRLIK (%)'];

    let totalVal = aggregated.reduce((acc, f) => acc + f.currentValue, 0);

    const exportData = aggregated.map(f => [
        f.code, f.name, f.currentPrice.toFixed(4), f.totalLots, f.avgCost.toFixed(4),
        f.currentValue.toFixed(2), f.pnl.toFixed(2), f.realizedProfit.toFixed(2),
        f.totalProfit.toFixed(2), (f.pnlPct * 100).toFixed(2) + '%',
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
    const headers = ['KOD', 'UNVAN', 'FİYAT', 'LOT', 'ORT. MALİYET', 'GÜNCEL DEĞER', 'GÜNCEL KAR', 'SATIŞ KARI', 'TOPLAM KAR', 'K/Z %', '1G %', '1H %', '3AY %', '1YIL %', 'AĞIRLIK (%)'];

    let totalVal = aggregated.reduce((acc, f) => acc + f.currentValue, 0);

    const exportData = aggregated.map(f => [
        f.code, f.name, f.currentPrice.toFixed(4), f.totalLots, f.avgCost.toFixed(4),
        f.currentValue.toFixed(2), f.pnl.toFixed(2), f.realizedProfit.toFixed(2),
        f.totalProfit.toFixed(2), (f.pnlPct * 100).toFixed(2) + '%',
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

// ===== IMPORT FUNCTIONALITY =====

// Toggle import dropdown
const importDropdown = document.getElementById('import-dropdown');
const importTriggerBtn = document.getElementById('import-trigger-btn');
if (importTriggerBtn && importDropdown) {
    importTriggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        importDropdown.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (!importDropdown.contains(e.target)) {
            importDropdown.classList.remove('open');
        }
    });
}

// Download CSV Template
document.getElementById('import-download-template')?.addEventListener('click', () => {
    importDropdown?.classList.remove('open');

    // Template headers and example rows
    const headers = ['TIP', 'KOD', 'LOT', 'BIRIM_FIYAT', 'TARIH'];
    const examples = [
        ['AL', 'GAF', '100', '1.2500', '2024-01-15'],
        ['AL', 'AFT', '250', '0.8750', '2024-02-01'],
        ['SAT', 'GAF', '50', '1.5000', '2024-03-10'],
    ];

    const csvContent = [headers, ...examples]
        .map(row => row.join(';'))
        .join('\r\n');

    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'TEFAS_Islemler_Sablonu.csv';
    a.click();
    URL.revokeObjectURL(url);
});

// Trigger file picker
document.getElementById('import-upload-btn')?.addEventListener('click', () => {
    importDropdown?.classList.remove('open');
    document.getElementById('import-file-input')?.click();
});

// Handle file selection & parse
document.getElementById('import-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const text = evt.target.result.replace(/^\uFEFF/, ''); // Strip BOM
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');

            if (lines.length < 2) {
                showImportStatus('Dosya boş veya geçersiz format.', 'error');
                return;
            }

            // Detect delimiter
            const firstLine = lines[0];
            const delimiter = firstLine.includes(';') ? ';' : ',';

            const headerLine = lines[0].split(delimiter).map(h => h.trim().toUpperCase());
            const colTip = headerLine.indexOf('TIP');
            const colKod = headerLine.indexOf('KOD');
            const colLot = headerLine.indexOf('LOT');
            const colFiyat = headerLine.indexOf('BIRIM_FIYAT');
            const colTarih = headerLine.indexOf('TARIH');

            if ([colTip, colKod, colLot, colFiyat, colTarih].some(c => c === -1)) {
                showImportStatus('Başlık satırı hatalı. Beklenen sütunlar: TIP, KOD, LOT, BIRIM_FIYAT, TARIH', 'error');
                return;
            }

            let imported = 0;
            let skipped = 0;
            const errors = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(delimiter).map(c => c.trim());
                if (cols.length < 2) continue; // Skip empty rows

                const tip = cols[colTip]?.toUpperCase();
                const kod = cols[colKod]?.toUpperCase();
                const lot = parseFloat(cols[colLot]?.replace(',', '.'));
                const fiyat = parseFloat(cols[colFiyat]?.replace(',', '.'));
                const tarih = cols[colTarih];

                // Validations
                if (!tip || (tip !== 'AL' && tip !== 'SAT')) {
                    errors.push(`Satır ${i + 1}: Geçersiz TIP ("${tip}"). AL veya SAT olmalı.`);
                    skipped++;
                    continue;
                }
                if (!kod || kod.length < 2) {
                    errors.push(`Satır ${i + 1}: Geçersiz KOD.`);
                    skipped++;
                    continue;
                }
                if (isNaN(lot) || lot <= 0) {
                    errors.push(`Satır ${i + 1}: Geçersiz LOT değeri.`);
                    skipped++;
                    continue;
                }
                if (isNaN(fiyat) || fiyat <= 0) {
                    errors.push(`Satır ${i + 1}: Geçersiz BIRIM_FIYAT değeri.`);
                    skipped++;
                    continue;
                }
                if (!tarih || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
                    errors.push(`Satır ${i + 1}: Geçersiz TARIH formatı. YYYY-AA-GG olmalı.`);
                    skipped++;
                    continue;
                }

                // Look up fund name from fullData if available
                const liveData = window.fullData || [];
                const liveRow = liveData.find(r => r[0] === kod);
                const name = liveRow ? liveRow[1] : kod;

                portfolio.push({
                    id: Date.now() + i,
                    code: kod,
                    name: name,
                    lots: lot,
                    buyPrice: fiyat,
                    buyDate: tarih,
                    type: tip
                });
                imported++;
            }

            await savePortfolio();
            updateBadge();

            // Refresh active tab
            if (document.getElementById('tab-portfolio').classList.contains('active')) renderPortfolio();
            if (document.getElementById('tab-dashboard').classList.contains('active')) renderDashboard();

            let msg = `${imported} işlem başarıyla içe aktarıldı.`;
            if (skipped > 0) msg += ` ${skipped} satır atlandı.`;
            if (errors.length > 0) msg += `\n\nHatalar:\n` + errors.slice(0, 5).join('\n');
            showImportStatus(msg, imported > 0 ? 'success' : 'error');

        } catch (err) {
            console.error('Import error:', err);
            showImportStatus('Dosya okunurken hata oluştu: ' + err.message, 'error');
        } finally {
            // Reset file input so same file can be re-selected
            e.target.value = '';
        }
    };
    reader.readAsText(file, 'UTF-8');
});

// ===== BES PORTFOLIO EXPORT/IMPORT FUNCTIONALITY =====

// BES Export CSV
document.getElementById('export-bes-transactions-csv')?.addEventListener('click', () => {
    const headers = ['NO', 'KOD', 'TIP', 'LOT', 'ÖNCEKİ LOT', 'KÜM LOT', 'BİRİM FİYAT', 'MALİYET', 'SATIŞ KARI', 'TARİH'];
    const chronological = [...besPortfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);
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
    window.downloadCSV(exportData, headers, 'BES_Islemler_' + new Date().toISOString().split('T')[0]);
});

// BES Export XLS
document.getElementById('export-bes-transactions-xls')?.addEventListener('click', () => {
    const headers = ['NO', 'KOD', 'TIP', 'LOT', 'ÖNCEKİ LOT', 'KÜM LOT', 'BİRİM FİYAT', 'MALİYET', 'SATIŞ KARI', 'TARİH'];
    const chronological = [...besPortfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);
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
    window.downloadXLS(exportData, headers, 'BES_Islemler_' + new Date().toISOString().split('T')[0]);
});

// Toggle BES import dropdown
const besImportDropdown = document.getElementById('bes-import-dropdown');
const besImportTriggerBtn = document.getElementById('bes-import-trigger-btn');
if (besImportTriggerBtn && besImportDropdown) {
    besImportTriggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        besImportDropdown.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (!besImportDropdown.contains(e.target)) {
            besImportDropdown.classList.remove('open');
        }
    });
}

// Download BES CSV Template
document.getElementById('bes-import-download-template')?.addEventListener('click', () => {
    besImportDropdown?.classList.remove('open');
    const headers = ['TIP', 'KOD', 'LOT', 'BIRIM_FIYAT', 'TARIH'];
    const examples = [
        ['AL', 'BES001', '100', '1.2500', '2024-01-15'],
        ['AL', 'BES002', '250', '0.8750', '2024-02-01'],
        ['SAT', 'BES001', '50', '1.5000', '2024-03-10'],
    ];
    const csvContent = [headers, ...examples]
        .map(row => row.join(';'))
        .join('\r\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'BES_Islemler_Sablonu.csv';
    a.click();
    URL.revokeObjectURL(url);
});

// Trigger BES file picker
document.getElementById('bes-import-upload-btn')?.addEventListener('click', () => {
    besImportDropdown?.classList.remove('open');
    document.getElementById('bes-import-file-input')?.click();
});

// Handle BES file selection & parse
document.getElementById('bes-import-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const text = evt.target.result.replace(/^\uFEFF/, '');
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');

            if (lines.length < 2) {
                showImportStatus('Dosya boş veya geçersiz format.', 'error');
                return;
            }

            const firstLine = lines[0];
            const delimiter = firstLine.includes(';') ? ';' : ',';
            const headerLine = lines[0].split(delimiter).map(h => h.trim().toUpperCase());

            const idxTip = headerLine.indexOf('TIP');
            const idxKod = headerLine.indexOf('KOD');
            const idxLot = headerLine.indexOf('LOT');
            const idxFiyat = headerLine.indexOf('BIRIM_FIYAT') ?? headerLine.indexOf('FIYAT');
            const idxTarih = headerLine.indexOf('TARIH');

            if (idxTip === -1 || idxKod === -1 || idxLot === -1 || idxFiyat === -1 || idxTarih === -1) {
                showImportStatus('Eksik veya hatalı başlık. Gerekli: TIP, KOD, LOT, BIRIM_FIYAT, TARIH', 'error');
                return;
            }

            const data = window.besData || [];
            let imported = 0, skipped = 0;
            const errors = [];

            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(delimiter).map(c => c.trim());
                if (cols.length < 5) { skipped++; continue; }

                const tip = cols[idxTip].toUpperCase();
                const kod = cols[idxKod].toUpperCase();
                const lot = parseFloat(cols[idxLot].replace(',', '.'));
                const fiyat = parseFloat(cols[idxFiyat].replace(',', '.'));
                const tarih = cols[idxTarih];

                if (!['AL', 'SAT'].includes(tip)) { errors.push(`Satır ${i}: Geçersiz tip`); skipped++; continue; }
                if (!lot || lot <= 0) { errors.push(`Satır ${i}: Geçersiz lot`); skipped++; continue; }
                if (!fiyat || fiyat <= 0) { errors.push(`Satır ${i}: Geçersiz fiyat`); skipped++; continue; }

                const nameRow = data.find(r => r[0] === kod);
                besPortfolio.push({
                    id: Date.now() + i,
                    code: kod,
                    name: nameRow ? nameRow[1] : '',
                    lots: lot,
                    buyPrice: fiyat,
                    buyDate: tarih,
                    type: tip
                });
                imported++;
            }

            await saveBesPortfolio();

            if (document.getElementById('tab-bes-portfolio').classList.contains('active')) renderBesPortfolio();

            let msg = `${imported} BES işlemi başarıyla içe aktarıldı.`;
            if (skipped > 0) msg += ` ${skipped} satır atlandı.`;
            if (errors.length > 0) msg += `\n\nHatalar:\n` + errors.slice(0, 5).join('\n');
            showImportStatus(msg, imported > 0 ? 'success' : 'error');

        } catch (err) {
            console.error('BES Import error:', err);
            showImportStatus('Dosya okunurken hata oluştu: ' + err.message, 'error');
        } finally {
            e.target.value = '';
        }
    };
    reader.readAsText(file, 'UTF-8');
});

function showImportStatus(message, type) {
    const el = document.getElementById('status-message');
    if (!el) { alert(message); return; }
    el.textContent = message;
    el.className = 'status-message ' + (type === 'success' ? 'status-success' : 'status-error');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => {
        el.className = 'status-message';
        el.textContent = '';
    }, 6000);
}

// ===== BES PORTFOLIO MANAGEMENT =====

const BES_PORTFOLIO_KEY = 'tefasBesPortfolio';

// --- BES State ---
let besPortfolio = [];
let besPortfolios = []; // Portfolio metadata list
let selectedBesPortfolioId = 1; // Currently selected portfolio ID

// --- BES DOM elements ---
const besFundSearch = document.getElementById('bes-fund-search');
const besSuggestions = document.getElementById('bes-fund-suggestions');
const besLots = document.getElementById('bes-lots');
const besBuyPrice = document.getElementById('bes-buy-price');
const besBuyDate = document.getElementById('bes-buy-date');
const besAddBtn = document.getElementById('bes-add-btn');
const besPortfolioBody = document.getElementById('bes-portfolio-body');
const besTransactionsFilter = document.getElementById('bes-transactions-filter');

// Portfolio selector elements
const besPortfolioSelect = document.getElementById('bes-portfolio-select');
const besNewPortfolioBtn = document.getElementById('bes-new-portfolio-btn');
const besPortfolioEditBtn = document.getElementById('bes-portfolio-edit-btn');
const besPortfolioDeleteBtn = document.getElementById('bes-portfolio-delete-btn');
const besPortfolioModal = document.getElementById('bes-portfolio-modal');
const besPortfolioModalTitle = document.getElementById('bes-portfolio-modal-title');
const besPortfolioNameInput = document.getElementById('bes-portfolio-name-input');
const besPortfolioModalCancel = document.getElementById('bes-portfolio-modal-cancel');
const besPortfolioModalSave = document.getElementById('bes-portfolio-modal-save');

let isEditingPortfolio = false;

// --- Load BES Portfolio Metadata ---
async function loadBesPortfolios() {
    try {
        const res = await fetch('/api/bes-portfolios');
        if (res.ok) {
            besPortfolios = await res.json();
            renderBesPortfolioSelect();
        }
    } catch (err) {
        console.error('Failed to load BES portfolios:', err);
    }
}

// --- Render Portfolio Select Dropdown ---
function renderBesPortfolioSelect() {
    if (!besPortfolioSelect) return;

    besPortfolioSelect.innerHTML = '';
    besPortfolios.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (p.id === selectedBesPortfolioId) {
            option.selected = true;
        }
        besPortfolioSelect.appendChild(option);
    });

    // Show/hide edit/delete buttons based on whether it's default portfolio
    const isDefault = selectedBesPortfolioId === 1;
    if (besPortfolioEditBtn) besPortfolioEditBtn.style.display = isDefault ? 'none' : 'inline-flex';
    if (besPortfolioDeleteBtn) besPortfolioDeleteBtn.style.display = isDefault ? 'none' : 'inline-flex';
}

// --- Portfolio Selection Change ---
if (besPortfolioSelect) {
    besPortfolioSelect.addEventListener('change', async (e) => {
        selectedBesPortfolioId = parseInt(e.target.value);
        await loadBesPortfolioForPortfolio(selectedBesPortfolioId);
        renderBesPortfolioSelect(); // Update button visibility
    });
}

// --- New Portfolio Button ---
if (besNewPortfolioBtn) {
    besNewPortfolioBtn.addEventListener('click', () => {
        isEditingPortfolio = false;
        besPortfolioModalTitle.textContent = 'Yeni Portfolio';
        besPortfolioNameInput.value = '';
        besPortfolioModal.style.display = 'flex';
        besPortfolioNameInput.focus();
    });
}

// --- Edit Portfolio Button ---
if (besPortfolioEditBtn) {
    besPortfolioEditBtn.addEventListener('click', () => {
        isEditingPortfolio = true;
        const currentPortfolio = besPortfolios.find(p => p.id === selectedBesPortfolioId);
        if (currentPortfolio) {
            besPortfolioModalTitle.textContent = 'Portfolio Düzenle';
            besPortfolioNameInput.value = currentPortfolio.name;
            besPortfolioModal.style.display = 'flex';
            besPortfolioNameInput.focus();
        }
    });
}

// --- Delete Portfolio Button ---
if (besPortfolioDeleteBtn) {
    besPortfolioDeleteBtn.addEventListener('click', async () => {
        const currentPortfolio = besPortfolios.find(p => p.id === selectedBesPortfolioId);
        if (!currentPortfolio) return;

        if (!confirm(`"${currentPortfolio.name}" portfolio silinsin mi? Tüm fonlar "Varsayılan" portfolioya taşınacaktır.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/bes-portfolios/${selectedBesPortfolioId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                selectedBesPortfolioId = 1;
                await loadBesPortfolios();
                await loadBesPortfolioForPortfolio(selectedBesPortfolioId);
            } else {
                const data = await res.json();
                alert(data.error || 'Portfolio silinemedi');
            }
        } catch (err) {
            console.error('Failed to delete portfolio:', err);
            alert('Portfolio silinirken hata oluştu');
        }
    });
}

// --- Modal Cancel ---
if (besPortfolioModalCancel) {
    besPortfolioModalCancel.addEventListener('click', () => {
        besPortfolioModal.style.display = 'none';
    });
}

// --- Modal Save ---
if (besPortfolioModalSave) {
    besPortfolioModalSave.addEventListener('click', async () => {
        const name = besPortfolioNameInput.value.trim();
        if (!name) {
            alert('Lütfen bir portfolio adı girin');
            return;
        }

        try {
            if (isEditingPortfolio) {
                // Update existing portfolio
                const res = await fetch(`/api/bes-portfolios/${selectedBesPortfolioId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });

                if (res.ok) {
                    await loadBesPortfolios();
                } else {
                    const data = await res.json();
                    alert(data.error || 'Portfolio güncellenemedi');
                    return;
                }
            } else {
                // Create new portfolio
                const res = await fetch('/api/bes-portfolios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });

                if (res.ok) {
                    const data = await res.json();
                    selectedBesPortfolioId = data.id;
                    await loadBesPortfolios();
                    await loadBesPortfolioForPortfolio(selectedBesPortfolioId);
                } else {
                    const data = await res.json();
                    alert(data.error || 'Portfolio eklenemedi');
                    return;
                }
            }

            besPortfolioModal.style.display = 'none';
        } catch (err) {
            console.error('Failed to save portfolio:', err);
            alert('Portfolio kaydedilirken hata oluştu');
        }
    });
}

// Close modal on outside click
if (besPortfolioModal) {
    besPortfolioModal.addEventListener('click', (e) => {
        if (e.target === besPortfolioModal) {
            besPortfolioModal.style.display = 'none';
        }
    });
}

// --- Load BES Portfolio for specific portfolio ID ---
async function loadBesPortfolioForPortfolio(portfolioId) {
    try {
        const res = await fetch(`/api/bes-portfolio/${portfolioId}`);
        if (res.ok) {
            besPortfolio = await res.json();
            if (document.getElementById('tab-bes-portfolio').classList.contains('active')) {
                renderBesPortfolio();
            }
        }
    } catch (err) {
        console.error('Failed to load BES portfolio:', err);
    }
}

// Default buy date to today
besBuyDate.value = new Date().toISOString().split('T')[0];

let selectedBesFund = null;

// --- Load BES Portfolio from API ---
async function loadBesPortfolio() {
    try {
        const res = await fetch('/api/bes-portfolio');
        if (res.ok) {
            besPortfolio = await res.json();
        }
    } catch (err) {
        console.error('Failed to load BES portfolio:', err);
    }
}

// --- Save BES Portfolio to API ---
async function saveBesPortfolio() {
    try {
        await fetch('/api/bes-portfolio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: besPortfolio })
        });
    } catch (err) {
        console.error('Failed to save BES portfolio:', err);
    }
}

// --- BES Fund Search Suggestions ---
besFundSearch.addEventListener('input', () => {
    selectedBesFund = null;
    const q = besFundSearch.value.trim().toUpperCase();

    // Use BES data (EMK) from window
    const data = window.besData || [];
    if (!q || data.length === 0) {
        besSuggestions.style.display = 'none';
        return;
    }

    const matches = data.filter(row =>
        row[0].includes(q) || (row[1] && row[1].toUpperCase().includes(q))
    ).slice(0, 8);

    if (matches.length === 0) {
        besSuggestions.style.display = 'none';
        return;
    }

    besSuggestions.innerHTML = '';
    matches.forEach(row => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `<strong>${row[0]}</strong><span>${row[1]}</span>`;
        item.addEventListener('mousedown', () => {
            selectedBesFund = { code: row[0], name: row[1] };
            besFundSearch.value = `${row[0]} — ${row[1]}`;
            // Pre-fill price if available
            if (row[15]) besBuyPrice.value = row[15].toFixed(4);
            besSuggestions.style.display = 'none';
        });
        besSuggestions.appendChild(item);
    });

    besSuggestions.style.display = 'block';
});

// Hide suggestions when clicking outside
document.addEventListener('click', e => {
    if (!besFundSearch.contains(e.target)) besSuggestions.style.display = 'none';
});

// --- Add BES Fund ---
besAddBtn.addEventListener('click', async () => {
    if (!selectedBesFund) {
        alert('Lütfen listeden bir BES fonu seçin.');
        return;
    }

    const lots = parseFloat(besLots.value);
    const buyPrice = parseFloat(besBuyPrice.value);
    const buyDate = besBuyDate.value;
    const type = document.querySelector('input[name="bes-pf-type"]:checked').value;

    if (!lots || lots <= 0) { alert('Lütfen geçerli bir lot girin.'); return; }
    if (!buyPrice || buyPrice <= 0) { alert('Lütfen geçerli bir alış fiyatı girin.'); return; }
    if (!buyDate) { alert('Lütfen bir tarih seçin.'); return; }

    const entry = {
        id: Date.now(),
        code: selectedBesFund.code,
        name: selectedBesFund.name,
        lots,
        buyPrice,
        buyDate,
        type, // AL or SAT
        portfolioId: selectedBesPortfolioId
    };

    besPortfolio.push(entry);
    await saveBesPortfolio();

    if (document.getElementById('tab-bes-portfolio').classList.contains('active')) renderBesPortfolio();

    // Reset Form
    besFundSearch.value = '';
    besLots.value = '';
    besBuyPrice.value = '';
    selectedBesFund = null;
});

// --- Remove BES Fund ---
async function removeBesFund(id) {
    besPortfolio = besPortfolio.filter(item => item.id !== id);
    await saveBesPortfolio();

    if (document.getElementById('tab-bes-portfolio').classList.contains('active')) renderBesPortfolio();
}

// --- Render BES Portfolio ---
function renderBesPortfolio() {
    // Use BES data from window
    const data = window.besData || [];
    const filterText = besTransactionsFilter.value.trim().toUpperCase();

    // Filter displayed portfolio for table
    let filteredPortfolio = besPortfolio;
    if (filterText) {
        filteredPortfolio = besPortfolio.filter(p => p.code.toUpperCase().includes(filterText));
    }

    if (filteredPortfolio.length === 0) {
        besPortfolioBody.innerHTML = `<tr><td colspan="16" class="empty-state">${filterText ? 'Arama sonucu bulunamadı.' : 'BES işlem listeniz boş. Yukarıdan fon ekleyebilirsiniz.'}</td></tr>`;
        updateBesSummary([], data);
        return;
    }

    besPortfolioBody.innerHTML = '';

    // Sort portfolio by Buy Date descending (Z to A) for display
    const displayList = [...filteredPortfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);

    // Pre-calculate Realized Profit & Cumulative Totals
    const statsById = {};
    const runningStats = {};

    const chronological = [...besPortfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);

    chronological.forEach((e, index) => {
        if (!runningStats[e.code]) runningStats[e.code] = { lots: 0, cost: 0 };
        const stats = runningStats[e.code];

        const prevLots = stats.lots;
        const prevCost = stats.cost;
        const islemPara = e.lots * e.buyPrice;
        let profit = 0;
        let satisDegeri = '-';
        let ortFiyat = '-';
        let cumCost = 0;
        let karYuzdesi = '-';

        if (e.type === 'AL') {
            // Buy: add to running totals
            stats.lots += e.lots;
            stats.cost += islemPara;
            cumCost = stats.cost;
            profit = 0;
        } else {
            // Sell: calculate based on previous average
            ortFiyat = prevLots > 0 ? (prevCost / prevLots) : 0;
            satisDegeri = e.lots * ortFiyat;
            profit = islemPara - satisDegeri;

            // Update running totals
            stats.lots -= e.lots;
            stats.cost -= satisDegeri;
            if (stats.lots <= 0) { stats.lots = 0; stats.cost = 0; }
            cumCost = stats.cost;

            // Calculate profit percentage
            if (satisDegeri > 0) {
                karYuzdesi = (profit / satisDegeri);
            }
        }

        statsById[e.id] = {
            rowNo: index + 1,
            prevLots: prevLots,
            cumLots: stats.lots,
            profit: profit,
            islemPara: islemPara,
            oncekiMaliyet: prevCost,
            satisDegeri: satisDegeri,
            ortFiyat: ortFiyat,
            cumCost: cumCost,
            karYuzdesi: karYuzdesi
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
        <td>${fmtNum(entry.buyPrice, 4)}</td>
        <td class="val-neutral">₺${fmtNum(stats.islemPara)}</td>
        <td class="val-neutral">₺${fmtNum(stats.oncekiMaliyet)}</td>
        <td class="val-neutral">${stats.prevLots.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
        <td class="val-neutral"><strong>${stats.cumLots.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></td>
        <td>${typeof stats.ortFiyat === 'number' ? fmtNum(stats.ortFiyat, 4) : stats.ortFiyat}</td>
        <td>${typeof stats.satisDegeri === 'number' ? '₺' + fmtNum(stats.satisDegeri) : stats.satisDegeri}</td>
        <td class="val-neutral">₺${fmtNum(stats.cumCost)}</td>
        <td class="${stats.profit > 0 ? 'val-up' : stats.profit < 0 ? 'val-down' : 'val-neutral'}">
            ${entry.type === 'SAT' ? '₺' + fmtNum(stats.profit) : '0'}
        </td>
        <td class="${typeof stats.karYuzdesi === 'number' ? (stats.karYuzdesi > 0 ? 'val-up' : stats.karYuzdesi < 0 ? 'val-down' : 'val-neutral') : 'val-neutral'}">
            ${typeof stats.karYuzdesi === 'number' ? '%' + fmtNum(stats.karYuzdesi * 100, 2) : stats.karYuzdesi}
        </td>
        <td>${entry.buyDate}</td>
        <td>
            <div style="display: flex; gap: 0.4rem;">
                <button class="remove-btn" data-bes-id="${entry.id}" title="Kaldır">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
            </div>
        </td>
    `;
        besPortfolioBody.appendChild(tr);
    });

    attachBesTransactionListeners();

    // Update summary and charts
    const processedForSummary = [];
    besPortfolio.forEach(e => {
        const liveRow = data.find(r => r[0] === e.code);
        const currentPrice = liveRow ? (liveRow[15] || e.buyPrice) : e.buyPrice;
        const buyValue = e.lots * e.buyPrice;
        const currValue = e.lots * currentPrice;
        const pnl = e.type === 'AL' ? (currValue - buyValue) : (buyValue - currValue);
        processedForSummary.push({ entry: e, currValue, buyValue, pnl });
    });
    updateBesSummary(processedForSummary, data);

    // Aggregate for charts
    const aggregated = {};
    const chron = [...besPortfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);
    chron.forEach(e => {
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
    Object.values(aggregated).forEach(fund => {
        if (fund.totalLots <= 0) return;

        const liveRow = data.find(r => r[0] === fund.code);
        const currentPrice = liveRow ? (liveRow[15] || 0) : 0;
        const currentValue = fund.totalLots * currentPrice;

        const avgCost = fund.totalLots !== 0 ? (fund.totalCost / fund.totalLots) : 0;
        const pnl = currentValue - fund.totalCost;

        fundRows.push({
            ...fund,
            currentPrice,
            currentValue,
            avgCost,
            pnl
        });
    });

    renderBesCharts(fundRows);
}

// --- Attach BES Transaction Listeners ---
function attachBesTransactionListeners() {
    // Remove buttons
    document.querySelectorAll('.remove-btn[data-bes-id]').forEach(btn => {
        btn.onclick = () => {
            const id = parseInt(btn.dataset.besId);
            if (confirm('Bu işlemi kaldırmak istediğinizden emin misiniz?')) {
                removeBesFund(id);
            }
        };
    });
}

// --- BES Filter Listener ---
besTransactionsFilter.addEventListener('input', renderBesPortfolio);

// --- Initialize BES Portfolio ---
async function initBesPortfolio() {
    await loadBesPortfolios();
    await loadBesPortfolioForPortfolio(selectedBesPortfolioId);
    if (document.getElementById('tab-bes-portfolio').classList.contains('active')) {
        renderBesPortfolio();
    }
}

// --- BES Chart Instances ---
let besWeightChartInstance = null;
let besPnlChartInstance = null;

// --- FON Chart Instances ---
let fonWeightChartInstance = null;
let fonPnlChartInstance = null;

// --- Update FON Summary ---
function updateBesSummary(rows, data) {
    // Aggregate by code to find holdings (net lots)
    const aggLots = {};
    besPortfolio.forEach(e => {
        if (!aggLots[e.code]) aggLots[e.code] = 0;
        aggLots[e.code] += (e.lots * (e.type === 'AL' ? 1 : -1));
    });

    // Count funds with positive balance
    const heldFundsCount = Object.values(aggLots).filter(lots => lots > 0.0001).length;

    // --- Calculate Grand Total Realized Profit ---
    let totalRealized = 0;
    const runningStats = {}; // { code: { lots, cost } }
    const chronological = [...besPortfolio].sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);

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

    const realizedEl = document.getElementById('bes-realized-profit');
    if (realizedEl) {
        realizedEl.textContent = `₺${fmtNum(totalRealized, 0)}`;
        realizedEl.className = `summary-value ${totalRealized > 0 ? 'val-up' : totalRealized < 0 ? 'val-down' : 'val-neutral'}`;
    }

    if (besPortfolio.length === 0) {
        if (document.getElementById('bes-total-investment')) document.getElementById('bes-total-investment').textContent = '₺0';
        if (document.getElementById('bes-total-cost')) document.getElementById('bes-total-cost').textContent = '₺0';
        if (document.getElementById('bes-daily-change')) document.getElementById('bes-daily-change').textContent = '-';
        if (document.getElementById('bes-weekly-change')) document.getElementById('bes-weekly-change').textContent = '-';
        if (document.getElementById('bes-total-pnl')) document.getElementById('bes-total-pnl').textContent = '-';
        return;
    }

    let totalRequestedInvestment = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
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

    if (document.getElementById('bes-total-investment')) {
        document.getElementById('bes-total-investment').textContent = `₺${fmtNum(totalRequestedInvestment, 0)}`;
    }
    if (document.getElementById('bes-total-cost')) {
        document.getElementById('bes-total-cost').textContent = `₺${fmtNum(totalCost, 0)}`;
    }

    // Total Daily Change (₺) - using formula: GD - (LOT * price1)
    let dailyChangeTl = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
            const liveRow = data.find(r => r[0] === code);
            if (liveRow) {
                const currentPrice = liveRow[15] || 0; // FIYAT (current)
                const price1 = liveRow[16] || 0; // FIYAT1 (1 day ago)
                const GD = netLots * currentPrice; // Güncel Değer
                if (price1 > 0 && currentPrice > 0) {
                    dailyChangeTl += GD - (netLots * price1);
                }
            }
        }
    });

    const dailyEl = document.getElementById('bes-daily-change');
    if (dailyEl) {
        dailyEl.textContent = `${dailyChangeTl >= 0 ? '+' : ''}₺${fmtNum(dailyChangeTl, 0)}`;
        dailyEl.className = `summary-value ${dailyChangeTl >= 0 ? 'val-up' : 'val-down'}`;
    }

    // Weekly Change (₺) - using formula: GD - (LOT * price7)
    let weeklyChangeTl = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
            const liveRow = data.find(r => r[0] === code);
            if (liveRow) {
                const currentPrice = liveRow[15] || 0; // FIYAT (current)
                const price7 = liveRow[17] || 0; // FIYAT7 (7 days ago)
                const GD = netLots * currentPrice; // Güncel Değer
                if (price7 > 0 && currentPrice > 0) {
                    weeklyChangeTl += GD - (netLots * price7);
                }
            }
        }
    });

    const weeklyEl = document.getElementById('bes-weekly-change');
    if (weeklyEl) {
        weeklyEl.textContent = `${weeklyChangeTl >= 0 ? '+' : ''}₺${fmtNum(weeklyChangeTl, 0)}`;
        weeklyEl.className = `summary-value ${weeklyChangeTl >= 0 ? 'val-up' : 'val-down'}`;
    }

    // Güncel Kar (Unrealized PnL of active holdings)
    let guncelKar = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
            // Find average cost for this code
            const chron = besPortfolio.filter(p => p.code === code).sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);
            let runningLots = 0;
            let runningCost = 0;
            chron.forEach(e => {
                if (e.type === 'AL') {
                    runningLots += e.lots;
                    runningCost += e.lots * e.buyPrice;
                } else {
                    const avg = runningLots > 0 ? (runningCost / runningLots) : 0;
                    runningLots -= e.lots;
                    runningCost -= e.lots * avg;
                    if (runningLots < 0) { runningLots = 0; runningCost = 0; }
                }
            });
            const liveRow = data.find(r => r[0] === code);
            const currentPrice = liveRow ? (liveRow[15] || 0) : 0;
            const currentValue = runningLots * currentPrice;
            guncelKar += (currentValue - runningCost);
        }
    });

    const pnlEl = document.getElementById('bes-total-pnl');
    if (pnlEl) {
        pnlEl.textContent = `${guncelKar >= 0 ? '+' : ''}₺${fmtNum(guncelKar, 0)}`;
        pnlEl.className = `summary-value ${guncelKar >= 0 ? 'val-up' : 'val-down'}`;
    }

    // --- Populate BES Fund Summary Table ---
    const summaryTableBody = document.getElementById('bes-fund-summary-body');
    if (summaryTableBody) {
        // Calculate total current value for weight calculation
        let totalCurrentValue = 0;
        const fundSummaryData = [];

        Object.keys(aggLots).forEach(code => {
            const netLots = aggLots[code];
            if (netLots > 0.0001) {
                const liveRow = data.find(r => r[0] === code);
                const currentPrice = liveRow ? (liveRow[15] || 0) : 0;
                const currentValue = netLots * currentPrice;
                const g1 = liveRow ? liveRow[2] : null; // 1D %
                const h1 = liveRow ? liveRow[3] : null; // 1H %

                totalCurrentValue += currentValue;
                fundSummaryData.push({
                    code,
                    lots: netLots,
                    price: currentPrice,
                    currentValue,
                    g1,
                    h1
                });
            }
        });

        // Sort by weight (AĞIRLIK) descending
        fundSummaryData.sort((a, b) => {
            const weightA = totalCurrentValue > 0 ? (a.currentValue / totalCurrentValue * 100) : 0;
            const weightB = totalCurrentValue > 0 ? (b.currentValue / totalCurrentValue * 100) : 0;
            return weightB - weightA;
        });

        // Generate table rows
        if (fundSummaryData.length === 0) {
            summaryTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1rem; color: var(--text-muted);">Portföyünüzde fon bulunmamaktadır.</td></tr>`;
        } else {
            summaryTableBody.innerHTML = fundSummaryData.map(fund => {
                const weight = totalCurrentValue > 0 ? (fund.currentValue / totalCurrentValue * 100) : 0;
                const g1Display = fund.g1 !== null ? `${fund.g1 >= 0 ? '+' : ''}${(fund.g1 * 100).toFixed(2)}%` : '-';
                const h1Display = fund.h1 !== null ? `${fund.h1 >= 0 ? '+' : ''}${(fund.h1 * 100).toFixed(2)}%` : '-';
                const g1Class = fund.g1 > 0 ? 'val-up' : fund.g1 < 0 ? 'val-down' : 'val-neutral';
                const h1Class = fund.h1 > 0 ? 'val-up' : fund.h1 < 0 ? 'val-down' : 'val-neutral';

                return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 0.25rem 0.5rem; text-align: left;">
                            <a href="https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${fund.code}" target="_blank" class="fund-link">
                                <strong>${fund.code}</strong>
                            </a>
                        </td>
                        <td style="padding: 0.25rem 0.5rem; text-align: right; color: var(--text-primary);">${Math.round(fund.lots).toLocaleString('tr-TR')}</td>
                        <td style="padding: 0.25rem 0.5rem; text-align: right; color: var(--text-primary);">${fund.price > 0 ? fmtNum(fund.price, 4) : '-'}</td>
                        <td style="padding: 0.25rem 0.5rem; text-align: right; color: var(--text-primary); font-weight: 600;">₺${Math.round(fund.currentValue).toLocaleString('tr-TR')}</td>
                        <td style="padding: 0.25rem 0.5rem; text-align: right; color: var(--text-primary);">${weight.toFixed(1)}%</td>
                        <td style="padding: 0.25rem 0.5rem; text-align: right;" class="${g1Class}">${g1Display}</td>
                        <td style="padding: 0.25rem 0.5rem; text-align: right;" class="${h1Class}">${h1Display}</td>
                    </tr>
                `;
            }).join('');
        }
    }
}

// --- Render BES Charts ---
function renderBesCharts(fundRows) {
    if (typeof Chart === 'undefined') return;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#1B2559' : '#A3AED0';
    const gridColor = isLight ? '#E9EDF7' : '#1B254B';

    // Color palette for charts
    const chartColors = [
        '#7551FF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'
    ];

    // Chart 1: Weight Chart (Sorted by Current Value)
    const totalVal = fundRows.reduce((acc, f) => acc + (f.currentValue || 0), 0);
    const weightData = [...fundRows].sort((a, b) => b.currentValue - a.currentValue);
    const weightLabels = weightData.map(f => f.code);
    const weightValues = weightData.map(f => totalVal > 0 ? (f.currentValue / totalVal * 100) : 0);

    if (besWeightChartInstance) besWeightChartInstance.destroy();

    const ctxWeight = document.getElementById('bes-weight-chart');
    if (ctxWeight) {
        besWeightChartInstance = new Chart(ctxWeight, {
            type: 'bar',
            data: {
                labels: weightLabels,
                datasets: [{
                    label: 'Ağırlık (%)',
                    data: weightValues,
                    backgroundColor: chartColors.slice(0, weightLabels.length),
                    borderColor: chartColors.slice(0, weightLabels.length),
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'x',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${context.label}: %${context.parsed.y.toFixed(2)}`
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

    // Chart 2: PnL Chart (Bar chart)
    if (besPnlChartInstance) besPnlChartInstance.destroy();

    const ctxPnl = document.getElementById('bes-pnl-chart');
    if (ctxPnl) {
        const pnlData = [...fundRows].sort((a, b) => b.pnl - a.pnl);
        const pnlLabels = pnlData.map(f => f.code);
        const pnlValues = pnlData.map(f => f.pnl);
        const pnlColors = pnlValues.map(v => v >= 0 ? '#10B981' : '#EF4444');

        besPnlChartInstance = new Chart(ctxPnl, {
            type: 'bar',
            data: {
                labels: pnlLabels,
                datasets: [{
                    label: 'Kar/Zarar (₺)',
                    data: pnlValues,
                    backgroundColor: pnlColors,
                    borderColor: pnlColors,
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'x',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${context.parsed.y >= 0 ? '+' : ''}₺${fmtNum(context.parsed.y)}`
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
                            callback: (value) => `₺${fmtNum(value)}`
                        },
                        grid: { color: gridColor },
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// --- Update FON Summary ---
function updateFonSummary(rows, data) {
    // Aggregate by code to find holdings (net lots)
    const aggLots = {};
    portfolio.forEach(e => {
        if (!aggLots[e.code]) aggLots[e.code] = 0;
        aggLots[e.code] += (e.lots * (e.type === 'AL' ? 1 : -1));
    });

    // Calculate Grand Total Realized Profit
    let totalRealized = 0;
    const runningStats = {};
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

    const realizedEl = document.getElementById('fon-realized-profit');
    if (realizedEl) {
        realizedEl.textContent = `₺${fmtNum(totalRealized, 0)}`;
        realizedEl.className = `summary-value ${totalRealized > 0 ? 'val-up' : totalRealized < 0 ? 'val-down' : 'val-neutral'}`;
    }

    if (portfolio.length === 0) {
        if (document.getElementById('fon-total-investment')) document.getElementById('fon-total-investment').textContent = '₺0';
        if (document.getElementById('fon-total-cost')) document.getElementById('fon-total-cost').textContent = '₺0';
        if (document.getElementById('fon-daily-change')) document.getElementById('fon-daily-change').textContent = '-';
        if (document.getElementById('fon-weekly-change')) document.getElementById('fon-weekly-change').textContent = '-';
        if (document.getElementById('fon-total-pnl')) document.getElementById('fon-total-pnl').textContent = '-';
        return;
    }

    let totalRequestedInvestment = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
            const liveRow = data.find(r => r[0] === code);
            const currentPrice = liveRow ? (liveRow[15] || 0) : 0;
            totalRequestedInvestment += (netLots * currentPrice);
        }
    });

    const totalCost = rows.reduce((acc, r) => {
        const mult = r.entry.type === 'AL' ? 1 : -1;
        return acc + (r.buyValue * mult);
    }, 0);

    if (document.getElementById('fon-total-investment')) {
        document.getElementById('fon-total-investment').textContent = `₺${fmtNum(totalRequestedInvestment, 0)}`;
    }
    if (document.getElementById('fon-total-cost')) {
        document.getElementById('fon-total-cost').textContent = `₺${fmtNum(totalCost, 0)}`;
    }

    // Daily Change (₺) - using formula: GD - (LOT * price1)
    let dailyChangeTl = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
            const liveRow = data.find(r => r[0] === code);
            if (liveRow) {
                const currentPrice = liveRow[15] || 0; // FIYAT (current)
                const price1 = liveRow[16] || 0; // FIYAT1 (1 day ago)
                const GD = netLots * currentPrice; // Güncel Değer
                if (price1 > 0 && currentPrice > 0) {
                    dailyChangeTl += GD - (netLots * price1);
                }
            }
        }
    });

    const dailyEl = document.getElementById('fon-daily-change');
    if (dailyEl) {
        dailyEl.textContent = `${dailyChangeTl >= 0 ? '+' : ''}₺${fmtNum(dailyChangeTl, 0)}`;
        dailyEl.className = `summary-value ${dailyChangeTl >= 0 ? 'val-up' : 'val-down'}`;
    }

    // Weekly Change (₺) - using formula: GD - (LOT * price7)
    let weeklyChangeTl = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
            const liveRow = data.find(r => r[0] === code);
            if (liveRow) {
                const currentPrice = liveRow[15] || 0; // FIYAT (current)
                const price7 = liveRow[17] || 0; // FIYAT7 (7 days ago)
                const GD = netLots * currentPrice; // Güncel Değer
                if (price7 > 0 && currentPrice > 0) {
                    weeklyChangeTl += GD - (netLots * price7);
                }
            }
        }
    });

    const weeklyEl = document.getElementById('fon-weekly-change');
    if (weeklyEl) {
        weeklyEl.textContent = `${weeklyChangeTl >= 0 ? '+' : ''}₺${fmtNum(weeklyChangeTl, 0)}`;
        weeklyEl.className = `summary-value ${weeklyChangeTl >= 0 ? 'val-up' : 'val-down'}`;
    }

    // Güncel Kar
    let guncelKar = 0;
    Object.keys(aggLots).forEach(code => {
        const netLots = aggLots[code];
        if (netLots > 0.0001) {
            const chron = portfolio.filter(p => p.code === code).sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.id - b.id);
            let runningLots = 0;
            let runningCost = 0;
            chron.forEach(e => {
                if (e.type === 'AL') {
                    runningLots += e.lots;
                    runningCost += e.lots * e.buyPrice;
                } else {
                    const avg = runningLots > 0 ? (runningCost / runningLots) : 0;
                    runningLots -= e.lots;
                    runningCost -= e.lots * avg;
                    if (runningLots < 0) { runningLots = 0; runningCost = 0; }
                }
            });
            const liveRow = data.find(r => r[0] === code);
            const currentPrice = liveRow ? (liveRow[15] || 0) : 0;
            const currentValue = runningLots * currentPrice;
            guncelKar += (currentValue - runningCost);
        }
    });

    const pnlEl = document.getElementById('fon-total-pnl');
    if (pnlEl) {
        pnlEl.textContent = `${guncelKar >= 0 ? '+' : ''}₺${fmtNum(guncelKar, 0)}`;
        pnlEl.className = `summary-value ${guncelKar >= 0 ? 'val-up' : 'val-down'}`;
    }
}

// --- Render FON Charts ---
function renderFonCharts(fundRows) {
    if (typeof Chart === 'undefined') return;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#1B2559' : '#A3AED0';
    const gridColor = isLight ? '#E9EDF7' : '#1B254B';

    const chartColors = [
        '#7551FF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'
    ];

    // Chart 1: Weight Chart (Bar)
    const totalVal = fundRows.reduce((acc, f) => acc + (f.currentValue || 0), 0);
    const weightData = [...fundRows].sort((a, b) => b.currentValue - a.currentValue);
    const weightLabels = weightData.map(f => f.code);
    const weightValues = weightData.map(f => totalVal > 0 ? (f.currentValue / totalVal * 100) : 0);

    if (fonWeightChartInstance) fonWeightChartInstance.destroy();

    const ctxWeight = document.getElementById('fon-weight-chart');
    if (ctxWeight) {
        fonWeightChartInstance = new Chart(ctxWeight, {
            type: 'bar',
            data: {
                labels: weightLabels,
                datasets: [{
                    label: 'Ağırlık (%)',
                    data: weightValues,
                    backgroundColor: chartColors.slice(0, weightLabels.length),
                    borderColor: chartColors.slice(0, weightLabels.length),
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'x',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${context.label}: %${context.parsed.y.toFixed(2)}`
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

    // Chart 2: PnL Chart
    if (fonPnlChartInstance) fonPnlChartInstance.destroy();

    const ctxPnl = document.getElementById('fon-pnl-chart');
    if (ctxPnl) {
        const pnlData = [...fundRows].sort((a, b) => b.pnl - a.pnl);
        const pnlLabels = pnlData.map(f => f.code);
        const pnlValues = pnlData.map(f => f.pnl);
        const pnlColors = pnlValues.map(v => v >= 0 ? '#10B981' : '#EF4444');

        // ===== KAP NOTIFICATIONS MANAGEMENT =====

        // KAP State
        let kapNotifications = [];
        let kapFilteredNotifications = [];

        // KAP DOM elements
        const kapFetchBtn = document.getElementById('kap-fetch-btn');
        const kapRefreshBtn = document.getElementById('kap-refresh-btn');
        const kapTableBody = document.getElementById('kap-body');
        const kapFromDate = document.getElementById('kap-from-date');
        const kapToDate = document.getElementById('kap-to-date');
        const kapFilterBtn = document.getElementById('kap-filter-btn');
        const kapClearFilterBtn = document.getElementById('kap-clear-filter-btn');

        // Initialize KAP dates (last 7 days default)
        function initKapDates() {
            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);

            if (kapFromDate) kapFromDate.value = weekAgo.toISOString().split('T')[0];
            if (kapToDate) kapToDate.value = today.toISOString().split('T')[0];
        }

        // Load KAP notifications from database
        async function loadKapNotifications() {
            try {
                const res = await fetch('/api/kap-notifications');
                if (res.ok) {
                    kapNotifications = await res.json();
                    kapFilteredNotifications = [...kapNotifications];
                    renderKapTable();
                }
            } catch (err) {
                console.error('KAP verisi yüklenemedi:', err);
            }
        }

        // Fetch KAP data from API and save to database
        async function fetchKapData() {
            if (!kapFetchBtn) return;

            // Clear table first to show loading state
            if (kapTableBody) {
                kapTableBody.innerHTML = '<tr><td colspan="7" class="empty-state">Veriler çekiliyor, lütfen bekleyin...</td></tr>';
            }

            const fromDate = kapFromDate?.value || '';
            const toDate = kapToDate?.value || '';

            // Convert dates to Turkish format (dd.mm.yyyy)
            const formatDateTR = (dateStr) => {
                if (!dateStr) return '';
                const d = new Date(dateStr);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}.${month}.${year}`;
            };

            const payload = {
                disclosureTypes: null,
                fromDate: formatDateTR(fromDate) || formatDateTR(new Date().toISOString().split('T')[0]),
                fundTypes: ['YF'], // Yatırım Fonları
                memberTypes: null,
                mkkMemberOid: null,
                toDate: formatDateTR(toDate) || formatDateTR(new Date().toISOString().split('T')[0])
            };

            kapFetchBtn.disabled = true;
            kapFetchBtn.innerHTML = '<span>Çekiliyor...</span>';

            try {
                const response = await fetch('https://www.kap.org.tr/tr/api/disclosure/list/main', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                console.log('KAP API Response:', data);

                if (!data || data.length === 0) {
                    alert('Belirtilen tarih aralığında KAP bildirimi bulunamadı.');
                    return;
                }

                // Process and save to database
                const notifications = [];
                data.forEach(item => {
                    const basic = item.disclosureBasic;
                    if (basic) {
                        notifications.push({
                            stockCode: basic.stockCode || '',
                            publishDate: basic.publishDate || '',
                            title: basic.title || '',
                            companyTitle: basic.companyTitle || '',
                            summary: basic.summary || '',
                            category: basic.disclosureCategory || '',
                            disclosureIndex: basic.disclosureIndex || '',
                            url: basic.disclosureIndex ? `https://www.kap.org.tr/tr/Bildirim/${basic.disclosureIndex}` : ''
                        });
                    }
                });

                // Save to database
                const saveRes = await fetch('/api/kap-notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notifications })
                });

                if (saveRes.ok) {
                    const result = await saveRes.json();
                    console.log(`KAP verileri kaydedildi: ${result.count} bildirim`);
                    kapNotifications = notifications;
                    kapFilteredNotifications = [...notifications];
                    renderKapTable();
                }

            } catch (err) {
                console.error('KAP verisi çekme hatası:', err);
                alert('KAP verisi çekilirken hata oluştu: ' + err.message);
            } finally {
                kapFetchBtn.disabled = false;
                kapFetchBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" /></svg><span>Çek</span>';
            }
        }

        // Render KAP table
        function renderKapTable() {
            if (!kapTableBody) return;

            if (kapFilteredNotifications.length === 0) {
                kapTableBody.innerHTML = '<tr><td colspan="7" class="empty-state">KAP bildirimlerini çekmek için "Çek" butonuna tıklayın.</td></tr>';
                return;
            }

            kapTableBody.innerHTML = kapFilteredNotifications.map((item, index) => `
        <tr>
            <td style="font-weight: 600; color: var(--primary-color);">${item.stockCode || '-'}</td>
            <td>${item.publishDate || '-'}</td>
            <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(item.title || '').replace(/"/g, '&quot;')}">${item.title || '-'}</td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(item.companyTitle || '').replace(/"/g, '&quot;')}">${item.companyTitle || '-'}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(item.summary || '').replace(/"/g, '&quot;')}">${item.summary || '-'}</td>
            <td>${item.category || '-'}</td>
            <td>
                <a href="${item.url || '#'}" target="_blank" class="icon-btn" title="KAP'ta Görüntüle" style="color: var(--primary-color);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>
            </td>
        </tr>
    `).join('');
        }

        // Filter KAP notifications by date
        function filterKapNotifications() {
            const fromVal = kapFromDate?.value;
            const toVal = kapToDate?.value;

            if (!fromVal && !toVal) {
                kapFilteredNotifications = [...kapNotifications];
            } else {
                kapFilteredNotifications = kapNotifications.filter(item => {
                    if (!item.publishDate) return false;

                    // Convert Turkish date format to Date object
                    const parseDate = (dateStr) => {
                        const parts = dateStr.split('.');
                        if (parts.length !== 3) return null;
                        return new Date(parts[2], parts[1] - 1, parts[0]);
                    };

                    const itemDate = parseDate(item.publishDate);
                    if (!itemDate) return false;

                    const from = fromVal ? new Date(fromVal) : null;
                    const to = toVal ? new Date(toVal) : null;

                    // Set to end of day for "to" date
                    if (to) {
                        to.setHours(23, 59, 59, 999);
                    }

                    if (from && to) {
                        return itemDate >= from && itemDate <= to;
                    } else if (from) {
                        return itemDate >= from;
                    } else if (to) {
                        return itemDate <= to;
                    }
                    return true;
                });
            }

            renderKapTable();
        }

        // Clear KAP filters
        function clearKapFilters() {
            initKapDates();
            kapFilteredNotifications = [...kapNotifications];
            renderKapTable();
        }

        // KAP Event Listeners
        if (kapFetchBtn) {
            kapFetchBtn.addEventListener('click', fetchKapData);
        }

        if (kapRefreshBtn) {
            kapRefreshBtn.addEventListener('click', loadKapNotifications);
        }

        if (kapFilterBtn) {
            kapFilterBtn.addEventListener('click', filterKapNotifications);
        }

        if (kapClearFilterBtn) {
            kapClearFilterBtn.addEventListener('click', clearKapFilters);
        }

        // Initialize on load
        initKapDates();
        loadKapNotifications();

        fonPnlChartInstance = new Chart(ctxPnl, {
            type: 'bar',
            data: {
                labels: pnlLabels,
                datasets: [{
                    label: 'Kar/Zarar (₺)',
                    data: pnlValues,
                    backgroundColor: pnlColors,
                    borderColor: pnlColors,
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'x',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${context.parsed.y >= 0 ? '+' : ''}₺${fmtNum(context.parsed.y)}`
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
                            callback: (value) => `₺${fmtNum(value)}`
                        },
                        grid: { color: gridColor },
                        beginAtZero: true
                    }
                }
            }
        });
    }
}
