// src/components/SongCard.jsx
import styles from "./SongCard.module.css";

export default function SongCard({ song }) {
  if (!song) return null;

  return (
    <div className={styles.card}>
      {song.coverUrl && (
        <div
          className={styles.cardImage}
          style={{ backgroundImage: `url(${song.coverUrl})` }}
        />
      )}
      <div className={styles.topGradient} />
      <div className={styles.overlay} />
      <div className={styles.content}>
        <h2 className={styles.title}>{song.title}</h2>
        <p className={styles.artist}>{song.artist}</p>
        <div className={styles.meta}>
          <span>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            {song.duration}
          </span>
        </div>
      </div>
    </div>
  );
}
