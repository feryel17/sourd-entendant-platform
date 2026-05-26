// Parse Session ID from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

if (!sessionId) {
  alert('Aucune session spécifiée. Retour à l\'accueil.');
  window.location.href = '/';
}

let socket;
const btnJoin = document.getElementById('btn-join');
const onboardingSection = document.getElementById('hearing-onboarding');
const commHubSection = document.getElementById('comm-hub');
const chatBox = document.getElementById('chat-box');

// Join Session on Click
btnJoin.onclick = () => {
  // Show communication panel
  onboardingSection.style.display = 'none';
  commHubSection.style.display = 'flex';
  
  // Establish connection
  socket = io();
  
  socket.emit('join-room', { sessionId, role: 'hearing' });
  
  // Listen for socket events
  socket.on('chat-message', (msg) => {
    appendMessage(msg);
  });
  
  socket.on('system-message', (data) => {
    appendSystemMessage(data.text);
  });

  // Initialize Speech-to-Text
  initSpeechRecognition();
};

function appendMessage(msg) {
  const isDeaf = msg.sender === 'deaf_user';
  
  const msgEl = document.createElement('div');
  msgEl.className = `message ${isDeaf ? 'message-deaf' : 'message-hearing'}`;
  
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  msgEl.innerHTML = `
    <div class="sender-info">
      ${isDeaf ? '🤟 Lunettes (A)' : '🗣 Voix (Moi)'}
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

/* ==========================================
   WEB SPEECH API & FALLBACK HANDLING
   ========================================== */
let recognition;
let isListening = false;
let lastSentResultIndex = -1;
let lastSentText = '';
let lastSentTime = 0;
let speechTimeout = null;

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn("Speech Recognition not supported in this browser.");
    setupTextFallback("La reconnaissance vocale n'est pas supportée sur ce navigateur. Saisie manuelle activée.");
    return;
  }
  
  recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.continuous = true;
  recognition.interimResults = true;
  
  const btnMic = document.getElementById('btn-mic');
  const micHint = document.getElementById('mic-hint');
  const liveTranscript = document.getElementById('live-transcript');
  
  btnMic.onclick = () => {
    if (!isListening) {
      isListening = true;
      try {
        recognition.start();
      } catch (err) {
        console.error(err);
      }
    } else {
      isListening = false;
      recognition.stop();
    }
  };
  
  recognition.onstart = () => {
    lastSentResultIndex = -1; // Reset result index on start
    btnMic.classList.add('listening');
    micHint.innerHTML = "<strong>À l'écoute...</strong> Parlez maintenant.";
    micHint.style.color = "var(--accent-rose)";
    liveTranscript.innerText = "Écoute en cours...";
  };
  
  recognition.onend = () => {
    // If the browser stopped speech recognition due to silence but the user didn't manually stop it
    if (isListening) {
      try {
        recognition.start();
      } catch (err) {
        console.error("Auto-restart failed:", err);
      }
    } else {
      btnMic.classList.remove('listening');
      micHint.innerHTML = "Appuyez sur le micro pour commencer à parler";
      micHint.style.color = "var(--text-muted)";
    }
  };
  
  recognition.onresult = (event) => {
    let interimTranscript = '';
    let latestFinalTranscript = '';
    
    for (let i = 0; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        latestFinalTranscript = transcript;
      } else {
        interimTranscript = transcript;
      }
    }
    
    // Display live interim speech results
    if (interimTranscript) {
      liveTranscript.innerText = `[En cours] : ${interimTranscript}`;
    } else if (latestFinalTranscript) {
      liveTranscript.innerText = latestFinalTranscript;
    }
    
    // Debounce the sending of the final transcript by 800ms of silence
    const textToSend = latestFinalTranscript.trim();
    if (textToSend) {
      if (speechTimeout) clearTimeout(speechTimeout);
      
      speechTimeout = setTimeout(() => {
        if (textToSend.toLowerCase() !== lastSentText.toLowerCase()) {
          socket.emit('speech-message', { text: textToSend });
          lastSentText = textToSend;
        }
      }, 800);
    }
  };
  
  recognition.onerror = (event) => {
    console.error("Speech Recognition Error", event.error);
    if (event.error === 'not-allowed') {
      isListening = false;
      setupTextFallback("Accès micro refusé. Mode clavier activé.");
    }
  };
}

// Fallback method when voice is blocked or not available
function setupTextFallback(reasonMessage) {
  const micSection = document.querySelector('.mic-section');
  if (!micSection) return;
  
  // Replace mic UI with a beautiful keyboard typing fallback
  micSection.innerHTML = `
    <p style="font-size: 0.85rem; color: var(--accent-rose); text-align: center; margin-bottom: 0.5rem;">
      ⚠️ ${reasonMessage}
    </p>
    <div class="gesture-input-group" style="width: 100%;">
      <input type="text" id="keyboard-input" placeholder="Écrivez votre message à A ici..." style="flex-grow: 1;">
      <button id="btn-send-keyboard" class="btn-primary" style="padding: 0.6rem 1.2rem; width: auto; background: var(--accent-violet); border-radius: 10px;">
        Envoyer
      </button>
    </div>
  `;
  
  const keyboardInput = document.getElementById('keyboard-input');
  const btnSend = document.getElementById('btn-send-keyboard');
  
  const sendMessage = () => {
    const text = keyboardInput.value.trim();
    if (text) {
      socket.emit('speech-message', { text });
      keyboardInput.value = '';
    }
  };
  
  btnSend.onclick = sendMessage;
  keyboardInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };
}
