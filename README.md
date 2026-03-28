# SoundSwipe

A Tinder-style music discovery app. Swipe right to save songs, left to skip. Features **Content-Based Filtering** (CBF) recommendations using Last.fm audio features.

---

## Project Structure

```
soundswipe/
├── backend/
│   ├── prisma/schema.prisma        ← PostgreSQL schema
│   └── src/
│       ├── index.js                ← Express entry point
│       ├── middleware/auth.js      ← Auth middleware (Bearer + cookies)
│       ├── handlers/               ← Request handlers
│       ├── services/               ← Business logic
│       ├── repositories/           ← Database access
│       └── routes/                ← API routes
│
├── frontend/                       ← Web app (Vite + React)
│   └── src/
│
└── mobile/                        ← React Native app (Expo)
    └── src/
        ├── screens/               ← LoginScreen, SwipeScreen, PlaylistScreen
        ├── components/            ← SwipeCard, PlatformModal
        └── context/              ← AuthContext
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (local or [Supabase](https://supabase.com) free tier)
- Expo CLI (`npm install -g expo-cli`)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, SPOTIFY_*, DEEZER_*, LASTFM_*
npx prisma generate
npx prisma migrate dev --name init
npm run dev                  # starts on :3001
```

### 2. Frontend (Web)

```bash
cd frontend
npm install
npm run dev                  # starts on :3000, proxies /api → :3001
```

### 3. Mobile App

```bash
cd mobile
npm install
npx expo start               # starts Expo dev server
```

For Android: Press `a` to run on Android emulator/device
For iOS: Press `i` to run on iOS simulator (Mac only)
For Web: Press `w` to run in browser

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | — | Create account |
| POST | `/api/auth/login` | — | Sign in, get JWT |
| GET | `/api/auth/me` | Bearer | Verify token |
| GET | `/api/auth/spotify` | — | Start Spotify OAuth |
| GET | `/api/auth/spotify/callback` | — | Spotify OAuth callback |
| GET | `/api/songs` | Bearer | Discovery queue |
| GET | `/api/songs?genre=rock` | Bearer | Filter by genre |
| GET | `/api/songs/search?q=...` | Bearer | Search songs |
| GET | `/api/songs/similar` | Bearer | CBF similar songs |
| POST | `/api/swipes` | Bearer | Record swipe `{ song, direction }` |
| POST | `/api/swipes/reset` | Bearer | Clear all swipes |
| GET | `/api/playlist` | Bearer | Get liked songs |
| DELETE | `/api/playlist/:songId` | Bearer | Remove from playlist |
| GET | `/api/preview` | Bearer | Get preview URL (Deezer/iTunes) |

---

## How It Works

### Music Discovery
- Songs fetched from **MusicBrainz** API
- Filtered by genre tags (Pop, Rock, Hip Hop, Electronic, Jazz, Metal, Country, R&B, Indie)
- Swiped songs saved to database

### Content-Based Filtering (CBF)
- Uses **Last.fm** to get top tags for liked songs
- Analyzes tag patterns to find similar songs
- "Similar" button fetches personalized recommendations

### Preview Playback
- Uses **Deezer** API for 30-second preview URLs
- Falls back to **iTunes** Search API if Deezer doesn't have preview

### Platform Links
- Playlist songs can be opened in: Spotify, Apple Music, YouTube Music, Tidal

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Music Data | MusicBrainz, Last.fm, Deezer, iTunes APIs |
| Frontend (Web) | React 18, Vite, Zustand, CSS Modules |
| Mobile App | React Native (Expo), expo-av |
| Backend | Node.js, Express, Prisma |
| Auth | JWT + bcryptjs, Spotify OAuth |
| Database | PostgreSQL via Prisma ORM |
