// src/handlers/register.js
const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE || "chatr-members";
const JWT_SECRET = process.env.JWT_SECRET;

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
  console.log("🧾 REGISTER EVENT:", event);

  try {
    const body = JSON.parse(event.body || "{}");
    const { username, password, confirmPassword, profileName } = body;

    /* ===========================================================
       🧩 Validate input
    =========================================================== */
    if (!username || !password || !confirmPassword || !profileName) {
      return response(400, {
        success: false,
        message: "Missing required fields",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username)) {
      return response(400, {
        success: false,
        message: "Invalid email address",
      });
    }

    // Password confirmation
    if (password !== confirmPassword) {
      return response(400, {
        success: false,
        message: "Passwords do not match",
      });
    }

    const email = username.trim().toLowerCase();
    const trimmedProfile = profileName.trim();

    /* ===========================================================
       🚫 Check if email already exists
    =========================================================== */
    const existingUser = await dynamodb
      .get({ TableName: TABLE_NAME, Key: { userid: email } })
      .promise();

    if (existingUser.Item) {
      return response(409, {
        success: false,
        message: "Email is already registered",
      });
    }

    /* ===========================================================
       🚫 Check if profileName already exists
    =========================================================== */
    const scanResult = await dynamodb
      .scan({
        TableName: TABLE_NAME,
        ProjectionExpression: "profileName",
      })
      .promise();

    const nameExists = scanResult.Items?.some(
      (u) => u.profileName?.toLowerCase() === trimmedProfile.toLowerCase()
    );

    if (nameExists) {
      return response(409, {
        success: false,
        message: "Profile name already in use",
      });
    }

    /* ===========================================================
       🔐 Hash password
    =========================================================== */
    const hashedPassword = await bcrypt.hash(password, 10);

    /* ===========================================================
       💾 Save user to DynamoDB
    =========================================================== */
    const newUser = {
      userid: email,
      profileName: trimmedProfile,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      role: "member",
    };

    await dynamodb
      .put({
        TableName: TABLE_NAME,
        Item: newUser,
      })
      .promise();

    /* ===========================================================
       🔑 Generate JWT token
    =========================================================== */
    const token = jwt.sign({ userid: email }, JWT_SECRET, { expiresIn: "12h" });

    console.log("✅ Registered new user:", email);

    return response(200, {
      success: true,
      message: "Registration successful",
      token,
      profileName: trimmedProfile,
      username: email,
    });
  } catch (err) {
    console.error("💥 REGISTER ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
