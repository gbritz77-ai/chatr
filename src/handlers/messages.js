// src/handlers/messages.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MESSAGES_TABLE;

/* ============================================================
   ✅ Shared Response Helper (CORS Safe)
============================================================ */
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
  },
  body: JSON.stringify(body),
});


/* ============================================================
   🧩 Main Handler
============================================================ */
exports.handler = async (event) => {
  console.log("📩 Event received:", JSON.stringify(event, null, 2));

  const method = event.httpMethod || "GET";
  const path = event.path || "";
  const params = event.queryStringParameters || {};

  try {
    // ----------------------------------------------------------
    // 🧠 Handle Preflight (CORS OPTIONS)
    // ----------------------------------------------------------
    if (method === "OPTIONS") {
      return response(200, { success: true, message: "CORS preflight OK" });
    }

    // ----------------------------------------------------------
    // 📨 POST: Send a new message
    // ----------------------------------------------------------
    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { sender, recipient, groupid, text, attachmentUrl } = body;

      if (!sender || (!recipient && !groupid) || !text) {
        return response(400, { success: false, message: "Missing fields" });
      }

      const messageId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const newItem = {
        messageid: messageId,
        sender,
        recipient: recipient || null,
        groupid: groupid || null,
        text,
        attachmentUrl: attachmentUrl || null,
        createdAt: timestamp,
      };

      await dynamodb.put({ TableName: TABLE_NAME, Item: newItem }).promise();
      console.log("✅ Message saved:", newItem);
      return response(200, { success: true, message: newItem });
    }

    // ----------------------------------------------------------
    // 📬 GET: Unread counts
    // ----------------------------------------------------------
    if (method === "GET" && path.endsWith("/unread-counts")) {
      const username = params.username;
      if (!username) return response(400, { success: false, message: "Missing username" });

      console.log("🔍 Fetching unread counts for:", username);

      // Temporary dummy data
      const unreadCount = 0;
      return response(200, { success: true, username, unreadCount });
    }

    // ----------------------------------------------------------
    // 📚 GET: All messages (default)
    // ----------------------------------------------------------
    if (method === "GET") {
      const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();
      return response(200, { success: true, items: result.Items });
    }

    return response(405, { success: false, message: `Unsupported method: ${method}` });
  } catch (err) {
    console.error("❌ MESSAGES ERROR:", err);
    return response(500, { success: false, error: err.message });
  }
};
