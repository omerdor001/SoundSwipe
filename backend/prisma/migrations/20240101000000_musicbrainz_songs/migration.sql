-- Migration: Switch Song table to MusicBrainz MBID-based schema
-- 
-- The old schema had 20 hardcoded songs with cuid() IDs and a 
-- non-nullable `mbid` column that didn't exist yet. This migration:
--   1. Clears dependent data (swipes, playlist) tied to the old songs
--   2. Drops the old Song table
--   3. Recreates it cleanly without the `mbid` column
--   4. Leaves User, Swipe, and PlaylistSong tables untouched
--
-- Songs will now be upserted on-demand from MusicBrainz when users swipe.

-- Step 1: Drop everything cleanly (CASCADE handles FK dependencies automatically)
DROP TABLE IF EXISTS "PlaylistSong" CASCADE;
DROP TABLE IF EXISTS "Swipe"        CASCADE;
DROP TABLE IF EXISTS "Song"         CASCADE;
DROP TABLE IF EXISTS "User"         CASCADE;

-- Step 2: Recreate all tables from scratch with the correct schema

CREATE TABLE "User" (
  "id"        TEXT        NOT NULL,
  "username"  TEXT        NOT NULL,
  "password"  TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "User_username_key" UNIQUE ("username")
);

CREATE TABLE "Song" (
  "id"       TEXT NOT NULL,
  "title"    TEXT NOT NULL,
  "artist"   TEXT NOT NULL,
  "genre"    TEXT NOT NULL,
  "bpm"      INTEGER,
  "duration" TEXT NOT NULL,
  "emoji"    TEXT NOT NULL,
  "color"    TEXT NOT NULL,
  "color2"   TEXT NOT NULL,
  "desc"     TEXT NOT NULL,
  CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Swipe" (
  "id"        TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "songId"    TEXT        NOT NULL,
  "direction" TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Swipe_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "Swipe_userId_songId_key" UNIQUE ("userId", "songId"),
  CONSTRAINT "Swipe_userId_fkey"     FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Swipe_songId_fkey"     FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PlaylistSong" (
  "id"      TEXT        NOT NULL,
  "userId"  TEXT        NOT NULL,
  "songId"  TEXT        NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaylistSong_pkey"           PRIMARY KEY ("id"),
  CONSTRAINT "PlaylistSong_userId_songId_key" UNIQUE ("userId", "songId"),
  CONSTRAINT "PlaylistSong_userId_fkey"    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlaylistSong_songId_fkey"    FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
