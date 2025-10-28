import React, { useEffect, useState } from "react";
import { getMembers, getJSON, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, Settings, Trash2, X, Plus } from "lucide-react";

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
        const parsed = typeof res?.body === "string" ? JSON.parse(res.body) : res;
        const membersData = Array.isArray(parsed.members)
          ? parsed.members
          : parsed.data || [];
        const filtered = membersData.filter(
          (m) =>
            m.userid !== currentUser &&
            m.profileName?.toLowerCase() !== (profileName || "").toLowerCase()
        );
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
        setGroups(Array.isArray(data.groups) ? data.groups : []);
      } else {
        setGroups([]);
      }
    } catch (err) {
      console.error("❌ Failed to fetch groups:", err);
    }
  }

  useEffect(() => {
    loadGroups();
    const interval = setInterval(loadGroups, 10000);
    return () => clearInterval(interval);
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
      const res = await fetch(`${API_BASE}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName: groupName.trim(),
          creator: currentUser,
          members: membersToAdd,
        }),
      });
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;
      if (data.success) {
        alert(`✅ Group "${groupName}" created!`);
        setShowModal(false);
        setGroupName("");
        setSelectedMembers([]);
        await loadGroups();
      } else {
        alert(`❌ ${data.message || "Failed to create group."}`);
      }
    } catch (err) {
      console.error("❌ Error creating group:", err);
      alert("Server error creating group");
    }
  };

  /* =========================================================
     Manage Group (Add / Remove / Delete)
  ========================================================= */
  async function handleAddMember(username) {
    try {
      const res = await fetch(`${API_BASE}/groups/add`, {
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
      if (parsed.success) {
        alert(`✅ ${username} added to group.`);
        await loadGroups();
        // refresh modal state
        const updated = parsed.group || selectedGroup;
        setSelectedGroup(updated);
      } else {
        alert(`❌ ${parsed.message || "Failed to add member"}`);
      }
    } catch (err) {
      console.error("❌ Error adding member:", err);
    }
  }

  async function handleRemoveMember(username) {
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
      if (parsed.success) {
        alert(`✅ ${username} removed from group.`);
        await loadGroups();
        const updated = parsed.group || {
          ...selectedGroup,
          members: parsed.members,
        };
        setSelectedGroup(updated);
      } else {
        alert(`❌ ${parsed.message || "Failed to remove member"}`);
      }
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
      const res = await fetch(`${API_BASE}/groups/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupid: selectedGroup.groupid,
          requester: currentUser,
        }),
      });
      const data = await res.json();
      const parsed = typeof data?.body === "string" ? JSON.parse(data.body) : data;
      if (parsed.success) {
        alert("🗑️ Group deleted successfully.");
        setManageModal(false);
        await loadGroups();
      } else alert(`❌ ${parsed.message || "Failed to delete group"}`);
    } catch (err) {
      console.error("❌ Error deleting group:", err);
    }
  }

  /* =========================================================
     Render
  ========================================================= */
  const filteredGroups = groups.filter((g) =>
    g.groupName?.toLowerCase().includes(search.toLowerCase())
  );

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

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto p-3">
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

        {filteredGroups.length ? (
          <div className="space-y-2">
            {filteredGroups.map((g) => {
              const key = `GROUP#${g.groupid}`;
              const unread = unreadMap[key] || 0;
              const isCreator = g.creator === currentUser;

              return (
                <div key={g.groupid} className="flex items-center">
                  <button
                    onClick={() => {
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

      {/* =======================
          Manage Group Modal
      ======================= */}
      {manageModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-[420px] rounded-lg shadow-xl p-5 relative">
            <button
              className="absolute right-3 top-3 text-slate-500 hover:text-red-500"
              onClick={() => setManageModal(false)}
            >
              <X size={18} />
            </button>

            <h2 className="text-lg font-semibold mb-3">
              Manage Group: {selectedGroup.groupName}
            </h2>

            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">
                Members ({selectedGroup.members?.length || 0})
              </h3>
              <div className="space-y-2 max-h-[150px] overflow-y-auto border p-2 rounded">
                {selectedGroup.members?.map((member) => (
                  <div
                    key={member}
                    className="flex items-center justify-between bg-slate-50 px-3 py-1 rounded-md"
                  >
                    <span className="text-sm text-slate-700">{member}</span>
                    {member !== currentUser && (
                      <button
                        onClick={() => handleRemoveMember(member)}
                        className="text-xs bg-red-500 text-white px-2 py-0.5 rounded hover:bg-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-2">
                Add Members
              </h3>
              <div className="space-y-2 max-h-[150px] overflow-y-auto border p-2 rounded">
                {members
                  .filter((m) => !selectedGroup.members?.includes(m.userid))
                  .map((m) => (
                    <div
                      key={m.userid}
                      className="flex items-center justify-between bg-white px-3 py-1 rounded-md"
                    >
                      <span className="text-sm">{m.profileName}</span>
                      <button
                        onClick={() => handleAddMember(m.userid)}
                        className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            <button
              onClick={handleDeleteGroup}
              className="w-full bg-red-600 hover:bg-red-700 text-white rounded-md py-2 text-sm mt-2"
            >
              🗑️ Delete Group
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
