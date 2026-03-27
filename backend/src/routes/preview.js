// src/routes/preview.js
const express = require("express");
const authMiddleware = require("../middleware/auth");
const { getPreview, clearCache } = require("../handlers/previewHandler");

const router = express.Router();

router.post("/cache/clear", authMiddleware, clearCache);
router.get("/", authMiddleware, getPreview);

module.exports = router;
