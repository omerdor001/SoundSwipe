// src/handlers/playlistHandler.js
const playlistRepository = require("../repositories/playlistRepository");
const swipeRepository = require("../repositories/swipeRepository");

async function getPlaylist(req, res) {
  try {
    const entries = await playlistRepository.findByUser(req.user.id);
    res.json(entries.map((e) => e.song));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

async function removeFromPlaylist(req, res) {
  try {
    await playlistRepository.deleteByUserAndSong(req.user.id, req.params.songId);
    await swipeRepository.upsert(req.user.id, req.params.songId, "left");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  getPlaylist,
  removeFromPlaylist,
};
