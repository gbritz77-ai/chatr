import { useEffect } from "react";

/**
 * 🟢 Shows a static green dot favicon ONLY when unread messages exist.
 * Restores normal favicon and title when all messages are read.
 * No message count is ever shown.
 */
export function useTabNotification(unreadCount = 0) {
  useEffect(() => {
    const originalTitle = "CHATr";
    const originalFaviconHref = "/favicon.ico";

    function setFavicon(url) {
      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = url;
    }

    // 🟢 Create a small green dot favicon dynamically
    function createGreenDotFavicon() {
      const canvas = document.createElement("canvas");
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 3, 0, 2 * Math.PI);
      ctx.fillStyle = "#22c55e"; // Tailwind green-500
      ctx.fill();
      return canvas.toDataURL("image/png");
    }

    if (unreadCount > 0) {
      // New messages → green dot favicon
      document.title = originalTitle; // keep title clean
      setFavicon(createGreenDotFavicon());
    } else {
      // No unread messages → restore original favicon
      document.title = originalTitle;
      setFavicon(originalFaviconHref);
    }

    // Cleanup
    return () => {
      document.title = originalTitle;
      setFavicon(originalFaviconHref);
    };
  }, [unreadCount]);
}
