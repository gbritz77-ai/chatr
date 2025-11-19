import AWS from "aws-sdk";
import { response } from "../helpers/response.js";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const READ_TABLE = process.env.READ_TRACKING_TABLE;

export const handler = async (event) => {
  const username = event.queryStringParameters?.username;
  if (!username) {
    return response(400, { success: false, message: "Missing username" });
  }

  try {
    // 1️⃣ Get all chats this user participates in
    const readRes = await dynamodb.query({
      TableName: READ_TABLE,
      KeyConditionExpression: "userid = :u",
      ExpressionAttributeValues: {
        ":u": username
      }
    }).promise();

    const chats = readRes.Items || [];

    let counts = {};

    // 2️⃣ Loop through each chat
    for (const chat of chats) {
      const chatId = chat.chatId;
      const lastReadAt = chat.lastReadAt || "1970-01-01T00:00:00Z";

      // 3️⃣ Count messages newer than lastReadAt
      const msgRes = await dynamodb.query({
        TableName: MESSAGES_TABLE,
        IndexName: "chatId-createdAt-index",
        KeyConditionExpression: "chatId = :c AND createdAt > :t",
        ExpressionAttributeValues: {
          ":c": chatId,
          ":t": lastReadAt
        }
      }).promise();

      counts[chatId] = msgRes.Count;
    }

    return response(200, { success: true, counts });

  } catch (err) {
    console.error("Unread count error:", err);
    return response(500, { success: false, message: err.message });
  }
};
