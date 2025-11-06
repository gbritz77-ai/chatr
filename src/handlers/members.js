// src/handlers/members.js
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE || "chatr-members";

/* ===========================================================
   🧩 Response Helper
=========================================================== */
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
  },
  body: JSON.stringify(body),
});


/* ===========================================================
   🧠 Main Handler
=========================================================== */
exports.handler = async (event) => {
  console.log("👥 MEMBERS EVENT:", JSON.stringify(event, null, 2));

  const method = event.httpMethod || "GET";
  const rawPath = event.path || "";
  const params = event.queryStringParameters || {};
  const pathUserId = event.pathParameters?.userid;
  console.log("➡️ Method:", method, "| Path:", rawPath, "| Params:", params);

  // ✅ Handle CORS preflight
  if (method === "OPTIONS") {
    return response(200, { message: "CORS preflight success" });
  }

  try {
    /* ===========================================================
       📜 GET /members → List all members
    =========================================================== */
    const isListRequest =
      method === "GET" &&
      (!pathUserId && !params.userid) &&
      (rawPath.endsWith("/members") ||
        rawPath.includes("/dev/members") ||
        rawPath === "/members");

    if (isListRequest) {
      console.log("🔍 Fetching all members from:", TABLE_NAME);

      const result = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          ProjectionExpression:
            "userid, profileName, createdAt, lastLogin, #r",
          ExpressionAttributeNames: { "#r": "role" },
        })
        .promise();

      const members = (result.Items || []).map((m) => ({
        userid: m.userid,
        profileName: m.profileName || m.userid,
        createdAt: m.createdAt || null,
        lastLogin: m.lastLogin || null,
        role: m.role || "member",
      }));

      console.log(`✅ Found ${members.length} members`);
      if (members.length === 0)
        console.warn("⚠️ No members found in DynamoDB table:", TABLE_NAME);

      return response(200, { success: true, members });
    }

    /* ===========================================================
       🔍 GET /members/{userid} or /members?userid=
    =========================================================== */
    if (method === "GET" && (pathUserId || params.userid)) {
      const userid = decodeURIComponent(pathUserId || params.userid);
      console.log("🔍 Fetching single member:", userid);

      const result = await dynamodb
        .get({
          TableName: TABLE_NAME,
          Key: { userid },
        })
        .promise();

      if (!result.Item) {
        console.warn("⚠️ Member not found:", userid);
        return response(404, { success: false, message: "Member not found" });
      }

      const member = {
        userid: result.Item.userid,
        profileName: result.Item.profileName || result.Item.userid,
        createdAt: result.Item.createdAt || null,
        lastLogin: result.Item.lastLogin || null,
        role: result.Item.role || "member",
      };

      return response(200, { success: true, member });
    }

    /* ===========================================================
       🚫 Unsupported Method / Path
    =========================================================== */
    console.warn("🚫 Unsupported method or path:", method, rawPath);
    return response(405, { success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("❌ MEMBERS HANDLER ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
