// models/Player.js
class Player {
  constructor(id, name) {
    this.id = id; // Socket ID or unique identifier
    this.name = name;
    this.hand = [];
  }

  receiveCard(card) {
    this.hand.push(card);
  }

  sortHand() {
    // Implement sorting logic based on game rules
    // For simplicity, we'll sort by rank
    this.hand.sort((a, b) => {
      // Define rank order
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
      return rankOrder[a.rank] - rankOrder[b.rank];
    });
  }

  playCards(indices) {
    // Remove cards from hand based on indices and return them
    const playedCards = indices.map((index) => this.hand[index]);
    // Remove cards from the player's hand
    this.hand = this.hand.filter((_, idx) => !indices.includes(idx));
    return playedCards;
  }

  toJSON() {
    return {
      name: this.name,
      hand: this.hand.map((card) => ({ rank: card.rank, suit: card.suit })),
    };
  }
}

module.exports = Player;
