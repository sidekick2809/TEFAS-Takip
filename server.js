import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 80;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'portfolio.db');
const LEGACY_JSON = path.join(DATA_DIR, 'portfolio.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Open / create SQLite database
const db = new Database(DB_FILE);

// Create table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio (
        id        INTEGER PRIMARY KEY,
        code      TEXT,
        name      TEXT,
        lots      REAL,
        buyPrice  REAL,
        buyDate   TEXT,
        type      TEXT,
        note      TEXT,
        fundType  TEXT DEFAULT 'YAT'
    )
`);

// Create BES portfolio table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS bes_portfolio (
        id        INTEGER PRIMARY KEY,
        code      TEXT,
        name      TEXT,
        lots      REAL,
        buyPrice  REAL,
        buyDate   TEXT,
        type      TEXT,
        note      TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// Create FVT data table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS fvt_data (
        id              INTEGER PRIMARY KEY,
        fon_kodu        TEXT,
        fon_adi         TEXT,
        kategoriAdi     TEXT,
        haftalik_getiri REAL,
        aylik_getiri    REAL,
        uc_aylik_getiri REAL,
        alti_aylik_getiri REAL,
        ytd_getiri      REAL,
        bir_yillik_getiri REAL,
        uc_yillik_getiri REAL,
        bes_yillik_getiri REAL,
        stopaj          REAL,
        yonetim_ucret   REAL,
        fonlink         TEXT,
        fetchedAt       TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// Migration: Add fundType column if it doesn't exist (for existing databases)
try {
    db.exec("ALTER TABLE portfolio ADD COLUMN fundType TEXT DEFAULT 'YAT'");
} catch (e) {
    // Column might already exist or table is new, ignore error
}

// Create favorites table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        code      TEXT UNIQUE NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// Create FVT favorites table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS fvt_favorites (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        code      TEXT UNIQUE NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// TEFAS and BES history tables
db.exec(`
    CREATE TABLE IF NOT EXISTS yat_history (
        code TEXT PRIMARY KEY,
        name TEXT,
        daily_return REAL,
        weekly_return REAL,
        return1m REAL,
        return3m REAL,
        return6m REAL,
        returnYtd REAL,
        return1y REAL,
        return3y REAL,
        return5y REAL,
        category TEXT,
        subcategory TEXT,
        company TEXT,
        is_active TEXT,
        price REAL,
        price_prev REAL,
        price_7d REAL,
        is_stale INTEGER DEFAULT 0
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS bes_history (
        code TEXT PRIMARY KEY,
        name TEXT,
        daily_return REAL,
        weekly_return REAL,
        return1m REAL,
        return3m REAL,
        return6m REAL,
        returnYtd REAL,
        return1y REAL,
        return3y REAL,
        return5y REAL,
        category TEXT,
        subcategory TEXT,
        company TEXT,
        is_active TEXT,
        price REAL,
        price_prev REAL,
        price_7d REAL,
        is_stale INTEGER DEFAULT 0
    )
`);

// Metadata table for timestamps
db.exec(`
    CREATE TABLE IF NOT EXISTS tefas_metadata (
        type TEXT PRIMARY KEY,
        updatedAt TEXT
    )
`);

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large fund data

// API: Portfolio - Get (by fundType: YAT or EMK)
db.exec(`
    CREATE TABLE IF NOT EXISTS kap_data (
        id        INTEGER PRIMARY KEY,
        stockCode TEXT,
        publishDate TEXT,
        title     TEXT,
        companyTitle TEXT,
        summary   TEXT,
        disclosureCategory TEXT,
        url       TEXT,
        fetchedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// Auto-migrate from portfolio.json if DB is empty and JSON file exists
const rowCount = db.prepare('SELECT COUNT(*) as cnt FROM portfolio').get();
if (rowCount.cnt === 0 && fs.existsSync(LEGACY_JSON)) {
    try {
        const jsonData = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf8'));
        if (Array.isArray(jsonData) && jsonData.length > 0) {
            const insert = db.prepare(`
                INSERT INTO portfolio (id, code, name, lots, buyPrice, buyDate, type, note)
                VALUES (@id, @code, @name, @lots, @buyPrice, @buyDate, @type, @note)
            `);
            const insertMany = db.transaction((rows) => {
                for (const row of rows) {
                    insert.run({
                        id: row.id ?? null,
                        code: row.code ?? null,
                        name: row.name ?? null,
                        lots: row.lots ?? null,
                        buyPrice: row.buyPrice ?? null,
                        buyDate: row.buyDate ?? null,
                        type: row.type ?? null,
                        note: row.note ?? null
                    });
                }
            });
            insertMany(jsonData);
            fs.renameSync(LEGACY_JSON, LEGACY_JSON + '.bak');
            console.log(`Migrated ${jsonData.length} records from portfolio.json to SQLite.`);
        }
    } catch (err) {
        console.error('Migration from portfolio.json failed:', err.message);
    }
}

// API: Portfolio - Get (by fundType: YAT or EMK)
app.get('/api/local-portfolio', (req, res) => {
    try {
        const fundType = req.query.fundType || 'YAT';
        const rows = db.prepare('SELECT * FROM portfolio WHERE fundType = ? ORDER BY id').all(fundType);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Veri okunamadı' });
    }
});

// API: Portfolio - Save (full replace, by fundType)
app.post('/api/local-portfolio', (req, res) => {
    try {
        const { rows, fundType } = req.body;
        if (!Array.isArray(rows)) {
            return res.status(400).json({ error: 'Geçersiz veri formatı' });
        }
        const pFundType = fundType || 'YAT';
        const replace = db.transaction((data) => {
            db.prepare('DELETE FROM portfolio WHERE fundType = ?').run(pFundType);
            const insert = db.prepare(`
                INSERT INTO portfolio (id, code, name, lots, buyPrice, buyDate, type, note, fundType)
                VALUES (@id, @code, @name, @lots, @buyPrice, @buyDate, @type, @note, @fundType)
            `);
            for (const row of data) {
                insert.run({
                    id: row.id ?? null,
                    code: row.code ?? null,
                    name: row.name ?? null,
                    lots: row.lots ?? null,
                    buyPrice: row.buyPrice ?? null,
                    buyDate: row.buyDate ?? null,
                    type: row.type ?? null,
                    note: row.note ?? null,
                    fundType: pFundType
                });
            }
        });
        replace(rows);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Veri kaydedilemedi' });
    }
});

// API: BES Portfolio - Get
app.get('/api/bes-portfolio', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM bes_portfolio ORDER BY id').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'BES verisi okunamadı' });
    }
});

