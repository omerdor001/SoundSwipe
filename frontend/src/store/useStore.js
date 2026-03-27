// src/store/useStore.js
import { create } from "zustand";
import { authApi, songsApi, swipesApi, playlistApi } from "../api/client";

const useStore = create((set, get) => ({
  user:  null,

  login: async (username, password) => {
    const { user } = await authApi.login(username, password);
    set({ user });
    await get().loadQueue();
  },

  signup: async (username, password) => {
    const { user } = await authApi.signup(username, password);
    set({ user });
    await get().loadQueue();
  },

  loginWithSpotify: () => {
    window.location.href = "/api/auth/spotify";
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null, queue: [], swipedIds: new Set(), playlist: [], queueIndex: 0, spotifyCallback: false });
  },

  restoreSession: async () => {
    try {
      const { user } = await authApi.me();
      set({ user });
      await Promise.all([get().loadQueue(), get().loadPlaylist()]);
    } catch {
      set({ user: null });
    }
  },

  // ── Song queue ─────────────────────────────────────
  queue:        [],
  queueIndex:   0,
  queueLoading: false,
  activeGenre:  "",
  searchQuery:  "",
  // Client-side set of song IDs the user has swiped this session.
  // Used to instantly filter search results so voted songs never reappear.
  swipedIds:    new Set(),

  loadQueue: async (params = {}) => {
    set({ queueLoading: true });
    try {
      // Backend already filters out DB-persisted swipes.
      // We also filter by the client-side set for any in-flight swipes.
      const songs = await songsApi.getQueue(params);
      const { swipedIds } = get();
      const filtered = songs.filter(s => !swipedIds.has(s.id));
      set({ queue: filtered, queueIndex: 0 });
    } finally {
      set({ queueLoading: false });
    }
  },

  searchSongs: async (q, mode = "artist") => {
    set({ queueLoading: true, searchQuery: q, activeGenre: "" });
    try {
      const songs = await songsApi.search(q, mode);
      // Filter out anything the user has already swiped this session
      const { swipedIds } = get();
      const filtered = songs.filter(s => !swipedIds.has(s.id));
      set({ queue: filtered, queueIndex: 0 });
    } finally {
      set({ queueLoading: false });
    }
  },

  filterByGenre: async (genre) => {
    set({ activeGenre: genre, searchQuery: "", queue: [], queueIndex: 0 });
    await get().loadQueue(genre ? { genre } : {});
  },

  currentSong: () => {
    const { queue, queueIndex } = get();
    return queue[queueIndex] || null;
  },

  swipe: async (direction) => {
    const song = get().currentSong();
    if (!song) return;

    // 1. Record swiped ID client-side immediately so it's filtered out
    //    from any future search results or queue reloads this session.
    set(s => ({
      swipedIds:  new Set([...s.swipedIds, song.id]),
      queueIndex: s.queueIndex + 1,
    }));

    // 2. Persist to backend
    await swipesApi.swipe(song, direction);

    // 3. Optimistically add to playlist if liked
    if (direction === "right") {
      set(s => ({ playlist: [...s.playlist, song] }));
    }
  },

  resetSwipes: async () => {
    // Clear both server-side and client-side swipe records
    await swipesApi.reset();
    set({ swipedIds: new Set() });
    await get().loadQueue();
  },

  // ── Playlist ───────────────────────────────────────
  playlist: [],

  loadPlaylist: async () => {
    const playlist = await playlistApi.get();
    // Populate swipedIds from playlist so those songs are also filtered
    // even after a page refresh (playlist songs were right-swiped).
    set(s => ({
      playlist,
      swipedIds: new Set([...s.swipedIds, ...playlist.map(p => p.id)]),
    }));
  },

  removeFromPlaylist: async (songId) => {
    await playlistApi.remove(songId);
    set(s => ({ playlist: s.playlist.filter(p => p.id !== songId) }));
    // Note: we intentionally keep songId in swipedIds so it doesn't
    // reappear in the discovery queue (the swipe record still exists on the server).
  },

  // ── Player ─────────────────────────────────────────
  playerIndex: 0,
  isPlaying:   false,

  playTrack:  (idx) => set({ playerIndex: idx, isPlaying: true }),
  togglePlay: () => set(s => ({ isPlaying: !s.isPlaying })),
  setPlaying: (val) => set({ isPlaying: val }),

  playerNext: () => set(s => {
    if (!s.playlist.length) return {};
    return { playerIndex: (s.playerIndex + 1) % s.playlist.length, isPlaying: true };
  }),

  playerPrev: () => set(s => {
    if (!s.playlist.length) return {};
    return { playerIndex: (s.playerIndex - 1 + s.playlist.length) % s.playlist.length, isPlaying: true };
  }),
}));

export default useStore;
