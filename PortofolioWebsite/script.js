document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.createElement('canvas');
    canvas.id = 'particle-canvas';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const particleCount = width < 768 ? 22 : 45;
    const LINK_DIST = 110;
    const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
    const FRAME_MS = 33;

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }, 150);
    });

    const mouse = { x: null, y: null, radius: 120 };
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

    function makeGlow(color) {
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, color);
        grad.addColorStop(0.35, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 32, 32);
        return c;
    }
    const glows = { '#c77dff': makeGlow('#c77dff'), '#00f5d4': makeGlow('#00f5d4') };

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2.5 + 1;
            this.vx = (Math.random() - 0.5) * 0.8;
            this.vy = (Math.random() - 0.5) * 0.8;
            this.color = Math.random() > 0.3 ? '#c77dff' : '#00f5d4';
        }

        draw() {
            const r = this.size * 3; // inti + halo
            ctx.drawImage(glows[this.color], this.x - r, this.y - r, r * 2, r * 2);
        }

        update(k) {
            this.x += this.vx * k;
            this.y += this.vy * k;

            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;

            if (mouse.x !== null && mouse.y !== null) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouse.radius && distance > 0) {
                    const force = (mouse.radius - distance) / mouse.radius;
                    this.x -= (dx / distance) * force * 3 * k;
                    this.y -= (dy / distance) * force * 3 * k;
                }
            }
        }
    }

    const particles = [];
    for (let i = 0; i < particleCount; i++) particles.push(new Particle());

    function connect() {
        ctx.lineWidth = 1;
        for (let a = 0; a < particles.length; a++) {
            const pa = particles[a];
            for (let b = a + 1; b < particles.length; b++) {
                const pb = particles[b];
                const dx = pa.x - pb.x;
                if (dx > LINK_DIST || dx < -LINK_DIST) continue;
                const dy = pa.y - pb.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < LINK_DIST_SQ) {
                    const opacity = 1 - Math.sqrt(d2) / LINK_DIST;
                    ctx.strokeStyle = `rgba(157, 78, 221, ${opacity * 0.25})`;
                    ctx.beginPath();
                    ctx.moveTo(pa.x, pa.y);
                    ctx.lineTo(pb.x, pb.y);
                    ctx.stroke();
                }
            }
        }
    }

    function drawFrame(k) {
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < particles.length; i++) {
            particles[i].update(k);
            particles[i].draw();
        }
        connect();
    }

    if (reduceMotion) { drawFrame(0); return; }

    let last = 0, rafId = 0;
    function animate(t) {
        rafId = requestAnimationFrame(animate);
        const dt = t - last;
        if (dt < FRAME_MS) return;
        last = t;
        drawFrame(Math.min(dt, 100) / 16.67);
    }
    rafId = requestAnimationFrame(animate);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancelAnimationFrame(rafId);
        else { last = 0; rafId = requestAnimationFrame(animate); }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('section[id], header[id]');
    const navLinks = document.querySelectorAll('.nav-menu a');

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const currentId = entry.target.getAttribute('id');
                
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href').includes(`#${currentId}`)) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        observer.observe(section);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const previews = document.querySelectorAll('.project-preview');

    function scalePreviews() {
        previews.forEach(box => {
            const iframe = box.querySelector('iframe');
            if (!iframe) return;
            const scale = box.clientWidth / 1280;
            iframe.style.transform = `scale(${scale})`;
        });
    }

    scalePreviews();
    window.addEventListener('resize', scalePreviews);
});

document.addEventListener('DOMContentLoaded', () => {
    const svg = document.getElementById('cluster-art');
    if (!svg) return;

    const NS = 'http://www.w3.org/2000/svg';
    let seed = 7;
    const rand = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };

    const make = (tag, attrs) => {
        const el = document.createElementNS(NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    };

    const clusters = [
        [95, 70, '#c77dff'],
        [200, 110, '#00f5d4'],
        [290, 60, '#ffd166']
    ];

    const dots = make('g', { class: 'cluster-dots' });
    const marks = make('g', { class: 'centroid-group' });

    clusters.forEach(([cx, cy, color]) => {
        for (let i = 0; i < 16; i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * 28;
            const dot = make('circle', {
                cx: Math.round(cx + Math.cos(angle) * dist * 1.3),
                cy: Math.round(cy + Math.sin(angle) * dist),
                r: 2 + Math.round(rand()),
                fill: color
            });
            dot.style.animationDelay = (rand() * 2.5).toFixed(2) + 's';
            dots.appendChild(dot);
        }

        const g = make('g', { class: 'centroid', stroke: color });
        g.appendChild(make('path', { d: `M${cx - 6} ${cy}h12M${cx} ${cy - 6}v12` }));
        g.appendChild(make('circle', { cx, cy, r: 9, fill: 'none' }));
        marks.appendChild(g);
    });

    for (let i = 0; i < 6; i++) {
        dots.appendChild(make('circle', {
            cx: Math.round(15 + rand() * 370),
            cy: Math.round(15 + rand() * 150),
            r: 2, fill: '#6b6b85', opacity: '.7'
        }));
    }

    svg.appendChild(dots);
    svg.appendChild(marks);
});

document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-menu a');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('show');
            
            const icon = navToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-xmark');
            }
        });

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('show');
                const icon = navToggle.querySelector('i');
                if (icon) {
                    icon.classList.add('fa-bars');
                    icon.classList.remove('fa-xmark');
                }
            });
        });
    }
});