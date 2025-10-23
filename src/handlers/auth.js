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
    const path = event.path?.toLowerCase() || "";
    const method = event.httpMethod || "POST";
    const body = JSON.parse(event.body || "{}");

    console.log("📦 Path:", path, "Method:", method, "Body:", body);

    /* ============================================================
       🧩 REGISTER NEW USER (POST /auth/register)
    ============================================================ */
    if (method === "POST" && path.endsWith("/auth/register")) {
      const { username, password, profileName } = body;

      if (!username || !password || !profileName) {
        return response(400, {
          success: false,
          message:
            "Missing required fields (username, password, profileName)",
        });
      }

      const email = username.trim().toLowerCase();
      const normalizedName = profileName.trim();

      // Check if user already exists by email
      const existing = await dynamodb
        .get({ TableName: TABLE_NAME, Key: { userid: email } })
        .promise();

      if (existing.Item) {
        return response(400, {
          success: false,
          message: "A user with that email already exists.",
        });
      }

      // Check if profile name is already taken
      const nameCheck = await dynamodb
        .scan({
          TableName: TABLE_NAME,
          FilterExpression: "profileName = :n",
          ExpressionAttributeValues: { ":n": normalizedName },
          ProjectionExpression: "userid, profileName",
        })
        .promise();

      if (nameCheck.Items && nameCheck.Items.length > 0) {
        return response(400, {
          success: false,
          message: "Profile name already exists. Please choose another name.",
        });
      }

      // Hash password
      const hashed = await bcrypt.hash(password, 10);

      const newUser = {
        userid: email,
        profileName: normalizedName,
        password: hashed,
        createdAt: new Date().toISOString(),
      };

      await dynamodb.put({ TableName: TABLE_NAME, Item: newUser }).promise();

      console.log("✅ User registered successfully:", email);

      return response(201, {
        success: true,
        message: "Registration successful",
        user: {
          userid: email,
          profileName: newUser.profileName,
        },
      });
    }

    /* ============================================================
       🔐 LOGIN EXISTING USER (POST /auth)
    ============================================================ */
    if (method === "POST" && path.endsWith("/auth")) {
      const { username, password } = body;

      if (!username || !password) {
        return response(400, {
          success: false,
          message: "Missing credentials",
        });
      }

      const email = username.trim().toLowerCase();

      // Fetch user record
      const result = await dynamodb
        .get({ TableName: TABLE_NAME, Key: { userid: email } })
        .promise();

      const user = result.Item;
      if (!user) {
        return response(404, {
          success: false,
          message: "User not found",
        });
      }

      const valid = await bcrypt.compare(password, user.password || "");
      if (!valid) {
        return response(401, {
          success: false,
          message: "Invalid password",
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userid: email, profileName: user.profileName },
        JWT_SECRET,
        { expiresIn: "12h" }
      );

      console.log("✅ Login successful:", email);

      return response(200, {
        success: true,
        token,
        profileName: user.profileName,
        userid: email,
      });
    }

    /* ============================================================
       ❌ Invalid path
    ============================================================ */
    return response(404, {
      success: false,
      message: "Invalid path or method",
    });
  } catch (err) {
    console.error("💥 AUTH ERROR:", err);
    return response(500, {
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
