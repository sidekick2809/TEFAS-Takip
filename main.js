/**
 * TefasDataView class manages the data, filters, and rendering for a specific TEFAS view (YAT or EMK).
 */
class TefasDataView {
    constructor(config) {
        this.fontip = config.fontip;
        this.prefix = config.prefix; // '' for YAT, 'bes' for EMK
        this.storageKey = config.storageKey;
        this.lastUpdateKey = config.lastUpdateKey;

        // Core Elements
        this.btn = document.getElementById(config.btnId);
        this.btnIcon = this.btn?.querySelector('.btn-icon');
        this.spinner = this.btn?.querySelector('.loader-spinner');
        this.tbody = document.getElementById(config.tbodyId);
        this.lastUpdateText = document.getElementById(config.lastUpdateId);
        this.toggleColsBtn = document.getElementById(config.toggleColsBtnId);
        this.dataTableContainer = document.getElementById(config.dataTableContainerId);
        this.table = document.getElementById(config.tableId);

        // Filter Elements
        this.btnApplyFilters = document.getElementById(config.applyFilterBtnId);
        this.btnResetFilters = document.getElementById(config.resetFilterBtnId);
        this.tefasStatusFilter = document.getElementById(config.tefasStatusFilterId);
        this.turSelect = document.getElementById(config.turSelectId);
        this.turcSelect = document.getElementById(config.turcSelectId);
        this.sirketSelect = document.getElementById(config.sirketSelectId);
        this.searchInput = document.getElementById(config.searchInputId);

        // Favorites
        this.favorites = new Set();
        this.favFilterActive = false;
        this.favFilterBtn = document.getElementById(config.favFilterBtnId || (this.prefix ? 'fav-filter-btn-' + this.prefix : 'fav-filter-btn'));

        // State
        this.fullData = [];
        this.currentData = [];
        this.currentSortCol = -1;
        this.currentSortAsc = true;
        this.selectedTurs = new Set();
        this.selectedTurcs = new Set();
        this.selectedSirkets = new Set();
        this.searchTerm = '';

        this.init();
    }

