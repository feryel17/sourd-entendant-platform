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

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback API route to generate a dynamic session code
app.post('/api/session/create', (req, res) => {
  const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase(); // e.g. 'A7K9X2'
  res.json({ success: true, sessionId });
});

// WebSocket Event Handling
io.on('connection', (socket) => {
  let currentRoom = null;
  let userRole = null;

  console.log(`[Socket.IO] New connection: ${socket.id}`);

  // User joins a communication room
  socket.on('join-room', ({ sessionId, role }) => {
    currentRoom = sessionId;
    userRole = role;

    socket.join(sessionId);
    console.log(`[Socket.IO] User ${socket.id} (${role}) joined room: ${sessionId}`);

    // Notify others in the room
    socket.to(sessionId).emit('system-message', {
      type: 'status',
      sender: 'system',
      text: `${role === 'deaf' ? 'L\'interlocuteur Sourd' : 'L\'interlocuteur Entendant'} a rejoint la conversation.`,
      timestamp: Date.now()
    });
  });

  // Handle Speech messages from B (Hearing User)
  socket.on('speech-message', (data) => {
    if (currentRoom) {
      console.log(`[Speech] In room ${currentRoom}: "${data.text}"`);
      // Broadcast to everyone in the room (including sender to confirm delivery)
      io.to(currentRoom).emit('chat-message', {
        type: 'speech',
        sender: 'hearing_user',
        text: data.text,
        timestamp: Date.now()
      });
    }
  });

  // Handle Gesture messages from A / Smart Glasses (Deaf User)
  socket.on('gesture-message', (data) => {
    if (currentRoom) {
      console.log(`[Gesture] In room ${currentRoom}: "${data.text}"`);
      // Broadcast to everyone in the room
      io.to(currentRoom).emit('chat-message', {
        type: 'gesture',
        sender: 'deaf_user',
        text: data.text,
        timestamp: Date.now()
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (currentRoom && userRole) {
      console.log(`[Socket.IO] User ${socket.id} (${userRole}) disconnected from room: ${currentRoom}`);
      socket.to(currentRoom).emit('system-message', {
        type: 'status',
        sender: 'system',
        text: `${userRole === 'deaf' ? 'L\'interlocuteur Sourd' : 'L\'interlocuteur Entendant'} a quitté la conversation.`,
        timestamp: Date.now()
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Sourd-Entendant Platform server started!`);
  console.log(`   Local URL: http://localhost:${PORT}`);
  console.log(`===================================================`);
});
