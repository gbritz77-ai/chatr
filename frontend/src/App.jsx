import React, { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Messages from "./pages/Messages";
import { API_BASE } from "./lib/api";

/* ==========================================================
   🔒 Protected Route Wrapper
========================================================== */
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
}

/* ==========================================================
   🧭 Main App Component + Global Background Notifications
========================================================== */
export default function App() {
  const lastUnread = useRef(0);
  const soundRef = useRef(null);
  const initialCheckDone = useRef(false);

  useEffect(() => {
    const currentUser =
      localStorage.getItem("username") || localStorage.getItem("profileName");
    if (!currentUser) return;

    // 🎵 Preload sound
    soundRef.current = new Audio("/sounds/mixkit-sci-fi-confirmation-914.wav");
    soundRef.current.volume = 0.6;

    // 🪄 Ask for browser notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((perm) =>
        console.log("🔧 Notification permission:", perm)
      );
    }

    /* ======================================================
       🔁 Check Unread Counts (includes initial trigger)
    ====================================================== */
    async function checkUnread(initial = false) {
      try {
        const res = await fetch(
          `${API_BASE}/messages/unread-counts?username=${encodeURIComponent(
            currentUser
          )}`
        );
        const raw = await res.json();
        const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;

        if (data?.success && typeof data.unreadMap === "object") {
          const totalUnread = Object.values(data.unreadMap).reduce(
            (a, b) => a + b,
            0
          );

          // ✅ First load: play sound if there are any unread messages
          if (!initialCheckDone.current && totalUnread > 0) {
            console.log("🔔 Initial unread messages detected!");
            soundRef.current?.play().catch(() => {});
            initialCheckDone.current = true;
          }

          // 🔔 Trigger when unread count increases later
          if (initialCheckDone.current && totalUnread > lastUnread.current) {
            console.log("🔔 New global message detected!");

            soundRef.current?.play().catch(() => {});

            // 🪄 Desktop notification
            if ("Notification" in window && Notification.permission === "granted") {
              const notif = new Notification("💬 GeeBee’z CHATr", {
                body: "You have new messages waiting",
                icon: "/logo/logo.JPG",
                badge: "/logo/logo.JPG",
                silent: true,
              });

              notif.onclick = (event) => {
                event.preventDefault();
                window.focus();
                notif.close();
              };
            }

            // 💡 Flash tab title if backgrounded
            if (document.hidden) {
              let flashing = true;
              const interval = setInterval(() => {
                document.title = flashing ? "💬 New message!" : "CHATr";
                flashing = !flashing;
              }, 1000);
              const stopFlash = () => {
                clearInterval(interval);
                document.title = "CHATr";
                window.removeEventListener("focus", stopFlash);
              };
              window.addEventListener("focus", stopFlash);
              setTimeout(stopFlash, 7000);
            }
          }

          lastUnread.current = totalUnread;
          if (!initialCheckDone.current) initialCheckDone.current = true;
        }
      } catch (err) {
        console.error("❌ Failed to check unread messages:", err);
      }
    }

    // 🚀 Run initial check + polling every 6 seconds
    checkUnread(true);
    const interval = setInterval(() => checkUnread(false), 6000);
    return () => clearInterval(interval);
  }, []);

  /* ======================================================
     🧭 App Routing
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
