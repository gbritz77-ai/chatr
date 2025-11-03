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

  // schedule stuff
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
     🔁 Load Members & Groups
  ========================================================= */
  useEffect(() => {
    async function loadData() {
      try {
        console.log("🟢 Fetching members...");
        const res = await getMembers();
        const parsed =
          typeof res === "string"
            ? JSON.parse(res)
            : typeof res?.body === "string"
            ? JSON.parse(res.body)
            : res;
        const membersData = parsed?.members || parsed?.Items || [];
        console.log("✅ Members loaded:", membersData.length);
        setMembers(membersData);

        console.log("🟢 Fetching groups...");
        const groupRes = await fetch(`${API_BASE}/groups`);
        const groupRaw = await groupRes.json();
        const groupParsed =
          typeof groupRaw?.body === "string" ? JSON.parse(groupRaw.body) : groupRaw;

        const fixedGroups =
          groupParsed?.groups?.map((g) => ({
            ...g,
            groupname: g.groupname || g.groupName,
          })) || [];

        console.log("✅ Groups loaded:", fixedGroups.length, fixedGroups);
        setGroups(fixedGroups);

        // schedule check
        const me =
          membersData.find(
            (m) =>
              m.userid?.toLowerCase() === currentUser?.toLowerCase() ||
              m.profileName?.toLowerCase() === profileName?.toLowerCase()
          ) || null;
        if (me) {
          console.log("🕒 Fetching schedule for", me.userid);
          const sched = await fetchSchedule(me.userid);
          setMySchedule(sched);
          setIsSelfActive(checkIfSelfActive(sched));
        }
      } catch (err) {
        console.error("❌ Sidebar load error:", err);
      }
    }
    loadData();
  }, [currentUser]);

  /* =========================================================
     🧠 Helpers
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
      console.error("❌ markRead failed:", err);
    }
  }

  async function fetchSchedule(userid) {
    try {
      const res = await fetch(`${API_BASE}/work-schedule?username=${userid}`);
      const raw = await res.json();
      const data = typeof raw?.body === "string" ? JSON.parse(raw.body) : raw;
      if (data?.success && data.schedule) {
        const result = {
          start: data.schedule.start || "09:00",
          end: data.schedule.end || "17:00",
          days: data.schedule.days || ["Mon", "Tue", "Wed", "Thu", "Fri"],
        };
        return result;
      }
    } catch (err) {
      console.error("❌ Fetch schedule failed:", err);
    }
    return schedule;
  }

  /* =========================================================
     🧱 UI Rendering (unchanged)
  ========================================================= */
  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[320px] bg-white border-r border-slate-200 flex flex-col z-20">
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
          groups.map((g) => (
            <div key={g.groupid} className="flex justify-between items-center py-2 px-3">
              <button
                onClick={() => {
                  const chatKey = getChatKey("group", g.groupid);
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
        {members.length ? (
          members.map((m) => (
            <button
              key={m.userid}
              onClick={() => {
                const chatKey = getChatKey("user", null, m.userid);
                markRead(chatKey);
                setActiveChat(`user-${m.userid}`);
                onSelectUser({
                  type: "user",
                  id: m.userid,
                  name: m.profileName,
                });
              }}
              className="flex justify-between items-center w-full px-3 py-2 text-sm rounded-md hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Avatar name={m.profileName} size={2.2} />
                <span>{m.profileName}</span>
              </div>
            </button>
          ))
        ) : (
          <p className="text-slate-400 text-xs italic">No members found</p>
        )}
      </div>

      {/* Footer */}
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
                ></span>
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
      {/* 🛠️ Edit Group Modal */}
{showManageModal && selectedGroup && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg shadow-xl w-[420px] p-5 relative">
      <button
        onClick={() => setShowManageModal(false)}
        className="absolute top-3 right-3 text-gray-500 hover:text-red-500"
      >
        <X size={18} />
      </button>
      <h3 className="text-lg font-semibold mb-3">
        Edit Group — {selectedGroup.groupname}
      </h3>

      {/* Member List */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Members:
        </label>
        {selectedGroup.members?.length ? (
          <ul className="border rounded-md p-2 max-h-[180px] overflow-y-auto">
            {selectedGroup.members.map((m) => (
              <li
                key={m}
                className="flex justify-between items-center py-1 border-b last:border-0"
              >
                <span className="text-sm">{m}</span>
                <button
                  className="text-red-500 text-xs hover:underline"
                  onClick={async () => {
                    try {
                      await fetch(`${API_BASE}/groups/remove`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          groupid: selectedGroup.groupid,
                          username: m,
                        }),
                      });
                      setSelectedGroup((prev) => ({
                        ...prev,
                        members: prev.members.filter((x) => x !== m),
                      }));
                    } catch (err) {
                      alert("❌ Failed to remove member");
                      console.error(err);
                    }
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">No members</p>
        )}
      </div>

      {/* Add Member */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1 text-gray-700">
          Add Member:
        </label>
        <select
          className="w-full border rounded-md px-2 py-1 text-sm"
          onChange={async (e) => {
            const user = e.target.value;
            if (!user) return;
            try {
              await fetch(`${API_BASE}/groups/add`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  groupid: selectedGroup.groupid,
                  username: user,
                }),
              });
              setSelectedGroup((prev) => ({
                ...prev,
                members: [...prev.members, user],
              }));
            } catch (err) {
              alert("❌ Failed to add member");
              console.error(err);
            }
          }}
        >
          <option value="">Select member...</option>
          {members
            .filter(
              (m) => !selectedGroup.members.includes(m.userid)
            )
            .map((m) => (
              <option key={m.userid} value={m.userid}>
                {m.profileName} ({m.userid})
              </option>
            ))}
        </select>
      </div>

      {/* Delete group */}
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={async () => {
            if (!confirm("Are you sure you want to delete this group?")) return;
            try {
              await fetch(`${API_BASE}/groups/delete`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groupid: selectedGroup.groupid }),
              });
              setGroups((prev) =>
                prev.filter((g) => g.groupid !== selectedGroup.groupid)
              );
              setShowManageModal(false);
            } catch (err) {
              alert("❌ Failed to delete group");
              console.error(err);
            }
          }}
          className="text-white bg-red-600 hover:bg-red-700 text-sm px-3 py-2 rounded-md"
        >
          Delete Group
        </button>
        <button
          onClick={() => setShowManageModal(false)}
          className="text-gray-700 bg-gray-200 hover:bg-gray-300 text-sm px-3 py-2 rounded-md"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

{/* 🕒 Schedule Modal (Time Management) */}
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
          <label className="text-sm font-medium text-gray-700">Start:</label>
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
          <label className="text-sm font-medium text-gray-700">End:</label>
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
