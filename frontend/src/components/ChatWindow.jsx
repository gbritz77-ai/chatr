import React, { useState, useEffect, useRef } from "react";
import { postJSON, getJSON } from "../lib/api";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Avatar } from "../components/Avatar";
import GifPicker from "../components/GifPicker";
import {
  Send,
  Smile,
  Paperclip,
  Loader2,
  FileText,
  Image,
} from "lucide-react";

/* ============================================================
   💬 ChatWindow — with Sound + Tab + Desktop Notifications
============================================================ */
export default function ChatWindow({ activeUser, currentUser }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lastReadTimestamp, setLastReadTimestamp] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const pickerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimer = useRef(null);
  const previousId = useRef(null);
  const soundRef = useRef(null);
  const soundUnlocked = useRef(false);

  const currentProfileName = localStorage.getItem("profileName") || currentUser;

  /* ----------------------------------------------------
     🔔 Request Notification Permission (once)
  ---------------------------------------------------- */
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch((err) =>
          console.warn("Notification permission error:", err)
        );
      }
    }
  }, []);

  /* ----------------------------------------------------
     🔓 Unlock sound on first click (browser autoplay fix)
  ---------------------------------------------------- */
  useEffect(() => {
    const unlock = () => {
      if (soundUnlocked.current) return;
      const silent = new Audio("/sounds/mixkit-sci-fi-confirmation-914.wav");
      silent.volume = 0;
      silent.play().catch(() => {});
      soundUnlocked.current = true;
    };
    window.addEventListener("click", unlock, { once: true });
    return () => window.removeEventListener("click", unlock);
  }, []);

  /* ----------------------------------------------------
     🔊 Preload WAV sound
  ---------------------------------------------------- */
  useEffect(() => {
    soundRef.current = new Audio("/sounds/mixkit-sci-fi-confirmation-914.wav");
    soundRef.current.volume = 0.6;
    soundRef.current.preload = "auto";
  }, []);

  /* ----------------------------------------------------
   💬 Reliable Background Notification System (final)
---------------------------------------------------- */
useEffect(() => {
  if (!activeUser || !messages.length) return;

  const lastMsg = messages[messages.length - 1];
  const newId = lastMsg?.messageid || lastMsg?.timestamp;

  // Track previously seen message ID
  const prevId = previousId.current;

  // Trigger only if it's new and not sent by current user
  if (newId && newId !== prevId && lastMsg?.sender !== currentUser) {
    previousId.current = newId;

    console.log("🔔 New message detected:", lastMsg);

    // --- Play notification sound immediately ---
    if (soundRef.current) {
      const playPromise = soundRef.current.play();
      if (playPromise) playPromise.catch(() => {});
    }

    // --- Flash tab title even if backgrounded ---
    if (document.hidden) {
      let flashing = true;
      const flashInterval = setInterval(() => {
        document.title = flashing ? "💬 New message!" : "CHATr";
        flashing = !flashing;
      }, 1200);

      const stopFlash = () => {
        clearInterval(flashInterval);
        document.title = "CHATr";
        window.removeEventListener("focus", stopFlash);
      };
      window.addEventListener("focus", stopFlash);
      setTimeout(stopFlash, 7000);
    }

    // --- Optional light vibration on mobile ---
    if (navigator.vibrate) navigator.vibrate(80);

    // --- 🪄 Desktop notification ---
    if ("Notification" in window && Notification.permission === "granted") {
      const title = "💬 GeeBee’z CHATr";
      const body =
        activeUser.type === "group"
          ? `${lastMsg.sender} in ${activeUser.name}: ${lastMsg.text || "Sent a file 📎"}`
          : `${lastMsg.sender}: ${lastMsg.text || "Sent a file 📎"}`;

      const notif = new Notification(title, {
        body,
        icon: "/logo/logo.JPG",
        badge: "/logo/logo.JPG",
        tag: "chatr-message",
        silent: true,
        data: { url: window.location.href },
      });

      notif.onclick = (event) => {
        event.preventDefault();
        window.focus();
        document.title = "CHATr";
      };

      // Close after 7s to avoid clutter
      setTimeout(() => notif.close(), 7000);
    }
  } else if (!prevId && lastMsg) {
    // Initialize tracking
    previousId.current = newId;
  }
}, [messages, activeUser, currentUser]);

