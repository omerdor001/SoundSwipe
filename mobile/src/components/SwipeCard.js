import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, API_URL } from '../context/AuthContext';

export default function SwipeCard({ song, isTop, style, previewUrl, isPlaying, onTogglePreview }) {
  const { token } = useAuth();
  const [coverUrl, setCoverUrl] = useState(song.coverUrl);

  useEffect(() => {
    if (song.coverUrl) {
      setCoverUrl(song.coverUrl);
    }
  }, [song.id, song.coverUrl, token]);

  return (
    <View style={[styles.card, style]}>
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.emojiCover]}>
          <Text style={styles.emoji}>{song.emoji || '🎵'}</Text>
        </View>
      )}
      
      <LinearGradient
        colors={['transparent', 'rgba(10,10,10,0.5)', 'rgba(10,10,10,0.98)']}
        style={styles.gradient}
      >
        <View style={styles.topGradient}>
          <View style={styles.genreBadge}>
            <Text style={styles.genreText}>{song.genre}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {song.title}
          </Text>
          <Text style={styles.artist}>{song.artist}</Text>
          
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.metaText}>{song.duration || '?:??'}</Text>
            </View>
            {song.bpm && (
              <View style={styles.metaItem}>
                <Ionicons name="pulse-outline" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.metaText}>{song.bpm} BPM</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.previewContainer}>
        <TouchableOpacity 
          style={[styles.previewBtn, !previewUrl && styles.previewBtnDisabled]} 
          onPress={onTogglePreview}
          disabled={!previewUrl}
        >
          <Ionicons 
            name={isPlaying ? "pause-circle" : "play-circle"} 
            size={36} 
            color={previewUrl ? "#ff6b6b" : "rgba(255,107,107,0.3)"} 
          />
          <Text style={[styles.previewText, !previewUrl && styles.previewTextDisabled]}>
            {previewUrl ? (isPlaying ? 'Pause' : '30s Preview') : 'Loading...'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#151515',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  cover: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  emojiCover: {
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 100,
  },
  gradient: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    height: '55%',
    justifyContent: 'space-between',
  },
  topGradient: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  genreBadge: {
    backgroundColor: 'rgba(255,107,107,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    alignSelf: 'flex-start',
  },
  genreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(10,10,10,0.95)',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  previewBtnDisabled: {
    opacity: 0.5,
  },
  previewText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
  },
  previewTextDisabled: {
    color: 'rgba(255,107,107,0.3)',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  artist: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  meta: {
    flexDirection: 'row',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
});
