// URL params: ?amount=150&date=2013-07-10&mode=trade&sell=2021-11&utm_campaign=pizza-day
// Campaigns:  pizza-day | covid-dip | halving-2020 | halving-2024 | ftx-crash | ath-2021 | genesis | bear-2018 | coffee | salary-2013 | dca-2017
// Modes:      lump, dca, trade
// Analytics:  Plausible (always) + Google Analytics G-VSK27SPWCV (consent-gated)

document.addEventListener('DOMContentLoaded', async () => {

    const loadingOverlay      = document.getElementById('loading-overlay');
    const appContainer        = document.getElementById('app-container');
    const mainHeadline        = document.getElementById('main-headline');
    const subtitle            = document.getElementById('subtitle');
    const yearSlider          = document.getElementById('year-slider');
    const monthSlider         = document.getElementById('month-slider');
    const daySlider           = document.getElementById('day-slider');
    const yearMinLabel        = document.getElementById('year-min-label');
    const yearMaxLabel        = document.getElementById('year-max-label');
    const initialInvestmentEl = document.getElementById('initial-investment');
    const currentValueEl      = document.getElementById('current-value');
    const contextCaptionEl    = document.getElementById('context-caption');
    const connectorPath       = document.getElementById('connector-path');
    const svg                 = document.getElementById('connector-svg');
    const yearValueDisplay    = document.getElementById('year-value-display');
    const monthNameDisplay    = document.getElementById('month-name-display');
    const dayValueDisplay     = document.getElementById('day-value-display');
    const yearTrackBg         = document.getElementById('year-track-bg');
    const monthTrackBg        = document.getElementById('month-track-bg');
    const dayTrackBg          = document.getElementById('day-track-bg');
    const selectedDateEl      = document.getElementById('selected-date');

    const investmentInput    = document.getElementById('investment-input');
    const decreaseBtn        = document.getElementById('decrease-investment');
    const increaseBtn        = document.getElementById('increase-investment');
    const notableDatesEl     = document.getElementById('notable-dates');
    const investmentSuffix   = document.getElementById('investment-suffix');
    const investmentLabelEl  = document.getElementById('investment-label');
    const investmentPrefixEl = document.getElementById('investment-prefix');
    const modeBtns           = document.querySelectorAll('.mode-btn');

    const dateLabelEl  = document.getElementById('date-label');
    const valueLabelEl = document.getElementById('value-label');

    const resultCard    = document.getElementById('result-card');
    const dcaChartPanel = document.getElementById('dca-chart-panel');

    const sellYearSlider       = document.getElementById('sell-year-slider');
    const sellMonthSlider      = document.getElementById('sell-month-slider');
    const sellDaySlider        = document.getElementById('sell-day-slider');
    const sellYearValueDisplay = document.getElementById('sell-year-value-display');
    const sellMonthNameDisplay = document.getElementById('sell-month-name-display');
    const sellDayValueDisplay  = document.getElementById('sell-day-value-display');
    const sellYearTrackBg      = document.getElementById('sell-year-track-bg');
    const sellMonthTrackBg     = document.getElementById('sell-month-track-bg');
    const sellDayTrackBg       = document.getElementById('sell-day-track-bg');
    const sellYearMinLabel     = document.getElementById('sell-year-min-label');
    const sellYearMaxLabel     = document.getElementById('sell-year-max-label');
    const sellDateRow          = document.getElementById('sell-date-row');
    const sellDateDisplayEl    = document.getElementById('sell-date-display');

    let investmentAmount = 100;
    let currentMode = 'lump';
    let tradeTab = 'buy';

    const AMOUNT_MIN = 1, AMOUNT_MAX = 1_000_000_000;

    // Month/day the user last asked for. The sliders always show a value clamped
    // to what the calendar and the dataset allow, but the request is remembered:
    // pick JAN 31, switch to FEB (shows 28), switch back to MAR — 31 comes back.
    const desiredBuy  = { month: null, day: null };
    const desiredSell = { month: null, day: null };

    const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    let priceData = new Map();
    let START_DATE, END_DATE, CURRENT_PRICE, CURRENT_DATE;

    const NOTABLE_DATES = [
        // Every price below is the price this dataset holds for that exact date,
        // and every date is the actual extreme it claims to be. Both are checked
        // against dates/history-btc.json, not written by hand.
        { label: 'Pizza Day',     date: '2010-05-22', title: 'Bitcoin Pizza Day — 10,000 BTC for 2 pizzas' },
        { label: '$1K BTC',       date: '2013-11-28', title: 'Bitcoin first crossed $1,000 — $1,007' },
        { label: '2017 ATH',      date: '2017-12-16', title: 'Peak of the 2017 run — $19,641' },
        { label: 'COVID Crash',   date: '2020-03-12', title: 'COVID crash bottom — $4,959' },
        { label: '2021 ATH',      date: '2021-11-08', title: 'Peak of the 2021 run — $67,542' },
        { label: 'FTX Crash',     date: '2022-11-08', title: 'FTX collapse — down to $18,521' },
        { label: '$100K BTC',     date: '2024-12-08', title: 'Bitcoin first crossed $100,000 — $100,799' },
        { label: 'All-Time High', date: '2025-10-06', title: 'The highest daily price so far — $124,824' },
        { label: '2026 Low',      date: '2026-06-30', title: 'Lowest daily price of 2026 — $58,525' },
    ];

    const CONTEXT_CAPTIONS = [
        { max: 0,             text: null },
        { max: 50,            text: 'Less than a tank of gas. Hurts differently.' },
        { max: 200,           text: "A round of drinks you didn't buy." },
        { max: 500,           text: 'A nice dinner out. Not quite retirement.' },
        { max: 1_000,         text: 'A flight to somewhere warmer.' },
        { max: 2_000,         text: 'A month of rent in most cities.' },
        { max: 5_000,         text: 'Three months of groceries. Or one therapy session about this.' },
        { max: 10_000,        text: 'A solid emergency fund.' },
        { max: 25_000,        text: 'A year of college tuition. Or a watch that changes nothing.' },
        { max: 50_000,        text: 'A new car. Paid in full.' },
        { max: 100_000,       text: 'A Tesla. In cash. Still hurts.' },
        { max: 150_000,       text: 'A down payment on a house.' },
        { max: 300_000,       text: 'A starter home in the midwest. Or a parking spot in Manhattan.' },
        { max: 500_000,       text: 'Financial freedom in Southeast Asia.' },
        { max: 750_000,       text: "Enough to quit your job. Not enough to forget you had one." },
        { max: 1_000_000,     text: 'Early retirement in Eastern Europe.' },
        { max: 2_000_000,     text: 'A vineyard in Portugal. Grapes not included.' },
        { max: 5_000_000,     text: 'A house in Austin. Cash.' },
        { max: 10_000_000,    text: 'Tell your boss what you really think.' },
        { max: 20_000_000,    text: '14 years of doing nothing. In Bali.' },
        { max: 50_000_000,    text: 'Buy the island. Skip the resort.' },
        { max: 100_000_000,   text: 'Your name on a building. A small one.' },
        { max: Infinity,      text: 'Generational wealth. Your grandkids thank you.' },
    ];

    const TEXT_VARIANTS = {
        mainHeadline: {
            diamond: 'Running the numbers on your diamond hands.'
        },
    };

    // Campaign URL presets (utm_campaign=)
    const CAMPAIGNS = {
        'pizza-day': {
            date: '2010-05-22', amount: 41,
            subtitle: 'Laszlo paid 10,000 BTC for 2 pizzas. $41 face value. What if he kept them?'
        },
        'covid-dip': {
            date: '2020-03-12', amount: 100,
            subtitle: 'March 2020 — the world was shutting down. Bitcoin hit $4,959. What if you bought the fear?'
        },
        'halving-2020': {
            date: '2020-05-11', amount: 100,
            subtitle: 'Third halving day. Supply cut in half. Demand didn\'t get the memo.'
        },
        'halving-2024': {
            date: '2024-04-20', amount: 100,
            subtitle: 'Fourth halving — April 2024. The next chapter starts here.'
        },
        'ftx-crash': {
            date: '2022-11-08', amount: 100,
            subtitle: 'FTX collapsed. SBF lied. Bitcoin kept going. It always does.'
        },
        'ath-2021': {
            date: '2021-11-08', amount: 100,
            subtitle: '$67,542. The peak. Everyone said $100K was next. Then it wasn\'t.'
        },
        'genesis': {
            date: '2009-01-12', amount: 100,
            subtitle: 'Block 170 — the first Bitcoin transaction. Satoshi sent 10 BTC to Hal Finney.'
        },
        'bear-2018': {
            date: '2018-12-14', amount: 100,
            subtitle: 'December 2018. Bitcoin down 84% from ATH. The obituaries were being written again.'
        },
        'coffee': {
            date: '2015-01-01', amount: 4, mode: 'dca',
            subtitle: 'One coffee a day. $4/month. What if it went to Bitcoin instead?'
        },
        'salary-2013': {
            date: '2013-01-01', amount: 100,
            subtitle: 'Average US salary in 2013 was ~$3,800/mo. What if just $100 went to Bitcoin?'
        },
        'dca-2017': {
            date: '2017-01-01', amount: 50, mode: 'dca',
            subtitle: '$50/month starting January 2017. Through the crash, through the recovery.'
        },
    };

    const ANNIVERSARY_EVENTS = [
        { month: 1,  day: 3,  emoji: '⛏', title: 'Genesis Block Day',
          text: 'On this day in 2009, Satoshi mined Bitcoin\'s first block.' },
        { month: 5,  day: 22, emoji: '🍕', title: 'Bitcoin Pizza Day',
          text: 'On this day in 2010, 10,000 BTC were paid for 2 pizzas.' },
        { month: 10, day: 31, emoji: '📄', title: 'Bitcoin Whitepaper Day',
          text: 'On this day in 2008, Satoshi published the Bitcoin whitepaper.' },
        { month: 11, day: 28, emoji: '₿',  title: 'First Halving Day (2012)',
          text: 'On this day in 2012, Bitcoin\'s first halving cut the block reward to 25 BTC.' },
        { month: 7,  day: 9,  emoji: '₿',  title: 'Second Halving Day (2016)',
          text: 'On this day in 2016, the block reward dropped to 12.5 BTC.' },
        { month: 5,  day: 11, emoji: '₿',  title: 'Third Halving Day (2020)',
          text: 'On this day in 2020, Bitcoin\'s reward dropped to 6.25 BTC.' },
        { month: 4,  day: 20, emoji: '₿',  title: 'Fourth Halving Day (2024)',
          text: 'On this day in 2024, the block reward dropped to 3.125 BTC.' },
    ];

    const DONATE_COINS = [
        { id: 'btc', name: 'BTC', address: 'bc1qn8ekrvtadknm282xvnke7t0s8qdegpc696g32j' },
        { id: 'ltc', name: 'LTC', address: 'ltc1qgss4xnnrd5lkkqa2uc4kkcmv5w4pw8wfyt88vv' },
        { id: 'eth', name: 'ETH', address: '0xA0e6750f49616f124736Ec84B04c84884855a98A' },
        { id: 'trx', name: 'TRX', address: 'THAcQXrm9TNjVJTt7Ai9UkSJtTM5N7Apnv' },
        { id: 'sol', name: 'SOL', address: 'HfXLFRBZkEkqig6pZRzXactNJBoHY1qHrTCRU3Q2ZBT8' },
    ];

    // --- Dates: one source of truth for what is selectable ---
    // Every path into the UI (sliders, URL, localStorage, pills, campaigns) goes
    // through these, so an impossible date like FEB 31 cannot be produced at all.

    const pad = n => String(n).padStart(2, '0');
    const dateKey = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
    const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

    // Months of `year` that exist in the dataset.
    function getValidMonthRange(year) {
        return {
            min: year === START_DATE.getFullYear() ? START_DATE.getMonth() + 1 : 1,
            max: year === END_DATE.getFullYear()   ? END_DATE.getMonth() + 1   : 12,
        };
    }

    // Days of `year`/`month` that exist both in the calendar and in the dataset.
    function getValidDayRange(year, month) {
        const first = year === START_DATE.getFullYear() && month === START_DATE.getMonth() + 1;
        const last  = year === END_DATE.getFullYear()   && month === END_DATE.getMonth() + 1;
        return {
            min: first ? START_DATE.getDate() : 1,
            max: last  ? END_DATE.getDate()   : daysInMonth(year, month),
        };
    }

    // Pull a slider into its valid window, remembering what was asked for.
    function clampDateSliders(yearSl, monthSl, daySl, desired, floor = null) {
        const year = clamp(+yearSl.value, +yearSl.min, +yearSl.max);
        yearSl.value = year;

        const mr = getValidMonthRange(year);
        if (floor && year === floor.year) mr.min = Math.max(mr.min, floor.month);
        const month = clamp(desired.month ?? +monthSl.value, mr.min, mr.max);
        monthSl.value = month;

        const dr = getValidDayRange(year, month);
        if (floor && year === floor.year && month === floor.month) dr.min = Math.max(dr.min, floor.day);
        const day = clamp(desired.day ?? +daySl.value, dr.min, dr.max);
        daySl.value = day;

        return { year, month, day, monthRange: mr, dayRange: dr };
    }

    // Records what was asked for; nonsense is dropped rather than stored.
    function setDesired(target, field, value) {
        const hi = field === 'month' ? 12 : 31;
        if (Number.isFinite(value)) target[field] = clamp(Math.round(value), 1, hi);
    }

    function isDateInData(y, m, d) {
        if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
        if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return false;
        return priceData.has(dateKey(y, m, d));
    }

    function formatLargeNumber(num) {
        if (num == null || isNaN(num) || !isFinite(num)) return 'N/A';
        if (num < 1_000)             return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
        if (num < 1_000_000)         return '$' + (num / 1_000).toFixed(2) + 'K';
        if (num < 1_000_000_000)     return '$' + (num / 1_000_000).toFixed(2) + 'M';
        if (num < 1_000_000_000_000) return '$' + (num / 1_000_000_000).toFixed(2) + 'B';
        return '$' + (num / 1_000_000_000_000).toFixed(2) + 'T';
    }

    const formatCurrency = (val, precision) =>
        val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: precision });

    function copyToClipboard(text, feedbackEl, message = 'Copied!') {
        const showFeedback = () => {
            if (!feedbackEl) return;
            feedbackEl.textContent = message;
            feedbackEl.style.opacity = '1';
            setTimeout(() => { feedbackEl.style.opacity = '0'; }, 2000);
        };
        const execFallback = () => {
            const el = document.createElement('textarea');
            document.body.appendChild(el);
            el.value = text; el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        };
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(showFeedback).catch(() => { execFallback(); showFeedback(); });
        } else { execFallback(); showFeedback(); }
    }

    function saveState() {
        try {
            localStorage.setItem('whatifbtc_state', JSON.stringify({
                mode:      currentMode,
                year:      yearSlider.value,
                month:     monthSlider.value,
                day:       daySlider.value,
                amount:    investmentAmount,
                sellYear:  sellYearSlider?.value,
                sellMonth: sellMonthSlider?.value,
                sellDay:   sellDaySlider?.value,
            }));
            if (!localStorage.getItem('whatifbtc_consent')) showStorageToast();
        } catch(e) {}
    }

    function restoreState() {
        try {
            const raw = localStorage.getItem('whatifbtc_state');
            if (!raw) return false;
            const s = JSON.parse(raw);
            // Saved state is not trusted: older versions could store an
            // impossible date such as FEB 31. Out-of-range values are moved
            // into range silently — nobody remembers what they picked last month.
            if (s.year)  yearSlider.value = clamp(+s.year, +yearSlider.min, +yearSlider.max);
            if (s.month) setDesired(desiredBuy, 'month', +s.month);
            if (s.day)   setDesired(desiredBuy, 'day',   +s.day);
            if (s.amount && +s.amount > 0) {
                investmentAmount = clamp(+s.amount, AMOUNT_MIN, AMOUNT_MAX);
                if (investmentInput) investmentInput.value = investmentAmount.toFixed(2);
            }
            if (s.sellYear  && sellYearSlider)  sellYearSlider.value = clamp(+s.sellYear, +sellYearSlider.min, +sellYearSlider.max);
            if (s.sellMonth) setDesired(desiredSell, 'month', +s.sellMonth);
            if (s.sellDay)   setDesired(desiredSell, 'day',   +s.sellDay);
            if (s.mode && ['lump','dca','trade'].includes(s.mode)) setMode(s.mode, true);
            return true;
        } catch(e) { return false; }
    }

    function showStorageToast() {
        const toast = document.getElementById('storage-toast');
        if (!toast) return;
        toast.classList.remove('hidden');
        const dismiss = document.getElementById('storage-toast-dismiss');
        const hide = () => {
            toast.classList.add('hidden');
            try { localStorage.setItem('whatifbtc_consent', '1'); } catch(e) {}
        };
        dismiss?.addEventListener('click', hide, { once: true });
        setTimeout(hide, 6000);
    }

    // Screen readers are told the answer, but only once the user stops dragging —
    // announcing every intermediate value makes the slider unusable.
    let announceTimer = null;
    function announceResult(text) {
        const el = document.getElementById('result-announcer');
        if (!el) return;
        clearTimeout(announceTimer);
        announceTimer = setTimeout(() => { el.textContent = text; }, 600);
    }

    function updateUI() {
        const buy = clampDateSliders(yearSlider, monthSlider, daySlider, desiredBuy);
        const year = buy.year, month = buy.month, day = buy.day;

        updateSliderFill(yearSlider,  yearTrackBg);
        updateSliderFill(monthSlider, monthTrackBg, 'var(--accent-color)', buy.monthRange);
        updateSliderFill(daySlider,   dayTrackBg,   'var(--accent-color)', buy.dayRange);

        yearValueDisplay.textContent = year;
        monthNameDisplay.textContent = MONTHS[month - 1];
        dayValueDisplay.textContent  = day;

        const dateString = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const pastPrice  = priceData.get(dateString) || 0;

        if (selectedDateEl) {
            selectedDateEl.textContent = currentMode === 'dca'
                ? `${MONTHS[month - 1]} ${year}`
                : `${MONTHS[month - 1]} ${String(day).padStart(2,'0')}, ${year}`;
        }

        let currentValue = 0, growth = 0, displayInvested = investmentAmount;
        let daysEndDate = CURRENT_DATE;

        if (currentMode === 'dca') {
            const { totalBtc, totalInvested } = calculateDCA(year, month, day);
            currentValue    = totalBtc * CURRENT_PRICE;
            displayInvested = totalInvested;
            growth = totalInvested > 0 ? (currentValue - totalInvested) * 100 / totalInvested : 0;
            renderDCAChart(year, month, day);

        } else if (currentMode === 'trade' && sellYearSlider && sellMonthSlider && sellDaySlider) {
            sellYearSlider.min = year;
            if (sellYearMinLabel) sellYearMinLabel.textContent = year;

            // The sell date can never precede the buy date, and like the buy date
            // it is confined to days that exist in the calendar and in the data.
            const sell = clampDateSliders(
                sellYearSlider, sellMonthSlider, sellDaySlider, desiredSell,
                { year, month, day }
            );
            const sellYear = sell.year, sellMonth = sell.month, sellDay = sell.day;
            const sellPrice = getPriceOnDay(sellYear, sellMonth, sellDay);

            updateSliderFill(sellYearSlider,  sellYearTrackBg,  '#60a5fa');
            updateSliderFill(sellMonthSlider, sellMonthTrackBg, '#60a5fa', sell.monthRange);
            if (sellDayTrackBg) updateSliderFill(sellDaySlider, sellDayTrackBg, '#60a5fa', sell.dayRange);

            if (sellYearValueDisplay)  sellYearValueDisplay.textContent  = sellYear;
            if (sellMonthNameDisplay)  sellMonthNameDisplay.textContent  = MONTHS[sellMonth - 1];
            if (sellDayValueDisplay)   sellDayValueDisplay.textContent   = sellDay;
            if (sellDateDisplayEl)     sellDateDisplayEl.textContent     = `${MONTHS[sellMonth - 1]} ${String(sellDay).padStart(2,'0')}, ${sellYear}`;

            const tradeBuyLabelEl  = document.getElementById('trade-buy-date-label');
            const tradeSellLabelEl = document.getElementById('trade-sell-date-label');
            if (tradeBuyLabelEl)  tradeBuyLabelEl.textContent  = `${MONTHS[month - 1]} ${String(day).padStart(2,'0')}, ${year}`;
            if (tradeSellLabelEl) tradeSellLabelEl.textContent = `${MONTHS[sellMonth - 1]} ${String(sellDay).padStart(2,'0')}, ${sellYear}`;

            daysEndDate = new Date(`${sellYear}-${String(sellMonth).padStart(2,'0')}-${String(sellDay).padStart(2,'0')}T00:00:00`);

            if (pastPrice > 0 && sellPrice > 0) {
                const coinsBought = investmentAmount / pastPrice;
                currentValue = coinsBought * sellPrice;
                growth = (currentValue - investmentAmount) * 100 / investmentAmount;
            } else {
                growth = -100;
            }

        } else if (pastPrice > 0) {
            const coinsBought = investmentAmount / pastPrice;
            currentValue = coinsBought * CURRENT_PRICE;
            growth       = (currentValue - investmentAmount) * 100 / investmentAmount;
        } else {
            growth = -100;
        }

        const selectedDate = new Date(dateString + 'T00:00:00');
        const daysPassed   = Math.max(0, Math.floor((daysEndDate - selectedDate) / (1000 * 3600 * 24)));

        initialInvestmentEl.textContent = formatCurrency(displayInvested, displayInvested < 100 ? 2 : 0);

        const hasResult    = ['dca','trade'].includes(currentMode) ? currentValue > 0 : pastPrice > 0;
        const formattedVal = hasResult ? formatLargeNumber(currentValue) : 'N/A';
        currentValueEl.textContent  = formattedVal;
        currentValueEl.style.fontSize = formattedVal.length > 9 ? '1.75rem' : '2rem';

        if (contextCaptionEl) {
            const caption = hasResult
                ? (CONTEXT_CAPTIONS.find(c => currentValue <= c.max) || CONTEXT_CAPTIONS.at(-1)).text
                : null;
            contextCaptionEl.textContent = caption || '';
        }

        const spokenDate = selectedDateEl ? selectedDateEl.textContent : dateString;
        const spokenSum  = initialInvestmentEl.textContent;
        announceResult(
            currentMode === 'trade'
                ? `${spokenSum} bought ${spokenDate}, sold ${sellDateDisplayEl?.textContent || ''}: ${formattedVal}.`
                : currentMode === 'dca'
                    ? `${spokenSum} invested monthly since ${spokenDate}: ${formattedVal} today.`
                    : `${spokenSum} invested on ${spokenDate}: ${formattedVal} today.`
        );

        updateActivePill();

    }

    // `validRange` dims the part of the track that cannot be selected — short
    // months, and the edges of the dataset — while the scale itself stays put,
    // so the thumb never rescales and the connector curve never jumps.
    function updateSliderFill(slider, trackBg, fillColor = 'var(--accent-color)', validRange = null) {
        const min = +slider.min, max = +slider.max, val = +slider.value;
        const span = max - min;
        const pct = span > 0 ? (val - min) * 100 / span : 100;
        const active = '#333842', disabled = '#22252a';

        if (validRange && span > 0) {
            const startPct = clamp((validRange.min - min) * 100 / span, 0, 100);
            const endPct   = clamp((validRange.max - min) * 100 / span, 0, 100);
            trackBg.style.background =
                `linear-gradient(to right, ${disabled} ${startPct}%, ${active} ${startPct}%, ${active} ${endPct}%, ${disabled} ${endPct}%)`;
        } else {
            trackBg.style.background = active;
        }
        slider.style.background = `linear-gradient(to right, ${fillColor} ${pct}%, transparent ${pct}%)`;
    }

    function getThumbCenter(slider) {
        const r  = slider.getBoundingClientRect();
        const sr = svg.getBoundingClientRect();
        const p  = (slider.max - slider.min) > 0 ? (slider.value - slider.min) / (slider.max - slider.min) : 1;
        return {
            x: r.left - sr.left + (p * (r.width - 24) + 12),
            y: r.top  - sr.top  + r.height / 2
        };
    }

    function drawConnectorLine() {
        if (appContainer.classList.contains('invisible')) return;
        if (currentMode === 'trade' && tradeTab === 'sell' && sellYearSlider && sellMonthSlider && sellDaySlider) {
            const p1 = getThumbCenter(sellYearSlider);
            const p2 = getThumbCenter(sellMonthSlider);
            const p3 = getThumbCenter(sellDaySlider);
            connectorPath.setAttribute('d',
                `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y+(p2.y-p1.y)/2}, ${p2.x} ${p1.y+(p2.y-p1.y)/2}, ${p2.x} ${p2.y}` +
                ` C ${p2.x} ${p2.y+(p3.y-p2.y)/2}, ${p3.x} ${p2.y+(p3.y-p2.y)/2}, ${p3.x} ${p3.y}`);
            connectorPath.style.stroke = '#60a5fa';
            connectorPath.style.filter = 'drop-shadow(0 0 5px rgba(96,165,250,0.7))';
        } else {
            const p1 = getThumbCenter(yearSlider);
            const p2 = getThumbCenter(monthSlider);
            const p3 = getThumbCenter(daySlider);
            connectorPath.setAttribute('d',
                `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y+(p2.y-p1.y)/2}, ${p2.x} ${p1.y+(p2.y-p1.y)/2}, ${p2.x} ${p2.y}` +
                ` C ${p2.x} ${p2.y+(p3.y-p2.y)/2}, ${p3.x} ${p2.y+(p3.y-p2.y)/2}, ${p3.x} ${p3.y}`);
            connectorPath.style.stroke = 'var(--accent-color)';
            connectorPath.style.filter = 'drop-shadow(0 0 5px rgba(255,153,0,0.7))';
        }
    }

    function setMode(mode, silent = false) {
        currentMode = mode;
        modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

        const isDca   = mode === 'dca';
        const isTrade = mode === 'trade';

        investmentSuffix?.classList.toggle('hidden', !isDca);
        document.getElementById('trade-tabs')?.classList.toggle('hidden', !isTrade);
        sellDateRow?.classList.toggle('hidden', !isTrade);
        resultCard?.classList.toggle('hidden', isDca);
        dcaChartPanel?.classList.toggle('hidden', !isDca);
        document.getElementById('dca-months-count')?.classList.toggle('hidden', !isDca);
        document.getElementById('trade-disclaimer')?.classList.toggle('hidden', !isTrade);

        if (!isTrade && tradeTab !== 'buy') {
            tradeTab = 'buy';
            document.querySelectorAll('.trade-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'buy'));
            document.getElementById('buy-sliders')?.classList.remove('hidden');
            document.getElementById('sell-sliders-panel')?.classList.add('hidden');
            connectorPath.style.stroke = 'var(--accent-color)';
            connectorPath.style.filter = 'drop-shadow(0 0 5px rgba(255,153,0,0.7))';
        }

        if (investmentPrefixEl) investmentPrefixEl.textContent = isTrade ? 'If you had invested' : 'If you had invested';
        if (dateLabelEl) {
            dateLabelEl.textContent = isTrade ? 'Purchase Date' : isDca ? 'Start Date' : 'Purchase Date';
        }
        if (valueLabelEl)      valueLabelEl.textContent      = isTrade ? 'You Would Have Gotten' : 'It Would Be Worth';
        if (investmentLabelEl) investmentLabelEl.textContent = isDca ? 'Total Invested' : 'Initial Investment';

        if (!silent) updateAll();
        if (!silent) syncRightPanelHeight();
    }

    function setTradeTab(tab) {
        tradeTab = tab;
        document.querySelectorAll('.trade-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        document.getElementById('buy-sliders')?.classList.toggle('hidden', tab === 'sell');
        document.getElementById('sell-sliders-panel')?.classList.toggle('hidden', tab !== 'sell');
        updateAll();
        syncRightPanelHeight();
    }

    // A contribution on the 31st falls on the 28th/29th/30th in shorter months,
    // the way a real standing order does. Dates outside the dataset return 0 and
    // are skipped by the callers — including the current month, whose
    // contribution day has not arrived yet.
    function getPriceOnDay(year, month, day) {
        const d = Math.min(day, daysInMonth(year, month));
        return priceData.get(dateKey(year, month, d)) || 0;
    }

    function calculateDCA(startYear, startMonth, startDay) {
        let totalBtc = 0, months = 0;
        const endYear  = END_DATE.getFullYear();
        const endMonth = END_DATE.getMonth() + 1;
        let y = startYear, m = startMonth;
        while (y < endYear || (y === endYear && m <= endMonth)) {
            const price = getPriceOnDay(y, m, startDay);
            if (price > 0) { totalBtc += investmentAmount / price; months++; }
            if (++m > 12) { m = 1; y++; }
        }
        return { totalBtc, totalInvested: months * investmentAmount, months };
    }

    // --- Notable Dates ---
    function renderNotableDates() {
        if (!notableDatesEl) return;
        NOTABLE_DATES.forEach(nd => {
            const btn = document.createElement('button');
            btn.className    = 'notable-pill';
            btn.textContent  = nd.label;
            btn.title        = nd.title;
            btn.dataset.date = nd.date;
            btn.addEventListener('click', () => {
                applyDateParam(nd.date, yearSlider, desiredBuy);
                updateAll();
            });
            notableDatesEl.appendChild(btn);
        });

        const wrapper = notableDatesEl.parentElement;
        const prevBtn = document.getElementById('pills-prev');
        const nextBtn = document.getElementById('pills-next');

        function updateArrows() {
            const maxScroll = notableDatesEl.scrollWidth - notableDatesEl.clientWidth;
            wrapper.classList.toggle('can-scroll-left',  notableDatesEl.scrollLeft > 1);
            wrapper.classList.toggle('can-scroll-right', notableDatesEl.scrollLeft < maxScroll - 1);
        }

        notableDatesEl.addEventListener('scroll', updateArrows);
        prevBtn?.addEventListener('click', () => notableDatesEl.scrollBy({ left: -160, behavior: 'smooth' }));
        nextBtn?.addEventListener('click', () => notableDatesEl.scrollBy({ left: 160,  behavior: 'smooth' }));
        requestAnimationFrame(updateArrows);
    }

    function updateActivePill() {
        if (!notableDatesEl) return;
        const current = `${yearSlider.value}-${String(+monthSlider.value).padStart(2,'0')}-${String(+daySlider.value).padStart(2,'0')}`;
        notableDatesEl.querySelectorAll('.notable-pill').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.date === current);
        });
    }

    async function loadPriceData() {
        try {
            const res  = await fetch('dates/history-btc.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            priceData     = new Map(data.map(i => [i.date, i.price]));
            START_DATE    = new Date(data[0].date + 'T00:00:00');
            END_DATE      = new Date(data[data.length - 1].date + 'T00:00:00');
            CURRENT_DATE  = END_DATE;
            CURRENT_PRICE = data[data.length - 1].price;
            return true;
        } catch (err) {
            console.error(err);
            // Without the price data there is no product at all, so the dead end
            // at least offers a way out.
            loadingOverlay.innerHTML =
                '<div class="text-center">' +
                '<p class="text-xl text-red-500">Failed to load price data.</p>' +
                '<button id="retry-load" class="retry-btn">Try again</button>' +
                '</div>';
            document.getElementById('retry-load')?.addEventListener('click', () => window.location.reload());
            return false;
        }
    }

    // Accepts a date only if it is a real calendar date that the dataset covers;
    // anything else leaves the current selection alone.
    function applyDateParam(value, yearSl, desired) {
        if (!value || !yearSl || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [y, m, d] = value.split('-').map(Number);
        if (!isDateInData(y, m, d)) return false;
        yearSl.value = y;
        setDesired(desired, 'month', m);
        setDesired(desired, 'day',   d);
        return true;
    }

    function applyUrlParameters() {
        const params      = new URLSearchParams(window.location.search);
        const amountParam = parseFloat(params.get('amount'));
        if (isFinite(amountParam) && amountParam > 0) {
            investmentAmount = clamp(amountParam, AMOUNT_MIN, AMOUNT_MAX);
            if (investmentInput) investmentInput.value = investmentAmount.toFixed(2);
        }
        applyDateParam(params.get('date'), yearSlider, desiredBuy);
        // `sell` is written as YYYY-MM-DD; links shared before that carried only
        // YYYY-MM, and for those the 1st is assumed rather than whatever day
        // happened to be lying around in this browser.
        const sellParam = params.get('sell');
        if (sellParam && /^\d{4}-\d{2}$/.test(sellParam)) {
            applyDateParam(`${sellParam}-01`, sellYearSlider, desiredSell);
        } else {
            applyDateParam(sellParam, sellYearSlider, desiredSell);
        }
        const modeParam = params.get('mode');
        if (modeParam && ['lump', 'dca', 'trade'].includes(modeParam)) {
            setMode(modeParam, true);
        }
        const campaign = params.get('utm_campaign');
        if (campaign) {
            const preset = CAMPAIGNS[campaign];
            if (preset) {
                if (preset.subtitle && subtitle) subtitle.textContent = preset.subtitle;
                if (preset.amount && !params.has('amount')) {
                    investmentAmount = clamp(preset.amount, AMOUNT_MIN, AMOUNT_MAX);
                    if (investmentInput) investmentInput.value = investmentAmount.toFixed(2);
                }
                if (preset.date && !params.has('date')) {
                    applyDateParam(preset.date, yearSlider, desiredBuy);
                }
                if (preset.mode && !params.has('mode')) setMode(preset.mode, true);
            }
            if (campaign === 'diamond_hands' && mainHeadline) mainHeadline.textContent = TEXT_VARIANTS.mainHeadline.diamond;
        }
    }

    function loadGA() {
        if (window._gaLoaded) return;
        window._gaLoaded = true;
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=G-VSK27SPWCV';
        document.head.appendChild(s);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        gtag('js', new Date());
        gtag('config', 'G-VSK27SPWCV');
    }

    function initCookieConsent() {
        loadGA();
        if (localStorage.getItem('ga_seen')) return;
        const banner = document.getElementById('cookie-banner');
        if (!banner) return;
        banner.classList.remove('hidden');
        document.getElementById('cookie-accept')?.addEventListener('click', () => {
            localStorage.setItem('ga_seen', '1');
            banner.classList.add('hidden');
        });
    }

    function checkAnniversary() {
        const now = new Date();
        const ev  = ANNIVERSARY_EVENTS.find(e => e.month === now.getMonth() + 1 && e.day === now.getDate());
        if (!ev) return;
        const banner = document.getElementById('anniversary-banner');
        const text   = document.getElementById('anniversary-text');
        if (!banner || !text) return;
        text.textContent = `${ev.emoji} ${ev.title} — ${ev.text}`;
        banner.classList.remove('hidden');
        document.getElementById('anniversary-dismiss')?.addEventListener('click', () => banner.classList.add('hidden'));
    }

    function buildDonateModal() {
        const tabsEl  = document.querySelector('.donate-coin-tabs');
        const bodyEl  = document.querySelector('.donate-modal-body');
        if (!tabsEl || !bodyEl) return;
        const thanksEl = bodyEl.querySelector('.donate-thanks');
        DONATE_COINS.forEach((coin, i) => {
            const btn = document.createElement('button');
            btn.className    = 'donate-coin-btn' + (i === 0 ? ' active' : '');
            btn.dataset.coin = coin.id;
            btn.textContent  = coin.name;
            tabsEl.appendChild(btn);

            const panel = document.createElement('div');
            panel.className      = 'donate-coin-panel' + (i === 0 ? '' : ' hidden');
            panel.id             = `donate-${coin.id}`;
            panel.dataset.address = coin.address;
            panel.innerHTML = `<div class="donate-qr" id="donate-qr-${coin.id}"></div><div class="donate-addr-row"><code class="donate-addr">${coin.address}</code><button class="donate-copy-btn" data-address="${coin.address}">Copy address</button></div>`;
            bodyEl.insertBefore(panel, thanksEl);
        });
    }

    function renderDCAChart(startYear, startMonth, startDay) {
        const areaEl    = document.getElementById('dca-chart-area');
        const lineEl    = document.getElementById('dca-chart-line');
        const invLineEl = document.getElementById('dca-invested-line');
        const finalEl   = document.getElementById('dca-final-value');
        const ctxEl     = document.getElementById('dca-context-caption');
        const invDispEl = document.getElementById('dca-invested-display');
        const monthsEl  = document.getElementById('dca-months-display');
        const growthEl2 = document.getElementById('dca-growth-display');
        if (!areaEl) return;

        const history = [];
        let runBtc = 0, runInvested = 0;
        const endYear  = END_DATE.getFullYear();
        const endMonth = END_DATE.getMonth() + 1;
        let y = startYear, m = startMonth;

        while (y < endYear || (y === endYear && m <= endMonth)) {
            const price = getPriceOnDay(y, m, startDay);
            if (price > 0) {
                runBtc      += investmentAmount / price;
                runInvested += investmentAmount;
                history.push({ value: runBtc * price, invested: runInvested });
            }
            if (++m > 12) { m = 1; y++; }
        }

        const finalCapital  = runBtc * CURRENT_PRICE;
        const totalInvested = runInvested;
        const months        = history.length;
        const growth        = totalInvested > 0 ? (finalCapital - totalInvested) * 100 / totalInvested : 0;

        if (finalEl) {
            const fv = formatLargeNumber(finalCapital);
            finalEl.textContent    = fv;
            finalEl.style.fontSize = fv.length > 9 ? '1.4rem' : '1.8rem';
        }
        if (ctxEl) {
            const cap = months > 0
                ? (CONTEXT_CAPTIONS.find(c => finalCapital <= c.max) || CONTEXT_CAPTIONS.at(-1)).text
                : null;
            ctxEl.textContent = cap || '';
        }
        if (invDispEl)  invDispEl.textContent  = `invested ${formatLargeNumber(totalInvested)}`;
        if (monthsEl)   monthsEl.textContent   = `${months} months`;
        if (growthEl2)  growthEl2.textContent  = months > 0
            ? `${growth > 0 ? '+' : ''}${growth.toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
            : '';

        const headerMonthsEl = document.getElementById('dca-months-count');
        if (headerMonthsEl) headerMonthsEl.textContent = `— ${months} mo`;

        if (months < 2) {
            areaEl.setAttribute('d', '');
            lineEl.setAttribute('d', '');
            invLineEl.setAttribute('d', '');
            return;
        }

        history[history.length - 1].value = finalCapital;

        const W      = 100, H = 60;
        const allVals = history.flatMap(p => [p.value, p.invested]);
        const maxVal  = Math.max(...allVals) || 1;
        const n       = history.length;
        const toX     = i => ((i / (n - 1)) * W).toFixed(2);
        const toY     = v => (H - (v / maxVal) * H * 0.93).toFixed(2);

        let linePts = '', invPts = '';
        history.forEach((p, i) => {
            const prefix = i === 0 ? 'M' : 'L';
            linePts += `${prefix}${toX(i)} ${toY(p.value)} `;
            invPts  += `${prefix}${toX(i)} ${toY(p.invested)} `;
        });

        areaEl.setAttribute('d', `${linePts}L${W} ${H} L0 ${H}Z`);
        lineEl.setAttribute('d', linePts.trim());
        invLineEl.setAttribute('d', invPts.trim());
    }

    function buildShareUrl() {
        const params = new URLSearchParams();
        params.set('amount', investmentAmount);
        params.set('date', dateKey(+yearSlider.value, +monthSlider.value, +daySlider.value));
        params.set('mode', currentMode);
        if (currentMode === 'trade' && sellYearSlider && sellMonthSlider && sellDaySlider) {
            // Full date: with only year and month the recipient's own leftover
            // day was used, so the same link showed two different results.
            params.set('sell', dateKey(+sellYearSlider.value, +sellMonthSlider.value, +sellDaySlider.value));
        }
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    }

    function syncRightPanelHeight() {
        const rightCol = document.getElementById('right-col');
        if (!rightCol) return;
        if (window.innerWidth < 768) { rightCol.style.height = ''; return; }
        const modeToggleEl = document.querySelector('.mode-toggle');
        const slidersEl    = document.getElementById('sliders-container');
        if (!modeToggleEl || !slidersEl) return;
        const top    = modeToggleEl.getBoundingClientRect().top;
        const bottom = slidersEl.getBoundingClientRect().bottom;
        if (bottom > top) rightCol.style.height = (bottom - top) + 'px';
    }

    async function initialize() {
        if (!await loadPriceData()) return;

        yearSlider.min = START_DATE.getFullYear();
        yearSlider.max = END_DATE.getFullYear();
        yearMinLabel.textContent = yearSlider.min;
        yearMaxLabel.textContent = yearSlider.max;

        if (sellYearSlider) {
            sellYearSlider.min   = START_DATE.getFullYear();
            sellYearSlider.max   = END_DATE.getFullYear();
            sellYearSlider.value = END_DATE.getFullYear();
            if (sellYearMinLabel) sellYearMinLabel.textContent = sellYearSlider.min;
            if (sellYearMaxLabel) sellYearMaxLabel.textContent = sellYearSlider.max;
        }
        if (sellMonthSlider) sellMonthSlider.value = END_DATE.getMonth() + 1;
        if (sellDaySlider)   sellDaySlider.value   = END_DATE.getDate();

        yearSlider.value  = 2020;
        monthSlider.value = 1;
        daySlider.value   = 1;

        const hadSavedState = restoreState();
        applyUrlParameters();

        renderNotableDates();
        updateAll();
        loadingOverlay.style.display = 'none';
        appContainer.classList.remove('invisible');
        drawConnectorLine();
        syncRightPanelHeight();
        initCookieConsent();
        checkAnniversary();

        if (!hadSavedState && !new URLSearchParams(window.location.search).has('date')) {
            const hintEl = document.getElementById('subtitle-hint');
            if (hintEl) {
                hintEl.classList.remove('hidden');
                const hideHint = () => hintEl.classList.add('hidden');
                [yearSlider, monthSlider, daySlider].forEach(sl =>
                    sl.addEventListener('input', hideHint, { once: true })
                );
            }
        }

        window.addEventListener('resize', () => {
            drawConnectorLine();
            syncRightPanelHeight();
        });
    }

    function updateAll() {
        updateUI();
        drawConnectorLine();
        saveState();
    }

    // The raw slider position is what the user asked for; updateAll() then shows
    // the nearest day that actually exists. Dragging into the dimmed tail of a
    // short month therefore snaps back, but is not forgotten.
    yearSlider.addEventListener('input', updateAll);
    monthSlider.addEventListener('input', () => { setDesired(desiredBuy, 'month', +monthSlider.value); updateAll(); });
    daySlider.addEventListener('input',   () => { setDesired(desiredBuy, 'day',   +daySlider.value);   updateAll(); });
    if (sellYearSlider)  sellYearSlider.addEventListener('input',  updateAll);
    if (sellMonthSlider) sellMonthSlider.addEventListener('input', () => { setDesired(desiredSell, 'month', +sellMonthSlider.value); updateAll(); });
    if (sellDaySlider)   sellDaySlider.addEventListener('input',   () => { setDesired(desiredSell, 'day',   +sellDaySlider.value);   updateAll(); });

    document.querySelectorAll('.trade-tab-btn').forEach(btn =>
        btn.addEventListener('click', () => setTradeTab(btn.dataset.tab))
    );
    document.querySelectorAll('.share-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            const feedbackId = btn.closest('#dca-chart-panel') ? 'share-feedback-dca' : 'share-feedback';
            copyToClipboard(buildShareUrl(), document.getElementById(feedbackId), 'Link copied!');
            if (typeof plausible !== 'undefined') plausible('Share', { props: { mode: currentMode } });
            if (window.gtag) gtag('event', 'share', { event_category: 'engagement', event_label: currentMode });
        })
    );
    modeBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

    if (investmentInput) {
        investmentInput.addEventListener('input', () => {
            const v = parseFloat(investmentInput.value);
            if (isFinite(v) && v > 0) { investmentAmount = clamp(v, AMOUNT_MIN, AMOUNT_MAX); updateAll(); }
        });
        // Mid-typing the field may be empty or out of range; on the way out it
        // is brought back in line with the number actually being calculated.
        const normalize = () => { investmentInput.value = investmentAmount.toFixed(2); };
        investmentInput.addEventListener('blur', normalize);
        investmentInput.addEventListener('change', normalize);
    }
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => {
            investmentAmount = Math.max(AMOUNT_MIN, investmentAmount - 1);
            investmentInput.value = investmentAmount.toFixed(2);
            updateAll();
        });
    }
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => {
            investmentAmount = Math.min(AMOUNT_MAX, investmentAmount + 1);
            investmentInput.value = investmentAmount.toFixed(2);
            updateAll();
        });
    }
    const donateModalEl    = document.getElementById('donate-modal');
    const donateBtnEl      = document.getElementById('donate-btn');
    const donateModalClose = document.getElementById('donate-modal-close');
    const donateQrRendered = {};

    function renderDonateQR(coinId) {
        if (donateQrRendered[coinId]) return;
        const panel = document.getElementById(`donate-${coinId}`);
        const qrEl  = document.getElementById(`donate-qr-${coinId}`);
        if (!panel || !qrEl || qrEl.children.length) return;
        const addr = panel.dataset.address;
        if (addr) {
            new QRCode(qrEl, { text: addr, width: 88, height: 88, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.M });
            donateQrRendered[coinId] = true;
        }
    }

    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let lastFocusBeforeModal = null;

    function isModalOpen() {
        return donateModalEl && !donateModalEl.classList.contains('hidden');
    }

    function openDonateModal() {
        lastFocusBeforeModal = document.activeElement;
        donateModalEl.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        // aria-modal="true" promises the rest of the page is unreachable; inert
        // is what keeps that promise. Everything beside the modal is covered —
        // the cookie banner and the storage toast live outside #app-container.
        [...document.body.children].forEach(el => {
            if (el !== donateModalEl && !el.hasAttribute('inert')) {
                el.setAttribute('inert', '');
                el.dataset.inertedByModal = '1';
            }
        });
        renderDonateQR('btc');
        (donateModalClose || donateModalEl.querySelector(FOCUSABLE))?.focus();
    }

    function closeDonateModal() {
        donateModalEl.classList.add('hidden');
        document.body.style.overflow = '';
        document.querySelectorAll('[data-inerted-by-modal]').forEach(el => {
            el.removeAttribute('inert');
            delete el.dataset.inertedByModal;
        });
        const back = lastFocusBeforeModal?.isConnected && lastFocusBeforeModal !== document.body
            ? lastFocusBeforeModal
            : donateBtnEl;
        back?.focus();
        lastFocusBeforeModal = null;
    }

    function trapModalTab(e) {
        const items = [...donateModalEl.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    if (donateBtnEl && donateModalEl) {
        donateBtnEl.addEventListener('click', openDonateModal);
        donateModalClose.addEventListener('click', closeDonateModal);
        donateModalEl.querySelector('.donate-modal-backdrop').addEventListener('click', closeDonateModal);
        document.addEventListener('keydown', e => {
            if (!isModalOpen()) return;
            if (e.key === 'Escape') closeDonateModal();
            else if (e.key === 'Tab') trapModalTab(e);
        });
    }

    buildDonateModal();

    document.querySelectorAll('.donate-coin-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const coin = btn.dataset.coin;
            document.querySelectorAll('.donate-coin-btn').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.donate-coin-panel').forEach(p => p.classList.toggle('hidden', p.id !== `donate-${coin}`));
            renderDonateQR(coin);
        });
    });

    document.querySelectorAll('.donate-copy-btn').forEach(btn => {
        const label = btn.textContent;
        btn.addEventListener('click', () => {
            copyToClipboard(btn.dataset.address, null, '');
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = label; }, 2000);
        });
    });

    function removeBodyOverflowHiddenOnMobile() {
        if (window.innerWidth < 768 && document.body.classList.contains('overflow-hidden')) {
            document.body.classList.remove('overflow-hidden');
        }
    }
    removeBodyOverflowHiddenOnMobile();

    initialize();
});
