// src/routes/auth.js
const express = require("express");
const { signup, login, getMe, logout } = require("../handlers/authHandler");
const { redirectToSpotify, handleCallback, handleMobileCallback, handleNativeCallback, getSpotifyAuthUrl, refreshToken, exchangeCode } = require("../handlers/spotifyHandler");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", getMe);
router.post("/logout", logout);

router.get("/spotify", redirectToSpotify);
router.get("/spotify/callback", handleCallback);
router.get("/spotify/mobile-callback", handleMobileCallback);
router.get("/spotify/native-callback", handleNativeCallback);
router.get("/spotify/auth-url", getSpotifyAuthUrl);
router.post("/spotify/exchange", exchangeCode);
router.post("/spotify/refresh", authMiddleware, refreshToken);

module.exports = router;
