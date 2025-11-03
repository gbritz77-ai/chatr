import { useEffect } from "react";

/**
 * 🟢🟦 Browser Tab Notification Hook
 * - Green favicon when unread messages exist
 * - Blue favicon when all read
 * - No numbers or counts in title
 */
export function useTabNotification(unreadCount = 0) {
  useEffect(() => {
    const existingFavicon = document.querySelector("link[rel='icon']") || document.createElement("link");
    existingFavicon.rel = "icon";

    // Keep title clean (no numbers)
    document.title = "CHATr";

    if (unreadCount > 0) {
      // 🟢 Green favicon for unread messages
      existingFavicon.href =
        "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%2300c853%22/></svg>";
    } else {
      // 🔵 Blue favicon for no unread messages
      existingFavicon.href =
        "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22007bff%22/></svg>";
    }

    // Apply the favicon
    document.head.appendChild(existingFavicon);

    return () => {
      document.title = "CHATr";
    };
  }, [unreadCount]);
}
