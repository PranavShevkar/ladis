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
      // Clear timer if exists
      const existingTimer = vakhaaiTimers.get(roomCode);
      if (existingTimer) {
        clearInterval(existingTimer);
        vakhaaiTimers.delete(roomCode);
      }
      // Activate vakhaai mode
      activateVakhaaiMode(room);
      io.to(roomCode).emit('gameState', room.gameState);
      console.log(`Vakhaai called: ${bet} points by ${player.name} - Max bet, activating vakhaai mode`);
      return;
    }

    // Check if timer already exists (this is not the first action)
    const existingTimer = vakhaaiTimers.get(roomCode);
    if (existingTimer) {
      // Clear and restart timer since this is a higher bet
      clearInterval(existingTimer);
      console.log(`Higher vakhaai bet: ${bet} points by ${player.name} - Resetting timer`);
    } else {
      console.log(`First vakhaai bet: ${bet} points by ${player.name} - Starting timer`);
    }

    // Start/restart 5-second countdown
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
        
        // Check if there's a real vakhaai bet (bet > 0)
        if (currentRoom.gameState.vakhaaiCall && currentRoom.gameState.vakhaaiCall.bet > 0) {
          // Activate vakhaai mode after countdown
          activateVakhaaiMode(currentRoom);
          console.log('Vakhaai timer ended - Activating vakhaai mode');
        } else {
          // No real vakhaai bet, proceed to hukum phase
          currentRoom.gameState.phase = 'choosing_hukum';
          gameEngine.setTargetTricks(currentRoom.gameState);
          console.log('Vakhaai timer ended - No bet, proceeding to hukum phase');
        }
        io.to(roomCode).emit('gameState', currentRoom.gameState);
      }
    }, 1000);

    vakhaaiTimers.set(roomCode, countdownInterval as any);
  });

  socket.on('skipVakhaai', (roomCode: string) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState.phase !== 'vakhaai_check') return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    // Check if timer already exists
    const existingTimer = vakhaaiTimers.get(roomCode);
    
    if (!existingTimer) {
      // This is the first action - start the timer without setting a bet
      console.log(`Player ${player.name} skipped vakhaai - Starting 5 second timer`);
      
      room.gameState.vakhaaiCountdown = 5;
      io.to(roomCode).emit('gameState', room.gameState);

      // Start countdown
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
          
          // Check if there's a real vakhaai bet (bet > 0)
          if (currentRoom.gameState.vakhaaiCall && currentRoom.gameState.vakhaaiCall.bet > 0) {
            // Activate vakhaai mode after countdown
            activateVakhaaiMode(currentRoom);
            console.log('Vakhaai timer ended - Activating vakhaai mode');
          } else {
            // No real vakhaai bet, proceed to hukum phase
            currentRoom.gameState.phase = 'choosing_hukum';
            gameEngine.setTargetTricks(currentRoom.gameState);
            console.log('Vakhaai timer ended - No bet, proceeding to hukum phase');
          }
          io.to(roomCode).emit('gameState', currentRoom.gameState);
        }
      }, 1000);

      vakhaaiTimers.set(roomCode, countdownInterval as any);
    } else {
      // Timer already running, just acknowledge skip without resetting
      console.log(`Player ${player.name} skipped - Timer continues`);
    }
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

    // Determine expected cards per trick
    const expectedCardsPerTrick = room.gameState.benchedPlayerId ? 3 : 4;

    // Move to next player or resolve trick
    if (room.gameState.currentTrick.length < expectedCardsPerTrick) {
      // Skip benched player if in vakhaai mode
      let nextPlayer = (room.gameState.currentPlayer + 1) % 4;
      if (room.gameState.benchedPlayerId) {
        const benchedPlayer = room.players.find(p => p.id === room.gameState.benchedPlayerId);
        // Keep incrementing until we find a non-benched player
        while (benchedPlayer && room.players[nextPlayer].id === room.gameState.benchedPlayerId) {
          nextPlayer = (nextPlayer + 1) % 4;
        }
      }
      room.gameState.currentPlayer = nextPlayer;
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

function activateVakhaaiMode(room: Room) {
  if (!room.gameState.vakhaaiCall) return;

  const callerId = room.gameState.vakhaaiCall.playerId;
  const caller = room.players.find(p => p.id === callerId);
  if (!caller) return;

  // Find teammate (same team, different position)
  const teammate = room.players.find(p => 
    p.team === caller.team && p.id !== callerId
  );

  if (teammate) {
    room.gameState.benchedPlayerId = teammate.id;
  }

  // Skip hukum phase, no second dealing
  // Set target tricks to 4 for vakhaai
  room.gameState.targetTricks.team0 = 4;
  room.gameState.targetTricks.team1 = 4;
  
  // Start playing phase with vakhaai caller
  room.gameState.phase = 'playing';
  room.gameState.currentPlayer = caller.position;
  room.gameState.vakhaaiCountdown = undefined;
  room.gameState.hukum = null; // No hukum in vakhaai
  
  console.log(`Vakhaai activated: ${caller.name} vs opposing team, teammate ${teammate?.name} benched`);
}

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