// API: BES Portfolio - Save (full replace)
app.post('/api/bes-portfolio', (req, res) => {
    try {
        const { rows } = req.body;
        if (!Array.isArray(rows)) {
            return res.status(400).json({ error: 'Geçersiz veri formatı' });
        }
        const replace = db.transaction((data) => {
            db.prepare('DELETE FROM bes_portfolio').run();
            const insert = db.prepare(`
                INSERT INTO bes_portfolio (id, code, name, lots, buyPrice, buyDate, type, note)
                VALUES (@id, @code, @name, @lots, @buyPrice, @buyDate, @type, @note)
            `);
            for (const row of data) {
                insert.run({
                    id: row.id ?? null,
                    code: row.code ?? null,
                    name: row.name ?? null,
                    lots: row.lots ?? null,
                    buyPrice: row.buyPrice ?? null,
                    buyDate: row.buyDate ?? null,
                    type: row.type ?? null,
                    note: row.note ?? null
                });
            }
        });
        replace(rows);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'BES verisi kaydedilemedi' });
    }
});

// API: Favorites - Get all
app.get('/api/favorites', (req, res) => {
    try {
        const rows = db.prepare('SELECT code FROM favorites ORDER BY createdAt DESC').all();
        res.json(rows.map(r => r.code));
    } catch (err) {
        res.status(500).json({ error: 'Favoriler okunamadı' });
    }
});

