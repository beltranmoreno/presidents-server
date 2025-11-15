// controllers/gameController.js
const BotPlayer = require("../models/BotPlayer");
const Game = require("../models/Game");
const Player = require("../models/Player");

class GameController {
  constructor() {
    this.games = {}; // Store games by gameId
    this.playerLookup = {}; // Map of gameId -> Map of playerId -> Player for O(1) lookups
  }

  /**
   * Create a new game with specified number of players and bots
   * @param {string} gameId - Unique identifier for the game
   * @param {number} numPlayers - Total number of players (including bots)
   * @param {number} numBots - Number of bot players (default: 0)
   * @param {string} botDifficulty - Difficulty level for bots: 'easy', 'medium', 'hard' (default: 'medium')
   * @returns {Object} Result object with game or error
   */
  createGame(gameId, numPlayers, numBots = 0, botDifficulty = "medium") {
    try {
      // Validation
      if (!gameId || typeof gameId !== "string") {
        return {
          success: false,
          error: "Invalid game ID provided.",
        };
      }

      if (this.games[gameId]) {
        return {
          success: false,
          error: `Game with ID ${gameId} already exists.`,
        };
      }

      if (typeof numPlayers !== "number" || numPlayers < 2 || numPlayers > 8) {
        return {
          success: false,
          error: "Number of players must be between 2 and 8.",
        };
      }

      if (typeof numBots !== "number" || numBots < 0 || numBots > numPlayers) {
        return {
          success: false,
          error: `Number of bots must be between 0 and ${numPlayers}.`,
        };
      }

      const game = new Game();
      game.numPlayers = numPlayers;
      this.games[gameId] = game;
      this.playerLookup[gameId] = new Map();

      // Add bots immediately if requested
      if (numBots > 0) {
        const result = this.addBotsToGame(gameId, numBots, botDifficulty);
        if (!result.success) {
          // Cleanup if bot addition failed
          delete this.games[gameId];
          delete this.playerLookup[gameId];
          return result;
        }
      }

      return { success: true, game };
    } catch (error) {
      console.error(`Error creating game ${gameId}:`, error);
      return {
        success: false,
        error: "Failed to create game due to an unexpected error.",
      };
    }
  }

  /**
   * Add a human player to a game
   * @param {string} gameCode - Game identifier
   * @param {string} playerId - Unique player identifier
   * @param {string} playerName - Display name for the player
   * @returns {Object} Result object with success status
   */
  addPlayerToGame(gameCode, playerId, playerName) {
    try {
      const game = this.games[gameCode];
      if (!game) {
        return {
          success: false,
          error: `Game with code ${gameCode} does not exist.`,
        };
      }

      // Check if the player is already in the game
      if (this.playerLookup[gameCode].has(playerId)) {
        console.log(`Player ${playerName} is already in the game.`);
        return {
          success: false,
          error: "Player is already in this game.",
        };
      }

      if (game.players.length >= game.numPlayers) {
        return {
          success: false,
          error: "Game is already full.",
        };
      }

      const player = new Player(playerId, playerName);
      game.addPlayer(player);
      this.playerLookup[gameCode].set(playerId, player);

      // Start the game if enough players have joined
      if (game.players.length === game.numPlayers) {
        game.start();
      }

      return { success: true, player };
    } catch (error) {
      console.error(`Error adding player to game ${gameCode}:`, error);
      return {
        success: false,
        error: "Failed to add player due to an unexpected error.",
      };
    }
  }

