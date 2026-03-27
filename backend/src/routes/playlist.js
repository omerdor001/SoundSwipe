// src/routes/playlist.js
const express = require("express");
const authMiddleware = require("../middleware/auth");
const { getPlaylist, removeFromPlaylist } = require("../handlers/playlistHandler");

const router = express.Router();

router.get("/", authMiddleware, getPlaylist);
router.delete("/:songId", authMiddleware, removeFromPlaylist);

module.exports = router;
