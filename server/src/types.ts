export type Suit = '♥' | '♦' | '♣' | '♠';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  position: number; // 0-3
  team: 0 | 1; // Team 0: positions 0&2, Team 1: positions 1&3
}

export interface TeamScore {
  points: number; // Deficit tracking (negative = good, positive = bad)
  laddos: number; // 32 points = 1 laddo
}

export interface VakhaaiCall {
  playerId: string;
  playerPosition: number;
  bet: 4 | 8 | 16 | 32;
  active: boolean;
}

export interface TrickCard {
  playerId: string;
  card: Card;
}

export type GamePhase = 
  | 'waiting'
  | 'shuffling_determination'
  | 'dealing_first'
  | 'vakhaai_check'
  | 'choosing_hukum'
  | 'dealing_second'
  | 'playing'
  | 'round_end'
  | 'game_over';

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayer: number; // Position 0-3
  shufflingTeam: 0 | 1; // Which team is shuffling this round
  hukum: Suit | null; // Trump suit
  hukumCaller: number | null; // Position of player who chooses hukum (from non-shuffling team)
  currentTrick: TrickCard[];
  leadSuit: Suit | null; // First card suit in current trick
  tricks: {
    team0: number;
    team1: number;
  };
  teamScores: {
    team0: TeamScore;
    team1: TeamScore;
  };
  vakhaaiCall: VakhaaiCall | null;
  roundNumber: number;
  handNumber: number; // Current hand within round (1-9)
  targetTricks: {
    team0: number; // How many tricks team needs to win round
    team1: number;
  };
}

export interface Room {
  code: string;
  players: Player[];
  gameState: GameState;
  currentDeck: Card[]; // Shuffled deck for current round
}
