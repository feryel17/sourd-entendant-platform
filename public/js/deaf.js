// Parse Session ID from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

if (!sessionId) {
  alert('Session non valide. Retour à la page d\'accueil.');
  window.location.href = '/';
}

document.getElementById('session-code').innerText = sessionId;

// Generate QR Code pointing to hearing.html with the session parameter
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

// Connect to Socket.IO Server
const socket = io();

// Join the WebSocket room
socket.emit('join-room', { sessionId, role: 'deaf' });

const chatBox = document.getElementById('chat-box');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

// Handle status and system messages
socket.on('system-message', (data) => {
  appendSystemMessage(data.text);
  
  // Update status UI
  statusIndicator.classList.add('active');
  statusText.innerText = 'Interlocuteur connecté';
  
  // Smoothly hide QR code when the hearing user joins to make room for full chat
  const qrContainer = document.getElementById('onboarding-qr');
  if (qrContainer) {
    qrContainer.style.transition = 'all 0.5s ease';
    qrContainer.style.opacity = '0.3';
  }
});

// Handle incoming chat messages
socket.on('chat-message', (msg) => {
  appendMessage(msg);
});

// Appending typical chat bubble
function appendMessage(msg) {
  const isDeaf = msg.sender === 'deaf_user';
  
  const msgEl = document.createElement('div');
  msgEl.className = `message ${isDeaf ? 'message-deaf' : 'message-hearing'}`;
  
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  msgEl.innerHTML = `
    <div class="sender-info">
      ${isDeaf ? '🤟 Lunettes (Moi)' : '🗣 Voix (B)'}
    </div>
    <div>${escapeHtml(msg.text)}</div>
    <span class="time">${time}</span>
  `;
  
  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendSystemMessage(text) {
  const msgEl = document.createElement('div');
  msgEl.className = 'message-system';
  msgEl.innerText = text;
  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Escaping inputs for security
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Bind Simulator Gestures
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

// Listen to ENTER key on custom input
document.getElementById('custom-gesture').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('btn-send-custom-gesture').click();
  }
});

function sendGesture(text) {
  socket.emit('gesture-message', { text });
}
