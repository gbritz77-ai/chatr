import React, { useEffect, useState } from "react";
import { getMembers, getJSON } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, MessageSquare, Settings, Trash2 } from "lucide-react";

export default function Sidebar({ onSelectUser, currentUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [manageModal, setManageModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
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
      if (data?.success && Array.isArray(data.groups || data.data))
        setGroups(data.groups || data.data);
      else setGroups([]);
    } catch (err) {
      console.error("❌ Failed to fetch groups:", err);
    }
  }

  useEffect(() => {
    loadGroups();
  }, [currentUser]);

  /* =========================================================
     Unread Counts
  ========================================================= */
  async function loadUnreadCounts() {
    if (!currentUser) return;
    try {
      const res = await getJSON(
        `/messages/unread-counts?username=${encodeURIComponent(currentUser)}`
      );
      if (Array.isArray(res)) {
        const map = {};
        for (const entry of res) {
          map[entry.chatId] = entry.unreadCount;
        }
        setUnreadMap(map);
      }
    } catch (err) {
      console.error("❌ Failed to load unread counts:", err);
    }
  }

  useEffect(() => {
    loadUnreadCounts();
    const timer = setInterval(loadUnreadCounts, 8000);
    return () => clearInterval(timer);
  }, [currentUser]);

  /* =========================================================
     Create Group
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
          groupName: groupName.trim(),
          creator: currentUser,
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
     Manage Group (Add / Remove / Delete)
  ========================================================= */
  async function handleAddMember(username) {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/groups/add`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupid: selectedGroup.groupid,
          username,
          requester: currentUser,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${username} added to group.`);
        await loadGroups();
      } else alert(`❌ ${data.message || "Failed to add member"}`);
    } catch (err) {
      console.error("❌ Error adding member:", err);
    }
  }

  async function handleRemoveMember(username) {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/groups/remove`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupid: selectedGroup.groupid,
          username,
          requester: currentUser,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${username} removed from group.`);
        await loadGroups();
      } else alert(`❌ ${data.message || "Failed to remove member"}`);
    } catch (err) {
      console.error("❌ Error removing member:", err);
    }
  }

  async function handleDeleteGroup() {
    if (
      !confirm(`Are you sure you want to delete "${selectedGroup.groupName}"?`)
    )
      return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/groups/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupid: selectedGroup.groupid,
          requester: currentUser,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("🗑️ Group deleted successfully.");
        setManageModal(false);
        await loadGroups();
      } else alert(`❌ ${data.message || "Failed to delete group"}`);
    } catch (err) {
      console.error("❌ Error deleting group:", err);
    }
  }

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
        {/* Groups */}
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
                const key = `GROUP#${g.groupid}`;
                const unread = unreadMap[key] || 0;
                const isCreator = g.creator === currentUser;

                return (
                  <div key={g.groupid} className="flex items-center">
                    <button
                      onClick={() => {
                        const key = `GROUP#${g.groupid}`;
                        setActiveChat(`group-${g.groupid}`);
                        setUnreadMap((prev) => ({ ...prev, [key]: 0 }));
                        onSelectUser({
                          type: "group",
                          id: g.groupid,
                          name: g.groupName,
                        });
                      }}
                      className={`flex-1 text-left px-3 py-2 rounded-md flex items-center gap-3 transition ${
                        activeChat === `group-${g.groupid}`
                          ? "bg-gray-100 text-gray-900"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <Avatar name={g.groupName} size={2.5} />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm truncate">
                            {g.groupName}
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

                    {isCreator && (
                      <button
                        onClick={() => {
                          setSelectedGroup(g);
                          setManageModal(true);
                        }}
                        className="text-slate-400 hover:text-gray-700 px-2"
                      >
                        <Settings size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm italic">No groups yet</p>
          )}
        </div>

        {/* Members List (unchanged) */}
        {/* ... same as before ... */}
      </div>

      {/* Group Management Modal */}
      {manageModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6">
            <h2 className="text-lg font-semibold mb-3">
              Manage Group: {selectedGroup.groupName}
            </h2>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Current Members:
              </p>
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2">
                {selectedGroup.members?.map((m) => (
                  <div
                    key={m}
                    className="flex justify-between items-center py-1 px-2 hover:bg-gray-50 rounded"
                  >
                    <span className="text-sm">{m}</span>
                    {m !== currentUser && (
                      <button
                        onClick={() => handleRemoveMember(m)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Add Member:
              </p>
              <select
                onChange={(e) => handleAddMember(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2"
              >
                <option value="">Select a member...</option>
                {members
                  .filter((m) => !selectedGroup.members?.includes(m.userid))
                  .map((m) => (
                    <option key={m.userid} value={m.userid}>
                      {m.profileName || m.userid}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => setManageModal(false)}
                className="px-3 py-2 text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
              <button
                onClick={handleDeleteGroup}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1"
              >
                <Trash2 size={16} /> Delete Group
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
