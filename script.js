// Animated Counters
function animateCounters() {
    const counters = document.querySelectorAll('.stat-value, .exp-number');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseFloat(counter.getAttribute('data-target'));
                let count = 0;
                const speed = 50;
                
                const updateCount = () => {
                    const increment = target / speed;
                    if (count < target) {
                        count = Math.ceil(count + increment);
                        counter.textContent = count;
                        requestAnimationFrame(updateCount);
                    } else {
                        counter.textContent = target;
                    }
                };
                updateCount();
                observer.unobserve(counter);
            }
        });
    });
    
    counters.forEach(counter => observer.observe(counter));
}

// Hero Chart
function initHeroChart() {
    const ctx = document.getElementById('heroChart');
    if (!ctx) return;
    
    const chart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: Array(30).fill(''),
            datasets: [{
                label: 'Performance',
                data: generateRandomData(30),
                borderColor: '#FFD700',
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: false },
                y: { display: false }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Live Performance Chart
function initPerformanceChart() {
    const ctx = document.getElementById('liveChart');
    if (!ctx) return;
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: generateLiveChartData(),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#B8B8C8' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#B8B8C8' }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
    
    setInterval(() => {
        chart.data = generateLiveChartData();
        chart.update();
    }, 2000);
}

function generateRandomData(count) {
    return Array(count).fill().map(() => 100 + Math.random() * 20);
}

function generateLiveChartData() {
    return {
        labels: Array(50).fill(''),
        datasets: [{
            label: 'EUR/USD',
            data: generateRandomData(50),
            borderColor: '#00CFFF',
            backgroundColor: 'rgba(0, 207, 255, 0.05)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
        }]
    };
}

// Three.js Background
function initThreeJS() {
    const container = document.getElementById('threejs-bg');
    if (!container || typeof THREE === 'undefined') return;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    
    // Glowing particles
    const geometry = new THREE.BufferGeometry();
    const particles = 400;
    const positions = new Float32Array(particles * 3);
    
    for (let i = 0; i < particles * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 30;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        size: 0.08,
        color: 0x00CFFF,
        transparent: true,
        opacity: 0.6
    });
    
    const mesh = new THREE.Points(geometry, material);
    scene.add(mesh);
    camera.position.z = 15;
    
    function animate() {
        requestAnimationFrame(animate);
        mesh.rotation.y += 0.0005;
        mesh.rotation.x += 0.0003;
        renderer.render(scene, camera);
    }
    
    animate();
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// 3D Globe
function initGlobe() {
    const container = document.getElementById('globe-container');
    if (!container || typeof THREE === 'undefined') return;
    
    const width = container.offsetWidth || 250;
    const height = container.offsetHeight || 250;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    
    const globeGeometry = new THREE.SphereGeometry(5, 32, 32);
    const globeMaterial = new THREE.MeshBasicMaterial({
        color: 0x080B14,
        wireframe: true,
        opacity: 0.3,
        transparent: true
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);
    
    camera.position.z = 10;
    
    function animateGlobe() {
        requestAnimationFrame(animateGlobe);
        globe.rotation.y += 0.005;
        renderer.render(scene, camera);
    }
    
    animateGlobe();
}

// Mouse Glow Effect
function initMouseGlow() {
    const glow = document.querySelector('.mouse-glow');
    if (!glow) return;
    
    document.addEventListener('mousemove', (e) => {
        glow.style.left = e.clientX + 'px';
        glow.style.top = e.clientY + 'px';
    });
}

// Parallax Scrolling
function initParallax() {
    const pairs = document.querySelectorAll('.pair');
    
    window.addEventListener('mousemove', (e) => {
        const x = (e.clientX - window.innerWidth / 2) / 50;
        const y = (e.clientY - window.innerHeight / 2) / 50;
        
        pairs.forEach((pair, i) => {
            const speed = (i + 1) * 0.2;
            pair.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        });
    });
}

// Smooth Scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// GSAP Animations
function initGSAP() {
    if (typeof gsap === 'undefined') return;
    
    gsap.registerPlugin(ScrollTrigger);
    
    gsap.from('.hero-title', {
        opacity: 0,
        y: 50,
        duration: 1,
        ease: 'power3.out'
    });
    
    gsap.from('.hero-subtitle', {
        opacity: 0,
        y: 30,
        duration: 1,
        delay: 0.2,
        ease: 'power3.out'
    });
    
    gsap.from('.hero-buttons', {
        opacity: 0,
        y: 30,
        duration: 1,
        delay: 0.4,
        ease: 'power3.out'
    });
    
    gsap.utils.toArray('.section').forEach(section => {
        gsap.from(section.querySelector('.section-title'), {
            opacity: 0,
            y: 30,
            duration: 0.8,
            scrollTrigger: {
                trigger: section,
                start: 'top 80%'
            }
        });
    });
    
    gsap.utils.toArray('.feature-card, .gallery-item').forEach((card, i) => {
        gsap.from(card, {
            opacity: 0,
            y: 50,
            duration: 0.8,
            delay: i * 0.05,
            scrollTrigger: {
                trigger: card,
                start: 'top 85%'
            }
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    animateCounters();
    initHeroChart();
    initPerformanceChart();
    initThreeJS();
    initGlobe();
    initMouseGlow();
    initParallax();
    initGSAP();
});
