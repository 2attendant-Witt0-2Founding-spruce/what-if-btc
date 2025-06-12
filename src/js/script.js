document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM ELEMENTS ---
    const loadingOverlay       = document.getElementById('loading-overlay');
    const appContainer         = document.getElementById('app-container');
    const mainHeadline         = document.getElementById('main-headline');
    const subtitle             = document.getElementById('subtitle');
    const yearSlider           = document.getElementById('year-slider');
    const monthSlider          = document.getElementById('month-slider');
    const daySlider            = document.getElementById('day-slider');
    const yearMinLabel         = document.getElementById('year-min-label');
    const yearMaxLabel         = document.getElementById('year-max-label');
    const dayMaxLabel          = document.getElementById('day-max-label');
    const selectedDateEl       = document.getElementById('selected-date');
    const initialInvestmentEl  = document.getElementById('initial-investment');
    const currentValueEl       = document.getElementById('current-value');
    const daysPassedEl         = document.getElementById('days-passed');
    const growthEl             = document.getElementById('growth');
    const connectorPath        = document.getElementById('connector-path');
    const svg                  = document.getElementById('connector-svg');
    const donateBtn            = document.getElementById('donate-btn');
    const donationSection      = document.getElementById('donation-section');
    const copyFeedback         = document.getElementById('copy-feedback');
    const yearValueDisplay     = document.getElementById('year-value-display');
    const monthNameDisplay     = document.getElementById('month-name-display');
    const dayValueDisplay      = document.getElementById('day-value-display');
    const yearTrackBg          = document.getElementById('year-track-bg');
    const monthTrackBg         = document.getElementById('month-track-bg');
    const dayTrackBg           = document.getElementById('day-track-bg');
    const donationHeadline     = document.getElementById('donation-headline');

    // --- STATE & CONSTANTS ---
    let investmentAmount = 100; // default
    const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
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

    // --- UTILS -------------------------------------------------------
    const formatLargeNumber = (num) => {
        if (num === null || isNaN(num)) return 'N/A';
        if (num < 1000)               return num.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
        if (num < 1_000_000)          return '$'+(num/1_000).toFixed(2)+'K';
        if (num < 1_000_000_000)      return '$'+(num/1_000_000).toFixed(2)+'M';
        if (num < 1_000_000_000_000)  return '$'+(num/1_000_000_000).toFixed(2)+'B';
        return '$'+(num/1_000_000_000_000).toFixed(2)+'T';
    };

    const formatCurrency = (val, precision) =>
        val.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:precision});

    // ----------------------------------------------------------------
    function updateUI() {
        const year  = parseInt(yearSlider.value);
        const month = parseInt(monthSlider.value);
        const day   = parseInt(daySlider.value);

        updateSliderFill(yearSlider,  yearTrackBg);
        updateSliderFill(monthSlider, monthTrackBg, true);
        updateSliderFill(daySlider,   dayTrackBg);

        yearValueDisplay.textContent  = year;
        monthNameDisplay.textContent  = MONTHS[month-1];
        dayValueDisplay.textContent   = day;

        const dateString = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const pastPrice  = priceData.get(dateString) || 0;

        let currentValue = 0, growth = 0;
        if (pastPrice>0) {
            const coinsBought = investmentAmount / pastPrice;
            currentValue = coinsBought * CURRENT_PRICE;
            growth       = (currentValue - investmentAmount) * 100 / investmentAmount;
        } else {
            growth = -100;
        }

        const selectedDate = new Date(dateString+'T00:00:00');
        const daysPassed   = Math.max(0, Math.floor((CURRENT_DATE-selectedDate)/(1000*3600*24)));

        const invPrecision = investmentAmount < 100 ? 2 : 0;
        initialInvestmentEl.textContent = formatCurrency(investmentAmount, invPrecision);

        const formattedVal = pastPrice>0 ? formatLargeNumber(currentValue) : 'N/A';
        currentValueEl.textContent = formattedVal;
        currentValueEl.style.fontSize = formattedVal.length>9 ? '1.75rem' : '2rem';

        daysPassedEl.textContent = daysPassed.toLocaleString('en-US');
        growthEl.textContent = pastPrice>0 ? `${growth>0?'+':''}${growth.toLocaleString('en-US',{maximumFractionDigits:2})}%` : 'N/A';
    }

    function updateSliderFill(slider, trackBg, isMonth=false){
        const min=+slider.min, max=+slider.max, val=+slider.value;
        const pct=(max-min>0)?(val-min)*100/(max-min):100;
        const active='#333842', disabled='#22252a';

        if(isMonth){
            const year=+yearSlider.value;
            const SY=START_DATE.getFullYear(), SM=START_DATE.getMonth()+1;
            const EY=END_DATE.getFullYear(),   EM=END_DATE.getMonth()+1;
            const vStart=(year===SY)?SM:1;
            const vEnd  =(year===EY)?EM:12;
            const startPct=(vStart-1)*100/11;
            const endPct=(vEnd-12)*100/11;
            trackBg.style.background=`linear-gradient(to right, ${disabled} ${startPct}%, ${active} ${startPct}%, ${active} calc(100% + ${endPct}%), ${disabled} calc(100% + ${endPct}%))`;
        } else {
            trackBg.style.background=active;
        }
        slider.style.background=`linear-gradient(to right, var(--accent-color) ${pct}%, transparent ${pct}%)`;
    }

    function getThumbCenter(s){
        const r=s.getBoundingClientRect(), sr=svg.getBoundingClientRect();
        const p=(s.max-s.min>0)?(s.value-s.min)/(s.max-s.min):1;
        const x=r.left-sr.left + (p*(r.width-24)+12);
        const y=r.top -sr.top + r.height/2;
        return {x,y};
    }

    function drawConnectorLine(){
        if(appContainer.classList.contains('invisible')) return;
        const p1=getThumbCenter(yearSlider), p2=getThumbCenter(monthSlider), p3=getThumbCenter(daySlider);
        const d=`M ${p1.x} ${p1.y} C ${p1.x} ${p1.y+(p2.y-p1.y)/2}, ${p2.x} ${p1.y+(p2.y-p1.y)/2}, ${p2.x} ${p2.y} C ${p2.x} ${p2.y+(p3.y-p2.y)/2}, ${p3.x} ${p2.y+(p3.y-p2.y)/2}, ${p3.x} ${p3.y}`;
        connectorPath.setAttribute('d', d);
    }

    // --- DATA LOADING -----------------------------------------------
    async function loadPriceData(){
        try{
            const res=await fetch('src/data/history.json');
            if(!res.ok) throw new Error(`HTTP ${res.status}`);
            const data=await res.json();
            priceData=new Map(data.map(i=>[i.date,i.price]));
            START_DATE=new Date(data[0].date+'T00:00:00');
            END_DATE  =new Date(data[data.length-1].date+'T00:00:00');
            CURRENT_DATE=END_DATE;
            CURRENT_PRICE=data[data.length-1].price;
            return true;
        }catch(e){
            console.error(e);
            loadingOverlay.innerHTML='<p class="text-xl text-red-500">Failed to load data.</p>';
            return false;
        }
    }

    // --- URL PARAMS --------------------------------------------------
    function applyUrlParameters(){
        const params=new URLSearchParams(window.location.search);
        const amountParam=parseFloat(params.get('amount'));
        if(!isNaN(amountParam) && amountParam>0) investmentAmount=amountParam;
        const dateParam=params.get('date');
        if(dateParam&&/^\d{4}-\d{2}-\d{2}$/.test(dateParam)){
            const [y,m,d]=dateParam.split('-').map(Number);
            const reqDate=new Date(y,m-1,d);
            if(reqDate>=START_DATE && reqDate<=END_DATE){
                yearSlider.value=y;
                monthSlider.value=m;
                daySlider.value=d;
            }
        }
        const campaign=params.get('utm_campaign');
        if(campaign){
            switch(campaign){
                case 'neutral': subtitle.textContent=TEXT_VARIANTS.subtitle.neutral; break;
                case 'intriguing': subtitle.textContent=TEXT_VARIANTS.subtitle.intriguing; break;
                case 'diamond_hands': mainHeadline.textContent=TEXT_VARIANTS.mainHeadline.diamond; break;
                case 'fire_journey': donationHeadline.textContent=TEXT_VARIANTS.donationHeadline.fire; break;
                case 'coffee': donationHeadline.textContent=TEXT_VARIANTS.donationHeadline.coffee; break;
            }
        }
    }

    // --- INITIALISE --------------------------------------------------
    async function initialize(){
        if(!await loadPriceData()) return;
        yearSlider.min=START_DATE.getFullYear();
        yearSlider.max=END_DATE.getFullYear();
        yearSlider.value=END_DATE.getFullYear();
        yearMinLabel.textContent=yearSlider.min;
        yearMaxLabel.textContent=yearSlider.max;
        monthSlider.value=END_DATE.getMonth()+1;
        daySlider.value=END_DATE.getDate();
        applyUrlParameters();
        updateSliderConstraints();
        updateAll();
        loadingOverlay.style.display='none';
        appContainer.classList.remove('invisible');
        generateQRCodes();
        requestAnimationFrame(drawConnectorLine);
        window.addEventListener('resize', drawConnectorLine);
    }

    // --- EVENT LISTENERS (only those that still exist) --------------
    [yearSlider,monthSlider,daySlider].forEach(s=>
        s.addEventListener('input',()=>{updateSliderConstraints();updateAll();}));

    donateBtn?.addEventListener('click',()=>donationSection.classList.toggle('open'));

    document.querySelectorAll('.donation-card').forEach(card=>{
        const copyBtn=card.querySelector('.copy-btn');
        const address=card.dataset.address;
        if(copyBtn&&address){
            copyBtn.addEventListener('click',()=>{
                const dummy=document.createElement('textarea');
                document.body.appendChild(dummy);
                dummy.value=address;
                dummy.select();
                document.execCommand('copy');
                document.body.removeChild(dummy);
                copyFeedback.textContent='Address copied!';
                copyFeedback.style.opacity='1';
                setTimeout(()=>{copyFeedback.style.opacity='0';},2000);
            });
        }
    });

    function updateAll(){ updateUI(); drawConnectorLine(); }

    function updateSliderConstraints(){
        const year=+yearSlider.value;
        const month=+monthSlider.value;
        const SY=START_DATE.getFullYear(), SM=START_DATE.getMonth()+1;
        const EY=END_DATE.getFullYear(),   EM=END_DATE.getMonth()+1;
        let clampMonth=month;
        if(year===SY && month<SM) clampMonth=SM;
        if(year===EY && month>EM) clampMonth=EM;
        if(clampMonth!==month) monthSlider.value=clampMonth;
        const curMonth=+monthSlider.value;
        const daysInMonth=new Date(year,curMonth,0).getDate();
        const SD=START_DATE.getDate(), ED=END_DATE.getDate();
        daySlider.min=(year===SY && curMonth===SM)?SD:1;
        daySlider.max=(year===EY && curMonth===EM)?ED:daysInMonth;
        if(+daySlider.value<+daySlider.min) daySlider.value=daySlider.min;
        if(+daySlider.value>+daySlider.max) daySlider.value=daySlider.max;
        dayMaxLabel.textContent=daySlider.max;
    }

    function generateQRCodes(){
        document.querySelectorAll('.donation-card').forEach(card=>{
            const address=card.dataset.address;
            const container=card.querySelector('.qr-code-container');
            if(address&&container){
                new QRCode(container,{text:address,width:112,height:112,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.H});
            }
        });
    }

    initialize();

    // --- MOBILE FIX: remove overflow-hidden on mobile -------------------
    function removeBodyOverflowHiddenOnMobile() {
        const isMobile = window.innerWidth < 768;
        if (isMobile && document.body.classList.contains('overflow-hidden')) {
            document.body.classList.remove('overflow-hidden');
        }
    }
    removeBodyOverflowHiddenOnMobile();
    window.addEventListener('resize', removeBodyOverflowHiddenOnMobile);

