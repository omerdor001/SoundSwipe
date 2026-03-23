// src/App.jsx
import { useEffect } from "react";
import useStore from "./store/useStore";
import LoginScreen from "./pages/LoginScreen";
import MainApp from "./pages/MainApp";

export default function App() {
  const { user, token, restoreSession } = useStore();

  useEffect(() => {
    if (token) restoreSession();
  }, []);

  if (!user) return <LoginScreen />;
  return <MainApp />;
}
