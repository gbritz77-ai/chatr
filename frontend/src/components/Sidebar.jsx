import React, { useEffect, useState } from "react";
import { getMembers, API_BASE } from "../lib/api";
import { Avatar } from "./Avatar";
import { LogOut, Users, X, Clock, Plus, Edit3 } from "lucide-react";
import { useTabNotification } from "../hooks/useTabNotification";

export default function Sidebar({ onSelectUser, currentUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
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

  // 🔵 favicon blue-dot (no numbers)
  const totalUnread = Object.values(unreadMap || {}).reduce((a, b) => a + b, 0);
  useTabNotification(totalUnread);

  /* =========================================================
     Load Members & Groups
  ========================================================= */
  useEffect(() => {
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

        // schedule for footer active dot
        const me =
          membersData.find(
            (m) =>
              m.userid?.toLowerCase() === currentUser?.toLowerCase() ||
              m.profileName?.toLowerCase() === profileName?.toLowerCase()
          ) || null;
        if (me) {
          const sched = await fetchSchedule(me.userid);
          setMySchedule(sched);
          setIsSelfActive(checkIfSelfActive(sched));
        }
      } catch (err) {
        console.error("Sidebar load error:", err);
      }
    }
    loadData();
  }, [currentUser, profileName]);

  // keep self active indicator fresh every minute
  useEffect(() => {
    if (!mySchedule) return;
    const t = setInterval(() => setIsSelfActive(checkIfSelfActive(mySchedule)), 60000);
    return () => clearInterval(t);
  }, [mySchedule]);

  /* =========================================================
     Unread counts
  ========================================================= */
  async function loadUnreadCounts() {
    try {
      const res = await fetch(
        `${API_BASE}/messages/unread-counts?username=${encodeURIComponent(currentUser)}`
      );
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;
      if (data?.success && data.unreadMap) setUnreadMap(data.unreadMap);
    } catch (e) {
      console.error("Unread counts error:", e);
    }
  }
  useEffect(() => {
    if (!currentUser) return;
    loadUnreadCounts();
    const i = setInterval(loadUnreadCounts, 10000);
    return () => clearInterval(i);
  }, [currentUser]);

  /* =========================================================
     Helpers
  ========================================================= */
  function checkIfSelfActive(sched) {
    if (!sched) return false;
    const now = new Date();
    const currentDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
    const info = sched[currentDay];
    if (!info || !info.enabled || !info.start || !info.end) return false;
    const [sh, sm] = info.start.split(":").map(Number);
    const [eh, em] = info.end.split(":").map(Number);
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= sh * 60 + sm && mins <= eh * 60 + em;
  }

  const getChatKey = (type, id, otherUser) =>
    type === "group"
      ? `GROUP#${id}`
      : `CHAT#${[currentUser, otherUser]
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
          .join("#")}`;

  async function markRead(chatKey) {
    try {
      await fetch(`${API_BASE}/messages/mark-read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatKey, username: currentUser }),
      });
      setUnreadMap((prev) => ({ ...prev, [chatKey]: 0 }));
    } catch (err) {
      console.error("markRead failed:", err);
    }
  }

  async function fetchSchedule(userid) {
    try {
      const res = await fetch(`${API_BASE}/work-schedule?username=${userid}`);
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;
      if (data?.success && data.schedule) {
        return data.schedule;
      }
    } catch (err) {
      console.error("Fetch schedule failed:", err);
    }
    return schedule;
  }

  async function saveSchedule() {
    if (!selectedMember?.userid) {
      alert("Missing user ID for schedule save.");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/work-schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid: selectedMember.userid, workSchedule: schedule }),
      });
      const result = await res.json();
      const data = typeof result?.body === "string" ? JSON.parse(result.body) : result;
      if (data?.success) {
        setMySchedule(schedule);
        setIsSelfActive(checkIfSelfActive(schedule));
        setShowScheduleModal(false);
      } else {
        alert("Saved, but API did not confirm.");
      }
    } catch (err) {
      alert("Failed to save schedule");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     UI
  ========================================================= */
  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[320px] bg-white border-r border-slate-200 flex flex-col z-20">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <img src="/logo/logo.JPG" alt="CHATr Logo" className="w-40 rounded-md border" />
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
          groups.map((g) => {
            const chatKey = getChatKey("group", g.groupid);
            const hasUnread = unreadMap[chatKey] > 0;
            return (
              <div key={g.groupid} className="flex justify-between items-center py-2 px-3">
                <button
                  onClick={() => {
                    markRead(chatKey);
                    setActiveChat(`group-${g.groupid}`);
                    onSelectUser({ type: "group", id: g.groupid, name: g.groupname });
                  }}
                  className="flex-1 text-left text-sm flex items-center gap-2"
                >
                  {g.groupname}
                  {hasUnread && (
                    <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                  )}
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
            );
          })
        ) : (
          <p className="text-slate-400 text-xs italic">No groups yet</p>
        )}
      </div>

      {/* Members */}
      <div className="p-3 border-b flex-1 overflow-y-auto">
        <h2 className="font-semibold text-slate-600 text-sm mb-2">👤 Members</h2>
        {members
          .filter((m) => (m.profileName || "").toLowerCase().includes(search.toLowerCase()))
          .map((m) => {
            const chatKey = getChatKey("user", null, m.userid);
            const hasUnread = unreadMap[chatKey] > 0;
            return (
              <button
                key={m.userid}
                onClick={() => {
                  markRead(chatKey);
                  setActiveChat(`user-${m.userid}`);
                  onSelectUser({ type: "user", id: m.userid, name: m.profileName });
                }}
                className="flex justify-between items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={m.profileName} size={2.2} />
                  <span>{m.profileName}</span>
                  {hasUnread && (
                    <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                  )}
                </div>
              </button>
            );
          })}
      </div>

      {/* Footer + Time Management */}
      <div className="border-t border-slate-200 p-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={profileName} size={2.4} />
            <div>
              <div className="text-sm font-semibold text-gray-800">{profileName}</div>
              <div className="flex items-center gap-1 text-xs">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    isSelfActive ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {isSelfActive ? "Active Now" : "Offline"}
              </div>
            </div>
          </div>
          <button
            className="text-gray-600 hover:text-blue-600"
            onClick={() => {
              const me = members.find(
                (m) =>
                  m.userid?.toLowerCase() === currentUser?.toLowerCase() ||
                  m.profileName?.toLowerCase() === profileName?.toLowerCase()
              );
              if (me) {
                setSelectedMember(me);
                fetchSchedule(me.userid).then((s) => setSchedule(s));
                setShowScheduleModal(true);
              } else {
                alert("Could not find your member record.");
              }
            }}
          >
            <Clock size={18} />
          </button>
        </div>
      </div>

      {/* 🕒 TIME MANAGEMENT MODAL */}
      {showScheduleModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[460px] p-5 relative">
            <button
              onClick={() => setShowScheduleModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-semibold mb-3">
              Working Hours — {selectedMember.profileName}
            </h3>

            <div className="space-y-3">
              {Object.entries(schedule).map(([day, info]) => (
                <div key={day} className="flex items-center justify-between border-b pb-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 w-20">
                    <input
                      type="checkbox"
                      checked={info.enabled}
                      onChange={(e) =>
                        setSchedule((prev) => ({
                          ...prev,
                          [day]: { ...info, enabled: e.target.checked },
                        }))
                      }
                    />
                    {day}
                  </label>

                  {info.enabled ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="time"
                        value={info.start}
                        onChange={(e) =>
                          setSchedule((prev) => ({
                            ...prev,
                            [day]: { ...info, start: e.target.value },
                          }))
                        }
                        className="border px-2 py-1 rounded-md text-sm"
                      />
                      <span className="text-gray-500">→</span>
                      <input
                        type="time"
                        value={info.end}
                        onChange={(e) =>
                          setSchedule((prev) => ({
                            ...prev,
                            [day]: { ...info, end: e.target.value },
                          }))
                        }
                        className="border px-2 py-1 rounded-md text-sm"
                      />
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm italic">Off</div>
                  )}
                </div>
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
