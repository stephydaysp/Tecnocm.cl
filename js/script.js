// ===== Fondo espacial (estrellas, parallax, nebulosas, fugaces) =====
const starsCanvas = document.getElementById('stars');
const sctx = starsCanvas.getContext('2d');
let SW=0, SH=0, SDPR=1;

function resizeStars(){
  SDPR = Math.min(window.devicePixelRatio||1, 2);
  SW = starsCanvas.width = Math.floor(innerWidth * SDPR);
  SH = starsCanvas.height = Math.floor(innerHeight * SDPR);
  starsCanvas.style.width = innerWidth + 'px';
  starsCanvas.style.height = innerHeight + 'px';
  initStars();
}

let STARS = [], SHOOTERS = [];
function initStars(){
  const count = Math.floor((innerWidth*innerHeight)/9000);
  STARS = Array.from({length: Math.min(280, Math.max(120, count))}, () => ({
    x: Math.random()*SW,
    y: Math.random()*SH,
    z: Math.random()*0.8 + 0.2, // profundidad
    r: Math.random()*1.8 + 0.4,  // radio base
    a: Math.random()*0.6 + 0.3,  // alpha base
    t: Math.random()*Math.PI*2,  // fase twinkle
    s: Math.random()*0.015 + 0.005 // velocidad twinkle
  }));
}

let pmx=0, pmy=0; // parallax target (0..1)
addEventListener('mousemove', (e)=>{
  pmx = e.clientX / innerWidth - 0.5;
  pmy = e.clientY / innerHeight - 0.5;
}, {passive:true});

function spawnShooter(){
  const y = Math.random()*SH*0.6;
  SHOOTERS.push({ x: -50, y, vx: (3+Math.random()*2)*SDPR, vy: (0.6+Math.random()*0.4)*SDPR, life: 0.9, age: 0 });
}

let lastShooter = 0;
const WARP_SPEED = 0.01; // Velocidad del viaje espacial (más bajo = más lento)
function drawStars(time){
  sctx.clearRect(0,0,SW,SH);

  // Parallax ligero
  const ox = pmx * 8 * SDPR;
  const oy = pmy * 6 * SDPR;

  // Estrellas
  for(const star of STARS){
    // 1. Movimiento de viaje espacial
    const dx = star.x - SW / 2;
    const dy = star.y - SH / 2;
    star.x += dx * star.z * WARP_SPEED;
    star.y += dy * star.z * WARP_SPEED;

    // 2. Parpadeo (twinkle)
    star.t += star.s;
    const tw = 0.65 + Math.sin(star.t)*0.35; // brillo
    const alpha = star.a * tw;
    const radius = star.r * (0.5 + star.z*0.8);
    const sx = star.x + ox*star.z;
    const sy = star.y + oy*star.z;

    // 3. Reciclar estrellas que se salen de la pantalla
    if (sx < 0 || sx > SW || sy < 0 || sy > SH) {
      star.x = SW / 2 + (Math.random() - 0.5) * SW * 0.1;
      star.y = SH / 2 + (Math.random() - 0.5) * SH * 0.1;
      star.z = Math.random()*0.8 + 0.2;
    }

    // Halo sutil
    const g = sctx.createRadialGradient(sx, sy, 0, sx, sy, radius*3);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.5, `rgba(0,229,255,${alpha*0.35})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = g;
    sctx.beginPath(); sctx.arc(sx, sy, radius*3, 0, Math.PI*2); sctx.fill();

    // núcleo
    sctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha+0.2)})`;
    sctx.beginPath(); sctx.arc(sx, sy, radius, 0, Math.PI*2); sctx.fill();
  }

  // Estrellas fugaces
  if(time - lastShooter > 2200 + Math.random()*2800){ lastShooter = time; if(Math.random()<0.6) spawnShooter(); }
  sctx.globalCompositeOperation = 'lighter';
  for(let i=SHOOTERS.length-1;i>=0;i--){
    const s = SHOOTERS[i];
    s.age += 0.016; s.x += s.vx; s.y += s.vy; s.vy += 0.02*SDPR; // curva leve
    const trail = 80 * SDPR;
    const alpha = Math.max(0, (s.life - s.age));
    const grad = sctx.createLinearGradient(s.x - trail, s.y - trail*0.3, s.x, s.y);
    grad.addColorStop(0, `rgba(255,255,255,0)`);
    grad.addColorStop(0.5, `rgba(0,229,255,${alpha*0.5})`);
    grad.addColorStop(1, `rgba(255,0,224,${alpha})`);
    sctx.strokeStyle = grad; sctx.lineWidth = 2*SDPR; sctx.lineCap = 'round';
    sctx.beginPath(); sctx.moveTo(s.x - trail, s.y - trail*0.3); sctx.lineTo(s.x, s.y); sctx.stroke();
    if(s.age > s.life || s.x > SW+100 || s.y > SH+100){ SHOOTERS.splice(i,1); }
  }
  sctx.globalCompositeOperation = 'source-over';

  requestAnimationFrame(drawStars);
}

