// Animated Counters
function animateCounters() {
    const counters = document.querySelectorAll('.stat-value');
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
                        if (counter.getAttribute('data-target') === '1:2') {
                            counter.textContent = '1:2';
                        } else {
                            counter.textContent = count;
                        }
                        requestAnimationFrame(updateCount);
                    } else {
                        if (counter.getAttribute('data-target') === '1:2') {
                            counter.textContent = '1:2';
                        } else {
                            counter.textContent = target;
                        }
                    }
                };
                updateCount();
                observer.unobserve(counter);
            }
        });
    });
    
    counters.forEach(counter => observer.observe(counter));
}

// Hero Chart with Chart.js
function initHeroChart() {
    const ctx = document.getElementById('heroChart');
    if (!ctx) return;
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
            datasets: [{
                label: 'Performance',
                data: [10, 15, 12, 18, 22, 20, 25],
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

// Performance Chart
function initPerformanceChart() {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: generateChartData(),
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
        chart.data = generateChartData();
        chart.update();
    }, 3000);
}

function generateChartData() {
    const labels = [];
    const data = [];
    const now = new Date();
    
    for (let i = 0; i < 30; i++) {
        labels.push('');
        data.push(100 + Math.random() * 20);
    }
    
    return {
        labels: labels,
        datasets: [{
            label: 'EUR/USD',
            data: data,
            borderColor: '#00CFFF',
            backgroundColor: 'rgba(0, 207, 255, 0.05)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
        }]
    };
}

// GSAP Animations
function initAnimations() {
    const gsapAvailable = typeof gsap !== 'undefined';
    
    if (!gsapAvailable) {
        console.warn('GSAP not loaded');
        return;
    }
    
    gsap.registerPlugin(ScrollTrigger);
    
    gsap.utils.toArray('section').forEach((section, i) => {
        gsap.from(section.querySelector('.section-header'), {
            opacity: 0,
            y: 30,
            duration: 0.8,
            scrollTrigger: {
                trigger: section,
                start: 'top 80%'
            }
        });
    });
    
    gsap.utils.toArray('.feature-card').forEach((card, i) => {
        gsap.from(card, {
            opacity: 0,
            y: 50,
            duration: 0.8,
            delay: i * 0.1,
            scrollTrigger: {
                trigger: card,
                start: 'top 85%'
            }
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    animateCounters();
    initHeroChart();
    initPerformanceChart();
    initAnimations();
});

// Particles.js fallback
function initParticles() {
    const container = document.getElementById('particles-js');
    if (!container) return;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    
    const geometry = new THREE.BufferGeometry();
    const particles = 300;
    const positions = new Float32Array(particles * 3);
    
    for (let i = 0; i < particles * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 20;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x00CFFF,
        transparent: true,
        opacity: 0.5
    });
    
    const mesh = new THREE.Points(geometry, material);
    scene.add(mesh);
    camera.position.z = 10;
    
    function animate() {
        requestAnimationFrame(animate);
        mesh.rotation.y += 0.001;
        renderer.render(scene, camera);
    }
    
    animate();
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