    init() {
        // Fetch button
        this.btn?.addEventListener('click', () => this.fetchTefasData());

        // Toggle Details button
        this.toggleColsBtn?.addEventListener('click', () => {
            this.dataTableContainer.classList.toggle('advanced-hidden');
            const isHidden = this.dataTableContainer.classList.contains('advanced-hidden');
            this.toggleColsBtn.setAttribute('data-tooltip', isHidden ? 'Detayları Göster' : 'Detayları Gizle');
        });

        // Sortable headers
        this.table?.querySelectorAll('thead th').forEach(th => {
            th.addEventListener('click', () => this.handleSort(th));
        });

        // Filter Dropdowns
        if (this.turSelect) this.setupDropdownEvents(this.turSelect);
        if (this.turcSelect) this.setupDropdownEvents(this.turcSelect);
        if (this.sirketSelect) this.setupDropdownEvents(this.sirketSelect);

        // Filter Apply/Reset
        this.btnApplyFilters?.addEventListener('click', () => {
            this.closeAllDropdowns();
            showLoading();
            setTimeout(() => {
                this.applyFilters();
                hideLoading();
            }, 10);
        });

        this.btnResetFilters?.addEventListener('click', () => {
            this.closeAllDropdowns();
            showLoading();
            setTimeout(() => {
                this.resetFilters();
                hideLoading();
            }, 10);
        });

        // Export Listeners
        document.getElementById(`export-data-csv${this.prefix ? '-' + this.prefix : ''}`)?.addEventListener('click', () => this.exportData('csv'));
        document.getElementById(`export-data-xls${this.prefix ? '-' + this.prefix : ''}`)?.addEventListener('click', () => this.exportData('xls'));

        // Search input
        this.searchInput?.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.applyFilters();
        });

        // Load favorites from server
        this.loadFavorites();

        // Favorite filter button
        this.favFilterBtn?.addEventListener('click', () => {
            this.favFilterActive = !this.favFilterActive;
            this.favFilterBtn?.classList.toggle('active', this.favFilterActive);
            this.applyFilters();
        });

        // Local Storage Load
        this.loadFromStorage();
    }

    setupDropdownEvents(selectEl) {
        const trigger = selectEl.querySelector('.multi-select-trigger');
        trigger.addEventListener('click', () => {
            selectEl.classList.toggle('open');
        });
    }

    closeAllDropdowns() {
        this.turSelect?.classList.remove('open');
        this.turcSelect?.classList.remove('open');
        this.sirketSelect?.classList.remove('open');
    }

    async loadFavorites() {
        try {
            const response = await fetch('/api/favorites');
            if (response.ok) {
                const codes = await response.json();
                this.favorites = new Set(codes);
            }
        } catch (err) {
            console.error('Favoriler yüklenemedi:', err);
        }
    }

    async toggleFavorite(code) {
        const isFavorite = this.favorites.has(code);
        try {
            if (isFavorite) {
                await fetch(`/api/favorites?code=${encodeURIComponent(code)}`, { method: 'DELETE' });
                this.favorites.delete(code);
            } else {
                await fetch('/api/favorites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                this.favorites.add(code);
            }
            // Re-apply filters if favorite filter is active
            if (this.favFilterActive) {
                this.applyFilters();
            } else {
                // Just re-render to update heart icons
                this.renderTable(this.currentData);
            }
        } catch (err) {
            console.error('Favori güncellenemedi:', err);
        }
    }

    async loadFromStorage() {
        // Try to load from server first
        try {
            const response = await fetch('/api/tefas-data?type=' + this.fontip);
            if (response.ok) {
                const result = await response.json();
                if (result.data && result.data.length > 0) {
                    this.fullData = result.data;
                    if (result.updatedAt && this.lastUpdateText) {
                        this.lastUpdateText.textContent = "Son Güncelleme: " + result.updatedAt.replace('T', ' ').slice(0, 16);
                    }
                    // Store for portfolio/flow access
                    if (this.fontip === 'YAT') {
                        window.fullData = this.fullData;
                    } else if (this.fontip === 'EMK') {
                        window.besData = this.fullData;
                    }
                    this.initFilters();
                    this.applyFilters();
                    if (this.fontip === 'YAT') {
                        document.dispatchEvent(new CustomEvent('tefas-data-updated'));
                    }
                    // Also save to localStorage for offline access
                    localStorage.setItem(this.storageKey, JSON.stringify(this.fullData));
                    return;
                }
            }
        } catch (error) {
            console.log(`Sunucudan veri alınamadı (${this.prefix}), yerel storage kullanılıyor:`, error.message);
        }

        // Fallback to localStorage
        const savedData = localStorage.getItem(this.storageKey);
        const savedUpdate = localStorage.getItem(this.lastUpdateKey);

        if (savedUpdate && this.lastUpdateText) {
            this.lastUpdateText.textContent = savedUpdate;
        }

        if (savedData) {
            try {
                this.fullData = JSON.parse(savedData);
                if (this.fullData && this.fullData.length > 0) {
                    // Store for portfolio/flow access
                    if (this.fontip === 'YAT') {
                        window.fullData = this.fullData;
                    } else if (this.fontip === 'EMK') {
                        window.besData = this.fullData;
                    }
                    this.initFilters();
                    this.applyFilters();
                    if (this.fontip === 'YAT') {
                        document.dispatchEvent(new CustomEvent('tefas-data-updated'));
                    }
                }
            } catch (error) {
                console.error(`Yerel veritabanı okunurken hata (${this.prefix}):`, error);
            }
        }
    }

    async fetchTefasData() {
        hideStatus();
        if (this.btn) this.btn.disabled = true;
        if (this.btnIcon) this.btnIcon.style.display = 'none';
        if (this.spinner) this.spinner.style.display = 'block';

        try {
            const tefasStatusMap = await this.getTefasStatusData();
            const { today, sevenDaysAgo, targetDay } = getFormattedDates();

            const baseUrl = '/api/DB/';
            const payloads = [
                { url: baseUrl + 'BindHistoryInfo', body: `fontip=${this.fontip}&sfontur=&fonkod=&fongrup=&bastarih=${today}&bittarih=${today}&fontkod=&fonunvantip=&kurucukod=` },
                { url: baseUrl + 'BindHistoryInfo', body: `fontip=${this.fontip}&sfontur=&fonkod=&fongrup=&bastarih=${sevenDaysAgo}&bittarih=${sevenDaysAgo}&fontkod=&fonunvantip=&kurucukod=` },
                { url: baseUrl + 'BindHistoryInfo', body: `fontip=${this.fontip}&sfontur=&fonkod=&fongrup=&bastarih=${targetDay}&bittarih=${targetDay}&fontkod=&fonunvantip=&kurucukod=` },
                { url: baseUrl + 'BindComparisonFundReturns', body: `calismatipi=2&fontip=${this.fontip}&sfontur=&kurucukod=&fongrup=&bastarih=${today}&bittarih=${today}&fontkod=&fonunvantip=&strperiod=1,1,1,1,1,1,1&islemdurum=` }
            ];

            const responses = await Promise.all(payloads.map(req =>
                fetch(req.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: req.body
                }).then(r => r.json()).catch(e => { console.error('Fetch error for', req.url, e); return { data: [] }; })
            ));

            const todayData = responses[0].data || [];
            const sevenDaysAgoData = responses[1].data || [];
            const yesterdayData = responses[2].data || [];
            const returnsData = responses[3].data || [];

            console.log(`TEFAS ${this.fontip} Response: today=${todayData.length}, yesterday=${yesterdayData.length}, 7days=${sevenDaysAgoData.length}, returns=${returnsData.length}`);

            let finalData = this.processAndMergeData(todayData, sevenDaysAgoData, yesterdayData, returnsData, tefasStatusMap);

            if (finalData.length === 0) {
                if (todayData.length === 0 && yesterdayData.length === 0) {
                    throw new Error("TEFAS'tan veriler alınamadı.");
                }
            }

            // Mark old as stale
            this.fullData.forEach(row => { row[18] = true; });

            finalData.forEach(newRow => {
                const existingIndex = this.fullData.findIndex(r => r[0] === newRow[0]);
                newRow[18] = false;
                if (existingIndex > -1) this.fullData[existingIndex] = newRow;
                else this.fullData.push(newRow);
            });

            this.fullData.sort((a, b) => a[14].localeCompare(b[14]));
            localStorage.setItem(this.storageKey, JSON.stringify(this.fullData));

            // Also save to server database
            try {
                await fetch('/api/tefas-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: this.fullData, type: this.fontip })
                });
            } catch (err) {
                console.log('Sunucuya veri kaydedilemedi:', err.message);
            }

            if (this.fontip === 'YAT') {
                window.fullData = this.fullData;
                document.dispatchEvent(new CustomEvent('tefas-data-updated'));
            }

            this.initFilters();
            this.applyFilters();

            // Clear sort UI
            this.table.querySelectorAll('th').forEach(el => el.classList.remove('sort-asc', 'sort-desc'));

            // Update timestamp
            const now = new Date();
            const formattedDate =
                String(now.getDate()).padStart(2, '0') + '.' +
                String(now.getMonth() + 1).padStart(2, '0') + '.' +
                String(now.getFullYear()).slice(-2) + ' ' +
                String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0');
            const updateStr = "Son Güncelleme: " + formattedDate;

            if (this.lastUpdateText) this.lastUpdateText.textContent = updateStr;
            localStorage.setItem(this.lastUpdateKey, updateStr);

            showStatus(`TEFAS ${this.fontip} verileri güncellendi. (${this.fullData.length} fon)`);

        } catch (error) {
            console.error(error);
            showStatus(`Veri alınırken hata (${this.fontip}): ` + error.message, true);
        } finally {
            if (this.btn) this.btn.disabled = false;
            if (this.btnIcon) this.btnIcon.style.display = 'block';
            if (this.spinner) this.spinner.style.display = 'none';
        }
    }

    async getTefasStatusData() {
        const url = '/api/DB/BindComparisonFundReturns';
        const payload1 = `calismatipi=2&fontip=${this.fontip}&sfontur=&kurucukod=&fongrup=&bastarih=Ba%C5%9Flang%C4%B1%C3%A7&bittarih=Biti%C5%9F&fonturkod=&fonunvantip=&strperiod=1%2C1%2C1%2C1%2C1%2C1%2C1&islemdurum=1`;
        const payload2 = `calismatipi=2&fontip=${this.fontip}&sfontur=&kurucukod=&fongrup=&bastarih=Ba%C5%9Flang%C4%B1%C3%A7&bittarih=Biti%C5%9F&fonturkod=&fonunvantip=&strperiod=1%2C1%2C1%2C1%2C1%2C1%2C1&islemdurum=0`;

        const req1 = fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload1 }).then(res => res.json());
        const req2 = fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload2 }).then(res => res.json());

        const [res1, res2] = await Promise.all([req1, req2]);
        const statusMap = new Map();

        if (res1 && res1.data) res1.data.forEach(item => statusMap.set(item.FONKODU, 'EVET'));
        if (res2 && res2.data) res2.data.forEach(item => statusMap.set(item.FONKODU, 'HAYIR'));

        return statusMap;
    }

    processAndMergeData(todayData, sevenDaysAgoData, yesterdayData, returnsData, tefasStatusMap) {
        const dataMap = new Map();
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

            const priceToday = t ? t.FIYAT : (y ? y.FIYAT : 0);
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
            if (!item.FONUNVAN || !item.FONKODU) continue;
            if (!item.FIYAT_Today && !item.FIYAT_yesterday) continue;
            if (item.FONUNVAN && item.FONUNVAN.includes("OKS ")) continue;

            const gunYuzde = (item.FIYAT_Today && item.FIYAT_yesterday) ? (item.FIYAT_Today - item.FIYAT_yesterday) / item.FIYAT_yesterday : 0;
            const haftaYuzde = (item.FIYAT_Today && item.FIYAT_SevenDaysAgo) ? (item.FIYAT_Today - item.FIYAT_SevenDaysAgo) / item.FIYAT_SevenDaysAgo : null;

            let sirket = "";
            if (item.FONUNVAN) {
                if (this.fontip === 'EMK') {
                    if (item.FONUNVAN.includes("VE EMEKLİLİK")) sirket = item.FONUNVAN.split("VE EMEKLİLİK")[0].trim();
                    else if (item.FONUNVAN.includes("EMEKLİLİK")) sirket = item.FONUNVAN.split("EMEKLİLİK")[0].trim();
                    else sirket = item.FONUNVAN.split(" ")[0].trim(); // Fallback for BES
                } else {
                    if (item.FONUNVAN.includes("HSBC")) sirket = "HSBC";
                    else sirket = item.FONUNVAN.split("PORTFÖY")[0].trim();
                    sirket = sirket.split("PYŞ")[0].trim();
                }
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

    renderTable(data) {
        if (!this.tbody) return;
        this.tbody.innerHTML = '';

        if (data.length === 0) {
            this.tbody.innerHTML = '<tr><td colspan="18" class="empty-state">Veri bulunamadı.</td></tr>';
            return;
        }

        data.forEach(row => {
            const tr = document.createElement('tr');
            if (row[18]) tr.classList.add('stale-row');

            const code = row[0];
            const isFavorite = this.favorites.has(code);
            const heartIcon = isFavorite
                ? '<svg class="fav-icon favorited" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>'
                : '<svg class="fav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';

            const trophy1H = (typeof row[3] === 'number' && row[3] > 0.05) ? ' <span class="trophy-icon" title="Haftanın Şampiyonları">🏆</span>' : '';
            tr.innerHTML = `
                <td class="fav-col">
                    <button class="fav-btn" data-code="${code}" title="Favorilere Ekle/Çıkar">
                        ${heartIcon}
                    </button>
                </td>
                <td class="has-tooltip" data-tooltip="${row[1]}">
                    <a href="https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${row[0]}" target="_blank" class="fund-link"><strong>${row[0]}</strong>${trophy1H}</a>
                    <div class="wrap-text unvan-text fund-name-sub">${row[1]}</div>
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

            // Add click handler for favorite button
            const favBtn = tr.querySelector('.fav-btn');
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(code);
            });

            this.tbody.appendChild(tr);
        });
    }

    handleSort(th) {
        if (this.currentData.length === 0) return;
        const sortKey = th.dataset.sort;
        if (!sortKey) return;

        const colIndex = parseInt(th.dataset.index);

        // Handle favorites sorting (colIndex === -1)
        if (sortKey === 'fav') {
            if (this.currentSortCol === -1) {
                this.currentSortAsc = !this.currentSortAsc;
            } else {
                this.currentSortCol = -1;
                this.currentSortAsc = true; // Favorites first (descending: favorites first)
            }

            this.table.querySelectorAll('thead th').forEach(el => el.classList.remove('sort-asc', 'sort-desc'));
            th.classList.add(this.currentSortAsc ? 'sort-asc' : 'sort-desc');

            showLoading();
            setTimeout(() => {
                this.currentData.sort((a, b) => {
                    const favA = this.favorites.has(a[0]) ? 1 : 0;
                    const favB = this.favorites.has(b[0]) ? 1 : 0;
                    if (favA === favB) return 0;
                    return this.currentSortAsc ? (favA > favB ? 1 : -1) : (favA > favB ? -1 : 1);
                });
                this.renderTable(this.currentData);
                hideLoading();
            }, 10);
            return;
        }

        if (this.currentSortCol === colIndex) {
            this.currentSortAsc = !this.currentSortAsc;
        } else {
            this.currentSortCol = colIndex;
            this.currentSortAsc = false;
            if (['code', 'name', 'tur', 'turc', 'sirket', 'tefas'].includes(sortKey)) {
                this.currentSortAsc = true;
            }
        }

        this.table.querySelectorAll('thead th').forEach(el => el.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(this.currentSortAsc ? 'sort-asc' : 'sort-desc');

        showLoading();
        setTimeout(() => {
            this.currentData.sort((a, b) => {
                let valA = a[colIndex] ?? '';
                let valB = b[colIndex] ?? '';
                if (valA === valB) return 0;
                if (typeof valA === 'string' && typeof valB === 'string') {
                    return this.currentSortAsc ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
                }
                return this.currentSortAsc ? (valA > valB ? 1 : -1) : (valA > valB ? -1 : 1);
            });
            this.renderTable(this.currentData);
            hideLoading();
        }, 10);
    }

    initFilters() {
        this.initFilterDropdown(11, `tur-options${this.prefix ? '-' + this.prefix : ''}`, `tur-select${this.prefix ? '-' + this.prefix : ''}`, this.selectedTurs);
        this.initFilterDropdown(12, `turc-options${this.prefix ? '-' + this.prefix : ''}`, `turc-select${this.prefix ? '-' + this.prefix : ''}`, this.selectedTurcs);
        this.initFilterDropdown(13, `sirket-options${this.prefix ? '-' + this.prefix : ''}`, `sirket-select${this.prefix ? '-' + this.prefix : ''}`, this.selectedSirkets);
    }

    initFilterDropdown(dataIndex, optionsContainerId, selectContainerId, selectedSet) {
        const values = new Set();
        this.fullData.forEach(row => {
            if (row[dataIndex] !== undefined && row[dataIndex] !== null) values.add(row[dataIndex]);
        });
        const sortedValues = Array.from(values).sort();
        const container = document.getElementById(optionsContainerId);
        if (!container) return;

        container.innerHTML = '';
        selectedSet.clear();
        sortedValues.forEach(v => selectedSet.add(v));

        const toggleAllDiv = document.createElement('div');
        toggleAllDiv.className = 'option-item toggle-all-item';
        toggleAllDiv.style.fontWeight = 'bold';
        toggleAllDiv.style.borderBottom = '1px solid var(--border-color)';
        toggleAllDiv.style.marginBottom = '0.2rem';
        toggleAllDiv.innerHTML = `<span>Tümünü Seç / Kaldır</span>`;
        toggleAllDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            const allSelected = selectedSet.size === sortedValues.length;
            if (allSelected) {
                selectedSet.clear();
                container.querySelectorAll('input').forEach(cb => cb.checked = false);
            } else {
                sortedValues.forEach(v => selectedSet.add(v));
                container.querySelectorAll('input').forEach(cb => cb.checked = true);
            }
            this.updateFilterText(selectedSet, sortedValues.length, document.getElementById(selectContainerId));
        });
        container.appendChild(toggleAllDiv);

        sortedValues.forEach(val => {
            const displayVal = val === "" ? "Belirsiz" : val;
            const div = document.createElement('div');
            div.className = 'option-item';
            div.innerHTML = `<input type="checkbox" value="${val}" checked><span>${displayVal}</span>`;
            div.addEventListener('click', (e) => {
                const checkbox = div.querySelector('input');
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) selectedSet.add(val);
                else selectedSet.delete(val);
                this.updateFilterText(selectedSet, sortedValues.length, document.getElementById(selectContainerId));
            });
            container.appendChild(div);
        });
        this.updateFilterText(selectedSet, sortedValues.length, document.getElementById(selectContainerId));
    }

    updateFilterText(selectedSet, totalCount, containerEl) {
        if (!containerEl) return;
        const textElement = containerEl.querySelector('.multi-select-text');
        if (selectedSet.size === totalCount) textElement.textContent = "Tümü Seçili";
        else if (selectedSet.size === 0) textElement.textContent = "Hiçbiri Seçili";
        else textElement.textContent = `${selectedSet.size} seçildi`;
    }

    applyFilters() {
        const statusVal = this.tefasStatusFilter?.value || 'ALL';
        this.currentData = this.fullData.filter(row => {
            // Filter by search term
            if (this.searchTerm) {
                const kod = (row[0] || '').toLowerCase();
                const ad = (row[1] || '').toLowerCase();
                if (!kod.includes(this.searchTerm) && !ad.includes(this.searchTerm)) {
                    return false;
                }
            }

            const matchesTur = this.selectedTurs.has(row[11] || "");
            const matchesTurc = this.selectedTurcs.has(row[12] || "");
            const matchesSirket = this.selectedSirkets.has(row[13] || "");
            let matchesStatus = true;
            if (statusVal === 'EVET') matchesStatus = (row[14] === 'EVET');
            else if (statusVal === 'HAYIR') matchesStatus = (row[14] !== 'EVET');

            // Filter by favorites
            const kod = row[0];
            const matchesFav = !this.favFilterActive || this.favorites.has(kod);

            return matchesTur && matchesTurc && matchesSirket && matchesStatus && matchesFav;
        });
        this.renderTable(this.currentData);
    }

    resetFilters() {
        this.selectedTurs.clear();
        this.selectedTurcs.clear();
        this.selectedSirkets.clear();
        this.searchTerm = '';
        if (this.searchInput) this.searchInput.value = '';
        this.favFilterActive = false;
        if (this.favFilterBtn) this.favFilterBtn.classList.remove('active');
        this.initFilters();
        if (this.tefasStatusFilter) this.tefasStatusFilter.value = 'EVET';
        this.applyFilters();
    }

    exportData(type) {
        const headers = ['KOD', 'UNVAN', '1G %', '1H %', '1AY', '3AY', '6AY', 'YBB', '1YIL', '3YIL', '5YIL', 'TÜR', 'TUR-C', 'ŞİRKET', 'TEFAS', 'FIYAT', 'FIYAT1', 'FIYAT7'];
        const data = this.currentData.map(row => row.map((val, idx) => {
            if ([2, 3, 4, 5, 6, 7, 8, 9, 10].includes(idx)) return val !== null ? (val * 100).toFixed(2) + '%' : '-';
            return val;
        }));
        const name = `TEFAS_${this.fontip}_Veriler_` + new Date().toISOString().split('T')[0];
        if (type === 'csv') downloadCSV(data, headers, name);
        else downloadXLS(data, headers, name);
    }
}

/**
 * FVTDataView class manages the data, filters, and rendering for FVT Data.
 */
class FVTDataView {
    constructor(config) {
        this.storageKey = config.storageKey || 'fvtData';
        this.lastUpdateKey = config.lastUpdateKey || 'fvtLastUpdate';

        // Core Elements
        this.btn = document.getElementById(config.btnId);
        this.btnIcon = this.btn?.querySelector('.btn-icon');
        this.spinner = this.btn?.querySelector('.loader-spinner');
        this.tbody = document.getElementById(config.tbodyId);
        this.lastUpdateText = document.getElementById(config.lastUpdateId);
        this.table = document.getElementById(config.tableId);
        this.tableContainer = document.getElementById(config.tableContainerId);

        // Filter Elements
        this.btnApplyFilters = document.getElementById(config.applyFilterBtnId);
        this.btnResetFilters = document.getElementById(config.resetFilterBtnId);
        this.kategoriSelect = document.getElementById(config.kategoriSelectId);
        this.sirketSelect = document.getElementById(config.sirketSelectId);
        this.searchInput = document.getElementById(config.searchInputId);

        // Favorites
        this.favorites = new Set();
        this.favFilterActive = false;
        this.favFilterBtn = document.getElementById(config.favFilterBtnId || 'fav-filter-btn-fvt');

        // State
        this.fullData = [];
        this.currentData = [];
        this.currentSortCol = -1;
        this.currentSortAsc = true;
        this.selectedKategoris = new Set();
        this.selectedSirkets = new Set();
        this.searchTerm = '';

        this.init();
    }

    init() {
        // Fetch button
        this.btn?.addEventListener('click', () => this.fetchData());

        // Sortable headers
        this.table?.querySelectorAll('thead th').forEach(th => {
            th.addEventListener('click', () => this.handleSort(th));
        });

        // Filter Dropdowns
        if (this.kategoriSelect) this.setupDropdownEvents(this.kategoriSelect);
        if (this.sirketSelect) this.setupDropdownEvents(this.sirketSelect);

        // Filter Apply/Reset
        this.btnApplyFilters?.addEventListener('click', () => {
            this.closeAllDropdowns();
            showLoading();
            setTimeout(() => {
                this.applyFilters();
                hideLoading();
            }, 10);
        });

        this.btnResetFilters?.addEventListener('click', () => {
            this.closeAllDropdowns();
            showLoading();
            setTimeout(() => {
                this.resetFilters();
                hideLoading();
            }, 10);
        });

        // Search input
        this.searchInput?.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.applyFilters();
        });

        // Load favorites from server
        this.loadFavorites();

        // Favorite filter button
        this.favFilterBtn?.addEventListener('click', () => {
            this.favFilterActive = !this.favFilterActive;
            this.favFilterBtn?.classList.toggle('active', this.favFilterActive);
            this.applyFilters();
        });

        // Local Storage Load
        this.loadFromStorage();
    }

    setupDropdownEvents(selectEl) {
        const trigger = selectEl.querySelector('.multi-select-trigger');
        trigger.addEventListener('click', () => {
            selectEl.classList.toggle('open');
        });
    }

    closeAllDropdowns() {
        this.kategoriSelect?.classList.remove('open');
        this.sirketSelect?.classList.remove('open');
    }

    async loadFavorites() {
        try {
            const response = await fetch('/api/fvt-favorites');
            if (response.ok) {
                const codes = await response.json();
                this.favorites = new Set(codes);
            }
        } catch (err) {
            console.error('FVT Favoriler yüklenemedi:', err);
        }
    }

    async toggleFavorite(code) {
        const isFavorite = this.favorites.has(code);
        try {
            if (isFavorite) {
                await fetch(`/api/fvt-favorites?code=${encodeURIComponent(code)}`, { method: 'DELETE' });
                this.favorites.delete(code);
            } else {
                await fetch('/api/fvt-favorites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                this.favorites.add(code);
            }
            // Re-render table to update heart icons
            this.renderTable(this.currentData);
            // Reload favorites list and clear cache
            if (typeof loadFavoritesList === 'function') {
                localStorage.removeItem('fvtFavoritesRealtime');
                loadFavoritesList();
            }
        } catch (err) {
            console.error('FVT Favori güncellenemedi:', err);
        }
    }

    async loadFromStorage() {
        // Try to load from server first
        try {
            const response = await fetch('/api/fvt-data');
            if (response.ok) {
                const result = await response.json();
                if (result.data && result.data.length > 0) {
                    this.fullData = result.data;
                    this.initFilters();
                    this.applyFilters();
                    return;
                }
            }
        } catch (error) {
            console.log('Sunucudan FVT verisi alınamadı, yerel storage kullanılıyor:', error.message);
        }

        // Fallback to localStorage
        const savedData = localStorage.getItem(this.storageKey);
        if (savedData) {
            try {
                this.fullData = JSON.parse(savedData);
                if (this.fullData && this.fullData.length > 0) {
                    this.initFilters();
                    this.applyFilters();
                }
            } catch (error) {
                console.error('Yerel FVT veritabanı okunurken hata:', error);
            }
        }
    }

    async fetchData() {
        hideStatus();
        if (this.btn) this.btn.disabled = true;
        if (this.btnIcon) this.btnIcon.style.display = 'none';
        if (this.spinner) this.spinner.style.display = 'block';

        try {
            const response = await fetch('/api/fvt-fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Veri alınamadı');
            }

            if (result.data && result.data.length > 0) {
                this.fullData = result.data;

                // Save to localStorage
                localStorage.setItem(this.storageKey, JSON.stringify(this.fullData));

                this.initFilters();
                this.applyFilters();

                // Clear sort UI
                this.table.querySelectorAll('th').forEach(el => el.classList.remove('sort-asc', 'sort-desc'));

                // Update timestamp
                const now = new Date();
                const formattedDate =
                    String(now.getDate()).padStart(2, '0') + '.' +
                    String(now.getMonth() + 1).padStart(2, '0') + '.' +
                    String(now.getFullYear()).slice(-2) + ' ' +
                    String(now.getHours()).padStart(2, '0') + ':' +
                    String(now.getMinutes()).padStart(2, '0');
                const updateStr = "Son Güncelleme: " + formattedDate;

                if (this.lastUpdateText) this.lastUpdateText.textContent = updateStr;
                localStorage.setItem(this.lastUpdateKey, updateStr);

                showStatus(`FVT verileri güncellendi. (${this.fullData.length} fon)`);
            } else {
                showStatus('FVT API\'den veri alınamadı.');
            }

        } catch (error) {
            console.error(error);
            showStatus('Veri alınırken hata: ' + error.message, true);
        } finally {
            if (this.btn) this.btn.disabled = false;
            if (this.btnIcon) this.btnIcon.style.display = 'block';
            if (this.spinner) this.spinner.style.display = 'none';
        }
    }

    renderTable(data) {
        if (!this.tbody) return;
        this.tbody.innerHTML = '';

        if (data.length === 0) {
            this.tbody.innerHTML = '<tr><td colspan="13" class="empty-state">Veri bulunamadı.</td></tr>';
            return;
        }

        data.forEach(row => {
            const tr = document.createElement('tr');

            // Map row data to columns (without separate FON ADI column):
            // 0: fon_kodu, 1: kategoriAdi, 2: haftalik_getiri, 3: aylik_getiri
            // 4: uc_aylik_getiri, 5: alti_aylik_getiri, 6: ytd_getiri, 7: bir_yillik_getiri
            // 8: uc_yillik_getiri, 9: bes_yillik_getiri, 10: stopaj, 11: yonetim_ucret, 12: fonlink

            const code = row.fon_kodu;
            const isFavorite = this.favorites.has(code);
            const heartIcon = isFavorite
                ? '<svg class="fav-icon favorited" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>'
                : '<svg class="fav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';

            const linkUrl = row.fonlink ? `https://fvt.com.tr/yatirim-fonlari/${row.fonlink}/` : '#';

            tr.innerHTML = `
                <td class="fav-col">
                    <button class="fav-btn" data-code="${code}" title="Favorilere Ekle/Çıkar">
                        ${heartIcon}
                    </button>
                </td>
                <td class="has-tooltip" data-tooltip="${row.fon_adi || ''}">
                    <a href="${linkUrl}" target="_blank" class="fund-code-link">
                        <strong>${row.fon_kodu || ''}</strong>
                    </a>
                    <div class="wrap-text unvan-text fund-name-sub">${row.fon_adi || ''}</div>
                </td>
                <td>${row.kategoriAdi || ''}</td>
                <td>${this.formatPercent(row.haftalik_getiri)}</td>
                <td>${this.formatPercent(row.aylik_getiri)}</td>
                <td>${this.formatPercent(row.uc_aylik_getiri)}</td>
                <td>${this.formatPercent(row.alti_aylik_getiri)}</td>
                <td>${this.formatPercent(row.ytd_getiri)}</td>
                <td>${this.formatPercent(row.bir_yillik_getiri)}</td>
                <td>${this.formatPercent(row.uc_yillik_getiri)}</td>
                <td>${this.formatPercent(row.bes_yillik_getiri)}</td>
                <td>${this.formatPercent(row.stopaj)}</td>
                <td>${this.formatPercent(row.yonetim_ucret)}</td>
            `;

            // Add click handler for favorite button
            const favBtn = tr.querySelector('.fav-btn');
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(code);
            });

            this.tbody.appendChild(tr);
        });
    }

    formatPercent(val) {
        if (val === null || val === undefined) return '-';
        const num = parseFloat(val);
        const str = num.toFixed(2) + '%';
        const cssClass = num > 0.005 ? 'val-up' : num < -0.005 ? 'val-down' : 'val-zero';
        return `<span class="${cssClass}">${num > 0 ? '+' : ''}${str}</span>`;
    }

    handleSort(th) {
        if (this.currentData.length === 0) return;
        const sortKey = th.dataset.sort;
        if (!sortKey) return;

        const colIndex = parseInt(th.dataset.index);

        // Handle favorites sorting (colIndex === -1)
        if (sortKey === 'fav') {
            if (this.currentSortCol === -1) {
                this.currentSortAsc = !this.currentSortAsc;
            } else {
                this.currentSortCol = -1;
                this.currentSortAsc = true;
            }

            this.table.querySelectorAll('thead th').forEach(el => el.classList.remove('sort-asc', 'sort-desc'));
            th.classList.add(this.currentSortAsc ? 'sort-asc' : 'sort-desc');

            showLoading();
            setTimeout(() => {
                this.currentData.sort((a, b) => {
                    const favA = this.favorites.has(a.fon_kodu) ? 1 : 0;
                    const favB = this.favorites.has(b.fon_kodu) ? 1 : 0;
                    if (favA === favB) return 0;
                    return this.currentSortAsc ? (favA > favB ? 1 : -1) : (favA > favB ? -1 : 1);
                });
                this.renderTable(this.currentData);
                hideLoading();
            }, 10);
            return;
        }

        if (this.currentSortCol === colIndex) {
            this.currentSortAsc = !this.currentSortAsc;
        } else {
            this.currentSortCol = colIndex;
            this.currentSortAsc = false;
            if (['kod', 'kategori'].includes(sortKey)) {
                this.currentSortAsc = true;
            }
        }

        this.table.querySelectorAll('thead th').forEach(el => el.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(this.currentSortAsc ? 'sort-asc' : 'sort-desc');

        showLoading();
        setTimeout(() => {
            this.currentData.sort((a, b) => {
                // Get values based on column index (without FON ADI column)
                let valA, valB;
                switch (colIndex) {
                    case 0: valA = a.fon_kodu; valB = b.fon_kodu; break;
                    case 1: valA = a.kategoriAdi; valB = b.kategoriAdi; break;
                    case 2: valA = a.haftalik_getiri; valB = b.haftalik_getiri; break;
                    case 3: valA = a.aylik_getiri; valB = b.aylik_getiri; break;
                    case 4: valA = a.uc_aylik_getiri; valB = b.uc_aylik_getiri; break;
                    case 5: valA = a.alti_aylik_getiri; valB = b.alti_aylik_getiri; break;
                    case 6: valA = a.ytd_getiri; valB = b.ytd_getiri; break;
                    case 7: valA = a.bir_yillik_getiri; valB = b.bir_yillik_getiri; break;
                    case 8: valA = a.uc_yillik_getiri; valB = b.uc_yillik_getiri; break;
                    case 9: valA = a.bes_yillik_getiri; valB = b.bes_yillik_getiri; break;
                    case 10: valA = a.stopaj; valB = b.stopaj; break;
                    case 11: valA = a.yonetim_ucret; valB = b.yonetim_ucret; break;
                    default: valA = ''; valB = '';
                }

                if (valA === valB) return 0;
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;
                if (typeof valA === 'string' && typeof valB === 'string') {
                    return this.currentSortAsc ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
                }
                return this.currentSortAsc ? (valA > valB ? 1 : -1) : (valA > valB ? -1 : 1);
            });
            this.renderTable(this.currentData);
            hideLoading();
        }, 10);
    }

    initFilters() {
        this.initFilterDropdown('kategori', 'fvt-kategori-options', 'fvt-kategori-select', this.selectedKategoris);
        this.initFilterDropdown('sirket', 'fvt-sirket-options', 'fvt-sirket-select', this.selectedSirkets);
    }

    initFilterDropdown(field, optionsContainerId, selectContainerId, selectedSet) {
        const values = new Set();
        this.fullData.forEach(row => {
            let val;
            if (field === 'kategori') val = row.kategoriAdi;
            else if (field === 'sirket') {
                // Extract company from fon_adi (first word before space or specific pattern)
                val = row.fon_adi ? row.fon_adi.split(' ')[0] : '';
            }
            if (val !== undefined && val !== null) values.add(val);
        });
        const sortedValues = Array.from(values).sort();
        const container = document.getElementById(optionsContainerId);
        if (!container) return;

        container.innerHTML = '';
        selectedSet.clear();
        sortedValues.forEach(v => selectedSet.add(v));

        const toggleAllDiv = document.createElement('div');
        toggleAllDiv.className = 'option-item toggle-all-item';
        toggleAllDiv.style.fontWeight = 'bold';
        toggleAllDiv.style.borderBottom = '1px solid var(--border-color)';
        toggleAllDiv.style.marginBottom = '0.2rem';
        toggleAllDiv.innerHTML = `<span>Tümünü Seç / Kaldır</span>`;
        toggleAllDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            const allSelected = selectedSet.size === sortedValues.length;
            if (allSelected) {
                selectedSet.clear();
                container.querySelectorAll('input').forEach(cb => cb.checked = false);
            } else {
                sortedValues.forEach(v => selectedSet.add(v));
                container.querySelectorAll('input').forEach(cb => cb.checked = true);
            }
            this.updateFilterText(selectedSet, sortedValues.length, document.getElementById(selectContainerId));
        });
        container.appendChild(toggleAllDiv);

        sortedValues.forEach(val => {
            const displayVal = val === "" ? "Belirsiz" : val;
            const div = document.createElement('div');
            div.className = 'option-item';
            div.innerHTML = `<input type="checkbox" value="${val}" checked><span>${displayVal}</span>`;
            div.addEventListener('click', (e) => {
                const checkbox = div.querySelector('input');
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) selectedSet.add(val);
                else selectedSet.delete(val);
                this.updateFilterText(selectedSet, sortedValues.length, document.getElementById(selectContainerId));
            });
            container.appendChild(div);
        });
        this.updateFilterText(selectedSet, sortedValues.length, document.getElementById(selectContainerId));
    }

    updateFilterText(selectedSet, totalCount, containerEl) {
        if (!containerEl) return;
        const textElement = containerEl.querySelector('.multi-select-text');
        if (!textElement) return;
        if (selectedSet.size === totalCount) {
            textElement.textContent = 'Tümü Seçili';
        } else if (selectedSet.size === 0) {
            textElement.textContent = 'Hiçbiri Seçili';
        } else {
            textElement.textContent = `${selectedSet.size} Seçili`;
        }
    }

    applyFilters() {
        this.currentData = this.fullData.filter(row => {
            // Filter by search term
            if (this.searchTerm) {
                const kod = (row.fon_kodu || '').toLowerCase();
                const ad = (row.fon_adi || '').toLowerCase();
                if (!kod.includes(this.searchTerm) && !ad.includes(this.searchTerm)) {
                    return false;
                }
            }

            // Filter by kategori
            const rowKategori = row.kategoriAdi || '';
            if (this.selectedKategoris.size > 0 && !this.selectedKategoris.has(rowKategori)) {
                return false;
            }

            // Filter by sirket (first word of fon_adi)
            const rowSirket = row.fon_adi ? row.fon_adi.split(' ')[0] : '';
            if (this.selectedSirkets.size > 0 && !this.selectedSirkets.has(rowSirket)) {
                return false;
            }

            // Filter by favorites
            const kod = row.fon_kodu;
            const matchesFav = !this.favFilterActive || this.favorites.has(kod);

            return matchesFav;
        });

        this.renderTable(this.currentData);
    }

    resetFilters() {
        this.selectedKategoris.clear();
        this.selectedSirkets.clear();
        this.searchTerm = '';
        if (this.searchInput) this.searchInput.value = '';
        this.favFilterActive = false;
        if (this.favFilterBtn) this.favFilterBtn.classList.remove('active');
        this.initFilters();
        this.applyFilters();
    }
}

