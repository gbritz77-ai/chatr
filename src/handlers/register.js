// src/handlers/register.js
const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { response } = require("../helpers/response"); // ✅ shared helper

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE || "chatr-members";
const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

/* ===========================================================
   🧩 Handler
=========================================================== */
exports.handler = async (event) => {
  console.log("🧾 REGISTER EVENT:", JSON.stringify(event, null, 2));
  const method = (event.httpMethod || "GET").toUpperCase();

  /* ===========================================================
     🌐 Handle CORS Preflight
  ============================================================ */
  if (method === "OPTIONS") {
    console.log("🟢 CORS preflight received");
    return response(200, { success: true, message: "CORS preflight success" });
  }

  if (method !== "POST") {
    return response(405, { success: false, message: "Method not allowed" });
  }

  try {
    /* ===========================================================
       📦 Parse and Validate Input
    ============================================================ */
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return response(400, { success: false, message: "Invalid JSON body" });
    }

    const { username, password, confirmPassword, profileName } = body;

    if (!username || !password || !confirmPassword || !profileName) {
      console.warn("⚠️ Missing required fields:", body);
      return response(400, {
        success: false,
        message: "Missing required fields: username, password, confirmPassword, profileName",
      });
    }

    // ✅ Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username)) {
      return response(400, { success: false, message: "Invalid email address" });
    }

    // ✅ Password confirmation
    if (password !== confirmPassword) {
      return response(400, { success: false, message: "Passwords do not match" });
    }

    const email = username.trim().toLowerCase();
    const trimmedProfile = profileName.trim();

    /* ===========================================================
       🚫 Check if email already exists (key lookup)
    ============================================================ */
    const existingUser = await dynamodb
      .get({ TableName: TABLE_NAME, Key: { userid: email } })
      .promise();

    if (existingUser.Item) {
      console.warn("⚠️ Email already registered:", email);
      return response(409, { success: false, message: "Email is already registered" });
    }

    /* ===========================================================
       🚫 Check if profileName already exists (index scan)
    ============================================================ */
    const scanResult = await dynamodb
      .scan({
        TableName: TABLE_NAME,
        ProjectionExpression: "#pn",
        ExpressionAttributeNames: { "#pn": "profileName" },
      })
      .promise();

    const nameExists = scanResult.Items?.some(
      (u) => u.profileName?.toLowerCase() === trimmedProfile.toLowerCase()
    );

    if (nameExists) {
      console.warn("⚠️ Profile name already taken:", trimmedProfile);
      return response(409, { success: false, message: "Profile name already in use" });
    }

    /* ===========================================================
       🔐 Hash password securely
    ============================================================ */
    const hashedPassword = await bcrypt.hash(password, 10);

    /* ===========================================================
       💾 Save user to DynamoDB
    ============================================================ */
    const newUser = {
      userid: email,
      profileName: trimmedProfile,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      role: "member",
    };

    await dynamodb
      .put({
        TableName: TABLE_NAME,
        Item: newUser,
        ConditionExpression: "attribute_not_exists(userid)", // ✅ prevents race duplicate
      })
      .promise();

    /* ===========================================================
       🔑 Generate JWT token
    ============================================================ */
    const token = jwt.sign({ userid: email, profileName: trimmedProfile }, JWT_SECRET, {
      expiresIn: "12h",
    });

    console.log("✅ Registered new user:", email);

    return response(200, {
      success: true,
      message: "Registration successful",
      token,
      username: email,
      profileName: trimmedProfile,
    });
  } catch (err) {
    console.error("💥 REGISTER ERROR:", err);

    // 🧩 Friendly error messages for DynamoDB conditions
    const message =
      err.code === "ConditionalCheckFailedException"
        ? "This user already exists"
        : err.message || "Internal server error";

    return response(500, { success: false, message });
  }
};
