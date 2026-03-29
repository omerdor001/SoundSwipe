// src/handlers/spotifyHandler.js
const bcrypt = require("bcryptjs");
const https = require("https");
const userRepository = require("../repositories/userRepository");
const sessionRepository = require("../repositories/sessionRepository");
const { generateToken, setSessionCookie, encryptToken, getExpiryDate } = require("../utils/token");

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

function redirectToSpotify(req, res) {
  const scopes = (process.env.SPOTIFY_SCOPES || "user-read-private user-read-email").split(" ");
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    scope: scopes.join(" "),
    show_dialog: "true"
  });
  res.redirect(`${SPOTIFY_AUTH_URL}?${params.toString()}`);
}

async function handleCallback(req, res) {
  const { code, error } = req.query;
  
  const isMobile = req.query.mobile === 'true';
  const redirectBase = isMobile ? (process.env.MOBILE_URL || process.env.FRONTEND_URL) : process.env.FRONTEND_URL;
  
  if (error) {
    return res.redirect(`${redirectBase}?error=spotify_auth_failed`);
  }
  
  if (!code) {
    return res.redirect(`${redirectBase}?error=no_code`);
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
      return res.redirect(`${redirectBase}?error=token_exchange_failed`);
    }
    
    const { access_token, refresh_token, expires_in } = tokenRes.data;
    
    const userRes = await httpsGet(`${SPOTIFY_API_URL}/me`, {
      Authorization: `Bearer ${access_token}`
    });
    
    if (userRes.status !== 200) {
      return res.redirect(`${redirectBase}?error=user_info_failed`);
    }
    
    const spotifyUser = userRes.data;
    
    let user = await userRepository.findBySpotifyId(spotifyUser.id);
    
    if (!user) {
      user = await userRepository.create({
        username: spotifyUser.display_name || spotifyUser.id,
        password: bcrypt.hashSync(Math.random().toString(36), 10),
        spotifyId: spotifyUser.id,
        spotifyAccessToken: access_token,
        spotifyRefreshToken: refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
      });
    } else {
      user = await userRepository.update(user.id, {
        spotifyAccessToken: access_token,
        spotifyRefreshToken: refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
      });
    }
    
    const token = generateToken();
    await sessionRepository.create({ token, userId: user.id, expiresAt: getExpiryDate() });
    
    setSessionCookie(res, token);
    const encryptedToken = encryptToken(token);
    res.redirect(`${redirectBase}?token=${encodeURIComponent(encryptedToken)}&loggedin=true`);
  } catch {
    res.redirect(`${redirectBase}?error=server_error`);
  }
}

async function handleMobileCallback(req, res) {
  const { code, error } = req.query;
  
  const redirectBase = process.env.MOBILE_URL || process.env.FRONTEND_URL;
  
  if (error) {
    return res.redirect(`${redirectBase}?error=spotify_auth_failed`);
  }
  
  if (!code) {
    return res.redirect(`${redirectBase}?error=no_code`);
  }
  
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.API_URL}/api/auth/spotify/mobile-callback`
    }).toString();
    
    const authString = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");
    
    const tokenRes = await httpsPost(SPOTIFY_TOKEN_URL, {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${authString}`
    }, body);
    
    if (tokenRes.status !== 200) {
      return res.redirect(`${redirectBase}?error=token_exchange_failed`);
    }
    
    const { access_token, refresh_token, expires_in } = tokenRes.data;
    
    const userRes = await httpsGet(`${SPOTIFY_API_URL}/me`, {
      Authorization: `Bearer ${access_token}`
    });
    
    if (userRes.status !== 200) {
      return res.redirect(`${redirectBase}?error=user_info_failed`);
    }
    
    const spotifyUser = userRes.data;
    
    let user = await userRepository.findBySpotifyId(spotifyUser.id);
    
    if (!user) {
      user = await userRepository.create({
        username: spotifyUser.display_name || spotifyUser.id,
        password: bcrypt.hashSync(Math.random().toString(36), 10),
        spotifyId: spotifyUser.id,
        spotifyAccessToken: access_token,
        spotifyRefreshToken: refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
      });
    } else {
      user = await userRepository.update(user.id, {
        spotifyAccessToken: access_token,
        spotifyRefreshToken: refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
      });
    }
    
    const token = generateToken();
    await sessionRepository.create({ token, userId: user.id, expiresAt: getExpiryDate() });
    
    setSessionCookie(res, token);
    const encryptedToken = encryptToken(token);
    // Pass user info directly so app doesn't need to make another API call
    res.redirect(`${redirectBase}?token=${encodeURIComponent(encryptedToken)}&userId=${user.id}&username=${encodeURIComponent(user.username)}&loggedin=true`);
  } catch {
    res.redirect(`${redirectBase}?error=server_error`);
  }
}

