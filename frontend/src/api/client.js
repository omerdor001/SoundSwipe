// src/api/client.js
const BASE = "/api";

function getToken() {
  return localStorage.getItem("ss_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
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
};

// ── Songs (live from MusicBrainz via our backend) ────
export const songsApi = {
  // Get discovery queue — optional ?genre=pop or ?search=radiohead
  getQueue:  (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/songs${qs ? "?" + qs : ""}`);
  },
  // Dedicated search
  search:    (q, mode = 'artist') => request(`/songs/search?q=${encodeURIComponent(q)}&mode=${mode}`),
  clearCache: () => request('/songs/cache/clear', { method: 'POST' }),
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
  get: (title, artist) =>
    request(`/preview?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`),
};
