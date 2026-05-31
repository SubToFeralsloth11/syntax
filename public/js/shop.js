function showLootTable() {
  fetch('/shop/mystery-box/items', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      const grid = document.getElementById('lootGrid');
      grid.innerHTML = '';
      data.items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'loot-item';
        el.innerHTML = `<span class="loot-name">${item.name}</span>`;
        grid.appendChild(el);
      });
      document.getElementById('lootTableModal').classList.remove('hidden');
    })
    .catch(() => showNotification('Failed to load items', 'error'));
}

function hideLootTable() {
  document.getElementById('lootTableModal').classList.add('hidden');
}

function buyMysteryBox() {
  fetch('/shop/mystery-box/buy', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showNotification('Mystery box purchased! Open it now!', 'success');
        updateCoins(data.balance);
        openGiftBoxAnimation();
      } else {
        showNotification(data.message, 'error');
      }
    })
    .catch(() => showNotification('Something went wrong', 'error'));
}

function openGiftBoxAnimation() {
  const overlay = document.getElementById('openBoxOverlay');
  overlay.classList.remove('hidden');

  const anim = document.getElementById('giftBoxAnim');
  const lid = document.getElementById('giftBoxLid');
  const glow = document.getElementById('giftBoxGlow');
  const result = document.getElementById('giftResult');
  const canvas = document.getElementById('confettiCanvas');
  const bottom = document.getElementById('giftBoxBottom');

  result.classList.add('hidden');
  canvas.classList.add('hidden');
  anim.classList.remove('open');
  lid.style.transform = '';
  bottom.style.transform = '';

  anim.classList.add('shake');

  setTimeout(() => {
    anim.classList.remove('shake');
    anim.classList.add('glow-pulse');
  }, 800);

  setTimeout(() => {
    anim.classList.remove('glow-pulse');
    lid.style.transform = 'translateY(-120px) rotateX(-20deg) scale(1.1)';
    lid.style.opacity = '0';
    lid.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';

    setTimeout(() => {
      bottom.style.transform = 'scale(1.05)';
      bottom.style.transition = 'transform 0.3s';

      canvas.classList.remove('hidden');
      startConfetti(canvas);

      fetch('/shop/mystery-box/open', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const title = document.getElementById('giftResultTitle');
            const desc = document.getElementById('giftResultDesc');

            if (data.type === 'coins' && data.coins > 0) {
              title.textContent = `${data.coins} coins!`;
              desc.textContent = `"${data.item}"`;
            } else if (data.type === 'junk') {
              title.textContent = data.item;
              desc.textContent = 'Better luck next time!';
            } else {
              title.textContent = data.item;
              desc.textContent = 'Added to your inventory!';
            }
            updateCoins(data.balance);
            result.classList.remove('hidden');
          }
        })
        .catch(() => {
          showNotification('Something went wrong', 'error');
        });
    }, 700);
  }, 2000);
}

function closeGiftBox() {
  const overlay = document.getElementById('openBoxOverlay');
  overlay.classList.add('hidden');
  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateCoins(balance) {
  const el = document.querySelector('.coins-display');
  if (el) el.textContent = `${balance} coins`;
}

function buyShopItem(itemId) {
  fetch(`/shop/buy/${itemId}`, { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showNotification(`Purchased ${data.name}!`, 'success');
        updateCoins(data.balance);
        location.reload();
      } else {
        showNotification(data.message, 'error');
      }
    })
    .catch(() => showNotification('Something went wrong', 'error'));
}

function copyRefLink() {
  const input = document.getElementById('refLink');
  if (input) {
    input.select();
    document.execCommand('copy');
    showNotification('Link copied!', 'success');
  }
}
