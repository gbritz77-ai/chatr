// src/handlers/typing.js
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TYPING_TABLE || "chatr-typing-status";
const MEMBERS_TABLE = process.env.MEMBERS_TABLE || "chatr-members";

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
  },
  body: JSON.stringify(body),
});

/* ======================================================
   🧠 Main Handler
====================================================== */
exports.handler = async (event) => {
  console.log("⌨️ Typing Event:", JSON.stringify(event, null, 2));
  const method = event.httpMethod || "GET";
  const path = (event.path || "").toLowerCase();
  let body = {};

  try {
    if (event.body) body = JSON.parse(event.body);
  } catch {
    return response(400, { success: false, message: "Invalid JSON body" });
  }

  if (method === "OPTIONS") return response(200, { message: "CORS OK" });

  try {
    /* ======================================================
       🟢 POST /typing/start
    ====================================================== */
    if (method === "POST" && path.endsWith("/typing/start")) {
      const usernameRaw = body.username || body.user || "";
      const chatidRaw = body.chatid || body.chatId || body.chat || "";
      const username = usernameRaw.toLowerCase();
      const chatid = chatidRaw.toLowerCase();

      if (!username || !chatid)
        return response(400, { success: false, message: "Missing chatid or username" });

      // 🧠 Ignore self-chat typing states like CHAT#user#user
      const parts = chatid.split("#");
      if (parts[1] && parts[1] === parts[2])
        return response(200, { success: true, message: "Self-chat ignored" });

      const now = Date.now();
      const ttlSeconds = 15; // expires automatically after 15s
      const expiresAt = Math.floor(now / 1000) + ttlSeconds;

      await dynamodb
        .put({
          TableName: TABLE_NAME,
          Item: {
            chatid,
            username,
            typing: true,
            updatedAt: new Date(now).toISOString(),
            expiresAt, // TTL attribute (epoch seconds)
          },
        })
        .promise();

      // Update member's lastActive time (optional)
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
        console.warn("⚠️ lastActive update failed:", err);
      }

      return response(200, { success: true, message: "Typing started" });
    }

    /* ======================================================
       🔴 POST /typing/stop
    ====================================================== */
    if (method === "POST" && path.endsWith("/typing/stop")) {
      const usernameRaw = body.username || body.user || "";
      const chatidRaw = body.chatid || body.chatId || body.chat || "";
      const username = usernameRaw.toLowerCase();
      const chatid = chatidRaw.toLowerCase();

      if (!username || !chatid)
        return response(400, { success: false, message: "Missing chatid or username" });

      await dynamodb
        .delete({
          TableName: TABLE_NAME,
          Key: { chatid, username },
        })
        .promise();

      return response(200, { success: true, message: "Typing stopped" });
    }

    /* ======================================================
       👀 GET /typing?chatid=...
    ====================================================== */
    if (method === "GET" && path.endsWith("/typing")) {
      const chatidRaw = event.queryStringParameters?.chatid || event.queryStringParameters?.chatId;
      const chatid = (chatidRaw || "").toLowerCase();

      if (!chatid)
        return response(400, { success: false, message: "Missing chatid" });

      const result = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          FilterExpression: "chatid = :c",
          ExpressionAttributeValues: { ":c": chatid },
        })
        .promise();

      const usersTyping =
        result.Items?.filter((x) => x.typing)?.map((x) => x.username) || [];

      return response(200, { success: true, usersTyping });
    }

    /* ======================================================
       🚫 Fallback
    ====================================================== */
    return response(404, { success: false, message: "Invalid route" });
  } catch (err) {
    console.error("❌ Typing handler error:", err);
    return response(500, { success: false, message: err.message });
  }
};
