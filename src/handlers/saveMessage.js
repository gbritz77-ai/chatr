// src/handlers/saveMessages.js
const AWS = require("aws-sdk");
const { response } = require("../helpers/response"); // ✅ shared CORS-safe helper

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.DYNAMODB_TABLE || process.env.MESSAGES_TABLE || "chatr-messages";

/* ============================================================
   💬 SaveMessages Handler
============================================================ */
exports.handler = async (event) => {
  console.log("💬 SAVE MESSAGES EVENT:", JSON.stringify(event, null, 2));

  const method = (event.httpMethod || "POST").toUpperCase();

  // ✅ CORS preflight support
  if (method === "OPTIONS") {
    return response(200, { message: "CORS preflight success" });
  }

  // ✅ Only allow POST requests
  if (method !== "POST") {
    console.warn(`🚫 Unsupported method: ${method}`);
    return response(405, { success: false, message: "Method not allowed" });
  }

  try {
    // ✅ Parse incoming body safely
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return response(400, { success: false, message: "Invalid JSON body" });
    }

    const { chatId, sender, text, timestamp } = body;

    // ✅ Validate input
    if (!chatId || !sender || !text || !timestamp) {
      console.warn("⚠️ Missing required fields:", { chatId, sender, text, timestamp });
      return response(400, {
        success: false,
        message: "Missing required fields: chatId, sender, text, timestamp",
      });
    }

    // ✅ Prepare message item
    const item = {
      chatId: chatId.trim(),
      sender: sender.trim(),
      text: text.trim(),
      timestamp: timestamp.toString(),
      createdAt: new Date().toISOString(),
    };

    // ✅ Save message to DynamoDB
    await dynamodb
      .put({
        TableName: TABLE_NAME,
        Item: item,
      })
      .promise();

    console.log("✅ Message saved successfully:", item);

    return response(200, {
      success: true,
      message: "Message saved successfully",
      item,
    });
  } catch (err) {
    console.error("❌ SAVE MESSAGES ERROR:", err);
    return response(500, {
      success: false,
      message: err.message || "Internal server error",
      errorCode: err.code || "UnknownError",
    });
  }
};
