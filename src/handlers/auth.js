// src/handlers/auth.js
const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

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


exports.handler = async (event) => {
  console.log("📩 AUTH EVENT:", JSON.stringify(event, null, 2));

  // Always safely normalize method
  const method = (event.httpMethod || "").toUpperCase();
  if (method !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { username, password } = body;

    if (!username || !password)
      return response(400, { error: "Missing username or password" });

    // 🔍 Fetch user from DynamoDB
    const userResult = await dynamodb
      .get({
        TableName: TABLE_NAME,
        Key: { userid: username.toLowerCase() },
      })
      .promise();

    const user = userResult.Item;
    if (!user) return response(404, { error: "User not found" });

    // 🔐 Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return response(401, { error: "Invalid credentials" });

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
    return response(500, { error: "Internal server error" });
  }
};