async function handleNativeCallback(req, res) {
  const { code, error } = req.query;
  
  if (error) {
    return res.redirect(`soundswipe://spotify-callback?error=${error}`);
  }
  
  if (!code) {
    return res.redirect(`soundswipe://spotify-callback?error=no_code`);
  }
  
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: 'soundswipe://spotify-callback'
    }).toString();
    
    const authString = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");
    
    const tokenRes = await httpsPost(SPOTIFY_TOKEN_URL, {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${authString}`
    }, body);
    
    if (tokenRes.status !== 200) {
      return res.redirect(`soundswipe://spotify-callback?error=token_exchange_failed`);
    }
    
    const { access_token, refresh_token, expires_in } = tokenRes.data;
    
    const userRes = await httpsGet(`${SPOTIFY_API_URL}/me`, {
      Authorization: `Bearer ${access_token}`
    });
    
    if (userRes.status !== 200) {
      return res.redirect(`soundswipe://spotify-callback?error=user_info_failed`);
    }
    
    const spotifyUser = userRes.data;
    
    let user = await userRepository.findBySpotifyId(spotifyUser.id);
    
    if (!user) {
      user = await userRepository.create({
        username: spotifyUser.display_name || spotifyUser.id,
        password: bcrypt.hashSync(Math.random().toString(36), 10),
        spotifyId: spotifyUser.id,
        spotifyAccessToken: access_token,
        spotifyRefreshToken: refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
      });
    } else {
      user = await userRepository.update(user.id, {
        spotifyAccessToken: access_token,
        spotifyRefreshToken: refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
      });
    }
    
    const token = generateToken();
    await sessionRepository.create({ token, userId: user.id, expiresAt: getExpiryDate() });
    
    res.redirect(`soundswipe://spotify-callback?token=${encodeURIComponent(token)}&userId=${user.id}&username=${encodeURIComponent(user.username)}`);
  } catch {
    res.redirect(`soundswipe://spotify-callback?error=server_error`);
  }
}

function getSpotifyAuthUrl(req, res) {
  const scopes = (process.env.SPOTIFY_SCOPES || "user-read-private user-read-email").split(" ");
  const platform = req.query.platform || 'web';
  
  let redirectUri;
  if (platform === 'native') {
    redirectUri = 'soundswipe://spotify-callback';
  } else if (platform === 'mobile') {
    redirectUri = process.env.SPOTIFY_MOBILE_REDIRECT_URI;
  } else {
    redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  }
  
  console.log(`[Spotify Auth] Platform: ${platform}, Redirect URI: ${redirectUri}`);
  
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    show_dialog: "true"
  });
  res.json({ url: `${SPOTIFY_AUTH_URL}?${params.toString()}`, platform, redirectUri });
}

async function refreshToken(req, res) {
  try {
    const user = await userRepository.findById(req.user.id);
    
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
    
    await userRepository.update(user.id, {
      spotifyAccessToken: access_token,
      spotifyRefreshToken: newRefresh || user.spotifyRefreshToken,
      spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
    });
    
    res.json({ access_token, expires_in });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

async function exchangeCode(req, res) {
  const { code, redirectUri, codeVerifier } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: "Code is required" });
  }
  
  if (!codeVerifier) {
    return res.status(400).json({ error: "code_verifier required for PKCE" });
  }
  
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      code_verifier: codeVerifier,
    }).toString();
    
    const authString = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");
    
    const tokenRes = await httpsPost(SPOTIFY_TOKEN_URL, {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${authString}`
    }, body);
    
    if (tokenRes.status !== 200) {
      console.error("[Spotify] Token exchange failed:", tokenRes.data);
      return res.status(400).json({ error: "Token exchange failed" });
    }
    
    const { access_token, refresh_token, expires_in } = tokenRes.data;
    
    const userRes = await httpsGet(`${SPOTIFY_API_URL}/me`, {
      Authorization: `Bearer ${access_token}`
    });
    
    if (userRes.status !== 200) {
      return res.status(400).json({ error: "Failed to get user info" });
    }
    
    const spotifyUser = userRes.data;
    
    let user = await userRepository.findBySpotifyId(spotifyUser.id);
    
    if (!user) {
      user = await userRepository.create({
        username: spotifyUser.display_name || spotifyUser.id,
        password: "",
        spotifyId: spotifyUser.id,
        spotifyAccessToken: access_token,
        spotifyRefreshToken: refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
      });
    } else {
      await userRepository.update(user.id, {
        spotifyAccessToken: access_token,
        spotifyRefreshToken: refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + expires_in * 1000)
      });
    }
    
    const token = generateToken();
    await sessionRepository.create({ token, userId: user.id, expiresAt: getExpiryDate() });
    
    res.json({
      token,
      userId: user.id,
      username: user.username,
      spotifyId: spotifyUser.id
    });
  } catch (e) {
    console.error("[Spotify] Exchange error:", e);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  redirectToSpotify,
  handleCallback,
  handleMobileCallback,
  handleNativeCallback,
  getSpotifyAuthUrl,
  refreshToken,
  exchangeCode,
};
