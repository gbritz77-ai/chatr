import React, { useEffect, useState } from "react";
import { getMembers, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, X, Clock, Plus } from "lucide-react";
import { useTabNotification } from "../hooks/useTabNotification";

export default function Sidebar({ onSelectUser, currentUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [search, setSearch] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [schedule, setSchedule] = useState({
    start: "09:00",
    end: "17:00",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  });
  const [mySchedule, setMySchedule] = useState(null);
  const [isSelfActive, setIsSelfActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const profileName = localStorage.getItem("profileName") || currentUser;
  const totalUnread = Object.values(unreadMap || {}).reduce((a, b) => a + b, 0);
  useTabNotification(totalUnread);

  /* =========================================================
     🔧 Active status helpers
  ========================================================= */
  function isMemberActive(member) {
    if (!member?.workSchedule) return false;
    const { start, end, days } = member.workSchedule;
    const now = new Date();
    const currentDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
    if (!days?.includes(currentDay)) return false;
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const mins = now.getHours() * 60 + now.getMinutes();
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    return mins >= startMins && mins <= endMins;
  }

  function checkIfSelfActive(schedule) {
    if (!schedule) return false;
    const { start, end, days } = schedule;
    const now = new Date();
    const currentDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
    if (!days?.includes(currentDay)) return false;
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const mins = now.getHours() * 60 + now.getMinutes();
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    return mins >= startMins && mins <= endMins;
  }

  useEffect(() => {
    const timer = setInterval(() => {
      if (mySchedule) setIsSelfActive(checkIfSelfActive(mySchedule));
    }, 60000);
    return () => clearInterval(timer);
  }, [mySchedule]);

  /* =========================================================
     🔁 Load Members & Groups
  ========================================================= */
  useEffect(() => {
    async function loadMembersAndGroups() {
      try {
        const res = await getMembers();
        const data =
          typeof res === "string"
            ? JSON.parse(res)
            : typeof res?.body === "string"
            ? JSON.parse(res.body)
            : res;

        const membersData = data?.members || data?.Items || [];
        setMembers(membersData);

        // ✅ Fixed: now works even without username
        const groupRes = await fetch(`${API_BASE}/groups`);
        const groupRaw = await groupRes.json();
        const groupData =
          typeof groupRaw?.body === "string" ? JSON.parse(groupRaw.body) : groupRaw;

        const parsedGroups = groupData?.groups || groupData?.Items || [];
        setGroups(Array.isArray(parsedGroups) ? parsedGroups : []);

        const me =
          membersData.find(
            (m) =>
              m.userid?.toLowerCase() === currentUser?.toLowerCase() ||
              m.profileName?.toLowerCase() === profileName?.toLowerCase()
          ) || null;

        if (me) {
          const scheduleData = await fetchSchedule(me.userid);
          setMySchedule(scheduleData);
          setIsSelfActive(checkIfSelfActive(scheduleData));
        }
      } catch (err) {
        console.error("❌ Failed to fetch members or groups:", err);
      }
    }
    loadMembersAndGroups();
  }, [currentUser]);

  /* =========================================================
     🧩 Chat key helper
  ========================================================= */
  const getChatKey = (type, id, otherUser) =>
    type === "group"
      ? `GROUP#${id}`
      : `CHAT#${[currentUser, otherUser]
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
          .join("#")}`;

  /* =========================================================
     🔢 Unread count loader
  ========================================================= */
  async function loadUnreadCounts() {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${API_BASE}/messages/unread-counts?username=${encodeURIComponent(currentUser)}`
      );
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;
      if (data?.success && typeof data.unreadMap === "object") {
        setUnreadMap(data.unreadMap);
      }
    } catch (err) {
      console.error("❌ Failed to load unread counts:", err);
    }
  }

  useEffect(() => {
    loadUnreadCounts();
    const interval = setInterval(loadUnreadCounts, 8000);
    return () => clearInterval(interval);
  }, [currentUser]);

  /* =========================================================
     ✅ Mark chat as read
  ========================================================= */
  async function markRead(chatKey) {
    try {
      await fetch(`${API_BASE}/messages/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatKey, username: currentUser }),
      });
      setUnreadMap((prev) => ({ ...prev, [chatKey]: 0 }));
    } catch (err) {
      console.error("❌ Failed to mark chat as read:", err);
    }
  }

  /* =========================================================
     ➕ Create Group
  ========================================================= */
  async function handleCreateGroup() {
    if (!newGroupName.trim() || selectedMembers.length === 0) {
      alert("⚠️ Enter a group name and select members");
      return;
    }
    try {
      const payload = {
        groupName: newGroupName.trim(),
        creator: currentUser,
        members: selectedMembers,
      };
      const res = await fetch(`${API_BASE}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      const data = typeof result?.body === "string" ? JSON.parse(result.body) : result;

      if (data.success) {
        alert("✅ Group created successfully");
        setShowCreateGroup(false);
        setGroups((prev) => [...prev, data.group]);
      } else {
        alert("❌ Failed to create group");
      }
    } catch (err) {
      console.error("❌ Error creating group:", err);
      alert("❌ Error creating group");
    }
  }

  /* =========================================================
     🔍 Filter Members
  ========================================================= */
  const filteredMembers = members.filter((m) => {
    const pname = (m.profileName || "").toLowerCase();
    const prof = (profileName || "").toLowerCase();
    const cur = (currentUser || "").toLowerCase();
    const isSelf = pname === prof || (m.userid || "").toLowerCase() === cur;
    return !isSelf && pname.includes(search.toLowerCase());
  });

  /* =========================================================
     🧱 Render UI
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
          <p className="text-[11px] text-slate-400 mt-1">
            {members.length} members total
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

      {/* Groups */}
      <div className="p-3 border-b overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-600 text-sm flex items-center gap-2">
            <Users size={14} /> Groups
          </h2>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600 transition"
          >
            <Plus size={12} />
          </button>
        </div>
        {groups.length ? (
          groups.map((g) => {
            const chatKey = getChatKey("group", g.groupid);
            const unread = unreadMap[chatKey] || 0;
            return (
              <button
                key={g.groupid}
                onClick={() => {
                  markRead(chatKey);
                  setActiveChat(`group-${g.groupid}`);
                  onSelectUser({
                    type: "group",
                    id: g.groupid,
                    name: g.groupname || g.groupName,
                  });
                }}
                className={`flex items-center justify-between w-full py-2 px-3 rounded-md text-sm transition ${
                  activeChat === `group-${g.groupid}`
                    ? "bg-gray-100"
                    : "hover:bg-gray-50"
                }`}
              >
                <span>{g.groupname || g.groupName}</span>
                {unread > 0 && (
                  <span className="bg-blue-500 text-white text-xs font-semibold rounded-full px-2 py-0.5">
                    {unread}
                  </span>
                )}
              </button>
            );
          })
        ) : (
          <p className="text-slate-400 text-xs italic">No groups yet</p>
        )}
      </div>

      {/* Members */}
      <div className="p-3 border-b overflow-y-auto flex-1">
        <h2 className="font-semibold text-slate-600 text-sm mb-2">👤 Members</h2>
        {filteredMembers.length ? (
          filteredMembers.map((m) => {
            const chatKey = getChatKey("user", null, m.userid);
            const unread = unreadMap[chatKey] || 0;
            const active = isMemberActive(m);
            return (
              <div
                key={m.userid}
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-md transition"
              >
                <button
                  onClick={() => {
                    markRead(chatKey);
                    setActiveChat(`user-${m.userid}`);
                    onSelectUser({
                      type: "user",
                      id: m.userid,
                      name: m.profileName,
                    });
                  }}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <Avatar name={m.profileName} size={2.2} />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium truncate">
                        {m.profileName}
                      </span>
                      <span
                        className={`text-xs ${
                          active ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        ● {active ? "Active" : "Offline"}
                      </span>
                    </div>
                  </div>
                </button>
                {unread > 0 && (
                  <span className="bg-blue-500 text-white text-xs font-semibold rounded-full px-2 py-0.5 ml-2">
                    {unread}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-slate-400 text-sm italic">No members found</p>
        )}
      </div>

      {/* Footer + Time Management */}
      <div className="border-t border-slate-200 p-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={profileName} size={2.4} />
            <div>
              <div className="text-sm font-semibold text-gray-800">
                {profileName}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    isSelfActive ? "bg-green-500" : "bg-red-500"
                  }`}
                ></span>
                {isSelfActive ? "Active Now" : "Offline"}
              </div>
            </div>
          </div>
          <button
            className="text-gray-600 hover:text-blue-600 transition"
            title="Manage your working hours"
            onClick={() => {
              const me = members.find(
                (m) =>
                  m.userid?.toLowerCase() === currentUser?.toLowerCase() ||
                  m.profileName?.toLowerCase() === profileName?.toLowerCase()
              );
              if (me) {
                setSelectedMember(me);
                fetchSchedule(me.userid);
                setShowScheduleModal(true);
              } else {
                alert("⚠️ Could not find your member record.");
              }
            }}
          >
            <Clock size={18} />
          </button>
        </div>
      </div>

      {/* 🆕 Create Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[420px] p-5 relative">
            <button
              onClick={() => setShowCreateGroup(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-semibold mb-3">Create New Group</h3>
            <input
              type="text"
              placeholder="Group Name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="border w-full rounded-md px-3 py-2 text-sm mb-3"
            />
            <label className="text-sm font-medium text-gray-700">Select Members:</label>
            <div className="h-40 overflow-y-auto border rounded-md p-2 mt-1">
              {members.map((m) => (
                <label key={m.userid} className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(m.userid)}
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelectedMembers([...selectedMembers, m.userid]);
                      else
                        setSelectedMembers(selectedMembers.filter((id) => id !== m.userid));
                    }}
                  />
                  {m.profileName}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowCreateGroup(false)}
                className="bg-gray-300 text-gray-800 text-sm px-3 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                className="bg-blue-600 text-white text-sm px-3 py-2 rounded-md hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
