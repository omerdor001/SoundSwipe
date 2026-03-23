// src/components/PlatformMenu.jsx
import { useState, useEffect, useRef } from "react";
import { PLATFORMS } from "../utils/platformLinks";
import { previewApi } from "../api/client";
import styles from "./PlatformMenu.module.css";

const ICONS = {
  spotify: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a6.304 6.304 0 0 0-1.86-.805c-.643-.145-1.3-.158-1.943-.234-.002 0-.004-.002-.005-.002H5.917c-.002 0-.003.002-.005.002-.643.076-1.3.089-1.943.234a6.31 6.31 0 0 0-1.86.805C1.008 1.624.263 2.624-.054 3.934a9.23 9.23 0 0 0-.24 2.19C-.317 6.858-.33 7.498-.33 8.153v7.694c0 .655.013 1.295.036 1.978a9.23 9.23 0 0 0 .24 2.19c.317 1.31 1.062 2.31 2.18 3.043a6.304 6.304 0 0 0 1.86.805c.643.145 1.3.158 1.943.234H18.3c.643-.076 1.3-.089 1.943-.234a6.31 6.31 0 0 0 1.86-.805c1.118-.733 1.863-1.733 2.18-3.043a9.23 9.23 0 0 0 .24-2.19c.023-.683.036-1.323.036-1.978V8.153c0-.655-.013-1.295-.036-1.978 0-.017-.001-.034-.001-.051zm-6.691 1.81l-6.06 10.5a.48.48 0 0 1-.84 0l-1.59-2.754-1.59 2.754a.48.48 0 0 1-.84 0L4.38 9.84l-.96-1.664a.48.48 0 0 1 .416-.72h2.4a.48.48 0 0 1 .416.24l1.152 1.994 1.584-2.742a.48.48 0 0 1 .832 0l1.584 2.742 1.152-1.994a.48.48 0 0 1 .416-.24h2.4a.48.48 0 0 1 .416.72l-.885 1.538z"/>
    </svg>
  ),
  tidal: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004L8.008 8l4.004 4.004 4.005-4.004zm4.005 4.004l-4.005 4.004 4.005 4.005L20.016 12z"/>
    </svg>
  ),
};

export default function PlatformMenu({ song, onClose, buttonRef }) {
  const menuRef  = useRef(null);
  // "up" or "down" — calculated after mount based on available space
  const [direction, setDirection] = useState("up");
  // "left" or "right" — whether menu aligns to left or right of button
  const [align, setAlign]         = useState("right");

  // Calculate best position after the menu mounts
  useEffect(() => {
    if (!menuRef.current || !buttonRef?.current) return;

    const menuH   = menuRef.current.offsetHeight  || 340;
    const menuW   = menuRef.current.offsetWidth   || 280;
    const btnRect = buttonRef.current.getBoundingClientRect();
    const vp      = { w: window.innerWidth, h: window.innerHeight };

    // Vertical: prefer above, flip below if not enough room
    const spaceAbove = btnRect.top;
    const spaceBelow = vp.h - btnRect.bottom;
    setDirection(spaceAbove >= menuH + 8 ? "up" : "down");

    // Horizontal: prefer aligning to right edge of button,
    // flip to left-align if that would overflow the right edge
    const rightAlignLeft = btnRect.right - menuW;
    setAlign(rightAlignLeft >= 8 ? "right" : "left");
  }, [buttonRef]);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (
        menuRef.current   && !menuRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  function getUrl(platform) {
  return platform.searchUrl(song.title, song.artist);
}

  // Build inline position style
  const posStyle = {
    [direction === "up" ? "bottom" : "top"]: "calc(100% + 8px)",
    [align === "right" ? "right" : "left"]: 0,
  };

  return (
    <div className={styles.menu} ref={menuRef} style={posStyle}>
      <div className={styles.header}>
        <div className={styles.songName}>{song.title}</div>
        <div className={styles.artistName}>{song.artist}</div>
      </div>
      <div className={styles.divider} />
      <div className={styles.items}>
        {PLATFORMS.map(platform => (
          <a
            key={platform.id}
            href={getUrl(platform)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.item}
            style={{ "--platform-color": platform.color }}
            onClick={onClose}
          >
            <span className={styles.icon} style={{ color: platform.color }}>
              {ICONS[platform.icon]}
            </span>
            <div className={styles.itemText}>
              <span className={styles.itemName}>{platform.addLabel}</span>
              <span className={styles.itemSub}>Search &amp; add to your playlist</span>
            </div>
            <span className={styles.arrow}>↗</span>
          </a>
        ))}
      </div>
      <div className={styles.footer}>
        Links open the platform's search for this song
      </div>
    </div>
  );
}
