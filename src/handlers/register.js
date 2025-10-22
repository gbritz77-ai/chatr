// src/handlers/register.js
import AWS from "aws-sdk";
import bcrypt from "bcryptjs";

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

export const handler = async (event) => {
  console.log("📩 REGISTER EVENT:", JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || "{}");
    const { username, password } = body;

    if (!username || !password)
      return response(400, { success: false, message: "Missing username or password" });

    // ✅ Validate email
    const email = username.trim().toLowerCase();
    if (!email.includes("@") || !email.includes("."))
      return response(400, { success: false, message: "Username must be a valid email address" });

    // ✅ Check if already exists
    const existing = await dynamodb
      .get({
        TableName: TABLE_NAME,
        Key: { userid: email },
      })
      .promise();

    if (existing.Item)
      return response(400, { success: false, message: "User already exists" });

    // ✅ Hash password
    const hashed = await bcrypt.hash(password, 10);

    const newUser = {
      userid: email,            // ✅ Primary key (email)
      username: email,          // ✅ Display name = email
      password: hashed,
      createdAt: new Date().toISOString(),
    };

    await dynamodb
      .put({
        TableName: TABLE_NAME,
        Item: newUser,
      })
      .promise();

    console.log("✅ Registered new user:", email);

    return response(201, {
      success: true,
      message: "User registered successfully",
    });
  } catch (err) {
    console.error("❌ REGISTER ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