/* ----------------------------------------------------
   ⚙️ Ask for Notification Permission Automatically
---------------------------------------------------- */
useEffect(() => {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().then((perm) => {
      console.log("🔧 Notification permission:", perm);
    });
  }
}, []);





  /* ----------------------------------------------------
     🔗 Get Signed URL for downloads
  ---------------------------------------------------- */
  async function getSignedUrl(fileKey) {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/presign-download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: fileKey }),
      });
      const data = await res.json();
      return data?.viewURL || null;
    } catch (err) {
      console.error("❌ Failed to get signed download URL:", err);
      return null;
    }
  }

  /* ----------------------------------------------------
     🧩 Normalize Chat ID
  ---------------------------------------------------- */
  function getChatId(userA, userB) {
    const sorted = [userA, userB].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    return `CHAT#${sorted[0]}#${sorted[1]}`;
  }

  /* ----------------------------------------------------
     LOAD MESSAGES
  ---------------------------------------------------- */
  async function loadMessages() {
    if (!activeUser || !currentUser) return;
    try {
      let url = "";
      if (activeUser.type === "group") {
        url = `/messages?groupid=${encodeURIComponent(
          activeUser.id
        )}&username=${encodeURIComponent(currentUser)}`;
      } else if (activeUser.type === "user") {
        const chatId = getChatId(currentUser, activeUser.id);
        url = `/messages?chatId=${encodeURIComponent(
          chatId
        )}&username=${encodeURIComponent(currentUser)}`;
      }

      const res = await getJSON(url);
      const msgs = res?.messages || [];
      setMessages(msgs);
    } catch (err) {
      console.error("❌ Failed to load messages:", err);
    }
  }

  useEffect(() => {
    if (!activeUser || !currentUser) return;
    previousId.current = null;
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [activeUser, currentUser]);

  /* ----------------------------------------------------
     MARK CHAT AS READ
  ---------------------------------------------------- */
  async function markAsRead() {
    if (!activeUser || !currentUser) return;
    try {
      const chatid =
        activeUser.type === "group"
          ? `GROUP#${activeUser.id}`
          : getChatId(currentUser, activeUser.id);

      await postJSON("/messages/mark-read", { chatid, username: currentUser });
      setLastReadTimestamp(new Date().toISOString());
    } catch (err) {
      console.error("❌ Failed to mark chat as read:", err);
    }
  }

  /* ----------------------------------------------------
     TYPING INDICATOR
  ---------------------------------------------------- */
  function handleTypingChange(e) {
    setText(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      postJSON("/typing/start", { user: currentUser, chat: activeUser });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
      postJSON("/typing/stop", { user: currentUser, chat: activeUser });
    }, 2000);
  }

  /* ----------------------------------------------------
     AUTO-SCROLL
  ---------------------------------------------------- */
  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    setAutoScrollEnabled(atBottom);
  }

  useEffect(() => {
    if (autoScrollEnabled)
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  /* ----------------------------------------------------
     SEND MESSAGE
  ---------------------------------------------------- */
  async function sendMessage(e) {
    e.preventDefault();
    if ((!text.trim() && !attachment) || !activeUser) return;

    try {
      setUploading(true);
      let fileKey = null;
      let fileType = null;
      let viewUrl = null;

      if (attachment) {
        const presign = await fetch(
          `${import.meta.env.VITE_API_BASE}/presign-upload`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: attachment.name, type: attachment.type }),
          }
        );
        const data = await presign.json();
        if (!data?.uploadURL) throw new Error("Presign URL generation failed");

        const uploadResp = await fetch(data.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": attachment.type },
          body: attachment,
        });
        if (!uploadResp.ok) {
          const errText = await uploadResp.text();
          throw new Error(`S3 upload failed: ${uploadResp.status} ${errText}`);
        }

        fileKey = data.fileKey;
        fileType = attachment.type;
        viewUrl = data.viewURL;
      }

      const payload =
        activeUser.type === "group"
          ? {
              sender: currentUser,
              groupid: activeUser.id,
              text,
              attachmentKey: fileKey,
              attachmentType: fileType,
              attachmentUrl: viewUrl,
            }
          : {
              sender: currentUser,
              recipient: activeUser.id,
              text,
              attachmentKey: fileKey,
              attachmentType: fileType,
              attachmentUrl: viewUrl,
            };

      await postJSON("/messages", payload);
      setText("");
      setAttachment(null);
      setShowEmojiPicker(false);
      await loadMessages();
      await markAsRead();
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error("❌ Failed to send message:", err);
      alert("Message send failed: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 h-screen ml-[320px] bg-slate-50 relative">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur-lg p-4 font-semibold text-slate-700 flex items-center justify-between">
        {activeUser ? (
          <>
            {/* Left side: avatar + name */}
            <div className="flex items-center gap-3">
              <Avatar
                seed={activeUser.name || activeUser.id}
                username={activeUser.name || activeUser.id}
                size={10}
                style="micah"
              />
              <div>
                <div>{activeUser.name || activeUser.id}</div>
                {remoteTyping && (
                  <div className="text-xs text-slate-500 animate-pulse">
                    typing...
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Test sound */}
            <button
              onClick={() => soundRef.current?.play()}
              className="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-md"
            >
              🔈 Test Sound
            </button>
          </>
        ) : (
          "Welcome to CHATr"
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-5 space-y-4"
      >
        {activeUser ? (
          messages.length ? (
            messages.map((msg) => (
              <MessageBubble
                key={msg.messageid || msg.timestamp}
                msg={msg}
                currentUser={currentUser}
                currentProfileName={currentProfileName}
                getSignedUrl={getSignedUrl}
              />
            ))
          ) : (
            <p className="text-center text-slate-400 italic">No messages yet</p>
          )
        ) : (
          <p className="text-center text-slate-400 italic mt-10">
            Select a contact or group to start chatting
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Input Bar */}
      {activeUser && (
        <div className="sticky bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-inner px-6 py-3">
          <form onSubmit={sendMessage} className="flex items-center gap-3 relative">
            <input
              type="file"
              accept="image/*,video/*,application/pdf"
              className="hidden"
              id="fileInput"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) setAttachment(file);
              }}
            />
            <button
              type="button"
              onClick={() => document.getElementById("fileInput").click()}
              className="text-slate-500 hover:text-blue-600 transition"
              title="Attach file"
            >
              <Paperclip size={20} />
            </button>

            {/* Emoji Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="text-slate-500 hover:text-yellow-500 transition"
                title="Add emoji"
              >
                <Smile size={22} />
              </button>
              {showEmojiPicker && (
                <div
                  ref={pickerRef}
                  className="absolute bottom-12 left-0 z-50 bg-white shadow-lg border rounded-xl"
                >
                  <Picker
                    data={data}
                    onEmojiSelect={(e) => setText((t) => t + e.native)}
                    theme="light"
                  />
                </div>
              )}
            </div>

            {/* GIF Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowGifPicker((prev) => !prev)}
                className="text-slate-500 hover:text-pink-600 transition"
                title="Send GIF"
              >
                <Image size={22} />
              </button>
              {showGifPicker && (
                <div className="absolute bottom-12 left-0 z-50 bg-white shadow-lg border rounded-xl">
                  <GifPicker
                    onSelect={(gifUrl) => {
                      setAttachment({
                        type: "image/gif",
                        name: gifUrl,
                        url: gifUrl,
                      });
                      setShowGifPicker(false);
                    }}
                  />
                </div>
              )}
            </div>

            <input
              type="text"
              placeholder="Type a message..."
              value={text}
              onChange={handleTypingChange}
              className="flex-1 bg-transparent border-none focus:outline-none text-sm text-slate-700 px-2"
            />

            <button
              type="submit"
              disabled={uploading}
              className={`p-3 rounded-full shadow-sm transition ${
                uploading
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
              title="Send message"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>

          {attachment && (
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 bg-slate-100 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 truncate">
                <FileText size={14} />
                <span className="truncate">{attachment.name}</span>
              </div>
              <button
                type="button"
                className="text-red-500 hover:text-red-700"
                onClick={() => setAttachment(null)}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   💬 MessageBubble Component
============================================================ */
function MessageBubble({ msg, currentUser, currentProfileName, getSignedUrl }) {
  const [viewUrl, setViewUrl] = useState(msg.attachmentUrl || null);

  useEffect(() => {
    if (!viewUrl && msg.attachmentKey) {
      getSignedUrl(msg.attachmentKey).then((url) => {
        if (url) setViewUrl(url);
      });
    }
  }, [msg.attachmentKey, viewUrl]);

  const isMine = msg.sender === currentUser;
  const senderName = isMine
    ? "You"
    : msg.senderProfileName || msg.sender?.split("@")[0] || msg.sender;
  const time = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const fileType = msg.attachmentType || "";
  const fileName = (msg.attachmentKey || msg.attachmentUrl || "").toLowerCase();
  const isImage =
    fileType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  const isPDF = fileType === "application/pdf" || fileName.endsWith(".pdf");
  const isOtherFile = msg.attachmentKey && !isImage && !isPDF;

  return (
    <div
      className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
    >
      <div
        className={`text-xs font-semibold mb-1 ${
          isMine ? "text-blue-500" : "text-slate-500"
        }`}
      >
        {senderName}
      </div>

      <div
        className={`p-3 rounded-lg max-w-[70%] ${
          isMine
            ? "bg-blue-600 text-white ml-auto"
            : "bg-white border text-slate-800"
        }`}
      >
        {msg.text && (
          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
        )}

        {viewUrl && isImage && (
          <img
            src={viewUrl}
            alt="attachment"
            loading="lazy"
            className="max-h-64 rounded-lg border mt-2 object-contain shadow-sm cursor-pointer transition hover:scale-[1.02]"
          />
        )}

        {viewUrl && (isPDF || isOtherFile) && (
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-md border transition ${
              isMine
                ? "border-blue-400 bg-blue-700/40 hover:bg-blue-700/70 text-white"
                : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800"
            }`}
          >
            <FileText size={16} />
            <span className="text-sm truncate">
              {msg.attachmentKey?.split("/").pop() || "Download File"}
            </span>
          </a>
        )}

        <div
          className={`text-xs mt-2 ${
            isMine ? "text-blue-200" : "text-slate-500"
          }`}
        >
          {time}
        </div>
      </div>
    </div>
  );
}
