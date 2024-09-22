// models/BotPlayer.js
const Player = require("./Player");

class BotPlayer extends Player {
  constructor(id, name) {
    super(id, name);
    this.isBot = true; // Indicate that this player is a bot
  }

  // Function to make a move automatically
  makeMove(trick) {
    // Basic strategy: play the lowest ranked cards first
    const playableCards = this.getPlayableCards(trick);

    if (playableCards.length === 0) {
      // No valid cards to play, pass turn
      return { action: "pass" };
    } else {
      // Play the lowest set of playable cards
      const indices = playableCards[0].map((card) =>
        this.hand.findIndex(
          (c) => c.rank === card.rank && c.suit === card.suit
        )
      );
      return { action: "play", indices };
    }
  }

  // Helper function to determine which cards can be played
  getPlayableCards(trick) {
    // Implement logic to find valid cards to play based on current game rules
    // For simplicity, just returning the lowest playable card set
    return this.hand
      .filter((card) => trick.validateMove([card]).valid)
      .map((card) => [card]); // Return as an array of card sets
  }
}

module.exports = BotPlayer;
