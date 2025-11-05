// src/handlers/messages.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MESSAGES_TABLE;
const GROUPS_TABLE = process.env.GROUPS_TABLE;

/* ============================================================
   ✅ Shared Response Helper (CORS Safe)
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
   🧩 Main Handler
============================================================ */
exports.handler = async (event) => {
  console.log("📩 Event received:", JSON.stringify(event, null, 2));

  try {
    const method = event.httpMethod;
    const params = event.queryStringParameters || {};

    // =====================================================
    // 📨 SEND MESSAGE
    // =====================================================
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

      await dynamodb
        .put({
          TableName: TABLE_NAME,
          Item: newItem,
        })
        .promise();

      console.log("✅ Message saved:", newItem);

      return response(200, { success: true, message: newItem });
    }

    // =====================================================
    // 📬 FETCH UNREAD COUNTS (Frontend calls this often)
    // =====================================================
    if (method === "GET" && event.path.includes("unread-counts")) {
      const { username } = params;

      if (!username)
        return response(400, { success: false, message: "Missing username" });

      // This is just a stub response. You can plug in your own logic.
      const result = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          FilterExpression: "#recipient = :username",
          ExpressionAttributeNames: { "#recipient": "recipient" },
          ExpressionAttributeValues: { ":username": username },
        })
        .promise();

      const unreadCount = result.Items ? result.Items.length : 0;
      console.log("📊 Unread messages:", unreadCount);

      return response(200, { success: true, unreadCount });
    }

    // =====================================================
    // 📬 DEFAULT GET
    // =====================================================
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
