// src/handlers/messages.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

const TABLE_NAME = process.env.MESSAGES_TABLE || "chatr-messages";
const MEMBERS_TABLE = process.env.MEMBERS_TABLE || "chatr-members";
const ATTACHMENTS_BUCKET = process.env.ATTACHMENTS_BUCKET || "outsec-chat-bucket";

/* ===========================================================
   🔧 Common JSON Response Helper
=========================================================== */
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

/* ===========================================================
   🧩 Helper: Get Profile Name
=========================================================== */
async function getProfileName(userid) {
  try {
    const res = await dynamodb
      .get({
        TableName: MEMBERS_TABLE,
        Key: { userid },
        ProjectionExpression: "profileName",
      })
      .promise();
    return res.Item?.profileName || userid;
  } catch (err) {
    console.error("⚠️ Failed to get profile name for", userid, err);
    return userid;
  }
}

/* ===========================================================
   🧩 Helper: Generate Pre-Signed S3 URL
=========================================================== */
async function getSignedUrl(key) {
  try {
    return await s3.getSignedUrlPromise("getObject", {
      Bucket: ATTACHMENTS_BUCKET,
      Key: key,
      Expires: 60 * 10, // 10 minutes
    });
  } catch (err) {
    console.error("⚠️ Failed to sign S3 URL for", key, err);
    return null;
  }
}

/* ===========================================================
   🧩 Helper: Build Chat ID (UserA <-> UserB)
=========================================================== */
function buildChatId(userA, userB) {
  return [userA, userB].sort().join("#");
}

/* ===========================================================
   🧠 MAIN HANDLER
=========================================================== */
exports.handler = async (event) => {
  console.log("📩 Event received:", event);
  const method = event.httpMethod;
  const rawPath = event.path || "";
  const path = rawPath.toLowerCase();
  const params = event.queryStringParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    /* ===========================================================
       📨 POST /messages  → Send message
    =========================================================== */
    if (method === "POST" && path.endsWith("/messages")) {
      const {
        sender,
        recipient,
        text,
        groupid,
        attachmentKey,
        attachmentType,
      } = body;

      if (!sender || (!recipient && !groupid))
        return response(400, {
          success: false,
          message: "Missing sender or target",
        });

      if (!text && !attachmentKey)
        return response(400, {
          success: false,
          message: "Missing text or attachment",
        });

      const message = {
        messageid: crypto.randomUUID(),
        sender,
        recipient: recipient || null,
        groupid: groupid || null,
        chatId: recipient ? buildChatId(sender, recipient) : groupid,
        text: text || "",
        attachmentKey: attachmentKey || null,
        attachmentType: attachmentType || null,
        read: false,
        timestamp: new Date().toISOString(),
      };

      console.log("💾 Saving message:", message);
      await dynamodb.put({ TableName: TABLE_NAME, Item: message }).promise();

      return response(200, { success: true, data: message });
    }

    /* ===========================================================
       💬 GET /messages?userA=&userB=
    =========================================================== */
    if (method === "GET" && params.userA && params.userB) {
      const { userA, userB } = params;
      const chatId = buildChatId(userA, userB);

      const result = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          FilterExpression: "chatId = :cid",
          ExpressionAttributeValues: { ":cid": chatId },
        })
        .promise();

      const messages = result.Items || [];
      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      for (const msg of messages) {
        msg.senderProfileName = await getProfileName(msg.sender);
        if (msg.attachmentKey) {
          msg.attachmentUrl = await getSignedUrl(msg.attachmentKey);
        }
      }

      return response(200, { success: true, messages });
    }

    /* ===========================================================
       👥 GET /messages?groupid=
    =========================================================== */
    if (method === "GET" && params.groupid) {
      const { groupid } = params;

      const result = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          FilterExpression: "groupid = :gid",
          ExpressionAttributeValues: { ":gid": groupid },
        })
        .promise();

      const messages = result.Items || [];
      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      for (const msg of messages) {
        msg.senderProfileName = await getProfileName(msg.sender);
        if (msg.attachmentKey) {
          msg.attachmentUrl = await getSignedUrl(msg.attachmentKey);
        }
      }

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

      return response(200, { success: true, unreadCount: unread || 0 });
    }

    /* ===========================================================
       ✅ POST /messages/mark-read
    =========================================================== */
    if (method === "POST" && path.endsWith("/messages/mark-read")) {
      const { username, chatId } = body;
      if (!username || !chatId)
        return response(400, {
          success: false,
          message: "username and chatId required",
        });

      const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();
      const unreadMessages =
        result.Items?.filter(
          (m) =>
            !m.read &&
            ((m.recipient === username && m.chatId === chatId) ||
              (m.groupid && m.groupid === chatId))
        ) || [];

      for (const msg of unreadMessages) {
        await dynamodb
          .update({
            TableName: TABLE_NAME,
            Key: { messageid: msg.messageid },
            UpdateExpression: "SET #r = :val",
            ExpressionAttributeNames: { "#r": "read" },
            ExpressionAttributeValues: { ":val": true },
          })
          .promise();
      }

      return response(200, {
        success: true,
        updated: unreadMessages.length,
      });
    }

    /* ===========================================================
       ❌ Invalid path
    =========================================================== */
    return response(404, { success: false, message: "Invalid path or method" });
  } catch (err) {
    console.error("❌ messages handler error:", err);
    return response(500, { success: false, message: err.message });
  }
};
