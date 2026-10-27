/**
 * Price providers behind one interface.
 *
 * Every provider returns the same shape, so callers never branch on which one
 * answered:
 *
 *     { date: 'YYYY-MM-DD', price: <number> }    // USD per coin, UTC calendar day
 *
 * Each provider implements:
 *     name              short id used in logs
 *     needsKey          true if it is unusable without a secret
 *     supports(coin)    can it serve this asset at all
 *     day(coin, date)   one day, or null if that day is not available
 *     history(coin, from)  everything from `from` (inclusive) onward
 *
 * Order matters: PROVIDERS is tried top to bottom and the first usable answer
 * wins. Keyless, documented-methodology sources come first; the keyed one is
 * last because it has a lifetime call quota and a non-commercial licence.
 */

const UA = { 'User-Agent': 'whatifbtc/1.0 (+https://whatifbtc.com)' };
const DAY_MS = 86400000;

const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
/**
 * Keeps enough digits for the asset's scale. Two decimals is right for a
 * $84,000 bitcoin and catastrophic for a $0.0015 dogecoin: rounding there
 * turns two thousand real prices into zeros. Below a dollar we keep six
 * significant figures instead.
 */
const roundPrice = n => {
    const v = Number(n);
    if (!Number.isFinite(v)) return NaN;
    return v >= 1 ? +v.toFixed(2) : +v.toPrecision(6);
};
const sane = n => Number.isFinite(n) && n > 0;

async function getJSON(url, tries = 3) {
    let lastErr;
    for (let attempt = 1; attempt <= tries; attempt++) {
        try {
            const res = await fetch(url, { headers: UA });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            lastErr = err;
            if (attempt < tries) await new Promise(r => setTimeout(r, attempt * 1500));
        }
    }
    throw lastErr;
}

/** Drops duplicates and anything unusable, then sorts oldest first. */
function normalize(rows) {
    const byDate = new Map();
    for (const r of rows) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !sane(r.price)) continue;
        byDate.set(r.date, roundPrice(r.price));
    }
    return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, price]) => ({ date, price }));
}

// ---------------------------------------------------------------------------
// 1. Coin Metrics — reference rate, no key, 1145 assets, history from 2010-07-18
// ---------------------------------------------------------------------------

const coinmetrics = {
    name: 'coinmetrics',
    needsKey: false,
    supports: () => true,          // the catalogue covers far more than we ask for
    async history(coin, from = '2010-01-01') {
        const rows = [];
        let url = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics'
                + `?assets=${encodeURIComponent(coin)}&metrics=PriceUSD&frequency=1d`
                + `&start_time=${from}&page_size=10000`;
        let page = 0;
        while (url && page < 50) {
            const data = await getJSON(url);
            for (const r of data.data || []) rows.push({ date: r.time.slice(0, 10), price: parseFloat(r.PriceUSD) });
            url = data.next_page_url;
            page++;
        }
        return normalize(rows);
    },
    async day(coin, date) {
        const url = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics'
                  + `?assets=${encodeURIComponent(coin)}&metrics=PriceUSD&frequency=1d`
                  + `&start_time=${date}&end_time=${date}&page_size=1`;
        const data = await getJSON(url);
        const r = (data.data || [])[0];
        if (!r) return null;
        const price = parseFloat(r.PriceUSD);
        return sane(price) ? { date: r.time.slice(0, 10), price: roundPrice(price) } : null;
    },
};

// ---------------------------------------------------------------------------
// 2. Bitstamp — a real exchange's daily close, no key, history from 2011-08-18
// ---------------------------------------------------------------------------

const BITSTAMP_PAIRS = { btc: 'btcusd', eth: 'ethusd', ltc: 'ltcusd', xrp: 'xrpusd', bch: 'bchusd', link: 'linkusd' };

