# Ladis Card Game

A 4-player partnership card game built with React, TypeScript, Node.js, and Socket.IO.

## Live Demo

- **Client**: [Deploy to Vercel](https://vercel.com/new)
- **Server**: [Deploy to Railway](https://railway.app/new)

## Game Rules

- **Players**: 4 players in 2 teams (Team 0: positions 0&2, Team 1: positions 1&3)
- **Deck**: 32 cards (7-8-9-10-J-Q-K-A in all 4 suits)
- **Objective**: Clear your team's kalya debt

### Kalya System (Debt Tracking)
- Both teams start at 0 kalyas
- Only one team has kalyas (debt) at a time
- Team with kalyas shuffles
- Shuffling team needs 4 tricks to win round → subtract 10 kalyas
- Non-shuffling team needs 5 tricks to win round → add 5 kalyas to their account
- 32 kalyas = 1 laddo
- Kalyas are always positive (deficit)

### Vakhaai (Solo Betting)
- After first 4 cards dealt, any player can call vakhaai
- Bet amounts: 4, 8, 16, or 32 kalyas
- Must reach team's target (4 or 5 tricks) to win
- Win: subtract bet from calling team's kalyas
- Lose: add 2x bet to calling team's kalyas

### Game Flow
1. **First 4 cards** dealt to each player
2. **Vakhaai check** - any player can bet or skip
3. **Hukum selection** - one player from non-shuffling team chooses trump (alternates each round)
4. **Remaining 4 cards** dealt
5. **Play 8 hands** - hukum caller plays first, then clockwise
6. **Round ends** when team reaches target (4 or 5 tricks)
7. **Continuous play** - players keep remaining cards, play next round
8. **New deck** dealt only when all cards exhausted

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
