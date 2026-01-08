import { Card, Suit, Rank, GameState, Player, TrickCard } from './types';

const SUITS: Suit[] = ['♥', '♦', '♣', '♠'];
const RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Card value hierarchy for determining trick winner
const RANK_VALUES: Record<Rank, number> = {
  '7': 1,
  '8': 2,
  '9': 3,
  '10': 4,
  'J': 5,
  'Q': 6,
  'K': 7,
  'A': 8,
};

// Create a 32-card deck (7-A in all 4 suits)
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        id: `${suit}${rank}`,
      });
    }
  }
  return deck;
}

// Shuffle the deck using Fisher-Yates algorithm
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Initial deal: 4 cards to each player
export function dealFirstCards(deck: Card[], players: Player[]): void {
  let cardIndex = 0;
  for (let i = 0; i < 4; i++) {
    for (const player of players) {
      player.hand.push(deck[cardIndex++]);
    }
  }
}

// Second deal: 4 more cards to each player (after hukum selection)
export function dealSecondCards(deck: Card[], players: Player[]): void {
  let cardIndex = 16; // First 16 cards already dealt
  for (let i = 0; i < 4; i++) {
    for (const player of players) {
      player.hand.push(deck[cardIndex++]);
    }
  }
}

// Determine which team is shuffling based on points account
// Rule: Team with more points (losing team) shuffles
// If both are 0 or equal, alternate based on round number
export function determineShufflingTeam(gameState: GameState): 0 | 1 {
  const team0Points = gameState.teamScores.team0.points;
  const team1Points = gameState.teamScores.team1.points;

  if (team0Points > team1Points) {
    return 0; // Team 0 has more points (losing), they shuffle
  } else if (team1Points > team0Points) {
    return 1; // Team 1 has more points (losing), they shuffle
  } else {
    // Equal or both zero: alternate based on round number
    return (gameState.roundNumber % 2) as 0 | 1;
  }
}

// Determine which player from non-shuffling team chooses hukum
// Alternates between the two players in non-shuffling team each round
export function determineHukumCaller(gameState: GameState): number {
  const nonShufflingTeam = gameState.shufflingTeam === 0 ? 1 : 0;
  
  // Non-shuffling team positions:
  // If team 0 is non-shuffling: positions 0 and 2
  // If team 1 is non-shuffling: positions 1 and 3
  const position1 = nonShufflingTeam === 0 ? 0 : 1;
  const position2 = nonShufflingTeam === 0 ? 2 : 3;
  
  // Alternate based on round number
  return (gameState.roundNumber % 2 === 1) ? position1 : position2;
}

// Set target tricks based on shuffling team
// Shuffling team needs 4, non-shuffling needs 5 (always)
export function setTargetTricks(gameState: GameState): void {
  // Shuffling team needs 4 tricks, non-shuffling needs 5
  if (gameState.shufflingTeam === 0) {
    gameState.targetTricks.team0 = 4;
    gameState.targetTricks.team1 = 5;
  } else {
    gameState.targetTricks.team0 = 5;
    gameState.targetTricks.team1 = 4;
  }
}

// Check if a card can be played (must follow suit if possible)
export function isValidPlay(
  card: Card,
  hand: Card[],
  leadSuit: Suit | null
): boolean {
  if (leadSuit === null) {
    return true; // Leading the trick, any card is valid
  }

  const hasSuit = hand.some((c) => c.suit === leadSuit);
  if (!hasSuit) {
    return true; // No cards of lead suit, can play anything
  }

  return card.suit === leadSuit; // Must follow suit
}

// Play a card from a player's hand
export function playCard(
  gameState: GameState,
  playerId: string,
  cardId: string
): boolean {
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) return false;

  const cardIndex = player.hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return false;

  const card = player.hand[cardIndex];

  // Validate the play
  if (!isValidPlay(card, player.hand, gameState.leadSuit)) {
    return false;
  }

  // Remove card from hand and add to current trick
  player.hand.splice(cardIndex, 1);
  gameState.currentTrick.push({ playerId, card });

  // Set lead suit if this is the first card
  if (gameState.currentTrick.length === 1) {
    gameState.leadSuit = card.suit;
  }

  return true;
}

// Determine the winner of a trick
export function resolveTrick(gameState: GameState): void {
  if (gameState.currentTrick.length !== 4) return;

  const hukum = gameState.hukum!;
  const leadSuit = gameState.leadSuit!;

  let winningCard = gameState.currentTrick[0];
  let winningValue = 0;

  for (const trickCard of gameState.currentTrick) {
    const card = trickCard.card;
    let value = RANK_VALUES[card.rank];

    // Hukum (trump) cards beat non-hukum cards
    if (card.suit === hukum && winningCard.card.suit !== hukum) {
      winningCard = trickCard;
      winningValue = value + 100; // Trump bonus
    } else if (card.suit === hukum && winningCard.card.suit === hukum) {
      // Both are trump, higher rank wins
      if (value > winningValue - 100) {
        winningCard = trickCard;
        winningValue = value + 100;
      }
    } else if (card.suit === leadSuit && winningCard.card.suit !== hukum) {
      // Following lead suit
      if (value > winningValue) {
        winningCard = trickCard;
        winningValue = value;
      }
    }
  }

  // Award trick to winning team
  const winningPlayer = gameState.players.find(
    (p) => p.id === winningCard.playerId
  )!;
  const winningTeam = winningPlayer.team;

  if (winningTeam === 0) {
    gameState.tricks.team0++;
  } else {
    gameState.tricks.team1++;
  }

  // Set next player to the winner
  gameState.currentPlayer = winningPlayer.position;

  // Clear trick
  gameState.currentTrick = [];
  gameState.leadSuit = null;
  gameState.handNumber++;
}

