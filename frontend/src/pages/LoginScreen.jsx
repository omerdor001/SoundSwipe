// src/pages/LoginScreen.jsx
import { useState } from "react";
import useStore from "../store/useStore";
import styles from "./LoginScreen.module.css";

export default function LoginScreen() {
  const [tab, setTab] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, signup, loginWithSpotify } = useStore();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!username.trim() || !password) return setError("Please fill all fields.");
    if (tab === "signup") {
      if (username.length < 3) return setError("Username must be 3+ characters.");
      if (password.length < 4) return setError("Password must be 4+ characters.");
      if (password !== password2) return setError("Passwords don't match.");
    }

    setLoading(true);
    try {
      if (tab === "login") {
        await login(username.trim(), password);
      } else {
        await signup(username.trim(), password);
        setSuccess("Account created! Signing you in…");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.glow} />
      <div className={styles.box}>
        <div className={styles.logo}>SoundSwipe</div>
        <div className={styles.logoSub}>discover your next favorite track</div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === "login" ? styles.active : ""}`} onClick={() => { setTab("login"); setError(""); }}>Sign In</button>
          <button className={`${styles.tab} ${tab === "signup" ? styles.active : ""}`} onClick={() => { setTab("signup"); setError(""); }}>Create Account</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="your username" autoComplete="off" />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {tab === "signup" && (
            <div className={styles.field}>
              <label>Confirm Password</label>
              <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} placeholder="repeat password" />
            </div>
          )}
          <button className={styles.btnPrimary} type="submit" disabled={loading}>
            {loading ? "Loading…" : tab === "login" ? "Sign In →" : "Create Account →"}
          </button>
          {error && <p className={styles.err}>{error}</p>}
          {success && <p className={styles.ok}>{success}</p>}
        </form>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <button className={styles.btnSpotify} onClick={loginWithSpotify}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          Continue with Spotify
        </button>
      </div>
    </div>
  );
}
