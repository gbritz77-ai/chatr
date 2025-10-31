import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";

/* ==========================================================
   💬 Messages Page
========================================================== */
export default function Messages() {
  const [activeUser, setActiveUser] = useState(null);
  const currentUser = localStorage.getItem("username") || "Anonymous";

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-50 text-slate-800">
      <Sidebar onSelectUser={setActiveUser} currentUser={currentUser} />
      <main className="flex-1 flex flex-col">
        <ChatWindow activeUser={activeUser} currentUser={currentUser} />
      </main>
    </div>
  );
}