// Check if round is over and update points
export function checkRoundEnd(gameState: GameState): boolean {
  // Check if either team reached their target
  const team0Reached = gameState.tricks.team0 >= gameState.targetTricks.team0;
  const team1Reached = gameState.tricks.team1 >= gameState.targetTricks.team1;

  if (!team0Reached && !team1Reached) {
    return false; // Round continues
  }

  // Round is over, calculate kalya changes
  if (gameState.vakhaaiCall && gameState.vakhaaiCall.active) {
    // Vakhaai resolution
    // Team still needs to reach their target (4 or 5), not all 8 tricks
    const callingPlayer = gameState.players.find(
      p => p.id === gameState.vakhaaiCall!.playerId
    )!;
    const callingTeam = callingPlayer.team;
    const bet = gameState.vakhaaiCall!.bet;
    
    const callingTeamTarget = callingTeam === 0 ? gameState.targetTricks.team0 : gameState.targetTricks.team1;
    const callingTeamTricks = callingTeam === 0 ? gameState.tricks.team0 : gameState.tricks.team1;

    if (callingTeamTricks >= callingTeamTarget) {
      // Vakhaai won: reduce calling team's points by bet amount
      // If they don't have enough, the difference goes to opponent
      if (callingTeam === 0) {
        if (gameState.teamScores.team0.points >= bet) {
          gameState.teamScores.team0.points -= bet;
        } else {
          const difference = bet - gameState.teamScores.team0.points;
          gameState.teamScores.team0.points = 0;
          gameState.teamScores.team1.points += difference;
        }
      } else {
        if (gameState.teamScores.team1.points >= bet) {
          gameState.teamScores.team1.points -= bet;
        } else {
          const difference = bet - gameState.teamScores.team1.points;
          gameState.teamScores.team1.points = 0;
          gameState.teamScores.team0.points += difference;
        }
      }
    } else {
      // Vakhaai lost: penalty (2x bet) minus opponent's points goes to calling team
      const penalty = bet * 2;
      if (callingTeam === 0) {
        gameState.teamScores.team0.points = penalty - gameState.teamScores.team1.points;
        gameState.teamScores.team1.points = 0;
      } else {
        gameState.teamScores.team1.points = penalty - gameState.teamScores.team0.points;
        gameState.teamScores.team0.points = 0;
      }
    }
  } else {
    // Regular play resolution
    // Shuffling team = team with more points (debt)
    // Shuffling team wins = subtract 10 from their points
    // Non-shuffling team wins = add 5 to SHUFFLING team's points (loser gets penalty)
    
    if (team0Reached) {
      // Team 0 won
      if (gameState.shufflingTeam === 0) {
        // Shuffling team won: reduce their debt by 10
        if (gameState.teamScores.team0.kalyas >= 10) {
          gameState.teamScores.team0.kalyas -= 10;
        } else {
          gameState.teamScores.team0.kalyas = 0;
        }
      } else {
        // Non-shuffling team won: add 5 to shuffling team (team 1)'s kalyas
        gameState.teamScores.team1.kalyas += 5;
      }
    }

    if (team1Reached) {
      // Team 1 won
      if (gameState.shufflingTeam === 1) {
        // Shuffling team won: reduce their debt by 10
        if (gameState.teamScores.team1.kalyas >= 10) {
          gameState.teamScores.team1.kalyas -= 10;
        } else {
          gameState.teamScores.team1.kalyas = 0;
        }
      } else {
        // Non-shuffling team won: add 5 to shuffling team (team 0)'s kalyas
        gameState.teamScores.team0.kalyas += 5;
      }
    }
  }

  // Update laddos (32 points = 1 laddo, always positive)
  gameState.teamScores.team0.laddos = Math.floor(
    gameState.teamScores.team0.points / 32
  );
  gameState.teamScores.team1.laddos = Math.floor(
    gameState.teamScores.team1.points / 32
  );

  return true;
}

// Check if all players have no cards left
export function checkAllHandsEmpty(gameState: GameState): boolean {
  return gameState.players.every(player => player.hand.length === 0);
}

// Reset for next round (cards not redistributed, just reset round state)
export function resetForNextRound(gameState: GameState): void {
  gameState.roundNumber++;
  gameState.handNumber = 1;
  gameState.tricks.team0 = 0;
  gameState.tricks.team1 = 0;
  gameState.targetTricks.team0 = 0;
  gameState.targetTricks.team1 = 0;
  gameState.hukum = null;
  gameState.vakhaaiCall = null;
  gameState.currentTrick = [];
  gameState.leadSuit = null;
  
  // DO NOT clear hands - players keep remaining cards
  // Cards are only dealt when all hands are empty

  // Determine new shuffling team
  gameState.shufflingTeam = determineShufflingTeam(gameState);
  
  // Determine hukum caller
  gameState.hukumCaller = determineHukumCaller(gameState);
}

// Reset and deal new deck (only when all hands are empty)
export function dealNewDeck(gameState: GameState): void {
  // Clear all hands
  for (const player of gameState.players) {
    player.hand = [];
  }
  
  // Reset round state
  gameState.handNumber = 1;
  gameState.tricks.team0 = 0;
  gameState.tricks.team1 = 0;
  gameState.targetTricks.team0 = 0;
  gameState.targetTricks.team1 = 0;
  gameState.hukum = null;
  gameState.vakhaaiCall = null;
  gameState.currentTrick = [];
  gameState.leadSuit = null;
  
  // Determine shuffling team and hukum caller
  gameState.shufflingTeam = determineShufflingTeam(gameState);
  gameState.hukumCaller = determineHukumCaller(gameState);
}
