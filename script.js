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

    function latLngToVector3(lat, lng, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng + 180) * (Math.PI / 180);

        return new THREE.Vector3(
            -radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
    }

    function makeArc(start, end, lift) {
        const middle = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(1 + lift);
        const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
        return curve.getPoints(42);
    }

    function createWorldMapTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#0d151d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(214, 185, 112, 0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += 128) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += 96) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        function point(lng, lat) {
            return [
                ((lng + 180) / 360) * canvas.width,
                ((90 - lat) / 180) * canvas.height
            ];
        }

        function drawLand(points) {
            ctx.beginPath();
            points.forEach(([lng, lat], index) => {
                const [x, y] = point(lng, lat);
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(214, 185, 112, 0.32)';
        ctx.strokeStyle = 'rgba(242, 221, 154, 0.42)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(214, 185, 112, 0.28)';
        ctx.shadowBlur = 18;

        drawLand([[-168, 68], [-142, 72], [-112, 69], [-82, 60], [-58, 50], [-66, 28], [-88, 16], [-116, 22], [-132, 38], [-156, 50]]);
        drawLand([[-84, 12], [-66, 9], [-48, -7], [-39, -24], [-53, -55], [-69, -50], [-78, -24], [-82, -6]]);
        drawLand([[-18, 72], [10, 71], [38, 62], [44, 48], [26, 37], [8, 36], [-10, 44], [-24, 58]]);
        drawLand([[-18, 35], [12, 36], [34, 30], [48, 12], [42, -22], [24, -35], [8, -34], [-8, -18], [-15, 8]]);
        drawLand([[28, 72], [78, 73], [138, 61], [166, 48], [150, 20], [118, 6], [86, 22], [58, 16], [38, 34], [44, 52]]);
        drawLand([[68, 28], [90, 28], [104, 10], [98, -4], [78, 7]]);
        drawLand([[95, 6], [124, 8], [137, -7], [118, -12], [100, -6]]);
        drawLand([[112, -12], [154, -10], [156, -38], [134, -45], [114, -32]]);
        drawLand([[166, -34], [180, -38], [176, -46], [166, -43]]);
        drawLand([[-52, 76], [-30, 72], [-22, 64], [-42, 60], [-58, 66]]);
        drawLand([[42, 31], [58, 25], [54, 14], [42, 18]]);
        drawLand([[44, -12], [50, -16], [48, -24], [42, -22]]);

        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(139, 184, 216, 0.18)';
        ctx.strokeStyle = 'rgba(139, 184, 216, 0.26)';
        ctx.lineWidth = 1.5;
        drawLand([[135, 44], [146, 42], [144, 32], [132, 34]]);
        drawLand([[120, 24], [123, 21], [121, 18], [118, 21]]);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        return texture;
    }

    function initGlobalGlobe() {
        const container = $('#global-globe');
        if (!container || typeof THREE === 'undefined') return;

        const textureBase = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/';
        const textureLoader = new THREE.TextureLoader();

        const countries = [
            ['USA', 'USD', 38, -97], ['Canada', 'CAD', 56, -106], ['Mexico', 'MXN', 23, -102],
            ['Brazil', 'BRL', -14, -52], ['Argentina', 'ARS', -34, -64], ['UK', 'GBP', 55, -3],
            ['Eurozone', 'EUR', 50, 10], ['Switzerland', 'CHF', 47, 8], ['Norway', 'NOK', 61, 8],
            ['Sweden', 'SEK', 62, 15], ['Russia', 'RUB', 61, 90], ['UAE', 'AED', 24, 54],
            ['Saudi', 'SAR', 24, 45], ['South Africa', 'ZAR', -30, 25], ['India', 'INR', 22, 79],
            ['China', 'CNY', 35, 104], ['Japan', 'JPY', 36, 138], ['Korea', 'KRW', 36, 128],
            ['Singapore', 'SGD', 1, 104], ['Thailand', 'THB', 15, 101], ['Malaysia', 'MYR', 4, 102],
            ['Indonesia', 'IDR', -2, 118], ['Australia', 'AUD', -25, 134], ['New Zealand', 'NZD', -41, 174],
            ['Turkey', 'TRY', 39, 35], ['Egypt', 'EGP', 27, 30], ['Nigeria', 'NGN', 9, 8],
            ['Kenya', 'KES', 0, 37], ['Pakistan', 'PKR', 30, 70], ['Hong Kong', 'HKD', 22, 114],
            ['Philippines', 'PHP', 13, 122], ['Vietnam', 'VND', 16, 108]
        ].map(([name, currency, lat, lng]) => ({
            name,
            currency,
            lat,
            lng,
            vector: latLngToVector3(lat, lng, 1.02)
        }));

        const routePairs = [
            ['USA', 'UK'], ['USA', 'Japan'], ['USA', 'Singapore'], ['UK', 'India'],
            ['Eurozone', 'UAE'], ['China', 'Australia'], ['Japan', 'Australia'], ['India', 'Singapore'],
            ['Brazil', 'USA'], ['South Africa', 'UAE'], ['Canada', 'Eurozone'], ['Hong Kong', 'UK']
        ];

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(0, 0, 4.25);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        container.appendChild(renderer.domElement);

        const labelLayer = document.createElement('div');
        labelLayer.className = 'globe-label-layer';
        container.appendChild(labelLayer);

        const caption = document.createElement('div');
        caption.className = 'globe-caption';
        caption.innerHTML = '<span>Currency Network</span><span>Live Routes</span>';
        container.appendChild(caption);

        const group = new THREE.Group();
        scene.add(group);

        const globe = new THREE.Mesh(
            new THREE.SphereGeometry(1, 72, 72),
            new THREE.MeshPhongMaterial({
                color: 0xffffff,
                map: createWorldMapTexture(),
                emissive: 0x06120f,
                emissiveIntensity: 0.18,
                specular: 0x123c3a,
                shininess: 38,
                transparent: true,
                opacity: 0.98
            })
        );
        group.add(globe);

        textureLoader.load(`${textureBase}earth_atmos_2048.jpg`, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 8;
            globe.material.map = texture;
            globe.material.needsUpdate = true;
        });

        const cityLights = new THREE.Mesh(
            new THREE.SphereGeometry(1.004, 72, 72),
            new THREE.MeshBasicMaterial({
                color: 0x70fff0,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        group.add(cityLights);

        textureLoader.load(`${textureBase}earth_lights_2048.png`, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 8;
            cityLights.material.map = texture;
            cityLights.material.opacity = 0.72;
            cityLights.material.needsUpdate = true;
        });

        const clouds = new THREE.Mesh(
            new THREE.SphereGeometry(1.018, 72, 72),
            new THREE.MeshLambertMaterial({
                color: 0xbff7ef,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        group.add(clouds);

        textureLoader.load(`${textureBase}earth_clouds_1024.png`, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 8;
            clouds.material.map = texture;
            clouds.material.opacity = 0.26;
            clouds.material.needsUpdate = true;
        });

        const atmosphere = new THREE.Mesh(
            new THREE.SphereGeometry(1.055, 72, 72),
            new THREE.MeshBasicMaterial({
                color: 0x55ffe7,
                transparent: true,
                opacity: 0.16,
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide
            })
        );
        group.add(atmosphere);

        const wire = new THREE.LineSegments(
            new THREE.WireframeGeometry(new THREE.SphereGeometry(1.012, 36, 18)),
            new THREE.LineBasicMaterial({ color: 0xd6b970, transparent: true, opacity: 0.07 })
        );
        group.add(wire);

        const pointGeometry = new THREE.SphereGeometry(0.018, 10, 10);
        const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xf2dd9a });
        countries.forEach((country) => {
            const marker = new THREE.Mesh(pointGeometry, pointMaterial);
            marker.position.copy(country.vector);
            group.add(marker);

            const label = document.createElement('div');
            label.className = 'globe-label';
            label.innerHTML = `<strong>${country.currency}</strong>${country.name}`;
            labelLayer.appendChild(label);
            country.label = label;
        });

        const routes = routePairs.map(([fromName, toName], index) => {
            const from = countries.find((country) => country.name === fromName);
            const to = countries.find((country) => country.name === toName);
            if (!from || !to) return null;

            const geometry = new THREE.BufferGeometry().setFromPoints(makeArc(from.vector, to.vector, 0.28));
            const line = new THREE.Line(
                geometry,
                new THREE.LineBasicMaterial({
                    color: index % 3 === 0 ? 0x8bb8d8 : 0xd6b970,
                    transparent: true,
                    opacity: 0.18
                })
            );
            group.add(line);
            return line;
        }).filter(Boolean);

        scene.add(new THREE.AmbientLight(0x9fb2c2, 0.24));
        const keyLight = new THREE.DirectionalLight(0xe9fff9, 2.6);
        keyLight.position.set(-3, 2.4, 4.4);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0x55ffe7, 1.5);
        rimLight.position.set(3.2, 0.2, -2.4);
        scene.add(rimLight);

        const rayTarget = new THREE.Vector3();

        function resize() {
            const { width, height } = container.getBoundingClientRect();
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }

        function projectLabels() {
            const width = container.clientWidth;
            const height = container.clientHeight;

            countries.forEach((country) => {
                rayTarget.copy(country.vector).applyMatrix4(group.matrixWorld);
                const projected = rayTarget.clone().project(camera);
                const facing = rayTarget.normalize().dot(camera.position.clone().normalize());
                const visible = projected.z < 1 && facing > 0.05;

                country.label.style.opacity = visible ? '1' : '0';
                country.label.style.transform = `translate(-50%, -50%) scale(${visible ? 1 : 0.82})`;
                country.label.style.left = `${((projected.x + 1) / 2) * width}px`;
                country.label.style.top = `${((-projected.y + 1) / 2) * height}px`;
            });
        }

        function animate(time) {
            if (!prefersReducedMotion) {
                group.rotation.y += 0.0028;
                group.rotation.x = Math.sin(time * 0.00045) * 0.08;
                clouds.rotation.y += 0.0007;
            }

            routes.forEach((route, index) => {
                route.material.opacity = 0.12 + Math.max(0, Math.sin(time * 0.002 + index * 0.72)) * 0.42;
            });

            renderer.render(scene, camera);
            projectLabels();
            requestAnimationFrame(animate);
        }

        resize();
        animate(0);
        window.addEventListener('resize', resize);
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

    function initMyfxbookWidgetRefresh() {
        const widget = $('[data-myfxbook-widget]');
        if (!widget) return;

        const baseUrl = widget.getAttribute('src').replace(/([?&])refresh=\d+(&?)/, (match, prefix, suffix) => suffix ? prefix : '');
        const refreshWidget = () => {
            const separator = baseUrl.includes('?') ? '&' : '?';
            widget.setAttribute('src', `${baseUrl}${separator}refresh=${Date.now()}`);
        };

        refreshWidget();
        window.setInterval(() => {
            if (!document.hidden) refreshWidget();
        }, 15 * 60 * 1000);
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
        initGlobalGlobe();
        initLiveStats();
        initMyfxbookWidgetRefresh();
        initContactForm();

        window.setTimeout(initCharts, 80);
    }

    document.addEventListener('DOMContentLoaded', boot);
})();
