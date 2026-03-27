// src/pages/MainApp.jsx
import { useState, useEffect } from "react";
import useStore from "../store/useStore";
import SwipeView from "../components/SwipeView";
import PlaylistView from "../components/PlaylistView";
import styles from "./MainApp.module.css";

export default function MainApp() {
  const [view, setView] = useState("swipe");
  const { user, logout, loadPlaylist } = useStore();

  useEffect(() => { loadPlaylist(); }, []);

  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        <div className={styles.navLogo}>SoundSwipe</div>

        <div className={styles.navTabs}>
          <button
            className={`${styles.navTab} ${view === "swipe" ? styles.active : ""}`}
            onClick={() => setView("swipe")}
          >🎵 Discover</button>
          <button
            className={`${styles.navTab} ${view === "playlist" ? styles.active : ""}`}
            onClick={() => { setView("playlist"); loadPlaylist(); }}
          >💚 Liked Songs</button>
        </div>

        <div className={styles.navRight}>
          <div className={styles.userChip}>
            <div className={styles.avatar}>{user.username[0].toUpperCase()}</div>
            <span>{user.username}</span>
          </div>
          <button className={styles.btnLogout} onClick={logout}>Sign out</button>
        </div>
      </nav>

      <main className={styles.main}>
        {view === "swipe"    && <SwipeView />}
        {view === "playlist" && <PlaylistView />}
      </main>

    </div>
  );
}
