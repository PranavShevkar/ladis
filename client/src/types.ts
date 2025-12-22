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
  position: number;
  team: 0 | 1;
}

export interface TeamScore {
  kalyas: number;
  laddos: number;
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
  currentPlayer: number;
  shufflingTeam: 0 | 1;
  hukum: Suit | null;
  hukumCaller: number | null;
  currentTrick: TrickCard[];
  leadSuit: Suit | null;
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
  handNumber: number;
  targetTricks: {
    team0: number;
    team1: number;
  };
}
