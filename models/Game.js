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

    this.trick = new Trick(this.players);
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
    };
  }
}

module.exports = Game;
