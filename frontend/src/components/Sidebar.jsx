import React, { useEffect, useState } from "react";
import { getMembers, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, X, Clock } from "lucide-react";
import { useTabNotification } from "../hooks/useTabNotification";

export default function Sidebar({ onSelectUser, currentUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [search, setSearch] = useState("");
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

  /* =========================================================
     🔔 Tab Notification Hook (for favicon blue dot)
  ========================================================= */
  const totalUnread = Object.values(unreadMap || {}).reduce((a, b) => a + b, 0);
  useTabNotification(totalUnread);

  /* =========================================================
     🔧 Utility: Determine if member is active right now
  ========================================================= */
  function isMemberActive(member) {
    if (!member?.workSchedule) return false;
    const { start, end, days } = member.workSchedule;
    const now = new Date();
    const currentDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
    if (!days?.includes(currentDay)) return false;
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    return currentMins >= startMins && currentMins <= endMins;
  }

  function checkIfSelfActive(schedule) {
    if (!schedule) return false;
    const { start, end, days } = schedule;
    const now = new Date();
    const currentDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
    if (!days?.includes(currentDay)) return false;
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    return currentMins >= startMins && currentMins <= endMins;
  }

  useEffect(() => {
    const timer = setInterval(() => {
      if (mySchedule) setIsSelfActive(checkIfSelfActive(mySchedule));
    }, 60000);
    return () => clearInterval(timer);
  }, [mySchedule]);

  /* =========================================================
     Load Members & Groups
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

        const groupRes = await fetch(
          `${API_BASE}/groups?username=${encodeURIComponent(currentUser)}`
        );
        const groupRaw = await groupRes.json();
        const groupData =
          typeof groupRaw?.body === "string" ? JSON.parse(groupRaw.body) : groupRaw;
        setGroups(groupData?.groups || groupData?.Items || []);

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
     🔗 Chat ID Helper
  ========================================================= */
  const getChatKey = (type, id, otherUser) =>
    type === "group"
      ? `GROUP#${id}`
      : `CHAT#${[currentUser, otherUser]
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
          .join("#")}`;

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
     ✅ markRead helper
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
     🕒 Schedule Management
  ========================================================= */
  async function fetchSchedule(userid) {
    try {
      const res = await fetch(`${API_BASE}/work-schedule?username=${userid}`);
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;

      let resultSchedule;
      if (data?.success && data.schedule) {
        resultSchedule = {
          start: data.schedule.start || "09:00",
          end: data.schedule.end || "17:00",
          days:
            Array.isArray(data.schedule.days) && data.schedule.days.length > 0
              ? data.schedule.days
              : ["Mon", "Tue", "Wed", "Thu", "Fri"],
        };
      } else {
        resultSchedule = { start: "09:00", end: "17:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] };
      }

      setSchedule(resultSchedule);
      return resultSchedule;
    } catch (err) {
      console.error("❌ Failed to load schedule:", err);
      const fallback = { start: "09:00", end: "17:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] };
      setSchedule(fallback);
      return fallback;
    }
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
      } else {
        alert("⚠️ Saved, but no confirmation from API.");
      }
      setShowScheduleModal(false);
    } catch (err) {
      alert("❌ Failed to save schedule");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     🧭 Filter Members
  ========================================================= */
  const filteredMembers = members.filter((m) => {
    const pname = (m.profileName || "").toLowerCase();
    const prof = (profileName || "").toLowerCase();
    const cur = (currentUser || "").toLowerCase();
    const isSelf = pname === prof || (m.userid || "").toLowerCase() === cur;
    return !isSelf && pname.includes(search.toLowerCase());
  });

  /* =========================================================
     🧱 Render
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
        <h2 className="font-semibold text-slate-600 text-sm mb-2 flex items-center gap-2">
          <Users size={14} /> Groups
        </h2>
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
                    name: g.groupname,
                  });
                }}
                className={`flex items-center justify-between w-full py-2 px-3 rounded-md text-sm transition ${
                  activeChat === `group-${g.groupid}`
                    ? "bg-gray-100"
                    : "hover:bg-gray-50"
                }`}
              >
                <span>{g.groupname}</span>
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

      {/* Footer - Logged in user */}
      {/* (unchanged, omitted for brevity) */}
    </aside>
  );
}
