// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const GameController = require("./controllers/gameController");
const crypto = require('crypto');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: "http://localhost:3001",
    methods: ["GET", "POST"],
  })
);

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('createGame', ({ name, numPlayers }, callback) => {
    try {
      // Generate a 6-digit game code
      const gameCode = crypto.randomBytes(3).toString('hex').toUpperCase();
      GameController.createGame(gameCode, numPlayers);
      GameController.addPlayerToGame(gameCode, socket.id, name);

      // Join the Socket.IO room for this game
      socket.join(gameCode);

      console.log(`${name} created and joined game ${gameCode}`);

      // Send the game code back to the client
      callback({ gameCode });

      // Broadcast the updated game state
      const gameState = GameController.getGameState(gameCode);
      io.to(gameCode).emit('gameState', gameState);
    } catch (error) {
      console.error(error.message);
      callback({ error: error.message });
    }
  });

  socket.on('joinGame', ({ name, gameCode }, callback) => {
    if (typeof callback !== 'function') {
      callback = () => {}; // Provide a no-op function
    }
    if (!name || !gameCode) {
      callback({ error: 'Name and game code are required.' });
      return;
    }
  
    try {
      GameController.addPlayerToGame(gameCode, socket.id, name);

      // Join the Socket.IO room for this game
      socket.join(gameCode);

      console.log(`${name} joined game ${gameCode}`);

      callback({ success: true });

      // Broadcast the updated game state
      const gameState = GameController.getGameState(gameCode);
      io.to(gameCode).emit('gameState', gameState);
    } catch (error) {
      console.error(error.message);
      callback({ error: error.message });
    }
  });

  socket.on('playCard', ({ gameCode, indices }, callback) => {
    try {
      const result = GameController.handlePlayCard(gameCode, socket.id, indices);

      if (result.action === 'error') {
        callback({ error: result.message });
      } else {
        // Broadcast the updated game state
        const gameState = GameController.getGameState(gameCode);
        io.to(gameCode).emit('gameState', gameState);

        if (result.action === 'end') {
          io.to(gameCode).emit('gameEnd', result.message);
        }

        callback({ success: true });
      }
    } catch (error) {
      console.error(error.message);
      callback({ error: error.message });
    }
  });

  socket.on('passTurn', ({ gameCode }, callback) => {
    try {
      const result = GameController.handlePassTurn(gameCode, socket.id);

      if (result.action === 'error') {
        callback({ error: result.message });
      } else {
        // Broadcast the updated game state
        const gameState = GameController.getGameState(gameCode);
        io.to(gameCode).emit('gameState', gameState);

        callback({ success: true });
      }
    } catch (error) {
      console.error(error.message);
      callback({ error: error.message });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Handle player disconnection if necessary
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
