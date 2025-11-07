// src/handlers/auth.js
const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

/* ============================================================
   🧱 Local Response Helper — guaranteed CORS headers
============================================================ */
const response = (statusCode, body = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    // ✅ Allow Amplify + localhost
    "Access-Control-Allow-Origin":
      process.env.CORS_ORIGIN ||
      "https://dev.d3rrkqgvvakfxn.amplifyapp.com",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE,PATCH",
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
  },
  body: JSON.stringify(body),
});

/* ============================================================
   🧩 Auth Handler
============================================================ */
exports.handler = async (event) => {
  console.log("📩 AUTH EVENT:", JSON.stringify(event, null, 2));

  const method = (event.httpMethod || "").toUpperCase();

  // ✅ Handle CORS preflight
  if (method === "OPTIONS") {
    return response(200, { message: "CORS preflight success" });
  }

  // ✅ Only allow POST
  if (method !== "POST") {
    return response(405, { success: false, error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { username, password } = body;

    if (!username || !password) {
      return response(400, { success: false, error: "Missing username or password" });
    }

    // 🔍 Fetch user from DynamoDB
    const result = await dynamodb
      .get({
        TableName: TABLE_NAME,
        Key: { userid: username.toLowerCase() },
      })
      .promise();

    const user = result.Item;
    if (!user) {
      return response(404, { success: false, error: "User not found" });
    }

    // 🔐 Verify password
    const storedHash = user.passwordHash || user.password;
    const valid = await bcrypt.compare(password, storedHash);
    if (!valid) {
      return response(401, { success: false, error: "Invalid credentials" });
    }

    // 🔑 Sign JWT
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });

    return response(200, {
      success: true,
      username,
      token,
      message: "Login successful",
    });
  } catch (err) {
    console.error("❌ AUTH ERROR:", err);
    return response(500, { success: false, error: "Internal server error" });
  }
};
