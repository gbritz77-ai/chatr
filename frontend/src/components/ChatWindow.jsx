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
   💬 ChatWindow — fully stable version (Nov 2025)
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

  const currentProfileName = localStorage.getItem("profileName") || currentUser;

  /* ----------------------------------------------------
     🧩 Normalize Chat ID (backend-compatible)
  ---------------------------------------------------- */
  function normalizeChatId(userA, userB) {
    if (!userA || !userB) return "";
    const sorted = [userA, userB].map((x) => x.toLowerCase()).sort();
    return `CHAT#${sorted[0]}#${sorted[1]}`;
  }

  /* ----------------------------------------------------
     🔗 Get Signed URL for attachments
  ---------------------------------------------------- */
  async function getSignedUrl(fileKey) {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/presign-download`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: fileKey }),
        }
      );
      const data = await res.json();
      return data?.viewURL || null;
    } catch (err) {
      console.error("❌ Failed to get signed download URL:", err);
      return null;
    }
  }

  /* ----------------------------------------------------
     LOAD MESSAGES
  ---------------------------------------------------- */
  /* ----------------------------------------------------
   LOAD MESSAGES (final unified fix)
---------------------------------------------------- */
async function loadMessages() {
  if (!activeUser || !currentUser) return;

  try {
    let url = "";
    if (activeUser?.type === "group") {
      url = `/messages?groupid=${encodeURIComponent(activeUser.id)}`;
    } else if (activeUser?.type === "user") {
      const userB = activeUser.username || activeUser.id;
      const chatId = normalizeChatId(currentUser, userB);
      url = `/messages?chatId=${encodeURIComponent(chatId)}`;
    }

    if (!url) return;

    const res = await getJSON(url);
    let data = res;

    // ✅ Handle API Gateway wrapping (body string)
    if (typeof res?.body === "string") {
      try {
        data = JSON.parse(res.body);
      } catch (err) {
        console.error("❌ Failed to parse res.body JSON:", err, res.body);
      }
    }

    console.log("📨 Loaded messages response:", data);

    // ✅ Handle correct property
    const msgs =
      Array.isArray(data.items) ? data.items :
      Array.isArray(data.messages) ? data.messages :
      [];

    if (msgs.length) {
      setMessages(msgs);
    } else {
      console.warn("⚠️ No messages found in response:", data);
      setMessages([]);
    }
  } catch (err) {
    console.error("❌ Error loading messages:", err);
    setMessages([]);
  }
}


  useEffect(() => {
    if (!activeUser || !currentUser) return;
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
        activeUser?.type === "group"
          ? `GROUP#${activeUser.id}`
          : normalizeChatId(currentUser, activeUser.username || activeUser.id);

      if (!chatid) return;
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

    if (!isTyping && activeUser) {
      setIsTyping(true);
      postJSON("/typing/start", {
        username: currentUser,
        chatid:
          activeUser?.type === "group"
            ? `GROUP#${activeUser.id}`
            : normalizeChatId(currentUser, activeUser.username || activeUser.id),
      });
    }

    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
      if (activeUser) {
        postJSON("/typing/stop", {
          username: currentUser,
          chatid:
            activeUser?.type === "group"
              ? `GROUP#${activeUser.id}`
              : normalizeChatId(
                  currentUser,
                  activeUser.username || activeUser.id
                ),
        });
      }
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
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
  }, [messages]);

  /* ----------------------------------------------------
     SEND MESSAGE
  ---------------------------------------------------- */
  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() && !attachment) return;

    const payload = {
      sender: currentUser,
      recipient: activeUser?.username || null,
      groupid: activeUser?.type === "group" ? activeUser.id : null,
      text: text.trim(),
    };

    // 🔹 Attachments handled directly (no upload API)
    if (attachment) {
      payload.attachmentKey =
        attachment.key || attachment.url || attachment.name || null;
      payload.attachmentType = attachment.type || "file";
    }

    if (activeUser?.type === "user") {
      const userB = activeUser.username || activeUser.id;
      payload.chatId = normalizeChatId(currentUser, userB);
    }

    try {
      setUploading(true);
      const res = await postJSON("/messages", payload);

      if (res.success) {
        setMessages((prev) => [...prev, res.item]);
        setText("");
        setAttachment(null);
        await markAsRead();
      } else {
        console.error("❌ Message send failed:", res);
      }
    } catch (err) {
      console.error("❌ sendMessage error:", err);
    } finally {
      setUploading(false);
    }
  }

  /* ----------------------------------------------------
     GUARD RENDER IF NO ACTIVE USER
  ---------------------------------------------------- */
  if (!activeUser) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400 italic">
        Select a contact or group to start chatting
      </div>
    );
  }

  /* ----------------------------------------------------
     RENDER
  ---------------------------------------------------- */
  return (
    <div className="flex flex-col flex-1 h-screen ml-[320px] bg-slate-50 relative">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur-lg p-4 font-semibold text-slate-700 flex items-center justify-between">
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
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-5 space-y-4"
      >
        {messages.length ? (
          messages.map((msg) => (
            <MessageBubble
              key={msg.messageid || msg.timestamp}
              msg={msg}
              currentUser={currentUser}
              getSignedUrl={getSignedUrl}
            />
          ))
        ) : (
          <p className="text-center text-slate-400 italic">No messages yet</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
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
    </div>
  );
}

/* ============================================================
   💬 MessageBubble Component
============================================================ */
function MessageBubble({ msg, currentUser, getSignedUrl }) {
  const [viewUrl, setViewUrl] = useState(msg.attachmentUrl || null);

  useEffect(() => {
    if (!viewUrl && msg.attachmentKey) {
      getSignedUrl(msg.attachmentKey).then((url) => {
        if (url) setViewUrl(url);
      });
    }
  }, [msg.attachmentKey]);

  const isMine = msg.sender === currentUser;
  const senderName = isMine
    ? "You"
    : msg.senderProfileName || msg.sender?.split("@")[0] || msg.sender;

  const time = new Date(msg.timestamp).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
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
    <div className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
      <div
        className={`text-xs font-semibold mb-1 ${
          isMine ? "text-blue-500" : "text-slate-500"
        }`}
      >
        {senderName}
      </div>

      <div
        className={`p-3 rounded-lg max-w-[70%] ${
          isMine ? "bg-blue-600 text-white ml-auto" : "bg-white border text-slate-800"
        }`}
      >
        {msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}

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
          className={`text-xs mt-2 ${isMine ? "text-blue-200" : "text-slate-500"}`}
        >
          {time}
        </div>
      </div>
    </div>
  );
}
