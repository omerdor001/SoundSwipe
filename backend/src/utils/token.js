// src/utils/token.js
const crypto = require("crypto");

const ENCRYPTION_KEY = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString("hex");
const IV_LENGTH = 16;
const SESSION_EXPIRY_HOURS = 24;

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

function extractToken(req) {
  let token = req.cookies?.ss_session;
  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.slice(7);
  }
  if (token && token.includes(":")) {
    const decrypted = decryptToken(token);
    if (decrypted) token = decrypted;
  }
  return token;
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

function getExpiryDate() {
  return new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
}

module.exports = {
  generateToken,
  encryptToken,
  decryptToken,
  extractToken,
  setSessionCookie,
  clearSessionCookie,
  getExpiryDate,
  SESSION_EXPIRY_HOURS,
};
