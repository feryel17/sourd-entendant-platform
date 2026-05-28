const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

if (!sessionId) {
  alert('Session non valide. Retour à la page d\'accueil.');
  window.location.href = '/';
}

document.getElementById('session-code').innerText = sessionId;

const host = window.location.origin;
const hearingUrl = `${host}/hearing.html?session=${sessionId}`;

new QRCode(document.getElementById("qrcode"), {
  text: hearingUrl,
  width: 180,
  height: 180,
  colorDark : "#0a0915",
  colorLight : "#ffffff",
  correctLevel : QRCode.CorrectLevel.H
});

const socket = io();
socket.emit('join-room', { sessionId, role: 'deaf' });

// Débloque l'audio au premier clic
if ('speechSynthesis' in window) {
  window.addEventListener('click', function unlockAudio() {
    const silence = new SpeechSynthesisUtterance(' ');
    silence.volume = 0;
    window.speechSynthesis.speak(silence);
    window.removeEventListener('click', unlockAudio);
  }, { once: true });
}

const chatBox = document.getElementById('chat-box');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

socket.on('system-message', (data) => {
  appendSystemMessage(data.text);
  statusIndicator.classList.add('active');
  statusText.innerText = 'Interlocuteur connecté';

  const qrContainer = document.getElementById('onboarding-qr');
  if (qrContainer) {
    qrContainer.style.transition = 'all 0.5s ease';
    qrContainer.style.opacity = '0.3';
  }
});

socket.on('chat-message', (msg) => {
  appendMessage(msg);
});

function appendMessage(msg) {
  const isDeaf = msg.sender === 'deaf_user';

  const msgEl = document.createElement('div');
  msgEl.className = `message ${isDeaf ? 'message-deaf' : 'message-hearing'}`;

  const time = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  });

  msgEl.innerHTML = `
    <div class="sender-info">
      ${isDeaf ? ' Lunettes (Moi)' : '🗣 Voix (B)'}
    </div>
    <div>${escapeHtml(msg.text)}</div>
    <span class="time">${time}</span>
  `;

  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Lit à voix haute les messages de l'entendant
  if (!isDeaf && msg.text) {
    parlerEnFrancais(msg.text);
  }
}

function parlerEnFrancais(texte) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(texte);
  utterance.lang   = 'fr-FR';
  utterance.rate   = 0.95;
  utterance.pitch  = 1.0;
  utterance.volume = 1.0;
  utterance.onerror = (e) => console.error('[TTS] Erreur :', e.error);

  function choisirVoixEtParler() {
    const voices = window.speechSynthesis.getVoices();
    const voixFR = voices.find(v => v.lang === 'fr-FR')
                || voices.find(v => v.lang.startsWith('fr'));
    if (voixFR) utterance.voice = voixFR;
    window.speechSynthesis.speak(utterance);
  }

  if (window.speechSynthesis.getVoices().length > 0) {
    choisirVoixEtParler();
  } else {
    window.speechSynthesis.onvoiceschanged = choisirVoixEtParler;
  }
}

function appendSystemMessage(text) {
  const msgEl = document.createElement('div');
  msgEl.className = 'message-system';
  msgEl.innerText = text;
  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

document.querySelectorAll('.btn-gesture').forEach(button => {
  button.onclick = () => {
    const text = button.getAttribute('data-text');
    sendGesture(text);
  };
});

document.getElementById('btn-send-custom-gesture').onclick = () => {
  const input = document.getElementById('custom-gesture');
  const text = input.value.trim();
  if (text) {
    sendGesture(text);
    input.value = '';
  }
};

document.getElementById('custom-gesture').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('btn-send-custom-gesture').click();
  }
});

function sendGesture(text) {
  socket.emit('gesture-message', { text });
}

// Efface la session quand l'utilisateur quitte la page
window.addEventListener('beforeunload', () => {
  fetch('/api/session/clear', { method: 'POST' });
});