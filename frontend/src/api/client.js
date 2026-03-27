// src/api/client.js
const BASE = "/api";

function getAuthHeader() {
  const token = sessionStorage.getItem("ss_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...getAuthHeader(), ...options.headers };
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Auth ─────────────────────────────────────────────
export const authApi = {
  login:  (username, password) => request("/auth/login",  { method: "POST", body: { username, password } }),
  signup: (username, password) => request("/auth/signup", { method: "POST", body: { username, password } }),
  me:     () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
};

// ── Songs (live from MusicBrainz via our backend) ────
export const songsApi = {
  // Get discovery queue — optional ?genre=pop or ?search=radiohead
  getQueue:  (params = {}) => {
    params._t = Date.now();
    const qs = new URLSearchParams(params).toString();
    return request(`/songs?${qs}`);
  },
  // Dedicated search
  search:    (q, mode = 'artist') => request(`/songs/search?q=${encodeURIComponent(q)}&mode=${mode}`),
  clearCache: () => request('/songs/cache/clear', { method: 'POST' }),
  // Similar songs based on liked songs
  getSimilar: (limit = 20) => request(`/songs/similar?limit=${limit}`),
};

// ── Preview cache ─────────────────────────────────────
export const previewCacheApi = {
  clear: () => request('/preview/cache/clear', { method: 'POST' }),
  // Available genre tags
  getGenres: () => request("/songs/genres"),
};

// ── Swipes ───────────────────────────────────────────
// NOTE: we now send the full song object so the backend can upsert it
export const swipesApi = {
  swipe: (song, direction) =>
    request("/swipes", { method: "POST", body: { song, direction } }),
  reset: () => request("/swipes/reset", { method: "POST" }),
};

// ── Playlist ─────────────────────────────────────────
export const playlistApi = {
  get:    () => request("/playlist"),
  remove: (songId) => request(`/playlist/${songId}`, { method: "DELETE" }),
};

// ── Preview (Deezer 30s preview + cover art, fetched server-side) ──
export const previewApi = {
  get: (title, artist, songId = null) => {
    const params = new URLSearchParams({ title, artist });
    if (songId) params.set('songId', songId);
    return request(`/preview?${params}`);
  },
};