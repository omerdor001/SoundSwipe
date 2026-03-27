// src/routes/swipes.js
const express = require("express");
const authMiddleware = require("../middleware/auth");
const { createSwipe, deleteSwipe, resetSwipes, runCleanup } = require("../handlers/swipesHandler");

const router = express.Router();

router.post("/", authMiddleware, createSwipe);
router.delete("/:songId", authMiddleware, deleteSwipe);
router.post("/reset", authMiddleware, resetSwipes);
router.post("/cleanup", authMiddleware, runCleanup);

module.exports = router;
