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
  const [showRules, setShowRules] = useState(false);

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
      console.log('GameState received:', gs);
      console.log('Players array:', gs.players);
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
    }
  };

  const handleSkipVakhaai = () => {
    if (socket && roomCode) {
      socket.emit('skipVakhaai', roomCode);
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
  
  // Show waiting screen if not all players have joined
  if (!myPlayer || gameState.players.length < 4) {
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

  // Calculate relative positions for player grid
  // Player should always see themselves at bottom
  // Other players arranged clockwise: top, left, right
  const getRelativePosition = (offset: number) => {
    return (myPlayer.position + offset) % 4;
  };

  const topPlayerPosition = getRelativePosition(2);    // Opposite player (partner)
  const leftPlayerPosition = getRelativePosition(1);   // Next player clockwise
  const rightPlayerPosition = getRelativePosition(3);  // Previous player (or +3 same as -1)

  return (
    <div className="container">
      <h1>Ladis Card Game</h1>
      <div className="room-info">
        Room: <strong>{roomCode}</strong> | Round: <strong>{gameState.roundNumber}</strong>
        <button className="info-button" onClick={() => setShowRules(true)} title="Game Rules">ℹ️</button>
      </div>

      {/* Rules Modal */}
      {showRules && (
        <div className="modal-overlay" onClick={() => setShowRules(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowRules(false)}>×</button>
            <h2>Game Rules</h2>
            <div className="rules-content">
              <h3>Players & Objective</h3>
              <ul>
                <li>4 players in 2 teams (Team 0: positions 0&2, Team 1: positions 1&3)</li>
                <li>32-card deck (7-8-9-10-J-Q-K-A in all 4 suits)</li>
                <li>Goal: Clear your team's points debt</li>
              </ul>

              <h3>Points System</h3>
              <ul>
                <li>Both teams start at 0 points</li>
                <li>Team with more points shuffles</li>
                <li>Shuffling team needs 4 tricks to win → subtract 10 points</li>
                <li>Non-shuffling team needs 5 tricks → add 5 points to shuffling team</li>
                <li>32 points = 1 laddo</li>
              </ul>

              <h3>Vakhaai (Betting)</h3>
              <ul>
                <li>After first 4 cards dealt, players can bet: 4, 8, 16, or 32 points, or skip</li>
                <li>First action (bet or skip) starts 5-second countdown</li>
                <li>Timer resets only on higher bids (not on skip)</li>
                <li>Caller plays alone against opposing team (teammate benched with face-up cards)</li>
                <li>Hukum phase skipped - caller plays first</li>
                <li>Caller must win ALL 4 tricks to win the bet</li>
                <li>Win: subtract bet from calling team's points</li>
                <li>Lose (even 1 trick lost): add 2x bet to calling team's points</li>
              </ul>

              <h3>Game Flow</h3>
              <ol>
                <li>First 4 cards dealt to each player</li>
                <li>Vakhaai betting phase (optional)</li>
                <li>Non-shuffling team player chooses Hukum (trump)</li>
                <li>Remaining 4 cards dealt</li>
                <li>Players play 8 tricks</li>
                <li>Round ends, scores update, next round begins</li>
              </ol>

              <h3>Playing Tricks</h3>
              <ul>
                <li>Must follow lead suit if possible</li>
                <li>Hukum (trump) beats all other suits</li>
                <li>Highest card of lead suit wins (if no hukum played)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {/* Team Scores */}
      <div className="team-scores">
        <div className={`team-score ${myTeam === 0 ? 'my-team' : ''}`}>
          <h3>Team 0 {myTeam === 0 && '(You)'}</h3>
          <div>Kalyas: <strong>{gameState.teamScores.team0.points % 32}</strong></div>
          <div>Laddos: <strong>{gameState.teamScores.team0.laddos}</strong></div>
          <div>Tricks: <strong>{gameState.tricks.team0}/{gameState.targetTricks.team0}</strong></div>
          {gameState.shufflingTeam === 0 && <div className="shuffling">🎴 Shuffling</div>}
        </div>
        <div className={`team-score ${myTeam === 1 ? 'my-team' : ''}`}>
          <h3>Team 1 {myTeam === 1 && '(You)'}</h3>
          <div>Kalyas: <strong>{gameState.teamScores.team1.points % 32}</strong></div>
          <div>Laddos: <strong>{gameState.teamScores.team1.laddos}</strong></div>
          <div>Tricks: <strong>{gameState.tricks.team1}/{gameState.targetTricks.team1}</strong></div>
          {gameState.shufflingTeam === 1 && <div className="shuffling">🎴 Shuffling</div>}
        </div>
      </div>

      {/* Game Phase Info */}
      <div className="game-info">
        {gameState.benchedPlayerId && gameState.vakhaaiCall && (
          <div className="vakhaai-active-banner">
            ⚔️ VAKHAAI ACTIVE: {getPlayerByPosition(gameState.vakhaaiCall.playerPosition)?.name} vs Team {getPlayerByPosition(gameState.vakhaaiCall.playerPosition)?.team === 0 ? 1 : 0}
          </div>
        )}
        {gameState.hukum && <div>Hukum (Trump): <strong className="hukum">{gameState.hukum}</strong></div>}
        {gameState.vakhaaiCall && !gameState.benchedPlayerId && (
          <div className="vakhaai-info">
            Vakhaai: <strong>{gameState.vakhaaiCall.bet} points</strong> by {getPlayerByPosition(gameState.vakhaaiCall.playerPosition)?.name}
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
          {gameState.vakhaaiCountdown !== undefined ? (
            <>
              <div className="vakhaai-active">
                {gameState.vakhaaiCall ? (
                  <p>
                    <strong>Vakhaai: {gameState.vakhaaiCall.bet} kalya</strong> by {getPlayerByPosition(gameState.vakhaaiCall.playerPosition)?.name}
                  </p>
                ) : (
                  <p>Vakhaai skipped</p>
                )}
                <p className="countdown">
                  Call another value in <strong>{gameState.vakhaaiCountdown}</strong> seconds
                </p>
              </div>
              <div className="vakhaai-buttons">
                <button 
                  onClick={() => handleVakhaaiCall(4)} 
                  disabled={gameState.vakhaaiCall ? 4 <= gameState.vakhaaiCall.bet : false}
                >
                  4 Kalya
                </button>
                <button 
                  onClick={() => handleVakhaaiCall(8)} 
                  disabled={gameState.vakhaaiCall ? 8 <= gameState.vakhaaiCall.bet : false}
                >
                  8 Kalya
                </button>
                <button 
                  onClick={() => handleVakhaaiCall(16)} 
                  disabled={gameState.vakhaaiCall ? 16 <= gameState.vakhaaiCall.bet : false}
                >
                  16 Kalya
                </button>
                <button 
                  onClick={() => handleVakhaaiCall(32)} 
                  disabled={gameState.vakhaaiCall ? 32 <= gameState.vakhaaiCall.bet : false}
                >
                  32 Kalya
                </button>
                <button onClick={handleSkipVakhaai} className="skip">Skip</button>
              </div>
            </>
          ) : (
            <>
              <p>Do you want to call Vakhaai?</p>
              <div className="vakhaai-buttons">
                <button onClick={() => handleVakhaaiCall(4)}>4 Kalya</button>
                <button onClick={() => handleVakhaaiCall(8)}>8 Kalya</button>
                <button onClick={() => handleVakhaaiCall(16)}>16 Kalya</button>
                <button onClick={() => handleVakhaaiCall(32)}>32 Kalya</button>
                <button onClick={handleSkipVakhaai} className="skip">Skip</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hukum Selection */}
      {gameState.phase === 'choosing_hukum' && !gameState.benchedPlayerId && (
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
        {/* Top Player (partner) */}
        {getPlayerByPosition(topPlayerPosition) && (
          <div className="player-slot top">
            <div className="player-name">
              {getPlayerByPosition(topPlayerPosition)?.name}
              {Math.abs(getPlayerByPosition(topPlayerPosition)!.position - myPlayer.position) === 2 && ' (Partner)'}
              {getPlayerByPosition(topPlayerPosition)?.id === gameState.benchedPlayerId && ' (BENCHED)'}
            </div>
            <div className="hand">
              {getPlayerByPosition(topPlayerPosition)?.id === gameState.benchedPlayerId
                ? getPlayerByPosition(topPlayerPosition)?.hand.map((card) => renderCard(card))
                : Array(getPlayerByPosition(topPlayerPosition)?.hand.length || 0).fill(0).map((_, i) => (
                    <div key={`p${topPlayerPosition}-card-${i}`}>{renderFaceDownCard()}</div>
                  ))
              }
            </div>
          </div>
        )}

        {/* Left Player (next clockwise) */}
        {getPlayerByPosition(leftPlayerPosition) && (
          <div className="player-slot left">
            <div className="player-name">
              {getPlayerByPosition(leftPlayerPosition)?.name}
              {Math.abs(getPlayerByPosition(leftPlayerPosition)!.position - myPlayer.position) === 2 && ' (Partner)'}
              {getPlayerByPosition(leftPlayerPosition)?.id === gameState.benchedPlayerId && ' (BENCHED)'}
            </div>
            <div className="hand vertical">
              {getPlayerByPosition(leftPlayerPosition)?.id === gameState.benchedPlayerId
                ? getPlayerByPosition(leftPlayerPosition)?.hand.map((card) => renderCard(card))
                : Array(getPlayerByPosition(leftPlayerPosition)?.hand.length || 0).fill(0).map((_, i) => (
                    <div key={`p${leftPlayerPosition}-card-${i}`}>{renderFaceDownCard()}</div>
                  ))
              }
            </div>
          </div>
        )}

        {/* Right Player (previous/+3) */}
        {getPlayerByPosition(rightPlayerPosition) && (
          <div className="player-slot right">
            <div className="player-name">
              {getPlayerByPosition(rightPlayerPosition)?.name}
              {Math.abs(getPlayerByPosition(rightPlayerPosition)!.position - myPlayer.position) === 2 && ' (Partner)'}
              {getPlayerByPosition(rightPlayerPosition)?.id === gameState.benchedPlayerId && ' (BENCHED)'}
            </div>
            <div className="hand vertical">
              {getPlayerByPosition(rightPlayerPosition)?.id === gameState.benchedPlayerId
                ? getPlayerByPosition(rightPlayerPosition)?.hand.map((card) => renderCard(card))
                : Array(getPlayerByPosition(rightPlayerPosition)?.hand.length || 0).fill(0).map((_, i) => (
                    <div key={`p${rightPlayerPosition}-card-${i}`}>{renderFaceDownCard()}</div>
                  ))
              }
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
