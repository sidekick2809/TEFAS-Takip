const btn = document.getElementById('fetch-btn');
const btnText = btn.querySelector('.btn-text');
const spinner = btn.querySelector('.loader-spinner');
const tbody = document.getElementById('table-body');
const statusMessage = document.getElementById('status-message');
const globalOverlay = document.getElementById('global-overlay');
const lastUpdateText = document.getElementById('last-update');
const toggleColsBtn = document.getElementById('toggle-cols-btn');
const dataTableContainer = document.getElementById('data-table-container');

toggleColsBtn.addEventListener('click', () => {
    dataTableContainer.classList.toggle('advanced-hidden');
    const isHidden = dataTableContainer.classList.contains('advanced-hidden');
    toggleColsBtn.textContent = isHidden ? 'Detayları Göster' : 'Detayları Gizle';
});

const themeToggleBtn = document.getElementById('theme-toggle');
const iconSun = document.getElementById('theme-icon-sun');
const iconMoon = document.getElementById('theme-icon-moon');

// Tema kontrolü
function updateThemeIcon(isLight) {
    if (isLight) {
        iconMoon.style.display = 'none';
        iconSun.style.display = 'block';
    } else {
        iconSun.style.display = 'none';
        iconMoon.style.display = 'block';
    }
}

// Sayfa yüklendiğinde ikon durumunu ayarla
if (document.documentElement.getAttribute('data-theme') === 'light') {
    updateThemeIcon(true);
}

themeToggleBtn.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
        // Gece (Dark) moda geç
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('tefasTheme', 'dark');
        updateThemeIcon(false);
    } else {
        // Gündüz (Light) moda geç
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('tefasTheme', 'light');
        updateThemeIcon(true);
    }
    // Refresh charts if dashboard is active
    if (typeof renderDashboard === 'function' && document.getElementById('tab-dashboard').classList.contains('active')) {
        renderDashboard();
    }
});

function showLoading() {
    globalOverlay.style.display = 'flex';
}

function hideLoading() {
    globalOverlay.style.display = 'none';
}

let fullData = [];
window.fullData = fullData;
let currentData = [];
let currentSortCol = -1;
let currentSortAsc = true;
let selectedTurs = new Set();
let selectedTurcs = new Set();
let selectedSirkets = new Set();

// Sütun başlıklarına tıklama (sıralama) olayı ekleme
document.querySelectorAll('#data-table thead th').forEach(th => {
    th.addEventListener('click', () => {
        if (currentData.length === 0) return;

        const sortKey = th.dataset.sort;
        if (!sortKey) return;

        const colIndex = parseInt(th.dataset.index);

        if (currentSortCol === colIndex) {
            currentSortAsc = !currentSortAsc;
        } else {
            currentSortCol = colIndex;
            currentSortAsc = false;
            // Text cols or specific ones start with ASC
            if (['code', 'name', 'tur', 'turc', 'sirket', 'tefas'].includes(sortKey)) {
                currentSortAsc = true;
            }
        }

        document.querySelectorAll('#data-table thead th').forEach(el => el.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(currentSortAsc ? 'sort-asc' : 'sort-desc');

        showLoading();
        setTimeout(() => {
            currentData.sort((a, b) => {
                let valA = a[colIndex];
                let valB = b[colIndex];

                if (valA === null || valA === undefined) valA = '';
                if (valB === null || valB === undefined) valB = '';

                if (valA === valB) return 0;

                if (typeof valA === 'string' && typeof valB === 'string') {
                    return currentSortAsc ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
                }

                return currentSortAsc ? (valA > valB ? 1 : -1) : (valA > valB ? -1 : 1);
            });

            renderTable(currentData);
            hideLoading();
        }, 10);
    });
});

function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
}