// API: Favorites - Add
app.post('/api/favorites', (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Kod gereklidir' });
        }
        db.prepare('INSERT OR IGNORE INTO favorites (code) VALUES (?)').run(code);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Favori eklenemedi' });
    }
});

// API: Favorites - Remove
app.delete('/api/favorites', (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'Kod gereklidir' });
        }
        db.prepare('DELETE FROM favorites WHERE code = ?').run(code);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Favori silinemedi' });
    }
});

// API: FVT Favorites - Get all
app.get('/api/fvt-favorites', (req, res) => {
    try {
        const rows = db.prepare('SELECT code FROM fvt_favorites ORDER BY createdAt DESC').all();
        res.json(rows.map(r => r.code));
    } catch (err) {
        res.status(500).json({ error: 'FVT Favoriler okunamadı' });
    }
});

// API: FVT Favorites - Add
app.post('/api/fvt-favorites', (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Kod gereklidir' });
        }
        db.prepare('INSERT OR IGNORE INTO fvt_favorites (code) VALUES (?)').run(code);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'FVT Favori eklenemedi' });
    }
});

// API: FVT Favorites - Remove
app.delete('/api/fvt-favorites', (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'Kod gereklidir' });
        }
        db.prepare('DELETE FROM fvt_favorites WHERE code = ?').run(code);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'FVT Favori silinemedi' });
    }
});

// API: TEFAS Data - Get cached data (by type: YAT or EMK)
app.get('/api/tefas-data', (req, res) => {
    try {
        const type = req.query.type || 'YAT';
        const tableName = type === 'EMK' ? 'bes_history' : 'yat_history';

        const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
        const meta = db.prepare('SELECT updatedAt FROM tefas_metadata WHERE type = ?').get(type);

        const data = rows.map(r => [
            r.code, r.name, r.daily_return, r.weekly_return,
            r.return1m, r.return3m, r.return6m, r.returnYtd,
            r.return1y, r.return3y, r.return5y, r.category,
            r.subcategory, r.company, r.is_active, r.price,
            r.price_prev, r.price_7d, r.is_stale === 1
        ]);

        res.json({ data: data.length > 0 ? data : null, updatedAt: meta ? meta.updatedAt : null });
    } catch (err) {
        res.status(500).json({ error: 'Veri okunamadı' });
    }
});

// API: TEFAS Data - Save (full replace, by type)
app.post('/api/tefas-data', (req, res) => {
    try {
        const { data, type } = req.body;
        if (!Array.isArray(data)) {
            return res.status(400).json({ error: 'Geçersiz veri formatı' });
        }
        const fundType = type || 'YAT';
        const tableName = fundType === 'EMK' ? 'bes_history' : 'yat_history';
        const now = new Date().toISOString();

        const replace = db.transaction((rows) => {
            db.prepare(`DELETE FROM ${tableName}`).run();
            const insert = db.prepare(`
                INSERT INTO ${tableName} (
                    code, name, daily_return, weekly_return, 
                    return1m, return3m, return6m, returnYtd, 
                    return1y, return3y, return5y, category, 
                    subcategory, company, is_active, price, 
                    price_prev, price_7d, is_stale
                ) VALUES (
                    @c0, @c1, @c2, @c3, 
                    @c4, @c5, @c6, @c7, 
                    @c8, @c9, @c10, @c11, 
                    @c12, @c13, @c14, @c15, 
                    @c16, @c17, @c18
                )
            `);
            for (const row of rows) {
                insert.run({
                    c0: row[0] ?? null, c1: row[1] ?? null, c2: row[2] ?? null, c3: row[3] ?? null,
                    c4: row[4] ?? null, c5: row[5] ?? null, c6: row[6] ?? null, c7: row[7] ?? null,
                    c8: row[8] ?? null, c9: row[9] ?? null, c10: row[10] ?? null, c11: row[11] ?? null,
                    c12: row[12] ?? null, c13: row[13] ?? null, c14: row[14] ?? null, c15: row[15] ?? null,
                    c16: row[16] ?? null, c17: row[17] ?? null, c18: row[18] ? 1 : 0
                });
            }
            db.prepare('INSERT OR REPLACE INTO tefas_metadata (type, updatedAt) VALUES (?, ?)').run(fundType, now);
        });

        replace(data);
        res.json({ success: true, updatedAt: now });
    } catch (err) {
        res.status(500).json({ error: 'Veri kaydedilemedi' });
    }
});

