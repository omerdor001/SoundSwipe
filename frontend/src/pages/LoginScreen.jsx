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

  const { login, signup } = useStore();

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
      </div>
    </div>
  );
}