  /**
   * Add bot players to a game
   * @param {string} gameCode - Game identifier
   * @param {number} numBots - Number of bots to add
   * @param {string} difficulty - Bot difficulty level: 'easy', 'medium', 'hard'
   * @returns {Object} Result object with success status and bots array
   */
  addBotsToGame(gameCode, numBots, difficulty = "medium") {
    try {
      const game = this.games[gameCode];
      if (!game) {
        return {
          success: false,
          error: `Game with code ${gameCode} does not exist.`,
        };
      }

      // Validation
      if (typeof numBots !== "number" || numBots <= 0) {
        return {
          success: false,
          error: "Number of bots must be a positive number.",
        };
      }

      const availableSlots = game.numPlayers - game.players.length;
      if (numBots > availableSlots) {
        return {
          success: false,
          error: `Cannot add ${numBots} bots. Only ${availableSlots} slot(s) available.`,
        };
      }

      const validDifficulties = ["easy", "medium", "hard"];
      if (!validDifficulties.includes(difficulty)) {
        return {
          success: false,
          error: `Invalid difficulty. Must be one of: ${validDifficulties.join(", ")}`,
        };
      }

      const bots = [];
      const currentBotCount = game.players.filter((p) => p.isBot).length;

      for (let i = 0; i < numBots; i++) {
        const botIndex = currentBotCount + i;
        const botId = `bot-${gameCode}-${Date.now()}-${botIndex}`;
        const botName = BotPlayer.generateBotName(botIndex);
        const bot = new BotPlayer(botId, botName, difficulty);

        game.addPlayer(bot);
        this.playerLookup[gameCode].set(botId, bot);
        bots.push(bot);
      }

      return { success: true, bots };
    } catch (error) {
      console.error(`Error adding bots to game ${gameCode}:`, error);
      return {
        success: false,
        error: "Failed to add bots due to an unexpected error.",
      };
    }
  }

  /**
   * Remove a bot from the game (useful when a human wants to join)
   * @param {string} gameCode - Game identifier
   * @param {string} botId - Bot identifier to remove
   * @returns {Object} Result object with success status
   */
  removeBot(gameCode, botId) {
    try {
      const game = this.games[gameCode];
      if (!game) {
        return {
          success: false,
          error: `Game with code ${gameCode} does not exist.`,
        };
      }

      const bot = this.playerLookup[gameCode].get(botId);
      if (!bot) {
        return {
          success: false,
          error: "Bot not found in this game.",
        };
      }

      if (!bot.isBot) {
        return {
          success: false,
          error: "Cannot remove human players using this method.",
        };
      }

      // Check if game has started
      if (game.trick !== null) {
        return {
          success: false,
          error: "Cannot remove bots after the game has started.",
        };
      }

      // Remove from game
      const playerIndex = game.players.findIndex((p) => p.id === botId);
      if (playerIndex !== -1) {
        game.players.splice(playerIndex, 1);
      }

      // Remove from lookup
      this.playerLookup[gameCode].delete(botId);

      return { success: true };
    } catch (error) {
      console.error(`Error removing bot from game ${gameCode}:`, error);
      return {
        success: false,
        error: "Failed to remove bot due to an unexpected error.",
      };
    }
  }

  /**
   * Handle a player's card play action
   * @param {string} gameCode - Game identifier
   * @param {string} playerId - Player identifier
   * @param {Array<number>} indices - Indices of cards to play
   * @returns {Object} Result object with action and details
   */
  handlePlayCard(gameCode, playerId, indices) {
    try {
      const game = this.games[gameCode];
      if (!game) {
        return {
          success: false,
          action: "error",
          message: `Game with code ${gameCode} does not exist.`,
        };
      }

      const player = this.playerLookup[gameCode].get(playerId);
      if (!player) {
        return {
          success: false,
          action: "error",
          message: "Player not found in the game.",
        };
      }

      if (!game.trick) {
        return {
          success: false,
          action: "error",
          message: "Game has not started yet.",
        };
      }

      const result = game.trick.playCard(player, indices);
      return { success: result.action !== "error", ...result };
    } catch (error) {
      console.error(`Error handling play card in game ${gameCode}:`, error);
      return {
        success: false,
        action: "error",
        message: "Failed to play card due to an unexpected error.",
      };
    }
  }

  /**
   * Handle a player passing their turn
   * @param {string} gameCode - Game identifier
   * @param {string} playerId - Player identifier
   * @returns {Object} Result object with action and details
   */
  handlePassTurn(gameCode, playerId) {
    try {
      const game = this.games[gameCode];
      if (!game) {
        return {
          success: false,
          action: "error",
          message: `Game with code ${gameCode} does not exist.`,
        };
      }

      const player = this.playerLookup[gameCode].get(playerId);
      if (!player) {
        return {
          success: false,
          action: "error",
          message: "Player not found in the game.",
        };
      }

      if (!game.trick) {
        return {
          success: false,
          action: "error",
          message: "Game has not started yet.",
        };
      }

      const result = game.trick.passTurn(player);
      return { success: result.action !== "error", ...result };
    } catch (error) {
      console.error(`Error handling pass turn in game ${gameCode}:`, error);
      return {
        success: false,
        action: "error",
        message: "Failed to pass turn due to an unexpected error.",
      };
    }
  }