// Global UI Elements and Logic (Common)
const statusMessage = document.getElementById('status-message');
const globalOverlay = document.getElementById('global-overlay');

function showLoading() { globalOverlay.style.display = 'flex'; }
function hideLoading() { globalOverlay.style.display = 'none'; }
let _statusTimer = null;
function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
    statusMessage.style.display = 'block';
    statusMessage.style.opacity = '1';
    if (_statusTimer) clearTimeout(_statusTimer);
    _statusTimer = setTimeout(() => {
        statusMessage.style.transition = 'opacity 0.5s ease';
        statusMessage.style.opacity = '0';
        setTimeout(() => {
            statusMessage.style.display = 'none';
            statusMessage.style.transition = '';
            statusMessage.style.opacity = '1';
        }, 500);
    }, 3000);
}
function hideStatus() { statusMessage.style.display = 'none'; }

function formatPercent(val) {
    if (val === null || val === undefined) return '-';
    const num = val * 100;
    const str = num.toFixed(2) + '%';
    const cssClass = num > 0.005 ? 'val-up' : num < -0.005 ? 'val-down' : 'val-zero';
    return `<span class="${cssClass}">${num > 0 ? '+' : ''}${str}</span>`;
}

function formatPrice(val) {
    if (val === null || val === undefined) return '-';
    return val.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function downloadCSV(data, headers, filename) {
    const csvContent = [headers.join(';'), ...data.map(row => row.map(val => {
        const s = String(val ?? '');
        return (s.includes(';') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';'))].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '.csv';
    link.click();
}

function downloadXLS(data, headers, filename) {
    let html = '<html><head><meta charset="utf-8"></head><body><table><thead><tr>';
    headers.forEach(h => { html += `<th style="background-color:#f2f2f2;border:1px solid #000;">${h}</th>`; });
    html += '</tr></thead><tbody>';
    data.forEach(row => {
        html += '<tr>';
        row.forEach(cell => { html += `<td style="border:1px solid #000;">${cell ?? ''}</td>`; });
        html += '</tr>';
    });
    html += '</tbody></table></body></html>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '.xls';
    link.click();
}

window.downloadCSV = downloadCSV;
window.downloadXLS = downloadXLS;

let sessionManualDates = null;

function getFormattedDates() {
    const manualDates = sessionManualDates;
    if (manualDates) {
        try {
            const parsed = JSON.parse(manualDates);
            const fmt = (iso) => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
            return { today: fmt(parsed.today), targetDay: fmt(parsed.target), sevenDaysAgo: fmt(parsed.seven) };
        } catch (e) { }
    }
    const d = new Date();
    const isMon = d.getDay() === 1;
    const isSun = d.getDay() === 0;
    const target = new Date(d);
    if (isMon) target.setDate(d.getDate() - 3);
    else if (isSun) target.setDate(d.getDate() - 2);
    else target.setDate(d.getDate() - 1);
    const seven = new Date(d);
    seven.setDate(d.getDate() - 7);
    const f = (date) => `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    return { today: f(d), sevenDaysAgo: f(seven), targetDay: f(target) };
}

// Initialization
let yatView, besView, fvtView;

window.addEventListener('DOMContentLoaded', () => {
    yatView = new TefasDataView({
        fontip: 'YAT', prefix: '',
        storageKey: 'tefasData', lastUpdateKey: 'tefasLastUpdate',
        btnId: 'fetch-btn', tbodyId: 'table-body', lastUpdateId: 'last-update',
        toggleColsBtnId: 'toggle-cols-btn', dataTableContainerId: 'data-table-container',
        tableId: 'data-table', applyFilterBtnId: 'apply-filter-btn', resetFilterBtnId: 'reset-filter-btn',
        tefasStatusFilterId: 'tefas-status-filter', turSelectId: 'tur-select',
        turcSelectId: 'turc-select', sirketSelectId: 'sirket-select',
        searchInputId: 'search-input', favFilterBtnId: 'fav-filter-btn'
    });

    besView = new TefasDataView({
        fontip: 'EMK', prefix: 'bes',
        storageKey: 'tefasData-bes', lastUpdateKey: 'tefasLastUpdate-bes',
        btnId: 'fetch-btn-bes', tbodyId: 'table-body-bes', lastUpdateId: 'last-update-bes',
        toggleColsBtnId: 'toggle-cols-btn-bes', dataTableContainerId: 'data-table-container-bes',
        tableId: 'data-table-bes', applyFilterBtnId: 'apply-filter-btn-bes', resetFilterBtnId: 'reset-filter-btn-bes',
        tefasStatusFilterId: 'tefas-status-filter-bes', turSelectId: 'tur-select-bes',
        turcSelectId: 'turc-select-bes', sirketSelectId: 'sirket-select-bes',
        searchInputId: 'search-input-bes', favFilterBtnId: 'fav-filter-btn-bes'
    });

    fvtView = new FVTDataView({
        storageKey: 'fvtData', lastUpdateKey: 'fvtLastUpdate',
        btnId: 'fetch-fvt-btn', tbodyId: 'fvt-table-body', lastUpdateId: 'last-update-fvt',
        tableId: 'fvt-table', tableContainerId: 'fvt-table-container',
        applyFilterBtnId: 'apply-fvt-filter-btn', resetFilterBtnId: 'reset-fvt-filter-btn',
        kategoriSelectId: 'fvt-kategori-select', sirketSelectId: 'fvt-sirket-select',
        searchInputId: 'fvt-search-input', favFilterBtnId: 'fav-filter-btn-fvt'
    });

    // FVT Favorites Section - Load and display favorites with real-time data
    const fvtFavoritesSection = document.getElementById('fvt-favorites-section');
    const fvtFavoritesList = document.getElementById('fvt-favorites-list');
    const fvtFavCount = document.getElementById('fav-count');
    const refreshFavoritesBtn = document.getElementById('refresh-favorites-btn');
    const FVT_FAVORITES_REALTIME_KEY = 'fvtFavoritesRealtime';

    // Load cached favorites data from localStorage
    function loadCachedFavorites() {
        const cached = localStorage.getItem(FVT_FAVORITES_REALTIME_KEY);
        if (!cached) return null;
        try {
            return JSON.parse(cached);
        } catch {
            return null;
        }
    }

    // Save favorites data to localStorage
    function saveCachedFavorites(data) {
        localStorage.setItem(FVT_FAVORITES_REALTIME_KEY, JSON.stringify(data));
    }

    async function loadFavoritesList() {
        if (!fvtFavoritesList || !fvtFavCount) return;

        try {
            // First load basic favorites data
            const response = await fetch('/api/fvt-favorites-data');
            if (!response.ok) throw new Error('API error');
            const result = await response.json();
            const data = result.data || [];

            fvtFavCount.textContent = `(${data.length})`;

            if (data.length === 0) {
                fvtFavoritesSection.style.display = 'none';
                return;
            }

            fvtFavoritesSection.style.display = 'block';
            fvtFavoritesList.innerHTML = '';

            // Load cached real-time data
            const cachedData = loadCachedFavorites();

            data.forEach(fund => {
                const card = document.createElement('div');
                card.className = 'favorite-fund-card';
                card.dataset.code = fund.fon_kodu;
                card.dataset.name = fund.fon_adi || '';

                // Check if we have cached real-time data for this fund
                const cachedFund = cachedData?.find(c => c.code === fund.fon_kodu);
                let changeStr = 'Güncelle';
                let cardClass = 'neutral';
                let iconSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>';

                if (cachedFund && cachedFund.change !== null) {
                    const changeNum = parseFloat(cachedFund.change);
                    cardClass = changeNum > 0 ? 'positive' : changeNum < 0 ? 'negative' : 'neutral';
                    changeStr = (changeNum > 0 ? '+' : '') + changeNum.toFixed(2) + '%';

                    if (changeNum > 0) {
                        iconSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L20 20l-8-6-8 6Z"/></svg>';
                    } else if (changeNum < 0) {
                        iconSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22L4 4l8 6 8-6Z"/></svg>';
                    }
                }

                card.classList.add(cardClass);

                card.innerHTML = `
                <div class="fund-card-header">${fund.fon_kodu}</div>
                <div class="fund-card-body">
                    <span class="fund-arrow">${iconSvg}</span>
                    <span class="fund-change">${changeStr}</span>
                </div>
            `;

                fvtFavoritesList.appendChild(card);
            });
        } catch (err) {
            console.error('Error loading favorites:', err);
            fvtFavoritesSection.style.display = 'none';
        }
    }

    async function refreshFavoritesRealTime() {
        if (!fvtFavoritesList) return;

        // Show loading state on button
        if (refreshFavoritesBtn) {
            refreshFavoritesBtn.classList.add('loading');
        }

        try {
            const response = await fetch('/api/fvt-favorites-realtime');
            if (!response.ok) throw new Error('API error');
            const result = await response.json();
            const data = result.data || [];

            // Save to localStorage
            saveCachedFavorites(data);

            data.forEach(fund => {
                const card = fvtFavoritesList.querySelector(`[data-code="${fund.code}"]`);
                if (!card) return;

                const change = fund.change;
                let cardClass = 'neutral';
                let changeStr = '--';
                let iconSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>';

                if (change !== null && change !== undefined) {
                    const changeNum = parseFloat(change);
                    cardClass = changeNum > 0 ? 'positive' : changeNum < 0 ? 'negative' : 'neutral';
                    changeStr = (changeNum > 0 ? '+' : '') + changeNum.toFixed(2) + '%';

                    if (changeNum > 0) {
                        iconSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L20 20l-8-6-8 6Z"/></svg>';
                    } else if (changeNum < 0) {
                        iconSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22L4 4l8 6 8-6Z"/></svg>';
                    }
                } else {
                    changeStr = fund.error || 'Hata';
                }

                // Update card class
                card.classList.remove('positive', 'negative', 'neutral');
                card.classList.add(cardClass);

                card.innerHTML = `
                    <div class="fund-card-header">${fund.code}</div>
                    <div class="fund-card-body">
                        <span class="fund-arrow">${iconSvg}</span>
                        <span class="fund-change">${changeStr}</span>
                    </div>
                `;
            });
        } catch (err) {
            console.error('Error refreshing favorites:', err);
        } finally {
            if (refreshFavoritesBtn) {
                refreshFavoritesBtn.classList.remove('loading');
            }
        }
    }

    // Event listener for refresh button
    refreshFavoritesBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        refreshFavoritesRealTime();
    });

    // Load favorites when FVT tab is shown
    document.querySelector('[data-tab="tab-fvt"]')?.addEventListener('click', () => {
        setTimeout(loadFavoritesList, 100);
    });

    // Also load initially if already on FVT tab
    if (document.getElementById('tab-fvt')?.classList.contains('active')) {
        setTimeout(loadFavoritesList, 100);
    }

    // Clear database buttons
    document.getElementById('clear-btn')?.addEventListener('click', async () => {
        if (!confirm('YAT fon verileri veritabanından temizlenecek. Emin misiniz?')) return;
        try {
            await fetch('/api/tefas-data?type=YAT', { method: 'DELETE' });
            localStorage.removeItem('tefasData');
            localStorage.removeItem('tefasLastUpdate');

            // Clear local state and refresh UI
            yatView.fullData = [];
            yatView.applyFilters();
            if (yatView.lastUpdateText) yatView.lastUpdateText.textContent = "";
            window.fullData = [];
            document.dispatchEvent(new CustomEvent('tefas-data-updated'));

            showStatus('YAT verileri temizlendi. Lütfen verileri güncelleyin.');
        } catch (err) {
            showStatus('Veri temizlenirken hata: ' + err.message, true);
        }
    });

    document.getElementById('clear-btn-bes')?.addEventListener('click', async () => {
        if (!confirm('BES fon verileri veritabanından temizlenecek. Emin misiniz?')) return;
        try {
            await fetch('/api/tefas-data?type=EMK', { method: 'DELETE' });
            localStorage.removeItem('tefasData-bes');
            localStorage.removeItem('tefasLastUpdate-bes');

            // Clear local state and refresh UI
            besView.fullData = [];
            besView.applyFilters();
            if (besView.lastUpdateText) besView.lastUpdateText.textContent = "";
            window.besData = [];

            showStatus('BES verileri temizlendi. Lütfen verileri güncelleyin.');
        } catch (err) {
            showStatus('Veri temizlenirken hata: ' + err.message, true);
        }
    });

    document.getElementById('clear-fvt-btn')?.addEventListener('click', async () => {
        try {
            await fetch('/api/fvt-clear', { method: 'DELETE' });
            localStorage.removeItem('fvtData');
            localStorage.removeItem('fvtLastUpdate');

            // Clear local state and refresh UI
            fvtView.fullData = [];
            fvtView.applyFilters();
            if (fvtView.lastUpdateText) fvtView.lastUpdateText.textContent = "";

            showStatus('FVT verileri temizlendi. Lütfen verileri güncelleyin.');
        } catch (err) {
            showStatus('Veri temizlenirken hata: ' + err.message, true);
        }
    });
});

// Global Tooltip
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
            globalTooltip.style.left = (rect.left + rect.width / 2) + 'px';
            globalTooltip.style.top = (rect.bottom + 10) + 'px';
        }
    }
});
document.addEventListener('mouseout', (e) => { if (e.target.closest('.has-tooltip')) globalTooltip.classList.remove('visible'); });

// Theme Selection Menu
const themeToggleBtn = document.getElementById('theme-toggle');
const themeOptions = document.getElementById('theme-options');
const themeOptionItems = document.querySelectorAll('.theme-option');

// Initialize active theme in menu
const currentTheme = localStorage.getItem('tefasTheme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
themeOptionItems.forEach(opt => {
    if (opt.dataset.theme === currentTheme) opt.classList.add('active');
    else opt.classList.remove('active');
});

themeToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    themeOptions.classList.toggle('open');
});

themeOptionItems.forEach(item => {
    item.addEventListener('click', () => {
        const theme = item.dataset.theme;
        if (theme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        localStorage.setItem('tefasTheme', theme);

        // Update menu UI
        themeOptionItems.forEach(opt => opt.classList.remove('active'));
        item.classList.add('active');
        themeOptions.classList.remove('open');

        // Refresh dashboard if active
        if (typeof renderDashboard === 'function' && document.getElementById('tab-dashboard').classList.contains('active')) {
            renderDashboard();
        }

        if (typeof showStatus === 'function') {
            showStatus(`Tema değiştirildi: ${item.querySelector('span:last-child').textContent}`);
        }
    });
});

// Close theme menu when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.theme-menu-container')) {
        themeOptions?.classList.remove('open');
    }
});


// Settings Modal
const settingsBtn = document.getElementById('settings-btn');
const settingsBtnBes = document.getElementById('settings-btn-bes');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const settingsDefaultBtn = document.getElementById('settings-default-btn');
const inputToday = document.getElementById('setting-today');
const inputTarget = document.getElementById('setting-target');
const inputSeven = document.getElementById('setting-seven');

const openSettings = () => {
    const current = getFormattedDates();
    const toIso = (dotStr) => { if (!dotStr || dotStr === '-') return ''; const [d, m, y] = dotStr.split('.'); return `${y}-${m}-${d}`; };
    inputToday.value = toIso(current.today);
    inputTarget.value = toIso(current.targetDay);
    inputSeven.value = toIso(current.sevenDaysAgo);
    settingsModal.style.display = 'flex';
};

const setDefaultDates = () => {
    const f = (date) => `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    const toIso = (dotStr) => { if (!dotStr || dotStr === '-') return ''; const [d, m, y] = dotStr.split('.'); return `${y}-${m}-${d}`; };

    // Bugünün tarihi
    const today = new Date();
    inputToday.value = toIso(f(today));

    // Target (dün) - Pazartesi ise 3 gün önce, değilse 1 gün önce
    const target = new Date();
    if (target.getDay() === 1) {
        target.setDate(target.getDate() - 3);
    } else {
        target.setDate(target.getDate() - 1);
    }
    inputTarget.value = toIso(f(target));

    // 7 gün önce
    const sevenDays = new Date();
    sevenDays.setDate(sevenDays.getDate() - 7);
    inputSeven.value = toIso(f(sevenDays));

    showStatus('Tarihler varsayılan değerlere sıfırlandı.');
};

settingsBtn?.addEventListener('click', openSettings);
settingsBtnBes?.addEventListener('click', openSettings);
settingsDefaultBtn?.addEventListener('click', setDefaultDates);
settingsCloseBtn?.addEventListener('click', () => { settingsModal.style.display = 'none'; });
settingsSaveBtn?.addEventListener('click', () => {
    const dates = { today: inputToday.value, target: inputTarget.value, seven: inputSeven.value };
    if (!dates.today || !dates.target || !dates.seven) { alert('Lütfen tüm tarihleri seçin.'); return; }
    sessionManualDates = dates;
    settingsModal.style.display = 'none';
    showStatus('Tarih ayarları güncellendi. Lütfen verileri güncelleyin.');
});

// Global Dropdown Toggles (Export Buttons)
document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.export-trigger-btn');
    const allDropdowns = document.querySelectorAll('.export-dropdown');

    if (trigger) {
        // Toggle current
        const dropdown = trigger.closest('.export-dropdown');
        const isOpen = dropdown.classList.contains('open');
        allDropdowns.forEach(d => d.classList.remove('open'));
        if (!isOpen) dropdown.classList.add('open');
    } else {
        // Close if clicking outside
        if (!e.target.closest('.export-menu')) {
            allDropdowns.forEach(d => d.classList.remove('open'));
        }
    }
});
