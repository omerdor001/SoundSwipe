// src/handlers/authHandler.js
const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/userRepository");
const sessionRepository = require("../repositories/sessionRepository");
const { extractToken, setSessionCookie, clearSessionCookie } = require("../utils/token");

function validatePassword(password) {
  const errors = [];
  if (password.length < 8 || password.length > 16) {
    errors.push("8-16 characters");
  }
  if (!/[a-zA-Z]/.test(password)) {
    errors.push("at least one letter");
  }
  if (!/\d/.test(password)) {
    errors.push("at least one digit");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("at least one symbol");
  }
  return errors;
}

async function signup(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }

  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ 
      error: `Password must contain ${passwordErrors.join(", ")}` 
    });
  }

  try {
    const existing = await userRepository.findByUsername(username);
    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await userRepository.create({ username, password: hashed });

    const token = require("../utils/token").generateToken();
    await sessionRepository.create({ token, userId: user.id, expiresAt: require("../utils/token").getExpiryDate() });

    setSessionCookie(res, token);
    res.status(201).json({ user: { id: user.id, username: user.username }, token });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const user = await userRepository.findByUsername(username);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Wrong password" });
    }

    const token = require("../utils/token").generateToken();
    await sessionRepository.create({ token, userId: user.id, expiresAt: require("../utils/token").getExpiryDate() });

    setSessionCookie(res, token);
    res.json({ user: { id: user.id, username: user.username }, token });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

async function getMe(req, res) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const session = await sessionRepository.findByToken(token);

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await sessionRepository.deleteByToken(session.token);
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
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

async function logout(req, res) {
  const token = extractToken(req);
  if (token) {
    await sessionRepository.deleteByToken(token);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
}

module.exports = {
  signup,
  login,
  getMe,
  logout,
};
