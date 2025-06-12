    // script.js — fully refactored, mobile‑aware donation rendering
    // -----------------------------------------------------------------------------
    //  • URL params:    ?amount=150&date=2013-07-10&utm_campaign=coffee
    //  • Live edit:     #investment-input and ± buttons stay in sync with calculations
    //  • Donate panel:  toggles with #donate-btn
    //  • Mobile fix:    removes `overflow-hidden` on <768 px, hides QR, shows network name
    // -----------------------------------------------------------------------------

    document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM ELEMENTS ---
    const loadingOverlay      = document.getElementById('loading-overlay');
    const appContainer        = document.getElementById('app-container');
    const mainHeadline        = document.getElementById('main-headline');
    const subtitle            = document.getElementById('subtitle');
    const yearSlider          = document.getElementById('year-slider');
    const monthSlider         = document.getElementById('month-slider');
    const daySlider           = document.getElementById('day-slider');
    const yearMinLabel        = document.getElementById('year-min-label');
    const yearMaxLabel        = document.getElementById('year-max-label');
    const dayMaxLabel         = document.getElementById('day-max-label');
    const initialInvestmentEl = document.getElementById('initial-investment');
    const currentValueEl      = document.getElementById('current-value');
    const daysPassedEl        = document.getElementById('days-passed');
    const growthEl            = document.getElementById('growth');
    const connectorPath       = document.getElementById('connector-path');
    const svg                 = document.getElementById('connector-svg');
    const donationSection     = document.getElementById('donation-section');
    const copyFeedback        = document.getElementById('copy-feedback');
    const yearValueDisplay    = document.getElementById('year-value-display');
    const monthNameDisplay    = document.getElementById('month-name-display');
    const dayValueDisplay     = document.getElementById('day-value-display');
    const yearTrackBg         = document.getElementById('year-track-bg');
    const monthTrackBg        = document.getElementById('month-track-bg');
    const dayTrackBg          = document.getElementById('day-track-bg');
    const donationHeadline    = document.getElementById('donation-headline');

    // Investment controls
    const investmentInput     = document.getElementById('investment-input');
    const decreaseBtn         = document.getElementById('decrease-investment');
    const increaseBtn         = document.getElementById('increase-investment');
    const donateBtn           = document.getElementById('donate-btn');

    // --- STATE & CONSTANTS ---
    let investmentAmount = 100; // default
    const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    let priceData = new Map();
    let START_DATE, END_DATE, CURRENT_PRICE, CURRENT_DATE;

    const TEXT_VARIANTS = {
        subtitle: {
        default:    "Let's calculate the millions you never made.",
        neutral:    "Let's see what you missed out on.",
        intriguing: "The most expensive question you never asked."
        },
        mainHeadline: {
        default:      "WhatIfBtc",
        diamond:      "Running the numbers on your diamond hands."
        },
        donationHeadline: {
        default: "Appreciate clean data and an open-source tool?",
        fire:    "How a small allocation to BTC could have accelerated your FIRE journey.",
        coffee:  "Every coffee helps add features like DCA & staking calculators."
        }
    };

    // --- UTILITIES ---
    function formatLargeNumber(num) {
        if (num == null || isNaN(num)) return 'N/A';
        if (num < 1_000)               return num.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
        if (num < 1_000_000)           return '$'+(num/1_000).toFixed(2)+'K';
        if (num < 1_000_000_000)       return '$'+(num/1_000_000).toFixed(2)+'M';
        if (num < 1_000_000_000_000)   return '$'+(num/1_000_000_000).toFixed(2)+'B';
        return '$'+(num/1_000_000_000_000).toFixed(2)+'T';
    }
    const formatCurrency = (val, precision) =>
        val.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:precision});

    // --- RENDERING LOGIC ---
    function updateUI() {
        const year  = +yearSlider.value;
        const month = +monthSlider.value;
        const day   = +daySlider.value;

        updateSliderFill(yearSlider,  yearTrackBg);
        updateSliderFill(monthSlider, monthTrackBg, true);
        updateSliderFill(daySlider,   dayTrackBg);

        yearValueDisplay.textContent  = year;
        monthNameDisplay.textContent  = MONTHS[month-1];
        dayValueDisplay.textContent   = day;

        const dateString = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const pastPrice  = priceData.get(dateString) || 0;

        let currentValue = 0, growth = 0;
        if (pastPrice > 0) {
        const coinsBought = investmentAmount / pastPrice;
        currentValue = coinsBought * CURRENT_PRICE;
        growth       = (currentValue - investmentAmount) * 100 / investmentAmount;
        } else {
        growth = -100;
        }

        const selectedDate = new Date(dateString + 'T00:00:00');
        const daysPassed   = Math.max(0, Math.floor((CURRENT_DATE - selectedDate) / (1000*3600*24)));

        const invPrecision = investmentAmount < 100 ? 2 : 0;
        initialInvestmentEl.textContent = formatCurrency(investmentAmount, invPrecision);

        const formattedVal = pastPrice>0 ? formatLargeNumber(currentValue) : 'N/A';
        currentValueEl.textContent = formattedVal;
        currentValueEl.style.fontSize = formattedVal.length > 9 ? '1.75rem' : '2rem';

        daysPassedEl.textContent = daysPassed.toLocaleString('en-US');
        growthEl.textContent     = pastPrice>0
        ? `${growth>0?'+':''}${growth.toLocaleString('en-US',{maximumFractionDigits:2})}%`
        : 'N/A';
    }

    function updateSliderFill(slider, trackBg, isMonth=false) {
        const min = +slider.min, max = +slider.max, val = +slider.value;
        const pct = max>min ? (val-min)*100/(max-min) : 100;
        const active='#333842', disabled='#22252a';

        if (isMonth) {
        const year = +yearSlider.value;
        const SY=START_DATE.getFullYear(), SM=START_DATE.getMonth()+1;
        const EY=END_DATE.getFullYear(),   EM=END_DATE.getMonth()+1;
        const vStart=(year===SY)?SM:1;
        const vEnd  =(year===EY)?EM:12;
        const startPct=(vStart-1)*100/11;
        const endPct=(vEnd-12)*100/11;
        trackBg.style.background =
            `linear-gradient(to right, ${disabled} ${startPct}%, ${active} ${startPct}%, ${active} calc(100% + ${endPct}%), ${disabled} calc(100% + ${endPct}%))`;
        } else {
        trackBg.style.background = active;
        }
        slider.style.background = `linear-gradient(to right, var(--accent-color) ${pct}%, transparent ${pct}%)`;
    }

    function getThumbCenter(slider) {
        const r=slider.getBoundingClientRect(), sr=svg.getBoundingClientRect();
        const p=(slider.max-slider.min)>0 ? (slider.value-slider.min)/(slider.max-slider.min) : 1;
        return {
        x: r.left - sr.left + (p*(r.width-24)+12),
        y: r.top  - sr.top  + r.height/2
        };
    }

    function drawConnectorLine() {
        if (appContainer.classList.contains('invisible')) return;
        const p1 = getThumbCenter(yearSlider),
            p2 = getThumbCenter(monthSlider),
            p3 = getThumbCenter(daySlider);
        const d = `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + (p2.y-p1.y)/2}, ${p2.x} ${p1.y + (p2.y-p1.y)/2}, ${p2.x} ${p2.y} C ${p2.x} ${p2.y + (p3.y-p2.y)/2}, ${p3.x} ${p2.y + (p3.y-p2.y)/2}, ${p3.x} ${p3.y}`;
        connectorPath.setAttribute('d', d);
    }

    // --- DATA LOADING ---
    async function loadPriceData() {
        try {
        const res  = await fetch('src/data/history.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        priceData      = new Map(data.map(i=>[i.date,i.price]));
        START_DATE     = new Date(data[0].date + 'T00:00:00');
        END_DATE       = new Date(data[data.length-1].date + 'T00:00:00');
        CURRENT_DATE   = END_DATE;
        CURRENT_PRICE  = data[data.length-1].price;
        return true;
        } catch(err) {
        console.error(err);
        loadingOverlay.innerHTML = '<p class="text-xl text-red-500">Failed to load data.</p>';
        return false;
        }
    }

    // --- URL PARAMETERS ---
    function applyUrlParameters() {
        const params = new URLSearchParams(window.location.search);
        const amountParam = parseFloat(params.get('amount'));
        if (!isNaN(amountParam) && amountParam > 0) {
        investmentAmount = amountParam;
        if (investmentInput) investmentInput.value = amountParam.toFixed(2);
        }
        const dateParam = params.get('date');
        if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const [y,m,d] = dateParam.split('-').map(Number);
        const reqDate = new Date(y, m-1, d);
        if (reqDate >= START_DATE && reqDate <= END_DATE) {
            yearSlider.value  = y;
            monthSlider.value = m;
            daySlider.value   = d;
        }
        }
        const campaign = params.get('utm_campaign');
        if (campaign) {
        switch(campaign) {
            case 'neutral':    subtitle.textContent = TEXT_VARIANTS.subtitle.neutral; break;
            case 'intriguing': subtitle.textContent = TEXT_VARIANTS.subtitle.intriguing; break;
            case 'diamond_hands': mainHeadline.textContent     = TEXT_VARIANTS.mainHeadline.diamond; break;
            case 'fire_journey':  donationHeadline.textContent = TEXT_VARIANTS.donationHeadline.fire; break;
            case 'coffee':        donationHeadline.textContent = TEXT_VARIANTES.donationHeadline.coffee; break;
        }
        }
    }

    // --- DONATION CARD RENDERING ---
    function renderDonationCards() {
        const isMobile = window.innerWidth < 768;
        document.querySelectorAll('.donation-card').forEach(card => {
        const address = card.dataset.address;
        const container = card.querySelector('.qr-code-container');
        const copyBtn = card.querySelector('.copy-btn');
        // clear old network label
        const oldNet = card.querySelector('.network-name');
        if (oldNet) oldNet.remove();
        if (isMobile) {
            if (container) container.style.display = 'none';
            const networkName = card.dataset.network || 'Bitcoin';
            if (copyBtn) {
            const netEl = document.createElement('div');
            netEl.className = 'network-name mb-2 text-sm font-medium text-gray-700';
            netEl.textContent = networkName;
            card.insertBefore(netEl, copyBtn);
            }
        } else {
            if (container) {
            container.style.display = '';
            container.innerHTML = '';
            if (address) {
                new QRCode(container, { text: address, width: 112, height: 112, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.H });
            }
            }
        }
        });
    }

    // --- INITIALIZATION ---
    async function initialize() {
        if (!await loadPriceData()) return;
        yearSlider.min = START_DATE.getFullYear();
        yearSlider.max = END_DATE.getFullYear();
        yearSlider.value = END_DATE.getFullYear();
        yearMinLabel.textContent = yearSlider.min;
        yearMaxLabel.textContent = yearSlider.max;
        monthSlider.value = END_DATE.getMonth()+1;
        daySlider.value   = END_DATE.getDate();

        applyUrlParameters();
        updateAll();
        loadingOverlay.style.display = 'none';
        appContainer.classList.remove('invisible');

        renderDonationCards();
        drawConnectorLine();
        window.addEventListener('resize', () => {
        drawConnectorLine();
        renderDonationCards();
        removeBodyOverflowHiddenOnMobile();
        });
    }

    function updateAll() {
        updateUI();
        drawConnectorLine();
    }

    // --- EVENT LISTENERS ---
    [yearSlider, monthSlider, daySlider].forEach(sl =>
        sl.addEventListener('input', updateAll)
    );
    if (investmentInput) {
        investmentInput.addEventListener('input', () => {
        const v = parseFloat(investmentInput.value);
        if (!isNaN(v) && v > 0) { investmentAmount = v; updateAll(); }
        });
    }
    if (decreaseBtn) {
        decreaseBtn.addEventListener('click', () => {
        investmentAmount = Math.max(0.01, investmentAmount - 1);
        investmentInput.value = investmentAmount.toFixed(2);
        updateAll();
        });
    }
    if (increaseBtn) {
        increaseBtn.addEventListener('click', () => {
        investmentAmount += 1;
        investmentInput.value = investmentAmount.toFixed(2);
        updateAll();
        });
    }
    if (donateBtn) {
        donateBtn.addEventListener('click', () => donationSection?.classList.toggle('open'));
    }
    document.querySelectorAll('.donation-card').forEach(card => {
        const copyBtn = card.querySelector('.copy-btn');
        const addr    = card.dataset.address;
        if (copyBtn && addr) {
        copyBtn.addEventListener('click', () => {
            const dummy = document.createElement('textarea');
            document.body.appendChild(dummy);
            dummy.value = addr;
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);
            copyFeedback.textContent = 'Address copied!';
            copyFeedback.style.opacity = '1';
            setTimeout(() => { copyFeedback.style.opacity = '0'; }, 2000);
        });
        }
    });

    // --- MOBILE FIX: remove overflow-hidden on small screens ---
    function removeBodyOverflowHiddenOnMobile() {
        if (window.innerWidth < 768 && document.body.classList.contains('overflow-hidden')) {
        document.body.classList.remove('overflow-hidden');
        }
    }
    removeBodyOverflowHiddenOnMobile();

    // --- START ---
    initialize();
    });
