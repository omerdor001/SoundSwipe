import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth, API_URL } from '../context/AuthContext';

export default function SwipeCard({ song, isTop, style }) {
  const { token } = useAuth();
  const [previewUrl, setPreviewUrl] = useState(song.previewUrl || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [coverUrl, setCoverUrl] = useState(song.coverUrl);
  const [sound, setSound] = useState(null);

  useEffect(() => {
    if (sound) {
      sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
    }
    if (song.previewUrl) {
      setPreviewUrl(song.previewUrl);
    } else if (token) {
      fetchPreview();
    }
  }, [song.id, song.previewUrl, token]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const fetchPreview = async () => {
    try {
      const res = await fetch(`${API_URL}/api/preview?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.previewUrl) setPreviewUrl(data.previewUrl);
      if (data.coverUrl && !song.coverUrl) setCoverUrl(data.coverUrl);
    } catch {}
  };

  const togglePreview = async () => {
    if (!previewUrl) return;
    
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
    
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: previewUrl },
      { shouldPlay: true },
      (status) => {
        if (status.didJustFinish) setIsPlaying(false);
      }
    );
    setSound(newSound);
    setIsPlaying(true);
  };

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

          {previewUrl && (
            <TouchableOpacity style={styles.previewBtn} onPress={togglePreview}>
              <Ionicons 
                name={isPlaying ? "pause-circle" : "play-circle"} 
                size={48} 
                color="#ff6b6b" 
              />
              <Text style={styles.previewText}>
                {isPlaying ? 'Pause' : '30s Preview'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
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
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
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
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,107,0.15)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    marginTop: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
  },
  previewText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
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
