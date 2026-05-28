const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Session active mémorisée
let activeSession = null;

// Crée une nouvelle session
app.post('/api/session/create', (req, res) => {
  const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
  activeSession = sessionId;
  console.log(`[Session] Nouvelle session créée : ${sessionId}`);
  res.json({ success: true, sessionId });
});

// Récupère la session active (utilisé par le Pi)
app.get('/api/session/active', (req, res) => {
  if (activeSession) {
    console.log(`[Session] Pi récupère la session active : ${activeSession}`);
    res.json({ success: true, sessionId: activeSession });
  } else {
    res.json({ success: false, message: 'Aucune session active.' });
  }
});

// Efface la session active
app.post('/api/session/clear', (req, res) => {
  console.log(`[Session] Session effacée : ${activeSession}`);
  activeSession = null;
  res.json({ success: true });
});

// WebSocket
io.on('connection', (socket) => {
  let currentRoom = null;
  let userRole = null;

  console.log(`[Socket.IO] Nouvelle connexion : ${socket.id}`);

  socket.on('join-room', ({ sessionId, role }) => {
    currentRoom = sessionId;
    userRole = role;
    socket.join(sessionId);
    console.log(`[Socket.IO] ${socket.id} (${role}) a rejoint : ${sessionId}`);

    socket.to(sessionId).emit('system-message', {
      type: 'status',
      sender: 'system',
      text: `${role === 'deaf' ? "L'interlocuteur Sourd" : "L'interlocuteur Entendant"} a rejoint la conversation.`,
      timestamp: Date.now()
    });
  });

  socket.on('speech-message', (data) => {
    if (currentRoom) {
      console.log(`[Speech] Room ${currentRoom} : "${data.text}"`);
      io.to(currentRoom).emit('chat-message', {
        type: 'speech',
        sender: 'hearing_user',
        text: data.text,
        timestamp: Date.now()
      });
    }
  });

  socket.on('gesture-message', (data) => {
    if (currentRoom) {
      console.log(`[Gesture] Room ${currentRoom} : "${data.text}"`);
      io.to(currentRoom).emit('chat-message', {
        type: 'gesture',
        sender: 'deaf_user',
        text: data.text,
        timestamp: Date.now()
      });
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && userRole) {
      console.log(`[Socket.IO] ${socket.id} (${userRole}) déconnecté de : ${currentRoom}`);
      socket.to(currentRoom).emit('system-message', {
        type: 'status',
        sender: 'system',
        text: `${userRole === 'deaf' ? "L'interlocuteur Sourd" : "L'interlocuteur Entendant"} a quitté la conversation.`,
        timestamp: Date.now()
      });
      // Efface la session si le sourd quitte
      if (userRole === 'deaf' && activeSession === currentRoom) {
        activeSession = null;
        console.log(`[Session] Session ${currentRoom} effacée après déconnexion.`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Serveur démarré !`);
  console.log(`   Local : http://localhost:${PORT}`);
  console.log(`===================================================`);
});