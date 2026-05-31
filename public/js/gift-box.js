let confettiPieces = [];
let confettiAnimId = null;

function startConfetti(canvas) {
  canvas.width = canvas.offsetWidth || window.innerWidth;
  canvas.height = canvas.offsetHeight || window.innerHeight;

  confettiPieces = [];
  const colors = ['#7c5cfc', '#ffcc44', '#44dd88', '#44aaff', '#ff5566', '#ff8844', '#cc44ff', '#fff'];

  for (let i = 0; i < 150; i++) {
    confettiPieces.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height / 2 - 50 + (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 10 - 4,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      gravity: 0.25 + Math.random() * 0.15
    });
  }

  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  animateConfetti(canvas);
}

function animateConfetti(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let active = false;

  for (const p of confettiPieces) {
    if (p.y > canvas.height + 50 || p.y < -100) continue;
    active = true;

    p.x += p.vx;
    p.vy += p.gravity;
    p.y += p.vy;
    p.vx *= 0.99;
    p.rotation += p.rotSpeed;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }

  if (active) {
    confettiAnimId = requestAnimationFrame(() => animateConfetti(canvas));
  }
}
