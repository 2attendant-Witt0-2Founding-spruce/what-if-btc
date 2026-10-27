/**
 * Reading and writing the per-coin price files.
 *
 * One pair of files per asset, named by the asset:
 *     dates/history-btc.json   [{ "date": "YYYY-MM-DD", "price": 123.45 }, ...]
 *     dates/history-btc.csv    date,price
 *
 * The JSON is what the site fetches; the CSV is the human-readable twin and the
 * source of truth the update job reads back. They are always written together
 * so they cannot drift apart.
 */

const path = require('path');
const fs = require('fs').promises;
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');

const { roundPrice } = require('./providers');

const DIR = 'dates';
const jsonPath = coin => path.join(DIR, `history-${coin}.json`);
const csvPath  = coin => path.join(DIR, `history-${coin}.csv`);

/** @returns {Promise<Map<string, number>>} empty map if the coin has no file yet */
async function load(coin) {
    try {
        const text = await fs.readFile(csvPath(coin), 'utf8');
        const rows = await new Promise((resolve, reject) => {
            parse(text, { columns: true, skip_empty_lines: true }, (e, d) => (e ? reject(e) : resolve(d)));
        });
        return new Map(rows.map(r => [r.date, parseFloat(r.price)]));
    } catch (err) {
        if (err.code === 'ENOENT') return new Map();
        throw err;
    }
}

/** Writes both files from a date→price map, sorted oldest first. */
async function save(coin, byDate) {
    const rows = [...byDate.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, price]) => ({ date, price: roundPrice(price) }));

    const csv = await new Promise((resolve, reject) => {
        stringify(rows, { header: true }, (e, d) => (e ? reject(e) : resolve(d)));
    });
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(csvPath(coin), csv);
    await fs.writeFile(jsonPath(coin), JSON.stringify(rows, null, 2));
    return rows;
}

/** Calendar days inside the covered range that have no price. */
function gaps(byDate) {
    const keys = [...byDate.keys()].sort();
    const out = [];
    for (let i = 1; i < keys.length; i++) {
        const prev = Date.parse(`${keys[i - 1]}T00:00:00Z`);
        const cur  = Date.parse(`${keys[i]}T00:00:00Z`);
        for (let t = prev + 86400000; t < cur; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
    }
    return out;
}

async function listCoins() {
    try {
        const files = await fs.readdir(DIR);
        return files.filter(f => /^history-[a-z0-9]+\.csv$/.test(f))
                    .map(f => f.slice('history-'.length, -'.csv'.length))
                    .sort();
    } catch { return []; }
}

module.exports = { load, save, gaps, listCoins, jsonPath, csvPath, DIR };
