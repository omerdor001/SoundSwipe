import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';
import { useAuth, API_URL } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const { login, signup, loginWithToken } = useAuth();

  const redirectUri = makeRedirectUri({
    scheme: 'soundswipe',
    path: 'spotify-callback',
  });

  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: '50750d50b93e42a8913a3e691226e906',
      scopes: ['user-read-private', 'user-read-email'],
      redirectUri,
    },
    discovery
  );

  useEffect(() => {
    const handleSpotifyResponse = async () => {
      if (response?.type === 'success') {
        const { code } = response.params;
        const codeVerifier = request?.codeVerifier;
        
        try {
          const res = await fetch(`${API_URL}/api/auth/spotify/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirectUri, codeVerifier }),
          });
          
          const data = await res.json();
          
          if (res.ok && data.token) {
            await loginWithToken(
              { id: data.userId, username: data.username || '', spotifyId: data.spotifyId },
              data.token
            );
          } else {
            setError(data.error || 'Spotify login failed');
          }
        } catch (err) {
          setError('Connection failed. Check your network.');
        }
        setSpotifyLoading(false);
      } else if (response?.type === 'error') {
        setError('Spotify login was cancelled');
        setSpotifyLoading(false);
      }
    };
    
    handleSpotifyResponse();
  }, [response]);

  const handleSubmit = async () => {
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isLogin && (password.length < 8 || password.length > 16)) {
      setError('Password must be 8-16 characters');
      return;
    }

    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await signup(username, password);
      }
    } catch (err) {
      setError(err.message || 'Connection failed. Check your network.');
    } finally {
      setLoading(false);
    }
  };

  const handleSpotifyLogin = async () => {
    setError('');
    setSpotifyLoading(true);
    try {
      await promptAsync();
    } catch (err) {
      setError('Spotify login failed. Please try again.');
    }
    setSpotifyLoading(false);
  };

  return (
    <LinearGradient
      colors={['#1a1a1a', '#0a0a0a']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>SoundSwipe</Text>
          <Text style={styles.subtitle}>MUSIC DISCOVERY</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, isLogin && styles.tabActive]}
            onPress={() => setIsLogin(true)}
          >
            <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>
              LOGIN
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isLogin && styles.tabActive]}
            onPress={() => setIsLogin(false)}
          >
            <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>
              SIGN UP
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>USERNAME</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry
            />
          </View>

          {!isLogin && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                secureTextEntry
              />
            </View>
          )}

          {!isLogin && (
            <Text style={styles.passwordHint}>
              Password: 8-16 chars, letter, number, symbol
            </Text>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {isLogin ? 'LOGIN' : 'CREATE ACCOUNT'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.spotifyButton, (spotifyLoading || !request) && styles.buttonDisabled]}
            onPress={handleSpotifyLogin}
            disabled={spotifyLoading || !request}
          >
            {spotifyLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.spotifyIcon}>♫</Text>
                <Text style={styles.spotifyText}>CONTINUE WITH SPOTIFY</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#151515',
    borderRadius: 30,
    padding: 6,
    marginBottom: 30,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 25,
  },
  tabActive: {
    backgroundColor: '#ff6b6b',
  },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: '#fff',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 10,
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: '#fff',
    fontSize: 16,
  },
  passwordHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: -8,
  },
  error: {
    color: '#ff4757',
    textAlign: 'center',
    backgroundColor: 'rgba(255,71,87,0.1)',
    padding: 14,
    borderRadius: 16,
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: '#ff6b6b',
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 16,
    fontSize: 12,
  },
  spotifyButton: {
    backgroundColor: '#1DB954',
    borderRadius: 30,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  spotifyIcon: {
    color: '#fff',
    fontSize: 20,
  },
  spotifyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
