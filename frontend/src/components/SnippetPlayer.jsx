// src/components/SnippetPlayer.jsx
//
// Compact audio snippet bar shown on the Discover / swipe screen.
// Auto-fetches and plays the 30s Deezer preview for the current card.
// Stops playing when the card is swiped away (song prop changes).

import { useEffect, useRef, useState } from "react";
import { previewApi } from "../api/client";
import styles from "./SnippetPlayer.module.css";

export default function SnippetPlayer({ song }) {
  const audioRef                   = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [coverUrl,   setCoverUrl]   = useState(null);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [progress,   setProgress]   = useState(0);   // 0–100
  const [hasPreview, setHasPreview] = useState(true); // false = Deezer has nothing

  // ── Fetch preview URL whenever the card changes ────────────
  useEffect(() => {
    // Stop current audio when song changes (including when song becomes null)
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setPreviewUrl(null);
    setCoverUrl(null);
    setIsPlaying(false);
    setProgress(0);
    setHasPreview(true);
    setLoading(false);

    if (!song) return;
    
    let cancelled = false;
    setLoading(true);

    previewApi.get(song.title, song.artist).then(data => {
      if (cancelled) return;
      setLoading(false);
      if (data?.previewUrl) {
        setPreviewUrl(data.previewUrl);
        setCoverUrl(data.coverUrl || null);
        setIsPlaying(true);
      } else {
        setHasPreview(false);
      }
    }).catch(() => {
      if (!cancelled) { setLoading(false); setHasPreview(false); }
    });

    return () => { cancelled = true; };
  }, [song?.id]);

  // ── Sync isPlaying ↔ audio element ────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying && previewUrl) {
      audio.src = previewUrl;
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, previewUrl]);

  function onTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
  }

  function onEnded() {
    setIsPlaying(false);
    setProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }

  function togglePlay() {
    if (!previewUrl) return;
    setIsPlaying(p => !p);
  }

  if (!song) return null;

  return (
    <div className={styles.bar}>
      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />

      {/* Cover thumbnail */}
      <div
        className={styles.thumb}
        style={coverUrl
          ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: `linear-gradient(135deg, ${song.color2}, ${song.color})` }
        }
      >
        {!coverUrl && <span className={styles.thumbEmoji}>{song.emoji}</span>}
      </div>

      {/* Label */}
      <div className={styles.label}>
        {loading  && <span className={styles.status}>Loading preview…</span>}
        {!loading && hasPreview  && <span className={styles.status}>🎵 30s preview</span>}
        {!loading && !hasPreview && <span className={styles.noPreview}>No preview available</span>}
      </div>

      {/* Progress bar */}
      {previewUrl && (
        <div className={styles.progressWrap}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Play/pause button */}
      <button
        className={`${styles.playBtn} ${isPlaying ? styles.playing : ""}`}
        onClick={togglePlay}
        disabled={!previewUrl}
        title={isPlaying ? "Pause preview" : "Play preview"}
      >
        {loading
          ? <span className={styles.spinner} />
          : isPlaying ? "⏸" : "▶"
        }
      </button>
    </div>
  );
}
