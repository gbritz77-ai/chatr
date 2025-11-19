// src/components/Sidebar.jsx
import React, { useEffect, useState } from "react";
import { getJSON, postJSON } from "../lib/api";
import { Plus } from "lucide-react";

export default function Sidebar({ currentUser, activeUser, setActiveUser }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ----------------------------------------------------
     LOAD MEMBERS
  ---------------------------------------------------- */
  async function loadMembers() {
    try {
      const res = await getJSON("/members");
      console.log("📌 Loaded Members:", res);
      setMembers(res.members || []);
    } catch (err) {
      console.error("❌ Failed to load members:", err);
      setMembers([]);
    }
  }

  /* ----------------------------------------------------
     LOAD GROUPS
  ---------------------------------------------------- */
  async function loadGroups() {
    try {
      const username = currentUser;
      const res = await getJSON(`/groups?username=${encodeURIComponent(username)}`);
      console.log("📌 Loaded Groups:", res);
      setGroups(res.groups || []);
    } catch (err) {
      console.error("❌ Failed to load groups:", err);
      setGroups([]);
    }
  }

  /* ----------------------------------------------------
     INITIAL LOAD
  ---------------------------------------------------- */
  useEffect(() => {
    loadMembers();
    loadGroups();
  }, []);

  /* ----------------------------------------------------
     CREATE GROUP HANDLER
  ---------------------------------------------------- */
  async function handleCreateGroup() {
    if (!groupName.trim() || selectedMembers.length === 0) {
      alert("Please provide a group name and select at least one member.");
      return;
    }

    setLoading(true);
    try {
      const res = await postJSON("/groups", {
        groupName,
        creator: currentUser,
        members: selectedMembers,
      });

      console.log("📌 Group creation response:", res);

      if (res?.success) {
        alert("🎉 Group created!");
        setShowCreateModal(false);
        setGroupName("");
        setSelectedMembers([]);
        loadGroups();
      } else {
        alert("⚠️ Failed: " + (res.message || "Unknown error"));
      }
    } catch (err) {
      console.error("❌ Group creation failed:", err);
    }
    setLoading(false);
  }

  /* ----------------------------------------------------
     SELECT USER OR GROUP
  ---------------------------------------------------- */
  function openChat(user) {
    setActiveUser(user);
  }

  /* ----------------------------------------------------
     RENDER
  ---------------------------------------------------- */
  return (
    <div className="sidebar">
      {/* ============ SEARCH BAR (optional) ============ */}
      <div className="search-box">
        <input type="text" placeholder="Search..." />
      </div>

      {/* ============ GROUPS SECTION ============ */}
      <div className="section">
        <div className="section-header">
          <span>Groups</span>
          <button
            className="icon-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} />
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="empty">No groups yet</p>
        ) : (
          <ul className="item-list">
            {groups.map((g) => (
              <li
                key={g.groupid}
                className={
                  activeUser?.type === "group" &&
                  activeUser?.id === g.groupid
                    ? "item active"
                    : "item"
                }
                onClick={() =>
                  openChat({ type: "group", id: g.groupid, name: g.groupName })
                }
              >
                <span className="avatar-circle">G</span>
                <div className="info">
                  <div className="title">{g.groupName}</div>
                  <div className="subtitle">{g.members.length} members</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ============ MEMBERS SECTION ============ */}
      <div className="section">
        <div className="section-header">Members</div>

        {members.length === 0 ? (
          <p className="empty">No members</p>
        ) : (
          <ul className="item-list">
            {members
              .filter((m) => m.userid !== currentUser)
              .map((m) => (
                <li
                  key={m.userid}
                  className={
                    activeUser?.type === "user" &&
                    activeUser?.username === m.userid
                      ? "item active"
                      : "item"
                  }
                  onClick={() =>
                    openChat({ type: "user", username: m.userid, name: m.profileName })
                  }
                >
                  <span className="avatar-circle">
                    {m.profileName?.[0]?.toUpperCase() || "U"}
                  </span>
                  <div className="info">
                    <div className="title">{m.profileName}</div>
                    <div className="subtitle">{m.userid}</div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* ============ CREATE GROUP MODAL ============ */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create Group</h3>

            <label>Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />

            <label>Select Members</label>
            <div className="member-select">
              {members
                .filter((m) => m.userid !== currentUser)
                .map((m) => (
                  <div key={m.userid} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(m.userid)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMembers((prev) => [...prev, m.userid]);
                        } else {
                          setSelectedMembers((prev) =>
                            prev.filter((u) => u !== m.userid)
                          );
                        }
                      }}
                    />
                    <span>{m.profileName}</span>
                  </div>
                ))}
            </div>

            <div className="modal-actions">
              <button
                className="btn"
                onClick={handleCreateGroup}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Group"}
              </button>
              <button
                className="btn cancel"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
