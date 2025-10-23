const AWS = require("aws-sdk");
const crypto = require("crypto");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MESSAGES_TABLE || "chatr-messages";

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

exports.handler = async (event) => {
  console.log("📩 Event received:", event);
  const method = event.httpMethod;
  const path = event.path || "";
  const params = event.queryStringParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    /* ===========================================================
       📨 POST /messages  → Send message
    =========================================================== */
    if (method === "POST" && path.endsWith("/messages")) {
      const { sender, recipient, text, groupid } = body;
      if (!sender || (!recipient && !groupid) || !text)
        return response(400, { success: false, message: "Missing fields" });

      const message = {
        messageid: crypto.randomUUID(),
        sender,
        recipient,
        groupid: groupid || null,
        text,
        read: false,
        timestamp: new Date().toISOString(),
      };

      await dynamodb.put({ TableName: TABLE_NAME, Item: message }).promise();
      return response(200, { success: true, data: message });
    }

    /* ===========================================================
       📬 GET /messages?userA=&userB=
       Returns conversation between 2 users
    =========================================================== */
    if (method === "GET" && params.userA && params.userB) {
      const { userA, userB } = params;
      const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();

      const messages =
        result.Items?.filter(
          (m) =>
            (m.sender === userA && m.recipient === userB) ||
            (m.sender === userB && m.recipient === userA)
        ) || [];

      // Sort ascending by time
      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return response(200, { success: true, messages });
    }

    /* ===========================================================
       🔢 GET /messages/unread-counts?username=
    =========================================================== */
    if (method === "GET" && path.endsWith("/messages/unread-counts")) {
      const username = params.username;
      if (!username)
        return response(400, { success: false, message: "username required" });

      const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();
      const unread = result.Items?.filter(
        (m) => m.recipient === username && !m.read
      ).length;

      return response(200, { success: true, unreadCount: unread });
    }

    /* ===========================================================
       ✅ POST /messages/mark-read
    =========================================================== */
    if (method === "POST" && path.endsWith("/messages/mark-read")) {
      const { username, chatWith } = body;
      if (!username || !chatWith)
        return response(400, {
          success: false,
          message: "username and chatWith required",
        });

      const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();
      const updates = result.Items?.filter(
        (m) => m.recipient === username && m.sender === chatWith && !m.read
      );

      if (!updates?.length)
        return response(200, { success: true, updated: 0 });

      for (const msg of updates) {
        await dynamodb
          .update({
            TableName: TABLE_NAME,
            Key: { messageid: msg.messageid },
            UpdateExpression: "set #r = :val",
            ExpressionAttributeNames: { "#r": "read" },
            ExpressionAttributeValues: { ":val": true },
          })
          .promise();
      }

      return response(200, { success: true, updated: updates.length });
    }

    /* ===========================================================
       ❌ Not supported
    =========================================================== */
    return response(404, { success: false, message: "Invalid path or method" });
  } catch (err) {
    console.error("❌ messages handler error:", err);
    return response(500, { success: false, message: err.message });
  }
};
