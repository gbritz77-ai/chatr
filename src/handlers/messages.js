// src/handlers/messages.js
import AWS from "aws-sdk";
const dynamodb = new AWS.DynamoDB.DocumentClient();

const MESSAGES_TABLE = process.env.MESSAGES_TABLE || "chatr-messages";
const READ_TABLE = process.env.READ_TRACKING_TABLE || "chatr-read-tracking";

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  console.log("📨 Event received:", event.path, event.httpMethod);

  const method = event.httpMethod;
  const path = event.path;
  const params = event.queryStringParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // =====================================================
    // 📨 SEND MESSAGE
    // =====================================================
    if (method === "POST" && !path.includes("mark-read")) {
      const { sender, recipient, groupid, text, attachmentKey, attachmentType } = body;
      if (!sender || (!recipient && !groupid))
        return response(400, { error: "Missing sender or recipient/groupid" });

      const messageid = `MSG#${Date.now()}#${Math.random().toString(36).slice(2)}`;
      const createdAt = new Date().toISOString();
      const item = {
        messageid,
        sender,
        text,
        createdAt,
        ...(recipient ? { recipient } : {}),
        ...(groupid ? { groupid } : {}),
        ...(attachmentKey ? { attachmentKey, attachmentType } : {}),
      };

      await dynamodb.put({ TableName: MESSAGES_TABLE, Item: item }).promise();
      console.log("✅ Message saved:", item);

      return response(200, { success: true, data: item });
    }

    // =====================================================
    // ✅ MARK CHAT AS READ
    // =====================================================
    if (method === "POST" && path.includes("mark-read")) {
      console.log("📘 mark-read triggered");
      const { chatId, username } = body;
      if (!chatId || !username)
        return response(400, { error: "chatId and username are required" });

      const timestamp = new Date().toISOString();
      const putParams = {
        TableName: READ_TABLE,
        Item: {
          chatid: chatId,
          username,
          lastReadTimestamp: timestamp,
        },
      };

      console.log("🪶 Writing to read-tracking:", putParams);
      await dynamodb.put(putParams).promise();
      console.log("✅ Read-tracking record saved");

      return response(200, { success: true, chatId, username, timestamp });
    }

    // =====================================================
    // 📊 GET UNREAD COUNTS
    // =====================================================
    if (method === "GET" && path.includes("unread-counts")) {
      const username = params.username;
      if (!username) return response(400, { error: "username required" });

      console.log("📊 Calculating unread counts for:", username);

      // Fetch all read markers for this user
      const readData = await dynamodb
        .scan({
          TableName: READ_TABLE,
          FilterExpression: "#u = :username",
          ExpressionAttributeNames: { "#u": "username" },
          ExpressionAttributeValues: { ":username": username },
        })
        .promise();

      const readMap = {};
      for (const item of readData.Items) {
        readMap[item.chatid] = item.lastReadTimestamp;
      }

      // Scan all messages (in production, this would be optimized by indexes)
      const allMsgs = await dynamodb.scan({ TableName: MESSAGES_TABLE }).promise();
      const unreadMap = {};

      for (const msg of allMsgs.Items) {
        const isDirect = msg.recipient && [msg.recipient, msg.sender].includes(username);
        const isGroup = msg.groupid;

        if (!isDirect && !isGroup) continue;

        const chatId = isGroup
          ? msg.groupid
          : `CHAT#${[msg.sender, msg.recipient].sort().join("#")}`;

        const lastRead = readMap[chatId];
        if (!lastRead || new Date(msg.createdAt) > new Date(lastRead)) {
          unreadMap[chatId] = (unreadMap[chatId] || 0) + 1;
        }
      }

      const unreadArray = Object.entries(unreadMap).map(([chatId, unreadCount]) => ({
        chatId,
        unreadCount,
      }));

      console.log("📬 Unread summary:", unreadArray);
      return response(200, unreadArray);
    }

    // =====================================================
    // 📨 LOAD MESSAGES
    // =====================================================
    if (method === "GET") {
      const { userA, userB, groupid } = params;
      let items = [];

      if (groupid) {
        const res = await dynamodb
          .scan({
            TableName: MESSAGES_TABLE,
            FilterExpression: "#g = :g",
            ExpressionAttributeNames: { "#g": "groupid" },
            ExpressionAttributeValues: { ":g": groupid },
          })
          .promise();
        items = res.Items || [];
      } else if (userA && userB) {
        const res = await dynamodb
          .scan({
            TableName: MESSAGES_TABLE,
            FilterExpression:
              "(#s = :userA AND #r = :userB) OR (#s = :userB AND #r = :userA)",
            ExpressionAttributeNames: { "#s": "sender", "#r": "recipient" },
            ExpressionAttributeValues: { ":userA": userA, ":userB": userB },
          })
          .promise();
        items = res.Items || [];
      }

      items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return response(200, { success: true, data: items });
    }

    // =====================================================
    // Default
    // =====================================================
    return response(404, { error: "Route not found" });
  } catch (err) {
    console.error("❌ Handler failed:", err);
    return response(500, { error: err.message });
  }
};
