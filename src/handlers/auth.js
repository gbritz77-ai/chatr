// src/handlers/auth.js
import AWS from "aws-sdk";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

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

export const handler = async (event) => {
  console.log("📩 AUTH EVENT:", JSON.stringify(event, null, 2));

  try {
    const body = JSON.parse(event.body || "{}");
    const { username, password } = body;

    if (!username || !password)
      return response(400, { success: false, message: "Missing credentials" });

    const email = username.trim().toLowerCase();

    const result = await dynamodb
      .get({
        TableName: TABLE_NAME,
        Key: { userid: email },
      })
      .promise();

    const user = result.Item;
    if (!user)
      return response(404, { success: false, message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return response(401, { success: false, message: "Invalid password" });

    const token = jwt.sign({ userid: email }, JWT_SECRET, { expiresIn: "12h" });

    console.log("✅ Login success for:", email);

    return response(200, { success: true, token });
  } catch (err) {
    console.error("❌ AUTH ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
