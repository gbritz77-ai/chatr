import React, { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Messages from "./pages/Messages";

/* ==========================================================
   🔒 Protected Route Wrapper
========================================================== */
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
}

/* ==========================================================
   🧭 Main App Component
========================================================== */
export default function App() {
  const soundRef = useRef(null);

  useEffect(() => {
    const currentUser =
      localStorage.getItem("username") || localStorage.getItem("profileName");
    if (!currentUser) return;

    // 🎵 Preload notification sound
    soundRef.current = new Audio("/sounds/mixkit-sci-fi-confirmation-914.wav");
    soundRef.current.volume = 0.6;

    // 🪄 Request browser notification permission once
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((perm) =>
        console.log("🔧 Notification permission:", perm)
      );
    }

    // 🧠 You can later re-add a real-time listener here (WebSocket, SSE, etc.)
    // For now, no polling or fetch calls.
  }, []);

  /* ======================================================
     🧭 App Routes
  ====================================================== */
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
