import { useState, useEffect, useRef } from "react";
import { postJSON, getJSON } from "../lib/api";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Avatar } from "../components/Avatar";
import { Send, Smile, Paperclip } from "lucide-react";

/* ============================================================
   💬 Main ChatWindow Component
============================================================ */
export default function ChatWindow({ activeUser, currentUser, onUploadFile }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [lastReadTimestamp, setLastReadTimestamp] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});

  const pickerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimer = useRef(null);

  const currentProfileName =
    localStorage.getItem("profileName") || currentUser;

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
        url = `/messages?userA=${encodeURIComponent(
          currentUser
        )}&userB=${encodeURIComponent(activeUser.username)}`;
      }

      const res = await getJSON(url);
      setMessages(res?.messages || []);
    } catch (err) {
      console.error("❌ Failed to load messages:", err);
    }
  }

  /* ----------------------------------------------------
     AUTO-REFRESH EVERY 2 SECONDS
  ---------------------------------------------------- */
  useEffect(() => {
    if (!activeUser || !currentUser) return;
    loadMessages();
    const interval = setInterval(loadMessages, 2000);
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
          ? activeUser.id
          : `CHAT#${[activeUser.username, currentUser].sort().join("#")}`;

      await postJSON("/messages/mark-read", {
        chatId,
        username: currentUser,
      });

      setLastReadTimestamp(new Date().toISOString());
    } catch (err) {
      console.error("❌ Failed to mark chat as read:", err);
    }
  }

  /* ----------------------------------------------------
     PRESENCE + TYPING (Simulated)
  ---------------------------------------------------- */
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeUser?.username) {
        setOnlineUsers((prev) => ({
          ...prev,
          [activeUser.username]: Math.random() > 0.2, // 80% chance online
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

  useEffect(() => {
    if (!activeUser) return;
    const interval = setInterval(() => {
      setRemoteTyping(Math.random() > 0.85);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeUser]);

  /* ----------------------------------------------------
     AUTO-SCROLL
  ---------------------------------------------------- */
  useEffect(() => {
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
    if ((!text.trim() && !attachment) || !activeUser) return;

    try {
      let fileKey = null;
      let fileType = null;

      if (attachment) {
        const uploadRes = await onUploadFile(attachment);
        if (uploadRes?.success) {
          fileKey = uploadRes.key;
          fileType = attachment.type;
        }
      }

      const payload =
        activeUser.type === "group"
          ? {
              sender: currentUser,
              groupid: activeUser.id,
              text: text || null,
              attachmentKey: fileKey,
              attachmentType: fileType,
            }
          : {
              sender: currentUser,
              recipient: activeUser.username,
              text: text || null,
              attachmentKey: fileKey,
              attachmentType: fileType,
            };

      await postJSON("/messages", payload);
      setText("");
      setAttachment(null);
      setShowEmojiPicker(false);
      await loadMessages();
      await markAsRead();
    } catch (err) {
      console.error("❌ Failed to send message:", err);
    }
  }

  /* ----------------------------------------------------
     EMOJI + FILE
  ---------------------------------------------------- */
  const toggleEmojiPicker = () => setShowEmojiPicker((p) => !p);
  const handleEmojiSelect = (emoji) => setText((t) => t + emoji.native);
  const handleFileChange = (file) => file && setAttachment(file);

  /* ----------------------------------------------------
     RENDER MESSAGES
  ---------------------------------------------------- */
  function renderMessages() {
    return messages.map((msg) => renderBubble(msg));
  }

  function renderBubble(msg) {
    const isMine = msg.sender === currentUser;
    const senderName =
      msg.sender === currentUser
        ? currentProfileName
        : msg.senderProfileName || msg.sender || "Unknown";

    const time = new Date(msg.timestamp).toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    });

    const isOnline = onlineUsers[msg.sender];

    return (
      <div
        key={msg.messageid || `${msg.sender}-${msg.timestamp}`}
        className={`flex items-end gap-2 ${
          isMine ? "flex-row-reverse text-right" : "flex-row text-left"
        }`}
      >
        <div className="relative">
          <Avatar
            seed={senderName}
            username={senderName}
            size={10}
            style="micah"
          />
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
          )}
        </div>

        <div
          className={`p-3 rounded-lg max-w-[70%] ${
            isMine
              ? "bg-blue-600 text-white ml-auto"
              : "bg-white border text-slate-800"
          }`}
        >
          {!isMine && (
            <div className="text-xs font-semibold text-slate-500 mb-1">
              {senderName}
            </div>
          )}
          {msg.text && (
            <div className="whitespace-pre-wrap break-words">{msg.text}</div>
          )}
          {msg.attachmentKey && (
            <a
              href={`${import.meta.env.VITE_API_BASE}/attachments?key=${encodeURIComponent(
                msg.attachmentKey
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 underline text-blue-200 hover:text-blue-400"
            >
              📎 {msg.attachmentKey.split("/").pop()}
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
              seed={activeUser.name || activeUser.username}
              username={activeUser.name || activeUser.username}
              size={10}
              style="micah"
            />
            <div>
              <div>{activeUser.name || activeUser.username}</div>
              {remoteTyping && (
                <div className="text-xs text-slate-500 animate-pulse">
                  typing...
                </div>
              )}
            </div>
          </>
        ) : (
          "Welcome to CHATr"
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-[160px]">
        {activeUser ? (
          messages.length ? (
            renderMessages()
          ) : (
            <p className="text-center text-slate-400 italic">
              No messages yet
            </p>
          )
        ) : (
          <p className="text-center text-slate-400 italic mt-10">
            Select a contact or group to start chatting
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Input Bar */}
      {activeUser && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-full shadow-lg px-6 py-3 w-[90%] max-w-3xl transition">
          <form onSubmit={sendMessage} className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleEmojiPicker}
              className={`p-2 rounded-full transition ${
                showEmojiPicker
                  ? "text-blue-600 bg-blue-50"
                  : "text-slate-500 hover:text-blue-600 hover:bg-slate-100"
              }`}
              title="Insert emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            {showEmojiPicker && (
              <div
                ref={pickerRef}
                className="absolute bottom-16 left-0 z-50 shadow-xl border rounded-lg bg-white"
              >
                <Picker
                  data={data}
                  theme="light"
                  onEmojiSelect={handleEmojiSelect}
                />
              </div>
            )}

            <label
              title="Attach file"
              className="p-2 rounded-full cursor-pointer text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition"
            >
              <Paperclip className="w-5 h-5" />
              <input
                type="file"
                hidden
                onChange={(e) => handleFileChange(e.target.files[0])}
              />
            </label>

            <input
              type="text"
              placeholder="Type a message..."
              value={text}
              onChange={handleTypingChange}
              className="flex-1 bg-transparent border-none focus:outline-none text-sm text-slate-700 px-2"
            />

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-sm transition"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
