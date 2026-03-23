// src/components/MiniPlayer.jsx
//
// Full-featured audio player using Deezer 30-second preview MP3s.
// - Fetches preview URL + cover art from our backend (/api/preview)
// - Uses the HTML5 <audio> element for playback
// - Shows a live scrubber, time, volume control, and prev/next
// - Falls back to a "Listen on Deezer" link if no preview found

import { useEffect, useRef, useState, useCallback } from "react";
import useStore from "../store/useStore";
import { previewApi } from "../api/client";
import styles from "./MiniPlayer.module.css";

export default function MiniPlayer() {
  const {
    playlist, playerIndex, isPlaying,
    togglePlay, playerNext, playerPrev,
    playTrack,
  } = useStore();

  const song = playlist[playerIndex];

  // Audio state
  const audioRef             = useRef(null);
  const [previewUrl, setPreviewUrl]   = useState(null);
  const [coverUrl,   setCoverUrl]     = useState(null);
  const [deezerUrl,  setDeezerUrl]    = useState(null);
  const [loading,    setLoading]      = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [volume,      setVolume]      = useState(0.8);
  const [expanded,    setExpanded]    = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // ── Fetch Deezer preview whenever the active song changes ──────
  useEffect(() => {
    if (!song) return;
    let cancelled = false;

    setPreviewUrl(null);
    setCoverUrl(null);
    setDeezerUrl(null);
    setPreviewError(false);
    setCurrentTime(0);
    setDuration(0);
    setLoading(true);

    previewApi.get(song.title, song.artist).then(data => {
      if (cancelled) return;
      setPreviewUrl(data.previewUrl || null);
      setCoverUrl(data.coverUrl || null);
      setDeezerUrl(data.deezerUrl || null);
      setLoading(false);
      if (!data.previewUrl) setPreviewError(true);
    }).catch(() => {
      if (!cancelled) { setLoading(false); setPreviewError(true); }
    });

    return () => { cancelled = true; };
  }, [song?.id]);

  // ── Sync isPlaying → audio element ────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !previewUrl) return;
    if (isPlaying) audio.play().catch(() => {});
    else           audio.pause();
  }, [isPlaying, previewUrl]);

  // ── Volume ─────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ── Audio event handlers ───────────────────────────────────────
  const onTimeUpdate = () => setCurrentTime(audioRef.current?.currentTime || 0);
  const onDurationChange = () => setDuration(audioRef.current?.duration || 0);
  const onEnded = () => playerNext();

  // ── Scrubber seek ──────────────────────────────────────────────
  function seek(e) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }

  function fmt(s) {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const progress = duration ? (currentTime / duration) * 100 : 0;

  if (!song) return null;

  const cover = coverUrl || null; // null → gradient fallback

  return (
    <>
      {/* Hidden audio element */}
      {previewUrl && (
        <audio
          ref={audioRef}
          src={previewUrl}
          onTimeUpdate={onTimeUpdate}
          onDurationChange={onDurationChange}
          onEnded={onEnded}
          onCanPlayThrough={() => { if (isPlaying) audioRef.current?.play().catch(() => {}); }}
        />
      )}

      <div className={`${styles.player} ${expanded ? styles.expanded : ""}`}>

        {/* ── Scrubber bar (top of player) ── */}
        {previewUrl && (
          <div className={styles.scrubberWrap} onClick={seek} title="Seek">
            <div className={styles.scrubberTrack}>
              <div className={styles.scrubberFill} style={{ width: `${progress}%` }} />
              <div className={styles.scrubberThumb} style={{ left: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* ── Main row ── */}
        <div className={styles.mainRow}>

          {/* Cover art */}
          <div
            className={styles.cover}
            style={cover
              ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: `linear-gradient(135deg, ${song.color2}, ${song.color})` }
            }
            onClick={() => setExpanded(e => !e)}
          >
            {!cover && <span className={styles.coverEmoji}>{song.emoji}</span>}
          </div>

          {/* Song info */}
          <div className={styles.info} onClick={() => setExpanded(e => !e)}>
            <div className={styles.title}>{song.title}</div>
            <div className={styles.artist}>
              {song.artist}
              {previewError && (
                <span className={styles.noPreview}> · no preview</span>
              )}
              {loading && (
                <span className={styles.loadingDots}> · loading…</span>
              )}
            </div>
          </div>

          {/* Time */}
          {previewUrl && (
            <div className={styles.time}>
              {fmt(currentTime)}<span className={styles.timeSep}>/</span>{fmt(duration)}
            </div>
          )}

          {/* Controls */}
          <div className={styles.controls}>
            <button className={styles.skipBtn} onClick={playerPrev} title="Previous">⏮</button>
            <button
              className={`${styles.playBtn} ${isPlaying ? styles.playing : ""}`}
              onClick={togglePlay}
              disabled={!previewUrl && !previewError}
              title={previewUrl ? (isPlaying ? "Pause" : "Play") : "No preview available"}
            >
              {loading ? <span className={styles.spinner} /> : (isPlaying ? "⏸" : "▶")}
            </button>
            <button className={styles.skipBtn} onClick={playerNext} title="Next">⏭</button>
          </div>

          {/* Volume */}
          <div className={styles.volumeWrap}>
            <span className={styles.volIcon}>{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</span>
            <input
              type="range" min="0" max="1" step="0.02"
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className={styles.volumeSlider}
              title="Volume"
            />
          </div>
        </div>

        {/* ── Expanded panel ── */}
        {expanded && (
          <div className={styles.expandedPanel}>
            <div className={styles.expandedArt}
              style={cover
                ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: `linear-gradient(160deg, ${song.color2}, ${song.color})` }
              }
            >
              {!cover && <span className={styles.expandedEmoji}>{song.emoji}</span>}
            </div>
            <div className={styles.expandedInfo}>
              <h3 className={styles.expandedTitle}>{song.title}</h3>
              <p className={styles.expandedArtist}>{song.artist}</p>
              <p className={styles.expandedGenre}>{song.genre}</p>
              {previewUrl && (
                <p className={styles.previewBadge}>🎵 30-sec preview via Deezer</p>
              )}
              {previewError && (
                <p className={styles.noPreviewMsg}>Preview not available for this track.</p>
              )}
              {deezerUrl && (
                <a className={styles.deezerLink} href={deezerUrl} target="_blank" rel="noopener noreferrer">
                  Open on Deezer ↗
                </a>
              )}
              {/* Playlist mini-list */}
              <div className={styles.queueList}>
                {playlist.map((s, i) => (
                  <div
                    key={s.id}
                    className={`${styles.queueItem} ${i === playerIndex ? styles.queueActive : ""}`}
                    onClick={() => { playTrack(i); setExpanded(false); }}
                  >
                    <span className={styles.queueEmoji}>{s.emoji}</span>
                    <div className={styles.queueInfo}>
                      <span className={styles.queueTitle}>{s.title}</span>
                      <span className={styles.queueArtist}>{s.artist}</span>
                    </div>
                    {i === playerIndex && isPlaying && <span className={styles.nowPlaying}>▶</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
