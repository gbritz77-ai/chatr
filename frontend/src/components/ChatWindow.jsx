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
   🔗 Get Signed URL for attachments (FIXED)
---------------------------------------------------- */
async function getSignedUrl(fileKey) {
  try {
    const res = await postJSON("/presign-download", { key: fileKey });
    return res?.url || null; // ⭐ backend returns 'url'
  } catch (err) {
    console.error("❌ Failed to get signed download URL:", err);
    return null;
  }
}



  /* ----------------------------------------------------
   LOAD MESSAGES — Final Correct Version (Bob 2025)
---------------------------------------------------- */
async function loadMessages() {
  if (!activeUser || !currentUser) return;

  try {
    let chatId = null;

    if (activeUser?.type === "group") {
      // GROUP CHAT
      chatId = `GROUP#${activeUser.id}`;
    } else if (activeUser?.type === "user") {
      // DIRECT MESSAGE CHAT
      const userB = activeUser.username || activeUser.id || activeUser.email;
      chatId = normalizeChatId(currentUser, userB);
    }

    if (!chatId) return;

    const url = `/messages?chatId=${encodeURIComponent(chatId)}`;

    const res = await getJSON(url);
    const data =
      typeof res?.body === "string" ? JSON.parse(res.body) : res;

    //console.log("📨 Loaded messages response:", data);

    const msgs = Array.isArray(data.items) ? data.items : [];

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
   SEND MESSAGE — Bob's Final, Correct, Stable Version
---------------------------------------------------- */
async function sendMessage(e) {
  e.preventDefault();

  // Prevent sending nothing
  if (!text.trim() && !attachment) return;

  setUploading(true);

  const timestamp = new Date().toISOString();

  /* ----------------------------------------------------
     RESOLVE RECIPIENT / GROUP / CHAT ID
  ---------------------------------------------------- */
  const isUser = activeUser?.type === "user";
  const isGroup = activeUser?.type === "group";

  const recipientValue =
    isUser
      ? activeUser.username ||
        activeUser.email ||
        activeUser.id
      : null;

  const payload = {
    sender: currentUser,
    senderName: localStorage.getItem("profileName") || currentUser,
    recipient: isUser ? recipientValue : null,
    groupid: isGroup ? activeUser.id : null,
    text: text.trim() || null, // allow null for attachment-only messages
    timestamp,
  };

  // Build chatId
  if (isUser && recipientValue) {
    payload.chatId = normalizeChatId(currentUser, recipientValue);
  } else if (isGroup) {
    payload.chatId = `GROUP#${activeUser.id}`;
  }

  /* ----------------------------------------------------
     ATTACHMENT LOGIC
  ---------------------------------------------------- */
  if (attachment) {
    // GIF attachment
    if (attachment.isGif && attachment.url) {
      payload.attachmentType = "image/gif";
      payload.attachmentKey = null;
      payload.gifUrl = attachment.url;
    }

    // File upload attachment
    else if (attachment instanceof File) {
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

  /* ----------------------------------------------------
     SEND MESSAGE TO BACKEND
  ---------------------------------------------------- */
  try {
    const res = await postJSON("/messages", payload);
    const parsed =
      typeof res?.body === "string" ? JSON.parse(res.body) : res;

    if (parsed?.success) {
      // Optimistic UI update
      setMessages((prev) => [...prev, parsed.item]);

      // Reset UI
      setText("");
      setAttachment(null);

      // Refresh messages
      setTimeout(() => loadMessages(), 300);
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
   💬 MessageBubble — with sender display name
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

  const senderName = msg.senderName || msg.sender;

  // Attachment type checks
  const fileType = msg.attachmentType || "";
  const isImage = fileType.startsWith("image/") && fileType !== "image/gif";
  const isGif =
  fileType === "image/gif" ||
  Boolean(msg.gifUrl);

  const isPDF = fileType === "application/pdf";
  const isOther = msg.attachmentKey && !isImage && !isGif && !isPDF;

  const displayUrl = msg.gifUrl || viewUrl;

  return (
    <div className={`flex flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
      
      {/* 👉 Sender Name */}
      {!isMine && (
        <div className="text-xs text-slate-500 mb-1 ml-1">
          {senderName}
        </div>
      )}

      <div
        className={`p-3 rounded-lg max-w-[70%] ${
          isMine ? "bg-blue-600 text-white" : "bg-white border"
        }`}
      >
        {/* Text */}
        {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}

        {/* GIF */}
        {displayUrl && isGif && (
          <img src={displayUrl} className="max-h-64 rounded mt-2 border" />
        )}

        {/* Images */}
        {displayUrl && isImage && (
          <img src={displayUrl} className="max-h-64 rounded mt-2 border" />
        )}

        {/* PDF / Other */}
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

        <div className="text-xs mt-2 opacity-70">{time}</div>
      </div>
    </div>
  );
}



