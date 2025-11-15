// models/BotPlayer.js
const Player = require("./Player");

// Bot name variety
const BOT_NAMES = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon",
  "Zeta", "Theta", "Sigma", "Omega", "Phoenix",
  "Nova", "Titan", "Atlas", "Orion", "Nebula"
];

class BotPlayer extends Player {
  /**
   * Creates a new bot player
   * @param {string} id - Unique identifier for the bot
   * @param {string} name - Display name for the bot
   * @param {string} difficulty - Bot difficulty level: 'easy', 'medium', 'hard'
   */
  constructor(id, name, difficulty = "medium") {
    super(id, name);
    this.isBot = true;
    this.difficulty = difficulty;
  }

  /**
   * Generate a unique bot name from the predefined list
   * @param {number} index - Index for name selection
   * @returns {string} Bot name
   */
  static generateBotName(index) {
    return BOT_NAMES[index % BOT_NAMES.length];
  }

  /**
   * Main function to make a move automatically based on difficulty
   * @param {Trick} trick - Current trick state
   * @returns {Object} Move object with action and indices
   */
  makeMove(trick) {
    try {
      // Get all playable card combinations
      const playableCardSets = this.getPlayableCardSets(trick);

      if (playableCardSets.length === 0) {
        // No valid cards to play, pass turn
        return { action: "pass" };
      }

      // Choose cards based on difficulty
      let chosenCards;
      switch (this.difficulty) {
        case "easy":
          chosenCards = this.makeEasyMove(playableCardSets);
          break;
        case "hard":
          chosenCards = this.makeHardMove(playableCardSets, trick);
          break;
        case "medium":
        default:
          chosenCards = this.makeMediumMove(playableCardSets);
          break;
      }

      // Convert chosen cards to indices in hand
      const indices = this.getCardIndices(chosenCards);

      return { action: "play", indices };
    } catch (error) {
      console.error(`Bot ${this.name} encountered error during makeMove:`, error);
      // Fallback to passing on error
      return { action: "pass" };
    }
  }

  /**
   * Easy difficulty: Plays lowest valid cards without much strategy
   * @param {Array} playableCardSets - Array of playable card combinations
   * @returns {Array} Selected cards to play
   */
  makeEasyMove(playableCardSets) {
    // Sort by rank and return the lowest
    const sorted = [...playableCardSets].sort((a, b) =>
      this.getRankValue(a[0].rank) - this.getRankValue(b[0].rank)
    );
    return sorted[0];
  }

  /**
   * Medium difficulty: Balances between conserving high cards and playing strategically
   * @param {Array} playableCardSets - Array of playable card combinations
   * @returns {Array} Selected cards to play
   */
  makeMediumMove(playableCardSets) {
    // Prefer playing singles/pairs over higher combinations if hand is small
    if (this.hand.length <= 5) {
      // Try to get rid of low-mid range cards
      const sorted = [...playableCardSets].sort((a, b) =>
        this.getRankValue(a[0].rank) - this.getRankValue(b[0].rank)
      );
      // Play from lower third of playable options
      const targetIndex = Math.floor(sorted.length / 3);
      return sorted[targetIndex];
    }

    // Otherwise play lowest
    return this.makeEasyMove(playableCardSets);
  }

  /**
   * Hard difficulty: Strategic play to optimize winning chances
   * @param {Array} playableCardSets - Array of playable card combinations
   * @param {Trick} trick - Current trick state
   * @returns {Array} Selected cards to play
   */
  makeHardMove(playableCardSets, trick) {
    const handSize = this.hand.length;

    // End game strategy: If few cards left, try to finish
    if (handSize <= 3) {
      // Look for cards that could potentially skip next player
      if (trick.lastPlayedCards && trick.lastPlayedCards.length > 0) {
        const lastRank = trick.lastPlayedCards[0].rank;
        const sameRankPlay = playableCardSets.find(cards =>
          cards[0].rank === lastRank
        );
        if (sameRankPlay) {
          return sameRankPlay; // This will skip the next player
        }
      }

      // Otherwise play highest to get rid of problem cards
      const sorted = [...playableCardSets].sort((a, b) =>
        this.getRankValue(b[0].rank) - this.getRankValue(a[0].rank)
      );
      return sorted[0];
    }

    // Mid game: Prefer playing multiples to reduce hand faster
    if (handSize > 5) {
      // Sort by number of cards (prefer pairs/triples) then by rank
      const sorted = [...playableCardSets].sort((a, b) => {
        if (b.length !== a.length) {
          return b.length - a.length; // Prefer more cards
        }
        return this.getRankValue(a[0].rank) - this.getRankValue(b[0].rank); // Then lower rank
      });
      return sorted[0];
    }

    // Default to medium strategy
    return this.makeMediumMove(playableCardSets);
  }

  /**
   * Get all valid card combinations that can be played
   * @param {Trick} trick - Current trick state
   * @returns {Array} Array of playable card sets
   */
  getPlayableCardSets(trick) {
    const playableCardSets = [];

    // Determine how many cards we need to play
    const numCardsToPlay = trick.cardsToPlay || 1;

    // Group cards by rank
    const cardsByRank = this.groupCardsByRank();

    // For each rank, check if we can play that many cards
    for (const cards of Object.values(cardsByRank)) {
      // Can we play exactly numCardsToPlay cards of this rank?
      if (cards.length >= numCardsToPlay) {
        // Generate all combinations of this rank with the required count
        const combinations = this.getCombinations(cards, numCardsToPlay);

        // Validate each combination
        for (const combo of combinations) {
          const validationResult = trick.validateMove(combo);
          if (validationResult.valid) {
            playableCardSets.push(combo);
          }
        }
      }
    }

    return playableCardSets;
  }

  /**
   * Group cards in hand by their rank
   * @returns {Object} Object with ranks as keys and arrays of cards as values
   */
  groupCardsByRank() {
    const grouped = {};

    for (const card of this.hand) {
      if (!grouped[card.rank]) {
        grouped[card.rank] = [];
      }
      grouped[card.rank].push(card);
    }

    return grouped;
  }

  /**
   * Get all combinations of cards from an array
   * @param {Array} cards - Array of cards
   * @param {number} count - Number of cards to select
   * @returns {Array} Array of card combinations
   */
  getCombinations(cards, count) {
    // For Presidents, we typically just need the first N cards of the same rank
    // since all cards of the same rank are equivalent
    if (cards.length < count) {
      return [];
    }

    // Return just the first combination (since same rank cards are interchangeable)
    return [cards.slice(0, count)];
  }

  /**
   * Convert cards to their indices in the hand
   * @param {Array} cards - Cards to find indices for
   * @returns {Array} Array of indices
   */
  getCardIndices(cards) {
    const indices = [];
    const handCopy = [...this.hand];

    for (const card of cards) {
      const index = handCopy.findIndex(
        (c) => c.rank === card.rank && c.suit === card.suit
      );

      if (index !== -1) {
        indices.push(index);
        // Mark as used to avoid duplicate indices
        handCopy[index] = null;
      }
    }

    return indices;
  }

  /**
   * Get numeric value for a card rank (for comparison)
   * @param {string} rank - Card rank
   * @returns {number} Numeric rank value
   */
  getRankValue(rank) {
    const rankOrder = {
      3: 1,
      4: 2,
      5: 3,
      6: 4,
      7: 5,
      8: 6,
      9: 7,
      10: 8,
      Jack: 9,
      Queen: 10,
      King: 11,
      Ace: 12,
      2: 13,
    };
    return rankOrder[rank] || 0;
  }
}

module.exports = BotPlayer;
