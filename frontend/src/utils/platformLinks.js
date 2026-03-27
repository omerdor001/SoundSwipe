// src/utils/platformLinks.js
//
// Generates deep-link / search URLs for major music platforms.
// All links open the platform's search for the given song,
// or the "Add to playlist" flow where the platform supports it.
//
// Note: Only Spotify supports a real "add to playlist" via OAuth.
// For YouTube, Apple Music and Tidal we open a search/track
// page — the user can then save it in their own account.

export const PLATFORMS = [
  {
    id:    "spotify",
    name:  "Spotify",
    color: "#1DB954",
    icon:  "spotify",
    // Opens Spotify's search — user can then add to their own playlist
    searchUrl: (title, artist) =>
      `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`,
    // If you implement Spotify OAuth you can use the Web API:
    // POST https://api.spotify.com/v1/playlists/{id}/tracks
    addLabel: "Open in Spotify",
  },
  {
    id:    "youtube",
    name:  "YouTube Music",
    color: "#FF0000",
    icon:  "youtube",
    searchUrl: (title, artist) =>
      `https://music.youtube.com/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
    addLabel: "Open in YouTube Music",
  },
  {
    id:    "apple",
    name:  "Apple Music",
    color: "#fc3c44",
    icon:  "apple",
    searchUrl: (title, artist) =>
      `https://music.apple.com/search?term=${encodeURIComponent(`${title} ${artist}`)}`,
    addLabel: "Open in Apple Music",
  },
  {
    id:    "tidal",
    name:  "Tidal",
    color: "#00FFFF",
    icon:  "tidal",
    searchUrl: (title, artist) =>
      `https://tidal.com/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
    addLabel: "Open in Tidal",
  },
];

/**
 * Returns the search/open URL for a given platform and song.
 * If deezerUrl is provided and platform is "deezer", uses the direct track link.
 */
export function getPlatformUrl(platformId, title, artist, deezerUrl = null) {
  const platform = PLATFORMS.find(p => p.id === platformId);
  if (!platform) return "#";
  return platform.searchUrl(title, artist);
}
