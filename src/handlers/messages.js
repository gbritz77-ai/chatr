// src/handlers/messages.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MESSAGES_TABLE || "chatr-messages";
const GROUPS_TABLE = process.env.GROUPS_TABLE || "chatr-groups";

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  console.log("📩 Event received:", JSON.stringify(event, null, 2));

  try {
    const method = event.httpMethod;
    const rawPath = event.path || "";
    const params = event.queryStringParameters || {};

    // =====================================================
    // 📨 SEND MESSAGE
    // =====================================================
    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { sender, recipient, groupid, text } = body;

      if (!sender || (!recipient && !groupid) || !text) {
        return response(400, { success: false, message: "Missing fields" });
      }

      const messageid = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const item = {
        messageid,
        sender,
        recipient,
        groupid,
        text,
        read: false,
        timestamp,
      };

      await dynamodb
        .put({
          TableName: TABLE_NAME,
          Item: item,
        })
        .promise();

      return response(200, { success: true, message: item });
    }

    // =====================================================
    // 📬 UNREAD COUNTS (matches /messages/unread-counts)
    // =====================================================
    if (method === "GET" && rawPath.endsWith("/unread-counts")) {
      const username = params.username;
      if (!username)
        return response(400, { success: false, message: "Username required" });

      console.log("🔍 Calculating unread counts for:", username);

      const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();

      const unreadCount = result.Items?.filter(
        (m) => m.recipient === username && !m.read
      ).length || 0;

      return response(200, { success: true, unreadCount });
    }

    // =====================================================
    // 🗒️ DEFAULT: List all messages
    // =====================================================
    if (method === "GET") {
      const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();
      return response(200, { success: true, messages: result.Items || [] });
    }

    return response(405, { success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("❌ messages handler error:", err);
    return response(500, { success: false, message: err.message });
  }
};
