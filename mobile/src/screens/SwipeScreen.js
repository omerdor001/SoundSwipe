import React, { useState, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth, API_URL } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const currentSong = songs[currentIndex];

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  useEffect(() => {
    if (token) fetchSongs();
  }, [token]);

  useEffect(() => {
    if (currentSong && token) {
      setPreviewUrl(null);
      setIsPlaying(false);
      setPreviewLoading(true);
      if (sound) {
        sound.unloadAsync();
        setSound(null);
      }
      fetchPreview(currentSong);
    }
  }, [currentIndex, currentSong?.id, token]);

  useEffect(() => {
    if (!loadingMore && !loading && songs.length > 0 && currentIndex >= songs.length - 3) {
      fetchMoreSongs();
    }
  }, [currentIndex, songs.length]);

  const fetchMoreSongs = async () => {
    if (loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const url = selectedGenre
        ? `${API_URL}/api/songs?genre=${selectedGenre.toLowerCase()}&refresh=true`
        : `${API_URL}/api/songs?refresh=true`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSongs(data);
        setCurrentIndex(0);
      }
    } catch {}
    setLoadingMore(false);
  };

  const fetchPreview = async (song) => {
    try {
      const res = await fetch(`${API_URL}/api/preview?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPreviewLoading(false);
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
    } catch {
      setPreviewLoading(false);
    }
  };

  const togglePreview = async () => {
    if (!previewUrl) return;
    
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch {}
      setSound(null);
    }
    
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true }
      );
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      setSound(newSound);
      setIsPlaying(true);
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

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

  const renderCard = () => {
    if (!currentSong) return null;
    
    return (
      <View style={styles.cardSection}>
        <View style={styles.card}>
          {currentSong.coverUrl ? (
            <Image source={{ uri: currentSong.coverUrl }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.emojiCover]}>
              <Text style={styles.emoji}>{currentSong.emoji || '🎵'}</Text>
            </View>
          )}
          
          <LinearGradient
            colors={['transparent', 'rgba(10,10,10,0.7)', 'rgba(10,10,10,1)']}
            style={styles.gradient}
          >
            <View style={styles.topGradient}>
              <View style={styles.genreBadge}>
                <Text style={styles.genreBadgeText}>{currentSong.genre}</Text>
              </View>
            </View>

            <View style={styles.content}>
              <Text style={styles.title} numberOfLines={2}>
                {currentSong.title}
              </Text>
              <Text style={styles.artist}>{currentSong.artist}</Text>
              
              <View style={styles.meta}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.metaText}>{currentSong.duration || '?:??'}</Text>
                </View>
                {currentSong.bpm && (
                  <View style={styles.metaItem}>
                    <Ionicons name="pulse-outline" size={14} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.metaText}>{currentSong.bpm} BPM</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity 
                style={[styles.previewBtn, (!previewUrl || previewLoading) && styles.previewBtnDisabled]} 
                onPress={togglePreview}
                disabled={!previewUrl || previewLoading}
              >
                {previewLoading ? (
                  <ActivityIndicator size="small" color="#ff6b6b" />
                ) : (
                  <Ionicons 
                    name={isPlaying ? "pause-circle" : "play-circle"} 
                    size={32} 
                    color="#ff6b6b" 
                  />
                )}
                <Text style={[styles.previewText, (!previewUrl || previewLoading) && styles.previewTextDisabled]}>
                  {previewLoading ? 'Loading...' : (isPlaying ? 'Pause' : '30s Preview')}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (loading && songs.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ff6b6b" />
        </View>
      );
    }

    if (error && songs.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.resetButton} onPress={logout}>
            <Text style={styles.resetText}>LOG OUT</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentIndex >= songs.length && !loadingMore) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.doneIcon}>🎵</Text>
          <Text style={styles.doneTitle}>All Done!</Text>
          <Text style={styles.doneText}>
            Tap refresh to load more songs</Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => fetchSongs(selectedGenre)}
          >
            <Text style={styles.resetText}>REFRESH</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (loadingMore) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ff6b6b" />
          <Text style={styles.loadingMoreText}>Loading more songs...</Text>
        </View>
      );
    }

    return renderCard();
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
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

        <View style={styles.genreSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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
              <Text style={[styles.genreChipText, selectedGenre === null && !loadingSimilar && styles.genreChipTextActive]}>
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
                    styles.genreChipText,
                    selectedGenre === genre && styles.genreChipTextActive,
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
                <Text style={[styles.genreChipText, styles.genreChipTextSpecial]}>
                  ✨ Similar
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
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

      {renderContent()}

      {currentSong && currentIndex < songs.length && (
        <View style={styles.controlsSection}>
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerSection: {
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
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
  genreSection: {
    paddingBottom: 10,
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
  genreChipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  genreChipTextActive: {
    color: '#fff',
  },
  genreChipTextSpecial: {
    color: '#ffd700',
  },
  cardSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 1.1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#151515',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
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
    fontSize: 80,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    justifyContent: 'space-between',
  },
  topGradient: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  genreBadge: {
    backgroundColor: 'rgba(255,107,107,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  genreBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  artist: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  meta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,107,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
  },
  previewBtnDisabled: {
    opacity: 0.5,
    borderColor: 'rgba(255,107,107,0.2)',
  },
  previewText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
  },
  previewTextDisabled: {
    color: 'rgba(255,107,107,0.5)',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
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
  loadingMoreText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 15,
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
  controlsSection: {
    backgroundColor: '#0a0a0a',
    paddingBottom: 30,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingVertical: 15,
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
    paddingBottom: 10,
  },
  hint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    letterSpacing: 1,
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
});
