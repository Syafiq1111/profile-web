document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.createElement('canvas');
    canvas.id = 'particle-canvas';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    const particles = [];
    const particleCount = Math.floor(width < 768 ? 35 : 75);

    const mouse = {
        x: null,
        y: null,
        radius: 120
    };

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.x;
        mouse.y = e.y;
    });

    window.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2.5 + 1;
            this.baseX = this.x;
            this.baseY = this.y;
            this.vx = (Math.random() - 0.5) * 0.8;
            this.vy = (Math.random() - 0.5) * 0.8;
            this.color = Math.random() > 0.3 ? '#c77dff' : '#00f5d4';
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;

            if (mouse.x != null && mouse.y != null) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouse.radius) {
                    let forceDirectionX = dx / distance;
                    let forceDirectionY = dy / distance;
                    let force = (mouse.radius - distance) / mouse.radius;
                    let directionX = forceDirectionX * force * 3;
                    let directionY = forceDirectionY * force * 3;

                    this.x -= directionX;
                    this.y -= directionY;
                }
            }
        }
    }

    function init() {
        particles.length = 0;
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }

    function connect() {
        for (let a = 0; a < particles.length; a++) {
            for (let b = a; b < particles.length; b++) {
                let dx = particles[a].x - particles[b].x;
                let dy = particles[a].y - particles[b].y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 110) {
                    let opacity = 1 - (distance / 110);
                    ctx.strokeStyle = `rgba(157, 78, 221, ${opacity * 0.25})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        connect();
        requestAnimationFrame(animate);
    }

    init();
    animate();
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
        // Toggle menu saat ikon hamburger diklik
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