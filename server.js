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

/**
 * Helper function to trigger bot moves after a game state change
 * @param {string} gameCode - Game code
 * @param {number} minDelay - Minimum delay before bot plays (ms)
 * @param {number} maxDelay - Maximum delay before bot plays (ms)
 */
async function triggerBotIfNeeded(gameCode, minDelay = 1000, maxDelay = 2000) {
  try {
    const game = GameController.getGame(gameCode);
    if (!game || !game.trick) return;

    const currentPlayer = game.trick.getCurrentPlayer();
    if (!currentPlayer) return;

    if (currentPlayer.isBot) {
      console.log(`Bot ${currentPlayer.name}'s turn - triggering move`);

      // Random delay between min and max for natural feel
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Make bot move
      const result = await GameController.triggerBotMove(gameCode, 0); // 0 delay since we already waited

      if (result.success && result.action !== "error") {
        // Emit updated game state to all players
        const gameState = GameController.getGameStateOrThrow(gameCode);
        io.to(gameCode).emit("gameState", gameState);

        // Handle skipped player
        if (result.skippedPlayer) {
          io.to(gameCode).emit("playerSkipped", {
            message: `${result.skippedPlayer.name} has been skipped!`,
            skippedPlayer: result.skippedPlayer,
          });
        }

        // Handle finished player
        if (result.finishedPlayer) {
          io.to(gameCode).emit("playerFinished", {
            message: `${result.finishedPlayer.name} has finished and is the ${result.finishedPlayer.title}!`,
            finishedPlayer: result.finishedPlayer,
          });
        }

        // Handle last player (loser) auto-finished
        if (result.lastFinishedPlayer) {
          io.to(gameCode).emit("playerFinished", {
            message: `${result.lastFinishedPlayer.name} is the last player and is the ${result.lastFinishedPlayer.title}!`,
            finishedPlayer: result.lastFinishedPlayer,
          });
        }

        // Handle game end
        if (result.action === "game_end") {
          const finalGameState = GameController.getGameStateOrThrow(gameCode);
          io.to(gameCode).emit("gameEnd", {
            message: "The game has ended!",
            finishedPlayers: finalGameState.finishedPlayers,
          });
          return; // Don't trigger next bot if game ended
        }

        // Chain bot moves if next player is also a bot
        await triggerBotIfNeeded(gameCode, minDelay, maxDelay);
      }
    }
  } catch (error) {
    console.error(`Error triggering bot in game ${gameCode}:`, error);
  }
}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("createGame", ({ name, numPlayers, numBots }, callback) => {
    try {
      // Generate a 6-digit game code
      const gameCode = crypto.randomBytes(3).toString("hex").toUpperCase();
      GameController.createGame(gameCode, numPlayers, numBots);
      GameController.addPlayerToGame(gameCode, socket.id, name);
      const playerId = socket.id;

      // Join the Socket.IO room for this game
      socket.join(gameCode);

      console.log(`${name} created and joined game ${gameCode}`);

      // Send the game code back to the client
      callback({ gameCode, playerId });

      // Broadcast the updated game state
      const gameState = GameController.getGameStateOrThrow(gameCode);
      io.to(gameCode).emit("gameState", gameState);

      // Trigger bot if it's a bot's turn
      triggerBotIfNeeded(gameCode);
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
      const gameState = GameController.getGameStateOrThrow(gameCode);
      io.to(gameCode).emit("gameState", gameState);

      // Trigger bot if it's a bot's turn
      triggerBotIfNeeded(gameCode);
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
        const gameState = GameController.getGameStateOrThrow(gameCode);
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

        // Check if last player (loser) auto-finished
        if (result.lastFinishedPlayer) {
          io.to(gameCode).emit("playerFinished", {
            message: `${result.lastFinishedPlayer.name} is the last player and is the ${result.lastFinishedPlayer.title}!`,
            finishedPlayer: result.lastFinishedPlayer,
          });
        }

        if (result.action === "game_end") {
          // Get the final game state including finished players and their titles
          const finalGameState = GameController.getGameStateOrThrow(gameCode);
          io.to(gameCode).emit("gameEnd", {
            message: "The game has ended!",
            finishedPlayers: finalGameState.finishedPlayers,
          });
        }

        callback({ success: true });

        // Trigger bot if it's a bot's turn
        triggerBotIfNeeded(gameCode);
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
        const gameState = GameController.getGameStateOrThrow(gameCode);
        io.to(gameCode).emit("gameState", gameState);

        // Check if trick was reset (all players passed)
        if (result.action === "trick_reset" && result.player) {
          io.to(gameCode).emit("trickReset", {
            message: `All players passed! ${result.player.name} wins the trick and starts the next round.`,
            player: result.player,
          });
        }

        callback({ success: true });

        // Trigger bot if it's a bot's turn
        triggerBotIfNeeded(gameCode);
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
        const gameState = GameController.getGameStateOrThrow(gameCode);
        console.log("Game State: ", gameState);
        io.to(gameCode).emit("gameState", gameState);
        io.to(gameCode).emit("gameRestarted");

        // Trigger bot if it's a bot's turn
        triggerBotIfNeeded(gameCode);
      }

      callback({ success: true });
    } catch (error) {
      console.error(error.message);
      callback({ error: error.message });
    }
  });

  // Server-side handler for player reconnecting
  socket.on("reconnectPlayer", ({ playerId, gameCode }, callback) => {
    console.log('Attempting to reconnect');
    const game = GameController.getGame(gameCode);
    if (!game) {
      callback({ error: "Game not found." });
      return;
    }
  
    const player = game.players.find((p) => p.id === playerId);
    console.log('Player', player);
    if (!player) {
      callback({ error: "Player not found in the game." });
      return;
    }
  
    // Reassign the socket ID to the reconnected player
    player.socketId = socket.id;
    callback({ success: true });
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
