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

  // group modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");

  // Schedules (unchanged)
  const [schedule, setSchedule] = useState({
    Mon: { start: "09:00", end: "17:00", enabled: true },
    Tue: { start: "09:00", end: "17:00", enabled: true },
    Wed: { start: "09:00", end: "17:00", enabled: true },
    Thu: { start: "09:00", end: "17:00", enabled: true },
    Fri: { start: "09:00", end: "17:00", enabled: true },
    Sat: { start: "", end: "", enabled: false },
    Sun: { start: "", end: "", enabled: false },
  });

  const profileName = localStorage.getItem("profileName") || currentUser;

  /* =========================================================
   Load Members + Groups (with Bob's Deep Debugging)
========================================================= */
async function loadData() {
  console.log("🔵 [Sidebar] Starting loadData()...");

  try {
    /* -----------------------------------------------------
       🔷 1. LOAD MEMBERS
    ----------------------------------------------------- */
    console.log("🔍 [Members] Fetching /members...");
    const res = await getMembers();

    console.log("📦 [Members] Raw getMembers() response:", res);

    const parsed =
      typeof res === "string"
        ? JSON.parse(res)
        : typeof res?.body === "string"
        ? JSON.parse(res.body)
        : res;

    console.log("🧩 [Members] Parsed response:", parsed);

    // Which keys exist?
    console.log("🔑 [Members] Keys in response:", Object.keys(parsed || {}));

    let membersData = [];

    if (Array.isArray(parsed.items)) {
      membersData = parsed.items;
      console.log("✅ [Members] Using parsed.items (array), length =", parsed.items.length);
    } else if (Array.isArray(parsed.members)) {
      membersData = parsed.members;
      console.log("⚠️ [Members] Using parsed.members (legacy key), length =", parsed.members.length);
    } else if (Array.isArray(parsed.Items)) {
      membersData = parsed.Items;
      console.log("⚠️ [Members] Using parsed.Items (Dynamo style), length =", parsed.Items.length);
    } else {
      console.warn("❌ [Members] No valid array found in response!");
    }

    setMembers(membersData);

    if (membersData.length === 0) {
      console.warn("⚠️ [Members] Loaded EMPTY list of members!");
    }

    /* -----------------------------------------------------
       🔷 2. LOAD GROUPS
    ----------------------------------------------------- */
    console.log("🔍 [Groups] Fetching /groups...");
    const groupRes = await fetch(`${API_BASE}/groups`);
    const groupRaw = await groupRes.text();

    console.log("📦 [Groups] Raw fetch text:", groupRaw);

    let groupParsed;
    try {
      groupParsed = JSON.parse(groupRaw);
    } catch {
      console.error("❌ [Groups] Failed to parse JSON:", groupRaw);
      groupParsed = {};
    }

    console.log("🧩 [Groups] Parsed JSON:", groupParsed);
    console.log("🔑 [Groups] Keys in response:", Object.keys(groupParsed || {}));

    let groupsData = [];

    if (Array.isArray(groupParsed.items)) {
      groupsData = groupParsed.items;
      console.log("✅ [Groups] Using groupParsed.items, length =", groupParsed.items.length);
    } else if (Array.isArray(groupParsed.groups)) {
      groupsData = groupParsed.groups;
      console.log("⚠️ [Groups] Using groupParsed.groups (legacy key), length =", groupParsed.groups.length);
    } else {
      console.warn("❌ [Groups] No valid array found in response!");
    }

    // Normalize groupname field
    groupsData = groupsData.map((g) => ({
      ...g,
      groupname: g.groupName || g.groupname || g.name || "Unnamed Group",
    }));

    setGroups(groupsData);

    if (groupsData.length === 0) {
      console.warn("⚠️ [Groups] Loaded EMPTY list of groups!");
    }

  } catch (err) {
    console.error("❌ [Sidebar] loadData() FAILED:", err);
  }

  console.log("🟢 [Sidebar] Finished loadData()");
}



  /* =========================================================
     CREATE GROUP
  ========================================================= */
  async function handleCreateGroup() {
    if (!newGroupName.trim()) {
      alert("Please enter a group name.");
      return;
    }

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

      const result = await res.json();
      const parsed = typeof result?.body === "string" ? JSON.parse(result.body) : result;

      if (parsed?.success) {
        alert("Group created!");
        setShowCreateModal(false);
        setNewGroupName("");
        setSelectedMembers([]);
        loadData();
      } else {
        alert("Failed to create group.");
      }
    } catch (err) {
      console.error("Create group failed:", err);
      alert("Error creating group.");
    }
  }

  /* =========================================================
     GROUP MANAGEMENT FUNCTIONS
  ========================================================= */

  // ➕ Add member
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
        setSelectedGroup({
          ...selectedGroup,
          members: data.members,
        });
        loadData();
      }
    } catch (err) {
      console.error("Add member failed:", err);
    }
  }

  // ➖ Remove member
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
        setSelectedGroup({
          ...selectedGroup,
          members: data.members,
        });
        loadData();
      }
    } catch (err) {
      console.error("Remove member failed:", err);
    }
  }

  // ✏️ Rename Group
  async function handleRenameGroup() {
    if (!selectedGroup || !selectedGroup.newName?.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/groups/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupid: selectedGroup.groupid,
          newName: selectedGroup.newName,
        }),
      });

      const raw = await res.json();
      const data = typeof raw.body === "string" ? JSON.parse(raw.body) : raw;

      if (data.success) {
        alert("Group renamed!");
        setShowManageModal(false);
        loadData();
      }
    } catch (err) {
      console.error("Rename failed:", err);
    }
  }

  // 🗑 Delete Group
  async function handleDeleteGroup() {
    if (!selectedGroup) return;

    if (!window.confirm("Are you sure you want to delete this group?")) return;

    try {
      const res = await fetch(`${API_BASE}/groups/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupid: selectedGroup.groupid }),
      });

      const raw = await res.json();
      const data = typeof raw.body === "string" ? JSON.parse(raw.body) : raw;

      if (data.success) {
        alert("Group deleted!");
        setShowManageModal(false);
        loadData();
      }
    } catch (err) {
      console.error("Delete group failed:", err);
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

      {/* HEADER */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <img src="/logo.JPG" alt="CHATr Logo" className="w-40 rounded-md border" />
        <button onClick={logout} className="text-slate-500 hover:text-red-600">
          <LogOut size={18} />
        </button>
      </div>

      {/* SEARCH */}
      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="🔍 Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-400 outline-none"
        />
      </div>

      {/* GROUPS */}
      <div className="p-3 border-b overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-slate-600 text-sm flex items-center gap-2">
            <Users size={14} /> Groups
          </h2>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600"
          >
            <Plus size={12} />
          </button>
        </div>

        {groups.length ? (
          groups.map((g) => (
            <div key={g.groupid} className="flex justify-between items-center py-2 px-3">
              <button
                onClick={() => {
                  setActiveChat(`group-${g.groupid}`);
                  onSelectUser({ type: "group", id: g.groupid, name: g.groupname });
                }}
                className="flex-1 text-left text-sm flex items-center gap-2"
              >
                {g.groupname}
              </button>

              <button
                onClick={() => {
                  setSelectedGroup({ ...g, newName: g.groupname });
                  setShowManageModal(true);
                }}
                className="text-gray-500 hover:text-blue-600"
              >
                <Edit3 size={14} />
              </button>
            </div>
          ))
        ) : (
          <p className="text-slate-400 text-xs italic">No groups yet</p>
        )}
      </div>

      {/* MEMBERS */}
      <div className="p-3 border-b flex-1 overflow-y-auto">
        <h2 className="font-semibold text-slate-600 text-sm mb-2">👤 Members</h2>

        {members
          .filter((m) => (m.profileName || "").toLowerCase().includes(search.toLowerCase()))
          .map((m) => (
            <button
              key={m.userid}
              onClick={() => {
                setActiveChat(`user-${m.userid}`);
                onSelectUser({ type: "user", id: m.userid, name: m.profileName });
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
                      if (e.target.checked) {
                        setSelectedMembers([...selectedMembers, m.userid]);
                      } else {
                        setSelectedMembers(selectedMembers.filter((x) => x !== m.userid));
                      }
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

            <h3 className="text-lg font-semibold mb-3">Manage Group</h3>

            {/* Rename */}
            <label className="text-sm font-medium">Rename Group</label>
            <div className="flex gap-2 mt-1 mb-4">
              <input
                type="text"
                className="flex-1 border rounded px-2 py-2 text-sm"
                value={selectedGroup.newName}
                onChange={(e) =>
                  setSelectedGroup({ ...selectedGroup, newName: e.target.value })
                }
              />
              <button
                onClick={handleRenameGroup}
                className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 flex items-center gap-1"
              >
                <Save size={14} /> Save
              </button>
            </div>

            {/* Members */}
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-2 text-gray-700">👥 Members</h4>

              {selectedGroup.members?.length ? (
                selectedGroup.members.map((m) => (
                  <div key={m} className="flex justify-between items-center py-1 border-b">
                    <span>{m}</span>
                    <button
                      className="text-red-500 hover:text-red-700 text-xs"
                      onClick={() => handleRemoveMember(m)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm italic">No members</p>
              )}
            </div>

            {/* Add member */}
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-2 text-gray-700">➕ Add Member</h4>

              <select
                className="w-full border rounded px-2 py-2 text-sm"
                onChange={(e) => handleAddMember(e.target.value)}
              >
                <option value="">Select a member...</option>
                {members
                  .filter((m) => !selectedGroup.members.includes(m.userid))
                  .map((m) => (
                    <option key={m.userid} value={m.userid}>
                      {m.profileName}
                    </option>
                  ))}
              </select>
            </div>

            {/* Delete Group */}
            <button
              onClick={handleDeleteGroup}
              className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 flex justify-center items-center gap-1"
            >
              <Trash2 size={16} /> Delete Group
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
