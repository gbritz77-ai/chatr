// src/handlers/auth.js
const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// DynamoDB client
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET;

/* ============================================================
   ✅ Shared Response Helper (CORS Safe)
============================================================ */
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

/* ============================================================
   🧠 Helper Functions
============================================================ */
function signToken(payload) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET not configured");
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET not configured");
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/* ============================================================
   🔐 Main Handler
============================================================ */
exports.handler = async (event) => {
  console.log("📩 AUTH EVENT:", JSON.stringify(event, null, 2));

  try {
    // Parse body
    const body = JSON.parse(event.body || "{}");
    const { username, password } = body;

    if (!username || !password)
      return response(400, { success: false, message: "Missing credentials" });

    const email = username.trim().toLowerCase();

    // Fetch user from DynamoDB
    const result = await dynamodb
      .get({
        TableName: TABLE_NAME,
        Key: { userid: email },
      })
      .promise();

    const user = result.Item;
    if (!user)
      return response(404, { success: false, message: "User not found" });

    // Validate password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return response(401, { success: false, message: "Invalid password" });

    // Generate token
    const token = signToken({ userid: user.userid, profileName: user.profileName });

    // ✅ Return success
    return response(200, {
      success: true,
      token,
      profileName: user.profileName,
      userid: user.userid,
    });
  } catch (err) {
    console.error("❌ AUTH ERROR:", err);
    return response(500, { success: false, error: err.message });
  }
};

/* ============================================================
   ✅ Exports for reuse
============================================================ */
module.exports = { handler: exports.handler, signToken, verifyToken };
