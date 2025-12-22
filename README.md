# Ladis Card Game

A 4-player partnership card game built with React, TypeScript, Node.js, and Socket.IO.

## Game Rules

- **Players**: 4 players in 2 teams (Team 0: positions 0&2, Team 1: positions 1&3)
- **Deck**: 32 cards (7-8-9-10-J-Q-K-A in all 4 suits)
- **Objective**: Reduce your team's kalya deficit

### Kalya System
- Start at 0 kalyas
- Shuffling team needs 4 hands to win round (subtract 10 kalyas)
- Non-shuffling team needs 5 hands to win round (add 5 kalyas to opponent)
- 32 kalyas = 1 laddo
- Negative kalyas = good, positive = bad (deficit tracking)

### Vakhaai (Solo Betting)
- After first 4 cards dealt, any player can call vakhaai
- Bet amounts: 4, 8, 16, or 32 kalyas
- Must win all 8 hands to succeed
- Win: subtract bet from team's kalyas
- Lose: add 2x bet to team's kalyas

### Deal Flow
1. First 4 cards dealt to each player
2. Vakhaai check (all players can call or skip)
3. Choose hukum (trump suit)
4. Deal remaining 4 cards
5. Play 8 hands

## Setup

### Install Dependencies
```bash
npm run install-all
```

### Run Locally
```bash
# Terminal 1 - Server (port 3003)
npm run server

# Terminal 2 - Client (port 5173)
npm run client
```

Open 4 browser windows to `http://localhost:5173` to test with 4 players.

## Deployment

### Server (Railway)
1. Create new project on Railway
2. Connect GitHub repo
3. Set Root Directory: `server`
4. Environment Variables:
   - `PORT`: 8080
5. Deploy

### Client (Vercel)
1. Import project from GitHub
2. Framework Preset: Vite
3. Root Directory: `client`
4. Environment Variables:
   - `VITE_SERVER_URL`: your Railway URL
5. Deploy

### Update CORS
After deploying client, update `server/src/index.ts`:
```typescript
origin: ['http://localhost:5173', 'https://your-vercel-domain.vercel.app']
```

## Tech Stack
- Frontend: React 18, TypeScript, Vite, Socket.IO Client
- Backend: Node.js 20, TypeScript, Express, Socket.IO
- Deployment: Railway (server), Vercel (client)
