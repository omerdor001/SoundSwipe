// src/components/SongCard.jsx
import styles from "./SongCard.module.css";

export default function SongCard({ song }) {
  if (!song) return null;

  return (
    <div className={styles.card}>
      <div
        className={styles.bg}
        style={{ background: `linear-gradient(160deg, ${song.color2} 0%, ${song.color} 100%)` }}
      />
      <div className={styles.overlay} />
      <div className={styles.emoji}>{song.emoji}</div>
      <div className={styles.content}>
        <h2 className={styles.title}>{song.title}</h2>
        <p className={styles.artist}>{song.artist}</p>
        <div className={styles.meta}>
          <span>⏱ {song.duration}</span>
          <span>♩ {song.bpm} BPM</span>
        </div>
      </div>
    </div>
  );
}
