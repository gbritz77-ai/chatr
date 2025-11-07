// src/handlers/workSchedule.js
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
const { response } = require("../helpers/response"); // ✅ Shared CORS-safe helper

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE || "chatr-members";
const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

/* ======================================================
   🧠 Main Handler
====================================================== */
exports.handler = async (event) => {
  console.log("🕒 WorkSchedule Event:", JSON.stringify(event, null, 2));

  const method = (event.httpMethod || "GET").toUpperCase();
  const path = (event.path || "").toLowerCase();
  const params = event.queryStringParameters || {};
  let body = {};

  // ✅ Safely parse body
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch {
    return response(400, { success: false, message: "Invalid JSON body" });
  }

  // ✅ CORS preflight
  if (method === "OPTIONS") {
    return response(200, { message: "CORS preflight success" });
  }

  // ✅ Decode and verify JWT (optional)
  let requester = null;
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      requester = decoded.username || decoded.userid;
      console.log("🔑 Authenticated as:", requester);
    } catch (err) {
      console.warn("⚠️ Invalid token:", err.message);
    }
  }

  try {
    if (!TABLE_NAME) {
      console.error("❌ Missing MEMBERS_TABLE environment variable");
      return response(500, { success: false, message: "Server misconfiguration" });
    }

    /* ======================================================
       📄 GET /work-schedule?username=...
    ====================================================== */
    if (method === "GET" && path.endsWith("/work-schedule")) {
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

      // 🧠 Convert legacy format (start, end, days[])
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
            newSched[day] = {
              start: schedule.start,
              end: schedule.end,
              enabled: true,
            };
          }
        });

        schedule = newSched;
      }

      // 🧩 Default fallback
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

      console.log(`✅ Schedule retrieved for ${username}`);
      return response(200, { success: true, schedule });
    }

    /* ======================================================
       ✏️ PUT /work-schedule (update self)
    ====================================================== */
    if (method === "PUT" && path.endsWith("/work-schedule")) {
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

      // ✅ Normalize schedule
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

      console.log(`✅ Work schedule saved for ${userid}`);
      return response(200, { success: true, message: "Work schedule saved" });
    }

    /* ======================================================
       🚫 Unsupported route/method
    ====================================================== */
    console.warn("🚫 Unsupported route or method:", method, path);
    return response(405, { success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("❌ WorkSchedule ERROR:", err);
    return response(500, {
      success: false,
      message: err.message || "Internal server error",
      errorCode: err.code || "UnknownError",
    });
  }
};
