// models/Trick.js
class Trick {
  constructor(players) {
    this.players = players;
    this.currentPlayerIndex = 0;
    this.playedCards = []; // Array of arrays (sets of cards)
    this.passCount = 0;
    this.lastPlayedCards = null; // Last valid played cards
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  advanceTurn() {
    this.currentPlayerIndex =
      (this.currentPlayerIndex + 1) % this.players.length;
  }

  playCard(player, indices) {
    if (player !== this.getCurrentPlayer()) {
      return { action: 'error', message: "It's not your turn." };
    }
  
    // Get the selected cards
    const selectedCards = indices.map(index => player.hand[index]);
  
    // Implement your game-specific validation logic here
    const isValid = this.validateMove(selectedCards);
  
    if (!isValid) {
      return { action: 'error', message: 'Invalid move. Try again.' };
    }
  
    // Remove selected cards from the player's hand
    selectedCards.forEach(card => {
      const cardIndex = player.hand.findIndex(
        c => c.rank === card.rank && c.suit === card.suit
      );
      if (cardIndex !== -1) {
        player.hand.splice(cardIndex, 1);
      }
    });
  
    this.playedCards.push(selectedCards);
    this.lastPlayedCards = selectedCards;
    this.passCount = 0;
    this.advanceTurn();
  
    // Check if the player has won
    if (player.hand.length === 0) {
      return { action: 'end', message: `${player.name} has won the game!` };
    }
  
    return { action: 'next' };
  }
  
  passTurn(player) {
    if (player !== this.getCurrentPlayer()) {
      return { action: 'error', message: "It's not your turn." };
    }
  
    this.passCount += 1;
    this.advanceTurn();
  
    // If all other players have passed
    if (this.passCount === this.players.length - 1) {
      this.lastPlayedCards = null; // Reset the last played cards
      this.passCount = 0;
    }
  
    return { action: 'next' };
  }
  
  validateMove(selectedCards) {
    // Implement your game's move validation logic
    // For example, compare the selected cards with the last played cards
    // Return true if the move is valid, false otherwise
    return selectedCards.length > 0; // Placeholder validation
  }
}

module.exports = Trick;
