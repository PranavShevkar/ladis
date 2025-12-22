import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, Suit, Card } from './types';
import './App.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3003';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [error, setError] = useState('');
  const [vakhaaiChoice, setVakhaaiChoice] = useState<4 | 8 | 16 | 32 | null>(null);

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);
    setMyPlayerId(newSocket.id || '');

    newSocket.on('connect', () => {
      setMyPlayerId(newSocket.id || '');
      console.log('Connected to server');
    });

    newSocket.on('roomCreated', ({ roomCode, gameState: gs }: { roomCode: string; gameState: GameState }) => {
      setRoomCode(roomCode);
      setGameState(gs);
      setError('');
    });

    newSocket.on('playerJoined', (gs: GameState) => {
      setGameState(gs);
    });

    newSocket.on('gameState', (gs: GameState) => {
      setGameState(gs);
    });

    newSocket.on('error', (msg: string) => {
      setError(msg);
    });

    newSocket.on('playerLeft', (gs: GameState) => {
      setGameState(gs);
      setError('A player left the game');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleCreateRoom = () => {
    if (playerName && socket) {
      socket.emit('createRoom', playerName);
    }
  };

  const handleJoinRoom = () => {
    if (playerName && roomCode && socket) {
      socket.emit('joinRoom', { roomCode: roomCode.toUpperCase(), playerName });
    }
  };

  const handleVakhaaiCall = (bet: 4 | 8 | 16 | 32) => {
    if (socket && roomCode) {
      socket.emit('vakhaaiCall', { roomCode, bet });
      setVakhaaiChoice(null);
    }
  };

  const handleSkipVakhaai = () => {
    if (socket && roomCode) {
      socket.emit('skipVakhaai', roomCode);
      setVakhaaiChoice(null);
    }
  };

  const handleChooseHukum = (suit: Suit) => {
    if (socket && roomCode) {
      socket.emit('chooseHukum', { roomCode, suit });
    }
  };

  const handlePlayCard = (cardId: string) => {
    if (socket && roomCode) {
      socket.emit('playCard', { roomCode, cardId });
    }
  };

  const getMyPlayer = () => {
    return gameState?.players.find((p) => p.id === myPlayerId);
  };

  const getPlayerByPosition = (position: number) => {
    return gameState?.players.find((p) => p.position === position);
  };

  const isMyTurn = () => {
    const myPlayer = getMyPlayer();
    return myPlayer && gameState?.currentPlayer === myPlayer.position;
  };

  const renderCard = (card: Card, onClick?: () => void, className = '') => {
    const isRed = card.suit === '♥' || card.suit === '♦';
    return (
      <div
        className={`card ${isRed ? 'red' : 'black'} ${className}`}
        onClick={onClick}
      >
        <div className="card-rank">{card.rank}</div>
        <div className="card-suit">{card.suit}</div>
      </div>
    );
  };

  const renderFaceDownCard = () => {
    return <div className="card face-down">🎴</div>;
  };

  if (!gameState) {
    return (
      <div className="container">
        <h1>Ladis Card Game</h1>
        {error && <div className="error">{error}</div>}
        <div className="lobby">
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <div className="buttons">
            <button onClick={handleCreateRoom}>Create Room</button>
            <div className="join-room">
              <input
                type="text"
                placeholder="Room Code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
              />
              <button onClick={handleJoinRoom}>Join Room</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const myPlayer = getMyPlayer();
  if (!myPlayer) {
    // Player not found yet, show waiting screen
    return (
      <div className="container">
        <h1>Ladis Card Game</h1>
        <div className="room-info">
          Room: <strong>{roomCode}</strong>
        </div>
        <div className="game-info">
          <p>Waiting for players to join... ({gameState.players.length}/4)</p>
          {gameState.players.map((p) => (
            <div key={p.id}>{p.name} - Position {p.position} - Team {p.team}</div>
          ))}
        </div>
      </div>
    );
  }

  const myTeam = myPlayer.team;
  const opponentTeam = myTeam === 0 ? 1 : 0;

  return (
    <div className="container">
      <h1>Ladis Card Game</h1>
      <div className="room-info">
        Room: <strong>{roomCode}</strong> | Round: <strong>{gameState.roundNumber}</strong>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Team Scores */}
      <div className="team-scores">
        <div className={`team-score ${myTeam === 0 ? 'my-team' : ''}`}>
          <h3>Team 0 {myTeam === 0 && '(You)'}</h3>
          <div>Kalyas: <strong>{gameState.teamScores.team0.kalyas}</strong></div>
          <div>Laddos: <strong>{gameState.teamScores.team0.laddos}</strong></div>
          <div>Tricks: <strong>{gameState.tricks.team0}/{gameState.targetTricks.team0}</strong></div>
          {gameState.shufflingTeam === 0 && <div className="shuffling">🎴 Shuffling</div>}
        </div>
        <div className={`team-score ${myTeam === 1 ? 'my-team' : ''}`}>
          <h3>Team 1 {myTeam === 1 && '(You)'}</h3>
          <div>Kalyas: <strong>{gameState.teamScores.team1.kalyas}</strong></div>
          <div>Laddos: <strong>{gameState.teamScores.team1.laddos}</strong></div>
          <div>Tricks: <strong>{gameState.tricks.team1}/{gameState.targetTricks.team1}</strong></div>
          {gameState.shufflingTeam === 1 && <div className="shuffling">🎴 Shuffling</div>}
        </div>
      </div>

      {/* Game Phase Info */}
      <div className="game-info">
        {gameState.hukum && <div>Hukum (Trump): <strong className="hukum">{gameState.hukum}</strong></div>}
        {gameState.vakhaaiCall && (
          <div className="vakhaai-info">
            Vakhaai: <strong>{gameState.vakhaaiCall.bet} kalyas</strong> by {getPlayerByPosition(gameState.vakhaaiCall.playerPosition)?.name}
          </div>
        )}
        <div>Phase: <strong>{gameState.phase}</strong></div>
        {gameState.phase === 'playing' && (
          <div>
            Current: <strong>{getPlayerByPosition(gameState.currentPlayer)?.name}</strong>
            {isMyTurn() && <span className="your-turn"> - YOUR TURN</span>}
          </div>
        )}
      </div>

      {/* Vakhaai Phase */}
      {gameState.phase === 'vakhaai_check' && (
        <div className="vakhaai-section">
          <h3>Vakhaai Check</h3>
          <p>Do you want to call Vakhaai?</p>
          <div className="vakhaai-buttons">
            <button onClick={() => handleVakhaaiCall(4)}>4 Kalyas</button>
            <button onClick={() => handleVakhaaiCall(8)}>8 Kalyas</button>
            <button onClick={() => handleVakhaaiCall(16)}>16 Kalyas</button>
            <button onClick={() => handleVakhaaiCall(32)}>32 Kalyas</button>
            <button onClick={handleSkipVakhaai} className="skip">Skip</button>
          </div>
        </div>
      )}

      {/* Hukum Selection */}
      {gameState.phase === 'choosing_hukum' && (
        <div className="hukum-section">
          <h3>Choose Hukum (Trump)</h3>
          {myPlayer.position === gameState.hukumCaller ? (
            <>
              <p>You choose the hukum (trump suit)</p>
              <div className="suit-buttons">
                <button onClick={() => handleChooseHukum('♥')} className="red">♥ Hearts</button>
                <button onClick={() => handleChooseHukum('♦')} className="red">♦ Diamonds</button>
                <button onClick={() => handleChooseHukum('♣')}>♣ Clubs</button>
                <button onClick={() => handleChooseHukum('♠')}>♠ Spades</button>
              </div>
            </>
          ) : (
            <p>Waiting for {getPlayerByPosition(gameState.hukumCaller!)?.name} to choose hukum...</p>
          )}
        </div>
      )}

      {/* Current Trick */}
      {gameState.currentTrick.length > 0 && (
        <div className="current-trick">
          <h3>Current Trick</h3>
          <div className="trick-cards">
            {gameState.currentTrick.map((tc, index) => {
              const player = gameState.players.find((p) => p.id === tc.playerId);
              return (
                <div key={index} className="trick-card">
                  <div className="trick-player">{player?.name}</div>
                  {renderCard(tc.card)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Round End */}
      {gameState.phase === 'round_end' && (
        <div className="round-end">
          <h2>Round Over!</h2>
          <p>Starting next round...</p>
        </div>
      )}

      {/* Player Grid (4 players) */}
      <div className="player-grid">
        {/* Top Player (position 2) */}
        {getPlayerByPosition(2) && (
          <div className="player-slot top">
            <div className="player-name">
              {getPlayerByPosition(2)?.name}
              {Math.abs(getPlayerByPosition(2)!.position - myPlayer.position) === 2 && ' (Partner)'}
            </div>
            <div className="hand">
              {Array(getPlayerByPosition(2)?.hand.length || 0).fill(0).map((_, i) => (
                <div key={i}>{renderFaceDownCard()}</div>
              ))}
            </div>
          </div>
        )}

        {/* Left Player (position 1) */}
        {getPlayerByPosition(1) && (
          <div className="player-slot left">
            <div className="player-name">
              {getPlayerByPosition(1)?.name}
              {Math.abs(getPlayerByPosition(1)!.position - myPlayer.position) === 2 && ' (Partner)'}
            </div>
            <div className="hand vertical">
              {Array(getPlayerByPosition(1)?.hand.length || 0).fill(0).map((_, i) => (
                <div key={i}>{renderFaceDownCard()}</div>
              ))}
            </div>
          </div>
        )}

        {/* Right Player (position 3) */}
        {getPlayerByPosition(3) && (
          <div className="player-slot right">
            <div className="player-name">
              {getPlayerByPosition(3)?.name}
              {Math.abs(getPlayerByPosition(3)!.position - myPlayer.position) === 2 && ' (Partner)'}
            </div>
            <div className="hand vertical">
              {Array(getPlayerByPosition(3)?.hand.length || 0).fill(0).map((_, i) => (
                <div key={i}>{renderFaceDownCard()}</div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Player (Me - position 0) */}
        <div className="player-slot bottom">
          <div className="player-name">{myPlayer.name} (You)</div>
          <div className="hand">
            {myPlayer.hand.map((card) =>
              renderCard(
                card,
                gameState.phase === 'playing' && isMyTurn()
                  ? () => handlePlayCard(card.id)
                  : undefined,
                isMyTurn() ? 'playable' : ''
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
