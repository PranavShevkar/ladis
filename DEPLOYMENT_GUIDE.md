# Ladis Deployment Guide

## Prerequisites
- GitHub account
- Railway account (https://railway.app)
- Vercel account (https://vercel.com)

## Step 1: Create GitHub Repository

```bash
cd "/home/pranav/Personal Projects/ladis"
git remote add origin https://github.com/PranavShevkar/ladis.git
git push -u origin main
```

Or create manually at: https://github.com/new

## Step 2: Deploy Server to Railway

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your `ladis` repository
4. Configure deployment:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

5. Add Environment Variables:
   - Click on your service → Variables
   - Add: `PORT` = `8080`

6. Configure Networking:
   - Click on Settings → Networking
   - Click "Generate Domain"
   - Note your Railway URL (e.g., `https://ladis-production.up.railway.app`)

## Step 3: Deploy Client to Vercel

1. Go to https://vercel.com/new
2. Import your `ladis` repository
3. Configure deployment:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. Add Environment Variable:
   - Click on Settings → Environment Variables
   - Add: `VITE_SERVER_URL` = `https://your-railway-url.up.railway.app`
   - (Use the Railway URL from Step 2)

5. Click "Deploy"
6. Note your Vercel URL (e.g., `https://ladis-client.vercel.app`)

## Step 4: Update CORS in Server

After deploying the client, update the server CORS configuration:

1. Edit `server/src/index.ts` line 19:
```typescript
origin: ['http://localhost:5173', 'https://ladis-client.vercel.app'],
```

2. Replace `https://ladis-client.vercel.app` with your actual Vercel URL

3. Commit and push:
```bash
git add server/src/index.ts
git commit -m "Update CORS for production"
git push
```

4. Railway will auto-redeploy with the new CORS settings

## Step 5: Test Production Deployment

Visit your Vercel URL and test:
1. Create a room with 4 players
2. Test vakhaai betting
3. Test hukum selection
4. Play through multiple rounds
5. Verify kalya/laddo scoring

## Live URLs

- **Client**: https://your-vercel-url.vercel.app
- **Server**: https://your-railway-url.up.railway.app

## Troubleshooting

### Server won't start on Railway
- Check that PORT environment variable is set to 8080
- Check build logs for errors
- Verify Root Directory is set to `server`

### Client can't connect to server
- Check VITE_SERVER_URL environment variable in Vercel
- Verify CORS settings include your Vercel domain
- Check Railway logs for connection errors

### CORS errors
- Make sure server CORS includes your Vercel domain
- Redeploy server after updating CORS
- Clear browser cache

## Environment Variables Summary

### Railway (Server)
```
PORT=8080
```

### Vercel (Client)
```
VITE_SERVER_URL=https://your-railway-url.up.railway.app
```
