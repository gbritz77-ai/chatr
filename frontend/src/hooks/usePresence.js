import { useEffect, useState } from "react";

/**
 * Hook: Live presence tracker for a user.
 * Polls the API periodically and updates online status.
 *
 * Example:
 *   const isOnline = usePresence(username);
 */
export function usePresence(username, intervalMs = 5000) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!username) return;

    let cancelled = false;

    async function fetchPresence() {
      try {
        const base =
          import.meta.env.VITE_API_BASE ||
          "https://uzzbwh8vye.execute-api.eu-west-2.amazonaws.com/dev/api";
        const res = await fetch(`${base}/presence?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        if (!cancelled && data?.online !== undefined) {
          setOnline(Boolean(data.online));
        }
      } catch (err) {
        console.warn("⚠️ Presence check failed:", err);
      }
    }

    fetchPresence(); // initial check
    const timer = setInterval(fetchPresence, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [username, intervalMs]);

  return online;
}