  /**
   * Get game instance
   * @param {string} gameCode - Game identifier
   * @returns {Game|null} Game instance or null if not found
   */
  getGame(gameCode) {
    return this.games[gameCode] || null;
  }

  /**
   * Get game state as JSON
   * @param {string} gameId - Game identifier
   * @returns {Object} Game state object or error
   */
  getGameState(gameId) {
    try {
      const game = this.games[gameId];
      if (!game) {
        return {
          success: false,
          error: `Game with ID ${gameId} does not exist.`,
        };
      }

      return {
        success: true,
        state: game.toJSON(),
      };
    } catch (error) {
      console.error(`Error getting game state for ${gameId}:`, error);
      return {
        success: false,
        error: "Failed to retrieve game state due to an unexpected error.",
      };
    }
  }

  /**
   * Trigger a bot to make its move
   * @param {string} gameCode - Game identifier
   * @param {number} delay - Optional delay in milliseconds before bot moves (default: 1000)
   * @returns {Promise<Object>} Result object with action and details
   */
  async triggerBotMove(gameCode, delay = 1000) {
    try {
      const game = this.games[gameCode];
      if (!game) {
        return {
          success: false,
          action: "error",
          message: `Game with code ${gameCode} does not exist.`,
        };
      }

      if (!game.trick) {
        return {
          success: false,
          action: "error",
          message: "Game has not started yet.",
        };
      }

      const currentPlayer = game.trick.getCurrentPlayer();
      if (!currentPlayer) {
        return {
          success: false,
          action: "error",
          message: "No current player found.",
        };
      }

      if (!currentPlayer.isBot) {
        return {
          success: false,
          action: "waiting",
          message: "Current player is not a bot.",
        };
      }

      // Add delay for natural feel
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const move = currentPlayer.makeMove(game.trick);

      if (move.action === "play") {
        // The bot plays cards
        return this.handlePlayCard(gameCode, currentPlayer.id, move.indices);
      } else if (move.action === "pass") {
        // The bot passes its turn
        return this.handlePassTurn(gameCode, currentPlayer.id);
      } else {
        return {
          success: false,
          action: "error",
          message: "Bot returned invalid move action.",
        };
      }
    } catch (error) {
      console.error(`Error triggering bot move in game ${gameCode}:`, error);
      return {
        success: false,
        action: "error",
        message: "Failed to trigger bot move due to an unexpected error.",
      };
    }
  }

  /**
   * Delete a game and clean up resources
   * @param {string} gameCode - Game identifier
   * @returns {Object} Result object with success status
   */
  deleteGame(gameCode) {
    try {
      if (!this.games[gameCode]) {
        return {
          success: false,
          error: `Game with code ${gameCode} does not exist.`,
        };
      }

      delete this.games[gameCode];
      delete this.playerLookup[gameCode];

      return { success: true };
    } catch (error) {
      console.error(`Error deleting game ${gameCode}:`, error);
      return {
        success: false,
        error: "Failed to delete game due to an unexpected error.",
      };
    }
  }

  /**
   * Get all active game codes
   * @returns {Array<string>} Array of game codes
   */
  getActiveGames() {
    return Object.keys(this.games);
  }

  /**
   * Get statistics about a game
   * @param {string} gameCode - Game identifier
   * @returns {Object} Game statistics or error
   */
  getGameStats(gameCode) {
    try {
      const game = this.games[gameCode];
      if (!game) {
        return {
          success: false,
          error: `Game with code ${gameCode} does not exist.`,
        };
      }

      const stats = {
        totalPlayers: game.numPlayers,
        connectedPlayers: game.players.length,
        humanPlayers: game.players.filter((p) => !p.isBot).length,
        botPlayers: game.players.filter((p) => p.isBot).length,
        gameStarted: game.trick !== null,
        finishedPlayers: game.finishedPlayers.length,
      };

      return { success: true, stats };
    } catch (error) {
      console.error(`Error getting game stats for ${gameCode}:`, error);
      return {
        success: false,
        error: "Failed to retrieve game statistics due to an unexpected error.",
      };
    }
  }

  /**
   * Helper: Get game state or throw error (for internal server use)
   * @param {string} gameId - Game identifier
   * @returns {Object} Game state JSON
   * @throws {Error} If game not found or error occurs
   */
  getGameStateOrThrow(gameId) {
    const result = this.getGameState(gameId);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.state;
  }
}

module.exports = new GameController();
