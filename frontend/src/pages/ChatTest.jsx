import { useEffect, useState } from "react";
import { sendMessage, getMessages } from "../lib/api";

export default function ChatTest() {
  const [sender, setSender] = useState("gerhard");
  const [receiver, setReceiver] = useState("bob");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    async function load() {
      const data = await getMessages();
      setMessages(data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    }
    load();
  }, []);

  async function handleSend() {
    if (!text.trim()) return;
    await sendMessage(sender, receiver, text);
    setText("");
    const updated = await getMessages();
    setMessages(updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-semibold mb-4">Chatr Test Chat</h1>

      <div className="space-y-2 mb-6">
        <input
          className="bg-gray-800 p-2 rounded w-full"
          placeholder="Your message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          onClick={handleSend}
        >
          Send
        </button>
      </div>

      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.messageid} className="border border-gray-700 p-2 rounded">
            <p><strong>{m.sender}</strong>: {m.text}</p>
            <small className="text-gray-400">{new Date(m.createdAt).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
