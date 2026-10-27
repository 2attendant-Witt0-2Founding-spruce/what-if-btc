/**
 * Daily update. Fetches exactly the days that are missing — normally one — for
 * every coin listed in .scripts/coins.json, and appends them.
 *
 *     node .scripts/process-data.js             # coins from coins.json
 *     node .scripts/process-data.js btc eth     # just these
 *
 * Providers are tried in order (Coin Metrics → Bitstamp → blockchain.com →
 * CoinDesk-with-key) and the first usable answer wins, so one provider having a
 * bad day does not freeze the series. Which one answered is written to the log.
 *
 * Existing dates are never overwritten: this job appends. Rewriting history is
 * the job of sync-history.js, which does it deliberately and reports the diff.
 *
 * Exits non-zero if a coin ends up more than MAX_STALE_DAYS behind — a frozen
 * series should break the build, not sit there quietly serving old prices.
 */

const path = require('path');
const fs = require('fs');
const { firstAnswer } = require('./lib/providers');
const store = require('./lib/store');

const logger = {
    info:  m => console.log(`INFO: ${new Date().toISOString()} - ${m}`),
    warn:  m => console.warn(`WARN: ${new Date().toISOString()} - ${m}`),
    error: m => console.error(`ERROR: ${new Date().toISOString()} - ${m}`),
};

const MAX_STALE_DAYS = 3;
const MAX_BACKFILL_DAYS = 30;   // more than this means something is wrong; say so

function coinList() {
    const fromArgs = process.argv.slice(2).filter(a => !a.startsWith('-'));
    if (fromArgs.length) return fromArgs.map(c => c.toLowerCase());
    const cfg = JSON.parse(fs.readFileSync(path.join('.scripts', 'coins.json'), 'utf8'));
    return cfg.daily;
}

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function updateCoin(coin) {
    const byDate = await store.load(coin);
    if (!byDate.size) {
        logger.error(`${coin}: no history file. Run fetch-history.js ${coin} first`);
        return { coin, ok: false };
    }

    const last = [...byDate.keys()].sort().at(-1);
    // Yesterday UTC is the newest day any of these providers can have closed.
    const target = addDays(today(), -1);

    const missing = [];
    for (let d = addDays(last, 1); d <= target; d = addDays(d, 1)) missing.push(d);

    if (!missing.length) {
        logger.info(`${coin}: already current (last day ${last})`);
        return { coin, ok: true, added: 0, last };
    }
    if (missing.length > MAX_BACKFILL_DAYS) {
        logger.warn(`${coin}: missing ${missing.length} days — more than a daily update. `
                  + `Taking the last ${MAX_BACKFILL_DAYS} only; the rest is a job for fetch-history.js`);
        missing.splice(0, missing.length - MAX_BACKFILL_DAYS);
    }

    let added = 0;
    for (const date of missing) {
        const chain = [];
        const answer = await firstAnswer('day', coin, date, { onTry: (n, s) => chain.push(`${n}:${s}`) });
        if (!answer) {
            logger.warn(`${coin} ${date}: nobody answered [${chain.join(', ')}]`);
            continue;
        }
        byDate.set(answer.data.date, answer.data.price);
        added++;
        logger.info(`${coin} ${answer.data.date} = $${answer.data.price} (${answer.provider})`
                  + (chain.length > 1 ? ` [${chain.join(', ')}]` : ''));
    }

    const newest = [...byDate.keys()].sort().at(-1);
    const ageDays = Math.floor((Date.now() - Date.parse(`${newest}T00:00:00Z`)) / 86400000);
    if (added) {
        const rows = await store.save(coin, byDate);
        logger.info(`${coin}: wrote ${rows.length} rows, newest ${newest}`);
    }

    if (ageDays > MAX_STALE_DAYS) {
        logger.error(`${coin}: newest row ${newest} is ${ageDays} days old (limit ${MAX_STALE_DAYS}). `
                   + 'The sources look unreachable — failing so this does not go unnoticed.');
        return { coin, ok: false, added, last: newest };
    }
    return { coin, ok: true, added, last: newest };
}

async function main() {
    const coins = coinList();
    logger.info(`Coins: ${coins.join(', ')}`);

    const results = [];
    for (const coin of coins) results.push(await updateCoin(coin));

    const failed = results.filter(r => !r.ok);
    logger.info(`Done: ${results.filter(r => r.ok).length} ok, ${failed.length} failed, `
              + `rows added: ${results.reduce((n, r) => n + (r.added || 0), 0)}`);
    if (failed.length) process.exit(1);
}

if (require.main === module) {
    main().catch(err => { logger.error(`FATAL: ${err.stack || err.message}`); process.exit(1); });
}
