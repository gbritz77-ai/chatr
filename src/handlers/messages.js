// src/handlers/messages.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.MESSAGES_TABLE || "chatr-messages";
const READ_TRACKING_TABLE = process.env.READ_TRACKING_TABLE || "chatr-read-tracking";
const MEMBERS_TABLE = process.env.MEMBERS_TABLE || "chatr-members";

/* ============================================================
   🧰 Response Helper
============================================================ */
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
  },
  body: JSON.stringify(body),
});

/* ============================================================
   🔑 Chat ID Builder (Uppercase CHAT#)
============================================================ */
function getChatId(userA, userB) {
  if (!userA || !userB) return null;
  const sorted = [userA, userB].map((x) => x.toLowerCase()).sort();
  return `CHAT#${sorted[0]}#${sorted[1]}`;
}

/* ============================================================
   🧠 Main Handler
============================================================ */
exports.handler = async (event) => {
  console.log("💬 MESSAGES EVENT:", JSON.stringify(event, null, 2));

  const method = event.httpMethod || "GET";
  const params = event.queryStringParameters || {};
  let body = {};

  try {
    if (event.body) body = JSON.parse(event.body);
  } catch {
    return response(400, { success: false, message: "Invalid JSON body" });
  }

  // ✅ Handle CORS preflight
  if (method === "OPTIONS") return response(200, { message: "CORS preflight success" });

  try {
    /* ============================================================
       🔢 GET /messages/unread-counts?username=...
    ============================================================= */
    if (method === "GET" && (event.path || "").includes("unread-counts")) {
      const username = params.username?.toLowerCase();
      if (!username) return response(400, { success: false, message: "Missing username" });

      console.log("📊 Calculating unread counts for:", username);

      // 1️⃣ Get last read timestamps
      const readResult = await dynamodb
        .scan({
          TableName: READ_TRACKING_TABLE,
          FilterExpression: "#u = :u",
          ExpressionAttributeNames: { "#u": "username" },
          ExpressionAttributeValues: { ":u": username },
        })
        .promise();

      const readMap = {};
      for (const item of readResult.Items || [])
        readMap[item.chatid] = new Date(item.lastReadAt);

      // 2️⃣ Get messages involving this user
      const msgResult = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          FilterExpression: "sender = :u OR recipient = :u",
          ExpressionAttributeValues: { ":u": username },
        })
        .promise();

      // 3️⃣ Count unread per chat
      const unreadMap = {};
      for (const msg of msgResult.Items || []) {
        const chatid = msg.chatId || msg.chatid || msg.groupid;
        if (!chatid) continue;
        const sentAt = new Date(msg.timestamp || msg.createdAt || 0);
        const lastReadAt = readMap[chatid];
        if (!lastReadAt || sentAt > lastReadAt)
          unreadMap[chatid] = (unreadMap[chatid] || 0) + 1;
      }

      console.log("📬 Unread summary:", unreadMap);
      return response(200, { success: true, unreadMap });
    }

    /* ============================================================
       📜 GET /messages?chatId=... or ?groupid=...
    ============================================================= */
    if (method === "GET" && !(event.path || "").includes("unread-counts")) {
      const chatIdParam = params.chatId || params.chatid;
      const groupIdParam = params.groupid;

      // 🗨️ 1-on-1 chat
      if (chatIdParam) {
        const chatId = decodeURIComponent(chatIdParam).trim();
        console.log("🧩 Fetching messages for chat:", chatId);

        const result = await dynamodb
          .scan({
            TableName: TABLE_NAME,
            FilterExpression: "chatId = :cid OR chatid = :cid",
            ExpressionAttributeValues: { ":cid": chatId },
          })
          .promise();

        const messages = (result.Items || []).sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        console.log(`✅ ${messages.length} messages found for ${chatId}`);
        return response(200, { success: true, messages });
      }

      // 👥 Group chat
      if (groupIdParam) {
        const groupId = decodeURIComponent(groupIdParam).trim();
        console.log("🧩 Fetching messages for group:", groupId);

        const result = await dynamodb
          .scan({
            TableName: TABLE_NAME,
            FilterExpression: "groupid = :gid OR chatId = :gid",
            ExpressionAttributeValues: { ":gid": `GROUP#${groupId}` },
          })
          .promise();

        const messages = (result.Items || []).sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        console.log(`✅ ${messages.length} messages found for group ${groupId}`);
        return response(200, { success: true, messages });
      }

      return response(400, { success: false, message: "Missing chatId or groupid" });
    }

    /* ============================================================
       ✉️ POST /messages → Send Message
    ============================================================= */
    if (method === "POST" && !(event.path || "").includes("mark-read")) {
      if (!body || typeof body !== "object")
        return response(400, { success: false, message: "Invalid body" });

      let { sender, recipient, groupid, text, attachmentKey, attachmentType } = body;
      if (!sender)
        return response(400, { success: false, message: "Missing sender" });
      if (!recipient && !groupid)
        return response(400, { success: false, message: "Missing recipient or groupid" });
      if (recipient && sender.toLowerCase() === recipient.toLowerCase())
        return response(400, { success: false, message: "Cannot send message to self" });

      sender = sender.toLowerCase();
      recipient = recipient ? recipient.toLowerCase() : null;

      const timestamp = new Date().toISOString();
      const messageid = crypto.randomUUID();
      const chatId = groupid ? `GROUP#${groupid}` : getChatId(sender, recipient);

      const item = {
        messageid,
        chatId,
        sender,
        recipient,
        text: text || "",
        timestamp,
        attachmentKey: attachmentKey || null,
        attachmentType: attachmentType || null,
      };

      await dynamodb.put({ TableName: TABLE_NAME, Item: item }).promise();
      console.log("✅ Message saved:", item);

      // 🕓 Update sender's lastActive
      try {
        await dynamodb
          .update({
            TableName: MEMBERS_TABLE,
            Key: { userid: sender },
            UpdateExpression: "SET lastActive = :ts",
            ExpressionAttributeValues: { ":ts": timestamp },
          })
          .promise();
      } catch (err) {
        console.warn("⚠️ Failed to update lastActive:", err.code, err.message);
      }

      return response(200, { success: true, message: "Message sent", item });
    }

    /* ============================================================
       📬 POST /messages/mark-read
    ============================================================= */
     /* ============================================================
       📬 POST /messages/mark-read
    ============================================================= */
    if (method === "POST" && (event.path || "").includes("mark-read")) {
      const { chatid, chatKey, username } = body;
      const id = chatid || chatKey;
      const user = (username || "").toLowerCase();

      if (!id || !user)
        return response(400, {
          success: false,
          message: "Missing chatid/chatKey or username",
        });

      // Ignore self-chat
      const parts = id.split("#");
      if (parts[1] && parts[2] && parts[1] === parts[2])
        return response(200, { success: true, message: "Self-chat ignored" });

      const now = new Date().toISOString();
      console.log("📨 Marking as read:", { chatid: id, username: user });

      await dynamodb
        .put({
          TableName: READ_TRACKING_TABLE,
          Item: { chatid: id, username: user, read: true, lastReadAt: now },
        })
        .promise();

      try {
        await dynamodb
          .update({
            TableName: MEMBERS_TABLE,
            Key: { userid: user },
            UpdateExpression: "SET lastActive = :ts",
            ExpressionAttributeValues: { ":ts": now },
          })
          .promise();
      } catch (err) {
        console.warn("⚠️ Failed to update lastActive on read:", err.code, err.message);
      }

      return response(200, { success: true, lastReadAt: now });
    }

    /* ============================================================
       🚫 Unsupported Method
    ============================================================= */
    return response(405, { success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("❌ MESSAGES HANDLER ERROR:", err);
    return response(500, { success: false, message: err.message, error: err.stack });
  }
};
