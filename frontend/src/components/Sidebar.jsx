import React, { useEffect, useState } from "react";
import { getMembers, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, X, Clock, Plus, Edit3 } from "lucide-react";
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

  // schedule modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [schedule, setSchedule] = useState({
    Mon: { start: "09:00", end: "17:00", enabled: true },
    Tue: { start: "09:00", end: "17:00", enabled: true },
    Wed: { start: "09:00", end: "17:00", enabled: true },
    Thu: { start: "09:00", end: "17:00", enabled: true },
    Fri: { start: "09:00", end: "17:00", enabled: true },
    Sat: { start: "", end: "", enabled: false },
    Sun: { start: "", end: "", enabled: false },
  });
  const [mySchedule, setMySchedule] = useState(null);
  const [isSelfActive, setIsSelfActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const profileName = localStorage.getItem("profileName") || currentUser;

  /* =========================================================
     Load Members & Groups
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

      const membersData = parsed?.members || parsed?.Items || [];
      setMembers(membersData);

      // groups
      const groupRes = await fetch(`${API_BASE}/groups`);
      const groupRaw = await groupRes.json();
      const groupParsed =
        typeof groupRaw?.body === "string" ? JSON.parse(groupRaw.body) : groupRaw;

      const fixedGroups =
        groupParsed?.groups?.map((g) => ({
          ...g,
          groupname: g.groupname || g.groupName,
        })) || [];

      setGroups(fixedGroups);
    } catch (err) {
      console.error("Sidebar load error:", err);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* =========================================================
     CREATE GROUP — fully working
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
        loadData(); // reload groups
      } else {
        alert("Failed to create group.");
      }
    } catch (err) {
      console.error("Create group failed:", err);
      alert("Error creating group.");
    }
  }

  /* =========================================================
     LOGOUT — now works properly
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
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <img src="/logo.JPG" alt="CHATr Logo" className="w-40 rounded-md border" />

        <button
          onClick={logout}
          className="text-slate-500 hover:text-red-600"
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
                  setSelectedGroup(g);
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

      {/* Members */}
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
    </aside>
  );
}
