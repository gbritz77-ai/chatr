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

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [manageGroupName, setManageGroupName] = useState("");

  const profileName = localStorage.getItem("profileName") || currentUser;

  /* =========================================================
     UNREAD COUNTS — OBJECT FORMAT (chatId → count)
  ========================================================= */
  async function loadUnread() {
    try {
      const res = await fetch(
        `${API_BASE}/messages/unread-counts?member=${encodeURIComponent(
          currentUser
        )}`
      );

      const raw = await res.json();
      const data =
        typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;

      if (!data?.success) {
        console.warn("Unread fetch failed:", data);
        return;
      }

      // counts: { [chatId]: number }
      setUnread(data.counts || {});
    } catch (err) {
      console.error("Unread fetch error:", err);
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
    } catch (err) {
      console.error("Sidebar load error:", err);
    }
  }

  /* =========================================================
     INITIAL LOAD
  ========================================================= */
  useEffect(() => {
    loadData();
    loadUnread();
  }, [currentUser]);

  /* =========================================================
     CREATE GROUP
  ========================================================= */
  async function handleCreateGroup() {
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

    try {
      const res = await fetch(`${API_BASE}/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.json();
      const parsed =
        typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;

      if (!parsed.success) {
        alert(parsed.message || "Failed to create group");
        return;
      }

      // RESET UI
      setShowCreateModal(false);
      setNewGroupName("");
      setSelectedMembers([]);

      await loadData();

      alert("✅ Group created");
    } catch (err) {
      console.error("🔥 CREATE GROUP FAILED:", err);
      alert("Create group failed — see console");
    }
  }

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
          actor: currentUser,
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
          actor: currentUser,
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

      {/* CREATE GROUP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white w-[420px] rounded-lg shadow-lg p-5">
            <h3 className="text-lg font-semibold mb-4">Create Group</h3>

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
              <p className="text-xs text-slate-500 mb-2">Add members</p>

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
          const chatId = `GROUP#${g.groupid}`;
          const isActive = activeChat === chatId;

          return (
            <div
              key={g.groupid}
              className={`flex items-center justify-between px-3 py-2 rounded ${
                isActive ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              {/* GROUP CLICK */}
              <div
                onClick={() => {
                  setActiveChat(chatId);
                  setUnread((prev) => ({ ...prev, [chatId]: 0 }));
                  onSelectUser({
                    type: "group",
                    id: g.groupid,
                    name: g.groupname,
                  });
                }}
                className="flex-1 text-sm cursor-pointer truncate flex items-center gap-2"
              >
                <span>{g.groupname}</span>

                {unread[chatId] > 0 && (
                  <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {unread[chatId]}
                  </span>
                )}
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
                const inGroup =
                  selectedGroup.members &&
                  selectedGroup.members.includes(m.userid);

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
        <h2 className="font-semibold text-slate-600 text-sm mb-2">
          👤 Members
        </h2>

        {members
          .filter((m) =>
            (m.profileName || "")
              .toLowerCase()
              .includes(search.toLowerCase())
          )
          .map((m) => {
            const chatId = `CHAT#${[currentUser, m.userid]
              .map((s) => s.toLowerCase())
              .sort()
              .join("#")}`;

            return (
              <button
                key={m.userid}
                onClick={() => {
                  setActiveChat(chatId);
                  setUnread((prev) => ({ ...prev, [chatId]: 0 }));
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

                {unread[chatId] > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                    {unread[chatId]}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </aside>
  );
}