// --- Export Utility Functions ---
function downloadCSV(data, headers, filename) {
    const csvContent = [
        headers.join(';'),
        ...data.map(row => row.map(val => {
            if (val === null || val === undefined) return '';
            const s = String(val);
            if (s.includes(';') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        }).join(';'))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '.csv';
    link.click();
}

function downloadXLS(data, headers, filename) {
    let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
    <body><table><thead><tr>`;
    headers.forEach(h => { html += `<th style="background-color: #f2f2f2; border: 1px solid #000;">${h}</th>`; });
    html += '</tr></thead><tbody>';
    data.forEach(row => {
        html += '<tr>';
        row.forEach(cell => { html += `<td style="border: 1px solid #000;">${cell ?? ''}</td>`; });
        html += '</tr>';
    });
    html += '</tbody></table></body></html>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '.xls';
    link.click();
}

// --- Export Dropdown Logic ---
document.addEventListener('click', (e) => {
    // Handle Dropdown Toggles
    const trigger = e.target.closest('.export-trigger-btn');
    if (trigger) {
        const dropdown = trigger.closest('.export-dropdown');
        // Close others
        document.querySelectorAll('.export-dropdown.open').forEach(d => {
            if (d !== dropdown) d.classList.remove('open');
        });
        dropdown.classList.toggle('open');
        return;
    }

    // Close on clicking outside or clicking an item
    if (e.target.closest('.export-menu-item') || !e.target.closest('.export-dropdown')) {
        document.querySelectorAll('.export-dropdown.open').forEach(d => d.classList.remove('open'));
    }
});

window.downloadCSV = downloadCSV;
window.downloadXLS = downloadXLS;

// --- Veriler Tab Export Listeners ---
document.getElementById('export-data-csv')?.addEventListener('click', () => {
    const headers = ['KOD', 'UNVAN', '1G %', '1H %', '1AY', '3AY', '6AY', 'YBB', '1YIL', '3YIL', '5YIL', 'TÜR', 'TUR-C', 'ŞİRKET', 'TEFAS', 'FIYAT', 'FIYAT1', 'FIYAT7'];
    const data = currentData.map(row => row.map((val, idx) => {
        if ([2, 3, 4, 5, 6, 7, 8, 9, 10].includes(idx)) return val !== null ? (val * 100).toFixed(2) + '%' : '-';
        return val;
    }));
    downloadCSV(data, headers, 'TEFAS_Veriler_' + new Date().toISOString().split('T')[0]);
});

document.getElementById('export-data-xls')?.addEventListener('click', () => {
    const headers = ['KOD', 'UNVAN', '1G %', '1H %', '1AY', '3AY', '6AY', 'YBB', '1YIL', '3YIL', '5YIL', 'TÜR', 'TUR-C', 'ŞİRKET', 'TEFAS', 'FIYAT', 'FIYAT1', 'FIYAT7'];
    const data = currentData.map(row => row.map((val, idx) => {
        if ([2, 3, 4, 5, 6, 7, 8, 9, 10].includes(idx)) return val !== null ? (val * 100).toFixed(2) + '%' : '-';
        return val;
    }));
    downloadXLS(data, headers, 'TEFAS_Veriler_' + new Date().toISOString().split('T')[0]);
});


function hideStatus() {
    statusMessage.style.display = 'none';
    statusMessage.className = 'status-message';
}

function getFormattedDates() {
    // Check for manual overrides from settings
    const manualDates = localStorage.getItem('tefasManualDates');
    if (manualDates) {
        try {
            const parsed = JSON.parse(manualDates);
            const formatDateStr = (iso) => {
                const [y, m, d] = iso.split('-');
                return `${d}.${m}.${y}`;
            };
            return {
                today: formatDateStr(parsed.today),
                targetDay: formatDateStr(parsed.target),
                sevenDaysAgo: formatDateStr(parsed.seven)
            };
        } catch (e) {
            console.error('Manual dates parse error', e);
        }
    }

    const todayDate = new Date();
    const isMonday = todayDate.getDay() === 1;
    const isSunday = todayDate.getDay() === 0;

    const targetDayDate = new Date(todayDate);
    if (isMonday) targetDayDate.setDate(todayDate.getDate() - 3);
    else if (isSunday) targetDayDate.setDate(todayDate.getDate() - 2);
    else targetDayDate.setDate(todayDate.getDate() - 1);

    const sevenDaysAgoDate = new Date(todayDate);
    sevenDaysAgoDate.setDate(todayDate.getDate() - 7);

    const format = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    };

    return {
        today: format(todayDate),
        sevenDaysAgo: format(sevenDaysAgoDate),
        targetDay: format(targetDayDate)
    };
}

async function getTefasStatusData() {
    const url = '/api/DB/BindComparisonFundReturns';
    const payload1 = 'calismatipi=2&fontip=YAT&sfontur=&kurucukod=&fongrup=&bastarih=Ba%C5%9Flang%C4%B1%C3%A7&bittarih=Biti%C5%9F&fonturkod=&fonunvantip=&strperiod=1%2C1%2C1%2C1%2C1%2C1%2C1&islemdurum=1';
    const payload2 = 'calismatipi=2&fontip=YAT&sfontur=&kurucukod=&fongrup=&bastarih=Ba%C5%9Flang%C4%B1%C3%A7&bittarih=Biti%C5%9F&fonturkod=&fonunvantip=&strperiod=1%2C1%2C1%2C1%2C1%2C1%2C1&islemdurum=0';

    const req1 = fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload1 }).then(res => res.json());
    const req2 = fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload2 }).then(res => res.json());

    const [res1, res2] = await Promise.all([req1, req2]);
    const statusMap = new Map();

    if (res1 && res1.data) res1.data.forEach(item => statusMap.set(item.FONKODU, 'EVET'));
    if (res2 && res2.data) res2.data.forEach(item => statusMap.set(item.FONKODU, 'HAYIR'));

    return statusMap;
}

async function fetchTefasData() {
    hideStatus();
    btn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'block';

    try {
        const tefasStatusMap = await getTefasStatusData();
        const { today, sevenDaysAgo, targetDay } = getFormattedDates();

        const baseUrl = '/api/DB/';
        const payloads = [
            { url: baseUrl + 'BindHistoryInfo', body: `fontip=YAT&sfontur=&fonkod=&fongrup=&bastarih=${today}&bittarih=${today}&fontkod=&fonunvantip=&kurucukod=` },
            { url: baseUrl + 'BindHistoryInfo', body: `fontip=YAT&sfontur=&fonkod=&fongrup=&bastarih=${sevenDaysAgo}&bittarih=${sevenDaysAgo}&fontkod=&fonunvantip=&kurucukod=` },
            { url: baseUrl + 'BindHistoryInfo', body: `fontip=YAT&sfontur=&fonkod=&fongrup=&bastarih=${targetDay}&bittarih=${targetDay}&fontkod=&fonunvantip=&kurucukod=` },
            { url: baseUrl + 'BindComparisonFundReturns', body: `calismatipi=2&fontip=YAT&sfontur=&kurucukod=&fongrup=&bastarih=${today}&bittarih=${today}&fontkod=&fonunvantip=&strperiod=1,1,1,1,1,1,1&islemdurum=` }
        ];

        const responses = await Promise.all(payloads.map(req =>
            fetch(req.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: req.body
            }).then(r => r.json()).catch(e => { console.error('Fetch error for', req.url, e); return { data: [] }; })
        ));

        const todayData = responses[0].data || [];
        const sevenDaysAgoData = responses[1].data || [];
        const yesterdayData = responses[2].data || [];
        const returnsData = responses[3].data || [];

        console.log(`TEFAS Response Sizes: today=${todayData.length}, yesterday=${yesterdayData.length}, 7days=${sevenDaysAgoData.length}, returns=${returnsData.length}`);

        let finalData = processAndMergeData(todayData, sevenDaysAgoData, yesterdayData, returnsData, tefasStatusMap);

        if (finalData.length === 0) {
            console.warn("Merge resulted in 0 items. Checking if any data was returned at all.");
            if (todayData.length === 0 && yesterdayData.length === 0) {
                throw new Error("TEFAS'tan hiçbir temel veri alınamadı. Proxy veya TEFAS servisi geçici olarak kapalı olabilir.");
            }
        }

        // Mark all current fullData as stale (index 18)
        fullData.forEach(row => { row[18] = true; });

        // Merge finalData into fullData
        finalData.forEach(newRow => {
            const existingIndex = fullData.findIndex(r => r[0] === newRow[0]);
            newRow[18] = false; // Fresh data
            if (existingIndex > -1) {
                fullData[existingIndex] = newRow;
            } else {
                fullData.push(newRow);
            }
        });

        fullData.sort((a, b) => a[14].localeCompare(b[14]));

        localStorage.setItem('tefasData', JSON.stringify(fullData));

        initFilters();
        applyFilters();

        // Notify other modules (portfolio)
        window.fullData = fullData;
        document.dispatchEvent(new CustomEvent('tefas-data-updated'));

        // Reset sort UI
        document.querySelectorAll('th').forEach(el => el.classList.remove('sort-asc', 'sort-desc'));

        // Tarih Saati Güncelleme (dd.MM.yyyy HH:mm)
        const now = new Date();
        const formattedDate =
            String(now.getDate()).padStart(2, '0') + '.' +
            String(now.getMonth() + 1).padStart(2, '0') + '.' +
            String(now.getFullYear()).slice(-2) + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');
        const updateStr = "Son Güncelleme: " + formattedDate;

        lastUpdateText.textContent = updateStr;
        localStorage.setItem('tefasLastUpdate', updateStr);

        showStatus(`TEFAS verileri başarıyla güncellendi. Toplam ${fullData.length} fon çekildi.`);

    } catch (error) {
        console.error(error);
        showStatus('Veri alınırken bir hata oluştu: ' + error.message, true);
    } finally {
        btn.disabled = false;
        btnText.style.display = 'block';
        spinner.style.display = 'none';
    }
}

function processAndMergeData(todayData, sevenDaysAgoData, yesterdayData, returnsData, tefasStatusMap) {
    const dataMap = new Map();

    // Base set of all fund codes from all data sources
    const allFundCodes = new Set([
        ...todayData.map(d => d.FONKODU),
        ...yesterdayData.map(d => d.FONKODU),
        ...returnsData.map(d => d.FONKODU)
    ]);

    allFundCodes.forEach(kod => {
        const t = todayData.find(d => d.FONKODU === kod);
        const y = yesterdayData.find(d => d.FONKODU === kod);
        const r = returnsData.find(d => d.FONKODU === kod);
        const s = sevenDaysAgoData.find(d => d.FONKODU === kod);

        // Fallback: If today's data is missing, use yesterday's data as the "current" price
        const priceToday = t ? t.FIYAT : (y ? y.FIYAT : 0);
        // If we used yesterday's price as today's, we have no "previous" price in this dataset easily
        // But for the sake of showing the list, we'll try to keep at least one price.
        const priceYesterday = y ? y.FIYAT : (t ? t.FIYAT : 0);

        dataMap.set(kod, {
            ...(t || y || r),
            FIYAT_Today: priceToday,
            FIYAT_yesterday: priceYesterday,
            FIYAT_SevenDaysAgo: s ? s.FIYAT : 0
        });

        if (r) {
            Object.assign(dataMap.get(kod), r);
        }
    });

    const finalData = [];
    for (const item of dataMap.values()) {
        // We need at least a fund name and code
        if (!item.FONUNVAN || !item.FONKODU) continue;

        // Skip if we don't have any price information at all
        if (!item.FIYAT_Today && !item.FIYAT_yesterday) {
            continue;
        }
        if (item.FONUNVAN && item.FONUNVAN.includes("OKS ")) {
            continue;
        }

        const gunYuzde = (item.FIYAT_Today && item.FIYAT_yesterday) ? (item.FIYAT_Today - item.FIYAT_yesterday) / item.FIYAT_yesterday : 0;
        const haftaYuzde = (item.FIYAT_Today && item.FIYAT_SevenDaysAgo) ? (item.FIYAT_Today - item.FIYAT_SevenDaysAgo) / item.FIYAT_SevenDaysAgo : null;

        let sirket = "";
        if (item.FONUNVAN) {
            if (item.FONUNVAN.includes("HSBC")) sirket = "HSBC";
            else sirket = item.FONUNVAN.split("PORTFÖY")[0].trim();
            sirket = sirket.split("PYŞ")[0].trim();
        }

        let turC = "";
        if (item.FONUNVAN) {
            if (item.FONUNVAN.includes("ALTIN ")) turC = "ALTIN";
            else if (item.FONUNVAN.includes("YABANCI")) turC = "YABANCI";
            else if (item.FONUNVAN.includes("MADEN")) turC = "MADEN";
            else if (item.FONUNVAN.includes("GÜMÜŞ")) turC = "GÜMÜŞ";
            else if (item.FONUNVAN.includes("BANKA")) turC = "BANKA";
        }

        const tefasStatus = tefasStatusMap.get(item.FONKODU) || "Bilinmiyor";

        finalData.push([
            item.FONKODU,
            item.FONUNVAN,
            gunYuzde,
            haftaYuzde,
            (item.GETIRI1A || 0) / 100,
            (item.GETIRI3A || 0) / 100,
            (item.GETIRI6A || 0) / 100,
            (item.GETIRIYB || 0) / 100,
            (item.GETIRI1Y || 0) / 100,
            (item.GETIRI3Y || 0) / 100,
            (item.GETIRI5Y || 0) / 100,
            item.FONTURACIKLAMA,
            turC,
            sirket,
            tefasStatus,
            item.FIYAT_Today,
            item.FIYAT_yesterday,
            item.FIYAT_SevenDaysAgo
        ]);
    }
    return finalData;
}

function formatPercent(val) {
    if (val === null || val === undefined) return '-';
    const num = val * 100;
    const str = num.toFixed(2) + '%';
    let cssClass = 'val-zero';
    if (num > 0.005) cssClass = 'val-up';
    else if (num < -0.005) cssClass = 'val-down';

    return `<span class="${cssClass}">${num > 0 ? '+' : ''}${str}</span>`;
}

function formatPrice(val) {
    if (val === null || val === undefined) return '-';
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function renderTable(data) {
    tbody.innerHTML = '';

    if (data.length === 0) {
        // There might not be data for 'today' if markets are closed or data isn't published yet
        tbody.innerHTML = '<tr><td colspan="18" class="empty-state">Veri bulunamadı. Lütfen daha sonra tekrar deneyin veya işlem saatlerini kontrol edin.</td></tr>';
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');
        if (row[18]) {
            tr.classList.add('stale-row');
        }

        tr.innerHTML = `
      <td>
        <a href="https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${row[0]}" target="_blank" class="fund-link">
          <strong>${row[0]}</strong>
        </a>
      </td>
      <td class="has-tooltip" data-tooltip="${row[1]}">
        <div class="wrap-text unvan-text">${row[1]}</div>
      </td>
      <td>${formatPercent(row[2])}</td>
      <td>${formatPercent(row[3])}</td>
      <td>${formatPercent(row[4])}</td>
      <td>${formatPercent(row[5])}</td>
      <td>${formatPercent(row[6])}</td>
      <td>${formatPercent(row[7])}</td>
      <td>${formatPercent(row[8])}</td>
      <td>${formatPercent(row[9])}</td>
      <td>${formatPercent(row[10])}</td>
      <td><div class="wrap-text tur-text">${row[11]}</div></td>
      <td class="advanced-hidden">${row[12]}</td>
      <td class="advanced-hidden">${row[13]}</td>
      <td class="advanced-hidden">${row[14] === 'EVET' ? '<span class="status-success" style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:0.75rem;">AÇIK</span>' : '<span class="status-error" style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:0.75rem;">KAPALI</span>'}</td>
      <td class="advanced-hidden">${formatPrice(row[15])}</td>
      <td class="advanced-hidden">${formatPrice(row[16])}</td>
      <td class="advanced-hidden">${formatPrice(row[17])}</td>
    `;
        tbody.appendChild(tr);
    });
}

btn.addEventListener('click', fetchTefasData);

// Sayfa yüklendiğinde daha önce kaydedilmiş verileri geri yükle
window.addEventListener('DOMContentLoaded', () => {
    const savedData = localStorage.getItem('tefasData');
    const savedUpdate = localStorage.getItem('tefasLastUpdate');

    if (savedUpdate) {
        lastUpdateText.textContent = savedUpdate;
    }

    if (savedData) {
        try {
            fullData = JSON.parse(savedData);
            if (fullData && fullData.length > 0) {
                window.fullData = fullData;
                initFilters();
                applyFilters();
                document.dispatchEvent(new CustomEvent('tefas-data-updated'));
            }
        } catch (error) {
            console.error('Yerel veritabanı okunurken bir hata oluştu:', error);
        }
    }
});

// --- Filtreleme Mantığı ---
const btnApplyFilters = document.getElementById('apply-filter-btn');
const btnResetFilters = document.getElementById('reset-filter-btn');
const tefasStatusFilter = document.getElementById('tefas-status-filter');

function setupDropdownEvents(selectId) {
    const selectEl = document.getElementById(selectId);
    const trigger = selectEl.querySelector('.multi-select-trigger');
    trigger.addEventListener('click', () => {
        selectEl.classList.toggle('open');
    });
    return selectEl;
}

const turSelect = setupDropdownEvents('tur-select');
const turcSelect = setupDropdownEvents('turc-select');
const sirketSelect = setupDropdownEvents('sirket-select');

// Dışarı tıklayınca dropdown kapanması
document.addEventListener('click', (e) => {
    if (!turSelect.contains(e.target) && !turcSelect.contains(e.target) && !sirketSelect.contains(e.target) && e.target !== btnApplyFilters && e.target !== btnResetFilters) {
        turSelect.classList.remove('open');
        turcSelect.classList.remove('open');
        sirketSelect.classList.remove('open');
    }
});

function initFilterDropdown(dataIndex, optionsContainerId, textElementId, selectedSet) {
    const values = new Set();
    fullData.forEach(row => {
        if (row[dataIndex] !== undefined && row[dataIndex] !== null) {
            values.add(row[dataIndex]);
        }
    });

    const sortedValues = Array.from(values).sort();
    const container = document.getElementById(optionsContainerId);
    container.innerHTML = '';
    selectedSet.clear();
    sortedValues.forEach(v => selectedSet.add(v));

    // Select All / Deselect All Toggle button
    const toggleAllDiv = document.createElement('div');
    toggleAllDiv.className = 'option-item toggle-all-item';
    toggleAllDiv.style.fontWeight = 'bold';
    toggleAllDiv.style.borderBottom = '1px solid var(--border-color)';
    toggleAllDiv.style.marginBottom = '0.2rem';
    toggleAllDiv.innerHTML = `
        <span style="pointer-events: none;">Tümünü Seç / Kaldır</span>
    `;

    toggleAllDiv.addEventListener('click', (e) => {
        // Stop propagation to avoid unexpected behavior
        e.stopPropagation();

        // check if all are currently selected
        const allSelected = selectedSet.size === sortedValues.length;

        if (allSelected) {
            // Deselect all
            selectedSet.clear();
            const checkboxes = container.querySelectorAll('.option-item:not(.toggle-all-item) input');
            checkboxes.forEach(cb => cb.checked = false);
        } else {
            // Select all
            sortedValues.forEach(v => selectedSet.add(v));
            const checkboxes = container.querySelectorAll('.option-item:not(.toggle-all-item) input');
            checkboxes.forEach(cb => cb.checked = true);
        }
        updateFilterText(selectedSet, sortedValues.length, document.getElementById(textElementId));
    });

    container.appendChild(toggleAllDiv);

    sortedValues.forEach(val => {
        const displayVal = val === "" ? "Belirsiz" : val;
        const div = document.createElement('div');
        div.className = 'option-item';
        div.innerHTML = `
            <input type="checkbox" value="${val}" checked>
            <span>${displayVal}</span>
        `;
        div.addEventListener('click', (e) => {
            const checkbox = div.querySelector('input');
            checkbox.checked = !checkbox.checked;
            if (checkbox.checked) selectedSet.add(val);
            else selectedSet.delete(val);
            updateFilterText(selectedSet, sortedValues.length, document.getElementById(textElementId));
        });
        container.appendChild(div);
    });

    updateFilterText(selectedSet, sortedValues.length, document.getElementById(textElementId));
}

function initFilters() {
    initFilterDropdown(11, 'tur-options', 'tur-select', selectedTurs);
    initFilterDropdown(12, 'turc-options', 'turc-select', selectedTurcs);
    initFilterDropdown(13, 'sirket-options', 'sirket-select', selectedSirkets);
}

function updateFilterText(selectedSet, totalCount, selectContainer) {
    const textElement = selectContainer.querySelector('.multi-select-text');
    if (selectedSet.size === totalCount) {
        textElement.textContent = "Tümü Seçili";
    } else if (selectedSet.size === 0) {
        textElement.textContent = "Hiçbiri Seçili Değil";
    } else {
        textElement.textContent = `${selectedSet.size} seçildi`;
    }
}

function applyFilters() {
    const statusVal = tefasStatusFilter.value;

    currentData = fullData.filter(row => {
        const rowTur = row[11] !== undefined && row[11] !== null ? row[11] : "";
        const rowTurc = row[12] !== undefined && row[12] !== null ? row[12] : "";
        const rowSirket = row[13] !== undefined && row[13] !== null ? row[13] : "";

        const matchesTur = selectedTurs.has(rowTur);
        const matchesTurc = selectedTurcs.has(rowTurc);
        const matchesSirket = selectedSirkets.has(rowSirket);

        let matchesStatus = false;
        if (statusVal === 'ALL') {
            matchesStatus = true;
        } else if (statusVal === 'EVET' && row[14] === 'EVET') {
            matchesStatus = true;
        } else if (statusVal === 'HAYIR' && row[14] !== 'EVET') {
            matchesStatus = true;
        }

        return matchesTur && matchesTurc && matchesSirket && matchesStatus;
    });

    renderTable(currentData);
}

// Buton Olayları
btnApplyFilters.addEventListener('click', () => {
    turSelect.classList.remove('open');
    turcSelect.classList.remove('open');
    sirketSelect.classList.remove('open');
    showLoading();
    setTimeout(() => {
        applyFilters();
        hideLoading();
    }, 10);
});

btnResetFilters.addEventListener('click', () => {
    turSelect.classList.remove('open');
    turcSelect.classList.remove('open');
    sirketSelect.classList.remove('open');
    showLoading();
    setTimeout(() => {
        function resetGroup(optionsSelector, selectedSet, containerId) {
            const checkboxes = document.querySelectorAll(optionsSelector);
            checkboxes.forEach(cb => {
                cb.checked = true;
                selectedSet.add(cb.value);
            });
            updateFilterText(selectedSet, checkboxes.length, document.getElementById(containerId));
        }

        resetGroup('#tur-options .option-item input', selectedTurs, 'tur-select');
        resetGroup('#turc-options .option-item input', selectedTurcs, 'turc-select');
        resetGroup('#sirket-options .option-item input', selectedSirkets, 'sirket-select');

        // TEFAS Durumu sıfırlama - varsayılan olarak İşleme Açık (EVET) olmalı
        tefasStatusFilter.value = 'EVET';

        applyFilters();
        hideLoading();
    }, 10);
});

// --- Global Tooltip Mantığı ---
const globalTooltip = document.createElement('div');
globalTooltip.className = 'global-tooltip';
document.body.appendChild(globalTooltip);

document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('.has-tooltip');
    if (el) {
        const text = el.getAttribute('data-tooltip');
        if (text) {
            globalTooltip.textContent = text;
            globalTooltip.classList.add('visible');

            const rect = el.getBoundingClientRect();
            // Ortala ve hedef elemanın biraz üzerine veya altına yerleştir
            globalTooltip.style.left = (rect.left + rect.width / 2) + 'px';
            globalTooltip.style.top = (rect.bottom + 10) + 'px';
        }
    }
});

document.addEventListener('mouseout', (e) => {
    if (e.target.closest('.has-tooltip')) {
        globalTooltip.classList.remove('visible');
    }
});

// --- Settings Modal Logic ---
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');

const inputToday = document.getElementById('setting-today');
const inputTarget = document.getElementById('setting-target');
const inputSeven = document.getElementById('setting-seven');

settingsBtn.addEventListener('click', () => {
    // Pre-fill with existing overrides or current calculation
    const current = getFormattedDates();
    const toIso = (dotStr) => {
        if (!dotStr || dotStr === '-') return '';
        const [d, m, y] = dotStr.split('.');
        return `${y}-${m}-${d}`;
    };

    inputToday.value = toIso(current.today);
    inputTarget.value = toIso(current.targetDay);
    inputSeven.value = toIso(current.sevenDaysAgo);

    settingsModal.style.display = 'flex';
});

settingsCloseBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

settingsSaveBtn.addEventListener('click', () => {
    const dates = {
        today: inputToday.value,
        target: inputTarget.value,
        seven: inputSeven.value
    };

    if (!dates.today || !dates.target || !dates.seven) {
        alert('Lütfen tüm tarihleri seçin.');
        return;
    }

    localStorage.setItem('tefasManualDates', JSON.stringify(dates));
    settingsModal.style.display = 'none';
    showStatus('Tarih ayarları kaydedildi. Yeni tarihlerle veri çekmek için "Verileri Güncelle" butonuna basın.');
});
