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
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
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

      let schedule = result.Item.workSchedule || null;

      // 🧠 Backward-compatibility: convert old format (start/end/days)
      if (schedule && schedule.start && schedule.end && Array.isArray(schedule.days)) {
        const newSched = {
          Mon: { start: "09:00", end: "17:00", enabled: false },
          Tue: { start: "09:00", end: "17:00", enabled: false },
          Wed: { start: "09:00", end: "17:00", enabled: false },
          Thu: { start: "09:00", end: "17:00", enabled: false },
          Fri: { start: "09:00", end: "17:00", enabled: false },
          Sat: { start: "", end: "", enabled: false },
          Sun: { start: "", end: "", enabled: false },
        };

        schedule.days.forEach((day) => {
          if (newSched[day]) {
            newSched[day] = { start: schedule.start, end: schedule.end, enabled: true };
          }
        });

        schedule = newSched;
      }

      // 🧩 Default fallback if user has no schedule yet
      if (!schedule) {
        schedule = {
          Mon: { start: "09:00", end: "17:00", enabled: true },
          Tue: { start: "09:00", end: "17:00", enabled: true },
          Wed: { start: "09:00", end: "17:00", enabled: true },
          Thu: { start: "09:00", end: "17:00", enabled: true },
          Fri: { start: "09:00", end: "17:00", enabled: true },
          Sat: { start: "", end: "", enabled: false },
          Sun: { start: "", end: "", enabled: false },
        };
      }

      return response(200, {
        success: true,
        schedule,
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

      // ✅ Sanitize schedule: ensure all 7 days exist
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const cleanSchedule = {};
      for (const d of days) {
        const v = workSchedule[d] || {};
        cleanSchedule[d] = {
          start: v.start || "",
          end: v.end || "",
          enabled: !!v.enabled,
        };
      }

      await dynamodb
        .update({
          TableName: TABLE_NAME,
          Key: { userid },
          UpdateExpression: "SET workSchedule = :ws",
          ExpressionAttributeValues: { ":ws": cleanSchedule },
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
