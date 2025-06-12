document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM ELEMENTS ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const appContainer = document.getElementById('app-container');
    const mainHeadline = document.getElementById('main-headline');
    const subtitle = document.getElementById('subtitle');
    const yearSlider = document.getElementById('year-slider');
    const monthSlider = document.getElementById('month-slider');
    const daySlider = document.getElementById('day-slider');
    const yearMinLabel = document.getElementById('year-min-label');
    const yearMaxLabel = document.getElementById('year-max-label');
    const dayMaxLabel = document.getElementById('day-max-label');
    const selectedDateEl = document.getElementById('selected-date');
    const initialInvestmentEl = document.getElementById('initial-investment');
    const currentValueEl = document.getElementById('current-value');
    const daysPassedEl = document.getElementById('days-passed');
    const growthEl = document.getElementById('growth');
    const investmentDisplay = document.getElementById('investment-display');
    const investmentAmountText = document.getElementById('investment-amount-text');
    const investmentEdit = document.getElementById('investment-edit');
    const investmentInput = document.getElementById('investment-input');
    const decreaseBtn = document.getElementById('decrease-investment');
    const increaseBtn = document.getElementById('increase-investment');
    const connectorPath = document.getElementById('connector-path');
    const svg = document.getElementById('connector-svg');
    const donateBtn = document.getElementById('donate-btn');
    const donationSection = document.getElementById('donation-section');
    const copyFeedback = document.getElementById('copy-feedback');
    const yearValueDisplay = document.getElementById('year-value-display');
    const monthNameDisplay = document.getElementById('month-name-display');
    const dayValueDisplay = document.getElementById('day-value-display');
    const yearTrackBg = document.getElementById('year-track-bg');
    const monthTrackBg = document.getElementById('month-track-bg');
    const dayTrackBg = document.getElementById('day-track-bg');
    const donationHeadline = document.getElementById('donation-headline');


    // --- STATE & CONSTANTS ---
    let investmentAmount = 100;
    const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    let priceData = new Map();
    let START_DATE, END_DATE, CURRENT_PRICE, CURRENT_DATE;

    const TEXT_VARIANTS = {
        subtitle: {
            default: "Let's calculate the millions you never made.",
            neutral: "Let's see what you missed out on.",
            intriguing: "The most expensive question you never asked."
        },
        mainHeadline: {
            default: "WhatIfBtc",
            diamond: "Running the numbers on your diamond hands."
        },
        donationHeadline: {
            default: "Appreciate clean data and an open-source tool?",
            fire: "How a small allocation to BTC could have accelerated your FIRE journey.",
            coffee: "Every coffee helps add features like DCA & staking calculators."
        }
    };
    
    function generateQRCodes() {
        const donationCards = document.querySelectorAll('.donation-card');
        donationCards.forEach(card => {
            const address = card.dataset.address;
            const container = card.querySelector('.qr-code-container');
            if (address && container) {
                new QRCode(container, {
                    text: address,
                    width: 112,
                    height: 112,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
            }
        });
    }

    async function loadPriceData() {
        try {
            const response = await fetch('src/data/history.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            priceData = new Map(data.map(item => [item.date, item.price]));
            const firstEntry = data[0];
            const lastEntry = data[data.length - 1];
            START_DATE = new Date(firstEntry.date + 'T00:00:00');
            END_DATE = new Date(lastEntry.date + 'T00:00:00');
            CURRENT_DATE = END_DATE;
            CURRENT_PRICE = lastEntry.price;
            return true;
        } catch (error) {
            console.error("Could not load price data:", error);
            loadingOverlay.innerHTML = `<p class="text-xl text-red-500">Failed to load data. Ensure server is running or path is correct.</p>`;
            return false;
        }
    }
    
    function applyUrlParameters() {
        const params = new URLSearchParams(window.location.search);
        
        const amountParam = parseFloat(params.get('amount'));
        if (!isNaN(amountParam) && amountParam > 0) {
            investmentAmount = amountParam;
        }
        
        const dateParam = params.get('date');
        if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            const [year, month, day] = dateParam.split('-').map(Number);
            const requestedDate = new Date(year, month - 1, day);
            if (requestedDate >= START_DATE && requestedDate <= END_DATE) {
                yearSlider.value = year;
                monthSlider.value = month;
                daySlider.value = day;
            }
        }
        
        const campaign = params.get('utm_campaign');
        if (campaign) {
            switch (campaign) {
                case 'neutral': subtitle.textContent = TEXT_VARIANTS.subtitle.neutral; break;
                case 'intriguing': subtitle.textContent = TEXT_VARIANTS.subtitle.intriguing; break;
                case 'diamond_hands': mainHeadline.textContent = TEXT_VARIANTS.mainHeadline.diamond; break;
                case 'fire_journey': donationHeadline.textContent = TEXT_VARIANTS.donationHeadline.fire; break;
                case 'coffee': donationHeadline.textContent = TEXT_VARIANTS.donationHeadline.coffee; break;
            }
        }
    }
    
    async function initialize() {
        const dataLoaded = await loadPriceData();
        if (!dataLoaded) return;

        const START_YEAR = START_DATE.getFullYear();
        const END_YEAR = END_DATE.getFullYear();
        
        yearSlider.min = START_YEAR;
        yearSlider.max = END_YEAR;
        yearSlider.value = END_YEAR;
        yearMinLabel.textContent = START_YEAR;
        yearMaxLabel.textContent = END_YEAR;
        
        monthSlider.value = END_DATE.getMonth() + 1;
        daySlider.value = END_DATE.getDate();
        
        applyUrlParameters();
        
        updateSliderConstraints();
        updateAll();

        loadingOverlay.style.display = 'none';
        appContainer.classList.remove('invisible');
        
        generateQRCodes();

        requestAnimationFrame(drawConnectorLine);
        window.addEventListener('resize', drawConnectorLine);
    }

    // --- EVENT LISTENERS ---
    [yearSlider, monthSlider, daySlider].forEach(slider => {
        slider.addEventListener('input', () => {
            updateSliderConstraints();
            updateAll();
        });
    });

    investmentDisplay.addEventListener('click', () => {
        investmentDisplay.classList.add('hidden');
        investmentEdit.classList.remove('hidden');
        investmentInput.focus();
        investmentInput.select();
    });
    
    [decreaseBtn, increaseBtn].forEach(btn => {
        btn.addEventListener('mousedown', (e) => e.preventDefault());
    });

    const updateInvestment = (newAmount) => {
        if (isNaN(newAmount) || newAmount <= 0) newAmount = 1;
        investmentAmount = newAmount;
        investmentInput.value = newAmount;
        updateAll();
    };

    const changeInvestment = (direction) => {
        let currentVal = parseFloat(investmentInput.value);
        let step = 1;
        if (currentVal >= 1000) step = 100;
        else if (currentVal >= 100) step = 10;
        
        let newAmount = direction === 'increase' ? currentVal + step : currentVal - step;
        updateInvestment(Math.max(1, newAmount));
    };

    increaseBtn.addEventListener('click', () => changeInvestment('increase'));
    decreaseBtn.addEventListener('click', () => changeInvestment('decrease'));
    investmentInput.addEventListener('change', () => updateInvestment(parseFloat(investmentInput.value)));
    investmentInput.addEventListener('blur', () => {
        investmentDisplay.classList.remove('hidden');
        investmentEdit.classList.add('hidden');
    });
    
    donateBtn.addEventListener('click', () => donationSection.classList.toggle('open'));

    document.querySelectorAll('.donation-card').forEach(card => {
        const copyBtn = card.querySelector('.copy-btn');
        const address = card.dataset.address;
        if(copyBtn && address) {
            copyBtn.addEventListener('click', () => {
                const dummy = document.createElement('textarea');
                document.body.appendChild(dummy);
                dummy.value = address;
                dummy.select();
                document.execCommand('copy');
                document.body.removeChild(dummy);
                copyFeedback.textContent = "Address copied!";
                copyFeedback.style.opacity = '1';
                setTimeout(() => { copyFeedback.style.opacity = '0'; }, 2000);
            });
        }
    });

    function updateAll() { updateUI(); drawConnectorLine(); }

    function updateSliderConstraints() {
        const year = parseInt(yearSlider.value);
        const month = parseInt(monthSlider.value);
        const START_YEAR = START_DATE.getFullYear(), START_MONTH = START_DATE.getMonth() + 1;
        const END_YEAR = END_DATE.getFullYear(), END_MONTH = END_DATE.getMonth() + 1;

        let clampedMonth = month;
        if (year === START_YEAR && month < START_MONTH) clampedMonth = START_MONTH;
        if (year === END_YEAR && month > END_MONTH) clampedMonth = END_MONTH;
        if (clampedMonth !== month) monthSlider.value = clampedMonth;
        
        const currentMonth = parseInt(monthSlider.value);
        const daysInMonth = new Date(year, currentMonth, 0).getDate();
        const START_DAY = START_DATE.getDate(), END_DAY = END_DATE.getDate();
        daySlider.min = (year === START_YEAR && currentMonth === START_MONTH) ? START_DAY : 1;
        daySlider.max = (year === END_YEAR && currentMonth === END_MONTH) ? END_DAY : daysInMonth;
        if (parseInt(daySlider.value) < parseInt(daySlider.min)) daySlider.value = daySlider.min;
        if (parseInt(daySlider.value) > parseInt(daySlider.max)) daySlider.value = daySlider.max;
        dayMaxLabel.textContent = daySlider.max;
    }

    function formatLargeNumber(num) {
        if (num === null || isNaN(num)) return 'N/A';
        if (num < 1000) return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
        if (num < 1_000_000) return '$' + (num / 1_000).toFixed(2) + 'K';
        if (num < 1_000_000_000) return '$' + (num / 1_000_000).toFixed(2) + 'M';
        if (num < 1_000_000_000_000) return '$' + (num / 1_000_000_000).toFixed(2) + 'B';
        return '$' + (num / 1_000_000_000_000).toFixed(2) + 'T';
    }

    function updateUI() {
        const year = parseInt(yearSlider.value), month = parseInt(monthSlider.value), day = parseInt(daySlider.value);
        
        updateSliderFill(yearSlider, yearTrackBg);
        updateSliderFill(monthSlider, monthTrackBg, true);
        updateSliderFill(daySlider, dayTrackBg);

        yearValueDisplay.textContent = year;
        monthNameDisplay.textContent = MONTHS[month - 1];
        dayValueDisplay.textContent = day;

        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const pastPrice = priceData.get(dateString) || 0;

        let currentValue = 0, growth = 0;
        if (pastPrice > 0) {
            const coinsBought = investmentAmount / pastPrice;
            currentValue = coinsBought * CURRENT_PRICE;
            growth = (investmentAmount > 0) ? ((currentValue - investmentAmount) / investmentAmount) * 100 : 0;
        } else { growth = -100; }

        const selectedDate = new Date(dateString + 'T00:00:00');
        const daysPassed = Math.max(0, Math.floor((CURRENT_DATE.getTime() - selectedDate.getTime()) / (1000 * 3600 * 24)));
        
        const locale = 'en-US';
        const formattedDate = pastPrice > 0 ? `${String(day).padStart(2, '0')} ${MONTHS[month - 1]} ${year}` : 'No Data';
        const formatCurrency = (val, precision) => val.toLocaleString(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: precision });
        
        const investmentPrecision = investmentAmount < 100 ? 2 : 0;
        investmentAmountText.textContent = formatCurrency(investmentAmount, investmentPrecision);
        initialInvestmentEl.textContent = formatCurrency(investmentAmount, investmentPrecision);

        const formattedValue = pastPrice > 0 ? formatLargeNumber(currentValue) : 'N/A';
        currentValueEl.textContent = formattedValue;
        
        const len = formattedValue.length;
        if (len > 9) currentValueEl.style.fontSize = '1.75rem';
        else currentValueEl.style.fontSize = '2rem';

        daysPassedEl.textContent = daysPassed.toLocaleString(locale);
        growthEl.textContent = pastPrice > 0 ? `${growth > 0 ? '+' : ''}${growth.toLocaleString(locale, { maximumFractionDigits: 2 })}%` : 'N/A';
    }
    
    function updateSliderFill(slider, trackBg, isMonth = false) {
        const min = parseFloat(slider.min), max = parseFloat(slider.max), value = parseFloat(slider.value);
        const percentage = (max - min > 0) ? (value - min) * 100 / (max - min) : 100;
        const activeTrackColor = '#333842', disabledTrackColor = '#22252a';

        if (isMonth) {
            const year = parseInt(yearSlider.value);
            const START_YEAR = START_DATE.getFullYear(), START_MONTH = START_DATE.getMonth() + 1;
            const END_YEAR = END_DATE.getFullYear(), END_MONTH = END_DATE.getMonth() + 1;
            const validStartMonth = (year === START_YEAR) ? START_MONTH : 1;
            const validEndMonth = (year === END_YEAR) ? END_MONTH : 12;
            const startPct = (validStartMonth - 1) * 100 / 11;
            const endPct = (validEndMonth - 12) * 100 / 11;
            trackBg.style.background = `linear-gradient(to right, ${disabledTrackColor} ${startPct}%, ${activeTrackColor} ${startPct}%, ${activeTrackColor} calc(100% + ${endPct}%), ${disabledTrackColor} calc(100% + ${endPct}%))`;
        } else { trackBg.style.background = activeTrackColor; }
        
        slider.style.background = `linear-gradient(to right, var(--accent-color) ${percentage}%, transparent ${percentage}%)`;
    }

    function getThumbCenter(s) { const r = s.getBoundingClientRect(), sr = svg.getBoundingClientRect(); const p = (s.max - s.min > 0) ? (s.value - s.min) / (s.max - s.min) : 1; const x = r.left - sr.left + (p * (r.width - 24) + 12); const y = r.top - sr.top + r.height / 2; return {x, y}; }
    function drawConnectorLine() { if (!appContainer.classList.contains('invisible')) { const p1 = getThumbCenter(yearSlider), p2 = getThumbCenter(monthSlider), p3 = getThumbCenter(daySlider); const d = `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y+(p2.y-p1.y)/2}, ${p2.x} ${p1.y+(p2.y-p1.y)/2}, ${p2.x} ${p2.y} C ${p2.x} ${p2.y+(p3.y-p2.y)/2}, ${p3.x} ${p2.y+(p3.y-p2.y)/2}, ${p3.x} ${p3.y}`; connectorPath.setAttribute('d', d); } }

    initialize();
});