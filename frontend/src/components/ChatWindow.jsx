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
      const res = await postJSON("/presign-download", { key: fileKey });
      return res?.viewURL || null;
    } catch (err) {
      console.error("❌ Failed to get signed download URL:", err);
      return null;
    }
  }

  /* ----------------------------------------------------
     LOAD MESSAGES
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
      let data = typeof res?.body === "string" ? JSON.parse(res.body) : res;

      console.log("📨 Loaded messages response:", data);

      const msgs =
        Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.messages)
          ? data.messages
          : [];

      setMessages(msgs);
    } catch (err) {
      console.error("❌ Error loading messages:", err);
      setMessages([]);
    }
  }

  /* Auto reload every 3 seconds */
  useEffect(() => {
    if (!activeUser || !currentUser) return;
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [activeUser, currentUser]);

  /* ----------------------------------------------------
     MARK AS READ
  ---------------------------------------------------- */
  async function markAsRead() {
    if (!activeUser || !currentUser) return;

    try {
      const chatid =
        activeUser?.type === "group"
          ? `GROUP#${activeUser.id}`
          : normalizeChatId(currentUser, activeUser.username || activeUser.id);

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
              : normalizeChatId(currentUser, activeUser.username || activeUser.id),
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
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  /* ----------------------------------------------------
     SEND MESSAGE — fixed, perfect version
  ---------------------------------------------------- */
  async function sendMessage(e) {
    e.preventDefault();
    console.log("🟢 sendMessage() triggered");

    if (!text.trim() && !attachment) return;

    setUploading(true);

    const recipientValue =
      activeUser?.type === "user"
        ? activeUser.username || activeUser.id || activeUser.email
        : null;

    const timestamp = new Date().toISOString();

    const payload = {
      sender: currentUser,
      recipient: recipientValue,
      groupid: activeUser?.type === "group" ? activeUser.id : null,
      text: text.trim() || "",
      timestamp,
    };

    if (activeUser?.type === "user" && recipientValue) {
      const chatId = normalizeChatId(currentUser, recipientValue);
      payload.chatId = chatId;
    } else if (activeUser?.type === "group") {
      payload.chatId = `GROUP#${activeUser.id}`;
    }

    console.log("📨 BASE PAYLOAD:", payload);

    /* ----------------- FILE ATTACHMENT ----------------- */
    if (attachment) {
      console.log("📎 Processing attachment:", attachment);

      if (attachment.isGif && attachment.url) {
          payload.attachmentType = "image/gif";
          payload.attachmentKey = null;
          payload.gifUrl = attachment.url;  // Frontend-rendered GIF
        } else if (attachment instanceof File) {
        try {
          const presignRes = await postJSON("/presign-upload", {
            filename: attachment.name,
            contentType: attachment.type,
            filetype: attachment.type,
          });

          if (presignRes?.uploadURL && presignRes?.fileKey) {
            await fetch(presignRes.uploadURL, {
              method: "PUT",
              headers: { "Content-Type": attachment.type },
              body: attachment,
            });

            payload.attachmentKey = presignRes.fileKey;
            payload.attachmentType = attachment.type;
          }
        } catch (err) {
          console.error("🔥 Attachment upload failed:", err);
        }
      }
    }

    console.log("📨 FINAL PAYLOAD TO /messages:", payload);

    try {
      const res = await postJSON("/messages", payload);
      const parsed = typeof res?.body === "string" ? JSON.parse(res.body) : res;

      if (parsed?.success) {
        setMessages((prev) => [...prev, parsed.item]);
        setText("");
        setAttachment(null);
        setTimeout(() => loadMessages(), 500);
      } else {
        console.error("❌ Message send failed:", parsed?.message);
      }
    } catch (err) {
      console.error("🔥 sendMessage error:", err);
    }

    setUploading(false);
  }

  /* ----------------------------------------------------
     RENDER — if no active chat selected
  ---------------------------------------------------- */
  if (!activeUser) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400 italic">
        Select a contact or group to start chatting
      </div>
    );
  }

  /* ----------------------------------------------------
     RENDER — MAIN UI
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
              <div className="text-xs text-slate-500 animate-pulse">typing...</div>
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

      {/* Input */}
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
          >
            <Paperclip size={20} />
          </button>

          {/* Emoji */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="text-slate-500 hover:text-yellow-500 transition"
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

          {/* GIF */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGifPicker((prev) => !prev)}
              className="text-slate-500 hover:text-pink-600 transition"
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
                      isGif: true,                 
                      attachmentType: "image/gif",
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
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
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
   💬 MessageBubble (with sender name)
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

  const time = new Date(msg.timestamp).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  /* -----------------------------
     TYPE CHECKS
  ----------------------------- */
  const fileType = msg.attachmentType || "";
  const isImage = fileType.startsWith("image/") && fileType !== "image/gif";
  const isGif =
    fileType === "image/gif" ||
    (msg.gifUrl && msg.gifUrl.toLowerCase().endsWith(".gif"));
  const isPDF = fileType === "application/pdf";
  const isOther = msg.attachmentKey && !isImage && !isGif && !isPDF;

  const displayUrl = msg.gifUrl || viewUrl;

  return (
    <div className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
      <div
        className={`p-3 rounded-lg max-w-[70%] ${
          isMine ? "bg-blue-600 text-white" : "bg-white border"
        }`}
      >
        {/* Sender Name (only for incoming messages) */}
        {!isMine && (
          <div className="text-xs font-semibold text-slate-600 mb-1">
            {msg.sender}
          </div>
        )}

        {/* Text */}
        {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}

        {/* GIF */}
        {displayUrl && isGif && (
          <img src={displayUrl} className="max-h-64 rounded mt-2 border" />
        )}

        {/* Normal Image */}
        {displayUrl && isImage && (
          <img src={displayUrl} className="max-h-64 rounded mt-2 border" />
        )}

        {/* Files (PDF / Other attachments) */}
        {displayUrl && (isPDF || isOther) && (
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-2 px-3 py-2 border rounded text-sm"
          >
            <FileText size={16} />
            Download
          </a>
        )}

        {/* Time */}
        <div className="text-xs mt-2 opacity-70">{time}</div>
      </div>
    </div>
  );
}


