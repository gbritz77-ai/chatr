import React, { useEffect, useState } from "react";
import { getMembers, getJSON, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, Settings } from "lucide-react";

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
      console.group("🧩 Sidebar: loadMembers()");
      console.time("⏱ Members fetch time");

      try {
        console.log("🔸 Current user:", currentUser);
        console.log("🔸 Stored profileName:", profileName);
        const res = await getMembers();
        console.log("📡 Raw getMembers() response:", res);

        const parsed =
          typeof res?.body === "string" ? JSON.parse(res.body) : res;
        console.log("📦 Normalized response:", parsed);

        let membersData = [];
        if (Array.isArray(parsed)) {
          membersData = parsed;
          console.log("✅ Parsed as direct array of members");
        } else if (Array.isArray(parsed?.members)) {
          membersData = parsed.members;
          console.log("✅ Using parsed.members");
        } else if (Array.isArray(parsed?.data)) {
          membersData = parsed.data;
          console.log("✅ Using parsed.data");
        } else {
          console.warn("⚠️ Could not locate member list in response");
        }

        console.table(membersData);

        const filtered = membersData.filter(
          (m) =>
            m.userid !== currentUser &&
            m.profileName?.toLowerCase() !== (profileName || "").toLowerCase()
        );
        console.log(`📋 Filtered members (${filtered.length}):`, filtered);

        if (filtered.length === 0) {
          console.warn("⚠️ No members after filtering — check user IDs / names");
        }

        // 👀 Expose global debug info
        window.__debugMembers = { raw: membersData, filtered };

        setMembers(filtered);
      } catch (err) {
        console.error("❌ Failed to fetch members:", err);
      } finally {
        console.timeEnd("⏱ Members fetch time");
        console.groupEnd();
      }
    }

    if (currentUser) loadMembers();
  }, [currentUser, profileName]);

  /* =========================================================
     Load Groups
  ========================================================= */
  async function loadGroups() {
    console.group("🧩 Sidebar: loadGroups()");
    console.time("⏱ Groups fetch time");
    if (!currentUser) {
      console.warn("⚠️ Skipping group load: no currentUser yet");
      console.groupEnd();
      return;
    }
    try {
      console.log("🔸 Fetching groups for:", currentUser);
      const res = await fetch(
        `${API_BASE}/groups?username=${encodeURIComponent(currentUser)}`
      );
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;
      console.log("📦 Groups API raw:", raw);
      console.log("📦 Groups API normalized:", data);

      if (data?.success) {
        const list = data.groups || data.data || data.items || [];
        console.table(list);
        setGroups(Array.isArray(list) ? list : []);
      } else {
        console.warn("⚠️ Unexpected groups format:", data);
        setGroups([]);
      }
    } catch (err) {
      console.error("❌ Failed to fetch groups:", err);
    } finally {
      console.timeEnd("⏱ Groups fetch time");
      console.groupEnd();
    }
  }

  useEffect(() => {
    loadGroups();
    const interval = setInterval(loadGroups, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  /* =========================================================
     Unread Counts
  ========================================================= */
  async function loadUnreadCounts() {
    console.group("📨 Sidebar: loadUnreadCounts()");
    if (!currentUser) {
      console.warn("⚠️ No currentUser for unread counts");
      console.groupEnd();
      return;
    }

    try {
      const res = await getJSON(
        `/messages/unread-counts?username=${encodeURIComponent(currentUser)}`
      );
      const data = typeof res?.body === "string" ? JSON.parse(res.body) : res;
      console.log("📦 Unread response:", data);

      if (Array.isArray(data)) {
        const map = {};
        for (const entry of data) map[entry.chatId] = entry.unreadCount;
        console.table(map);
        setUnreadMap(map);
      } else {
        console.warn("⚠️ Unread response not array:", data);
      }
    } catch (err) {
      console.error("❌ Failed to load unread counts:", err);
    } finally {
      console.groupEnd();
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
    console.log("🔄 toggleMember:", username);
    setSelectedMembers((prev) =>
      prev.includes(username)
        ? prev.filter((m) => m !== username)
        : [...prev, username]
    );
  };

  const handleCreateGroup = async () => {
    console.group("➕ CreateGroup()");
    console.log("📋 Selected members:", selectedMembers);
    console.log("📋 Group name:", groupName);

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
      console.log("📦 Create group response:", data);
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
    } finally {
      console.groupEnd();
    }
  };

  /* =========================================================
     Render
  ========================================================= */
  const filteredGroups = groups.filter((g) =>
    g.groupName?.toLowerCase().includes(search.toLowerCase())
  );

  console.debug("🧠 Sidebar Render State", {
    currentUser,
    membersCount: members.length,
    groupsCount: groups.length,
    unreadKeys: Object.keys(unreadMap).length,
  });

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[320px] bg-white border-r border-slate-200 flex flex-col z-20 relative">
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

      {/* Scrollable */}
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
                        console.log("💬 Selected group:", g);
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
      </div>

      {/* 🧩 Debug Overlay */}
      <div className="absolute bottom-0 left-0 w-full bg-slate-100 border-t border-slate-300 text-[11px] text-slate-600 p-2 font-mono">
        <div>🐞 <b>Sidebar Debug</b></div>
        <div>CurrentUser: {currentUser || "(none)"}</div>
        <div>ProfileName: {profileName || "(none)"}</div>
        <div>Members: {members?.length ?? 0}</div>
        <div>Groups: {groups?.length ?? 0}</div>
        <div>Unread keys: {Object.keys(unreadMap).length}</div>
        <div className="truncate">API_BASE: {API_BASE}</div>
      </div>
    </aside>
  );
}
