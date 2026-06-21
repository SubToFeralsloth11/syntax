function dailyCheckin() {
  fetch('/checkin', { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const btn = document.getElementById('checkin-btn');
        btn.textContent = 'Checked In ✓';
        btn.disabled = true;
        const streakEl = document.querySelector('.streak-info');
        if (streakEl) {
          streakEl.textContent = `Current streak: ${data.streak} days`;
        }
        showNotification(`+${data.coins} coins from check-in!`, 'success');
      } else {
        showNotification(data.message, 'error');
      }
    })
    .catch(err => {
      showNotification('Something went wrong', 'error');
    });
}

function showNotification(message, type = 'success') {
  const variant = (type === false || type === 'error' || type === 'fail' || type === 'danger') ? 'error'
    : (type === 'info') ? 'info' : 'success';
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const icon = variant === 'success' ? 'check-circle'
    : variant === 'error' ? 'alert-circle'
    : 'info';
  const el = document.createElement('div');
  el.className = `notification notification-${variant}`;
  el.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
  document.body.appendChild(el);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => el.classList.add('show'));

  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

function playGame(gameId) {
  fetch(`/games/${gameId}/play`, { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showNotification(`+${data.coins} coins for playing!`, 'success');
        setTimeout(() => location.reload(), 1500);
      } else {
        showNotification(data.message, 'error');
      }
    })
    .catch(() => showNotification('Something went wrong', 'error'));
}

function equipItem(itemId) {
  fetch('/profile/equip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showNotification('Item equipped!', 'success');
        location.reload();
      } else {
        showNotification(data.message, 'error');
      }
    })
    .catch(() => showNotification('Something went wrong', 'error'));
}

function unequipItem(itemType) {
  fetch('/profile/unequip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemType })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showNotification('Item unequipped!', 'success');
        location.reload();
      } else {
        showNotification(data.message, 'error');
      }
    })
    .catch(() => showNotification('Something went wrong', 'error'));
}

function submitTriviaAnswer(answer) {
  fetch('/trivia/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const buttons = document.querySelectorAll('.trivia-btn');
        buttons.forEach(b => b.disabled = true);
        if (data.correct) {
          showNotification('+15 coins for correct answer!', 'success');
        } else {
          showNotification(`Wrong! The answer was: ${data.correctAnswer}`, 'error');
        }
        setTimeout(() => location.reload(), 2500);
      } else {
        showNotification(data.message, 'error');
      }
    })
    .catch(() => showNotification('Something went wrong', 'error'));
}
