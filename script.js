(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

    const state = {
        mouseX: window.innerWidth * 0.5,
        mouseY: window.innerHeight * 0.5,
        ticker: {
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
    const lerp = (a, b, t) => a + (b - a) * t;

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function randomWalk(current, min, max, step) {
        const next = current + randomBetween(-step, step);
        return clamp(next, min, max);
    }

    function formatNumber(value, decimals = 2) {
        return Number(value).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function animateTextValue(element, nextValue, formatter) {
        if (!element) return;

        const start = parseFloat(element.dataset.currentValue || '0');
        const duration = prefersReducedMotion ? 0 : 600;
        const startedAt = performance.now();

        function frame(now) {
            const t = duration === 0 ? 1 : clamp((now - startedAt) / duration, 0, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            const value = start + (nextValue - start) * eased;
            element.textContent = formatter ? formatter(value) : formatNumber(value);

            if (t < 1) {
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
        if (!screen || !progress) return;

        const duration = prefersReducedMotion ? 250 : 1200;
        const startedAt = performance.now();

        function frame(now) {
            const t = clamp((now - startedAt) / duration, 0, 1);
            const scaled = 0.15 + t * 0.85;
            progress.style.transform = `scaleX(${scaled})`;
            progress.style.opacity = String(0.45 + t * 0.55);

            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                screen.classList.add('is-hidden');
                window.setTimeout(() => {
                    screen.style.display = 'none';
                }, 500);
            }
        }

        requestAnimationFrame(frame);
    }

    function initTicker() {
        const ticker = $('#ticker-content');
        if (!ticker) return;

        ticker.innerHTML = ticker.innerHTML + ticker.innerHTML;

        window.setInterval(() => {
            if (document.hidden) return;

            state.ticker.eur = randomWalk(state.ticker.eur, 1.05, 1.12, 0.0025);
            state.ticker.gbp = randomWalk(state.ticker.gbp, 1.22, 1.31, 0.003);
            state.ticker.jpy = randomWalk(state.ticker.jpy, 149.5, 153.5, 0.12);
            state.ticker.xau = randomWalk(state.ticker.xau, 2290, 2388, 2.4);

            const items = $$('.ticker-item', ticker);
            if (items.length >= 4) {
                items[0].firstChild.textContent = `EUR/USD: ${formatNumber(state.ticker.eur, 4)} `;
                items[1].firstChild.textContent = `GBP/USD: ${formatNumber(state.ticker.gbp, 4)} `;
                items[2].firstChild.textContent = `USD/JPY: ${formatNumber(state.ticker.jpy, 2)} `;
                items[3].firstChild.textContent = `XAU/USD: ${formatNumber(state.ticker.xau, 2)} `;
            }
        }, 2300);
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

        function animate() {
            if (!document.hidden) {
                glow.style.opacity = String(0.08 + Math.sin(performance.now() * 0.0014) * 0.025 + 0.05);
            }
            requestAnimationFrame(animate);
        }

        animate();
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
                const top = window.scrollY + target.getBoundingClientRect().top - headerHeight - tickerHeight - 10;
                window.scrollTo({ top: Math.max(top, 0), behavior: prefersReducedMotion ? 'auto' : 'smooth' });
            });
        });
    }

    function initRevealObserver() {
        const revealTargets = $$('.section, .dashboard-widget, .premium-card, .glass-card, .gallery-item, .timeline-step, .pricing-card-premium, .contact-content');
        revealTargets.forEach((item) => item.classList.add('reveal-ready'));

        if (!('IntersectionObserver' in window)) {
            revealTargets.forEach((item) => item.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        revealTargets.forEach((item) => observer.observe(item));
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
            current = randomWalk(current, base * 0.92, base * 1.08, volatility);
            data.push(Number(current.toFixed(2)));
        }
        return data;
    }

    function initCharts() {
        if (typeof Chart === 'undefined') return;

        const terminalCanvas = $('#terminalChart');
        if (terminalCanvas) {
            const ctx = terminalCanvas.getContext('2d');
            const data = createLineData(42, 100, 0.65);

            state.charts.terminal = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map((_, index) => index + 1),
                    datasets: [{
                        data,
                        borderColor: '#00CFFF',
                        backgroundColor: createChartGradient(ctx, 'rgba(0, 207, 255, 0.25)'),
                        borderWidth: 2,
                        tension: 0.38,
                        pointRadius: 0,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: prefersReducedMotion ? 0 : 700 },
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
                        data: [82, 88, 91, 95, 99, 103, 108],
                        borderColor: '#FFD700',
                        backgroundColor: createChartGradient(ctx, 'rgba(255, 215, 0, 0.22)'),
                        borderWidth: 3,
                        tension: 0.38,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        pointBackgroundColor: '#050510',
                        pointBorderColor: '#FFD700',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: prefersReducedMotion ? 0 : 800 },
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#A5B0C9' }
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#A5B0C9' }
                        }
                    }
                }
            });
        }

        window.setInterval(() => {
            if (document.hidden || !state.charts.terminal) return;
            const latest = state.charts.terminal.data.datasets[0].data.slice(1);
            latest.push(Number((latest[latest.length - 1] + randomBetween(-1.2, 1.7)).toFixed(2)));
            state.charts.terminal.data.datasets[0].data = latest;
            state.charts.terminal.update('none');
        }, 2600);

        window.setInterval(() => {
            if (document.hidden || !state.charts.growth) return;
            state.charts.growth.data.datasets[0].data = createLineData(7, 100 + randomBetween(-2, 5), 1.2);
            state.charts.growth.update('none');
        }, 3200);
    }

    function initThreeBackground() {
        const container = $('#threejs-bg');
        if (!container || typeof THREE === 'undefined') return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 1000);
        camera.position.z = 17;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const particleCount = prefersReducedMotion ? 180 : 420;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i += 1) {
            const i3 = i * 3;
            positions[i3] = randomBetween(-24, 24);
            positions[i3 + 1] = randomBetween(-16, 16);
            positions[i3 + 2] = randomBetween(-24, 24);

            const mix = Math.random();
            colors[i3] = 0.2 + mix * 0.8;
            colors[i3 + 1] = 0.45 + mix * 0.45;
            colors[i3 + 2] = 1;
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.58,
            depthWrite: false
        });
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);

        const moneyGroup = new THREE.Group();
        const noteCount = prefersReducedMotion ? 8 : 18;
        for (let i = 0; i < noteCount; i += 1) {
            const note = new THREE.Mesh(
                new THREE.PlaneGeometry(0.48, 0.24),
                new THREE.MeshBasicMaterial({
                    color: i % 3 === 0 ? 0x39ff88 : (i % 3 === 1 ? 0x00cfff : 0xffd700),
                    transparent: true,
                    opacity: 0.32,
                    side: THREE.DoubleSide
                })
            );
            note.position.set(randomBetween(-18, 18), randomBetween(-10, 10), randomBetween(-14, 6));
            note.rotation.set(randomBetween(0, Math.PI), randomBetween(0, Math.PI), randomBetween(0, Math.PI));
            note.userData = {
                driftX: randomBetween(-0.01, 0.01),
                driftY: randomBetween(0.008, 0.02),
                driftZ: randomBetween(-0.008, 0.008),
                spin: randomBetween(0.004, 0.012)
            };
            moneyGroup.add(note);
        }
        scene.add(moneyGroup);

        const core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(2.8, 2),
            new THREE.MeshBasicMaterial({
                color: 0x0f1731,
                wireframe: true,
                transparent: true,
                opacity: 0.45
            })
        );
        core.position.set(2.2, 0.4, -1.3);
        scene.add(core);

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(4.8, 0.08, 12, 180),
            new THREE.MeshBasicMaterial({
                color: 0x00cfff,
                transparent: true,
                opacity: 0.16
            })
        );
        ring.rotation.x = Math.PI / 2.4;
        ring.position.set(-3, -1, -3);
        scene.add(ring);

        const floatingOrbs = [];
        for (let index = 0; index < 3; index += 1) {
            const orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.55 + index * 0.2, 24, 24),
                new THREE.MeshBasicMaterial({
                    color: index % 2 === 0 ? 0xffd700 : 0x00cfff,
                    transparent: true,
                    opacity: 0.45
                })
            );
            orb.position.set(-7.5 + index * 4.6, 3 - index * 0.8, -4 - index);
            orb.userData.baseY = orb.position.y;
            scene.add(orb);
            floatingOrbs.push(orb);
        }

        let targetRotX = 0;
        let targetRotY = 0;
        window.addEventListener('pointermove', (event) => {
            targetRotX = (event.clientY / window.innerHeight - 0.5) * 0.42;
            targetRotY = (event.clientX / window.innerWidth - 0.5) * 0.55;
        }, { passive: true });

        function animate() {
            if (!document.hidden) {
                particles.rotation.y += 0.0005;
                particles.rotation.x += 0.00015;
                core.rotation.x += 0.0025;
                core.rotation.y += 0.003;
                ring.rotation.z += 0.0015;
                core.rotation.x += (targetRotX - core.rotation.x) * 0.02;
                core.rotation.y += (targetRotY - core.rotation.y) * 0.02;

                floatingOrbs.forEach((orb, index) => {
                    const speed = 0.0018 + index * 0.0012;
                    orb.position.y = orb.userData.baseY + Math.sin(performance.now() * speed + index) * 0.22;
                    orb.rotation.y += 0.008;
                });

                moneyGroup.children.forEach((note) => {
                    note.position.x += note.userData.driftX;
                    note.position.y += note.userData.driftY;
                    note.position.z += note.userData.driftZ;
                    note.rotation.x += note.userData.spin;
                    note.rotation.z += note.userData.spin * 0.8;

                    if (note.position.y > 12) note.position.y = -12;
                    if (note.position.x > 20) note.position.x = -20;
                    if (note.position.x < -20) note.position.x = 20;
                });

                renderer.render(scene, camera);
            }

            requestAnimationFrame(animate);
        }

        animate();
        state.scenes.push({ renderer, scene, camera });

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
        camera.position.z = 8.4;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
                opacity: 0.38
            })
        );
        scene.add(globe);

        const aura = new THREE.Mesh(
            new THREE.SphereGeometry(2.7, 32, 32),
            new THREE.MeshBasicMaterial({
                color: 0x00cfff,
                transparent: true,
                opacity: 0.05
            })
        );
        scene.add(aura);

        const nodePositions = [];
        const nodeGroup = new THREE.Group();
        const nodeColors = [0x00cfff, 0xffd700, 0x39ff88];

        for (let i = 0; i < 14; i += 1) {
            const phi = Math.acos(1 - (2 * (i + 0.5)) / 14);
            const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 1);
            const x = 2.45 * Math.cos(theta) * Math.sin(phi);
            const y = 2.45 * Math.sin(theta) * Math.sin(phi);
            const z = 2.45 * Math.cos(phi);
            const position = new THREE.Vector3(x, y, z);
            nodePositions.push(position);

            const node = new THREE.Mesh(
                new THREE.SphereGeometry(0.055 + (i % 3) * 0.01, 12, 12),
                new THREE.MeshBasicMaterial({
                    color: nodeColors[i % nodeColors.length],
                    transparent: true,
                    opacity: 0.95
                })
            );
            node.position.copy(position);
            nodeGroup.add(node);
        }
        scene.add(nodeGroup);

        const connectionPairs = [
            [0, 4], [1, 6], [2, 8], [3, 10], [5, 11], [7, 12], [9, 13], [4, 9]
        ];
        const lines = [];
        connectionPairs.forEach(([a, b]) => {
            const geometry = new THREE.BufferGeometry().setFromPoints([nodePositions[a], nodePositions[b]]);
            const line = new THREE.Line(
                geometry,
                new THREE.LineBasicMaterial({
                    color: 0x2ce0ff,
                    transparent: true,
                    opacity: 0.12
                })
            );
            scene.add(line);
            lines.push(line);
        });

        const travelers = [];
        connectionPairs.forEach(([a, b], index) => {
            const traveler = new THREE.Mesh(
                new THREE.SphereGeometry(0.045, 12, 12),
                new THREE.MeshBasicMaterial({
                    color: index % 2 === 0 ? 0xffd700 : 0x00ff9d,
                    transparent: true,
                    opacity: 1
                })
            );
            traveler.userData = {
                start: nodePositions[a].clone(),
                end: nodePositions[b].clone(),
                progress: index / connectionPairs.length
            };
            travelers.push(traveler);
            scene.add(traveler);
        });

        function animate() {
            if (!document.hidden) {
                globe.rotation.y += 0.004;
                globe.rotation.x += 0.0007;
                aura.rotation.y -= 0.0013;
                nodeGroup.rotation.y += 0.0022;
                nodeGroup.rotation.x += 0.00025;

                travelers.forEach((traveler, index) => {
                    traveler.userData.progress = (traveler.userData.progress + 0.004 + index * 0.00025) % 1;
                    const t = traveler.userData.progress;
                    const eased = Math.sin(t * Math.PI);
                    traveler.position.lerpVectors(traveler.userData.start, traveler.userData.end, t);
                    traveler.position.multiplyScalar(1 + eased * 0.02);
                    traveler.scale.setScalar(0.9 + eased * 1.5);
                });

                lines.forEach((line, index) => {
                    line.material.opacity = 0.08 + Math.abs(Math.sin(performance.now() * 0.0012 + index)) * 0.12;
                });

                renderer.render(scene, camera);
            }

            requestAnimationFrame(animate);
        }

        animate();

        window.addEventListener('resize', () => {
            const nextWidth = container.clientWidth || 360;
            const nextHeight = container.clientHeight || 360;
            camera.aspect = nextWidth / nextHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(nextWidth, nextHeight);
        });
    }

    function initTiltCards() {
        if (isTouchDevice) return;

        const targets = $$('.premium-card, .glass-card, .dashboard-widget, .gallery-item, .pricing-card-premium, .contact-content, .trading-terminal, .timeline-step, .about-image-container');
        targets.forEach((element) => {
            element.classList.add('tilt-card');

            element.addEventListener('pointermove', (event) => {
                const rect = element.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width;
                const y = (event.clientY - rect.top) / rect.height;
                const rotateY = (x - 0.5) * 8;
                const rotateX = (0.5 - y) * 8;

                element.style.setProperty('--tilt-rotate-x', `${rotateX}deg`);
                element.style.setProperty('--tilt-rotate-y', `${rotateY}deg`);
            });

            element.addEventListener('pointerleave', () => {
                element.style.setProperty('--tilt-rotate-x', '0deg');
                element.style.setProperty('--tilt-rotate-y', '0deg');
            });
        });
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

            const profit = randomWalk(parseFloat(profitValue?.dataset.currentValue || '2450'), 2100, 3050, 85);
            const equity = randomWalk(parseFloat(equityValue?.dataset.currentValue || '124580'), 123000, 130500, 230);
            const trades = clamp(Math.round(randomWalk(parseFloat(tradesValue?.dataset.currentValue || '12'), 8, 18, 1)), 8, 18);
            const growth = randomWalk(parseFloat(growthValue?.dataset.currentValue || '12.4'), 10.2, 16.5, 0.25);

            animateTextValue(profitValue, profit, (value) => `+${formatNumber(value, 2)}`);
            animateTextValue(equityValue, equity, (value) => `$${formatNumber(value, 2)}`);
            animateTextValue(tradesValue, trades, (value) => `${Math.round(value)}`);
            animateTextValue(growthValue, growth, (value) => `+${Number(value).toFixed(1)}%`);
        }, 2900);
    }

    function initSectionMotion() {
        if (prefersReducedMotion || isTouchDevice || window.innerWidth < 900) return;
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

        gsap.registerPlugin(ScrollTrigger);

        gsap.from('.hero-left > *', {
            opacity: 0,
            y: 28,
            duration: 0.8,
            stagger: 0.08,
            ease: 'power3.out'
        });

        gsap.from('.hero-right', {
            opacity: 0,
            x: 45,
            duration: 0.9,
            delay: 0.15,
            ease: 'power3.out'
        });

        gsap.utils.toArray('.section').forEach((section) => {
            const title = section.querySelector('.section-title');
            if (!title) return;

            gsap.from(title, {
                opacity: 0,
                y: 20,
                duration: 0.7,
                scrollTrigger: {
                    trigger: section,
                    start: 'top 82%'
                }
            });
        });

        gsap.utils.toArray('.glass-card, .premium-card, .dashboard-widget, .gallery-item, .timeline-step, .pricing-card-premium, .contact-content').forEach((item, index) => {
            gsap.from(item, {
                opacity: 0,
                y: 34,
                scale: 0.98,
                duration: 0.7,
                delay: index * 0.02,
                scrollTrigger: {
                    trigger: item,
                    start: 'top 90%'
                }
            });
        });
    }

    function initFloatingDecor() {
        const symbols = $$('.currency-symbol');
        if (!symbols.length) return;

        symbols.forEach((symbol, index) => {
            symbol.style.animationDuration = `${8 + index * 0.8}s`;
            symbol.style.animationDelay = `${index * -0.6}s`;
        });
    }

    function boot() {
        initLoadingScreen();
        initTicker();
        initMouseGlow();
        initSmoothScrolling();
        initRevealObserver();
        initLiveStats();
        initFloatingDecor();

        window.setTimeout(() => {
            initCharts();
            initThreeBackground();
            initGlobalGlobe();
            initTiltCards();
            initSectionMotion();
        }, prefersReducedMotion ? 0 : 120);
    }

    document.addEventListener('DOMContentLoaded', boot);
})();
