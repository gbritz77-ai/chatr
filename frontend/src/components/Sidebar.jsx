import React, { useEffect, useState } from "react";
import { getMembers, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, Settings } from "lucide-react";

export default function Sidebar({ onSelectUser, currentUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [search, setSearch] = useState("");

  const profileName = localStorage.getItem("profileName") || currentUser;

  /* =========================================================
     Load Members (robust + debug)
  ========================================================= */
  useEffect(() => {
    async function loadMembers() {
      console.log("👥 [Sidebar] Loading members for:", currentUser);
      try {
        const res = await getMembers();
        console.log("📦 Raw members response:", res);

        let data;
        if (typeof res === "string") data = JSON.parse(res);
        else if (typeof res?.body === "string") data = JSON.parse(res.body);
        else data = res;

        // Handle both members[] and data[]
        const membersData =
          data?.members || data?.data || data?.Items || [];

        console.log("📊 Members count:", membersData.length);
        console.log("🧩 currentUser:", currentUser, "| profileName:", profileName);

        const filtered = membersData.filter((m) => {
          const uid = (m.userid || "").toLowerCase();
          const pname = (m.profileName || "").toLowerCase();
          const cur = (currentUser || "").toLowerCase();
          const prof = (profileName || "").toLowerCase();
          return uid !== cur && pname !== prof;
        });

        console.log("✅ Filtered members:", filtered);
        setMembers(filtered);
      } catch (err) {
        console.error("❌ Failed to fetch members:", err);
      }
    }

    loadMembers();
  }, [currentUser]);

  /* =========================================================
     Load Groups (robust + debug)
  ========================================================= */
  async function loadGroups() {
    if (!currentUser) return;
    console.log("📡 [Sidebar] Fetching groups for:", currentUser);

    try {
      const res = await fetch(
        `${API_BASE}/groups?username=${encodeURIComponent(currentUser)}`
      );
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;

      if (data?.success) {
        const normalized = (Array.isArray(data.groups) ? data.groups : []).map(
          (g) => ({
            ...g,
            groupName: g.groupName || g.groupname || "",
          })
        );
        console.log("✅ [Sidebar] Loaded groups:", normalized);
        setGroups(normalized);
      } else {
        console.warn("⚠️ [Sidebar] Groups API returned no success:", data);
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
     Render
  ========================================================= */
  const filteredGroups = groups.filter((g) =>
    g.groupName?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMembers = members.filter((m) =>
    m.profileName?.toLowerCase().includes(search.toLowerCase())
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

      {/* Members List */}
      <div className="p-3 border-b">
        <h2 className="font-semibold text-slate-600 text-sm flex items-center gap-1 mb-2">
          👤 Members
        </h2>
        {filteredMembers.length ? (
          <div className="space-y-1">
            {filteredMembers.map((m) => (
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
                className={`flex items-center gap-3 px-3 py-2 rounded-md w-full text-left transition ${
                  activeChat === `user-${m.userid}`
                    ? "bg-gray-100 text-gray-900"
                    : "hover:bg-gray-50"
                }`}
              >
                <Avatar name={m.profileName} size={2.2} />
                <span className="text-sm font-medium truncate">
                  {m.profileName}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm italic">
            No members found (debug: {members.length})
          </p>
        )}
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-600 text-sm flex items-center gap-1">
            <Users size={14} /> Groups
          </h2>
          <button
            onClick={() => alert("🧩 Group creation modal coming soon")}
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
              return (
                <button
                  key={g.groupid}
                  onClick={() => {
                    setActiveChat(`group-${g.groupid}`);
                    setUnreadMap((prev) => ({ ...prev, [key]: 0 }));
                    onSelectUser({
                      type: "group",
                      id: g.groupid,
                      name: g.groupName,
                    });
                  }}
                  className={`flex w-full text-left px-3 py-2 rounded-md items-center gap-3 transition ${
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
              );
            })}
          </div>
        ) : (
          <p className="text-slate-400 text-sm italic">
            No groups yet (debug: {groups.length})
          </p>
        )}
      </div>
    </aside>
  );
}
