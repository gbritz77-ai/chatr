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
     UNREAD COUNTS — WITH DEBUGGING
  ========================================================= */
  async function loadUnread() {
    const url = `${API_BASE}/messages/unread-counts?username=${currentUser}`;
    console.log("🟦 UNREAD DEBUG — Fetching unread counts:", url);

    try {
      const res = await fetch(url);

      console.log("🟦 UNREAD DEBUG — Raw fetch response:", res);

      const raw = await res.json();
      console.log("🟦 UNREAD DEBUG — Raw JSON response:", raw);

      const data =
        typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;

      console.log("🟦 UNREAD DEBUG — Parsed data:", data);

      if (data?.success) {
        console.log("🟦 UNREAD DEBUG — FINAL unread counts set to:", data.counts);
        setUnread(data.counts || {});
      } else {
        console.warn("🟥 UNREAD DEBUG — API did not return success:", data);
      }
    } catch (err) {
      console.error("🟥 UNREAD DEBUG — Fetch failed:", err);
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
    console.log("🟦 UNREAD DEBUG — Sidebar mounted, loading data + unread…");
    loadData();
    loadUnread();
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

              {/* Unread badge */}
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

              {/* Unread badge */}
              {unread[`user-${m.userid}`] > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  {unread[`user-${m.userid}`]}
                </span>
              )}
            </button>
          ))}
      </div>

      {/* Modals (unchanged)… */}
      {/* --------------------------------------------- */}
      {/* CREATE + MANAGE group modals remain as is... */}
      {/* --------------------------------------------- */}
    </aside>
  );
}
