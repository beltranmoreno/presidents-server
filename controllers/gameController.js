// controllers/gameController.js
const BotPlayer = require("../models/BotPlayer");
const Game = require("../models/Game");
const Player = require("../models/Player");

class GameController {
  constructor() {
    this.games = {}; // Store games by gameId
  }

  createGame(gameId, numPlayers, numBots = 0) {
    const game = new Game();
    game.numPlayers = numPlayers;
    this.games[gameId] = game;
    
    // Add bots immediately if requested
    if (numBots > 0) {
      this.addBotsToGame(game, numBots);
    }
    return game;
  }

  addPlayerToGame(gameCode, playerId, playerName) {
    const game = this.games[gameCode];
    if (!game) {
      throw new Error(`Game with code ${gameCode} does not exist.`);
    }

    // Check if the player is already in the game
    if (game.players.some((player) => player.id === playerId)) {
      console.log(`Player ${playerName} is already in the game.`);
      return;
    }

    if (game.players.length >= game.numPlayers) {
      throw new Error("Game is already full.");
    }

    const player = new Player(playerId, playerName);
    game.addPlayer(player);

    // Start the game if enough players have joined
    if (game.players.length === game.numPlayers) {
      game.start();
    }
  }

  addBotsToGame(game, numBots) {
    const botsNeeded = numBots;
    for (let i = 0; i < botsNeeded; i++) {
      const bot = new BotPlayer(`bot-${i}`, `Bot ${i + 1}`);
      game.addPlayer(bot);
    }
  }

  handlePlayCard(gameCode, playerId, indices) {
    const game = this.games[gameCode];
    if (!game) {
      return {
        action: "error",
        message: `Game with code ${gameCode} does not exist.`,
      };
    }

    const player = game.players.find((p) => p.id === playerId);
    if (!player) {
      return { action: "error", message: "Player not found in the game." };
    }

    return game.trick.playCard(player, indices);
  }

  handlePassTurn(gameCode, playerId) {
    const game = this.games[gameCode];
    if (!game) {
      return {
        action: "error",
        message: `Game with code ${gameCode} does not exist.`,
      };
    }

    const player = game.players.find((p) => p.id === playerId);
    if (!player) {
      return { action: "error", message: "Player not found in the game." };
    }

    return game.trick.passTurn(player);
  }

  getGame(gameCode) {
    return this.games[gameCode];
  }

  getGameState(gameId) {
    return this.games[gameId].toJSON();
  }

  triggerBotMove(gameCode) {
    const game = this.games[gameCode];
    const currentPlayer = game.getCurrentPlayer();
  
    if (currentPlayer.isBot) {
      const move = currentPlayer.makeMove(game.trick);
  
      if (move.action === "play") {
        // The bot plays cards
        return this.handlePlayCard(gameCode, currentPlayer.id, move.indices);
      } else if (move.action === "pass") {
        // The bot passes its turn
        return this.handlePassTurn(gameCode, currentPlayer.id);
      }
    }
  }
}

module.exports = new GameController();
