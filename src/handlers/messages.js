// src/handlers/messages.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MESSAGES_TABLE;

/* ============================================================
   🧱 Universal Response Helper (local CORS-safe version)
   This guarantees CORS headers even if shared helper fails
============================================================ */
const response = (statusCode, body = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    // ✅ Explicitly allow Amplify + localhost (and wildcard fallback)
    "Access-Control-Allow-Origin": "https://dev.d3rrkqgvvakfxn.amplifyapp.com",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE,PATCH",
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
  },
  body: JSON.stringify(body),
});

/* ============================================================
   🧩 Main Handler
============================================================ */
exports.handler = async (event) => {
  console.log("📩 MESSAGES EVENT:", JSON.stringify(event, null, 2));

  const method = (event.httpMethod || "GET").toUpperCase();
  const path = (event.path || "").toLowerCase();
  const params = event.queryStringParameters || {};

  // ✅ Handle CORS preflight
  if (method === "OPTIONS") {
    return response(200, { message: "CORS preflight success" });
  }

  try {
    if (!TABLE_NAME) {
      console.error("❌ MESSAGES ERROR: Missing MESSAGES_TABLE env var");
      return response(500, { success: false, message: "Server misconfiguration" });
    }

    /* ============================================================
       📨 POST /messages — Send a new message
    ============================================================= */
    if (method === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, { success: false, message: "Invalid JSON body" });
      }

      const { sender, recipient, groupid, text, attachmentUrl } = body;
      if (!sender || (!recipient && !groupid) || !text) {
        return response(400, {
          success: false,
          message: "Missing required fields: sender, recipient/groupid, or text",
        });
      }

      const messageid = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const newItem = {
        messageid,
        sender,
        recipient: recipient || null,
        groupid: groupid || null,
        text,
        attachmentUrl: attachmentUrl || null,
        createdAt,
      };

      await dynamodb.put({ TableName: TABLE_NAME, Item: newItem }).promise();
      console.log("✅ Message saved:", newItem);
      return response(200, { success: true, message: newItem });
    }

    /* ============================================================
       📬 GET /messages/unread-counts?username=<user>
    ============================================================= */
    if (method === "GET" && path.endsWith("/unread-counts")) {
      const username = params.username;
      if (!username)
        return response(400, { success: false, message: "Missing username" });

      console.log("🔍 Fetching unread counts for:", username);

      // TODO: replace with actual unread logic
      const result = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          FilterExpression: "attribute_not_exists(read)",
        })
        .promise();

      const unreadCount = result.Items?.length || 0;
      return response(200, { success: true, username, unreadCount });
    }

    /* ============================================================
       📚 GET /messages — Get all messages
    ============================================================= */
    if (method === "GET") {
      const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();
      console.log(`✅ Retrieved ${result.Items?.length || 0} messages`);
      return response(200, { success: true, items: result.Items || [] });
    }

    /* ============================================================
       🚫 Unsupported
    ============================================================= */
    console.warn("🚫 Unsupported method:", method, "Path:", path);
    return response(405, { success: false, message: "Unsupported method" });
  } catch (err) {
    console.error("❌ MESSAGES ERROR:", err);
    // ✅ Always return headers, even for errors
    return response(500, {
      success: false,
      message: err.message || "Internal server error",
      errorCode: err.code || "UnknownError",
    });
  }
};
