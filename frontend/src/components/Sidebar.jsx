import React, { useEffect, useState } from "react";
import { getMembers, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, Trash2, Plus, X } from "lucide-react";

export default function Sidebar({ onSelectUser, currentUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [newMember, setNewMember] = useState("");

  const profileName = localStorage.getItem("profileName") || currentUser;

  /* =========================================================
     Load Members
  ========================================================= */
  useEffect(() => {
    async function loadMembers() {
      try {
        const res = await getMembers();
        const data =
          typeof res === "string"
            ? JSON.parse(res)
            : typeof res?.body === "string"
            ? JSON.parse(res.body)
            : res;

        const membersData = data?.members || data?.data || data?.Items || [];
        const filtered = membersData.filter((m) => {
          const uid = (m.userid || "").toLowerCase();
          const pname = (m.profileName || "").toLowerCase();
          const cur = (currentUser || "").toLowerCase();
          const prof = (profileName || "").toLowerCase();
          return uid !== cur && pname !== prof;
        });
        setMembers(filtered);
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
        `${API_BASE}/groups?username=${encodeURIComponent(currentUser)}`
      );
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;

      if (data?.success) {
        const normalized = (data.groups || []).map((g) => ({
          ...g,
          groupName: g.groupName || g.groupname || "",
        }));
        setGroups(normalized);
      } else {
        setGroups([]);
      }
    } catch (err) {
      console.error("❌ [Sidebar] Failed to fetch groups:", err);
    }
  }

  useEffect(() => {
    loadGroups();
    const interval = setInterval(loadGroups, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  /* =========================================================
     🔢 Load Unread Counts
  ========================================================= */
  async function loadUnreadCounts() {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${API_BASE}/messages/unread-counts?username=${encodeURIComponent(
          currentUser
        )}`
      );
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;
      if (data?.success && typeof data.unreadMap === "object") {
        setUnreadMap(data.unreadMap);
      }
    } catch (err) {
      console.error("❌ Failed to load unread counts:", err);
    }
  }

  useEffect(() => {
    loadUnreadCounts();
    const interval = setInterval(loadUnreadCounts, 8000);
    return () => clearInterval(interval);
  }, [currentUser]);

  /* =========================================================
     Create / Manage Groups
  ========================================================= */
  async function handleCreateGroup() {
    if (!groupName.trim() || selectedMembers.length === 0) {
      alert("Please provide a group name and select at least one member.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName,
          creator: currentUser,
          members: selectedMembers,
        }),
      });
      const data = await res.json();
      const parsed = typeof data?.body === "string" ? JSON.parse(data.body) : data;
      if (parsed?.success) {
        alert("✅ Group created!");
        setShowCreateModal(false);
        setGroupName("");
        setSelectedMembers([]);
        loadGroups();
      } else {
        alert("⚠️ " + (parsed?.message || "Failed to create group"));
      }
    } catch (err) {
      console.error("❌ Group creation failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveMember(username) {
    if (!selectedGroup) return;
    if (!window.confirm(`Remove ${username} from ${selectedGroup.groupName}?`))
      return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/groups/remove`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupid: selectedGroup.groupid,
          username,
          requester: currentUser,
        }),
      });
      const data = await res.json();
      const parsed = typeof data?.body === "string" ? JSON.parse(data.body) : data;
      if (parsed?.success) {
        alert("✅ Member removed");
        loadGroups();
      } else alert("⚠️ " + (parsed?.message || "Failed to remove member"));
    } catch (err) {
      console.error("❌ Remove member failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember() {
    if (!selectedGroup || !newMember) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/groups/add`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupid: selectedGroup.groupid,
          username: newMember,
          requester: currentUser,
        }),
      });
      const data = await res.json();
      const parsed = typeof data?.body === "string" ? JSON.parse(data.body) : data;
      if (parsed?.success) {
        alert("✅ Member added");
        setNewMember("");
        loadGroups();
      } else {
        alert("⚠️ " + (parsed?.message || "Failed to add member"));
      }
    } catch (err) {
      console.error("❌ Add member failed:", err);
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     Render Lists
  ========================================================= */
  const filteredGroups = groups.filter((g) =>
    g.groupName?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredMembers = members.filter((m) =>
    m.profileName?.toLowerCase().includes(search.toLowerCase())
  );

  const getChatKey = (type, id, otherUser) =>
    type === "group"
      ? `GROUP#${id}`
      : `CHAT#${[currentUser, otherUser]
          .sort((a, b) => a.localeCompare(b))
          .join("#")}`;

  /* =========================================================
     Render
  ========================================================= */
  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[320px] bg-white border-r border-slate-200 flex flex-col z-20">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between relative">
        <div className="flex flex-col items-center justify-center w-full">
          <img
            src="/logo/logo.JPG"
            alt="CHATr Logo"
            className="w-40 h-auto object-contain rounded-lg shadow-sm border border-slate-200"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            <strong>Debug:</strong> {members.length} members, {groups.length} groups
          </p>
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

      {/* Members */}
      <div className="p-3 border-b">
        <h2 className="font-semibold text-slate-600 text-sm mb-2">👤 Members</h2>
        {filteredMembers.length ? (
          <div className="space-y-1">
            {filteredMembers.map((m) => {
              const chatKey = getChatKey("user", null, m.userid);
              const unread = unreadMap[chatKey] || 0;
              return (
                <button
                  key={m.userid}
                  onClick={() => {
                    setActiveChat(`user-${m.userid}`);
                    setUnreadMap((prev) => ({ ...prev, [chatKey]: 0 }));
                    onSelectUser({
                      type: "user",
                      id: m.userid,
                      name: m.profileName,
                    });
                  }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md w-full text-left transition ${
                    activeChat === `user-${m.userid}`
                      ? "bg-gray-100 text-gray-900"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <Avatar name={m.profileName} size={2.2} />
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-sm font-medium truncate">
                      {m.profileName}
                    </span>
                    {unread > 0 && (
                      <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {unread}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-400 text-sm italic">No members found</p>
        )}
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-600 text-sm flex items-center gap-1">
            <Users size={14} /> Groups
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-xs bg-gray-800 text-white px-2 py-1 rounded-md hover:bg-gray-700"
          >
            + Create
          </button>
        </div>

        {filteredGroups.length ? (
          <div className="space-y-2">
            {filteredGroups.map((g) => {
              const chatKey = `GROUP#${g.groupid}`;
              const unread = unreadMap[chatKey] || 0;
              return (
                <button
                  key={g.groupid}
                  onClick={() => {
                    setActiveChat(`group-${g.groupid}`);
                    setUnreadMap((prev) => ({ ...prev, [chatKey]: 0 }));
                    onSelectUser({
                      type: "group",
                      id: g.groupid,
                      name: g.groupName,
                    });
                    setSelectedGroup(g);
                  }}
                  onDoubleClick={() => {
                    setSelectedGroup(g);
                    setShowManageModal(true);
                  }}
                  className={`flex w-full text-left px-3 py-2 rounded-md items-center gap-3 transition ${
                    activeChat === `group-${g.groupid}`
                      ? "bg-gray-100 text-gray-900"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <Avatar name={g.groupName} size={2.5} />
                  <div className="flex-1 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm truncate">
                        {g.groupName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {g.members?.length || 0} members
                      </div>
                    </div>
                    {unread > 0 && (
                      <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {unread}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-400 text-sm italic">No groups yet</p>
        )}
      </div>

      {/* 🧩 Create & Manage Group Modals — unchanged */}
      {/* (keep your original modal code here) */}
    </aside>
  );
}
