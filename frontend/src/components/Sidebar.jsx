import React, { useEffect, useState } from "react";
import { getMembers, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, X, Plus, Edit3, Trash2, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Sidebar({ onSelectUser, currentUser }) {
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [search, setSearch] = useState("");
  const [unread, setUnread] = useState({});

  // group modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");

  // rename state
  const [manageGroupName, setManageGroupName] = useState("");

  const profileName = localStorage.getItem("profileName") || currentUser;

  /* =========================================================
     UNREAD COUNTS
  ========================================================= */
  async function loadUnread() {
    try {
      const res = await fetch(
        `${API_BASE}/messages/unread-counts?username=${currentUser}`
      );
      const raw = await res.json();
      const data = typeof raw.body === "string" ? JSON.parse(raw.body) : raw;

      if (data.success) {
        setUnread(data.counts || {});
      }
    } catch (err) {
      console.error("Unread count fetch failed:", err);
    }
  }

  /* =========================================================
     LOAD MEMBERS + GROUPS
  ========================================================= */
  async function loadData() {
    try {
      // members
      const res = await getMembers();
      const parsed =
        typeof res === "string"
          ? JSON.parse(res)
          : typeof res?.body === "string"
          ? JSON.parse(res.body)
          : res;

      setMembers(parsed?.members || parsed?.Items || []);

      // groups
      const groupRes = await fetch(`${API_BASE}/groups`);
      const groupRaw = await groupRes.json();
      const groupParsed =
        typeof groupRaw?.body === "string"
          ? JSON.parse(groupRaw.body)
          : groupRaw;

      setGroups(
        groupParsed?.groups?.map((g) => ({
          ...g,
          groupname: g.groupname || g.groupName,
        })) || []
      );
    } catch (err) {
      console.error("Sidebar load error:", err);
    }
  }

  useEffect(() => {
    loadData();
    loadUnread(); // 🔥 unread counts now load
  }, []);

  /* =========================================================
     CREATE GROUP
  ========================================================= */
  async function handleCreateGroup() {
    if (!newGroupName.trim()) return alert("Please enter a group name.");

    try {
      const res = await fetch(`${API_BASE}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName: newGroupName,
          creator: currentUser,
          members: selectedMembers,
        }),
      });

      const raw = await res.json();
      const parsed = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;

      if (parsed.success) {
        setShowCreateModal(false);
        setNewGroupName("");
        setSelectedMembers([]);
        loadData();
      } else alert(parsed.message || "Failed to create group.");
    } catch (err) {
      console.error("Create group failed:", err);
    }
  }

  /* =========================================================
     GROUP MANAGEMENT
  ========================================================= */

  async function handleAddMember(userid) {
    if (!userid || !selectedGroup) return;

    try {
      const res = await fetch(`${API_BASE}/groups/add`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupid: selectedGroup.groupid,
          username: userid,
        }),
      });

      const raw = await res.json();
      const data = typeof raw.body === "string" ? JSON.parse(raw.body) : raw;

      if (data.success) {
        const updated = data.members;
        setSelectedGroup((prev) => ({ ...prev, members: updated }));
        setGroups((prev) =>
          prev.map((g) =>
            g.groupid === selectedGroup.groupid ? { ...g, members: updated } : g
          )
        );
      }
    } catch (err) {
      console.error("Add member failed:", err);
    }
  }

  async function handleRemoveMember(userid) {
    if (!userid || !selectedGroup) return;

    try {
      const res = await fetch(`${API_BASE}/groups/remove`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupid: selectedGroup.groupid,
          username: userid,
        }),
      });

      const raw = await res.json();
      const data = typeof raw.body === "string" ? JSON.parse(raw.body) : raw;

      if (data.success) {
        const updated = data.members;
        setSelectedGroup((prev) => ({ ...prev, members: updated }));
        setGroups((prev) =>
          prev.map((g) =>
            g.groupid === selectedGroup.groupid ? { ...g, members: updated } : g
          )
        );
      }
    } catch (err) {
      console.error("Remove member failed:", err);
    }
  }

  async function handleRenameGroup() {
    if (!manageGroupName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/groups/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupid: selectedGroup.groupid,
          newName: manageGroupName.trim(),
        }),
      });

      const raw = await res.json();
      const data = typeof raw.body === "string" ? JSON.parse(raw.body) : raw;

      if (data.success) {
        setSelectedGroup((prev) => ({
          ...prev,
          groupname: manageGroupName.trim(),
        }));

        setGroups((prev) =>
          prev.map((g) =>
            g.groupid === selectedGroup.groupid
              ? { ...g, groupname: manageGroupName.trim() }
              : g
          )
        );

        alert("Group renamed.");
      }
    } catch (err) {
      console.error("Rename failed:", err);
    }
  }

  async function handleDeleteGroup() {
    if (!selectedGroup) return;

    if (
      !window.confirm(
        `Delete group "${selectedGroup.groupname}"? This cannot be undone.`
      )
    )
      return;

    try {
      const res = await fetch(`${API_BASE}/groups/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupid: selectedGroup.groupid }),
      });

      const raw = await res.json();
      const data = typeof raw.body === "string" ? JSON.parse(raw.body) : raw;

      if (data.success) {
        setGroups((prev) =>
          prev.filter((g) => g.groupid !== selectedGroup.groupid)
        );
        setShowManageModal(false);
        setSelectedGroup(null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  /* =========================================================
     LOGOUT
  ========================================================= */
  function logout() {
    localStorage.clear();
    navigate("/login", { replace: true });
  }

  /* =========================================================
     UI
  ========================================================= */
  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[320px] bg-white border-r border-slate-200 flex flex-col z-20">
      {/* Header */}
      <div className="px-5 py-4 border-b flex justify-between items-center">
        <img src="/logo.JPG" className="w-40 rounded-md border" />
        <button onClick={logout} className="text-slate-500 hover:text-red-600">
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
          className="w-full text-sm border rounded-lg px-3 py-2"
        />
      </div>

      {/* ========================= GROUPS ========================= */}
      <div className="p-3 border-b overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-slate-600 text-sm flex items-center gap-2">
            <Users size={14} /> Groups
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 text-white text-xs px-2 py-1 rounded"
          >
            <Plus size={12} />
          </button>
        </div>

        {groups.map((g) => (
          <div
            key={g.groupid}
            className="flex justify-between items-center py-2 px-3"
          >
            <button
              onClick={() => {
                setActiveChat(`group-${g.groupid}`);
                onSelectUser({
                  type: "group",
                  id: g.groupid,
                  name: g.groupname,
                });
              }}
              className="flex-1 flex justify-between items-center text-left text-sm"
            >
              <span>{g.groupname}</span>

              {/* 🔥 Unread badge */}
              {unread[`group-${g.groupid}`] > 0 && (
                <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                  {unread[`group-${g.groupid}`]}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setSelectedGroup(g);
                setManageGroupName(g.groupname);
                setShowManageModal(true);
              }}
              className="text-gray-500 hover:text-blue-600"
            >
              <Edit3 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* ========================= MEMBERS ========================= */}
      <div className="p-3 border-b flex-1 overflow-y-auto">
        <h2 className="font-semibold text-slate-600 text-sm mb-2">👤 Members</h2>

        {members
          .filter((m) =>
            (m.profileName || "").toLowerCase().includes(search.toLowerCase())
          )
          .map((m) => (
            <button
              key={m.userid}
              onClick={() => {
                setActiveChat(`user-${m.userid}`);
                onSelectUser({
                  type: "user",
                  id: m.userid,
                  name: m.profileName,
                });
              }}
              className="flex justify-between items-center w-full px-3 py-2 text-sm hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Avatar name={m.profileName} size={2.2} />
                <span>{m.profileName}</span>
              </div>

              {/* 🔥 Unread badge for direct chats */}
              {unread[`user-${m.userid}`] > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  {unread[`user-${m.userid}`]}
                </span>
              )}
            </button>
          ))}
      </div>

      {/* ========================= MODALS ========================= */}

      {/* CREATE GROUP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[360px] rounded-lg shadow-xl p-5 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500"
              onClick={() => setShowCreateModal(false)}
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-semibold mb-4">Create New Group</h3>

            <input
              type="text"
              placeholder="Group Name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full border px-3 py-2 rounded-md mb-3"
            />

            <h4 className="text-sm font-semibold mb-2">Select Members</h4>

            <div className="max-h-40 overflow-y-auto border rounded-md p-2">
              {members.map((m) => (
                <label key={m.userid} className="flex items-center gap-2 text-sm mb-1">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(m.userid)}
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelectedMembers([...selectedMembers, m.userid]);
                      else
                        setSelectedMembers(
                          selectedMembers.filter((x) => x !== m.userid)
                        );
                    }}
                  />
                  {m.profileName}
                </label>
              ))}
            </div>

            <button
              onClick={handleCreateGroup}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
            >
              Create Group
            </button>
          </div>
        </div>
      )}

      {/* MANAGE GROUP MODAL */}
      {showManageModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[460px] p-5 relative">
            <button
              onClick={() => setShowManageModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-semibold mb-3">
              Manage Group — {selectedGroup.groupname}
            </h3>

            {/* Rename */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Rename Group
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manageGroupName}
                  onChange={(e) => setManageGroupName(e.target.value)}
                  className="flex-1 border px-3 py-2 rounded-md text-sm"
                />
                <button
                  onClick={handleRenameGroup}
                  className="flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-2 rounded hover:bg-blue-700"
                >
                  <Save size={14} />
                  Save
                </button>
              </div>
            </div>

            {/* Members List */}
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-2 text-gray-700">
                👥 Members
              </h4>

              {selectedGroup.members?.length ? (
                selectedGroup.members.map((m) => (
                  <div
                    key={m}
                    className="flex justify-between items-center py-1 border-b"
                  >
                    <span className="text-sm">{m}</span>

                    <button
                      className="text-red-500 hover:text-red-700 text-xs"
                      onClick={() => handleRemoveMember(m)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm italic">
                  No members in group
                </p>
              )}
            </div>

            {/* Add Member */}
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-2 text-gray-700">
                ➕ Add Member
              </h4>

              <select
                className="w-full border rounded px-2 py-2 text-sm"
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddMember(e.target.value);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">Select a member...</option>

                {members
                  .filter(
                    (m) => !(selectedGroup.members || []).includes(m.userid)
                  )
                  .map((m) => (
                    <option key={m.userid} value={m.userid}>
                      {m.profileName}
                    </option>
                  ))}
              </select>
            </div>

            {/* Footer */}
            <div className="flex justify-between mt-4 gap-2">
              <button
                className="flex items-center gap-1 bg-red-600 text-white text-sm px-3 py-2 rounded-md hover:bg-red-700"
                onClick={handleDeleteGroup}
              >
                <Trash2 size={14} />
                Delete Group
              </button>

              <button
                className="bg-gray-300 text-gray-800 text-sm px-3 py-2 rounded-md hover:bg-gray-400"
                onClick={() => setShowManageModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
