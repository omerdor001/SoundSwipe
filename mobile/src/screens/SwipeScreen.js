import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, API_URL } from '../context/AuthContext';
import SwipeCard from '../components/SwipeCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.55;

export default function SwipeScreen() {
  const { logout, token } = useAuth();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [genres, setGenres] = useState([
    'Pop', 'Rock', 'Hip Hop', 'Electronic', 'Indie', 'R&B', 'Jazz', 'Metal'
  ]);

  useEffect(() => {
    if (token) fetchSongs();
  }, [token]);

  const fetchSongs = async (genre = null) => {
    setLoading(true);
    setError('');
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
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.genreScroll}
        contentContainerStyle={styles.genreContainer}
      >
        {genres.map((genre) => (
          <TouchableOpacity
            key={genre}
            style={[
              styles.genreChip,
              selectedGenre === genre && styles.genreChipActive,
            ]}
            onPress={() => {
              setSelectedGenre(genre === selectedGenre ? null : genre);
              fetchSongs(genre === selectedGenre ? null : genre);
            }}
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
  logoutBtn: {
    padding: 8,
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
  genreText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  genreTextActive: {
    color: '#fff',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
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
