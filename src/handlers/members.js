// src/handlers/members.js
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE || "chatr-members";

// ✅ Reusable HTTP response helper
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

exports.handler = async (event) => {
  console.log("👥 MEMBERS EVENT:", JSON.stringify(event));

  const method = event.httpMethod || "GET";

  // ✅ Handle CORS preflight
  if (method === "OPTIONS") {
    return response(200, { message: "CORS preflight success" });
  }

  try {
    /* ===========================================================
       📜 GET /members → List all members
    =========================================================== */
    if (method === "GET" && !event.pathParameters) {
      const result = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          // ✅ Fix reserved keyword 'role' using ExpressionAttributeNames
          ProjectionExpression:
            "userid, profileName, createdAt, lastLogin, #r",
          ExpressionAttributeNames: {
            "#r": "role",
          },
        })
        .promise();

      const members = (result.Items || []).map((m) => ({
        userid: m.userid,
        profileName: m.profileName || m.userid,
        createdAt: m.createdAt || null,
        lastLogin: m.lastLogin || null,
        role: m.role || "member",
      }));

      return response(200, { success: true, members });
    }

    /* ===========================================================
       🔍 GET /members/{userid} → Single member lookup
    =========================================================== */
    if (method === "GET" && event.pathParameters?.userid) {
      const userid = decodeURIComponent(event.pathParameters.userid);
      const result = await dynamodb
        .get({
          TableName: TABLE_NAME,
          Key: { userid },
        })
        .promise();

      if (!result.Item) {
        return response(404, {
          success: false,
          message: "Member not found",
        });
      }

      return response(200, {
        success: true,
        member: {
          userid: result.Item.userid,
          profileName: result.Item.profileName || result.Item.userid,
          createdAt: result.Item.createdAt || null,
          lastLogin: result.Item.lastLogin || null,
          role: result.Item.role || "member",
        },
      });
    }

    /* ===========================================================
       🚫 Unsupported method
    =========================================================== */
    return response(405, { success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("❌ MEMBERS HANDLER ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
