import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PLATFORMS = [
  {
    id: 'spotify',
    name: 'Spotify',
    color: '#1DB954',
    icon: 'musical-notes',
    searchUrl: (title, artist) => `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`,
  },
  {
    id: 'apple',
    name: 'Apple Music',
    color: '#FC3C44',
    icon: 'logo-apple',
    searchUrl: (title, artist) => `https://music.apple.com/search?term=${encodeURIComponent(`${title} ${artist}`)}`,
  },
  {
    id: 'youtube',
    name: 'YouTube Music',
    color: '#FF0000',
    icon: 'logo-youtube',
    searchUrl: (title, artist) => `https://music.youtube.com/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
  },
  {
    id: 'tidal',
    name: 'Tidal',
    color: '#00FFFF',
    icon: 'water',
    searchUrl: (title, artist) => `https://tidal.com/search/${encodeURIComponent(`${title} ${artist}`)}`,
  },
];

export default function PlatformModal({ song, visible, onClose }) {
  const getUrl = (platform) => {
    return platform.searchUrl(song.title, song.artist);
  };

  const handlePress = async (platform) => {
    const url = getUrl(platform);
    try {
      await Linking.openURL(url);
    } catch {
      console.log('Could not open URL');
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.modal}>
          <View style={styles.header}>
            {song.coverUrl ? (
              <Image source={{ uri: song.coverUrl }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, { backgroundColor: song.color }]}>
                <Text style={styles.emoji}>{song.emoji || '🎵'}</Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.headerLabel}>Add to playlist on</Text>
              <Text style={styles.headerTitle} numberOfLines={2}>{song.title}</Text>
              <Text style={styles.headerArtist} numberOfLines={1}>{song.artist}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.platforms}>
            {PLATFORMS.map((platform) => (
              <TouchableOpacity
                key={platform.id}
                style={styles.platformRow}
                onPress={() => handlePress(platform)}
              >
                <View style={[styles.platformIcon, { backgroundColor: `${platform.color}22` }]}>
                  <Ionicons name={platform.icon} size={20} color={platform.color} />
                </View>
                <View style={styles.platformInfo}>
                  <Text style={styles.platformName}>{platform.name}</Text>
                  <Text style={styles.platformSub}>Search & save</Text>
                </View>
                <Ionicons name="open-outline" size={20} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.footer}>
            Opens a search in the platform
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  cover: {
    width: 70,
    height: 70,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 32,
  },
  headerInfo: {
    flex: 1,
  },
  headerLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerArtist: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  closeBtn: {
    padding: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
  },
  platforms: {
    padding: 16,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    gap: 14,
  },
  platformIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformInfo: {
    flex: 1,
  },
  platformName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  platformSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  footer: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 20,
  },
});
