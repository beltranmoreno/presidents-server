// models/Trick.js
class Trick {
  constructor(players, game) {
    this.players = players; // All players in the game
    this.game = game;
    this.activePlayers = [...players]; // Players still in the game
    this.currentPlayerIndex = 0;
    this.playedCards = []; // Array of arrays (sets of cards)
    this.passCount = 0;
    this.lastPlayedCards = null; // Last valid played cards
    this.lastPlayedPlayer = null; // New property to track the last player who played
    this.cardsToPlay = null; // Number of cards to play in the current trick
    this.skippedPlayers = [];
  }

  getCurrentPlayer() {
    return this.activePlayers[this.currentPlayerIndex];
  }

  advanceTurn() {
    if (this.activePlayers.length === 0) {
      // No active players left
      return;
    }

    do {
      this.currentPlayerIndex =
        (this.currentPlayerIndex + 1) % this.activePlayers.length;
      const currentPlayer = this.activePlayers[this.currentPlayerIndex];
      // Remove player from skipped list if their turn has been skipped
      if (this.skippedPlayers.includes(currentPlayer.id)) {
        this.skippedPlayers = this.skippedPlayers.filter(
          (id) => id !== currentPlayer.id
        );
        // Skip this player's turn
      } else {
        break; // Found the next active player
      }
    } while (true);
  }

  playCard(player, indices) {
    if (player !== this.getCurrentPlayer()) {
      return { action: "error", message: "It's not your turn." };
    }

    // Prevent player from playing two consecutive moves
    if (this.lastPlayedPlayer === player && this.lastPlayedCards !== null) {
      return {
        action: "error",
        message: "You cannot play two consecutive turns.",
      };
    }

    // Get the selected cards
    const selectedCards = indices.map((index) => player.hand[index]);

    // Validate the move
    const isValid = this.validateMove(selectedCards);

    if (!isValid.valid) {
      return { action: "error", message: isValid.message };
    }

    // Remove selected cards from the player's hand
    selectedCards.forEach((card) => {
      const cardIndex = player.hand.findIndex(
        (c) => c.rank === card.rank && c.suit === card.suit
      );
      if (cardIndex !== -1) {
        player.hand.splice(cardIndex, 1);
      }
    });

    this.playedCards.push(selectedCards);
    this.passCount = 0;

    // Update lastPlayedCards and lastPlayedPlayer
    this.lastPlayedCards = selectedCards;
    this.lastPlayedPlayer = player;

    // Initialize variables for skipped and finished players
    let skippedPlayer = null;
    let finishedPlayer = null;

    // Check if the player has finished
    if (player.hand.length === 0) {
      finishedPlayer = this.game.handlePlayerFinished(player);
      // Since the current player has finished, we do not call advanceTurn or skipNextPlayer
    } else {
      // Check for skipping the next player
      if (this.shouldSkipNextPlayer(selectedCards)) {
        skippedPlayer = this.skipNextPlayer();
      } else {
        this.advanceTurn();
      }
    }

    // Check if the game has ended
    if (this.activePlayers.length === 0) {
      this.game.handleGameEnd();
      return { action: "game_end", finishedPlayer };
    }

    // Return the action and any skipped or finished player information
    return { action: "next", skippedPlayer, finishedPlayer };
  }

  removeActivePlayer(player) {
    // Find the index of the player in activePlayers
    const playerIndex = this.activePlayers.findIndex((p) => p.id === player.id);

    // Remove the player from activePlayers
    this.activePlayers.splice(playerIndex, 1);

    // Adjust currentPlayerIndex if necessary
    if (playerIndex < this.currentPlayerIndex) {
      // Decrement currentPlayerIndex since a player before the current player was removed
      this.currentPlayerIndex -= 1;
    } else if (playerIndex === this.currentPlayerIndex) {
      // The current player has finished
      // No need to adjust currentPlayerIndex; it now points to the next player
      if (this.currentPlayerIndex >= this.activePlayers.length) {
        // Wrap around if necessary
        this.currentPlayerIndex = 0;
      }
    }
  }

  passTurn(player) {
    if (player !== this.getCurrentPlayer()) {
      return { action: "error", message: "It's not your turn." };
    }

    this.advanceTurn();

    console.log("Passed turn");

    // Check if the next player is the same as the last player who played
    if (this.getCurrentPlayer() === this.lastPlayedPlayer) {
      console.log("All other players have passed or been skipped, reset trick");
      this.lastPlayedCards = null; // Reset the last played cards
      this.cardsToPlay = null; // Reset the number of cards to play
      this.lastPlayedPlayer = null; // Reset the last played player
    }

    return { action: "next" };
  }

  getRankValue(rank) {
    const rankOrder = [
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "Jack",
      "Queen",
      "King",
      "Ace",
      "2",
    ];

    return rankOrder.indexOf(rank);
  }

  shouldSkipNextPlayer(selectedCards) {
    // If the rank of the selected cards is the same as the last played cards
    if (!this.lastPlayedCards || this.lastPlayedCards.length === 0) {
      return false;
    }

    console.log("Selected cards rank", selectedCards[0].rank);
    console.log("This last played cards rank", this.lastPlayedCards[0].rank);

    return selectedCards[0].rank === this.lastPlayedCards[0].rank;
  }

  skipNextPlayer() {
    // Add the next player to the skipped players list
    const nextPlayerIndex =
      (this.currentPlayerIndex + 1) % this.activePlayers.length;
    const nextPlayer = this.activePlayers[nextPlayerIndex];

    this.skippedPlayers.push(nextPlayer.id);

    this.advanceTurn();
    return nextPlayer;
  }

  validateMove(selectedCards) {
    // Rule 1: Player must play at least one card
    // if (selectedCards.length === 0) {
    //   console.error("You must select at least one card to play.");
    //   return {
    //     valid: false,
    //     message: "You must select at least one card to play.",
    //   };
    // }

    // // Rule 2: All cards must have the same rank if playing multiple cards
    // const firstCardRank = selectedCards[0].rank;
    // const allSameRank = selectedCards.every(
    //   (card) => card.rank === firstCardRank
    // );

    // if (!allSameRank) {
    //   console.error("All cards played must have the same rank.");

    //   return {
    //     valid: false,
    //     message: "All cards played must have the same rank.",
    //   };
    // }

    // // Rule 3: If it's the first play of the trick
    // if (!this.lastPlayedCards || this.lastPlayedCards.length === 0) {
    //   // Set the number of cards to play for this trick
    //   this.cardsToPlay = selectedCards.length;
    // } else {
    //   // Rule 4: Must play the same number of cards as the previous play
    //   if (selectedCards.length !== this.cardsToPlay) {
    //     console.error(`You must play ${this.cardsToPlay} card(s).`);

    //     return {
    //       valid: false,
    //       message: `You must play ${this.cardsToPlay} card(s).`,
    //     };
    //   }

    //   // Rule 5: The played cards must be of higher rank than the last played cards
    //   const lastRankValue = this.getRankValue(this.lastPlayedCards[0].rank);
    //   console.log("Last rank value", lastRankValue);
    //   const currentRankValue = this.getRankValue(selectedCards[0].rank);
    //   console.log("Current rank value", currentRankValue);

    //   if (currentRankValue < lastRankValue) {
    //     console.error("You must play a higher rank than the previous play.");
    //     return {
    //       valid: false,
    //       message:
    //         "You must play the same or higher rank than the previous play.",
    //     };
    //   }
    // }

    return { valid: true };
  }
}

module.exports = Trick;
