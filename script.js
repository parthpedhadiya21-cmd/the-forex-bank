(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

    const state = {
        mouseX: window.innerWidth * 0.5,
        mouseY: window.innerHeight * 0.5,
        tickerValues: {
            eur: 1.0875,
            gbp: 1.2642,
            jpy: 151.25,
            xau: 2345.6
        },
        charts: {},
        scenes: []
    };

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const formatPrice = (value, decimals = 4) => Number(value).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function randomWalk(current, min, max, step) {
        const direction = Math.random() > 0.5 ? 1 : -1;
        return clamp(current + direction * randomBetween(0, step), min, max);
    }

    function animateTextValue(element, nextValue, formatter) {
        if (!element) return;
        const start = parseFloat(element.dataset.currentValue || '0');
        const duration = prefersReducedMotion ? 0 : 700;
        const startTime = performance.now();

        function frame(now) {
            const progress = duration === 0 ? 1 : clamp((now - startTime) / duration, 0, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = start + (nextValue - start) * eased;
            element.textContent = formatter ? formatter(value) : value.toFixed(2);
            if (progress < 1) {
                requestAnimationFrame(frame);
            } else {
                element.dataset.currentValue = String(nextValue);
            }
        }

        requestAnimationFrame(frame);
    }

    function initLoadingScreen() {
        const screen = $('.loading-screen');
        const progress = $('.loading-progress');
        if (!screen) return;

        let elapsed = 0;
        const duration = prefersReducedMotion ? 350 : 1800;
        const start = performance.now();

        function tick(now) {
            elapsed = now - start;
            const t = clamp(elapsed / duration, 0, 1);
            if (progress) {
                progress.style.transform = `scaleX(${0.15 + t * 0.85})`;
                progress.style.opacity = String(0.4 + t * 0.6);
            }
            if (t < 1) {
                requestAnimationFrame(tick);
            } else {
                screen.classList.add('is-hidden');
                setTimeout(() => {
                    screen.style.display = 'none';
                }, 600);
            }
        }

        requestAnimationFrame(tick);
    }

    function initTicker() {
        const ticker = $('#ticker-content');
        if (!ticker) return;

        ticker.innerHTML = ticker.innerHTML + ticker.innerHTML;

        setInterval(() => {
            state.tickerValues.eur = randomWalk(state.tickerValues.eur, 1.05, 1.12, 0.0025);
            state.tickerValues.gbp = randomWalk(state.tickerValues.gbp, 1.22, 1.31, 0.003);
            state.tickerValues.jpy = randomWalk(state.tickerValues.jpy, 149.5, 153.5, 0.12);
            state.tickerValues.xau = randomWalk(state.tickerValues.xau, 2290, 2388, 2.4);

            const items = $$('.ticker-item', ticker);
            if (items.length >= 4) {
                items[0].firstChild.textContent = `EUR/USD: ${formatPrice(state.tickerValues.eur, 4)} `;
                items[1].firstChild.textContent = `GBP/USD: ${formatPrice(state.tickerValues.gbp, 4)} `;
                items[2].firstChild.textContent = `USD/JPY: ${formatPrice(state.tickerValues.jpy, 2)} `;
                items[3].firstChild.textContent = `XAU/USD: ${formatPrice(state.tickerValues.xau, 2)} `;
            }
        }, 2200);
    }

    function initMouseGlow() {
        const glow = $('.mouse-glow');
        if (!glow || isTouchDevice) return;

        document.addEventListener('pointermove', (event) => {
            state.mouseX = event.clientX;
            state.mouseY = event.clientY;
            glow.style.left = `${state.mouseX}px`;
            glow.style.top = `${state.mouseY}px`;
            document.documentElement.style.setProperty('--mx', `${state.mouseX}px`);
            document.documentElement.style.setProperty('--my', `${state.mouseY}px`);
        }, { passive: true });

        function animateGlow() {
            glow.style.opacity = String(0.08 + Math.sin(performance.now() * 0.0015) * 0.03 + 0.06);
            requestAnimationFrame(animateGlow);
        }

        animateGlow();
    }

    function initSmoothScrolling() {
        $$('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener('click', (event) => {
                const id = anchor.getAttribute('href');
                if (!id || id === '#') return;
                const target = $(id);
                if (!target) return;

                event.preventDefault();
                const headerHeight = $('.header')?.offsetHeight || 0;
                const tickerHeight = $('.ticker-strip')?.offsetHeight || 0;
                const top = window.scrollY + target.getBoundingClientRect().top - headerHeight - tickerHeight - 12;
                window.scrollTo({ top: Math.max(top, 0), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
            });
        });
    }

    function initRevealFallback() {
        const reveals = $$('.section, .dashboard-widget, .premium-card, .glass-card, .gallery-item, .timeline-step, .pricing-card-premium, .contact-content');
        reveals.forEach((element) => element.classList.add('reveal-ready'));

        if (!('IntersectionObserver' in window)) {
            reveals.forEach((element) => element.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        reveals.forEach((element) => observer.observe(element));
    }

    function createLineData(points, start, volatility) {
        const data = [];
        let current = start;
        for (let i = 0; i < points; i += 1) {
            current = randomWalk(current, start * 0.92, start * 1.1, volatility);
            data.push(Number(current.toFixed(2)));
        }
        return data;
    }

    function createChartGradient(context, color) {
        const gradient = context.createLinearGradient(0, 0, 0, 250);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        return gradient;
    }

    function initCharts() {
        if (typeof Chart === 'undefined') return;

        const terminalCanvas = $('#terminalChart');
        if (terminalCanvas) {
            const context = terminalCanvas.getContext('2d');
            const data = createLineData(42, 100, 0.6);

            state.charts.terminal = new Chart(context, {
                type: 'line',
                data: {
                    labels: data.map((_, index) => index + 1),
                    datasets: [{
                        data,
                        borderColor: '#00CFFF',
                        backgroundColor: createChartGradient(context, 'rgba(0, 207, 255, 0.26)'),
                        borderWidth: 2,
                        tension: 0.35,
                        pointRadius: 0,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: prefersReducedMotion ? 0 : 1000 },
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    scales: {
                        x: { display: false },
                        y: { display: false }
                    }
                }
            });
        }

        const growthCanvas = $('#growthChart');
        if (growthCanvas) {
            const context = growthCanvas.getContext('2d');
            const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const data = [82, 88, 91, 95, 99, 103, 108];

            state.charts.growth = new Chart(context, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Growth',
                        data,
                        borderColor: '#FFD700',
                        backgroundColor: createChartGradient(context, 'rgba(255, 215, 0, 0.24)'),
                        borderWidth: 3,
                        tension: 0.38,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#050510',
                        pointBorderColor: '#FFD700',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: prefersReducedMotion ? 0 : 1200 },
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.06)' },
                            ticks: { color: '#B8B8C8' }
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.06)' },
                            ticks: { color: '#B8B8C8' }
                        }
                    }
                }
            });

            setInterval(() => {
                const nextData = createLineData(7, 100 + randomBetween(-3, 6), 1.4);
                state.charts.growth.data.datasets[0].data = nextData;
                state.charts.growth.update('none');
            }, 2500);
        }

        setInterval(() => {
            if (state.charts.terminal) {
                const latest = state.charts.terminal.data.datasets[0].data.slice(1);
                latest.push(Number((latest[latest.length - 1] + randomBetween(-1.4, 1.9)).toFixed(2)));
                state.charts.terminal.data.datasets[0].data = latest;
                state.charts.terminal.update('none');
            }
        }, 1800);
    }

    function initThreeBackground() {
        const container = $('#threejs-bg');
        if (!container || typeof THREE === 'undefined') return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
        camera.position.z = 18;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const particleCount = prefersReducedMotion ? 280 : 700;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i += 1) {
            const i3 = i * 3;
            positions[i3] = randomBetween(-28, 28);
            positions[i3 + 1] = randomBetween(-18, 18);
            positions[i3 + 2] = randomBetween(-28, 28);

            const mix = Math.random();
            colors[i3] = 0.3 + mix * 0.7;
            colors[i3 + 1] = 0.6 + mix * 0.35;
            colors[i3 + 2] = 1;
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            depthWrite: false
        });
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);

        const coreGeometry = new THREE.IcosahedronGeometry(2.8, 2);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0x0f1731,
            wireframe: true,
            transparent: true,
            opacity: 0.6
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.position.set(2.5, 0.5, -1.5);
        scene.add(core);

        const ringGeometry = new THREE.TorusGeometry(4.8, 0.08, 12, 180);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00cfff,
            transparent: true,
            opacity: 0.25
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2.4;
        ring.position.set(-3, -1, -3);
        scene.add(ring);

        const floatingOrbs = [];
        for (let index = 0; index < 3; index += 1) {
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.6 + index * 0.25, 24, 24),
                new THREE.MeshBasicMaterial({
                    color: index % 2 === 0 ? 0xffd700 : 0x8a2be2,
                    transparent: true,
                    opacity: 0.75
                })
            );
            orb.position.set(-8 + index * 4.5, 3 - index, -4 - index);
            orb.userData.baseY = orb.position.y;
            scene.add(orb);
            floatingOrbs.push(orb);
        }

        let targetRotX = 0;
        let targetRotY = 0;

        const pointerHandler = (event) => {
            targetRotX = (event.clientY / window.innerHeight - 0.5) * 0.65;
            targetRotY = (event.clientX / window.innerWidth - 0.5) * 0.85;
        };

        window.addEventListener('pointermove', pointerHandler, { passive: true });

        function animate() {
            particles.rotation.y += 0.0007;
            particles.rotation.x += 0.0002;
            core.rotation.x += 0.003;
            core.rotation.y += 0.004;
            ring.rotation.z += 0.002;

            core.rotation.x += (targetRotX - core.rotation.x) * 0.03;
            core.rotation.y += (targetRotY - core.rotation.y) * 0.03;

            floatingOrbs.forEach((orb, index) => {
                const speed = 0.002 + index * 0.0015;
                orb.position.y = orb.userData.baseY + Math.sin(performance.now() * speed + index) * 0.25;
                orb.rotation.y += 0.01;
            });

            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        }

        animate();
        state.scenes.push({ renderer, camera, scene });

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    function initGlobalGlobe() {
        const container = $('#global-globe');
        if (!container || typeof THREE === 'undefined') return;

        const width = container.clientWidth || 360;
        const height = container.clientHeight || 360;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.z = 8.5;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const globe = new THREE.Mesh(
            new THREE.SphereGeometry(2.35, 42, 42),
            new THREE.MeshBasicMaterial({
                color: 0x0a1020,
                wireframe: true,
                transparent: true,
                opacity: 0.55
            })
        );
        scene.add(globe);

        const aura = new THREE.Mesh(
            new THREE.SphereGeometry(2.7, 32, 32),
            new THREE.MeshBasicMaterial({
                color: 0x00cfff,
                transparent: true,
                opacity: 0.08
            })
        );
        scene.add(aura);

        const latitudes = new THREE.Group();
        for (let i = 0; i < 6; i += 1) {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(2.55, 0.018, 10, 180),
                new THREE.MeshBasicMaterial({
                    color: i % 2 === 0 ? 0x00cfff : 0xffd700,
                    transparent: true,
                    opacity: 0.22
                })
            );
            ring.rotation.x = Math.PI / 2 + (i * Math.PI) / 6;
            ring.rotation.z = (i * Math.PI) / 6;
            latitudes.add(ring);
        }
        scene.add(latitudes);

        const orbitPoints = new THREE.Group();
        for (let index = 0; index < 18; index += 1) {
            const dot = new THREE.Mesh(
                new THREE.SphereGeometry(0.04 + (index % 4) * 0.01, 12, 12),
                new THREE.MeshBasicMaterial({
                    color: index % 3 === 0 ? 0xffd700 : 0x00cfff,
                    transparent: true,
                    opacity: 0.9
                })
            );
            const angle = (index / 18) * Math.PI * 2;
            dot.position.set(Math.cos(angle) * 2.6, Math.sin(angle * 1.3) * 1.2, Math.sin(angle) * 2.6);
            orbitPoints.add(dot);
        }
        scene.add(orbitPoints);

        function animate() {
            globe.rotation.y += 0.006;
            globe.rotation.x += 0.0009;
            aura.rotation.y -= 0.002;
            latitudes.rotation.y += 0.003;
            orbitPoints.rotation.y += 0.005;
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        }

        animate();

        const handleResize = () => {
            const nextWidth = container.clientWidth || 360;
            const nextHeight = container.clientHeight || 360;
            camera.aspect = nextWidth / nextHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(nextWidth, nextHeight);
        };

        window.addEventListener('resize', handleResize);
    }

    function initTiltCards() {
        if (isTouchDevice) return;

        const tiltTargets = $$('.premium-card, .glass-card, .dashboard-widget, .gallery-item, .pricing-card-premium, .contact-content, .trading-terminal, .timeline-step, .about-image-container');

        tiltTargets.forEach((element) => {
            element.classList.add('tilt-card');

            element.addEventListener('pointermove', (event) => {
                const rect = element.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width;
                const y = (event.clientY - rect.top) / rect.height;
                const rotateY = (x - 0.5) * 10;
                const rotateX = (0.5 - y) * 10;
                element.style.setProperty('--tilt-rotate-x', `${rotateX}deg`);
                element.style.setProperty('--tilt-rotate-y', `${rotateY}deg`);
                element.style.setProperty('--tilt-shift-x', `${(x - 0.5) * 18}px`);
                element.style.setProperty('--tilt-shift-y', `${(y - 0.5) * 18}px`);
            });

            element.addEventListener('pointerleave', () => {
                element.style.setProperty('--tilt-rotate-x', '0deg');
                element.style.setProperty('--tilt-rotate-y', '0deg');
                element.style.setProperty('--tilt-shift-x', '0px');
                element.style.setProperty('--tilt-shift-y', '0px');
            });
        });
    }

    function initLiveStats() {
        const profitValue = $('.widget-value.profit');
        const equityValue = $('.equity-widget .widget-value');
        const tradeValue = $('.trades-widget .widget-value');
        const monthlyGrowth = $('.dashboard-widget .widget-value.large');

        if (profitValue) profitValue.dataset.currentValue = '2450';
        if (equityValue) equityValue.dataset.currentValue = '124580';
        if (tradeValue) tradeValue.dataset.currentValue = '12';
        if (monthlyGrowth) monthlyGrowth.dataset.currentValue = '12.4';

        setInterval(() => {
            const profit = randomWalk(parseFloat(profitValue?.dataset.currentValue || '2450'), 2100, 3050, 80);
            const equity = randomWalk(parseFloat(equityValue?.dataset.currentValue || '124580'), 123000, 130000, 250);
            const trades = clamp(Math.round(randomWalk(parseFloat(tradeValue?.dataset.currentValue || '12'), 8, 18, 1)), 8, 18);
            const growth = randomWalk(parseFloat(monthlyGrowth?.dataset.currentValue || '12.4'), 10.2, 16.5, 0.3);

            animateTextValue(profitValue, profit, (value) => `+${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            animateTextValue(equityValue, equity, (value) => `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            animateTextValue(tradeValue, trades, (value) => `${Math.round(value)}`);
            animateTextValue(monthlyGrowth, growth, (value) => `+${Number(value).toFixed(1)}%`);
        }, 2800);
    }

    function initSectionMotion() {
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);

            gsap.from('.hero-left > *', {
                opacity: 0,
                y: 28,
                duration: 0.9,
                stagger: 0.08,
                ease: 'power3.out'
            });

            gsap.from('.hero-right', {
                opacity: 0,
                x: 60,
                duration: 1,
                delay: 0.2,
                ease: 'power3.out'
            });

            gsap.utils.toArray('.section').forEach((section) => {
                const title = section.querySelector('.section-title');
                if (title) {
                    gsap.from(title, {
                        opacity: 0,
                        y: 24,
                        duration: 0.8,
                        scrollTrigger: {
                            trigger: section,
                            start: 'top 82%'
                        }
                    });
                }
            });

            gsap.utils.toArray('.glass-card, .premium-card, .dashboard-widget, .gallery-item, .timeline-step, .pricing-card-premium, .contact-content').forEach((item, index) => {
                gsap.from(item, {
                    opacity: 0,
                    y: 40,
                    scale: 0.96,
                    duration: 0.75,
                    delay: index * 0.02,
                    scrollTrigger: {
                        trigger: item,
                        start: 'top 90%'
                    }
                });
            });
        }
    }

    function initFloatingDecor() {
        const symbols = $$('.currency-symbol');
        if (!symbols.length) return;

        symbols.forEach((symbol, index) => {
            const duration = 8 + index * 0.9;
            symbol.style.animationDuration = `${duration}s`;
            symbol.style.animationDelay = `${index * -0.7}s`;
        });
    }

    function boot() {
        initLoadingScreen();
        initTicker();
        initMouseGlow();
        initSmoothScrolling();
        initRevealFallback();
        initCharts();
        initThreeBackground();
        initGlobalGlobe();
        initTiltCards();
        initLiveStats();
        initSectionMotion();
        initFloatingDecor();
    }

    document.addEventListener('DOMContentLoaded', boot);
})();
