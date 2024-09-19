// models/Game.js
const Deck = require("./Deck");
const Player = require("./Player");
const Trick = require("./Trick");

class Game {
  constructor() {
    this.playedCards = [];
    this.players = [];
    this.numPlayers = 0;
    this.titles = [
      "President",
      "Vice President",
      "Neutral",
      "Vice Scum",
      "Scum",
    ];
    this.numTricks = 0;
    this.trick = null; // Initialize the trick as null
    this.playAgainVotes = {}; // Track players who want to play again
    this.leaderboard = {}; // Track cumulative positions
    this.finishedPlayers = [];
  }

  setup(numPlayers) {
    this.numPlayers = numPlayers;
    this.players = [];
    this.trick = new Trick(this.players); // Ensure trick is initialized with players
  }

  // Ensure this method initializes the trick before accessing its properties
  startTrick() {
    if (!this.trick) {
      this.trick = new Trick(this.players);
    }
    return this.trick.play();
  }

  get_game_state() {
    const gameState = {
      type: "game_state",
      players: this.players.map((player) => player.to_dict()), // Convert players to dicts
      playedCards: this.trick
        ? this.trick.playedCards.map((cards) =>
            cards.map((card) => card.to_dict())
          )
        : [], // Safely access playedCards
      currentPlayer: this.trick ? this.trick.get_current_player().name : null, // Safely access current player
    };
    return gameState;
  }

  addPlayer(player) {
    if (this.players.length < this.numPlayers) {
      this.players.push(player);
    }
  }

  start() {
    const deck = new Deck();
    deck.shuffle();
    let playerIndex = 0;

    while (deck.cards.length) {
      const card = deck.deal(1)[0];
      this.players[playerIndex].receiveCard(card);
      playerIndex = (playerIndex + 1) % this.players.length;
    }

    for (const player of this.players) {
      player.sortHand();
    }

    this.trick = new Trick(this.players, this);
  }

  handleGameEnd() {
    // Assign final titles
    this.assignFinalTitles();

    // Update leaderboard
    this.updateLeaderboard();

    // Optionally, reset the trick or set it to null
    // this.trick = null;

    // Notify players, if needed
  }

  handlePlayerFinished(player) {
    // Assign a title based on the order of finishing
    const position = this.finishedPlayers.length + 1;
    let title = "";

    switch (position) {
      case 1:
        title = "President";
        break;
      case 2:
        title = "Vice President";
        break;
      default:
        title = ""; // Assign other titles later
        break;
    }

    const finishedPlayer = {
      id: player.id,
      name: player.name,
      title,
      position,
    };

    this.finishedPlayers.push(finishedPlayer);

    // Remove player from activePlayers in Trick
    this.trick.removeActivePlayer(player);

    // Check if game has ended
    if (this.trick.activePlayers.length === 0) {
      this.handleGameEnd();
    }

    return finishedPlayer;
  }

  assignFinalTitles() {
    const totalPlayers = this.players.length;
    const positionsAssigned = this.finishedPlayers.length;

    // Assign titles to the last players
    this.finishedPlayers.forEach((player, index) => {
      if (index === positionsAssigned - 2) {
        player.title = "Vice Scum";
      } else if (index === positionsAssigned - 1) {
        player.title = "Scum";
      } else if (!player.title) {
        player.title = "Neutral";
      }
    });
  }

  updateLeaderboard() {
    this.finishedPlayers.forEach((player) => {
      if (!this.leaderboard[player.id]) {
        this.leaderboard[player.id] = {
          name: player.name,
          positions: [],
        };
      }
      this.leaderboard[player.id].positions.push(player.title);
    });
  }

  resetGame() {
    // Reset game-specific properties while keeping players and leaderboard
    this.trick = null;
    this.playAgainVotes = {};
    this.finishedPlayers = [];
  }

  toJSON() {
    return {
      players: this.players.map((player) => player.toJSON()),
      lastPlayedCards:
        this.trick && this.trick.lastPlayedCards
          ? this.trick.lastPlayedCards.map((card) => ({
              rank: card.rank,
              suit: card.suit,
            }))
          : [],
      currentPlayer:
        this.trick && this.trick.getCurrentPlayer()
          ? this.trick.getCurrentPlayer().name
          : null,
      gameStarted: this.trick !== null,
      numPlayersConnected: this.players.length,
      numPlayersExpected: this.numPlayers,
      playedCards: this.trick
        ? this.trick.playedCards
            .flat()
            .map((card) => ({ rank: card.rank, suit: card.suit }))
        : [],
      activePlayers:
        this.trick && this.trick.activePlayers
          ? this.trick.activePlayers.map((player) => player.toJSON())
          : [],
      finishedPlayers: this.finishedPlayers,
    };
  }
}

module.exports = Game;
