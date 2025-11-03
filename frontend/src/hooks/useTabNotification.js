import { useEffect } from "react";

/**
 * 🔵 Shows a softly pulsing blue dot in the browser tab when unread messages exist.
 * Restores normal favicon and title when read.
 */
export function useTabNotification(unreadCount = 0) {
  useEffect(() => {
    const originalTitle = document.title;
    const existingFavicon = document.querySelector("link[rel='icon']");
    let pulseInterval = null;

    // Helper to create a circular favicon image
    function createDotFavicon(size = 64, color = "#3B82F6", alpha = 1) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 3, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`; // Tailwind blue-500 with alpha
      ctx.fill();

      const newFavicon = document.createElement("link");
      newFavicon.rel = "icon";
      newFavicon.href = canvas.toDataURL("image/png");
      return newFavicon;
    }

    // Replace favicon in the <head>
    function setFavicon(newFavicon) {
      const old = document.querySelector("link[rel='icon']");
      if (old) document.head.removeChild(old);
      document.head.appendChild(newFavicon);
    }

    if (unreadCount > 0) {
      document.title = "CHATr"; // keep title clean

      // Start pulsing favicon
      let opacity = 1;
      let fadingOut = true;

      pulseInterval = setInterval(() => {
        // Animate between opacity 1 → 0.5 → 1
        if (fadingOut) opacity -= 0.05;
        else opacity += 0.05;

        if (opacity <= 0.5) fadingOut = false;
        if (opacity >= 1) fadingOut = true;

        const pulsingFavicon = createDotFavicon(64, "#3B82F6", opacity);
        setFavicon(pulsingFavicon);
      }, 120); // smooth pulse speed (lower = faster)
    } else {
      // No unread → restore original favicon
      clearInterval(pulseInterval);

      if (existingFavicon) {
        document.head.removeChild(document.querySelector("link[rel='icon']"));
      }

      const originalFavicon = document.createElement("link");
      originalFavicon.rel = "icon";
      originalFavicon.href = "/favicon.ico";
      document.head.appendChild(originalFavicon);
      document.title = "CHATr";
    }

    return () => {
      clearInterval(pulseInterval);
      document.title = originalTitle;
    };
  }, [unreadCount]);
}
