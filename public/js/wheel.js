const segments = window.WHEEL_SEGMENTS || [];

const segmentColors = (() => {
  const n = segments.length;
  if (n === 0) return [];
  const colors = [];
  const c1 = [0, 240, 255];
  const c2 = [181, 55, 242];
  const c3 = [255, 43, 214];
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    let r, g, b;
    if (t < 0.5) {
      const tt = t * 2;
      r = Math.round(c1[0] + (c2[0] - c1[0]) * tt);
      g = Math.round(c1[1] + (c2[1] - c1[1]) * tt);
      b = Math.round(c1[2] + (c2[2] - c1[2]) * tt);
    } else {
      const tt = (t - 0.5) * 2;
      r = Math.round(c2[0] + (c3[0] - c2[0]) * tt);
      g = Math.round(c2[1] + (c3[1] - c2[1]) * tt);
      b = Math.round(c2[2] + (c3[2] - c2[2]) * tt);
    }
    colors.push(`rgb(${r},${g},${b})`);
  }
  return colors;
})();

const tierColors = {
  low: '#4fa8ff',
  mid: '#44dd88',
  high: '#ffae00',
  epic: '#ff2bd6',
};

const tierLabels = {
  low: 'Low',
  mid: 'Mid',
  high: 'High',
  epic: 'Jackpot'
};

let currentAngle = 0;
let isSpinning = false;
let winnerIndex = -1;
let currentResult = null;
let offscreenCanvas = null;

function initCanvas() {
  const canvas = document.getElementById('wheelCanvas');
  if (!canvas) return null;
  const dpr = window.devicePixelRatio || 1;
  const W = 520;
  const H = 520;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas, ctx, W, H };
}

function buildOffscreen(W, H) {
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const ctx = off.getContext('2d');
  const cx = W / 2;
  const cy = H / 2 - 10;
  const r = 230;

  const arc = (2 * Math.PI) / segments.length;
  const n = segments.length;

  segments.forEach((seg, i) => {
    const startAngle = i * arc - Math.PI / 2;
    const endAngle = startAngle + arc;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = segmentColors[i];
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const mid = startAngle + arc / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(mid);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    const label = seg.label || String(seg.value || 0);
    const fontSize = n > 50 ? 9 : n > 20 ? 13 : 18;
    ctx.font = 'bold ' + fontSize + 'px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 2;
    ctx.fillText(label, r * 0.72, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, 2 * Math.PI);
  const hub = ctx.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, 16);
  hub.addColorStop(0, '#fff');
  hub.addColorStop(0.5, '#ddd');
  hub.addColorStop(1, '#999');
  ctx.fillStyle = hub;
  ctx.fill();
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2;
  ctx.stroke();

  return off;
}

let pointerBounce = 0;
let lastSegmentIndex = -1;

function drawWheel(angle) {
  const info = initCanvas();
  if (!info) return;
  const { ctx, W, H } = info;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2 - 10);
  ctx.rotate(angle);
  ctx.drawImage(offscreenCanvas, -(W / 2), -(H / 2 - 10));
  ctx.restore();

  drawPointer(ctx, W, H);
}

function drawPointer(ctx, W, H) {
  const cx = W / 2;
  const cy = H / 2 - 10;
  const r = 230;
  const tipY = cy - r + 2;
  const bounceOff = pointerBounce;

  ctx.save();
  ctx.shadowColor = 'rgba(255,30,30,0.6)';
  ctx.shadowBlur = 12 + bounceOff * 2;

  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.lineTo(cx - 14, tipY - 40 - bounceOff);
  ctx.lineTo(cx - 22, tipY - 46 - bounceOff);
  ctx.lineTo(cx - 22, tipY - 56 - bounceOff);
  ctx.lineTo(cx + 22, tipY - 56 - bounceOff);
  ctx.lineTo(cx + 22, tipY - 46 - bounceOff);
  ctx.lineTo(cx + 14, tipY - 40 - bounceOff);
  ctx.closePath();

  const grad = ctx.createLinearGradient(cx, tipY, cx, tipY - 56 - bounceOff);
  grad.addColorStop(0, '#ff0000');
  grad.addColorStop(0.3, '#ff3333');
  grad.addColorStop(0.7, '#cc0000');
  grad.addColorStop(1, '#880000');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, tipY + 3);
  ctx.lineTo(cx - 8, tipY - 8);
  ctx.lineTo(cx + 8, tipY - 8);
  ctx.closePath();
  ctx.fillStyle = '#ff6666';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, tipY - 56 - bounceOff, 5, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();
}

function spinWheel() {
  if (isSpinning) return;

  const btn = document.getElementById('spinBtn');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader-circle"></i> Spinning...';
  if (window.lucide) lucide.createIcons();
  const hint = document.getElementById('wheelHint');
  if (hint) hint.textContent = '';

  isSpinning = true;

  fetch('/wheel/spin', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        winnerIndex = data.index;
        currentResult = data;
        animateSpin();
      } else {
        showNotification(data.message, false);
        btn.innerHTML = '<i data-lucide="disc-3"></i> SPIN (' + (window.SPIN_COST || 5) + ' coins)';
        if (window.lucide) lucide.createIcons();
        btn.disabled = false;
        isSpinning = false;
      }
    })
    .catch(() => {
      showNotification('Something went wrong', false);
      btn.innerHTML = '<i data-lucide="disc-3"></i> SPIN (' + (window.SPIN_COST || 5) + ' coins)';
      if (window.lucide) lucide.createIcons();
      btn.disabled = false;
      isSpinning = false;
    });
}