function applyUrlParameters(){
        const params=new URLSearchParams(window.location.search);

        const amountParam=parseFloat(params.get('amount'));
        if(!isNaN(amountParam) && amountParam>0){
            investmentAmount=amountParam;
            const inputEl = document.getElementById('investment-input');
            if (inputEl) inputEl.value = amountParam;
        }

        const dateParam=params.get('date');
        if(dateParam&&/^(\d{4})-(\d{2})-(\d{2})$/.test(dateParam)){
            const [y,m,d]=dateParam.split('-').map(Number);
            const reqDate=new Date(y,m-1,d);
            if(reqDate>=START_DATE && reqDate<=END_DATE){
                yearSlider.value=y;
                monthSlider.value=m;
                daySlider.value=d;
            }
        }

        const campaign=params.get('utm_campaign');
        if(campaign){
            switch(campaign){
                case 'neutral': subtitle.textContent=TEXT_VARIANTS.subtitle.neutral; break;
                case 'intriguing': subtitle.textContent=TEXT_VARIANTS.subtitle.intriguing; break;
                case 'diamond_hands': mainHeadline.textContent=TEXT_VARIANTS.mainHeadline.diamond; break;
                case 'fire_journey': donationHeadline.textContent=TEXT_VARIANTS.donationHeadline.fire; break;
                case 'coffee': donationHeadline.textContent=TEXT_VARIANTS.donationHeadline.coffee; break;
            }
        }
    }

    [yearSlider, monthSlider, daySlider].forEach(s =>
        s.addEventListener('input', () => {
            updateSliderConstraints();
            updateAll();
        })
    );

    donateBtn?.addEventListener('click', () => donationSection.classList.toggle('open'));

    const investmentInput = document.getElementById('investment-input');
    const decreaseBtn     = document.getElementById('decrease-investment');
    const increaseBtn     = document.getElementById('increase-investment');

    if (investmentInput) {
        investmentInput.addEventListener('input', () => {
            const val = parseFloat(investmentInput.value);
            if (!isNaN(val) && val > 0) {
                investmentAmount = val;
                updateAll();
            }
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

    document.querySelectorAll('.donation-card').forEach(card => {
        const copyBtn = card.querySelector('.copy-btn');
        const address = card.dataset.address;
        if (copyBtn && address) {
            copyBtn.addEventListener('click', () => {
                const dummy = document.createElement('textarea');
                document.body.appendChild(dummy);
                dummy.value = address;
                dummy.select();
                document.execCommand('copy');
                document.body.removeChild(dummy);
                copyFeedback.textContent = 'Address copied!';
                copyFeedback.style.opacity = '1';
                setTimeout(() => { copyFeedback.style.opacity = '0'; }, 2000);
            });
        }
    });

});
