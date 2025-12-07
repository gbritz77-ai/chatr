// src/components/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { getJSON, postJSON } from "../lib/api";
import { Plus } from "lucide-react";

export default function Sidebar({ currentUser, activeUser, setActiveUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
<<<<<<< HEAD
  const [activeChat, setActiveChat] = useState(null);
  const [search, setSearch] = useState("");
  const [unread, setUnread] = useState({});

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [manageGroupName, setManageGroupName] = useState("");

  const profileName = localStorage.getItem("profileName") || currentUser;

  /* =========================================================
     UNREAD COUNTS — WITH RESPONSE FIX
  ========================================================= */
  async function loadUnread() {
    const url = `${API_BASE}/messages/unread-counts?username=${currentUser}`;
    //console.log("🟦 UNREAD DEBUG — Fetching unread counts:", url);

    try {
      const res = await fetch(url);
      const json = await res.json();

      const data =
        typeof json?.body === "string" ? JSON.parse(json.body) : json;

      //console.log("🟦 UNREAD DEBUG — Parsed unread:", data);

      if (!data?.success) {
        console.warn("🟥 unread failed:", data);
        return;
      }

      const rawUnread = data.unread || {};

      const normalized = {};

      for (const sender of Object.keys(rawUnread)) {
        const key = `user-${sender.toLowerCase()}`;
        normalized[key] = rawUnread[sender];
      }

      //console.log("🟦 FINAL unread:", normalized);
      setUnread(normalized);
    } catch (err) {
      console.error("🟥 unread fetch failed:", err);
    }
  }

  /* =========================================================
     LOAD MEMBERS + GROUPS
  ========================================================= */
  async function loadData() {
    try {
      // Members
      const res = await getMembers();
      const parsed =
        typeof res === "string"
          ? JSON.parse(res)
          : typeof res?.body === "string"
          ? JSON.parse(res.body)
          : res;

      setMembers(parsed?.members || parsed?.Items || []);

      // Groups
      const groupRes = await fetch(
  `${API_BASE}/groups?username=${encodeURIComponent(currentUser)}`
);

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
=======

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ----------------------------------------------------
     LOAD MEMBERS
  ---------------------------------------------------- */
  async function loadMembers() {
    try {
      const res = await getJSON("/members");
      console.log("📌 Loaded Members:", res);
      setMembers(res.members || []);
>>>>>>> b086b80ce3911f64290ca3110fa135ce93e4eb3f
    } catch (err) {
      console.error("❌ Failed to load members:", err);
      setMembers([]);
    }
  }

<<<<<<< HEAD
  /* =========================================================
     INITIAL LOAD
  ========================================================= */
  useEffect(() => {
    loadData();
    loadUnread();
  }, []);

  async function handleCreateGroup() {
  //console.log("🟢 CREATE GROUP CLICKED");

  if (!newGroupName.trim()) {
    console.warn("❌ No group name");
    alert("Please enter a group name.");
    return;
  }

  const payload = {
    groupName: newGroupName.trim(),
    creator: currentUser,
    members: selectedMembers,
  };

  ////console.log("📤 CREATE GROUP PAYLOAD:", payload);

  try {
    const res = await fetch(`${API_BASE}/groups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    ////console.log("📡 CREATE GROUP STATUS:", res.status);

    const raw = await res.json();
    ////console.log("📥 CREATE GROUP RAW RESPONSE:", raw);

    const parsed =
      typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;

    ////console.log("✅ CREATE GROUP PARSED:", parsed);

    if (!parsed.success) {
      alert(parsed.message || "Failed to create group");
      return;
    }

    // ✅ RESET UI
    setShowCreateModal(false);
    setNewGroupName("");
    setSelectedMembers([]);

    await loadData();

    alert("✅ Group created");
  } catch (err) {
    console.error("🔥 CREATE GROUP FAILED:", err);
    alert("Create group failed — see console");
=======
  /* ----------------------------------------------------
     LOAD GROUPS
  ---------------------------------------------------- */
  async function loadGroups() {
    try {
      const username = currentUser;
      const res = await getJSON(`/groups?username=${encodeURIComponent(username)}`);
      console.log("📌 Loaded Groups:", res);
      setGroups(res.groups || []);
    } catch (err) {
      console.error("❌ Failed to load groups:", err);
      setGroups([]);
    }
  }

  /* ----------------------------------------------------
     INITIAL LOAD
  ---------------------------------------------------- */
  useEffect(() => {
    loadMembers();
    loadGroups();
  }, []);

  /* ----------------------------------------------------
     CREATE GROUP HANDLER
  ---------------------------------------------------- */
  async function handleCreateGroup() {
    if (!groupName.trim() || selectedMembers.length === 0) {
      alert("Please provide a group name and select at least one member.");
      return;
    }

    setLoading(true);
    try {
      const res = await postJSON("/groups", {
        groupName,
        creator: currentUser,
        members: selectedMembers,
      });

      console.log("📌 Group creation response:", res);

      if (res?.success) {
        alert("🎉 Group created!");
        setShowCreateModal(false);
        setGroupName("");
        setSelectedMembers([]);
        loadGroups();
      } else {
        alert("⚠️ Failed: " + (res.message || "Unknown error"));
      }
    } catch (err) {
      console.error("❌ Group creation failed:", err);
    }
    setLoading(false);
>>>>>>> b086b80ce3911f64290ca3110fa135ce93e4eb3f
  }
}



<<<<<<< HEAD
  /* =========================================================
     GROUP MANAGEMENT
  ========================================================= */

  async function handleAddMember(userid) {
  try {
    const res = await fetch(`${API_BASE}/groups/add`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupid: selectedGroup.groupid,
        username: userid,
        actor: currentUser, // ✅ REQUIRED
      }),
    });

    const raw = await res.json();
    const data = typeof raw.body === "string" ? JSON.parse(raw.body) : raw;

    if (!data.success) {
      alert(data.message || "Unable to add member");
      return;
    }

    const updated = data.members;

    setSelectedGroup((prev) => ({ ...prev, members: updated }));
    setGroups((prev) =>
      prev.map((g) =>
        g.groupid === selectedGroup.groupid ? { ...g, members: updated } : g
      )
    );
  } catch (err) {
    console.error("Add member failed:", err);
  }
}


  async function handleRemoveMember(userid) {
  try {
    const res = await fetch(`${API_BASE}/groups/remove`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupid: selectedGroup.groupid,
        username: userid,
        actor: currentUser, // ✅ REQUIRED
      }),
    });

    const raw = await res.json();
    const data = typeof raw.body === "string" ? JSON.parse(raw.body) : raw;

    if (!data.success) {
      alert(data.message || "Unable to remove member");
      return;
    }

    const updated = data.members;

    setSelectedGroup((prev) => ({ ...prev, members: updated }));
    setGroups((prev) =>
      prev.map((g) =>
        g.groupid === selectedGroup.groupid ? { ...g, members: updated } : g
      )
    );
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

      {showCreateModal && (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
    <div className="bg-white w-[420px] rounded-lg shadow-lg p-5">
      <h3 className="text-lg font-semibold mb-4">
        Create Group
      </h3>

      {/* GROUP NAME */}
      <input
        type="text"
        placeholder="Group name"
        value={newGroupName}
        onChange={(e) => setNewGroupName(e.target.value)}
        className="w-full border rounded px-3 py-2 mb-4"
      />

      {/* MEMBER SELECTION */}
      <div className="mb-4 max-h-48 overflow-y-auto border rounded p-2">
        <p className="text-xs text-slate-500 mb-2">
          Add members
        </p>

        {members.map((m) => (
          <label
            key={m.userid}
            className="flex items-center gap-2 text-sm py-1 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedMembers.includes(m.userid)}
              onChange={(e) => {
                setSelectedMembers((prev) =>
                  e.target.checked
                    ? [...prev, m.userid]
                    : prev.filter((id) => id !== m.userid)
                );
              }}
            />
            {m.profileName}
          </label>
        ))}
      </div>

      {/* ACTIONS */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            ////console.log("❌ Create group cancelled");
            setShowCreateModal(false);
            setNewGroupName("");
            setSelectedMembers([]);
          }}
          className="px-4 py-2 border rounded"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleCreateGroup}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Create
        </button>
      </div>
    </div>
  </div>
)}


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

  {groups.length === 0 && (
    <div className="text-xs text-slate-400 px-3 py-2">
      No groups yet
    </div>
  )}

  {groups.map((g) => {
    const chatKey = `group-${g.groupid}`;
    const isActive = activeChat === chatKey;

    return (
      <div
        key={g.groupid}
        className={`flex items-center justify-between px-3 py-2 rounded
          ${isActive ? "bg-blue-50" : "hover:bg-gray-50"}`}
      >
        {/* GROUP CLICK */}
        <div
          onClick={() => {
            setActiveChat(chatKey);
            onSelectUser({
              type: "group",
              id: g.groupid,
              name: g.groupname,
            });
          }}
          className="flex-1 text-sm cursor-pointer truncate"
        >
          {g.groupname}
        </div>

        {/* EDIT */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedGroup(g);
            setManageGroupName(g.groupname);
            setShowManageModal(true);
          }}
          className="ml-2 text-gray-500 hover:text-blue-600"
        >
          <Edit3 size={14} />
        </button>
      </div>
    );
  })}
</div>

{/*=============MANAGE GROUPS==============================*/}
{showManageModal && selectedGroup && (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
    <div className="bg-white w-[420px] rounded-lg p-5">
      <h3 className="font-semibold mb-4">Manage Group</h3>

      {/* Rename */}
      <input
        value={manageGroupName}
        onChange={(e) => setManageGroupName(e.target.value)}
        className="w-full border px-3 py-2 mb-3 rounded"
      />

      <button
        onClick={handleRenameGroup}
        className="w-full bg-blue-600 text-white py-2 rounded mb-4"
      >
        Rename Group
      </button>

      {/* Members */}
      <div className="border rounded p-2 max-h-48 overflow-y-auto">
        {members.map((m) => {
          const inGroup = selectedGroup.members.includes(m.userid);

          return (
            <div
              key={m.userid}
              className="flex justify-between items-center py-1"
            >
              <span>{m.profileName}</span>

              {inGroup ? (
                <button
                  disabled={m.userid === selectedGroup.creator}
                  onClick={() => handleRemoveMember(m.userid)}
                  className="text-red-600 text-xs"
                >
                  Remove
                </button>
              ) : (
                <button
                  onClick={() => handleAddMember(m.userid)}
                  className="text-blue-600 text-xs"
                >
                  Add
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete */}
      <button
        onClick={() => {
          if (confirm("Delete this group?")) handleDeleteGroup();
        }}
        className="mt-4 w-full bg-red-600 text-white py-2 rounded"
      >
        Delete Group
      </button>

      <button
        onClick={() => setShowManageModal(false)}
        className="mt-2 w-full border py-2 rounded"
      >
        Close
      </button>
    </div>
  </div>
)}



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

              {unread[`user-${m.userid}`] > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  {unread[`user-${m.userid}`]}
                </span>
              )}
            </button>
          ))}
      </div>

      {/* =========================================================
         GROUP MODALS OMITTED FOR BREVITY
         (already working in your version)
      ========================================================= */}
    </aside>
=======
  /* ----------------------------------------------------
     SELECT USER OR GROUP
  ---------------------------------------------------- */
  function openChat(user) {
    setActiveUser(user);
  }

  /* ----------------------------------------------------
     RENDER
  ---------------------------------------------------- */
  return (
    <div className="sidebar">
      {/* ============ SEARCH BAR (optional) ============ */}
      <div className="search-box">
        <input type="text" placeholder="Search..." />
      </div>

      {/* ============ GROUPS SECTION ============ */}
      <div className="section">
        <div className="section-header">
          <span>Groups</span>
          <button
            className="icon-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} />
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="empty">No groups yet</p>
        ) : (
          <ul className="item-list">
            {groups.map((g) => (
              <li
                key={g.groupid}
                className={
                  activeUser?.type === "group" &&
                  activeUser?.id === g.groupid
                    ? "item active"
                    : "item"
                }
                onClick={() =>
                  openChat({ type: "group", id: g.groupid, name: g.groupName })
                }
              >
                <span className="avatar-circle">G</span>
                <div className="info">
                  <div className="title">{g.groupName}</div>
                  <div className="subtitle">{g.members.length} members</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ============ MEMBERS SECTION ============ */}
      <div className="section">
        <div className="section-header">Members</div>

        {members.length === 0 ? (
          <p className="empty">No members</p>
        ) : (
          <ul className="item-list">
            {members
              .filter((m) => m.userid !== currentUser)
              .map((m) => (
                <li
                  key={m.userid}
                  className={
                    activeUser?.type === "user" &&
                    activeUser?.username === m.userid
                      ? "item active"
                      : "item"
                  }
                  onClick={() =>
                    openChat({ type: "user", username: m.userid, name: m.profileName })
                  }
                >
                  <span className="avatar-circle">
                    {m.profileName?.[0]?.toUpperCase() || "U"}
                  </span>
                  <div className="info">
                    <div className="title">{m.profileName}</div>
                    <div className="subtitle">{m.userid}</div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* ============ CREATE GROUP MODAL ============ */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create Group</h3>

            <label>Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />

            <label>Select Members</label>
            <div className="member-select">
              {members
                .filter((m) => m.userid !== currentUser)
                .map((m) => (
                  <div key={m.userid} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(m.userid)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMembers((prev) => [...prev, m.userid]);
                        } else {
                          setSelectedMembers((prev) =>
                            prev.filter((u) => u !== m.userid)
                          );
                        }
                      }}
                    />
                    <span>{m.profileName}</span>
                  </div>
                ))}
            </div>

            <div className="modal-actions">
              <button
                className="btn"
                onClick={handleCreateGroup}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Group"}
              </button>
              <button
                className="btn cancel"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
>>>>>>> b086b80ce3911f64290ca3110fa135ce93e4eb3f
  );
}
