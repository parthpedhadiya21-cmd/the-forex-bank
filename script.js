// Three.js 3D Background
let scene, camera, renderer, particles;

function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.getElementById('webgl-container').appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(2, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00D4FF,
        wireframe: true,
        transparent: true,
        opacity: 0.1
    });
    particles = new THREE.Mesh(geometry, material);
    scene.add(particles);

    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 500;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 20;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.03,
        color: 0x00D4FF,
        transparent: true,
        opacity: 0.6
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function animate() {
    requestAnimationFrame(animate);
    particles.rotation.x += 0.002;
    particles.rotation.y += 0.002;
    renderer.render(scene, camera);
}

// GSAP Animations
function initGSAP() {
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

    gsap.utils.toArray('.step-card').forEach((card, i) => {
        gsap.from(card, {
            opacity: 0,
            y: 50,
            duration: 0.8,
            scrollTrigger: {
                trigger: card,
                start: 'top 80%',
            }
        });
    });

    gsap.utils.toArray('.feature-card').forEach((card, i) => {
        gsap.from(card, {
            opacity: 0,
            y: 50,
            duration: 0.8,
            scrollTrigger: {
                trigger: card,
                start: 'top 85%',
            }
        });
    });
}

// Chart.js Charts
function initCharts() {
    const heroCtx = document.getElementById('heroChart').getContext('2d');
    const heroChart = new Chart(heroCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Performance',
                data: [10, 15, 12, 18, 22, 25],
                borderColor: '#00D4FF',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
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
            plugins: { legend: { display: false } },
            elements: { line: { borderWidth: 2 } }
        }
    });

    const liveCtx = document.getElementById('liveChart').getContext('2d');
    const liveChart = new Chart(liveCtx, {
        type: 'candlestick',
        data: generateCandleData(),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: false },
                y: { 
                    display: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#B8B8C8' }
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    setInterval(() => {
        liveChart.data = generateCandleData();
        liveChart.update();
    }, 3000);
}

function generateCandleData() {
    const data = [];
    for (let i = 0; i < 20; i++) {
        const open = 100 + Math.random() * 10;
        const close = open + (Math.random() - 0.5) * 5;
        data.push({
            x: i,
            o: open,
            h: Math.max(open, close) + Math.random() * 3,
            l: Math.min(open, close) - Math.random() * 3,
            c: close
        });
    }
    return { datasets: [{ label: 'EUR/USD', data: data }] };
}

// Globe Visualization
function initGlobe() {
    const globeContainer = document.getElementById('globe-container');
    if (!globeContainer) return;

    const width = globeContainer.offsetWidth;
    const height = globeContainer.offsetHeight;

    const globeScene = new THREE.Scene();
    const globeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const globeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    globeRenderer.setSize(width, height);
    globeContainer.appendChild(globeRenderer.domElement);

    const globeGeometry = new THREE.SphereGeometry(5, 32, 32);
    const globeMaterial = new THREE.MeshBasicMaterial({
        color: 0x080B14,
        wireframe: true,
        opacity: 0.3,
        transparent: true
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    globeScene.add(globe);

    globeCamera.position.z = 10;

    function animateGlobe() {
        requestAnimationFrame(animateGlobe);
        globe.rotation.y += 0.005;
        globeRenderer.render(globeScene, globeCamera);
    }

    animateGlobe();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    initGSAP();
    initCharts();
    initGlobe();
    animate();
});
