import { useEffect, useState } from "react";
import { getMembers, getJSON } from "../lib/api";
import { Avatar } from "./Avatar";

export default function Sidebar({ onSelectUser, currentUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");

  /* =========================================================
     Load Members
  ========================================================= */
  useEffect(() => {
    async function loadMembers() {
      try {
        const res = await getMembers();
        if (res?.members)
          setMembers(res.members.filter((m) => m.username !== currentUser));
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
    <aside
      className="fixed top-0 left-0 bottom-0 w-[320px] bg-white border-r border-slate-200 flex flex-col z-20"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center space-x-3">
        <Avatar name="ChatConnect" size={2.5} />
        <div>
          <h1 className="text-lg font-bold">ChatConnect</h1>
          <p className="text-sm text-slate-500 -mt-0.5">
            Professional Messaging
          </p>
        </div>
      </div>

      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Search */}
        <div className="p-3 border-b">
          <input
            type="text"
            placeholder="🔍 Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Groups Section */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-600 text-sm">Groups</h2>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700"
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
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    <Avatar name={g.groupname} size={2.5} />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm truncate">
                          {g.groupname}
                        </span>
                        {unread > 0 && (
                          <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
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
          <h2 className="font-semibold text-slate-600 text-sm mb-2">Members</h2>
          {members.length ? (
            members
              .filter((m) =>
                m.username.toLowerCase().includes(search.toLowerCase())
              )
              .map((m) => {
                const chatId = `CHAT#${[currentUser, m.username]
                  .sort()
                  .join("#")}`;
                const unread = unreadMap[chatId] || 0;
                return (
                  <button
                    key={m.userid || m.username}
                    onClick={() => {
                      setActiveChat(`user-${m.username}`);
                      onSelectUser({ type: "user", username: m.username });
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3 transition ${
                      activeChat === `user-${m.username}`
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    <Avatar name={m.username} size={2.5} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm truncate">
                          {m.username}
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
          <Avatar name={currentUser} size={2.5} />
          <div>
            <div className="font-semibold text-sm">{currentUser}</div>
            <div className="text-xs text-emerald-600">Online</div>
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = "/login";
          }}
          className="text-xs text-red-500 font-semibold hover:underline"
        >
          Logout
        </button>
      </div>

      {/* Modal */}
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
                  key={m.username}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(m.username)}
                    onChange={() => toggleMember(m.username)}
                  />
                  <span>{m.username}</span>
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
