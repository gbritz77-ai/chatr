// src/handlers/auth.js
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET;

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  console.log("📩 AUTH EVENT:", JSON.stringify(event, null, 2));

  try {
    // Parse and validate incoming body
    const body = JSON.parse(event.body || "{}");
    console.log("🧾 Parsed body:", body);

    const { username, password } = body;
    if (!username || !password) {
      console.warn("⚠️ Missing credentials:", { username, password });
      return response(400, { success: false, message: "Missing credentials" });
    }

    const email = username.trim().toLowerCase();
    console.log("📧 Normalized email:", email);

    // Fetch user record from DynamoDB
    console.log(`🔍 Fetching user from table [${TABLE_NAME}]...`);
    const result = await dynamodb
      .get({ TableName: TABLE_NAME, Key: { userid: email } })
      .promise();
    console.log("📦 DynamoDB result:", JSON.stringify(result, null, 2));

    const user = result.Item;
    if (!user) {
      console.warn("🚫 User not found in table:", email);
      return response(404, { success: false, message: "User not found" });
    }

    // Debug password fields
    console.log("🔑 Stored password field type:", typeof user.password);
    console.log("🔐 Comparing provided password...");

    // Compare password hashes
    const valid = await bcrypt.compare(password, user.password);
    console.log("🧮 Password match result:", valid);

    if (!valid) {
      console.warn("❌ Invalid password for user:", email);
      return response(401, { success: false, message: "Invalid password" });
    }

    // Generate JWT token
    if (!JWT_SECRET) console.error("❗ JWT_SECRET is undefined!");
    const token = jwt.sign({ userid: email }, JWT_SECRET, { expiresIn: "12h" });

    console.log("✅ Login successful for:", email);
    return response(200, { success: true, token });
  } catch (err) {
    console.error("💥 AUTH ERROR DETAILS:", err.stack || err);
    return response(500, { success: false, message: err.message });
  }
};
