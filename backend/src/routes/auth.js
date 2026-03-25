// src/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const https = require("https");

const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SESSION_EXPIRY_HOURS = 24;

const ENCRYPTION_KEY = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString("hex");
const IV_LENGTH = 16;

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function encryptToken(plainToken) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(plainToken, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptToken(encryptedToken) {
  try {
    const parts = encryptedToken.split(":");
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let decrypted = decipher.update(parts[1], "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

function setSessionCookie(res, token) {
  res.cookie("ss_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_EXPIRY_HOURS * 60 * 60 * 1000,
    path: "/",
  });
}

function clearSessionCookie(res) {
  res.clearCookie("ss_session", { path: "/" });
}

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

  const passwordErrors = [];
  if (password.length < 8 || password.length > 16) {
    passwordErrors.push("8-16 characters");
  }
  if (!/[a-zA-Z]/.test(password)) {
    passwordErrors.push("at least one letter");
  }
  if (!/\d/.test(password)) {
    passwordErrors.push("at least one digit");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    passwordErrors.push("at least one symbol");
  }
  if (passwordErrors.length > 0) {
    return res.status(400).json({ 
      error: `Password must contain ${passwordErrors.join(", ")}` 
    });
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

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
    await prisma.session.create({
      data: { token, userId: user.id, expiresAt },
    });

    setSessionCookie(res, token);
    res.status(201).json({ user: { id: user.id, username: user.username } });
  } catch (err) {
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

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
    await prisma.session.create({
      data: { token, userId: user.id, expiresAt },
    });

    setSessionCookie(res, token);
    res.json({ user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/me  (verify session + return user)
router.get("/me", async (req, res) => {
  // Accept token from cookie OR Authorization header
  let token = req.cookies?.ss_session;
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.slice(7);
  }
  
  // Decrypt if encrypted (from sessionStorage)
  if (token && token.includes(":")) {
    const decrypted = decryptToken(token);
    if (decrypted) token = decrypted;
  }
  
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } });
      }
      return res.status(401).json({ error: "Session expired" });
    }

    res.json({ 
      user: { 
        id: session.user.id, 
        username: session.user.username,
        spotifyId: session.user.spotifyId,
        spotifyAccessToken: session.user.spotifyAccessToken,
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
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
      return res.redirect(`${process.env.FRONTEND_URL}?error=token_exchange_failed`);
    }
    
    const { access_token, refresh_token, expires_in } = tokenRes.data;
    
    const userRes = await httpsGet(`${SPOTIFY_API_URL}/me`, {
      Authorization: `Bearer ${access_token}`
    });
    
    if (userRes.status !== 200) {
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
    
    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
    await prisma.session.create({
      data: { token, userId: user.id, expiresAt },
    });
    
    setSessionCookie(res, token);
    const encryptedToken = encryptToken(token);
    res.redirect(`${process.env.FRONTEND_URL}?token=${encodeURIComponent(encryptedToken)}&loggedin=true`);
  } catch (err) {
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
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/logout - Clear session
router.post("/logout", async (req, res) => {
  const token = req.cookies?.ss_session;
  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {});
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

module.exports = router;
