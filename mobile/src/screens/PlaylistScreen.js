import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth, API_URL } from '../context/AuthContext';
import PlatformModal from '../components/PlatformModal';

function parseDuration(duration) {
  if (!duration || duration === '?:??') return 0;
  const parts = duration.split(':');
  if (parts.length === 2) {
    const [min, sec] = parts;
    return (parseInt(min) || 0) * 60 + (parseInt(sec) || 0);
  }
  return 0;
}

function formatTotalTime(totalSeconds) {
  if (totalSeconds === 0) return '0:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function PlaylistScreen() {
  const { logout, token } = useAuth();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [showPlatformModal, setShowPlatformModal] = useState(false);

  const totalDuration = useMemo(() => {
    return songs.reduce((total, song) => total + parseDuration(song.duration), 0);
  }, [songs]);

  useFocusEffect(
    useCallback(() => {
      if (token) fetchPlaylist();
    }, [token])
  );

  const fetchPlaylist = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/playlist`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSongs(data);
      } else {
        setSongs([]);
      }
    } catch (err) {
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  const removeSong = async (songId) => {
    try {
      await fetch(`${API_URL}/api/playlist/${songId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });
      setSongs(prev => prev.filter(s => s.id !== songId));
    } catch (err) {
    }
  };

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(search.toLowerCase()) ||
      song.artist.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.songRow}
      onPress={() => {
        setSelectedSong(item);
        setShowPlatformModal(true);
      }}
    >
      <View style={styles.songNumber}>
        <Text style={styles.number}>{index + 1}</Text>
      </View>

      {item.coverUrl ? (
        <Image source={{ uri: item.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.emojiCover]}>
          <Text style={styles.emoji}>{item.emoji || '🎵'}</Text>
        </View>
      )}

      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.songArtist} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>

      <View style={styles.songMeta}>
        <Text style={styles.duration}>{item.duration || '?:??'}</Text>
        <View style={styles.genreBadge}>
          <Text style={styles.genreText}>{item.genre}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => removeSong(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Playlist</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <View style={styles.statChip}>
          <Text style={styles.statNumber}>{songs.length}</Text>
          <Text style={styles.statLabel}>Songs</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statNumber}>{formatTotalTime(totalDuration)}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search songs..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#ff6b6b" />
        </View>
      ) : songs.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🎵</Text>
          <Text style={styles.emptyTitle}>No songs yet</Text>
          <Text style={styles.emptyText}>
            Start swiping to build your playlist!
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSongs}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <PlatformModal
        song={selectedSong || {}}
        visible={showPlatformModal}
        onClose={() => {
          setShowPlatformModal(false);
          setSelectedSong(null);
        }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutBtn: {
    padding: 8,
  },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 12,
  },
  statChip: {
    backgroundColor: 'rgba(255,107,107,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    marginHorizontal: 20,
    marginBottom: 15,
    paddingHorizontal: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 15,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    gap: 14,
  },
  songNumber: {
    width: 24,
    alignItems: 'center',
  },
  number: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
  cover: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  emojiCover: {
    backgroundColor: 'rgba(255,107,107,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 24,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  songArtist: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  songMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  duration: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  genreBadge: {
    backgroundColor: 'rgba(255,107,107,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  genreText: {
    color: '#ff8a8a',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  removeBtn: {
    padding: 8,
  },
});
