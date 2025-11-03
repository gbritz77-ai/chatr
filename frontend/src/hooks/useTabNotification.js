// src/hooks/useTabNotification.js
import { useEffect } from "react";

export function useTabNotification(unreadCount) {
  useEffect(() => {
    // Always show plain title (no count)
    document.title = "CHATr";

    const favicon = document.querySelector("link[rel='icon']");
    if (!favicon) return;

    // Reset to normal favicon
    favicon.href = "/favicon.ico";

    // Only add blue dot if there are unread messages
    if (unreadCount > 0) {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      const img = new Image();
      img.src = "/favicon.ico";

      img.onload = () => {
        // draw original favicon
        ctx.drawImage(img, 0, 0, size, size);
        // draw blue dot in top-right corner
        ctx.beginPath();
        ctx.arc(size - 10, 10, 6, 0, 2 * Math.PI);
        ctx.fillStyle = "#2563EB"; // Tailwind blue-600
        ctx.fill();

        favicon.href = canvas.toDataURL("image/png");
      };
    }
  }, [unreadCount]);
}
