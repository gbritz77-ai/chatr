// src/handlers/register.js
const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE;

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  console.log("📩 REGISTER EVENT:", JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || "{}");
    const { username, password } = body;

    if (!username || !password)
      return response(400, { success: false, message: "Missing username or password" });

    const email = username.trim().toLowerCase();
    if (!email.includes("@") || !email.includes("."))
      return response(400, { success: false, message: "Username must be a valid email address" });

    console.log("📧 Checking if user exists:", email);

    const existing = await dynamodb
      .get({
        TableName: TABLE_NAME,
        Key: { userid: email },
      })
      .promise();

    if (existing.Item) {
      console.log("⚠️ User already exists:", email);
      return response(400, { success: false, message: "User already exists" });
    }

    console.log("🔐 Hashing password...");
    const hashed = await bcrypt.hash(password, 10);

    const newUser = {
      userid: email,
      username: email,
      password: hashed,
      createdAt: new Date().toISOString(),
    };

    console.log("🪣 Saving new user to DynamoDB table:", TABLE_NAME);
    await dynamodb
      .put({
        TableName: TABLE_NAME,
        Item: newUser,
      })
      .promise();

    console.log("✅ Registered new user:", email);
    return response(201, { success: true, message: "User registered successfully" });
  } catch (err) {
    console.error("❌ REGISTER ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
