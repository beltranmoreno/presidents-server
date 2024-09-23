// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const GameController = require("./controllers/gameController");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://presidents-client-next.vercel.app",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  },
});

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://presidents-client-next.vercel.app",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("createGame", ({ name, numPlayers }, callback) => {
    try {
      // Generate a 6-digit game code
      const gameCode = crypto.randomBytes(3).toString("hex").toUpperCase();
      GameController.createGame(gameCode, numPlayers);
      GameController.addPlayerToGame(gameCode, socket.id, name);
      const playerId = socket.id;

      // Join the Socket.IO room for this game
      socket.join(gameCode);

      console.log(`${name} created and joined game ${gameCode}`);

      // Send the game code back to the client
      callback({ gameCode, playerId });

      // Broadcast the updated game state
      const gameState = GameController.getGameState(gameCode);
      io.to(gameCode).emit("gameState", gameState);
    } catch (error) {
      console.error(error.message);
      callback({ error: error.message });
    }
  });

  socket.on("joinGame", ({ name, gameCode }, callback) => {
    if (typeof callback !== "function") {
      callback = () => {}; // Provide a no-op function
    }
    if (!name || !gameCode) {
      callback({ error: "Name and game code are required." });
      return;
    }

    try {
      GameController.addPlayerToGame(gameCode, socket.id, name);
      const playerId = socket.id;

      // Join the Socket.IO room for this game
      socket.join(gameCode);

      console.log(`${name} joined game ${gameCode}`);

      callback({ success: true, playerId });

      // Broadcast the updated game state
      const gameState = GameController.getGameState(gameCode);
      io.to(gameCode).emit("gameState", gameState);
    } catch (error) {
      console.error(error.message);
      callback({ error: error.message });
    }
  });

  socket.on("playCard", ({ gameCode, indices }, callback) => {
    try {
      const result = GameController.handlePlayCard(
        gameCode,
        socket.id,
        indices
      );

      if (result.action === "error") {
        console.error(result.message);
        callback({ error: result.message });
      } else {
        // Broadcast the updated game state
        const gameState = GameController.getGameState(gameCode);
        io.to(gameCode).emit("gameState", gameState);

        // Check if any player was skipped
        if (result.skippedPlayer) {
          const skippedPlayerName = result.skippedPlayer.name;
          io.to(gameCode).emit("playerSkipped", {
            message: `${skippedPlayerName} has been skipped!`,
            skippedPlayer: skippedPlayerName,
          });
        }

        // Check if any player has finished
        if (result.finishedPlayer) {
          io.to(gameCode).emit("playerFinished", {
            message: `${result.finishedPlayer.name} has finished and is the ${result.finishedPlayer.title}!`,
            finishedPlayer: result.finishedPlayer,
          });
        }

        if (result.action === "game_end") {
          // Get the final game state including finished players and their titles
          const finalGameState = GameController.getGameState(gameCode);
          io.to(gameCode).emit("gameEnd", {
            message: "The game has ended!",
            finishedPlayers: finalGameState.finishedPlayers,
          });
        }

        callback({ success: true });
      }
    } catch (error) {
      console.error(error.message);
      callback({ error: error.message });
    }
  });

  socket.on("passTurn", ({ gameCode }, callback) => {
    try {
      const result = GameController.handlePassTurn(gameCode, socket.id);

      if (result.action === "error") {
        callback({ error: result.message });
      } else {
        // Broadcast the updated game state
        const gameState = GameController.getGameState(gameCode);
        io.to(gameCode).emit("gameState", gameState);

        callback({ success: true });
      }
    } catch (error) {
      console.error(error.message);
      callback({ error: error.message });
    }
  });

  socket.on("playAgain", ({ gameCode }, callback = () => {}) => {
    try {
      const game = GameController.getGame(gameCode);
      if (!game) {
        callback({ error: "Game not found." });
        return;
      }

      game.playAgainVotes[socket.id] = true;

      // Check if all players have voted to play again
      if (Object.keys(game.playAgainVotes).length === game.players.length) {
        // Reset the game
        game.resetGame();

        // Start a new game
        game.start();

        // Notify all clients
        const gameState = GameController.getGameState(gameCode);
        console.log("Game State: ", gameState);
        io.to(gameCode).emit("gameState", gameState);
        io.to(gameCode).emit("gameRestarted");
      }

      callback({ success: true });
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

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