const bitstamp = {
    name: 'bitstamp',
    needsKey: false,
    supports: coin => coin in BITSTAMP_PAIRS,
    async history(coin, from = '2011-08-01') {
        const pair = BITSTAMP_PAIRS[coin];
        const rows = [];
        let start = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
        const now = Math.floor(Date.now() / 1000);
        while (start < now) {
            const data = await getJSON(`https://www.bitstamp.net/api/v2/ohlc/${pair}/?step=86400&limit=1000&start=${start}`);
            const candles = data?.data?.ohlc || [];
            if (!candles.length) break;
            for (const c of candles) rows.push({ date: isoDay(+c.timestamp * 1000), price: parseFloat(c.close) });
            start = +candles[candles.length - 1].timestamp + 86400;
            await new Promise(r => setTimeout(r, 300));
        }
        return normalize(rows);
    },
    async day(coin, date) {
        const pair = BITSTAMP_PAIRS[coin];
        const start = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
        const data = await getJSON(`https://www.bitstamp.net/api/v2/ohlc/${pair}/?step=86400&limit=2&start=${start}`);
        const c = (data?.data?.ohlc || []).find(x => isoDay(+x.timestamp * 1000) === date);
        if (!c) return null;
        const price = parseFloat(c.close);
        return sane(price) ? { date, price: roundPrice(price) } : null;
    },
};

// ---------------------------------------------------------------------------
// 3. blockchain.com — aggregate market price, no key, BTC only, from 2010-08-18
//    Known to use a different intraday convention: kept as a fallback, not a
//    primary, because it diverges from the other two on older dates.
// ---------------------------------------------------------------------------

const blockchain = {
    name: 'blockchain',
    needsKey: false,
    supports: coin => coin === 'btc',
    async history(_coin, from = '2010-01-01') {
        const data = await getJSON('https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false');
        return normalize((data.values || [])
            .map(p => ({ date: isoDay(p.x * 1000), price: p.y }))
            .filter(r => r.date >= from));
    },
    async day(coin, date) {
        const all = await this.history(coin, date);
        return all.find(r => r.date === date) || null;
    },
};

// ---------------------------------------------------------------------------
// 4. CoinDesk (formerly CryptoCompare) — needs a key, lifetime call cap,
//    non-commercial on the free tier. Last resort only.
// ---------------------------------------------------------------------------

const coindesk = {
    name: 'coindesk',
    needsKey: true,
    supports: () => Boolean(process.env.COINDESK_API_KEY || process.env.CRYPTOCOMPARE_API_KEY),
    async history(coin, from = '2010-01-01') {
        const key = process.env.COINDESK_API_KEY || process.env.CRYPTOCOMPARE_API_KEY;
        const toTs = Math.floor(Date.now() / 1000);
        const data = await getJSON('https://min-api.cryptocompare.com/data/v2/histoday'
            + `?fsym=${coin.toUpperCase()}&tsym=USD&limit=2000&toTs=${toTs}&api_key=${key}`);
        if (data.Response !== 'Success') throw new Error(data.Message || 'bad response');
        return normalize((data.Data?.Data || [])
            .map(d => ({ date: isoDay(d.time * 1000), price: d.close }))
            .filter(r => r.date >= from));
    },
    async day(coin, date) {
        const key = process.env.COINDESK_API_KEY || process.env.CRYPTOCOMPARE_API_KEY;
        const ts = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
        const data = await getJSON('https://min-api.cryptocompare.com/data/v2/histoday'
            + `?fsym=${coin.toUpperCase()}&tsym=USD&limit=1&toTs=${ts}&api_key=${key}`);
        if (data.Response !== 'Success') throw new Error(data.Message || 'bad response');
        const d = (data.Data?.Data || []).find(x => x.time === ts);
        return d && sane(d.close) ? { date, price: roundPrice(d.close) } : null;
    },
};

const PROVIDERS = [coinmetrics, bitstamp, blockchain, coindesk];

/**
 * Walks the chain until someone answers. Returns {row, provider} or null.
 * `onTry` is called per attempt so callers can log the chain they walked.
 */
async function firstAnswer(method, coin, arg, { onTry = () => {} } = {}) {
    for (const p of PROVIDERS) {
        if (!p.supports(coin)) { onTry(p.name, 'unsupported'); continue; }
        try {
            const out = await p[method](coin, arg);
            const empty = out == null || (Array.isArray(out) && out.length === 0);
            if (empty) { onTry(p.name, 'empty'); continue; }
            onTry(p.name, 'ok');
            return { data: out, provider: p.name };
        } catch (err) {
            onTry(p.name, `error: ${err.message}`);
        }
    }
    return null;
}

module.exports = { PROVIDERS, firstAnswer, normalize, roundPrice, DAY_MS, isoDay };
