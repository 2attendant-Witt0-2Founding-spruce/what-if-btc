/**
 * Audits a stored series against Coin Metrics and, on request, syncs it.
 *
 *     node .scripts/sync-history.js btc                # report only
 *     node .scripts/sync-history.js btc --fix          # rewrite differing days
 *     node .scripts/sync-history.js --all --tolerance 0.5
 *
 * Why this exists: the series used to carry a silent one-day shift — 620 rows
 * held the opening price while the rest held a close. Nothing caught it for
 * eighteen months because nothing ever compared the file with its source. This
 * script is that comparison, and it is meant to be run by hand or on a slow
 * schedule, never as part of the daily append.
 *
 * It reports four things separately, because they mean different things:
 *   missing    days the reference has and we do not
 *   extra      days we have and the reference does not (the pre-2010 seed)
 *   differing  days where the gap is above --tolerance (default 0.5%)
 *   shifted    a run of days that match the reference's PREVIOUS day better
 *              than its own — the signature of an off-by-one-day bug
 */

const path = require('path');
const fs = require('fs');
const { PROVIDERS } = require('./lib/providers');
const store = require('./lib/store');

const reference = PROVIDERS.find(p => p.name === 'coinmetrics');
const log = (...a) => console.log(...a);
const pct = (a, b) => Math.abs(a - b) / b * 100;
const prevDay = d => new Date(Date.parse(`${d}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

function parseArgs() {
    const args = process.argv.slice(2);
    const flags = new Set(args.filter(a => a.startsWith('--')));
    const tolIdx = args.indexOf('--tolerance');
    const tolerance = tolIdx >= 0 ? parseFloat(args[tolIdx + 1]) : 0.5;
    let coins = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '--tolerance').map(c => c.toLowerCase());
    if (flags.has('--all') || !coins.length) {
        const cfg = JSON.parse(fs.readFileSync(path.join('.scripts', 'coins.json'), 'utf8'));
        coins = coins.length ? coins : (flags.has('--all') ? cfg.available : cfg.daily);
    }
    return { coins, fix: flags.has('--fix'), tolerance };
}

async function auditCoin(coin, { fix, tolerance }) {
    log(`\n── ${coin.toUpperCase()} ──`);
    const mine = await store.load(coin);
    if (!mine.size) { log('  no file — nothing to compare'); return; }

    let ref;
    try {
        ref = new Map((await reference.history(coin, '2009-01-01')).map(r => [r.date, r.price]));
    } catch (err) {
        log(`  reference unavailable: ${err.message}`);
        return;
    }
    log(`  ours ${mine.size} rows, reference ${ref.size}`);

    const missing = [...ref.keys()].filter(d => !mine.has(d));
    const extra   = [...mine.keys()].filter(d => !ref.has(d));
    const shared  = [...mine.keys()].filter(d => ref.has(d)).sort();

    const differing = shared.filter(d => pct(mine.get(d), ref.get(d)) > tolerance);

    // off-by-one detector: is our value closer to the reference's previous day?
    const shifted = shared.filter(d => {
        const p = prevDay(d);
        if (!ref.has(p)) return false;
        return Math.abs(mine.get(d) - ref.get(p)) < Math.abs(mine.get(d) - ref.get(d));
    });

    const devs = shared.map(d => pct(mine.get(d), ref.get(d))).sort((a, b) => a - b);
    const median = devs.length ? devs[Math.floor(devs.length / 2)] : 0;

    log(`  missing here:     ${missing.length}${missing.length ? '  ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? ' …' : '') : ''}`);
    log(`  not in reference: ${extra.length}${extra.length ? `  (${extra.sort()[0]} … ${extra.sort().at(-1)}) — usually the original seed` : ''}`);
    log(`  differ >${tolerance}%: ${differing.length}  | median deviation ${median.toFixed(3)}%`);
    log(`  looks shifted by a day: ${shifted.length} of ${shared.length} (${(shifted.length / shared.length * 100).toFixed(0)}%)`);

    // A shift that starts partway through hides in the overall ratio: the real
    // defect this script was written for covered 620 of 5940 days — 10% overall,
    // but 95% inside its own window. So look for the window, not the average.
    const WINDOW = 90, ALARM = 0.8;
    const isShifted = shared.map(d => shifted.includes(d));
    let worstStart = -1, worstRatio = 0;
    for (let i = 0; i + WINDOW <= isShifted.length; i++) {
        const ratio = isShifted.slice(i, i + WINDOW).filter(Boolean).length / WINDOW;
        if (ratio > worstRatio) { worstRatio = ratio; worstStart = i; }
    }
    if (worstRatio >= ALARM) {
        // widen from the worst window to the full affected stretch
        let a = worstStart, b = worstStart + WINDOW - 1;
        while (a > 0 && isShifted[a - 1]) a--;
        while (b < isShifted.length - 1 && isShifted[b + 1]) b++;
        log(`  ⚠ ONE-DAY SHIFT: ${shared[a]} … ${shared[b]} (${b - a + 1} days, ${(worstRatio * 100).toFixed(0)}% in the worst window).`);
        log('    Values in this stretch sit closer to the reference\'s PREVIOUS day — the');
        log('    series was built on a different slice of the day, an open instead of');
        log('    the reference rate. Appending cannot fix it: use --fix or refetch.');
    }

    if (differing.length) {
        log('  largest deviations:');
        [...differing].sort((a, b) => pct(mine.get(b), ref.get(b)) - pct(mine.get(a), ref.get(a)))
            .slice(0, 8)
            .forEach(d => log(`    ${d}  ours ${mine.get(d).toFixed(2)}  reference ${ref.get(d).toFixed(2)}  (${pct(mine.get(d), ref.get(d)).toFixed(2)}%)`));
    }

    if (!fix) {
        const todo = missing.length + differing.length;
        log(todo ? `  run with --fix to bring ${todo} rows in line with the reference` : '  everything matches');
        return;
    }

    for (const d of missing) mine.set(d, ref.get(d));
    for (const d of differing) mine.set(d, ref.get(d));
    const rows = await store.save(coin, mine);
    log(`  synced: ${missing.length} added, ${differing.length} corrected, ${rows.length} rows total`);
    log(`  rows absent from the reference (${extra.length}) left as they were`);
}

async function main() {
    const opts = parseArgs();
    log(`Audit against Coin Metrics | coins: ${opts.coins.join(', ')} | tolerance ${opts.tolerance}%${opts.fix ? ' | --fix' : ''}`);
    for (const coin of opts.coins) await auditCoin(coin, opts);
}

if (require.main === module) {
    main().catch(err => { console.error('FATAL', err); process.exit(1); });
}
