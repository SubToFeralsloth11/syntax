document.addEventListener('DOMContentLoaded', () => {
  setupQuickBtns();
  setupEarningsPreview();
  setupInvestButtons();
  setupClaimButtons();
  startCountdowns();
});

function setupQuickBtns() {
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = btn.dataset.plan;
      const frac = parseFloat(btn.dataset.frac);
      const bal = parseInt(document.getElementById('bankBalance')?.textContent) || 0;
      const amt = Math.floor(bal * frac);
      const input = document.querySelector('.plan-input[data-plan="' + plan + '"]');
      if (input) {
        input.value = Math.max(10, amt);
        input.dispatchEvent(new Event('input'));
      }
    });
  });
}

function setupEarningsPreview() {
  document.querySelectorAll('.plan-input').forEach(input => {
    input.addEventListener('input', () => {
      const amount = parseInt(input.value) || 0;
      const pct = parseFloat(input.dataset.pct);
      const profit = Math.floor(amount * pct);
      const total = amount + profit;
      const lockMs = parseInt(input.dataset.lock);

      const preview = document.getElementById('preview-' + input.dataset.plan);
      if (!preview) return;

      const profitEl = preview.querySelector('.preview-profit strong');
      const returnEl = preview.querySelector('.preview-return strong');
      const timeEl = preview.querySelector('.preview-time strong');

      if (profitEl) profitEl.textContent = '+' + profit;
      if (returnEl) returnEl.textContent = total;
      if (timeEl) {
        timeEl.textContent = formatDuration(lockMs);
      }
    });
  });
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + 'm';
  return s + 's';
}

function setupInvestButtons() {
  document.querySelectorAll('.invest-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = btn.dataset.plan;
      const input = document.querySelector('.plan-input[data-plan="' + plan + '"]');
      const amount = parseInt(input.value);
      if (!amount || amount < 10) {
        showNotification('Minimum investment is 10 coins.', false);
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-circle"></i> Investing...';
      if (window.lucide) lucide.createIcons();

      fetch('/bank/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, amount })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showNotification('Invested ' + amount + ' coins!', true);
            updateBalance(data.balance);
            input.value = '';
            const preview = document.getElementById('preview-' + plan);
            if (preview) {
              const pEl = preview.querySelector('.preview-profit strong');
              const rEl = preview.querySelector('.preview-return strong');
              if (pEl) pEl.textContent = '+0';
              if (rEl) rEl.textContent = '0';
            }
            addInvestmentItem(data.investment);
          } else {
            showNotification(data.message, false);
          }
          btn.disabled = false;
          btn.innerHTML = '<i data-lucide="lock"></i> Invest';
          if (window.lucide) lucide.createIcons();
        })
        .catch(() => {
          showNotification('Something went wrong.', false);
          btn.disabled = false;
          btn.innerHTML = '<i data-lucide="lock"></i> Invest';
          if (window.lucide) lucide.createIcons();
        });
    });
  });
}

function setupClaimButtons() {
  document.querySelectorAll('.claim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-circle"></i> Claiming...';
      if (window.lucide) lucide.createIcons();

      fetch('/bank/claim/' + id, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showNotification('+' + data.total + ' coins claimed!', true);
            updateBalance(data.balance);
            const item = document.querySelector('.investment-item[data-id="' + id + '"]');
            if (item) item.remove();
            const list = document.getElementById('investmentsList');
            if (list && !list.querySelector('.investment-item')) {
              list.innerHTML = '<div class="empty-state">// no active investments //</div>';
            }
          } else {
            showNotification(data.message, false);
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="unlock"></i> Claim';
            if (window.lucide) lucide.createIcons();
          }
        })
        .catch(() => {
          showNotification('Something went wrong.', false);
          btn.disabled = false;
          btn.innerHTML = '<i data-lucide="unlock"></i> Claim';
          if (window.lucide) lucide.createIcons();
        });
    });
  });
}

function startCountdowns() {
  setInterval(() => {
    document.querySelectorAll('.investment-item').forEach(item => {
      const started = parseInt(item.dataset.started);
      const lockMs = parseInt(item.dataset.lock);
      const elapsed = Date.now() - started;
      const remaining = Math.max(0, lockMs - elapsed);
      const progress = Math.min(100, (elapsed / lockMs) * 100);

      const fill = item.querySelector('.inv-progress-fill');
      if (fill) fill.style.width = progress + '%';

      const cd = item.querySelector('.inv-countdown');
      const btn = item.querySelector('.claim-btn');
      if (cd) {
        if (remaining <= 0) {
          cd.textContent = 'Ready to claim!';
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="unlock"></i> Claim';
            if (window.lucide) lucide.createIcons();
          }
        } else {
          cd.textContent = formatRemaining(remaining);
        }
      }
    });
  }, 1000);
}

function formatRemaining(ms) {
  if (ms <= 0) return 'Ready!';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
  if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
  if (m > 0) return m + 'm ' + sec + 's';
  return sec + 's';
}

function addInvestmentItem(inv) {
  let list = document.getElementById('investmentsList');
  if (!list) {
    const section = document.querySelector('.bank-active-section .container');
    const empty = section.querySelector('.empty-state');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = 'investments-list';
    div.id = 'investmentsList';
    section.appendChild(div);
    list = div;
  } else {
    const empty = list.querySelector('.empty-state');
    if (empty) empty.remove();
  }

  const el = document.createElement('div');
  el.className = 'investment-item';
  el.dataset.id = inv.id;
  el.dataset.started = String(new Date(inv.started_at).getTime());
  el.dataset.lock = String(inv.planData.lockMs);
  el.innerHTML =
    '<div class="inv-top">' +
      '<div><span class="inv-plan-badge" style="--plan-color:' + inv.planData.color + '">' + inv.planData.label + '</span>' +
      '<span class="inv-amount">' + inv.amount + ' coins</span></div>' +
      '<span class="inv-profit">+' + inv.profit + ' coins</span>' +
    '</div>' +
    '<div class="inv-progress-bar"><div class="inv-progress-fill" style="width:0%"></div></div>' +
      '<div class="inv-bottom">' +
        '<span class="inv-countdown" id="countdown-' + inv.id + '">' + formatRemaining(inv.remaining) + '</span>' +
        '<button class="btn btn-sm claim-btn" data-id="' + inv.id + '" disabled><i data-lucide="lock"></i> Locked</button>' +
      '</div>';
  list.prepend(el);
  if (window.lucide) lucide.createIcons();
}

function updateBalance(balance) {
  const el = document.getElementById('bankBalance');
  if (el) el.textContent = balance;
  const headerEl = document.querySelector('.coins-display');
  if (headerEl) {
    headerEl.innerHTML = '<i data-lucide="circle-dollar-sign"></i>' + balance;
    if (window.lucide) lucide.createIcons();
    headerEl.classList.remove('coin-flash');
    void headerEl.offsetWidth;
    headerEl.classList.add('coin-flash');
  }
}