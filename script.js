(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const state = {
        marketPrices: {},
        charts: {}
    };

    const PRICE_REFRESH_MS = 5 * 60 * 1000;
    const MARKET_ITEMS = [
        { key: 'eurusd', label: 'EUR/USD', decimals: 4 },
        { key: 'gbpusd', label: 'GBP/USD', decimals: 4 },
        { key: 'usdjpy', label: 'USD/JPY', decimals: 2 },
        { key: 'xauusd', label: 'XAU/USD', decimals: 2 },
        { key: 'btcusd', label: 'BTC/USD', decimals: 0 },
        { key: 'nas100', label: 'NAS100', decimals: 0 },
        { key: 'us30', label: 'US30', decimals: 0 },
        { key: 'usdcad', label: 'USD/CAD', decimals: 4 },
        { key: 'ethusd', label: 'ETH/USD', decimals: 0 },
        { key: 'audusd', label: 'AUD/USD', decimals: 4 }
    ];

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function randomWalk(current, min, max, step) {
        return clamp(current + randomBetween(-step, step), min, max);
    }

    function formatNumber(value, decimals = 2) {
        return Number(value).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function parseMarketNumber(value) {
        if (typeof value === 'number') return value;
        return Number(String(value || '').replace(/[$,%\s,]/g, ''));
    }

    async function fetchJson(url) {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Market request failed: ${response.status}`);
        return response.json();
    }

    function withTrend(key, price, trendHint) {
        const previous = state.marketPrices[key]?.price;
        let trend = trendHint || 'flat';

        if (Number.isFinite(previous) && previous !== price) {
            trend = price > previous ? 'up' : 'down';
        }

        return {
            price,
            trend,
            updatedAt: new Date()
        };
    }

    async function fetchForexPrices() {
        const data = await fetchJson('https://open.er-api.com/v6/latest/USD');
        const rates = data?.rates || {};

        return {
            eurusd: withTrend('eurusd', 1 / rates.EUR),
            gbpusd: withTrend('gbpusd', 1 / rates.GBP),
            usdjpy: withTrend('usdjpy', rates.JPY),
            usdcad: withTrend('usdcad', rates.CAD),
            audusd: withTrend('audusd', 1 / rates.AUD)
        };
    }

    async function fetchMetalPrices() {
        const data = await fetchJson('https://api.gold-api.com/price/XAU');
        return {
            xauusd: withTrend('xauusd', parseMarketNumber(data?.price))
        };
    }

    async function fetchCryptoPrices() {
        const data = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
        const btcChange = parseMarketNumber(data?.bitcoin?.usd_24h_change);
        const ethChange = parseMarketNumber(data?.ethereum?.usd_24h_change);

        return {
            btcusd: withTrend('btcusd', parseMarketNumber(data?.bitcoin?.usd), btcChange >= 0 ? 'up' : 'down'),
            ethusd: withTrend('ethusd', parseMarketNumber(data?.ethereum?.usd), ethChange >= 0 ? 'up' : 'down')
        };
    }

    async function fetchIndexPrices() {
        const [nasdaqData, fearGreedData] = await Promise.all([
            fetchJson('https://api.nfin.dev/v1/quotes/indices'),
            fetchJson('https://feargreedchart.com/api/?action=all')
        ]);

        const indices = nasdaqData?.data?.data || [];
        const ndx = indices.find((item) => item.symbol === 'NDX') || indices.find((item) => item.symbol === 'QMI');
        const dia = fearGreedData?.market?.DIA;

        return {
            nas100: withTrend('nas100', parseMarketNumber(ndx?.lastSalePrice), ndx?.deltaIndicator === 'up' ? 'up' : 'down'),
            us30: withTrend('us30', parseMarketNumber(dia?.price) * 100, parseMarketNumber(dia?.pct) >= 0 ? 'up' : 'down')
        };
    }

    async function fetchMarketPrices() {
        const results = await Promise.allSettled([
            fetchForexPrices(),
            fetchMetalPrices(),
            fetchCryptoPrices(),
            fetchIndexPrices()
        ]);

        return results.reduce((prices, result) => {
            if (result.status === 'fulfilled') {
                Object.assign(prices, result.value);
            }
            return prices;
        }, {});
    }

    function initLoadingScreen() {
        const screen = $('.loading-screen');
        const progress = $('.loading-progress');
        if (!screen || !progress) return;

        const duration = prefersReducedMotion ? 120 : 520;
        const startedAt = performance.now();
        let isDone = false;

        function finish() {
            if (isDone) return;
            isDone = true;
            progress.style.transform = 'scaleX(1)';
            screen.classList.add('is-hidden');
            window.setTimeout(() => {
                screen.style.display = 'none';
            }, 360);
        }

        function frame(now) {
            if (isDone) return;
            const t = clamp((now - startedAt) / duration, 0, 1);
            progress.style.transform = `scaleX(${t})`;

            if (t < 1) {
                requestAnimationFrame(frame);
                return;
            }

            finish();
        }

        requestAnimationFrame(frame);
        window.setTimeout(finish, duration + 900);
    }

    function initTicker() {
        const ticker = $('#ticker-content');
        if (!ticker) return;

        function renderTicker() {
            const markup = MARKET_ITEMS.map((item) => {
                const quote = state.marketPrices[item.key];
                const trend = quote?.trend === 'down' ? 'down' : quote?.trend === 'up' ? 'up' : 'flat';
                const trendText = trend === 'down' ? 'DN' : trend === 'up' ? 'UP' : 'LIVE';
                const price = Number.isFinite(quote?.price) ? formatNumber(quote.price, item.decimals) : '...';
                return `<span class="ticker-item">${item.label}: ${price} <span class="${trend}">${trendText}</span></span>`;
            }).join('');

            ticker.innerHTML = markup + markup;
        }

        function renderTerminalPairs() {
            const pairMap = [
                ['eurusd', 0],
                ['gbpusd', 1],
                ['usdjpy', 2],
                ['xauusd', 3]
            ];
            const pairValues = $$('.currency-pairs .pair-value');

            pairMap.forEach(([key, index]) => {
                const quote = state.marketPrices[key];
                const config = MARKET_ITEMS.find((item) => item.key === key);
                if (!pairValues[index] || !quote || !config || !Number.isFinite(quote.price)) return;
                pairValues[index].textContent = formatNumber(quote.price, config.decimals);
            });
        }

        async function refreshPrices() {
            try {
                const prices = await fetchMarketPrices();
                state.marketPrices = { ...state.marketPrices, ...prices };
                renderTicker();
                renderTerminalPairs();
                syncTerminalChartPrice();
            } catch (error) {
                console.warn('Live market prices unavailable', error);
                renderTicker();
            }
        }

        renderTicker();
        refreshPrices();
        window.setInterval(() => {
            if (!document.hidden) refreshPrices();
        }, PRICE_REFRESH_MS);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) refreshPrices();
        });
    }

    function initSmoothScrolling() {
        $$('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener('click', (event) => {
                const href = anchor.getAttribute('href');
                if (!href || href === '#') return;

                const target = $(href);
                if (!target) return;

                event.preventDefault();
                const headerHeight = $('.header')?.offsetHeight || 0;
                const tickerHeight = $('.ticker-strip')?.offsetHeight || 0;
                const top = window.scrollY + target.getBoundingClientRect().top - headerHeight - tickerHeight - 12;
                window.scrollTo({ top: Math.max(top, 0), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
            });
        });
    }

    function scrollToContact() {
        const target = $('#contact');
        if (!target) {
            window.location.href = 'index.html#contact';
            return;
        }

        const headerHeight = $('.header')?.offsetHeight || 0;
        const tickerHeight = $('.ticker-strip')?.offsetHeight || 0;
        const top = window.scrollY + target.getBoundingClientRect().top - headerHeight - tickerHeight - 12;
        window.scrollTo({ top: Math.max(top, 0), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }

    function initHeroActions() {
        const viewStrategyBtn = $('#viewStrategyBtn');
        const openCapitalAccessBtn = $('#openCapitalAccessBtn');
        const bookPrivateCallBtn = $('#bookPrivateCallBtn');

        [viewStrategyBtn, openCapitalAccessBtn].forEach((button) => {
            if (!button) return;

            button.addEventListener('click', (event) => {
                event.preventDefault();
                window.location.href = './strategies.html';
            });
        });

        if (bookPrivateCallBtn) {
            bookPrivateCallBtn.addEventListener('click', (event) => {
                event.preventDefault();
                scrollToContact();
            });
        }
    }

    function initRevealObserver() {
        const targets = $$('.section, .dashboard-widget, .premium-card, .glass-card, .gallery-item, .timeline-step, .pricing-card-premium, .partnership-content, .partnership-image, .contact-content');
        targets.forEach((item) => item.classList.add('reveal-ready'));

        if (!('IntersectionObserver' in window) || prefersReducedMotion) {
            targets.forEach((item) => item.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.1 });

        targets.forEach((item) => observer.observe(item));
    }

    function createChartGradient(context, color) {
        const gradient = context.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        return gradient;
    }

    function createLineData(length, base, volatility) {
        const data = [];
        let current = base;
        for (let i = 0; i < length; i += 1) {
            current = randomWalk(current, base * 0.94, base * 1.08, volatility);
            data.push(Number(current.toFixed(2)));
        }
        return data;
    }

    function baseChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: prefersReducedMotion ? 0 : 450 },
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    displayColors: false,
                    backgroundColor: '#111820',
                    borderColor: 'rgba(214, 185, 112, 0.34)',
                    borderWidth: 1,
                    titleColor: '#f4f1ea',
                    bodyColor: '#aeb7c2'
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(204, 214, 224, 0.07)' },
                    ticks: { color: '#788390', maxTicksLimit: 6 }
                },
                y: {
                    grid: { color: 'rgba(204, 214, 224, 0.07)' },
                    ticks: { color: '#788390', maxTicksLimit: 5 }
                }
            }
        };
    }

    function syncTerminalChartPrice() {
        const chart = state.charts.terminal;
        const quote = state.marketPrices.xauusd || state.marketPrices.eurusd;
        if (!chart || !quote || !Number.isFinite(quote.price)) return;

        const dataset = chart.data.datasets[0].data;

        if (!chart.marketSynced) {
            chart.data.labels = dataset.map((_, index) => index + 1);
            chart.data.datasets[0].data = dataset.map(() => quote.price);
            chart.marketSynced = true;
        } else {
            chart.data.labels.shift();
            chart.data.labels.push(chart.data.labels[chart.data.labels.length - 1] + 1);
            chart.data.datasets[0].data.shift();
            chart.data.datasets[0].data.push(quote.price);
        }

        chart.update('none');
    }

    function initCharts() {
        if (typeof Chart === 'undefined') return;

        const terminalCanvas = $('#terminalChart');
        if (terminalCanvas) {
            const ctx = terminalCanvas.getContext('2d');
            const data = createLineData(38, 100, 0.58);

            state.charts.terminal = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map((_, index) => index + 1),
                    datasets: [{
                        data,
                        borderColor: '#d6b970',
                        backgroundColor: createChartGradient(ctx, 'rgba(214, 185, 112, 0.22)'),
                        borderWidth: 2,
                        tension: 0.32,
                        pointRadius: 0,
                        fill: true
                    }]
                },
                options: {
                    ...baseChartOptions(),
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    scales: { x: { display: false }, y: { display: false } }
                }
            });
        }

        const growthCanvas = $('#growthChart');
        if (growthCanvas) {
            const ctx = growthCanvas.getContext('2d');

            state.charts.growth = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        data: [82, 87, 89, 94, 98, 103, 108],
                        borderColor: '#8bb8d8',
                        backgroundColor: createChartGradient(ctx, 'rgba(139, 184, 216, 0.2)'),
                        borderWidth: 2,
                        tension: 0.34,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        pointBackgroundColor: '#111820',
                        pointBorderColor: '#d6b970',
                        fill: true
                    }]
                },
                options: baseChartOptions()
            });
        }

        syncTerminalChartPrice();
    }

    function setTextValue(element, nextValue, formatter) {
        if (!element) return;
        element.dataset.currentValue = String(nextValue);
        element.textContent = formatter ? formatter(nextValue) : formatNumber(nextValue);
    }

    function initLiveStats() {
        const profitValue = $('.widget-value.profit');
        const equityValue = $('.equity-widget .widget-value');
        const tradesValue = $('.trades-widget .widget-value');
        const growthValue = $('.dashboard-widget .widget-value.large');

        if (profitValue) profitValue.dataset.currentValue = '2450';
        if (equityValue) equityValue.dataset.currentValue = '124580';
        if (tradesValue) tradesValue.dataset.currentValue = '12';
        if (growthValue) growthValue.dataset.currentValue = '12.4';

        window.setInterval(() => {
            if (document.hidden) return;

            const profit = randomWalk(parseFloat(profitValue?.dataset.currentValue || '2450'), 2100, 3050, 65);
            const equity = randomWalk(parseFloat(equityValue?.dataset.currentValue || '124580'), 123000, 130500, 180);
            const trades = clamp(Math.round(randomWalk(parseFloat(tradesValue?.dataset.currentValue || '12'), 8, 18, 1)), 8, 18);
            const growth = randomWalk(parseFloat(growthValue?.dataset.currentValue || '12.4'), 10.2, 16.5, 0.18);

            setTextValue(profitValue, profit, (value) => `+${formatNumber(value, 2)}`);
            setTextValue(equityValue, equity, (value) => `$${formatNumber(value, 2)}`);
            setTextValue(tradesValue, trades, (value) => `${Math.round(value)}`);
            setTextValue(growthValue, growth, (value) => `+${Number(value).toFixed(1)}%`);
        }, 4200);
    }

    function initContactForm() {
        const form = $('.contact-form');
        if (!form) return;

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const button = $('.submit-btn', form);
            if (!button) return;

            const formData = new FormData(form);
            const name = String(formData.get('name') || '').trim();
            const email = String(formData.get('email') || '').trim();
            const phone = String(formData.get('phone') || '').trim();
            const message = String(formData.get('message') || '').trim();
            const subject = `THE FOREX BANK inquiry from ${name || 'website visitor'}`;
            const body = [
                `Name: ${name}`,
                `Email: ${email}`,
                `WhatsApp: ${phone || 'Not provided'}`,
                '',
                'Message:',
                message
            ].join('\n');
            const mailto = `mailto:theforexbank.000@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

            const originalText = button.textContent;
            button.textContent = 'OPENING EMAIL';
            window.location.href = mailto;

            window.setTimeout(() => {
                button.textContent = originalText;
                form.reset();
            }, 900);
        });
    }

    function boot() {
        initLoadingScreen();
        initTicker();
        initSmoothScrolling();
        initHeroActions();
        initRevealObserver();
        initLiveStats();
        initContactForm();

        window.setTimeout(initCharts, 80);
    }

    document.addEventListener('DOMContentLoaded', boot);
})();
