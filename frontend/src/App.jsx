// src/App.jsx
import { useEffect, useState } from "react";
import useStore from "./store/useStore";
import LoginScreen from "./pages/LoginScreen";
import MainApp from "./pages/MainApp";

export default function App() {
  const { user, token, restoreSession } = useStore();
  const [spotifyCallback, setSpotifyCallback] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssToken = params.get("token");
    const username = params.get("username");
    const error = params.get("error");

    if (ssToken) {
      localStorage.setItem("ss_token", ssToken);
      useStore.setState({ token: ssToken, user: { username } });
      window.history.replaceState({}, "", "/");
      restoreSession();
    } else if (error) {
      window.history.replaceState({}, "", "/");
    }

    if (params.has("token") || params.has("error")) {
      setSpotifyCallback(true);
    }
  }, []);

  useEffect(() => {
    if (token && !user) restoreSession();
  }, [token]);

  if (!user) return <LoginScreen />;
  return <MainApp />;
}
