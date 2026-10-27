#!/usr/bin/env node
/**
 * Experiment, not wired into CI.
 *
 * Builds a daily BTC/USD series from sources that need no API key, compares
 * them against each other and against the series the site ships today, and
 * writes a candidate file next to it. Nothing existing is overwritten.
 *
 *   node .scripts/build-from-open-sources.js            # report only
 *   node .scripts/build-from-open-sources.js --write    # also write the candidate
 *
 * Sources
 *   coinmetrics  reference rate, daily, from 2010-07-18   (community tier)
 *   blockchain   market price, daily, from 2010-08-18     (aggregate)
 *   bitstamp     OHLC close, daily, from 2011-08-18       (single exchange)
 *
 * No source reaches back to 2009. The head of the series stays as it is.
 */

const fs = require('fs').promises;
const path = require('path');

const CURRENT = path.join('dates', 'history-btc.json');
const OUT = path.join('dates', 'history-btc.open.json');
const DAY = 86400;

const iso = ts => new Date(ts * 1000).toISOString().slice(0, 10);
const log = (...a) => console.log(...a);

async function getJSON(url, tries = 3) {
    for (let i = 1; i <= tries; i++) {
        try {
            const r = await fetch(url, { headers: { 'User-Agent': 'whatifbtc-experiment/1.0' } });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await r.json();
        } catch (e) {
            if (i === tries) throw e;
            await new Promise(r => setTimeout(r, 1500 * i));
        }
    }
}

// --- sources: each returns Map<'YYYY-MM-DD', number> ---

async function fromCoinMetrics() {
    const out = new Map();
    let url = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics'
            + '?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2010-01-01&page_size=10000';
    let pages = 0;
    while (url && pages < 20) {
        const d = await getJSON(url);
        for (const row of d.data || []) out.set(row.time.slice(0, 10), parseFloat(row.PriceUSD));
        url = d.next_page_url;
        pages++;
    }
    return out;
}

async function fromBlockchain() {
    const d = await getJSON('https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false');
    const out = new Map();
    for (const p of d.values) if (p.y > 0) out.set(iso(p.x), p.y);
    return out;
}

async function fromBitstamp() {
    const out = new Map();
    let start = Math.floor(Date.UTC(2011, 7, 1) / 1000);
    const now = Math.floor(Date.now() / 1000);
    while (start < now) {
        const url = `https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=${DAY}&limit=1000&start=${start}`;
        const d = await getJSON(url);
        const rows = d?.data?.ohlc || [];
        if (!rows.length) break;
        for (const c of rows) out.set(iso(+c.timestamp), parseFloat(c.close));
        start = +rows[rows.length - 1].timestamp + DAY;
        await new Promise(r => setTimeout(r, 300));
    }
    return out;
}

// --- reporting ---

function describe(name, m) {
    const keys = [...m.keys()].sort();
    if (!keys.length) return log(`  ${name.padEnd(12)} empty`);
    // count missing calendar days inside the covered range
    const first = Date.parse(keys[0] + 'T00:00:00Z'), last = Date.parse(keys.at(-1) + 'T00:00:00Z');
    const span = Math.round((last - first) / 86400000) + 1;
    log(`  ${name.padEnd(12)} ${String(m.size).padStart(5)} points | ${keys[0]} … ${keys.at(-1)} | gaps ${span - m.size}`);
}

function compare(label, a, b) {
    const shared = [...a.keys()].filter(k => b.has(k));
    if (!shared.length) return log(`  ${label}: no shared dates`);
    const diffs = shared.map(k => Math.abs(a.get(k) - b.get(k)) / b.get(k) * 100);
    diffs.sort((x, y) => x - y);
    const med = diffs[Math.floor(diffs.length / 2)];
    const p95 = diffs[Math.floor(diffs.length * 0.95)];
    const worstIdx = diffs.length - 1;
    const worstDate = shared[diffs.indexOf(diffs[worstIdx])];
    log(`  ${label.padEnd(26)} n=${String(shared.length).padStart(5)} | median ${med.toFixed(2)}% | p95 ${p95.toFixed(2)}% | max ${diffs[worstIdx].toFixed(1)}%`);
}

async function main() {
    const write = process.argv.includes('--write');

    log('Loading the keyless sources…\n');
    const results = {};
    for (const [name, fn] of [['coinmetrics', fromCoinMetrics], ['blockchain', fromBlockchain], ['bitstamp', fromBitstamp]]) {
        const t = Date.now();
        try {
            results[name] = await fn();
            log(`  ${name} ok, ${((Date.now() - t) / 1000).toFixed(1)}s`);
        } catch (e) {
            results[name] = new Map();
            log(`  ${name} ERROR: ${e.message}`);
        }
    }

    const current = new Map(JSON.parse(await fs.readFile(CURRENT, 'utf8')).map(x => [x.date, x.price]));

    log('\nCoverage:');
    describe('current', current);
    for (const [n, m] of Object.entries(results)) describe(n, m);

    log('\nDeviations over shared dates:');
    for (const [n, m] of Object.entries(results)) if (m.size) compare(`${n} vs current`, m, current);
    if (results.bitstamp.size && results.coinmetrics.size) compare('bitstamp vs coinmetrics', results.bitstamp, results.coinmetrics);

    log('\nProbe dates:');
    const probes = ['2011-02-09', '2013-11-28', '2017-12-16', '2020-03-12', '2021-11-08', '2025-02-06', '2025-10-07'];
    const head = 'date'.padEnd(12) + ['current', ...Object.keys(results)].map(s => s.padStart(13)).join('');
    log('  ' + head);
    for (const d of probes) {
        const cells = [current, ...Object.values(results)]
            .map(m => (m.has(d) ? m.get(d).toFixed(2) : '—').padStart(13)).join('');
        log('  ' + d.padEnd(12) + cells);
    }

    // candidate series: keep the pre-2011 head as it is, take the rest from one source
    const primary = results.bitstamp.size ? 'bitstamp' : (results.coinmetrics.size ? 'coinmetrics' : null);
    if (!primary) return log('\nNo source answered — no candidate built.');
    const src = results[primary];
    const firstOpen = [...src.keys()].sort()[0];
    const merged = [];
    for (const [date, price] of [...current].sort()) if (date < firstOpen) merged.push({ date, price });
    for (const date of [...src.keys()].sort()) merged.push({ date, price: +src.get(date).toFixed(2) });

    log(`\nCandidate: tail from "${primary}" since ${firstOpen}, head from the current file before it.`);
    log(`  points ${merged.length} | ${merged[0].date} … ${merged.at(-1).date}`);
    const gaps = [];
    for (let i = 1; i < merged.length; i++) {
        const d = (Date.parse(merged[i].date) - Date.parse(merged[i - 1].date)) / 86400000;
        if (d !== 1) gaps.push(`${merged[i - 1].date}→${merged[i].date}`);
    }
    log(`  date breaks: ${gaps.length}${gaps.length ? ' — ' + gaps.slice(0, 5).join(', ') : ''}`);

    if (write) {
        await fs.writeFile(OUT, JSON.stringify(merged, null, 2));
        log(`\nWrote ${OUT} (the live history-btc.json is untouched).`);
    } else {
        log('\nNo file written. Run with --write to save the candidate.');
    }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
