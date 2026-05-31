let lastMessageId = 0;
let mentionTimeout = null;
let mentionIndex = -1;

document.addEventListener('DOMContentLoaded', () => {
  const msgEls = document.querySelectorAll('.chat-msg');
  msgEls.forEach(el => {
    const id = parseInt(el.dataset.id);
    if (id > lastMessageId) lastMessageId = id;
    const textEl = el.querySelector('.chat-text');
    if (textEl) textEl.innerHTML = linkify(textEl.textContent);
  });

  if (!msgEls.length) {
    lastMessageId = 0;
  }

  scrollToBottom();

  setInterval(pollMessages, 2000);

  const form = document.getElementById('chatForm');
  form.addEventListener('submit', sendMessage);

  const input = document.getElementById('chatInput');
  input.addEventListener('input', onInputChange);
  input.addEventListener('keydown', onInputKeydown);
  document.addEventListener('click', () => {
    document.getElementById('chatMentions').style.display = 'none';
  });
});

function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  container.scrollTop = container.scrollHeight;
}

function linkify(text) {
  return text.replace(/@(\w+)/g, '<span class="chat-mention">@$1</span>');
}

function pollMessages() {
  fetch('/chat/messages?after=' + lastMessageId)
    .then(res => res.json())
    .then(data => {
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(m => {
          appendMessage(m);
          if (m.id > lastMessageId) lastMessageId = m.id;
        });
        scrollToBottom();
      }
    })
    .catch(() => {});
}

function appendMessage(m) {
  const container = document.getElementById('chatMessages');
  const empty = container.querySelector('.chat-empty');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.dataset.id = m.id;
  div.innerHTML =
    '<span class="chat-user" data-userid="' + m.user_id + '">' + escapeHtml(m.display_name) + '</span>' +
    ' <span class="chat-time">' + formatTime(m.created_at) + '</span>' +
    '<div class="chat-text">' + linkify(escapeHtml(m.message)) + '</div>';
  container.appendChild(div);
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;

  input.disabled = true;

  fetch('/chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'message=' + encodeURIComponent(msg)
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        input.value = '';
        appendMessage(data.message);
        if (data.message.id > lastMessageId) lastMessageId = data.message.id;
        scrollToBottom();
      } else {
        showNotification(data.message, 'error');
      }
      input.disabled = false;
      input.focus();
    })
    .catch(() => {
      showNotification('Failed to send', 'error');
      input.disabled = false;
    });
}

function onInputChange() {
  const input = document.getElementById('chatInput');
  const val = input.value;
  const cursorPos = input.selectionStart;
  const before = val.substring(0, cursorPos);
  const atMatch = before.lastIndexOf('@');

  if (atMatch !== -1 && (atMatch === 0 || before[atMatch - 1] === ' ')) {
    const query = before.substring(atMatch + 1);
    if (query.indexOf(' ') === -1) {
      clearTimeout(mentionTimeout);
      mentionTimeout = setTimeout(() => fetchMentions(query), 150);
      return;
    }
  }

  document.getElementById('chatMentions').style.display = 'none';
}

function onInputKeydown(e) {
  const mentions = document.getElementById('chatMentions');
  if (mentions.style.display !== 'none') {
    const items = mentions.querySelectorAll('.mention-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mentionIndex = Math.min(mentionIndex + 1, items.length - 1);
      highlightMention(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      mentionIndex = Math.max(mentionIndex - 1, 0);
      highlightMention(items);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const selected = mentions.querySelector('.mention-item.selected');
      if (selected) {
        e.preventDefault();
        selectMention(selected.dataset.name);
      }
    } else if (e.key === 'Escape') {
      mentions.style.display = 'none';
    }
  }
}

function highlightMention(items) {
  items.forEach((el, i) => {
    el.classList.toggle('selected', i === mentionIndex);
  });
}

function fetchMentions(query) {
  if (!query) {
    document.getElementById('chatMentions').style.display = 'none';
    return;
  }

  fetch('/chat/users?q=' + encodeURIComponent(query))
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById('chatMentions');
      container.innerHTML = '';
      mentionIndex = -1;

      if (!data.users || data.users.length === 0) {
        container.style.display = 'none';
        return;
      }

      data.users.forEach(u => {
        const item = document.createElement('div');
        item.className = 'mention-item';
        item.dataset.name = u.display_name;
        item.textContent = u.display_name;
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectMention(u.display_name);
        });
        container.appendChild(item);
      });

      container.style.display = 'block';
    })
    .catch(() => {});
}

function selectMention(name) {
  const input = document.getElementById('chatInput');
  const val = input.value;
  const cursorPos = input.selectionStart;
  const before = val.substring(0, cursorPos);
  const after = val.substring(cursorPos);
  const atPos = before.lastIndexOf('@');
  const newVal = before.substring(0, atPos) + '@' + name + ' ' + after;
  input.value = newVal;
  input.focus();
  input.selectionStart = input.selectionEnd = atPos + name.length + 2;
  document.getElementById('chatMentions').style.display = 'none';
}