// API: TEFAS Data - Delete (clear data by type)
app.delete('/api/tefas-data', (req, res) => {
    try {
        const type = req.query.type || 'YAT';
        const tableName = type === 'EMK' ? 'bes_history' : 'yat_history';
        db.prepare(`DELETE FROM ${tableName}`).run();
        db.prepare('DELETE FROM tefas_metadata WHERE type = ?').run(type);
        res.json({ success: true, message: `${type} verileri temizlendi` });
    } catch (err) {
        res.status(500).json({ error: 'Veri temizlenemedi' });
    }
});

// API: KAP Data - Get all
app.get('/api/kap-data', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM kap_data ORDER BY publishDate DESC, id DESC').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'KAP verisi okunamadı' });
    }
});

// API: KAP Data - Save (full replace)
app.post('/api/kap-data', (req, res) => {
    try {
        const { data } = req.body;
        if (!Array.isArray(data)) {
            return res.status(400).json({ error: 'Geçersiz veri formatı' });
        }
        const now = new Date().toISOString();
        const replace = db.transaction((rows) => {
            db.prepare('DELETE FROM kap_data').run();
            const insert = db.prepare(`
                INSERT INTO kap_data (stockCode, publishDate, title, companyTitle, summary, disclosureCategory, url, fetchedAt)
                VALUES (@stockCode, @publishDate, @title, @companyTitle, @summary, @disclosureCategory, @url, @fetchedAt)
            `);
            for (const row of rows) {
                insert.run({
                    stockCode: row.stockCode || null,
                    publishDate: row.publishDate || null,
                    title: row.title || null,
                    companyTitle: row.companyTitle || null,
                    summary: row.summary || null,
                    disclosureCategory: row.disclosureCategory || null,
                    url: row.url || null,
                    fetchedAt: now
                });
            }
        });
        replace(data);
        res.json({ success: true, updatedAt: now, count: data.length });
    } catch (err) {
        res.status(500).json({ error: 'KAP verisi kaydedilemedi' });
    }
});

// API: KAP Data - Delete (clear all)
app.delete('/api/kap-data', (req, res) => {
    try {
        db.prepare('DELETE FROM kap_data').run();
        res.json({ success: true, message: 'KAP verileri temizlendi' });
    } catch (err) {
        res.status(500).json({ error: 'KAP verisi temizlenemedi' });
    }
});

// API: FVT Data - Get all
app.get('/api/fvt-data', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM fvt_data ORDER BY fon_kodu').all();
        res.json({ data: rows, count: rows.length });
    } catch (err) {
        res.status(500).json({ error: 'FVT verisi okunamadı' });
    }
});

