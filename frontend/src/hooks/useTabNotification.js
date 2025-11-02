import { useEffect, useRef } from "react";

/**
 * Custom hook to show a temporary browser tab notification
 * Example: useTabNotification(unreadCount)
 */
export function useTabNotification(unreadCount) {
  const defaultTitle = useRef(document.title);

  useEffect(() => {
    // Only trigger if there are unread messages
    if (unreadCount > 0) {
      document.title = `💬 (${unreadCount}) New message${unreadCount > 1 ? "s" : ""}`;
    } else {
      document.title = defaultTitle.current;
    }

    // When user returns to tab, reset title
    const handleFocus = () => {
      document.title = defaultTitle.current;
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [unreadCount]);
}
