import React, { useEffect, useState } from "react";
import { getMembers, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, X, Clock, Plus, Edit3, Trash2 } from "lucide-react";
import { useTabNotification } from "../hooks/useTabNotification";

export default function Sidebar({ onSelectUser, currentUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [search, setSearch] = useState("");

  // Group modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Schedule
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [schedule, setSchedule] = useState({
    start: "09:00",
    end: "17:00",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  });
  const [mySchedule, setMySchedule] = useState(null);
  const [isSelfActive, setIsSelfActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const profileName = localStorage.getItem("profileName") || currentUser;
  const totalUnread = Object.values(unreadMap || {}).reduce((a, b) => a + b, 0);
  useTabNotification(totalUnread);

  /* =========================================================
     Load Members & Groups
  ========================================================= */
  useEffect(() => {
    async function loadData() {
      try {
        const res = await getMembers();
        const data =
          typeof res === "string"
            ? JSON.parse(res)
            : typeof res?.body === "string"
            ? JSON.parse(res.body)
            : res;

        const membersData = data?.members || data?.Items || [];
        setMembers(membersData);

        const groupRes = await fetch(`${API_BASE}/groups`);
        const groupRaw = await groupRes.json();
        const groupData =
          typeof groupRaw?.body === "string" ? JSON.parse(groupRaw.body) : groupRaw;
        const parsedGroups = groupData?.groups || [];
        setGroups(Array.isArray(parsedGroups) ? parsedGroups : []);
      } catch (err) {
        console.error("❌ Failed to load members/groups:", err);
      }
    }
    loadData();
  }, [currentUser]);

  /* =========================================================
     Unread counts
  ========================================================= */
  useEffect(() => {
    async function loadUnreadCounts() {
      try {
        const res = await fetch(
          `${API_BASE}/messages/unread-counts?username=${encodeURIComponent(currentUser)}`
        );
        const raw = await res.json();
        const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;
        if (data?.success && typeof data.unreadMap === "object") setUnreadMap(data.unreadMap);
      } catch (err) {
        console.error("❌ Failed to load unread:", err);
      }
    }
    loadUnreadCounts();
    const interval = setInterval(loadUnreadCounts, 8000);
    return () => clearInterval(interval);
  }, [currentUser]);

  /* =========================================================
     Helper methods
  ========================================================= */
  const getChatKey = (type, id, otherUser) =>
    type === "group"
      ? `GROUP#${id}`
      : `CHAT#${[currentUser, otherUser].sort().join("#")}`;

  async function markRead(chatKey) {
    try {
      await fetch(`${API_BASE}/messages/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatKey, username: currentUser }),
      });
      setUnreadMap((prev) => ({ ...prev, [chatKey]: 0 }));
    } catch (err) {
      console.error("❌ markRead failed:", err);
    }
  }

  /* =========================================================
     🧱 Create Group
  ========================================================= */
  async function handleCreateGroup() {
    if (!newGroupName.trim() || selectedMembers.length === 0) {
      alert("⚠️ Enter a group name and select members");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName: newGroupName.trim(),
          creator: currentUser,
          members: selectedMembers,
        }),
      });
      const data = await res.json();
      const parsed = typeof data?.body === "string" ? JSON.parse(data.body) : data;
      if (parsed.success) {
        alert("✅ Group created!");
        setGroups((prev) => [...prev, parsed.group]);
        setShowCreateModal(false);
      }
    } catch (err) {
      alert("❌ Error creating group");
      console.error(err);
    }
  }

  /* =========================================================
     ✏️ Manage Group
  ========================================================= */
  function openManageGroup(group) {
    setSelectedGroup(group);
    setSelectedMembers(group.members || []);
    setShowManageModal(true);
  }

  async function handleSaveGroupChanges() {
    try {
      await fetch(`${API_BASE}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedGroup),
      });
      alert("✅ Group updated");
      setShowManageModal(false);
    } catch (err) {
      alert("❌ Failed to save group changes");
      console.error(err);
    }
  }

  async function handleDeleteGroup() {
    if (!selectedGroup) return;
    if (!window.confirm("⚠️ Delete this group permanently?")) return;
    try {
      await fetch(`${API_BASE}/groups/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupid: selectedGroup.groupid }),
      });
      setGroups((prev) => prev.filter((g) => g.groupid !== selectedGroup.groupid));
      setShowManageModal(false);
      alert("🗑️ Group deleted");
    } catch (err) {
      alert("❌ Error deleting group");
      console.error(err);
    }
  }

  /* =========================================================
     🧱 Render
  ========================================================= */
  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[320px] bg-white border-r border-slate-200 flex flex-col z-20">
      {/* Header */}
      <div className="px-5 py-4 border-b flex justify-between items-center">
        <img
          src="/logo/logo.JPG"
          alt="CHATr Logo"
          className="w-40 h-auto object-contain rounded-md shadow-sm border border-slate-200"
        />
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = "/login";
          }}
          title="Logout"
          className="text-slate-500 hover:text-red-600 transition"
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

      {/* Groups */}
      <div className="p-3 border-b overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-slate-600 text-sm flex items-center gap-2">
            <Users size={14} /> Groups
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600 transition"
          >
            <Plus size={12} />
          </button>
        </div>

        {groups.length ? (
          groups.map((g) => {
            const chatKey = getChatKey("group", g.groupid);
            const unread = unreadMap[chatKey] || 0;
            return (
              <div
                key={g.groupid}
                className="flex items-center justify-between w-full py-2 px-3 rounded-md text-sm hover:bg-gray-50 transition"
              >
                <button
                  onClick={() => {
                    markRead(chatKey);
                    setActiveChat(`group-${g.groupid}`);
                    onSelectUser({
                      type: "group",
                      id: g.groupid,
                      name: g.groupname || g.groupName,
                    });
                  }}
                  className="flex-1 text-left"
                >
                  {g.groupname || g.groupName}
                </button>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <span className="bg-blue-500 text-white text-xs font-semibold rounded-full px-2 py-0.5">
                      {unread}
                    </span>
                  )}
                  <button
                    onClick={() => openManageGroup(g)}
                    className="text-gray-500 hover:text-blue-600 transition"
                    title="Edit Group"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-slate-400 text-xs italic">No groups yet</p>
        )}
      </div>

      {/* Members */}
      <div className="flex-1 overflow-y-auto p-3 border-b">
        <h2 className="font-semibold text-slate-600 text-sm mb-2">👤 Members</h2>
        {members.map((m) => (
          <button
            key={m.userid}
            onClick={() => {
              const chatKey = getChatKey("user", null, m.userid);
              markRead(chatKey);
              setActiveChat(`user-${m.userid}`);
              onSelectUser({
                type: "user",
                id: m.userid,
                name: m.profileName,
              });
            }}
            className="flex justify-between items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <Avatar name={m.profileName} size={2.2} />
              <span>{m.profileName}</span>
            </div>
          </button>
        ))}
      </div>

      {/* 🆕 Manage Group Modal */}
      {showManageModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[420px] p-5 relative">
            <button
              onClick={() => setShowManageModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-semibold mb-3">
              Edit Group — {selectedGroup.groupname || selectedGroup.groupName}
            </h3>

            <label className="text-sm font-medium text-gray-700">Members:</label>
            <div className="h-40 overflow-y-auto border rounded-md p-2 mt-1">
              {members.map((m) => (
                <label key={m.userid} className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(m.userid)}
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelectedMembers([...selectedMembers, m.userid]);
                      else
                        setSelectedMembers(selectedMembers.filter((id) => id !== m.userid));
                    }}
                  />
                  {m.profileName}
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleDeleteGroup}
                className="bg-red-500 text-white text-sm px-3 py-2 rounded-md hover:bg-red-600"
              >
                <Trash2 size={14} className="inline-block mr-1" />
                Delete
              </button>
              <button
                onClick={() => setShowManageModal(false)}
                className="bg-gray-300 text-gray-800 text-sm px-3 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGroupChanges}
                className="bg-blue-600 text-white text-sm px-3 py-2 rounded-md hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ➕ Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[420px] p-5 relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-semibold mb-3">Create New Group</h3>
            <input
              type="text"
              placeholder="Group Name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="border w-full rounded-md px-3 py-2 text-sm mb-3"
            />
            <label className="text-sm font-medium text-gray-700">Select Members:</label>
            <div className="h-40 overflow-y-auto border rounded-md p-2 mt-1">
              {members.map((m) => (
                <label key={m.userid} className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(m.userid)}
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelectedMembers([...selectedMembers, m.userid]);
                      else
                        setSelectedMembers(selectedMembers.filter((id) => id !== m.userid));
                    }}
                  />
                  {m.profileName}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="bg-gray-300 text-gray-800 text-sm px-3 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                className="bg-blue-600 text-white text-sm px-3 py-2 rounded-md hover:bg-blue-700"
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
