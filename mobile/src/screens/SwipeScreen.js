import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth, API_URL } from '../context/AuthContext';
import SwipeCard from '../components/SwipeCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.65;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.48;

const SEARCH_MODES = [
  { id: 'title', label: 'Title' },
  { id: 'artist', label: 'Artist' },
  { id: 'both', label: 'Both' },
];

export default function SwipeScreen() {
  const { logout, token } = useAuth();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchMode, setSearchMode] = useState('both');
  const [searchTitle, setSearchTitle] = useState('');
  const [searchArtist, setSearchArtist] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [genres] = useState([
    'Pop', 'Rock', 'Hip Hop', 'Electronic', 'Jazz', 'Metal', 'Country', 'R&B', 'Indie'
  ]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState(null);

  const currentSong = songs[currentIndex];

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  useEffect(() => {
    if (currentSong && token) {
      setPreviewUrl(null);
      setIsPlaying(false);
      if (sound) {
        sound.unloadAsync();
        setSound(null);
      }
      fetchPreview(currentSong);
    }
  }, [currentIndex, currentSong?.id]);

  const fetchPreview = async (song) => {
    try {
      const res = await fetch(`${API_URL}/api/preview?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
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

  useEffect(() => {
    if (token) fetchSongs();
  }, [token]);

  const fetchSongs = async (genre = null) => {
    setLoading(true);
    setError('');
    setSelectedGenre(genre);
    try {
      const url = genre
        ? `${API_URL}/api/songs?genre=${genre.toLowerCase()}`
        : `${API_URL}/api/songs`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSongs(data);
        setCurrentIndex(0);
      } else if (res.status === 401) {
        setError('Not logged in. Please log out and log in again.');
        setSongs([]);
      } else {
        setError('Failed to load songs');
        setSongs([]);
      }
    } catch (err) {
      setError('Network error. Check your connection.');
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSimilar = async () => {
    setLoadingSimilar(true);
    setLoading(true);
    setError('');
    setSelectedGenre(null);
    try {
      const res = await fetch(`${API_URL}/api/songs/similar?limit=20`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSongs(data);
        setCurrentIndex(0);
      } else {
        setError('Like some songs first to get recommendations!');
        setSongs([]);
      }
    } catch (err) {
      setError('Failed to load similar songs');
      setSongs([]);
    } finally {
      setLoading(false);
      setLoadingSimilar(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setSelectedGenre(null);
    setShowSearch(false);
    try {
      let url = `${API_URL}/api/songs/search?mode=${searchMode}`;
      if (searchMode === 'title' && searchQuery) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      } else if (searchMode === 'artist' && searchQuery) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      } else if (searchMode === 'both' && (searchTitle || searchArtist)) {
        url += `&title=${encodeURIComponent(searchTitle)}&artist=${encodeURIComponent(searchArtist)}`;
      } else {
        setLoading(false);
        return;
      }
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSongs(data);
        setCurrentIndex(0);
      } else {
        setError('No songs found');
        setSongs([]);
      }
    } catch (err) {
      setError('Search failed');
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction) => {
    if (currentIndex >= songs.length) return;

    const song = songs[currentIndex];
    try {
      await fetch(`${API_URL}/api/swipes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ song, direction }),
      });
    } catch (err) {
      console.log('Failed to save swipe');
    }

    setCurrentIndex(prev => prev + 1);
  };

  const renderCards = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#ff6b6b" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.resetButton} onPress={logout}>
            <Text style={styles.resetText}>LOG OUT</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentIndex >= songs.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.doneIcon}>🎵</Text>
          <Text style={styles.doneTitle}>All Done!</Text>
          <Text style={styles.doneText}>
            You've seen all songs. Check back later!
          </Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => fetchSongs(selectedGenre)}
          >
            <Text style={styles.resetText}>REFRESH</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cardContainer}>
        {songs.slice(currentIndex, currentIndex + 2).map((song, index) => {
          const isTop = index === 0;
          return (
            <SwipeCard
              key={song.id}
              song={song}
              isTop={isTop}
              onSwipe={handleSwipe}
              previewUrl={isTop ? previewUrl : null}
              isPlaying={isTop ? isPlaying : false}
              onTogglePreview={isTop ? togglePreview : undefined}
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                zIndex: songs.length - currentIndex - index,
                transform: [
                  { scale: isTop ? 1 : 0.95 },
                  { translateY: isTop ? 0 : 15 },
                ],
              }}
            />
          );
        })}
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#1a1a1a', '#0a0a0a']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>SoundSwipe</Text>
        <View style={styles.headerBtns}>
          <TouchableOpacity onPress={() => setShowSearch(true)} style={styles.headerBtn}>
            <Ionicons name="search" size={24} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.headerBtn}>
            <Ionicons name="log-out-outline" size={24} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showSearch} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.searchModal}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Search Songs</Text>
              <TouchableOpacity onPress={() => setShowSearch(false)}>
                <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <View style={styles.modeToggle}>
              {SEARCH_MODES.map(mode => (
                <TouchableOpacity
                  key={mode.id}
                  style={[styles.modeBtn, searchMode === mode.id && styles.modeBtnActive]}
                  onPress={() => setSearchMode(mode.id)}
                >
                  <Text style={[styles.modeBtnText, searchMode === mode.id && styles.modeBtnTextActive]}>
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {searchMode === 'both' ? (
              <>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Song title..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={searchTitle}
                  onChangeText={setSearchTitle}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Artist name..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={searchArtist}
                  onChangeText={setSearchArtist}
                />
              </>
            ) : (
              <TextInput
                style={styles.searchInput}
                placeholder={searchMode === 'title' ? 'Song title...' : 'Artist name...'}
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            )}

            <TouchableOpacity style={styles.searchSubmit} onPress={handleSearch}>
              <Text style={styles.searchSubmitText}>SEARCH</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.genreScroll}
        contentContainerStyle={styles.genreContainer}
      >
        <TouchableOpacity
          style={[
            styles.genreChip,
            styles.genreChipSpecial,
            selectedGenre === null && !loadingSimilar && styles.genreChipActive,
          ]}
          onPress={() => fetchSongs(null)}
        >
          <Text style={[styles.genreText, selectedGenre === null && !loadingSimilar && styles.genreTextActive]}>
            All
          </Text>
        </TouchableOpacity>

        {genres.map((genre) => (
          <TouchableOpacity
            key={genre}
            style={[
              styles.genreChip,
              selectedGenre === genre && styles.genreChipActive,
            ]}
            onPress={() => fetchSongs(genre)}
          >
            <Text
              style={[
                styles.genreText,
                selectedGenre === genre && styles.genreTextActive,
              ]}
            >
              {genre}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[
            styles.genreChip,
            styles.genreChipSpecial,
            loadingSimilar && styles.genreChipActive,
          ]}
          onPress={fetchSimilar}
          disabled={loadingSimilar}
        >
          {loadingSimilar ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.genreText, styles.genreTextSpecial]}>
              ✨ Similar
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {renderCards()}

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, styles.controlNo]}
          onPress={() => handleSwipe('left')}
        >
          <Ionicons name="close" size={32} color="#ff4757" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.controlYes]}
          onPress={() => handleSwipe('right')}
        >
          <Ionicons name="heart" size={36} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.hints}>
        <Text style={styles.hint}>← Skip  |  Like →</Text>
      </View>
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
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  headerBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  searchModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderRadius: 25,
    padding: 4,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  modeBtnActive: {
    backgroundColor: '#ff6b6b',
  },
  modeBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#fff',
  },
  searchInput: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
  },
  searchSubmit: {
    backgroundColor: '#ff6b6b',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  searchSubmitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  genreScroll: {
    maxHeight: 50,
  },
  genreContainer: {
    paddingHorizontal: 20,
    gap: 10,
    flexDirection: 'row',
  },
  genreChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: 'rgba(255,107,107,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
  },
  genreChipActive: {
    backgroundColor: '#ff6b6b',
    borderColor: '#ff6b6b',
  },
  genreChipSpecial: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderColor: 'rgba(255,215,0,0.4)',
  },
  genreText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  genreTextActive: {
    color: '#fff',
  },
  genreTextSpecial: {
    color: '#ffd700',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  doneIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  doneText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 30,
  },
  errorIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  errorText: {
    color: '#ff4757',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  resetButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
  },
  resetText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    paddingVertical: 20,
    paddingBottom: 30,
  },
  controlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  controlNo: {
    backgroundColor: 'rgba(255,71,87,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,71,87,0.5)',
  },
  controlYes: {
    backgroundColor: '#00d26a',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  hints: {
    alignItems: 'center',
    paddingBottom: 100,
  },
  hint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    letterSpacing: 1,
  },
});
