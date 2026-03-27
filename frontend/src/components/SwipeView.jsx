// src/components/SwipeView.jsx
import { useEffect, useRef, useState } from "react";
import useStore from "../store/useStore";
import { songsApi, previewCacheApi } from "../api/client";
import SongCard from "./SongCard";
import InfoModal from "./InfoModal";
import SnippetPlayer from "./SnippetPlayer";
import styles from "./SwipeView.module.css";

const GENRES = [
  "pop","rock","hip hop","electronic","jazz","metal","country",
];

const MODES = [
  { id: "artist", label: "Artist",         placeholder: "e.g. Taylor Swift…"    },
  { id: "title",  label: "Title",          placeholder: "e.g. Blinding Lights…"  },
  { id: "both",   label: "Title + Artist", placeholder: null                      },
];

export default function SwipeView() {
  const {
    queue, queueIndex, queueLoading,
    swipe, resetSwipes, loadQueue,
    filterByGenre, searchSongs, activeGenre,
  } = useStore();

  const [dragX, setDragX]         = useState(0);
  const [isDragging, setDragging] = useState(false);
  const [animDir, setAnimDir]     = useState(null);
  const [showModal, setModal]     = useState(false);

  // Search drawer — collapsed by default
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchMode,   setSearchMode]   = useState("artist");
  const [searchQ,      setSearchQ]      = useState("");
  const [searchTitle,  setSearchTitle]  = useState("");
  const [searchArtist, setSearchArtist] = useState("");
  const [cacheMsg,     setCacheMsg]     = useState("");

  const startX = useRef(0);

  const song     = queue[queueIndex] || null;
  const nextSong = queue[queueIndex + 1] || null;
  const isDone   = !queueLoading && queueIndex >= queue.length && queue.length > 0;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") handleSwipe("right");
      if (e.key === "ArrowLeft")  handleSwipe("left");
      if (e.key === "i" || e.key === "I") setModal(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [song]);

  function handleSwipe(dir) {
    if (!song || animDir) return;
    setAnimDir(dir);
    setTimeout(async () => {
      await swipe(dir);
      setAnimDir(null);
      setDragX(0);
    }, 380);
  }

  function onPointerDown(e) {
    if (!song) return;
    setDragging(true);
    startX.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (!isDragging) return;
    setDragX((e.clientX ?? e.touches?.[0]?.clientX ?? startX.current) - startX.current);
  }
  function onPointerUp() {
    if (!isDragging) return;
    setDragging(false);
    if      (dragX >  80) handleSwipe("right");
    else if (dragX < -80) handleSwipe("left");
    else                  setDragX(0);
  }

  async function handleReset() {
    await resetSwipes();
    await loadQueue(activeGenre ? { genre: activeGenre } : {});
  }

  function handleSearch(e) {
    e.preventDefault();
    if (searchMode === "both") {
      const t = searchTitle.trim(), a = searchArtist.trim();
      if (!t || !a) return;
      searchSongs(`${t}|||${a}`, "both");
    } else {
      if (searchQ.trim().length < 2) return;
      searchSongs(searchQ.trim(), searchMode);
    }
    setSearchOpen(false); // collapse drawer after search
  }

  async function handleClearCache() {
    try {
      const [songs, previews] = await Promise.all([
        songsApi.clearCache(),
        previewCacheApi.clear(),
      ]);
      const total = (songs.cleared || 0) + (previews.cleared || 0);
      setCacheMsg(`✓ Cleared ${total} cached entries`);
      setTimeout(() => setCacheMsg(""), 3000);
    } catch {
      setCacheMsg("Failed to clear cache");
      setTimeout(() => setCacheMsg(""), 3000);
    }
  }

  async function handleSimilar() {
    setCacheMsg("Finding similar songs...");
    try {
      const songs = await songsApi.getSimilar(20);
      
      if (songs.length === 0) {
        setCacheMsg("Like some songs first to get recommendations!");
        setTimeout(() => setCacheMsg(""), 3000);
        return;
      }
      
      setCacheMsg(`Found ${songs.length} similar songs!`);
      setTimeout(() => setCacheMsg(""), 2000);
      
      const { swipedIds } = useStore.getState();
      const filtered = songs.filter(s => !swipedIds.has(s.id));
      useStore.setState({ queue: filtered, queueIndex: 0, activeGenre: "" });
    } catch (err) {
      setCacheMsg("Failed to load similar songs");
      setTimeout(() => setCacheMsg(""), 3000);
    }
  }

  function clearSearch() {
    setSearchQ(""); setSearchTitle(""); setSearchArtist("");
    loadQueue(activeGenre ? { genre: activeGenre } : {});
    setSearchOpen(false);
  }

  let cardStyle = {};
  if (animDir === "right") {
    cardStyle = { transform: "translateX(130%) rotate(30deg)", opacity: 0, transition: "transform .38s ease, opacity .38s ease" };
  } else if (animDir === "left") {
    cardStyle = { transform: "translateX(-130%) rotate(-30deg)", opacity: 0, transition: "transform .38s ease, opacity .38s ease" };
  } else {
    cardStyle = {
      transform: `translate(${dragX}px, ${Math.abs(dragX) * 0.04}px) rotate(${dragX * 0.07}deg)`,
      transition: isDragging ? "none" : "transform .35s cubic-bezier(.25,.8,.25,1)",
      cursor: isDragging ? "grabbing" : "grab",
    };
  }

  const stampYes = dragX > 0 ? Math.min(dragX / 80, 1) : 0;
  const stampNo  = dragX < 0 ? Math.min(-dragX / 80, 1) : 0;
  const currentMode = MODES.find(m => m.id === searchMode);

  return (
    <div className={styles.view}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <span className={styles.logo}>SoundSwipe</span>
      </div>

      {/* ── Toolbar: genre chips + icons ── */}
      <div className={styles.toolbar}>
        <div className={styles.genreBar}>
          <button
            className={`${styles.genreChip} ${!activeGenre ? styles.genreActive : ""}`}
            onClick={() => { filterByGenre(""); clearSearch(); }}
          >All</button>
          {GENRES.map(g => (
            <button key={g}
              className={`${styles.genreChip} ${activeGenre === g ? styles.genreActive : ""}`}
              onClick={() => { filterByGenre(g); setSearchQ(""); setSearchTitle(""); setSearchArtist(""); }}
            >{g}</button>
          ))}
        </div>

        <button
          className={styles.iconBtn}
          onClick={() => setSearchOpen(o => !o)}
          title="Search songs"
        >🔍</button>
        
        <button
          className={styles.iconBtn}
          onClick={handleSimilar}
          title="Songs similar to your likes"
        >✨</button>
      </div>

      {/* ── Collapsible search drawer ── */}
      {searchOpen && (
        <div className={styles.searchDrawer}>
          {/* Mode toggle */}
          <div className={styles.modeToggle}>
            {MODES.map(m => (
              <button key={m.id} type="button"
                className={`${styles.modeBtn} ${searchMode === m.id ? styles.modeBtnActive : ""}`}
                onClick={() => setSearchMode(m.id)}
              >{m.label}</button>
            ))}
          </div>

          {/* Inputs + submit */}
          <form className={styles.searchForm} onSubmit={handleSearch}>
            {searchMode === "both" ? (
              <div className={styles.bothInputs}>
                <input className={styles.searchInput} type="text"
                  placeholder="Song title…" value={searchTitle}
                  onChange={e => setSearchTitle(e.target.value)} />
                <input className={styles.searchInput} type="text"
                  placeholder="Artist name…" value={searchArtist}
                  onChange={e => setSearchArtist(e.target.value)} />
              </div>
            ) : (
              <input className={styles.searchInput} type="text"
                placeholder={currentMode.placeholder}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)} />
            )}
            <button className={styles.searchBtn} type="submit">Search</button>
          </form>

          {/* Cache clear */}
          <div className={styles.cacheRow}>
            <button className={styles.cacheBtn} onClick={handleClearCache}>↺ Clear cache</button>
            {cacheMsg && <span className={styles.cacheMsg}>{cacheMsg}</span>}
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {queueLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Fetching songs…</p>
        </div>
      )}

      {/* ── Done ── */}
      {!queueLoading && isDone && (
        <div className={styles.done}>
          <div className={styles.doneIcon}>🎉</div>
          <h2>You've heard them all!</h2>
          <p>Try another genre or restart.</p>
          <button className={styles.btnReset} onClick={handleReset}>Shuffle &amp; Restart</button>
        </div>
      )}

      {/* ── Empty search ── */}
      {!queueLoading && !isDone && queue.length === 0 && (
        <div className={styles.done}>
          <div className={styles.doneIcon}>🔍</div>
          <h2>No songs found</h2>
          <p>Try a different search or genre.</p>
        </div>
      )}

      {/* ── Card + snippet + controls ── */}
      {!queueLoading && song && (
        <>
          <div className={styles.stackArea}>
            {nextSong && <div className={styles.behindCard} />}
            <div
              className={styles.cardWrap}
              style={cardStyle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              <SongCard song={song} />
              <div className={styles.stampYes} style={{ opacity: stampYes }}>LIKE ♫</div>
              <div className={styles.stampNo}  style={{ opacity: stampNo }}>NOPE ✕</div>
            </div>
          </div>

          <SnippetPlayer song={song} />

          <div className={styles.controls}>
            <button className={`${styles.ctrl} ${styles.ctrlNo}`}   onClick={() => handleSwipe("left")}  title="Skip (←)">✕</button>
            <button className={`${styles.ctrl} ${styles.ctrlInfo}`} onClick={() => setModal(true)}        title="Info (I)">ℹ</button>
            <button className={`${styles.ctrl} ${styles.ctrlYes}`}  onClick={() => handleSwipe("right")} title="Like (→)">♥</button>
          </div>

          <p className={styles.hint}>swipe right to save · left to skip · ← → keys work too</p>
        </>
      )}

      {showModal && song && <InfoModal song={song} onClose={() => setModal(false)} />}
    </div>
  );
}
