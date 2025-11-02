import React, { useEffect, useState } from "react";
import { getMembers, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import {
  LogOut,
  Users,
  X,
  Clock,
  Plus,
} from "lucide-react";

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
  const [loading, setLoading] = useState(false);

  const profileName = localStorage.getItem("profileName") || currentUser;

  /* =========================================================
     🔧 Utility: Determine if member is "Active" right now
  ========================================================= */
  function isMemberActive(member) {
    if (!member?.workSchedule) return false;

    const { start, end, days } = member.workSchedule;
    const now = new Date();
    const currentDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      now.getDay()
    ];

    if (!days?.includes(currentDay)) return false;

    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    return currentMins >= startMins && currentMins <= endMins;
  }

  // 💡 Refresh "Active" indicators every minute
  const [timeTick, setTimeTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTimeTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  /* =========================================================
     Load Members
  ========================================================= */
  useEffect(() => {
    async function loadMembers() {
      try {
        const res = await getMembers();
        const data =
          typeof res === "string"
            ? JSON.parse(res)
            : typeof res?.body === "string"
            ? JSON.parse(res.body)
            : res;

        const membersData = data?.members || data?.Items || [];
        const filtered = membersData.filter((m) => {
          const uid = (m.userid || "").toLowerCase();
          const pname = (m.profileName || "").toLowerCase();
          const cur = (currentUser || "").toLowerCase();
          const prof = (profileName || "").toLowerCase();
          return uid !== cur && pname !== prof;
        });
        setMembers(filtered);
      } catch (err) {
        console.error("❌ Failed to fetch members:", err);
      }
    }
    loadMembers();
  }, [currentUser]);

  /* =========================================================
     🔗 Get Chat Key Helper
  ========================================================= */
  const getChatKey = (type, id, otherUser) =>
    type === "group"
      ? `GROUP#${id}`
      : `CHAT#${[currentUser, otherUser]
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
          .join("#")}`;

  async function markRead(chatid) {
    if (!chatid || !currentUser) return;
    try {
      await fetch(`${API_BASE}/messages/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatid, username: currentUser }),
      });
      setUnreadMap((prev) => ({ ...prev, [chatid]: 0 }));
    } catch (err) {
      console.warn("⚠️ Failed to mark chat as read:", err);
    }
  }

  /* =========================================================
     🔢 Unread Counts
  ========================================================= */
  async function loadUnreadCounts() {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${API_BASE}/messages/unread-counts?username=${encodeURIComponent(
          currentUser
        )}`
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
     🕒 Load and Save Schedule
  ========================================================= */
  async function fetchSchedule(userid) {
    try {
      const res = await fetch(`${API_BASE}/work-schedule?username=${userid}`);
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;
      if (data?.success && data.schedule) setSchedule(data.schedule);
    } catch (err) {
      console.error("❌ Failed to load schedule:", err);
    }
  }

  async function saveSchedule() {
    try {
      setLoading(true);
      await fetch(`${API_BASE}/work-schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userid: selectedMember.userid,
          workSchedule: schedule,
        }),
      });
      alert("✅ Schedule saved!");
      setShowScheduleModal(false);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      alert("❌ Failed to save schedule");
      console.error(err);
    }
  }

  /* =========================================================
     Render
  ========================================================= */
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
            {members.length} members online check
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

      {/* Members */}
      <div className="p-3 border-b overflow-y-auto flex-1">
        <h2 className="font-semibold text-slate-600 text-sm mb-2">
          👤 Members
        </h2>

        {filteredMembers.length ? (
          <div className="space-y-1">
            {filteredMembers.map((m) => {
              const chatKey = getChatKey("user", null, m.userid);
              const unread = unreadMap[chatKey] || 0;
              const active = isMemberActive(m);
              const scheduleText =
                m.workSchedule &&
                `${m.workSchedule.start}–${m.workSchedule.end} (${m.workSchedule.days.join(
                  ", "
                )})`;

              return (
                <div key={m.userid} className="flex flex-col border-b py-1">
                  <div className="flex items-center justify-between px-3">
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
                      className={`flex items-center gap-3 py-2 rounded-md w-full text-left transition ${
                        activeChat === `user-${m.userid}`
                          ? "bg-gray-100"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <Avatar name={m.profileName} size={2.2} />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium truncate">
                            {m.profileName}
                          </span>
                          <span
                            className={`flex items-center gap-1 text-xs ${
                              active ? "text-green-600" : "text-red-500"
                            }`}
                          >
                            ● {active ? "Active" : "Offline"}
                          </span>
                        </div>
                        {scheduleText && (
                          <div className="text-xs text-slate-500 mt-1">
                            🕒 {scheduleText}
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-400 text-sm italic">No members found</p>
        )}
      </div>

      {/* 👤 Logged-in user footer */}
      <div className="border-t border-slate-200 p-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={profileName} size={2.4} />
            <div>
              <div className="text-sm font-semibold text-gray-800">
                {profileName}
              </div>
              <div className="text-xs text-gray-500">Logged in</div>
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

      {/* 🕒 Schedule Modal */}
      {showScheduleModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[420px] p-5 relative">
            <button
              onClick={() => setShowScheduleModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-semibold mb-3">
              Working Hours — {selectedMember.profileName}
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Start Time:
                </label>
                <input
                  type="time"
                  value={schedule.start}
                  onChange={(e) =>
                    setSchedule({ ...schedule, start: e.target.value })
                  }
                  className="w-full border px-2 py-1 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  End Time:
                </label>
                <input
                  type="time"
                  value={schedule.end}
                  onChange={(e) =>
                    setSchedule({ ...schedule, end: e.target.value })
                  }
                  className="w-full border px-2 py-1 rounded-md text-sm"
                />
              </div>
            </div>

            <label className="text-sm font-medium text-gray-700">Days:</label>
            <div className="grid grid-cols-3 gap-2 my-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <label key={day} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={schedule.days.includes(day)}
                    onChange={(e) =>
                      setSchedule((prev) => ({
                        ...prev,
                        days: e.target.checked
                          ? [...prev.days, day]
                          : prev.days.filter((d) => d !== day),
                      }))
                    }
                  />
                  {day}
                </label>
              ))}
            </div>

            <div className="flex justify-end mt-4 gap-2">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="bg-gray-300 text-gray-800 text-sm px-3 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={saveSchedule}
                disabled={loading}
                className={`${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white text-sm px-3 py-2 rounded-md`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
