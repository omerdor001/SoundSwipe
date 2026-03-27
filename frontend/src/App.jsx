// src/App.jsx
import { useEffect, useState } from "react";
import useStore from "./store/useStore";
import LoginScreen from "./pages/LoginScreen";
import MainApp from "./pages/MainApp";

export default function App() {
  const { user, restoreSession } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loggedin = params.get("loggedin");
    const error = params.get("error");
    const token = params.get("token");

    if (token) {
      sessionStorage.setItem("ss_token", token);
    }

    if (loggedin === "true") {
      window.history.replaceState({}, "", "/");
      restoreSession().then(() => setLoading(false));
    } else if (error) {
      window.history.replaceState({}, "", "/");
      setLoading(false);
    } else {
      restoreSession().then(() => setLoading(false));
    }
  }, []);

  if (loading) return null;
  if (!user) return <LoginScreen />;
  return <MainApp />;
}