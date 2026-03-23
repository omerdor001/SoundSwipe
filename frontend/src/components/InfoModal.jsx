// src/components/InfoModal.jsx
import styles from "./InfoModal.module.css";

export default function InfoModal({ song, onClose }) {
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.emoji}>{song.emoji}</span>
          <div>
            <h3 className={styles.title}>{song.title}</h3>
            <p className={styles.artist}>by {song.artist}</p>
          </div>
        </div>

        <div className={styles.tags}>
          <span className={styles.tag}>{song.genre}</span>
          <span className={styles.tag}>{song.duration}</span>
          <span className={styles.tag}>{song.bpm} BPM</span>
        </div>

        <p className={styles.desc}>{song.desc}</p>

        <button className={styles.close} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
