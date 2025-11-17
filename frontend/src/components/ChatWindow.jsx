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
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const pickerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimer = useRef(null);

  /* ----------------------------------------------------
     Normalize Chat ID
  ---------------------------------------------------- */
  function normalizeChatId(userA, userB) {
    if (!userA || !userB) return "";
    const sorted = [userA, userB].map((x) => x.toLowerCase()).sort();
    return `CHAT#${sorted[0]}#${sorted[1]}`;
  }

  /* ----------------------------------------------------
     Get Signed URL for attachments  (FIXED!)
  ---------------------------------------------------- */
  async function getSignedUrl(fileKey) {
    if (!fileKey) return null;

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
      if (activeUser.type === "group") {
        url = `/messages?groupid=${encodeURIComponent(activeUser.id)}`;
      } else {
        const userB = activeUser.username || activeUser.id;
        const chatId = normalizeChatId(currentUser, userB);
        url = `/messages?chatId=${encodeURIComponent(chatId)}`;
      }

      const res = await getJSON(url);
      let data = typeof res?.body === "string" ? JSON.parse(res.body) : res;

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

  /* ----------------------------------------------------
     ATTACHMENT URL INJECTION (FIXED!)
  ---------------------------------------------------- */
  useEffect(() => {
    async function injectUrls() {
      const updated = [];

      for (let m of messages) {
        if (m.attachmentKey) {
          const url = await getSignedUrl(m.attachmentKey);
          updated.push({ ...m, attachmentUrl: url });
        } else {
          updated.push(m);
        }
      }

      setMessages(updated);
    }

    if (messages.length) injectUrls();
  }, [messages]);

  /* ----------------------------------------------------
     MARK AS READ
  ---------------------------------------------------- */
  async function markAsRead() {
    if (!activeUser) return;

    try {
      const chatid =
        activeUser.type === "group"
          ? `GROUP#${activeUser.id}`
          : normalizeChatId(currentUser, activeUser.username || activeUser.id);

      await postJSON("/messages/mark-read", { chatid, username: currentUser });
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
          activeUser.type === "group"
            ? `GROUP#${activeUser.id}`
            : normalizeChatId(currentUser, activeUser.username || activeUser.id),
      });
    }

    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
      postJSON("/typing/stop", {
        username: currentUser,
        chatid:
          activeUser.type === "group"
            ? `GROUP#${activeUser.id}`
            : normalizeChatId(currentUser, activeUser.username || activeUser.id),
      });
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
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ----------------------------------------------------
     SEND MESSAGE
  ---------------------------------------------------- */
  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() && !attachment) return;

    setUploading(true);

    const payload = {
      sender: currentUser,
      senderName: localStorage.getItem("profileName") || currentUser,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      groupid: activeUser.type === "group" ? activeUser.id : null,
    };

    if (activeUser.type === "user") {
      const recipient = activeUser.username || activeUser.id;
      payload.recipient = recipient;
      payload.chatId = normalizeChatId(currentUser, recipient);
    } else {
      payload.chatId = `GROUP#${activeUser.id}`;
    }

    /* FILE ATTACHMENT FIXED */
    if (attachment) {
      if (attachment.isGif) {
        payload.attachmentType = "image/gif";
        payload.gifUrl = attachment.url;
      } else {
        try {
          const presign = await postJSON("/presign-upload", {
            filename: attachment.name,
            contentType: attachment.type,
          });

          await fetch(presign.uploadURL, {
            method: "PUT",
            headers: { "Content-Type": attachment.type },
            body: attachment,
          });

          payload.attachmentKey = presign.fileKey;
          payload.attachmentType = attachment.type;
        } catch (err) {
          console.error("🔥 Upload failed:", err);
        }
      }
    }

    const res = await postJSON("/messages", payload);
    const parsed = typeof res?.body === "string" ? JSON.parse(res.body) : res;

    if (parsed.success) {
      setMessages((prev) => [...prev, parsed.item]);
    }

    setText("");
    setAttachment(null);
    setUploading(false);
  }

  /* ----------------------------------------------------
     RENDER
  ---------------------------------------------------- */
  if (!activeUser)
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400 italic">
        Select a contact or group to start chatting
      </div>
    );

  return (
    <div className="flex flex-col flex-1 h-screen ml-[320px] bg-slate-50 relative">
      {/* HEADER */}
      <div className="sticky top-0 z-10 border-b bg-white/70 p-4 font-semibold">
        <div className="flex items-center gap-3">
          <Avatar seed={activeUser.name} username={activeUser.name} size={10} />
          <div>
            <div>{activeUser.name}</div>
            {remoteTyping && (
              <div className="text-xs text-slate-500 animate-pulse">
                typing...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MESSAGES */}
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

      {/* INPUT */}
      <ChatInput
        text={text}
        handleTypingChange={handleTypingChange}
        sendMessage={sendMessage}
        uploading={uploading}
        setAttachment={setAttachment}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        showGifPicker={showGifPicker}
        setShowGifPicker={setShowGifPicker}
      />
    </div>
  );
}

/* ============================================================
   💬 MessageBubble — FIXED ATTACHMENT DISPLAY
============================================================ */
function MessageBubble({ msg, currentUser, getSignedUrl }) {
  const [url, setUrl] = useState(msg.attachmentUrl || null);

  useEffect(() => {
    if (!url && msg.attachmentKey) {
      getSignedUrl(msg.attachmentKey).then((u) => setUrl(u));
    }
  }, [msg.attachmentKey]);

  const isMine = msg.sender === currentUser;

  const fileType = msg.attachmentType || "";
  const isImage = fileType.startsWith("image/") && fileType !== "image/gif";
  const isGif = fileType === "image/gif" || msg.gifUrl;
  const isPDF = fileType === "application/pdf";

  const displayUrl = msg.gifUrl || url;

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      {!isMine && (
        <div className="text-xs text-slate-500">{msg.senderName}</div>
      )}

      <div
        className={`p-3 rounded-lg max-w-[70%] ${
          isMine ? "bg-blue-600 text-white" : "bg-white border"
        }`}
      >
        {msg.text && <div>{msg.text}</div>}

        {displayUrl && isGif && (
          <img src={displayUrl} className="max-h-64 rounded mt-2 border" />
        )}

        {displayUrl && isImage && (
          <img src={displayUrl} className="max-h-64 rounded mt-2 border" />
        )}

        {displayUrl && isPDF && (
          <a
            href={displayUrl}
            target="_blank"
            className="flex items-center gap-2 mt-2 p-2 border rounded"
          >
            <FileText size={16} />
            Download PDF
          </a>
        )}

        <div className="text-xs opacity-70 mt-2">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