addEventListener('resize', resizeStars, {passive:true});
resizeStars();
requestAnimationFrame(drawStars);

// ===== Haz de luz que sigue el mouse (rastro corto, mezcla aditiva) =====
const beamCanvas = document.getElementById('beam');
const ctx = beamCanvas.getContext('2d');
let w, h, dpr;

function resizeBeam(){
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = beamCanvas.width = Math.floor(innerWidth * dpr);
  h = beamCanvas.height = Math.floor(innerHeight * dpr);
  beamCanvas.style.width = innerWidth + 'px';
  beamCanvas.style.height = innerHeight + 'px';
}
addEventListener('resize', resizeBeam, {passive:true});
resizeBeam();

const points = []; // historial de posiciones
const MAX_POINTS = 22; // rastro no muy largo
const EASE = 0.25; // suaviza el seguimiento

let target = { x: w/2, y: h/2 };
let head = { x: w/2, y: h/2 };

addEventListener('mousemove', (e)=>{
  target.x = e.clientX * dpr;
  target.y = e.clientY * dpr;
}, {passive:true});

addEventListener('touchmove', (e)=>{
  const t = e.touches[0];
  if(!t) return;
  target.x = t.clientX * dpr;
  target.y = t.clientY * dpr;
}, {passive:true});

function step(){
  head.x += (target.x - head.x) * EASE;
  head.y += (target.y - head.y) * EASE;

  points.unshift({x: head.x, y: head.y});
  if(points.length > MAX_POINTS) points.pop();

  ctx.clearRect(0,0,w,h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; // mezcla aditiva

  for(let i=0; i<points.length-1; i++){
    const p = points[i], q = points[i+1];
    const t = i / (points.length-1); // 0..1
    const width = (1 - t) * 10 + 1;
    const alpha = (1 - t) * 0.35; // Reducido para menor intensidad del rastro

    // Alterna entre blanco y cian
    const choice = (i % 2);
    const [r,g,b] = choice === 0 ? [0, 229, 255] : [255, 255, 255];

    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }

  // cabeza luminosa
  const headGlow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 24);
  headGlow.addColorStop(0, 'rgba(255,255,255,0.7)'); // Blanco
  headGlow.addColorStop(0.6, 'rgba(0,229,255,0.4)'); // Cian
  headGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = headGlow;
  ctx.beginPath(); ctx.arc(head.x, head.y, 24, 0, Math.PI*2); ctx.fill();

  ctx.restore();
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// ===== Carrusel de texto con zoom =====
const zoomingTextElement = document.getElementById('zooming-text');
const texts = [
  "Especializados en Gaming",
  "Envíos a TODO Chile",
  "Entregamos Factura",
  "Equipos con Garantía",
  "¡Cotiza con nosotros!"
];
let textIndex = 0;

function updateZoomingText() {
  zoomingTextElement.textContent = texts[textIndex];
  zoomingTextElement.classList.remove('animate');
  void zoomingTextElement.offsetWidth; // Truco para forzar el reinicio de la animación
  zoomingTextElement.classList.add('animate');
  textIndex = (textIndex + 1) % texts.length;
}

updateZoomingText(); // Iniciar inmediatamente
setInterval(updateZoomingText, 4000); // Cambiar texto cada 4 segundos

// Lógica para el menú de hamburguesa
document.addEventListener('DOMContentLoaded', () => {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navMenu = document.getElementById('main-nav');

  if (hamburgerBtn && navMenu) {
    hamburgerBtn.addEventListener('click', () => {
      hamburgerBtn.classList.toggle('is-active');
      navMenu.classList.toggle('is-active');
    });

    // Cierra el menú al hacer clic en un enlace (para navegación en la misma página)
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (navMenu.classList.contains('is-active')) {
          hamburgerBtn.classList.remove('is-active');
          navMenu.classList.remove('is-active');
        }
      });
    });
  }
});
