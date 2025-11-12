import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE || "chatr-members";

/* ============================================================
   🧱 Response Helper — Always includes full CORS headers
============================================================ */
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE,PATCH",
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
  },
  body: JSON.stringify(body),
});

/* ============================================================
   🧩 Safe JSON Body Decoder
============================================================ */
const parseRequestBody = (event) => {
  if (!event?.body) return {};
  let rawBody = event.body;

  try {
    if (event.isBase64Encoded) {
      console.log("🟣 Base64 body detected — decoding...");
      rawBody = Buffer.from(rawBody, "base64").toString("utf8");
    }
    return JSON.parse(rawBody);
  } catch (err) {
    console.error("❌ JSON parse failed:", err);
    throw new Error("Invalid JSON format in request body");
  }
};

/* ============================================================
   👥 MEMBERS HANDLER (auth-style + hardened preflight)
============================================================ */
export const handler = async (event) => {
  try {
    console.log("🚀 MEMBERS HANDLER START ==================================");
    console.log("📩 Raw Event:", JSON.stringify(event, null, 2));

    // 🧩 Safe initialization (guards missing props)
    const requestId = event?.requestContext?.requestId || "N/A";
    const method = (event?.httpMethod || "GET").toUpperCase();
    const rawPath = event?.path || "";
    const params = event?.queryStringParameters || {};
    const pathUserId = event?.pathParameters?.userid;

    console.log(`➡️ METHOD=${method} | PATH=${rawPath} | PARAMS=${JSON.stringify(params)}`);

    // 🟡 Handle preflight *immediately*
    if (method === "OPTIONS") {
      console.log("🟡 OPTIONS request detected — returning 200 with CORS headers.");
      return response(200, { message: "CORS preflight OK" });
    }

    // 🧠 Decode body safely (even if not used)
    let body = {};
    try {
      body = parseRequestBody(event);
    } catch (err) {
      console.warn("⚠️ Invalid JSON body:", err.message);
      return response(400, { success: false, message: err.message });
    }

    // ✅ Verify environment
    if (!TABLE_NAME) {
      console.error("❌ Missing MEMBERS_TABLE env var");
      return response(500, { success: false, message: "Server misconfiguration" });
    }

    /* ============================================================
       📜 GET /members → List all members
    ============================================================= */
    const isListRequest =
      method === "GET" &&
      !pathUserId &&
      !params.userid &&
      (rawPath.endsWith("/members") ||
        rawPath.includes("/dev/members") ||
        rawPath === "/members");

    if (isListRequest) {
      console.log(`🔍 [SCAN] DynamoDB Table=${TABLE_NAME}`);
      const result = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          ProjectionExpression: "userid, profileName, createdAt, lastActive, #r",
          ExpressionAttributeNames: { "#r": "role" },
        })
        .promise();

      const members = (result.Items || []).map((m) => ({
        userid: m.userid,
        profileName: m.profileName || m.userid,
        createdAt: m.createdAt || null,
        lastActive: m.lastActive || null,
        role: m.role || "member",
      }));

      console.log(`✅ Found ${members.length} members`);
      return response(200, { success: true, members });
    }

    /* ============================================================
       🔍 GET /members/{userid} or /members?userid=
    ============================================================= */
    if (method === "GET" && (pathUserId || params.userid)) {
      const userid = decodeURIComponent(pathUserId || params.userid);
      console.log(`🔍 [GET] Member=${userid}`);

      const result = await dynamodb
        .get({
          TableName: TABLE_NAME,
          Key: { userid },
        })
        .promise();

      if (!result.Item) {
        console.warn(`⚠️ Member not found: ${userid}`);
        return response(404, { success: false, message: "Member not found" });
      }

      const member = {
        userid: result.Item.userid,
        profileName: result.Item.profileName || result.Item.userid,
        createdAt: result.Item.createdAt || null,
        lastActive: result.Item.lastActive || null,
        role: result.Item.role || "member",
        workSchedule: result.Item.workSchedule || null,
      };

      console.log(`✅ Member retrieved: ${userid}`);
      return response(200, { success: true, member });
    }

    /* ============================================================
       🚫 Unsupported Method
    ============================================================= */
    console.warn(`🚫 Unsupported method: ${method}`);
    return response(405, { success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("🔥 MEMBERS HANDLER ERROR:", err);
    return response(500, {
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
