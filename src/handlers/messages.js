// src/handlers/messages.js
import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MESSAGES_TABLE || "chatr-messages";

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
   🧩 Chat ID Normalizer
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
export const handler = async (event) => {
  console.log("💬 MESSAGES EVENT:", JSON.stringify(event, null, 2));

  const method = event.httpMethod || "GET";
  const params = event.queryStringParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};

  // ✅ Handle CORS
  if (method === "OPTIONS") return response(200, { message: "CORS preflight success" });

  try {
    /* ============================================================
       📜 GET /messages?chatId=...
    ============================================================= */
    if (method === "GET") {
      if (params.chatId) {
        const chatId = decodeURIComponent(params.chatId);
        console.log("🧩 Fetching messages for chatId:", chatId);

        const result = await dynamodb
          .query({
            TableName: TABLE_NAME,
            KeyConditionExpression: "chatId = :chatId",
            ExpressionAttributeValues: { ":chatId": chatId },
            ScanIndexForward: true, // chronological
          })
          .promise();

        return response(200, { success: true, messages: result.Items || [] });
      }

      // 🧩 Fallback for groups
      if (params.groupid) {
        const result = await dynamodb
          .query({
            TableName: TABLE_NAME,
            KeyConditionExpression: "chatId = :gid",
            ExpressionAttributeValues: { ":gid": `GROUP#${params.groupid}` },
            ScanIndexForward: true,
          })
          .promise();

        return response(200, { success: true, messages: result.Items || [] });
      }

      return response(400, { success: false, message: "Missing chatId or groupid" });
    }

    /* ============================================================
       ✉️ POST /messages → Send Message
    ============================================================= */
    if (method === "POST") {
      const { sender, recipient, groupid, text, attachmentKey, attachmentType } = body;
      if (!sender) return response(400, { success: false, message: "Missing sender" });

      const timestamp = new Date().toISOString();
      const messageid = `${sender}#${timestamp}`;

      const chatId = groupid
        ? `GROUP#${groupid}`
        : getChatId(sender, recipient);

      const item = {
        chatId,
        messageid,
        sender,
        recipient: recipient || null,
        text: text || "",
        timestamp,
        attachmentKey: attachmentKey || null,
        attachmentType: attachmentType || null,
      };

      console.log("💾 Saving message:", item);

      await dynamodb
        .put({
          TableName: TABLE_NAME,
          Item: item,
        })
        .promise();

      return response(200, { success: true, message: "Message sent", item });
    }

    /* ============================================================
       📬 POST /messages/mark-read
    ============================================================= */
    if (method === "POST" && event.path.endsWith("/mark-read")) {
      const { chatId, username } = body;
      console.log("📨 Marking messages read for:", chatId, username);
      // you can extend this to update a read-tracking table
      return response(200, { success: true, message: "Marked as read" });
    }

    /* ============================================================
       🚫 Unsupported
    ============================================================= */
    return response(405, { success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("❌ MESSAGES HANDLER ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
