import React, {
  useState,
  useEffect,
  useRef,
  useCallback, // ✅ added
} from "react";
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
  X,
} from "lucide-react";

/* ============================================================
   💬 ChatWindow — WhatsApp style + attachment support
   - Single attachment per message
   - Supports:
     • Text
     • File upload via S3 (attachmentKey + attachmentType)
     • GIF via gifUrl (no S3)
   - Uses presign-download for viewing S3 files
   - Caches signed URLs to avoid repeated calls
============================================================ */
export default function ChatWindow({ activeUser, currentUser }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [attachment, setAttachment] = useState(null); // File OR { isGif, url }
  const [uploading, setUploading] = useState(false);

  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [signedUrlCache, setSignedUrlCache] = useState({}); // key -> url

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  /* ----------------------------------------------------
     Normalize Chat ID for DMs
  ---------------------------------------------------- */
  function normalizeChatId(userA, userB) {
    if (!userA || !userB) return "";
    const sorted = [userA, userB].map((x) => x.toLowerCase()).sort();
    return `CHAT#${sorted[0]}#${sorted[1]}`;
  }

  /* ----------------------------------------------------
<<<<<<< HEAD
     Signed URL helper (memoized + cache)
  ---------------------------------------------------- */
  const getSignedUrl = useCallback(
    async (fileKey) => {
      if (!fileKey) return null;

      // 1️⃣ Check cache
      if (signedUrlCache[fileKey]) {
        return signedUrlCache[fileKey];
      }

      try {
        const res = await postJSON("/presign-download", { key: fileKey });
        const url = res?.viewURL || res?.url || null;

        if (url) {
          setSignedUrlCache((prev) => ({
            ...prev,
            [fileKey]: url,
          }));
        }

        return url;
      } catch (err) {
        console.error("❌ Signed URL error:", err);
        return null;
      }
    },
    [signedUrlCache] // ✅ stable identity, but updates when cache changes
  );

  /* ----------------------------------------------------
     Load Messages
  ---------------------------------------------------- */
  async function loadMessages() {
    if (!activeUser || !currentUser) return;

    try {
      let url = "";

      if (activeUser.type === "group") {
        // Group chat → by groupid
        url = `/messages?chatId=${encodeURIComponent(`GROUP#${activeUser.id}`)}`;

      } else {
        // DM → by chatId
        const other = activeUser.username || activeUser.id;
        const chatId = normalizeChatId(currentUser, other);
        url = `/messages?chatId=${encodeURIComponent(chatId)}`;
      }

      const res = await getJSON(url);
      const data = typeof res?.body === "string" ? JSON.parse(res.body) : res;

      const items = data.items || data.messages || [];
      setMessages(items);
    } catch (err) {
      console.error("❌ Load messages error:", err);
      setMessages([]);
    }
  }

  useEffect(() => {
    if (activeUser) {
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser?.id, activeUser?.type]);

  /* ----------------------------------------------------
     Auto scroll behaviour
=======
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
>>>>>>> b086b80ce3911f64290ca3110fa135ce93e4eb3f
  ---------------------------------------------------- */
  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;

    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    setAutoScrollEnabled(atBottom);
  }

  useEffect(() => {
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScrollEnabled]);

  /* ----------------------------------------------------
<<<<<<< HEAD
     SEND MESSAGE (single attachment) — full flow
  ---------------------------------------------------- */
  async function sendMessage(e) {
    e.preventDefault();

    const hasText = text.trim().length > 0;
    const hasAttachment = !!attachment;

    if (!hasText && !hasAttachment) return;
=======
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
>>>>>>> b086b80ce3911f64290ca3110fa135ce93e4eb3f

  const payload = {
    sender: currentUser,
    senderName: localStorage.getItem("profileName") || currentUser,
    recipient: isUser ? recipientValue : null,
    groupid: isGroup ? activeUser.id : null,
    text: text.trim() || null, // allow null for attachment-only messages
    timestamp,
  };

<<<<<<< HEAD
    const payload = {
      sender: currentUser,
      senderName: localStorage.getItem("profileName") || currentUser,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      groupid: activeUser.type === "group" ? activeUser.id : null,
    };

    // DM vs GROUP routing
    if (activeUser.type === "user") {
      const recipient = activeUser.username || activeUser.id;
      payload.recipient = recipient;
      payload.chatId = normalizeChatId(currentUser, recipient);
    } else {
      payload.chatId = `GROUP#${activeUser.id}`;
    }

    /* -----------------------------
       Attachment handling
    ----------------------------- */
    if (attachment) {
      try {
        // 🎞 GIF via external URL (no S3 upload)
        if (attachment.isGif) {
          payload.attachmentKind = "gif";
          payload.attachmentType = "image/gif";
          payload.gifUrl = attachment.url;
        } else {
          // 📁 File upload → presign + S3 PUT
          const file = attachment;

          const presign = await postJSON("/presign-upload", {
            filename: file.name,
            contentType: file.type,
          });

          if (!presign?.uploadURL || !presign?.key) {
            console.error("❌ Invalid presign-upload:", presign);
            throw new Error("Invalid presign-upload response");
          }

          // Upload file to S3
          const uploadRes = await fetch(presign.uploadURL, {
            method: "PUT",
            headers: {
              "Content-Type": file.type,
            },
            body: file,
          });

          if (!uploadRes.ok) {
            console.error("❌ S3 upload error:", uploadRes.status);
            throw new Error("S3 upload failed");
          }

          // Store attachment metadata on the message
          payload.attachmentKey = presign.key;
          payload.attachmentType = file.type;
          payload.attachmentKind = file.type.startsWith("image/")
            ? "image"
            : file.type === "application/pdf"
            ? "pdf"
            : "file";
        }
      } catch (err) {
        console.error("🔥 Attachment upload failed:", err);
        alert("Upload failed: " + err.message);
        setUploading(false);
        return;
      }
    }

    /* ----------------------------------------------------
       SAVE MESSAGE
    ---------------------------------------------------- */
    try {
      const res = await postJSON("/messages", payload);
      const parsed =
        typeof res?.body === "string" ? JSON.parse(res.body) : res;

      if (parsed?.success) {
        await loadMessages();
      } else {
        console.error("❌ Save message failed:", parsed);
      }
    } catch (err) {
      console.error("❌ POST /messages failed:", err);
    }

    setText("");
    setAttachment(null);
    setUploading(false);
  }

  /* ----------------------------------------------------
     RENDER
=======
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
>>>>>>> b086b80ce3911f64290ca3110fa135ce93e4eb3f
  ---------------------------------------------------- */
  if (!activeUser) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400 italic">
        Select a contact or group to start chatting
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-screen ml-[320px] bg-slate-50 relative">
      {/* HEADER */}
      <div className="sticky top-0 z-10 border-b bg-white/70 p-4 font-semibold">
        <div className="flex items-center gap-3">
          <Avatar
            seed={activeUser.name}
            username={activeUser.name}
            size={10}
          />
          <div>{activeUser.name}</div>
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

      {/* ATTACHMENT PREVIEW (single) */}
      {attachment && (
        <div className="absolute bottom-24 left-10 w-[300px] z-50">
          <div className="bg-white shadow rounded-xl p-3 flex items-center gap-3 border">
            {/* Thumbnail */}
            {attachment.isGif ? (
              <img
                src={attachment.url}
                className="w-12 h-12 object-cover rounded"
              />
            ) : attachment.type?.startsWith("image/") ? (
              <img
                src={URL.createObjectURL(attachment)}
                className="w-12 h-12 object-cover rounded border"
              />
            ) : (
              <FileText size={24} />
            )}

            {/* Info */}
            <div className="flex flex-col text-sm">
              <span className="font-semibold truncate w-40">
                {attachment.name || "GIF"}
              </span>
              {!attachment.isGif && attachment.size != null && (
                <span className="text-xs text-slate-500">
                  {(attachment.size / 1024).toFixed(1)} KB
                </span>
              )}
            </div>

            {/* Remove */}
            <button
              onClick={() => setAttachment(null)}
              className="ml-auto bg-red-500 text-white rounded-full p-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* INPUT BAR */}
      <div className="p-4 border-t bg-white">
        <form
          onSubmit={sendMessage}
          className="flex items-center gap-2 relative"
        >
          {/* Emoji */}
          <button
            type="button"
            onClick={() => {
              setShowGifPicker(false);
              setShowEmojiPicker((v) => !v);
            }}
            className="p-2 hover:bg-slate-200 rounded-full"
          >
            <Smile size={20} />
          </button>

          {/* GIF */}
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(false);
              setShowGifPicker((v) => !v);
            }}
            className="p-2 hover:bg-slate-200 rounded-full"
          >
            <Image size={20} />
          </button>

          {/* File picker */}
          <label className="p-2 hover:bg-slate-200 rounded-full cursor-pointer">
            <Paperclip size={20} />
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setAttachment(file);
              }}
            />
          </label>

          {/* Textbox */}
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border rounded-full px-4 py-2"
          />

          {/* Send */}
          <button
            type="submit"
            disabled={uploading}
            className="p-2 bg-blue-600 text-white rounded-full"
          >
            {uploading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-4 bg-white shadow-lg border rounded-lg z-50">
            <Picker
              data={data}
              onEmojiSelect={(emoji) =>
                setText((prev) => prev + (emoji.native || ""))
              }
            />
          </div>
        )}

        {/* GIF Picker */}
        {showGifPicker && (
          <div className="absolute bottom-20 left-4 z-50">
            <GifPicker
              onSelect={(gifUrl) => {
                setAttachment({ isGif: true, url: gifUrl });
                setShowGifPicker(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   💬 MESSAGE BUBBLE — Handles text + attachments
============================================================ */
function MessageBubble({ msg, currentUser, getSignedUrl, signedUrlCache }) {
  const isMine = msg.sender === currentUser;

  const legacy = msg.attachments?.[0] || null;

  const attachmentKey = msg.attachmentKey || legacy?.attachmentKey || null;
  const attachmentType = msg.attachmentType || legacy?.attachmentType || "";
  const gifUrl = msg.gifUrl || legacy?.gifUrl || null;

  const isImage = attachmentType.startsWith("image/") && attachmentType !== "image/gif";
  const isGif = !!gifUrl || attachmentType === "image/gif";
  const isPDF = attachmentType === "application/pdf";

  const [url, setUrl] = React.useState(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveUrl() {
      // ✅ GIFs do not use presigned URLs
      if (gifUrl) {
        setUrl(gifUrl);
        return;
      }

      if (!attachmentKey) return;

      // ✅ Use cache FIRST
      if (signedUrlCache?.[attachmentKey]) {
        setUrl(signedUrlCache[attachmentKey]);
        return;
      }

      const signed = await getSignedUrl(attachmentKey);
      if (!cancelled) setUrl(signed);
    }

    resolveUrl();

<<<<<<< HEAD
    return () => {
      cancelled = true;
    };
  }, [attachmentKey, gifUrl]); // 🔥 IMPORTANT: no getSignedUrl dependency
=======
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
>>>>>>> b086b80ce3911f64290ca3110fa135ce93e4eb3f

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      {!isMine && (
        <div className="text-xs text-slate-500 mb-1">{msg.senderName}</div>
      )}

      <div
        className={`p-3 rounded-2xl max-w-[70%] shadow-sm ${
          isMine ? "bg-blue-600 text-white" : "bg-white border"
        }`}
      >
        {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}

        {/* Image / GIF */}
        {url && (isImage || isGif) && (
          <img
            src={url}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="max-h-64 rounded-xl mt-2 border bg-white"
            alt="attachment"
          />
        )}

        {/* PDF */}
        {url && isPDF && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-xl border ${
              isMine ? "bg-white text-black" : "bg-slate-50"
            }`}
          >
            <FileText size={16} />
            <span className="text-xs font-medium truncate">
              Open PDF document
            </span>
          </a>
        )}

        <div className="text-[10px] opacity-70 mt-2 text-right">
          {msg.timestamp
            ? new Date(msg.timestamp).toLocaleTimeString()
            : ""}
        </div>
      </div>
    </div>
  );
}

