// src/handlers/typing.js
const AWS = require("aws-sdk");
const { response } = require("../helpers/response"); // ✅ shared CORS-safe helper

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TYPING_TABLE || "chatr-typing-status";
const MEMBERS_TABLE = process.env.MEMBERS_TABLE || "chatr-members";

/* ======================================================
   🧠 Main Handler
====================================================== */
exports.handler = async (event) => {
  console.log("⌨️ Typing Event:", JSON.stringify(event, null, 2));

  const method = (event.httpMethod || "GET").toUpperCase();
  const path = (event.path || "").toLowerCase();
  let body = {};

  // ✅ Handle malformed JSON safely
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch {
    return response(400, { success: false, message: "Invalid JSON body" });
  }

  // ✅ Handle CORS preflight
  if (method === "OPTIONS") {
    return response(200, { message: "CORS preflight success" });
  }

  try {
    if (!TABLE_NAME) {
      console.error("❌ Missing TYPING_TABLE environment variable");
      return response(500, { success: false, message: "Server misconfiguration" });
    }

    /* ======================================================
       🟢 POST /typing/start
    ====================================================== */
    if (method === "POST" && path.endsWith("/typing/start")) {
      const usernameRaw = body.username || body.user || "";
      const chatidRaw = body.chatid || body.chatId || body.chat || "";
      const username = usernameRaw.trim().toLowerCase();
      const chatid = chatidRaw.trim().toLowerCase();

      if (!username || !chatid) {
        console.warn("⚠️ Missing chatid or username:", { username, chatid });
        return response(400, { success: false, message: "Missing chatid or username" });
      }

      // 🧠 Ignore self-chat typing (e.g., CHAT#user#user)
      const parts = chatid.split("#");
      if (parts[1] && parts[1] === parts[2]) {
        console.log("🪶 Ignored self-chat typing event:", chatid);
        return response(200, { success: true, message: "Self-chat ignored" });
      }

      const now = Date.now();
      const ttlSeconds = 15; // auto-expire after 15 seconds
      const expiresAt = Math.floor(now / 1000) + ttlSeconds;

      await dynamodb
        .put({
          TableName: TABLE_NAME,
          Item: {
            chatid,
            username,
            typing: true,
            updatedAt: new Date(now).toISOString(),
            expiresAt, // TTL in epoch seconds
          },
        })
        .promise();

      // Optional: Update lastActive timestamp
      try {
        await dynamodb
          .update({
            TableName: MEMBERS_TABLE,
            Key: { userid: username },
            UpdateExpression: "SET lastActive = :ts",
            ExpressionAttributeValues: { ":ts": new Date(now).toISOString() },
          })
          .promise();
      } catch (err) {
        console.warn("⚠️ lastActive update failed:", err.message);
      }

      console.log(`✅ Typing started by ${username} in ${chatid}`);
      return response(200, { success: true, message: "Typing started" });
    }

    /* ======================================================
       🔴 POST /typing/stop
    ====================================================== */
    if (method === "POST" && path.endsWith("/typing/stop")) {
      const usernameRaw = body.username || body.user || "";
      const chatidRaw = body.chatid || body.chatId || body.chat || "";
      const username = usernameRaw.trim().toLowerCase();
      const chatid = chatidRaw.trim().toLowerCase();

      if (!username || !chatid) {
        console.warn("⚠️ Missing chatid or username for stop:", { username, chatid });
        return response(400, { success: false, message: "Missing chatid or username" });
      }

      await dynamodb
        .delete({
          TableName: TABLE_NAME,
          Key: { chatid, username },
        })
        .promise();

      console.log(`🛑 Typing stopped by ${username} in ${chatid}`);
      return response(200, { success: true, message: "Typing stopped" });
    }

    /* ======================================================
       👀 GET /typing?chatid=...
    ====================================================== */
    if (method === "GET" && path.endsWith("/typing")) {
      const chatidRaw =
        event.queryStringParameters?.chatid ||
        event.queryStringParameters?.chatId;
      const chatid = (chatidRaw || "").trim().toLowerCase();

      if (!chatid) {
        console.warn("⚠️ Missing chatid in query params");
        return response(400, { success: false, message: "Missing chatid" });
      }

      const result = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          FilterExpression: "chatid = :c",
          ExpressionAttributeValues: { ":c": chatid },
        })
        .promise();

      const usersTyping =
        result.Items?.filter((x) => x.typing)?.map((x) => x.username) || [];

      console.log(`👀 Active typers in ${chatid}:`, usersTyping);
      return response(200, { success: true, usersTyping });
    }

    /* ======================================================
       🚫 Unsupported route/method
    ====================================================== */
    console.warn("🚫 Unsupported typing route:", { method, path });
    return response(404, { success: false, message: "Invalid route or method" });
  } catch (err) {
    console.error("❌ Typing handler error:", err);
    return response(500, {
      success: false,
      message: err.message || "Internal server error",
      errorCode: err.code || "UnknownError",
    });
  }
};
