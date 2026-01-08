import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  Room,
  GameState,
  Player,
  Suit,
} from './types';
import * as gameEngine from './gameEngine';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'https://ladis-client.vercel.app'],
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3003;

const rooms = new Map<string, Room>();
const vakhaaiTimers = new Map<string, NodeJS.Timeout>(); // Track countdown timers per room

// Generate random room code
function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Create initial game state
function createInitialGameState(): GameState {
  return {
    phase: 'waiting',
    players: [],
    currentPlayer: 0,
    shufflingTeam: 0,
    hukum: null,
    hukumCaller: null,
    currentTrick: [],
    leadSuit: null,
    tricks: { team0: 0, team1: 0 },
    teamScores: {
      team0: { points: 0, laddos: 0 },
      team1: { points: 0, laddos: 0 },
    },
    vakhaaiCall: null,
    roundNumber: 1,
    handNumber: 1,
    targetTricks: { team0: 0, team1: 0 },
  };
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', (playerName: string) => {
    const roomCode = generateRoomCode();
    const player: Player = {
      id: socket.id,
      name: playerName,
      hand: [],
      position: 0,
      team: 0,
    };

    const gameState = createInitialGameState();
    gameState.players = [player];

    const room: Room = {
      code: roomCode,
      players: [player],
      gameState: gameState,
      currentDeck: [],
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);

    socket.emit('roomCreated', { roomCode, gameState: room.gameState });
    console.log(`Room ${roomCode} created by ${playerName}`);
  });

  socket.on('joinRoom', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (room.players.length >= 4) {
      socket.emit('error', 'Room is full');
      return;
    }

    // Assign position and team
    // Team 0: positions 0 & 2, Team 1: positions 1 & 3
    const position = room.players.length;
    const team = position % 2 === 0 ? 0 : 1;

    const player: Player = {
      id: socket.id,
      name: playerName,
      hand: [],
      position,
      team: team as 0 | 1,
    };

    room.players.push(player);
    room.gameState.players = room.players;
    socket.join(roomCode);

    io.to(roomCode).emit('playerJoined', room.gameState);

    // Start game if 4 players
    if (room.players.length === 4) {
      startNewRound(room);
      io.to(roomCode).emit('gameState', room.gameState);
    }

    console.log(`${playerName} joined room ${roomCode} (${room.players.length}/4 players)`);
  });

  socket.on('vakhaaiCall', ({ roomCode, bet }: { roomCode: string; bet: 4 | 8 | 16 | 32 }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState.phase !== 'vakhaai_check') return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    // Check if bet is higher than current vakhaai (or if it's the first call)
    const currentBet = room.gameState.vakhaaiCall?.bet || 0;
    if (bet <= currentBet) return;

    // Clear existing timer if any
    const existingTimer = vakhaaiTimers.get(roomCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Update vakhaai call
    room.gameState.vakhaaiCall = {
      playerId: socket.id,
      playerPosition: player.position,
      bet,
      active: true,
      timestamp: Date.now(),
    };

    // If bet is 32 (max value), end phase immediately
    if (bet === 32) {
      room.gameState.phase = 'choosing_hukum';
      room.gameState.vakhaaiCountdown = undefined;
      gameEngine.setTargetTricks(room.gameState);
      io.to(roomCode).emit('gameState', room.gameState);
      console.log(`Vakhaai called: ${bet} kalya by ${player.name} - Max bet, ending phase`);
      return;
    }

    // Start 5-second countdown
    room.gameState.vakhaaiCountdown = 5;
    io.to(roomCode).emit('gameState', room.gameState);

    // Update countdown every second
    const countdownInterval = setInterval(() => {
      const currentRoom = rooms.get(roomCode);
      if (!currentRoom || currentRoom.gameState.phase !== 'vakhaai_check') {
        clearInterval(countdownInterval);
        return;
      }

      currentRoom.gameState.vakhaaiCountdown = (currentRoom.gameState.vakhaaiCountdown || 0) - 1;
      io.to(roomCode).emit('gameState', currentRoom.gameState);

      if (currentRoom.gameState.vakhaaiCountdown <= 0) {
        clearInterval(countdownInterval);
        vakhaaiTimers.delete(roomCode);
        
        // Auto-end vakhaai phase
        currentRoom.gameState.phase = 'choosing_hukum';
        currentRoom.gameState.vakhaaiCountdown = undefined;
        gameEngine.setTargetTricks(currentRoom.gameState);
        io.to(roomCode).emit('gameState', currentRoom.gameState);
      }
    }, 1000);

    vakhaaiTimers.set(roomCode, countdownInterval as any);
    console.log(`Vakhaai called: ${bet} kalya by ${player.name}`);
  });

  socket.on('skipVakhaai', (roomCode: string) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState.phase !== 'vakhaai_check') return;

    // If no vakhaai has been called yet, and all players skip, end phase
    if (!room.gameState.vakhaaiCall) {
      room.gameState.phase = 'choosing_hukum';
      gameEngine.setTargetTricks(room.gameState);
      io.to(roomCode).emit('gameState', room.gameState);
      console.log('All players skipped vakhaai');
    }
    // If vakhaai is active, skip doesn't reset timer, just acknowledge
    console.log(`Player skipped vakhaai in room ${roomCode}`);
  });

  socket.on('chooseHukum', ({ roomCode, suit }: { roomCode: string; suit: Suit }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState.phase !== 'choosing_hukum') return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    // Only the designated hukum caller can choose
    if (player.position !== room.gameState.hukumCaller) {
      socket.emit('error', 'You are not the hukum caller');
      return;
    }

    room.gameState.hukum = suit;
    room.gameState.phase = 'dealing_second';

    // Deal remaining 4 cards to each player using the same deck from round start
    gameEngine.dealSecondCards(room.currentDeck, room.gameState.players);

    room.gameState.phase = 'playing';
    // Hukum caller plays first
    room.gameState.currentPlayer = room.gameState.hukumCaller!;

    io.to(roomCode).emit('gameState', room.gameState);
    console.log(`Hukum chosen: ${suit}`);
  });

  socket.on('playCard', ({ roomCode, cardId }: { roomCode: string; cardId: string }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState.phase !== 'playing') return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.position !== room.gameState.currentPlayer) return;

    const success = gameEngine.playCard(room.gameState, socket.id, cardId);
    if (!success) {
      socket.emit('error', 'Invalid card play');
      return;
    }

    // Move to next player
    if (room.gameState.currentTrick.length < 4) {
      room.gameState.currentPlayer = (room.gameState.currentPlayer + 1) % 4;
    } else {
      // Trick complete, resolve it
      gameEngine.resolveTrick(room.gameState);

      // Check if round is over
      if (gameEngine.checkRoundEnd(room.gameState)) {
        room.gameState.phase = 'round_end';
        io.to(roomCode).emit('gameState', room.gameState);
        
        // Auto-start next round after 3 seconds
        setTimeout(() => {
          gameEngine.resetForNextRound(room.gameState);
          
          // Always deal new deck at start of each round
          gameEngine.dealNewDeck(room.gameState);
          startNewRound(room);
          
          io.to(roomCode).emit('gameState', room.gameState);
        }, 3000);
        return;
      }
    }

    io.to(roomCode).emit('gameState', room.gameState);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Handle player disconnect - remove from room
    for (const [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} deleted (empty)`);
        } else {
          io.to(roomCode).emit('playerLeft', room.gameState);
        }
        break;
      }
    }
  });
});

function startNewRound(room: Room) {
  const deck = gameEngine.shuffleDeck(gameEngine.createDeck());
  room.currentDeck = deck; // Store the deck for this round
  
  // Ensure players array is synchronized
  room.gameState.players = room.players;
  
  room.gameState.shufflingTeam = gameEngine.determineShufflingTeam(room.gameState);
  room.gameState.hukumCaller = gameEngine.determineHukumCaller(room.gameState);
  room.gameState.phase = 'dealing_first';
  
  // Deal first 4 cards
  gameEngine.dealFirstCards(deck, room.gameState.players);
  
  room.gameState.phase = 'vakhaai_check';
  console.log(`Round ${room.gameState.roundNumber} started in room ${room.code}`);
  console.log(`Shuffling team: ${room.gameState.shufflingTeam}, Hukum caller: Player ${room.gameState.hukumCaller}`);
}

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
