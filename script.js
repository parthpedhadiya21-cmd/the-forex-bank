(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const state = {
        ticker: {
            eur: 1.0875,
            gbp: 1.2642,
            jpy: 151.25,
            xau: 2345.6
        },
        charts: {}
    };

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

    function initLoadingScreen() {
        const screen = $('.loading-screen');
        const progress = $('.loading-progress');
        if (!screen || !progress) return;

        const duration = prefersReducedMotion ? 120 : 520;
        const startedAt = performance.now();

        function frame(now) {
            const t = clamp((now - startedAt) / duration, 0, 1);
            progress.style.transform = `scaleX(${t})`;

            if (t < 1) {
                requestAnimationFrame(frame);
                return;
            }

            screen.classList.add('is-hidden');
            window.setTimeout(() => {
                screen.style.display = 'none';
            }, 360);
        }

        requestAnimationFrame(frame);
    }

    function initTicker() {
        const ticker = $('#ticker-content');
        if (!ticker) return;

        ticker.innerHTML += ticker.innerHTML;

        window.setInterval(() => {
            if (document.hidden) return;

            state.ticker.eur = randomWalk(state.ticker.eur, 1.05, 1.12, 0.0018);
            state.ticker.gbp = randomWalk(state.ticker.gbp, 1.22, 1.31, 0.002);
            state.ticker.jpy = randomWalk(state.ticker.jpy, 149.5, 153.5, 0.08);
            state.ticker.xau = randomWalk(state.ticker.xau, 2290, 2388, 1.6);

            const items = $$('.ticker-item', ticker);
            if (items.length < 4) return;

            items[0].firstChild.textContent = `EUR/USD: ${formatNumber(state.ticker.eur, 4)} `;
            items[1].firstChild.textContent = `GBP/USD: ${formatNumber(state.ticker.gbp, 4)} `;
            items[2].firstChild.textContent = `USD/JPY: ${formatNumber(state.ticker.jpy, 2)} `;
            items[3].firstChild.textContent = `XAU/USD: ${formatNumber(state.ticker.xau, 2)} `;
        }, 3200);
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
        const targets = $$('.section, .dashboard-widget, .premium-card, .glass-card, .gallery-item, .timeline-step, .pricing-card-premium, .contact-content');
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

        if (prefersReducedMotion) return;

        window.setInterval(() => {
            if (document.hidden || !state.charts.terminal) return;
            const dataset = state.charts.terminal.data.datasets[0].data;
            const last = dataset[dataset.length - 1] || 100;
            dataset.shift();
            dataset.push(Number(randomWalk(last, 94, 108, 0.8).toFixed(2)));
            state.charts.terminal.update('none');
        }, 2400);
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
