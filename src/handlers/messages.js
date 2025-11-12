import AWS from "aws-sdk";
import crypto from "crypto";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MESSAGES_TABLE || "chatr-messages";

/* ============================================================
   🧱 Response Helper (Always Includes CORS)
============================================================ */
const response = (statusCode, body = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE,PATCH",
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
  },
  body: JSON.stringify(body),
});

/* ============================================================
   🪵 Structured Logger (CloudWatch Friendly)
============================================================ */
const log = (level, message, data = {}) => {
  const logObject = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...data,
  };
  console.log(JSON.stringify(logObject, null, 2));
};

/* ============================================================
   💬 MAIN MESSAGES HANDLER
============================================================ */
export const handler = async (event) => {
  const requestId = event.requestContext?.requestId || "N/A";
  const method = (event.httpMethod || "GET").toUpperCase();
  const query = event.queryStringParameters || {};

  console.log("============================================================");
  console.log(`🚀 START MESSAGES HANDLER [${method}]`);
  console.log("📦 RAW EVENT:", JSON.stringify(event, null, 2));

  // ✅ Handle CORS Preflight
  if (method === "OPTIONS") {
    console.log("🟡 OPTIONS preflight received — returning CORS 200");
    return response(200, { message: "CORS preflight OK" });
  }

  try {
    if (!TABLE_NAME) {
      console.error("❌ Missing MESSAGES_TABLE environment variable");
      return response(500, { success: false, message: "Server misconfiguration" });
    }

    /* ============================================================
   🟢 POST /messages — Save a message
============================================================ */
if (method === "POST") {
  console.log("📨 Incoming POST /messages request");

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
    console.log("✅ Parsed request body:", JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("❌ JSON parsing failed:", err.message);
    return response(400, {
      success: false,
      message: "Invalid JSON format in request body",
    });
  }

  // keep the same field names your frontend sends
  const {
    sender,
    recipient,
    groupid,
    text,
    chatId,
    attachmentUrl,   // legacy
    attachmentKey,   // new
    attachmentType,  // new
    timestamp,       // new
  } = body;

  // ✅ ORIGINAL validation logic (don’t touch)
  if (!sender || (!recipient && !groupid && !chatId) || !text?.trim()) {
    console.warn("⚠️ Missing required fields", { body });
    return response(400, {
      success: false,
      message:
        "Missing required fields: sender, recipient/groupid/chatId, or text",
    });
  }

  const messageid = crypto.randomUUID();
  const createdAt = timestamp || new Date().toISOString();
  const finalChatId = chatId || `CHAT#${sender}#${recipient || groupid}`;

  const newItem = {
    messageid,
    chatId: finalChatId,
    sender,
    recipient: recipient || null,
    groupid: groupid || null,
    text: text.trim(),
    timestamp: createdAt,
    createdAt,
    attachmentUrl: attachmentUrl || null,
    attachmentKey: attachmentKey || null,
    attachmentType: attachmentType || null,
  };

  console.log("📝 New item prepared for DynamoDB:", JSON.stringify(newItem, null, 2));

  try {
    await dynamodb.put({ TableName: TABLE_NAME, Item: newItem }).promise();
    console.log("✅ DynamoDB PUT succeeded", { messageid, chatId: finalChatId });
  } catch (dbErr) {
    console.error("🔥 DynamoDB PUT failed:", dbErr);
    return response(500, {
      success: false,
      message: "Failed to save message",
      error: dbErr,
    });
  }

  return response(200, {
    success: true,
    message: "Message saved successfully",
    item: newItem,
  });
}


    /* ============================================================
       📬 GET /messages — Retrieve by chatId
    ============================================================= */
    if (method === "GET") {
      const chatId = query.chatId ? decodeURIComponent(query.chatId) : null;
      const limit = Number(query.limit) || 50;
      const lastKey = query.lastKey ? JSON.parse(decodeURIComponent(query.lastKey)) : null;

      console.log("🔎 Query params parsed:", { chatId, limit, lastKey });

      if (!chatId) {
        console.log("⚠️ No chatId provided — scanning all");
      }

      const params = {
        TableName: TABLE_NAME,
        FilterExpression: chatId ? "chatId = :cid" : undefined,
        ExpressionAttributeValues: chatId ? { ":cid": chatId } : undefined,
        Limit: limit,
        ExclusiveStartKey: lastKey || undefined,
      };

      console.log("📦 DynamoDB scan params:", JSON.stringify(params, null, 2));

      try {
        const result = await dynamodb.scan(params).promise();
        const sorted = (result.Items || []).sort((a, b) =>
          (a.timestamp || "").localeCompare(b.timestamp || "")
        );

        console.log("✅ DynamoDB scan complete — items:", sorted.length);
        return response(200, {
          success: true,
          chatId,
          items: sorted,
          lastKey: result.LastEvaluatedKey
            ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey))
            : null,
        });
      } catch (dbErr) {
        console.error("🔥 DynamoDB scan failed:", dbErr);
        return response(500, { success: false, message: "Failed to fetch messages", error: dbErr });
      }
    }

    /* ============================================================
       🚫 Unsupported Methods
    ============================================================= */
    console.warn("🚫 Unsupported method:", method);
    return response(405, { success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("🔥 UNHANDLED EXCEPTION:", { error: err.message, stack: err.stack });
    return response(500, { success: false, message: err.message || "Internal server error" });
  } finally {
    console.log("🏁 END MESSAGES HANDLER", { requestId });
    console.log("============================================================");
  }
};
