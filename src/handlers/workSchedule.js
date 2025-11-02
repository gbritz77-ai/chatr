// src/handlers/workSchedule.js
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE || "chatr-members";
const JWT_SECRET = process.env.JWT_SECRET;

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,PUT",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  console.log("🕒 WorkSchedule Event:", JSON.stringify(event, null, 2));

  const method = event.httpMethod;
  const params = event.queryStringParameters || {};
  let body = {};

  try {
    if (event.body) body = JSON.parse(event.body);
  } catch {
    return response(400, { success: false, message: "Invalid JSON" });
  }

  if (method === "OPTIONS") return response(200, {});

  // 🧩 Try get user from token
  let requester = null;
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      requester = decoded.username || decoded.userid;
    } catch (err) {
      console.warn("⚠️ Invalid token:", err.message);
    }
  }

  try {
    /* ======================================================
       📄 GET /work-schedule?username=...
    ====================================================== */
    if (method === "GET") {
      const username = params.username || requester;
      if (!username)
        return response(400, { success: false, message: "Missing username" });

      const result = await dynamodb
        .get({
          TableName: TABLE_NAME,
          Key: { userid: username },
        })
        .promise();

      if (!result.Item)
        return response(404, { success: false, message: "User not found" });

      return response(200, {
        success: true,
        schedule: result.Item.workSchedule || null,
      });
    }

    /* ======================================================
       ✏️ PUT /work-schedule (self only)
    ====================================================== */
    if (method === "PUT") {
      const { userid, workSchedule } = body;

      if (!userid || !workSchedule)
        return response(400, {
          success: false,
          message: "Missing userid or workSchedule",
        });

      if (requester && requester !== userid)
        return response(403, {
          success: false,
          message: "You can only update your own schedule",
        });

      await dynamodb
        .update({
          TableName: TABLE_NAME,
          Key: { userid },
          UpdateExpression: "SET workSchedule = :ws",
          ExpressionAttributeValues: { ":ws": workSchedule },
        })
        .promise();

      return response(200, {
        success: true,
        message: "Work schedule saved",
      });
    }

    return response(405, { success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("❌ WorkSchedule error:", err);
    return response(500, { success: false, message: err.message });
  }
};
