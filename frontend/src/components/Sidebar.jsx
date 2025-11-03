import React, { useEffect, useState } from "react";
import { getMembers, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, X, Clock, Plus, Edit3, Trash2 } from "lucide-react";
import { useTabNotification } from "../hooks/useTabNotification";

export default function Sidebar({ onSelectUser, currentUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");

  // Schedule
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

        // ✅ FIX: DynamoDB stores `groupName`, not `groupname`
        const groupRes = await fetch(`${API_BASE}/groups`);
        const groupRaw = await groupRes.json();
        const groupData =
          typeof groupRaw?.body === "string" ? JSON.parse(groupRaw.body) : groupRaw;
        const parsedGroups =
          groupData?.groups?.map((g) => ({
            ...g,
            groupname: g.groupname || g.groupName, // normalize key
          })) || [];

        setGroups(parsedGroups);

        // load my schedule
        const me = membersData.find(
          (m) =>
            m.userid?.toLowerCase() === currentUser?.toLowerCase() ||
            m.profileName?.toLowerCase() === profileName?.toLowerCase()
        );
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
     🔢 Unread Counts
  ========================================================= */
  async function loadUnreadCounts() {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${API_BASE}/messages/unread-counts?username=${encodeURIComponent(currentUser)}`
      );
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;
      if (data?.success && typeof data.unreadMap === "object") setUnreadMap(data.unreadMap);
    } catch (err) {
      console.error("❌ Failed to load unread counts:", err);
    }
  }

  useEffect(() => {
    loadUnreadCounts();
    const interval = setInterval(loadUnreadCounts, 8000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const getChatKey = (type, id, otherUser) =>
    type === "group"
      ? `GROUP#${id}`
      : `CHAT#${[currentUser, otherUser].sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        ).join("#")}`;

  async function markRead(chatKey) {
    try {
      await fetch(`${API_BASE}/messages/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatKey, username: currentUser }),
      });
      setUnreadMap((prev) => ({ ...prev, [chatKey]: 0 }));
    } catch (err) {
      console.error("❌ markRead failed:", err);
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
      const res = await fetch(`${API_BASE}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName: newGroupName.trim(),
          creator: currentUser,
          members: selectedMembers,
        }),
      });
      const data = await res.json();
      const parsed = typeof data?.body === "string" ? JSON.parse(data.body) : data;
      if (parsed.success) {
        alert("✅ Group created!");
        setGroups((prev) => [...prev, parsed.group]);
        setShowCreateModal(false);
      }
    } catch (err) {
      alert("❌ Error creating group");
      console.error(err);
    }
  }

  /* =========================================================
     ✏️ Manage Group
  ========================================================= */
  function openManageGroup(group) {
    setSelectedGroup(group);
    setSelectedMembers(group.members || []);
    setShowManageModal(true);
  }

  async function handleDeleteGroup() {
    if (!selectedGroup) return;
    if (!window.confirm("⚠️ Delete this group permanently?")) return;
    try {
      await fetch(`${API_BASE}/groups/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupid: selectedGroup.groupid }),
      });
      setGroups((prev) => prev.filter((g) => g.groupid !== selectedGroup.groupid));
      setShowManageModal(false);
      alert("🗑️ Group deleted");
    } catch (err) {
      alert("❌ Error deleting group");
      console.error(err);
    }
  }

  /* =========================================================
     🕒 Schedule Management
  ========================================================= */
  async function fetchSchedule(userid) {
    try {
      const res = await fetch(`${API_BASE}/work-schedule?username=${userid}`);
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;
      if (data?.success && data.schedule) {
        const result = {
          start: data.schedule.start || "09:00",
          end: data.schedule.end || "17:00",
          days: Array.isArray(data.schedule.days) && data.schedule.days.length > 0
            ? data.schedule.days
            : ["Mon", "Tue", "Wed", "Thu", "Fri"],
        };
        setSchedule(result);
        return result;
      }
    } catch (err) {
      console.error("❌ Failed to load schedule:", err);
    }
    const fallback = { start: "09:00", end: "17:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] };
    setSchedule(fallback);
    return fallback;
  }

  async function saveSchedule() {
    if (!selectedMember?.userid) {
      alert("⚠️ Missing user ID for schedule save.");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/work-schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userid: selectedMember.userid,
          workSchedule: schedule,
        }),
      });
      const result = await res.json();
      const data = typeof result?.body === "string" ? JSON.parse(result.body) : result;
      if (data?.success) {
        alert("✅ Schedule saved successfully!");
        setMySchedule(schedule);
        setIsSelfActive(checkIfSelfActive(schedule));
      } else alert("⚠️ Saved, but no confirmation from API.");
      setShowScheduleModal(false);
    } catch (err) {
      alert("❌ Failed to save schedule");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     🧱 Render
  ========================================================= */
  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[320px] bg-white border-r border-slate-200 flex flex-col z-20">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <img src="/logo/logo.JPG" alt="CHATr" className="w-40 rounded-md border" />
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = "/login";
          }}
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
          className="w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-400 outline-none"
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
          groups.map((g) => {
            const chatKey = getChatKey("group", g.groupid);
            const unread = unreadMap[chatKey] || 0;
            return (
              <div
                key={g.groupid}
                className="flex justify-between items-center py-2 px-3 hover:bg-gray-50 rounded-md"
              >
                <button
                  onClick={() => {
                    markRead(chatKey);
                    setActiveChat(`group-${g.groupid}`);
                    onSelectUser({
                      type: "group",
                      id: g.groupid,
                      name: g.groupname,
                    });
                  }}
                  className="flex-1 text-left text-sm"
                >
                  {g.groupname}
                </button>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <span className="bg-blue-500 text-white text-xs font-semibold rounded-full px-2 py-0.5">
                      {unread}
                    </span>
                  )}
                  <button
                    onClick={() => openManageGroup(g)}
                    className="text-gray-500 hover:text-blue-600"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-slate-400 text-xs italic">No groups yet</p>
        )}
      </div>

      {/* Members list and time management remain unchanged */}
      {/* ... KEEP YOUR EXISTING MEMBERS AND SCHEDULE MODAL BELOW HERE ... */}
    </aside>
  );
}
