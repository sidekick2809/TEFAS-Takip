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
        note      TEXT
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

app.use(cors());
app.use(express.json());

// API: Portfolio - Get
app.get('/api/local-portfolio', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM portfolio ORDER BY id').all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Veri okunamadı' });
    }
});

// API: Portfolio - Save (full replace)
app.post('/api/local-portfolio', (req, res) => {
    try {
        const rows = req.body;
        if (!Array.isArray(rows)) {
            return res.status(400).json({ error: 'Geçersiz veri formatı' });
        }
        const replace = db.transaction((data) => {
            db.prepare('DELETE FROM portfolio').run();
            const insert = db.prepare(`
                INSERT INTO portfolio (id, code, name, lots, buyPrice, buyDate, type, note)
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
        res.status(500).json({ error: 'Veri kaydedilemedi' });
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
