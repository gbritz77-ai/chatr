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
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,DELETE",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  console.log("⌨️ Typing event:", JSON.stringify(event, null, 2));
  const method = event.httpMethod || "GET";
  const path = event.path || "";
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
      const { username, chatid } = body;
      if (!username || !chatid)
        return response(400, { success: false, message: "Missing fields" });

      const now = Date.now();
      const ttlSeconds = 15; // ⏱ auto-expire after 15 s
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

      // Optional: mark user active
      try {
        await dynamodb
          .update({
            TableName: MEMBERS_TABLE,
            Key: { userid: username },
            UpdateExpression: "SET lastActive = :ts",
            ExpressionAttributeValues: { ":ts": new Date(now).toISOString() },
          })
          .promise();
      } catch (e) {
        console.warn("⚠️ lastActive update failed:", e);
      }

      return response(200, { success: true, message: "Typing started" });
    }

    /* ======================================================
       🔴 POST /typing/stop
    ====================================================== */
    if (method === "POST" && path.endsWith("/typing/stop")) {
      const { username, chatid } = body;
      if (!username || !chatid)
        return response(400, { success: false, message: "Missing fields" });

      await dynamodb
        .delete({ TableName: TABLE_NAME, Key: { chatid, username } })
        .promise();

      return response(200, { success: true, message: "Typing stopped" });
    }

    /* ======================================================
       👀 GET /typing?chatid=...
    ====================================================== */
    if (method === "GET" && path.endsWith("/typing")) {
      const chatid = event.queryStringParameters?.chatid;
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

    return response(404, { success: false, message: "Invalid route" });
  } catch (err) {
    console.error("❌ Typing handler error:", err);
    return response(500, { success: false, message: err.message });
  }
};
