// src/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const https = require("https");

const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers
    };
    
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    if (body) req.write(body);
    req.end();
  });
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers
    };
    
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.end();
  });
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hashed },
    });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/me  (verify token + return user)
router.get("/me", require("../middleware/auth"), async (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username } });
});

// GET /api/auth/spotify - Redirect to Spotify login
router.get("/spotify", (req, res) => {
  const scopes = (process.env.SPOTIFY_SCOPES || "user-read-private user-read-email").split(" ");
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    scope: scopes.join(" "),
    show_dialog: "true"
  });
  res.redirect(`${SPOTIFY_AUTH_URL}?${params.toString()}`);
});

// GET /api/auth/spotify/callback - Handle Spotify OAuth callback
router.get("/spotify/callback", async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL}?error=spotify_auth_failed`);
  }
  
  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
  }
  
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI
    }).toString();
    
    const authString = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");
    
    const tokenRes = await httpsPost(SPOTIFY_TOKEN_URL, {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${authString}`
    }, body);
    
    if (tokenRes.status !== 200) {
      console.error("Spotify token error:", tokenRes.data);
      return res.redirect(`${process.env.FRONTEND_URL}?error=token_exchange_failed`);
    }
    
    const { access_token, refresh_token, expires_in } = tokenRes.data;
    
    const userRes = await httpsGet(`${SPOTIFY_API_URL}/me`, {
      Authorization: `Bearer ${access_token}`
    });
    
    if (userRes.status !== 200) {
      console.error("Spotify user info error:", userRes.data);
      return res.redirect(`${process.env.FRONTEND_URL}?error=user_info_failed`);
    }
    
    const spotifyUser = userRes.data;
    
    let user = await prisma.user.findFirst({
      where: { spotifyId: spotifyUser.id }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          username: spotifyUser.display_name || spotifyUser.id,
          password: bcrypt.hashSync(Math.random().toString(36), 10),
          spotifyId: spotifyUser.id,
          spotifyAccessToken: access_token,
          spotifyRefreshToken: refresh_token,
          spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          spotifyAccessToken: access_token,
          spotifyRefreshToken: refresh_token,
          spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
        }
      });
    }
    
    const appToken = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    res.redirect(`${process.env.FRONTEND_URL}?token=${appToken}&username=${encodeURIComponent(user.username)}`);
  } catch (err) {
    console.error("Spotify callback error:", err);
    res.redirect(`${process.env.FRONTEND_URL}?error=server_error`);
  }
});

// POST /api/auth/spotify/refresh - Refresh Spotify token
router.post("/spotify/refresh", require("../middleware/auth"), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    if (!user?.spotifyRefreshToken) {
      return res.status(400).json({ error: "No Spotify refresh token" });
    }
    
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: user.spotifyRefreshToken
    }).toString();
    
    const authString = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");
    
    const tokenRes = await httpsPost(SPOTIFY_TOKEN_URL, {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${authString}`
    }, body);
    
    if (tokenRes.status !== 200) {
      return res.status(401).json({ error: "Failed to refresh Spotify token" });
    }
    
    const { access_token, refresh_token: newRefresh, expires_in } = tokenRes.data;
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        spotifyAccessToken: access_token,
        spotifyRefreshToken: newRefresh || user.spotifyRefreshToken,
        spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
      }
    });
    
    res.json({ access_token, expires_in });
  } catch (err) {
    console.error("Spotify refresh error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
