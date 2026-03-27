# SoundSwipe Mobile

React Native mobile app for the SoundSwipe music discovery platform.

## Features

- Tinder-style swipe interface for music discovery
- Genre filtering
- Personal playlist management
- Dark theme with coral accent colors

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your mobile device (for testing)

### Installation

```bash
cd mobile
npm install
```

### Configuration

1. Update the API URL in these files:
   - `src/context/AuthContext.js`
   - `src/screens/SwipeScreen.js`
   - `src/screens/PlaylistScreen.js`

Replace `http://YOUR_IP:3001` with your backend server IP address.

### Running

```bash
# Start Expo
npm start

# On Android
npm run android

# On iOS
npm run ios
```

### Build APK (Android)

```bash
npx expo export --platform android
eas build --platform android --local
```

## Project Structure

```
mobile/
├── App.js                 # Main app entry
├── index.js              # Expo entry point
├── app.json              # Expo configuration
├── src/
│   ├── context/
│   │   └── AuthContext.js    # Authentication state
│   ├── screens/
│   │   ├── LoginScreen.js    # Login/Signup
│   │   ├── SwipeScreen.js    # Music discovery
│   │   └── PlaylistScreen.js  # Liked songs
│   └── components/
│       └── SwipeCard.js      # Swipeable card
```

## Tech Stack

- React Native (Expo)
- Expo Navigation (Bottom Tabs)
- React Native Reanimated (Animations)
- Linear Gradient
- Ionicons
