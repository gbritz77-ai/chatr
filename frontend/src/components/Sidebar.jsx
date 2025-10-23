// src/components/Sidebar.jsx
import { useEffect, useState } from "react";
import { getMembers, getJSON } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, MessageSquare } from "lucide-react";

export default function Sidebar({ onSelectUser, currentUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");

  const profileName = localStorage.getItem("profileName") || currentUser;

  /* =========================================================
     Load Members
  ========================================================= */
  useEffect(() => {
    async function loadMembers() {
      try {
        const res = await getMembers();
        if (res?.members)
          setMembers(
            res.members.filter(
              (m) => m.userid !== currentUser && m.profileName !== profileName
            )
          );
      } catch (err) {
        console.error("❌ Failed to fetch members:", err);
      }
    }
    loadMembers();
  }, [currentUser]);

  /* =========================================================
     Load Groups
  ========================================================= */
  async function loadGroups() {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE}/groups?username=${encodeURIComponent(
          currentUser
        )}`
      );
      const data = await res.json();
      if (data?.success && Array.isArray(data.data)) setGroups(data.data);
      else setGroups([]);
    } catch (err) {
      console.error("❌ Failed to fetch groups:", err);
    }
  }

  useEffect(() => {
    loadGroups();
  }, [currentUser]);

  /* =========================================================
     Load Unread Counts
  ========================================================= */
  async function loadUnreadCounts() {
    if (!currentUser) return;
    try {
      const res = await getJSON(
        `/messages/unread-counts?username=${encodeURIComponent(currentUser)}`
      );
      if (Array.isArray(res)) {
        const map = {};
        for (const entry of res) map[entry.chatId] = entry.unreadCount;
        setUnreadMap(map);
      }
    } catch (err) {
      console.error("❌ Failed to load unread counts:", err);
    }
  }

  useEffect(() => {
    loadUnreadCounts();
    const timer = setInterval(loadUnreadCounts, 2000);
    return () => clearInterval(timer);
  }, [currentUser]);

  /* =========================================================
     Group Creation
  ========================================================= */
  const toggleMember = (username) => {
    setSelectedMembers((prev) =>
      prev.includes(username)
        ? prev.filter((m) => m !== username)
        : [...prev, username]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return alert("Please enter a group name.");
    const membersToAdd = Array.from(new Set([...selectedMembers, currentUser]));
    if (membersToAdd.length < 2)
      return alert("A group must have at least 2 members.");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupname: groupName.trim(),
          members: membersToAdd,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Group "${groupName}" created!`);
        setShowModal(false);
        setGroupName("");
        setSelectedMembers([]);
        await loadGroups();
      } else alert("❌ Failed to create group.");
    } catch (err) {
      console.error("❌ Error creating group:", err);
    }
  };

  /* =========================================================
     Render
  ========================================================= */
  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[320px] bg-white border-r border-slate-200 flex flex-col z-20">
      {/* Header with Logo */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex flex-col items-center justify-center w-full">
          <img
            src="/logo/logo.JPG"
            alt="CHATr Logo"
            className="w-40 h-auto object-contain rounded-lg shadow-sm border border-slate-200"
          />
        </div>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = "/login";
          }}
          title="Logout"
          className="absolute right-5 top-5 text-slate-500 hover:text-red-600 transition"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="🔍 Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-400 outline-none"
        />
      </div>

      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Groups Section */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-600 text-sm flex items-center gap-1">
              <Users size={14} /> Groups
            </h2>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs bg-gray-800 text-white px-2 py-1 rounded-md hover:bg-gray-700"
            >
              + Create
            </button>
          </div>

          {groups.length ? (
            <div className="space-y-2">
              {groups.map((g) => {
                const unread = unreadMap[g.groupid] || 0;
                return (
                  <button
                    key={g.groupid}
                    onClick={() => {
                      setActiveChat(`group-${g.groupid}`);
                      onSelectUser({
                        type: "group",
                        id: g.groupid,
                        name: g.groupname,
                      });
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3 transition ${
                      activeChat === `group-${g.groupid}`
                        ? "bg-gray-100 text-gray-900"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <Avatar name={g.groupname} size={2.5} />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm truncate">
                          {g.groupname}
                        </span>
                        {unread > 0 && (
                          <span className="bg-gray-800 text-white text-xs px-2 py-0.5 rounded-full">
                            {unread}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {g.members?.length || 0} members
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm italic">No groups yet</p>
          )}
        </div>

        {/* Members Section */}
        <div className="px-4 py-3 space-y-2">
          <h2 className="font-semibold text-slate-600 text-sm mb-2 flex items-center gap-1">
            <MessageSquare size={14} /> Members
          </h2>
          {members.length ? (
            members
              .filter((m) =>
                (m.profileName || m.userid)
                  .toLowerCase()
                  .includes(search.toLowerCase())
              )
              .map((m) => {
                const chatId = `CHAT#${[currentUser, m.userid]
                  .sort()
                  .join("#")}`;
                const unread = unreadMap[chatId] || 0;
                return (
                  <button
                    key={m.userid}
                    onClick={() => {
                      setActiveChat(`user-${m.userid}`);
                      onSelectUser({
                        type: "user",
                        username: m.userid,
                        name: m.profileName || m.userid,
                      });
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3 transition ${
                      activeChat === `user-${m.userid}`
                        ? "bg-gray-100 text-gray-900"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <Avatar
                      name={m.profileName || m.userid}
                      size={2.5}
                      style="micah"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm truncate">
                          {m.profileName || m.userid}
                        </span>
                        {unread > 0 && (
                          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                            {unread}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        Offline — No messages yet
                      </p>
                    </div>
                  </button>
                );
              })
          ) : (
            <p className="text-slate-400 text-sm italic">No members yet</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 p-4 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <Avatar name={profileName} size={2.5} />
          <div>
            <div className="font-semibold text-sm">{profileName}</div>
            <div className="text-xs text-emerald-600">Online</div>
          </div>
        </div>
      </div>

      {/* Group Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6">
            <h2 className="text-lg font-semibold mb-4">Create Group</h2>
            <input
              type="text"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 mb-4"
            />
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-2 mb-4">
              {members.map((m) => (
                <label
                  key={m.userid}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(m.userid)}
                    onChange={() => toggleMember(m.userid)}
                  />
                  <span>{m.profileName || m.userid}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-2 text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
