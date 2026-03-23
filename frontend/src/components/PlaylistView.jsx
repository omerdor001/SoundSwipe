// src/components/PlaylistView.jsx
import { useState, useEffect } from "react";
import useStore from "../store/useStore";
import PlatformModal from "./PlatformModal";
import { previewApi } from "../api/client";
import styles from "./PlaylistView.module.css";

// Fetch + cache cover art per song id
const coverCache = {};

function useCover(song) {
  const [cover, setCover] = useState(coverCache[song?.id] || null);
  useEffect(() => {
    if (!song || coverCache[song.id] !== undefined) return;
    previewApi.get(song.title, song.artist)
      .then(d => {
        coverCache[song.id] = d?.coverUrl || null;
        setCover(coverCache[song.id]);
      })
      .catch(() => { coverCache[song.id] = null; });
  }, [song?.id]);
  return cover;
}

function SongRow({ song, index, isActive, isPlaying, onPlay, onOpenPlatform, onRemove }) {
  const cover = useCover(song);

  return (
    <li className={`${styles.row} ${isActive ? styles.active : ""}`}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className={styles.numWrap} onClick={onPlay}>
        {isActive && isPlaying
          ? <span className={styles.eqBars}><i/><i/><i/></span>
          : <span className={styles.num}>{index + 1}</span>
        }
      </div>

      <div
        className={styles.cover}
        style={cover
          ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: `linear-gradient(135deg, ${song.color2}, ${song.color})` }
        }
        onClick={onPlay}
      >
        {!cover && song.emoji}
      </div>

      <div className={styles.info} onClick={onPlay}>
        <div className={styles.songTitle}>{song.title}</div>
        <div className={styles.songArtist}>{song.artist}</div>
      </div>

      <div className={styles.meta}>
        <span className={styles.duration}>{song.duration}</span>
        <span className={styles.genre}>{song.genre}</span>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.platformBtn}
          onClick={e => { e.stopPropagation(); onOpenPlatform(song, cover); }}
          title="Add to playlist on Spotify, YouTube Music, Apple Music, Deezer, Tidal"
        >⊕</button>
        <button
          className={styles.remove}
          onClick={e => { e.stopPropagation(); onRemove(song.id); }}
          title="Remove"
        >✕</button>
      </div>
    </li>
  );
}

export default function PlaylistView() {
  const { playlist, removeFromPlaylist, playTrack, playerIndex, isPlaying } = useStore();
  const [platformTarget, setPlatformTarget] = useState(null);
  const [searchQ, setSearchQ] = useState("");

  const totalMins = playlist.reduce((acc, s) => {
    const [m, sec] = (s.duration || "0:00").split(":").map(Number);
    return acc + m + sec / 60;
  }, 0);
  const genres = [...new Set(playlist.map(s => s.genre))];

  // Filter playlist by search query — matches title or artist, case-insensitive
  const filtered = searchQ.trim()
    ? playlist.filter(s =>
        s.title.toLowerCase().includes(searchQ.toLowerCase()) ||
        s.artist.toLowerCase().includes(searchQ.toLowerCase())
      )
    : playlist;

  if (playlist.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>💚</div>
        <h3>No liked songs yet</h3>
        <p>Swipe right on songs you love to add them here!</p>
      </div>
    );
  }

  return (
    <div className={styles.view}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1>💚 Liked Songs</h1>
        </div>
        <div className={styles.stats}>
          <span className={styles.chip}>Songs: <strong>{playlist.length}</strong></span>
          <span className={styles.chip}>Time: <strong>{Math.round(totalMins)} min</strong></span>
          <span className={styles.chip}>Genres: <strong>{genres.length}</strong></span>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search in Liked Songs…"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        {searchQ && (
          <button className={styles.clearBtn} onClick={() => setSearchQ("")}>✕</button>
        )}
      </div>

      {/* ── Results count when searching ── */}
      {searchQ && (
        <p className={styles.resultCount}>
          {filtered.length === 0
            ? "No songs match your search"
            : `${filtered.length} song${filtered.length === 1 ? "" : "s"} found`
          }
        </p>
      )}

      {/* ── Song list ── */}
      {filtered.length > 0 && (
        <ul className={styles.list}>
          {filtered.map((song, i) => {
            // Use original playlist index for correct playback even when filtered
            const originalIndex = playlist.indexOf(song);
            return (
              <SongRow
                key={song.id}
                song={song}
                index={i}
                isActive={originalIndex === playerIndex}
                isPlaying={isPlaying}
                onPlay={() => playTrack(originalIndex)}
                onOpenPlatform={(s, cover) => setPlatformTarget({ song: s, cover })}
                onRemove={removeFromPlaylist}
              />
            );
          })}
        </ul>
      )}

      <div className={styles.legend}>
        ⊕ opens Spotify · YouTube Music · Apple Music · Deezer · Tidal
      </div>

      {platformTarget && (
        <PlatformModal
          song={platformTarget.song}
          coverUrl={platformTarget.cover}
          onClose={() => setPlatformTarget(null)}
        />
      )}
    </div>
  );
}
