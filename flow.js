// flow.js handles the Para Akışı tab calculations and rendering
const flowBody = document.getElementById('flow-body');
const refreshFlowBtn = document.getElementById('refresh-flow-btn');
const flowSettingsBtn = document.getElementById('flow-settings-btn');
const flowSettingsModal = document.getElementById('flow-settings-modal');
const flowSettingsSaveBtn = document.getElementById('flow-settings-save-btn');
const flowSettingsCloseBtn = document.getElementById('flow-settings-close-btn');

const settingTodayInput = document.getElementById('flow-setting-today');
const settingYesterdayInput = document.getElementById('flow-setting-yesterday');

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

        localStorage.setItem('tefasFlowData', JSON.stringify(results));
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

    // Sort results by code alphabetically
    results.sort((a, b) => a.code.localeCompare(b.code));

    results.forEach(item => {
        const liveRow = fullData.find(r => r[0] === item.code);
        const gunYuzde = liveRow ? liveRow[2] : null;

        const netAkis = item.today - (item.yesterday * (1 + (gunYuzde || 0)));

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
            <td>${formatPercent(gunYuzde)}</td>
            <td class="${netAkis > 1 ? 'val-up' : netAkis < -1 ? 'val-down' : 'val-zero'}">
                ${netAkis > 0 ? '+' : ''}${netAkis.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </td>
        `;
        flowBody.appendChild(tr);
    });
}

// Export for transactions.js tab switching
window.renderFlow = function () {
    const saved = localStorage.getItem('tefasFlowData');
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
        alert('Tarih ayarları kaydedildi. Verileri güncelle butonuna basarak yeni tarihlerle veri çekebilirsiniz.');
    });
}

window.addEventListener('DOMContentLoaded', () => {
    window.renderFlow();
});
