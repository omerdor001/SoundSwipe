// src/routes/songs.js
const express = require("express");
const authMiddleware = require("../middleware/auth");
const { getSongs, searchSongs, getGenres, getSimilarSongs, clearCache } = require("../handlers/songsHandler");

const router = express.Router();

router.post("/cache/clear", authMiddleware, clearCache);
router.get("/", authMiddleware, getSongs);
router.get("/search", authMiddleware, searchSongs);
router.get("/genres", authMiddleware, getGenres);
router.get("/similar", authMiddleware, getSimilarSongs);

module.exports = router;
