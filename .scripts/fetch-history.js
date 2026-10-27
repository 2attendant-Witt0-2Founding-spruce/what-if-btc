/**
 * Downloads the full history for one or more coins and writes dates/history-<coin>.*
 *
 *     node .scripts/fetch-history.js btc
 *     node .scripts/fetch-history.js eth ltc doge xrp
 *     node .scripts/fetch-history.js --all          # everything in coins.json
 *     node .scripts/fetch-history.js btc --keep-head   # do not touch dates older
 *                                                      # than the provider's reach
 *
 * Providers are tried in order until one returns a series. This is the heavy
 * job — it replaces the file rather than appending, so it is deliberately not
 * part of the daily workflow.
 *
 * --keep-head matters for BTC only: the series starts 2009-10-05 with a seed no
 * free provider reaches (Coin Metrics begins 2010-07-18). Without the flag the
 * early months would be lost on every refetch.
 */

const path = require('path');
const fs = require('fs');
const { firstAnswer } = require('./lib/providers');
const store = require('./lib/store');

const log = (...a) => console.log(...a);

function parseArgs() {
    const args = process.argv.slice(2);
    const flags = new Set(args.filter(a => a.startsWith('--')));
    let coins = args.filter(a => !a.startsWith('-')).map(c => c.toLowerCase());
    if (flags.has('--all') || !coins.length) {
        const cfg = JSON.parse(fs.readFileSync(path.join('.scripts', 'coins.json'), 'utf8'));
        coins = coins.length ? coins : (flags.has('--all') ? cfg.available : cfg.daily);
    }
    return { coins, keepHead: flags.has('--keep-head'), dry: flags.has('--dry-run') };
}

async function fetchCoin(coin, { keepHead, dry }) {
    log(`\n── ${coin.toUpperCase()} ──`);
    const existing = await store.load(coin);
    if (existing.size) log(`  on disk: ${existing.size} rows, ${[...existing.keys()].sort()[0]} … ${[...existing.keys()].sort().at(-1)}`);

    const chain = [];
    const answer = await firstAnswer('history', coin, '2009-01-01', { onTry: (n, s) => chain.push(`${n}:${s}`) });
    log(`  providers: ${chain.join(', ')}`);
    if (!answer) { log('  no provider returned a history — skipping'); return null; }

    const fetched = answer.data;
    log(`  fetched: ${fetched.length} rows, ${fetched[0].date} … ${fetched.at(-1).date} (${answer.provider})`);

    const merged = new Map();
    if (keepHead && existing.size) {
        const firstNew = fetched[0].date;
        let kept = 0;
        for (const [d, p] of existing) if (d < firstNew) { merged.set(d, p); kept++; }
        if (kept) log(`  head kept: ${kept} rows before ${firstNew}`);
    }
    for (const r of fetched) merged.set(r.date, r.price);

    const holes = store.gaps(merged);
    if (holes.length) log(`  WARNING: ${holes.length} calendar gaps, first: ${holes.slice(0, 5).join(', ')}`);

    if (dry) { log('  --dry-run: files untouched'); return merged; }

    const rows = await store.save(coin, merged);
    log(`  wrote ${rows.length} rows → ${store.jsonPath(coin)} and ${store.csvPath(coin)}`);
    return merged;
}

async function main() {
    const { coins, keepHead, dry } = parseArgs();
    log(`Coins: ${coins.join(', ')}${keepHead ? ' | --keep-head' : ''}${dry ? ' | --dry-run' : ''}`);
    for (const coin of coins) {
        try { await fetchCoin(coin, { keepHead, dry }); }
        catch (err) { log(`  ERROR on ${coin}: ${err.message}`); }
    }
}

if (require.main === module) {
    main().catch(err => { console.error('FATAL', err); process.exit(1); });
}
