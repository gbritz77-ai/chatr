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
  AlertTriangle,
  ArrowDown,
  Image,
} from "lucide-react";

/* ============================================================
   💬 ChatWindow — Fixed Chat ID Normalization + Debugging
============================================================ */
export default function ChatWindow({ activeUser, currentUser }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [lastReadTimestamp, setLastReadTimestamp] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [errorUrl, setErrorUrl] = useState(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const pickerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimer = useRef(null);

  const currentProfileName = localStorage.getItem("profileName") || currentUser;
  const S3_BUCKET_URL = "https://outsec-chat-bucket.s3.eu-west-2.amazonaws.com";

  /* ----------------------------------------------------
     🧩 Helper: Normalized Chat ID
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
        // FIXED: use .id and normalized chatId
        const chatId = getChatId(currentUser, activeUser.id);
        url = `/messages?chatId=${encodeURIComponent(chatId)}&username=${encodeURIComponent(
          currentUser
        )}`;
      }

      console.log("💬 [ChatWindow] Fetching messages:", url);
      const res = await getJSON(url);
      const msgs = res?.messages || [];
      console.log(`📦 Loaded ${msgs.length} messages for`, activeUser);
      setMessages(msgs);
    } catch (err) {
      console.error("❌ Failed to load messages:", err);
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
      const chatId =
        activeUser.type === "group"
          ? `GROUP#${activeUser.id}`
          : getChatId(currentUser, activeUser.id);

      console.log("📨 Marking chat as read:", chatId);
      await postJSON("/messages/mark-read", { chatId, username: currentUser });
      setLastReadTimestamp(new Date().toISOString());
    } catch (err) {
      console.error("❌ Failed to mark chat as read:", err);
    }
  }

  /* ----------------------------------------------------
     PRESENCE + TYPING
  ---------------------------------------------------- */
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeUser?.id) {
        setOnlineUsers((prev) => ({
          ...prev,
          [activeUser.id]: Math.random() > 0.2,
        }));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeUser]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }, 100);
    return () => clearTimeout(timer);
  }, [activeUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setAutoScrollEnabled(true);
  };

  /* ----------------------------------------------------
     SEND MESSAGE
  ---------------------------------------------------- */
  async function sendMessage(e) {
    e.preventDefault();
    if ((!text.trim() && !attachment) || !activeUser) return;

    try {
      let fileKey = null;
      let fileType = null;

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
        await fetch(data.uploadURL, { method: "PUT", body: attachment });
        fileKey = data.fileKey;
        fileType = attachment.type;
      }

      const payload =
        activeUser.type === "group"
          ? {
              sender: currentUser,
              groupid: activeUser.id,
              text,
              attachmentKey: fileKey,
              attachmentType: fileType,
            }
          : {
              sender: currentUser,
              recipient: activeUser.id,
              text,
              attachmentKey: fileKey,
              attachmentType: fileType,
            };

      console.log("🚀 Sending message payload:", payload);
      await postJSON("/messages", payload);
      setText("");
      setAttachment(null);
      setShowEmojiPicker(false);
      await loadMessages();
      await markAsRead();
      scrollToBottom();
    } catch (err) {
      console.error("❌ Failed to send message:", err);
      alert("Message send failed: " + err.message);
    }
  }

  /* ----------------------------------------------------
     RENDER MESSAGES
  ---------------------------------------------------- */
  function renderBubble(msg) {
    const isMine = msg.sender === currentUser;
    const senderName = isMine ? currentProfileName : msg.senderProfileName || msg.sender;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const fileUrl = msg.attachmentUrl || (msg.attachmentKey ? `${S3_BUCKET_URL}/${msg.attachmentKey}` : null);
    const isImage = msg.attachmentType?.startsWith("image/");

    return (
      <div key={msg.messageid || `${msg.sender}-${msg.timestamp}`} className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
        <Avatar seed={senderName} username={senderName} size={10} style="micah" />
        <div className={`p-3 rounded-lg max-w-[70%] ${isMine ? "bg-blue-600 text-white ml-auto" : "bg-white border text-slate-800"}`}>
          {!isMine && <div className="text-xs font-semibold text-slate-500 mb-1">{senderName}</div>}
          {msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}
          {fileUrl && isImage && (
            <img src={fileUrl} alt="attachment" className="max-h-64 rounded-lg border mt-2 object-contain" />
          )}
          <div className={`text-xs mt-2 ${isMine ? "text-blue-200" : "text-slate-500"}`}>{time}</div>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------
     RETURN LAYOUT
  ---------------------------------------------------- */
  return (
    <div className="flex flex-col flex-1 h-screen ml-[320px] bg-slate-50 relative">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur-lg p-4 font-semibold text-slate-700 flex items-center gap-3">
        {activeUser ? (
          <>
            <Avatar
              seed={activeUser.name || activeUser.id}
              username={activeUser.name || activeUser.id}
              size={10}
              style="micah"
            />
            <div>
              <div>{activeUser.name || activeUser.id}</div>
              {remoteTyping && <div className="text-xs text-slate-500 animate-pulse">typing...</div>}
            </div>
          </>
        ) : (
          "Welcome to CHATr"
        )}
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-5 space-y-4">
        {activeUser ? (
          messages.length ? (
            messages.map(renderBubble)
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

      {/* Sticky Input Bar */}
      {activeUser && (
        <div className="sticky bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-inner px-6 py-3">
          <form onSubmit={sendMessage} className="flex items-center gap-3">
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
                uploading ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
