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
   🔑 Chat ID Normalizer
============================================================ */
function getChatId(userA, userB) {
  const sorted = [userA, userB].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
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
      const username = params.username;
      if (!username)
        return response(400, { success: false, message: "Missing username" });

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

      // 2️⃣ Get messages involving user
      const msgResult = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          FilterExpression:
            "contains(#participants, :u) OR recipient = :u OR sender = :u",
          ExpressionAttributeNames: { "#participants": "participants" },
          ExpressionAttributeValues: { ":u": username },
        })
        .promise();

      // 3️⃣ Count unread per chat
      const unreadMap = {};
      for (const msg of msgResult.Items || []) {
        const chatid = msg.chatId || msg.groupid;
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

      if (chatIdParam) {
        const chatId = decodeURIComponent(chatIdParam);
        console.log("🧩 Scanning chat:", chatId);

        const result = await dynamodb
          .scan({
            TableName: TABLE_NAME,
            FilterExpression: "chatId = :chatId",
            ExpressionAttributeValues: { ":chatId": chatId },
          })
          .promise();

        const messages = (result.Items || []).sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        return response(200, { success: true, messages });
      }

      if (groupIdParam) {
        const groupId = decodeURIComponent(groupIdParam);
        console.log("🧩 Scanning group:", groupId);

        const result = await dynamodb
          .scan({
            TableName: TABLE_NAME,
            FilterExpression: "chatId = :gid",
            ExpressionAttributeValues: { ":gid": `GROUP#${groupId}` },
          })
          .promise();

        const messages = (result.Items || []).sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        return response(200, { success: true, messages });
      }

      return response(400, { success: false, message: "Missing chatId or groupid" });
    }

    /* ============================================================
       ✉️ POST /messages → Send Message
    ============================================================= */
    if (method === "POST" && !(event.path || "").includes("mark-read")) {
      const { sender, recipient, groupid, text, attachmentKey, attachmentType } =
        body;

      if (!sender)
        return response(400, { success: false, message: "Missing sender" });

      const timestamp = new Date().toISOString();
      const messageid = crypto.randomUUID();
      const chatId = groupid ? `GROUP#${groupid}` : getChatId(sender, recipient);

      const item = {
        messageid,
        chatId,
        sender,
        recipient: recipient || null,
        text: text || "",
        timestamp,
        attachmentKey: attachmentKey || null,
        attachmentType: attachmentType || null,
      };

      await dynamodb.put({ TableName: TABLE_NAME, Item: item }).promise();

      // 🕓 Update sender's lastActive in members table
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
        console.warn("⚠️ Failed to update lastActive:", err);
      }

      return response(200, { success: true, message: "Message sent", item });
    }

    /* ============================================================
       📬 POST /messages/mark-read
    ============================================================= */
    if (method === "POST" && (event.path || "").includes("mark-read")) {
      const { chatid, username } = body;
      if (!chatid || !username)
        return response(400, { success: false, message: "Missing chatid or username" });

      const now = new Date().toISOString();
      console.log("📨 Marking as read:", { chatid, username });

      await dynamodb
        .put({
          TableName: READ_TRACKING_TABLE,
          Item: { chatid, username, read: true, lastReadAt: now },
        })
        .promise();

      // 🕓 Update lastActive for reader too
      try {
        await dynamodb
          .update({
            TableName: MEMBERS_TABLE,
            Key: { userid: username },
            UpdateExpression: "SET lastActive = :ts",
            ExpressionAttributeValues: { ":ts": now },
          })
          .promise();
      } catch (err) {
        console.warn("⚠️ Failed to update lastActive on read:", err);
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
