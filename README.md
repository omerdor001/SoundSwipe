# 🎵 SoundSwipe

A Tinder-style music discovery app powered by the **MusicBrainz API** — an open, free music encyclopedia with millions of recordings. Swipe right to save songs, left to skip. Every user has their own account and playlist.

---

## 🗂 Project Structure

```
soundswipe/
├── backend/
│   ├── prisma/schema.prisma        ← PostgreSQL schema
│   └── src/
│       ├── index.js                ← Express entry point
│       ├── middleware/auth.js      ← JWT auth middleware
│       ├── services/
│       │   └── musicbrainz.js      ← MusicBrainz API wrapper + normalizer
│       └── routes/
│           ├── auth.js             ← POST /api/auth/login|signup
│           ├── songs.js            ← GET  /api/songs  (live from MusicBrainz)
│           ├── swipes.js           ← POST /api/swipes
│           └── playlist.js         ← GET/DELETE /api/playlist
│
└── frontend/
    └── src/
        ├── api/client.js           ← All fetch calls
        ├── store/useStore.js       ← Zustand state
        ├── pages/
        │   ├── LoginScreen.jsx
        │   └── MainApp.jsx
        └── components/
            ├── SwipeView.jsx       ← Swipe cards + search + genre filter
            ├── SongCard.jsx
            ├── PlaylistView.jsx
            ├── MiniPlayer.jsx
            └── InfoModal.jsx
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (local or [Supabase](https://supabase.com) free tier)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # fill in DATABASE_URL and JWT_SECRET
npx prisma generate
npx prisma migrate dev --name init
npm run dev                  # starts on :3001
```

> **No seed script needed** — songs are fetched live from MusicBrainz!

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                  # starts on :3000, proxies /api → :3001
```

---

## 🎵 How MusicBrainz Integration Works

Songs are **never pre-loaded** into the database. Instead:

1. When a user opens the Discover tab, the backend queries `musicbrainz.org/ws/2/recording` for a random genre.
2. Results are **normalized** (title, artist, duration, genre tag → emoji + gradient colors).
3. Songs the user has already swiped are filtered out server-side.
4. When a user swipes (either direction), the song is **upserted** into our DB so it can be referenced in swipe and playlist records.
5. Responses are **cached for 10 minutes** per query to respect MusicBrainz's rate limit (1 req/sec).

### MusicBrainz API details
- Base URL: `https://musicbrainz.org/ws/2/`
- **No API key required** — just a `User-Agent` header
- Rate limit: **1 request/second** (handled in `musicbrainz.js`)
- Format: `?fmt=json` for JSON responses
- Key endpoint used: `/recording?query=tag:pop&inc=tags+artist-credits&fmt=json`

---

## 📡 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | — | Create account |
| POST | `/api/auth/login` | — | Sign in, get JWT |
| GET | `/api/auth/me` | ✅ | Verify token |
| GET | `/api/songs` | ✅ | Discovery queue from MusicBrainz |
| GET | `/api/songs?genre=rock` | ✅ | Filter by genre tag |
| GET | `/api/songs?search=radiohead` | ✅ | Filter by artist/title |
| GET | `/api/songs/search?q=...` | ✅ | Dedicated search |
| GET | `/api/songs/genres` | ✅ | List available genres |
| POST | `/api/swipes` | ✅ | Record swipe `{ song, direction }` |
| POST | `/api/swipes/reset` | ✅ | Clear all swipes |
| GET | `/api/playlist` | ✅ | Get liked songs |
| DELETE | `/api/playlist/:songId` | ✅ | Remove from playlist |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Music data | **MusicBrainz Open API** (free, no key) |
| Frontend | React 18, Vite, Zustand, CSS Modules |
| Backend | Node.js, Express |
| Auth | JWT + bcryptjs |
| Database | PostgreSQL via Prisma ORM |
