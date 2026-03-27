// src/components/PlatformModal.jsx
// Full-screen centered modal — no positioning math, never clips.

import { useState, useEffect, useRef } from "react";
import { PLATFORMS } from "../utils/platformLinks";
import { previewApi } from "../api/client";
import styles from "./PlatformModal.module.css";

const ICONS = {
  spotify: (<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>),
  youtube: (<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>),
  apple:   (<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>),
  deezer:  (<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18.81 11.843h3.838v1.324H18.81zm0-2.68h3.838v1.324H18.81zm0 5.357h3.838v1.326H18.81zM1.353 17.843h3.838v-1.326H1.353zm0-2.68h3.838v-1.324H1.353zm0-2.676h3.838v-1.324H1.353zm8.728 5.356h3.838v-1.326H10.08zm0-2.68h3.838v-1.324H10.08zm0-2.676h3.838v-1.324H10.08zm0-2.68h3.838V9.163H10.08zM5.718 17.843h3.838v-1.326H5.718zm0-2.68h3.838v-1.324H5.718zm0-2.676h3.838v-1.324H5.718zm0-2.68h3.838V9.163H5.718zm0-2.677h3.838V6.487H5.718zm4.362 8.033h3.838v-1.324H10.08zm4.362 2.68h3.838v-1.326H14.44zm0-2.68h3.838v-1.324H14.44zm0-2.676h3.838v-1.324H14.44z"/></svg>),
  tidal:   (<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004L8.008 8l4.004 4.004 4.005-4.004zm4.005 4.004l-4.005 4.004 4.005 4.005L20.016 12z"/></svg>),
};

export default function PlatformModal({ song, coverUrl, onClose }) {
  const [deezerUrl, setDeezerUrl] = useState(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    previewApi.get(song.title, song.artist)
      .then(d => setDeezerUrl(d?.deezerUrl || null))
      .catch(() => {});
  }, [song.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on overlay click
  function handleOverlay(e) {
    if (e.target === overlayRef.current) onClose();
  }

  function getUrl(platform) {
    if (platform.id === "deezer" && deezerUrl) return deezerUrl;
    return platform.searchUrl(song.title, song.artist);
  }

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlay}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div
            className={styles.cover}
            style={coverUrl
              ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: `linear-gradient(135deg, ${song.color2}, ${song.color})` }
            }
          >
            {!coverUrl && <span className={styles.coverEmoji}>{song.emoji}</span>}
          </div>
          <div className={styles.headerInfo}>
            <p className={styles.headerLabel}>Add to playlist on</p>
            <h2 className={styles.headerTitle}>{song.title}</h2>
            <p className={styles.headerArtist}>{song.artist}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        <div className={styles.divider} />

        {/* Platform list */}
        <div className={styles.platforms}>
          {PLATFORMS.map(platform => (
            <a
              key={platform.id}
              href={getUrl(platform)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.platformRow}
              style={{ "--c": platform.color }}
              onClick={onClose}
            >
              <div className={styles.platformIcon} style={{ background: `${platform.color}22`, color: platform.color }}>
                {ICONS[platform.icon]}
              </div>
              <div className={styles.platformInfo}>
                <span className={styles.platformName}>{platform.name}</span>
                <span className={styles.platformSub}>Search &amp; save to your library</span>
              </div>
              <div className={styles.platformArrow}>↗</div>
            </a>
          ))}
        </div>

        <p className={styles.footer}>
          Opens a search in the platform — you can save it to any playlist from there
        </p>
      </div>
    </div>
  );
}