// API: FVT Data - Fetch from FVT API and save
app.post('/api/fvt-fetch', async (req, res) => {
    try {
        const apiUrl = 'https://fvt.com.tr/api/?islem=yatirimfonlari';

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'origin': 'https://fvt.com.tr',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'filtreler[islem]=1'
        });

        if (!response.ok) {
            throw new Error(`FVT API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.json({ success: true, data: [], count: 0, message: 'FVT API\'den veri alınamadı.' });
        }

        const now = new Date().toISOString();
        const saveTransaction = db.transaction((rows) => {
            db.prepare('DELETE FROM fvt_data').run();
            const insert = db.prepare(`
                INSERT INTO fvt_data (
                    fon_kodu, fon_adi, kategoriAdi, haftalik_getiri, aylik_getiri,
                    uc_aylik_getiri, alti_aylik_getiri, ytd_getiri, bir_yillik_getiri,
                    uc_yillik_getiri, bes_yillik_getiri, stopaj, yonetim_ucret, fonlink, fetchedAt
                ) VALUES (
                    @fon_kodu, @fon_adi, @kategoriAdi, @haftalik_getiri, @aylik_getiri,
                    @uc_aylik_getiri, @alti_aylik_getiri, @ytd_getiri, @bir_yillik_getiri,
                    @uc_yillik_getiri, @bes_yillik_getiri, @stopaj, @yonetim_ucret, @fonlink, @fetchedAt
                )
            `);
            for (const row of rows) {
                insert.run({
                    fon_kodu: row.fon_kodu || null,
                    fon_adi: row.fon_adi || null,
                    kategoriAdi: row.kategoriAdi || null,
                    haftalik_getiri: row.haftalik_getiri != null ? parseFloat(row.haftalik_getiri) : null,
                    aylik_getiri: row.aylik_getiri != null ? parseFloat(row.aylik_getiri) : null,
                    uc_aylik_getiri: row.uc_aylik_getiri != null ? parseFloat(row.uc_aylik_getiri) : null,
                    alti_aylik_getiri: row.alti_aylik_getiri != null ? parseFloat(row.alti_aylik_getiri) : null,
                    ytd_getiri: row.ytd_getiri != null ? parseFloat(row.ytd_getiri) : null,
                    bir_yillik_getiri: row.bir_yillik_getiri != null ? parseFloat(row.bir_yillik_getiri) : null,
                    uc_yillik_getiri: row.uc_yillik_getiri != null ? parseFloat(row.uc_yillik_getiri) : null,
                    bes_yillik_getiri: row.bes_yillik_getiri != null ? parseFloat(row.bes_yillik_getiri) : null,
                    stopaj: row.stopaj != null ? parseFloat(row.stopaj) : null,
                    yonetim_ucret: row.yonetim_ucret != null ? parseFloat(row.yonetim_ucret) : null,
                    fonlink: row.fonlink || null,
                    fetchedAt: now
                });
            }
        });
        saveTransaction(data);

        res.json({ success: true, data: data, count: data.length, updatedAt: now });

    } catch (err) {
        console.error('FVT fetch error:', err);
        res.status(500).json({ error: 'FVT verisi çekilemedi: ' + err.message });
    }
});

// API: FVT Data - Delete (clear all)
app.delete('/api/fvt-clear', (req, res) => {
    try {
        db.prepare('DELETE FROM fvt_data').run();
        res.json({ success: true, message: 'FVT verileri temizlendi' });
    } catch (err) {
        res.status(500).json({ error: 'FVT verisi temizlenemedi' });
    }
});

// API: FVT Favorites - Get all with full data
app.get('/api/fvt-favorites-data', (req, res) => {
    try {
        const favRows = db.prepare('SELECT code FROM fvt_favorites ORDER BY createdAt DESC').all();
        const codes = favRows.map(r => r.code);
        if (codes.length === 0) {
            return res.json({ data: [], count: 0 });
        }
        const placeholders = codes.map(() => '?').join(',');
        const rows = db.prepare(`SELECT * FROM fvt_data WHERE fon_kodu IN (${placeholders}) ORDER BY fon_kodu`).all(...codes);
        res.json({ data: rows, count: rows.length });
    } catch (err) {
        res.status(500).json({ error: 'FVT Favori verileri okunamadı' });
    }
});

// API: FVT Favorites - Get real-time data for all favorites
app.get('/api/fvt-favorites-realtime', async (req, res) => {
    try {
        const favRows = db.prepare('SELECT code FROM fvt_favorites ORDER BY createdAt DESC').all();
        const codes = favRows.map(r => r.code);
        if (codes.length === 0) {
            return res.json({ data: [], count: 0 });
        }

        const placeholders = codes.map(() => '?').join(',');
        const funds = db.prepare(`SELECT fon_kodu, fon_adi, fonlink FROM fvt_data WHERE fon_kodu IN (${placeholders})`).all(...codes);

        const results = [];
        for (const fund of funds) {
            if (!fund.fonlink) {
                results.push({ code: fund.fon_kodu, name: fund.fon_adi, change: null, error: 'No link' });
                continue;
            }

            try {
                const fundUrl = `https://fvt.com.tr/yatirim-fonlari/${fund.fonlink}/`;
                const response = await fetch(fundUrl, {
                    headers: {
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                if (!response.ok) {
                    results.push({ code: fund.fon_kodu, name: fund.fon_adi, change: null, error: 'Fetch error' });
                    continue;
                }

                const html = await response.text();

                // Extract change value from h5 > span element (XPath: //*[@id="main-content"]/div[1]/div/div[1]/div/div/div[2]/div/div/div/div[1]/h5/span)
                const h5SpanMatch = html.match(/<h5[^>]*class="[^"]*updated[^"]*"[^>]*>[\s\S]*?<span[^>]*>([+-]?\d+[.,]?\d*)\s*%?<\/span>/i);
                const anyH5SpanMatch = html.match(/<h5[^>]*>[^<]*<span[^>]*>([+-]?\d+[.,]?\d*)\s*%?<\/span>/i);
                const updatedMatch = html.match(/<h5[^>]*>\s*<span[^>]*>([+-]?\d+[.,]?\d*)\s*%?/i);

                let change = null;
                if (h5SpanMatch) {
                    change = h5SpanMatch[1].replace(',', '.');
                } else if (anyH5SpanMatch) {
                    change = anyH5SpanMatch[1].replace(',', '.');
                } else if (updatedMatch) {
                    change = updatedMatch[1].replace(',', '.');
                }

                results.push({ code: fund.fon_kodu, name: fund.fon_adi, change: change });
            } catch (err) {
                results.push({ code: fund.fon_kodu, name: fund.fon_adi, change: null, error: err.message });
            }
        }

        res.json({ data: results, count: results.length });
    } catch (err) {
        res.status(500).json({ error: 'FVT Favori realtime verileri okunamadı' });
    }
});

// API: FVT Single Fund - Get real-time data from FVT website
app.get('/api/fvt-fund/:code', async (req, res) => {
    try {
        const code = req.params.code;
        // First get the fonlink from database
        const fund = db.prepare('SELECT fonlink, fon_kodu, fon_adi FROM fvt_data WHERE fon_kodu = ?').get(code);
        if (!fund || !fund.fonlink) {
            return res.status(404).json({ error: 'Fon bulunamadı' });
        }

        // Fetch from FVT website
        const fundUrl = `https://fvt.com.tr/yatirim-fonlari/${fund.fonlink}/`;
        const response = await fetch(fundUrl, {
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`FVT fetch error: ${response.status}`);
        }

        const html = await response.text();

        // Extract change value using XPath-like approach
        // The XPath: //*[@id="main-content"]/div[1]/div/div[1]/div/div/div[2]/div/div/div/div[1]/h5/span
        // Looking for: #main-content > div:nth-child(1) > div > div.card.fvt-card > div > div > div.col-12.col-sm-12.col-xxl-auto.mb-3.mb-md-0.bg-none > div > div > div > div.col-auto.text-start.bg-none.py-2.updated > h5 > span

        // Match the updated section containing h5 > span with the change value
        const h5SpanMatch = html.match(/<h5[^>]*class="[^"]*updated[^"]*"[^>]*>[\s\S]*?<span[^>]*>([+-]?\d+[.,]?\d*)\s*%?<\/span>/i);
        const anyH5SpanMatch = html.match(/<h5[^>]*>[^<]*<span[^>]*>([+-]?\d+[.,]?\d*)\s*%?<\/span>/i);
        const updatedMatch = html.match(/<h5[^>]*>\s*<span[^>]*>([+-]?\d+[.,]?\d*)\s*%?/i);
        const priceMatch = html.match(/<h5[^>]*>[^<]*<span[^>]*>([\d.,]+)<\/span>/i);

        let change = null;
        if (h5SpanMatch) {
            change = h5SpanMatch[1].replace(',', '.');
        } else if (anyH5SpanMatch) {
            change = anyH5SpanMatch[1].replace(',', '.');
        } else if (updatedMatch) {
            change = updatedMatch[1].replace(',', '.');
        }

        const result = {
            code: fund.fon_kodu,
            name: fund.fon_adi,
            url: fundUrl,
            change: change,
            price: priceMatch ? priceMatch[1].replace(',', '.') : null,
            debug: {
                h5SpanMatch: h5SpanMatch ? h5SpanMatch[1] : null,
                anyH5SpanMatch: anyH5SpanMatch ? anyH5SpanMatch[1] : null,
                updatedMatch: updatedMatch ? updatedMatch[1] : null
            }
        };

        res.json(result);
    } catch (err) {
        console.error('FVT fund fetch error:', err);
        res.status(500).json({ error: 'Fon verisi çekilemedi: ' + err.message });
    }
});

// API: KAP Data - Fetch from KAP API (proxy)
app.post('/api/kap-data/fetch', async (req, res) => {
    try {
        const apiUrl = 'https://www.kap.org.tr/tr/api/disclosure/list/main';

        // Get current date in TR format
        const now = new Date();
        const formatDateTR = (d) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}.${month}.${year}`;
        };
        const currentDate = formatDateTR(now);

        const payload = {
            disclosureTypes: null,
            fromDate: currentDate,
            fundTypes: ["YF"], // Yatırım Fonları
            memberTypes: null,
            mkkMemberOid: null,
            toDate: currentDate
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`KAP API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            return res.json({ success: true, data: [], message: 'Belirtilen tarihler için KAP\'ta (YF) bildirimi bulunamadı.' });
        }

        // Process data
        const processedData = [];
        data.forEach(item => {
            const basic = item.disclosureBasic;
            if (basic) {
                processedData.push({
                    stockCode: basic.stockCode || '',
                    publishDate: basic.publishDate || '',
                    title: basic.title || '',
                    companyTitle: basic.companyTitle || '',
                    summary: basic.summary || '',
                    disclosureCategory: basic.disclosureCategory || '',
                    url: basic.disclosureIndex ? `https://www.kap.org.tr/tr/Bildirim/${basic.disclosureIndex}` : ''
                });
            }
        });

        // Save to database
        const nowISO = new Date().toISOString();
        const saveTransaction = db.transaction((rows) => {
            db.prepare('DELETE FROM kap_data').run();
            const insert = db.prepare(`
                INSERT INTO kap_data (stockCode, publishDate, title, companyTitle, summary, disclosureCategory, url, fetchedAt)
                VALUES (@stockCode, @publishDate, @title, @companyTitle, @summary, @disclosureCategory, @url, @fetchedAt)
            `);
            for (const row of rows) {
                insert.run({
                    stockCode: row.stockCode || null,
                    publishDate: row.publishDate || null,
                    title: row.title || null,
                    companyTitle: row.companyTitle || null,
                    summary: row.summary || null,
                    disclosureCategory: row.disclosureCategory || null,
                    url: row.url || null,
                    fetchedAt: nowISO
                });
            }
        });
        saveTransaction(processedData);

        res.json({ success: true, data: processedData, count: processedData.length, updatedAt: nowISO });

    } catch (err) {
        console.error('KAP fetch error:', err);
        res.status(500).json({ error: 'KAP verisi çekilemedi: ' + err.message });
    }
});

// Proxy TEFAS requests
app.use('/api', createProxyMiddleware({
    target: 'https://www.tefas.gov.tr',
    changeOrigin: true,
    pathRewrite: {
        '^/api': '/api'
    }
}));

// Serve static files from build
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