function animateSpin() {
  const arc = (2 * Math.PI) / segments.length;
  const targetSegAngle = winnerIndex * arc;
  const targetPointerAngle = -targetSegAngle - arc / 2;

  const fullSpins = 5 + Math.floor(Math.random() * 3);
  const targetAngle = currentAngle + fullSpins * 2 * Math.PI + targetPointerAngle - (currentAngle % (2 * Math.PI));

  const startAngle = currentAngle;
  const duration = 5000;
  const startTime = performance.now();
  lastSegmentIndex = -1;
  pointerBounce = 0;

  function animate(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    currentAngle = startAngle + (targetAngle - startAngle) * eased;

    const normalizedAngle = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const currentSegIndex = Math.floor(normalizedAngle / arc) % segments.length;

    if (currentSegIndex !== lastSegmentIndex && lastSegmentIndex !== -1) {
      pointerBounce = 8;
    }
    lastSegmentIndex = currentSegIndex;

    pointerBounce *= 0.85;
    if (pointerBounce < 0.3) pointerBounce = 0;

    drawWheel(currentAngle);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      currentAngle = targetAngle;
      pointerBounce = 0;
      drawWheel(currentAngle);
      showResult();
    }
  }

  requestAnimationFrame(animate);
}

function showResult() {
  const overlay = document.getElementById('wheelResultOverlay');
  const amountEl = document.getElementById('resultAmount');
  const labelEl = document.getElementById('resultLabel');
  const subEl = document.getElementById('resultSub');
  const card = overlay.querySelector('.result-card');

  card.className = 'result-card';

  const data = currentResult;
  const tier = data.tier || 'low';
  const change = data.change || 0;
  const desc = data.desc || '';

  const labelMap = { low: 'Not bad!', mid: 'Nice!', high: 'Awesome!', epic: 'JACKPOT!' };
  const colorMap = tierColors;

  if (data.freeSpin) {
    labelEl.textContent = 'FREE SPIN!';
    subEl.textContent = 'No cost!';
    amountEl.textContent = '🎰';
  } else if (data.type === 'mystery_box' && change === 0) {
    labelEl.textContent = 'MYSTERY BOX!';
    subEl.textContent = desc;
    amountEl.textContent = '🎁';
  } else if (change > 0) {
    labelEl.textContent = labelMap[tier] || 'You won';
    subEl.textContent = desc || 'coins!';
    amountEl.textContent = '+' + change;
  } else if (change < 0) {
    labelEl.textContent = 'Oh no!';
    subEl.textContent = desc || 'Lost coins!';
    amountEl.textContent = String(change);
  } else {
    labelEl.textContent = 'Nothing!';
    subEl.textContent = desc || 'Better luck next time';
    amountEl.textContent = '0';
  }

  card.style.setProperty('--result-color', colorMap[tier]);
  card.classList.add('tier-' + tier);

  if (document.getElementById('wheelBalance')) {
    document.getElementById('wheelBalance').textContent = data.balance;
  }
  updateCoins(data.balance);

  const hint = document.getElementById('wheelHint');
  if (hint) {
    if (data.freeSpin) {
      hint.textContent = 'Free spin! Spin again for free.';
    } else if (change > 0) {
      hint.textContent = '+' + change + ' coins! ' + desc;
    } else if (change < 0) {
      hint.textContent = change + ' coins... ' + desc;
    } else {
      hint.textContent = desc || 'Nothing happened.';
    }
  }

  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    card.classList.add('pop');
  });

  launchConfetti(tier);
}

function closeResult() {
  const overlay = document.getElementById('wheelResultOverlay');
  overlay.classList.remove('visible');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);

  const btn = document.getElementById('spinBtn');
  if (currentResult && currentResult.freeSpin) {
    btn.innerHTML = '<i data-lucide="disc-3"></i> SPIN (FREE)';
  } else {
    btn.innerHTML = '<i data-lucide="disc-3"></i> SPIN (' + (window.SPIN_COST || 5) + ' coins)';
  }
  if (window.lucide) lucide.createIcons();
  btn.disabled = false;
  isSpinning = false;
  currentResult = null;
}

function launchConfetti(tier) {
  const canvas = document.getElementById('confettiCanvas');
  const overlay = document.getElementById('wheelResultOverlay');
  canvas.width = overlay.offsetWidth;
  canvas.height = overlay.offsetHeight;
  const ctx = canvas.getContext('2d');

  const count = tier === 'epic' ? 120 : tier === 'high' ? 80 : 50;
  const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4', '#f368e0'];
  const particles = [];

  for (let i = 0; i < count; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 14 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      gravity: 0.25 + Math.random() * 0.15,
      life: 1
    });
  }

  let frame = 0;
  function anim() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.vx *= 0.98;
      p.rotation += p.rotSpeed;
      p.life -= 0.006;
      if (p.life > 0) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    });
    frame++;
    if (alive && frame < 300) requestAnimationFrame(anim);
  }
  anim();
}

function updateCoins(balance) {
  const el = document.querySelector('.coins-display');
  if (el) {
    el.innerHTML = '<i data-lucide="circle-dollar-sign"></i>' + balance;
    if (window.lucide) lucide.createIcons();
    el.classList.remove('coin-flash');
    void el.offsetWidth;
    el.classList.add('coin-flash');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (segments.length === 0) return;
  const info = initCanvas();
  if (info) {
    offscreenCanvas = buildOffscreen(info.W, info.H);
    drawWheel(0);
  }
});