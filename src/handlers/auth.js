import AWS from "aws-sdk";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret";

/* ============================================================
   🧱 Response Helper — Always includes CORS headers
============================================================ */
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE,PATCH",
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
  },
  body: JSON.stringify(body),
});

/* ============================================================
   ⚙️ Lambda Handler — Full Auth + Debug Logging
============================================================ */
export const handler = async (event) => {
  console.log("🚀 AUTH HANDLER START ==================================");
  console.log("📩 Full Event Received:", JSON.stringify(event, null, 2));

  // 🟡 Step 1: Handle preflight (OPTIONS)
  if (event.httpMethod === "OPTIONS") {
    console.log("🟡 OPTIONS request detected — responding with 200.");
    return response(200, { message: "CORS preflight OK" });
  }

  try {
    // 🟢 Step 2: Prepare and decode body
    console.log("🟢 Step 2: Inspecting event body...");
    let rawBody = event.body;
    console.log("🔸 Raw event.body type:", typeof rawBody);

    if (event.isBase64Encoded) {
      console.log("🟣 Body is base64-encoded — decoding...");
      rawBody = Buffer.from(event.body, "base64").toString("utf8");
      console.log("✅ Base64 decoded successfully.");
    }

    console.log("📦 Raw body content:", rawBody);

    // 🧠 Step 3: Parse JSON safely
    console.log("🟢 Step 3: Attempting JSON.parse...");
    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBody);
      console.log("✅ JSON parsed successfully!");
    } catch (err) {
      console.error("❌ JSON parse failed:", err);
      return response(400, {
        success: false,
        message: "Invalid JSON format in request body",
        receivedBody: rawBody,
        error: err.message,
      });
    }

    console.log("🧾 Parsed Body:", parsedBody);

    const { username, password } = parsedBody || {};
    if (!username || !password) {
      console.warn("⚠️ Missing username or password!");
      return response(400, {
        success: false,
        message: "Missing username or password",
      });
    }

    // 🔍 Step 4: Lookup user in DynamoDB using userid as partition key
    console.log("🔍 Querying DynamoDB for user (userid):", username);
    const params = {
      TableName: TABLE_NAME,
      Key: { userid: username }, // ✅ your actual partition key
    };

    let userItem;
    try {
      const result = await dynamodb.get(params).promise();
      userItem = result.Item;
      console.log("📦 DynamoDB get() result:", result);
    } catch (dbErr) {
      console.error("❌ DynamoDB get() failed:", dbErr);
      return response(500, {
        success: false,
        message: "Database query failed",
        error: dbErr.message,
      });
    }

    if (!userItem) {
      console.warn("⚠️ No user found for userid:", username);
      return response(404, {
        success: false,
        message: "Invalid username or password",
      });
    }

    console.log("👤 User found:", {
      userid: userItem.userid,
      hasPassword: !!userItem.password,
      role: userItem.role,
      profileName: userItem.profileName,
    });

    // 🔑 Step 5: Compare password hash
    console.log("🧩 Comparing provided password with stored hash...");
    const validPassword = await bcrypt.compare(password, userItem.password);

    if (!validPassword) {
      console.warn("❌ Invalid password for user:", username);
      return response(401, {
        success: false,
        message: "Invalid username or password",
      });
    }

    console.log("✅ Password verified!");

    // 🔐 Step 6: Generate JWT token
    console.log("🔐 Generating JWT token...");
    const token = jwt.sign(
      {
        userid: userItem.userid,
        profileName: userItem.profileName,
        role: userItem.role,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.log("✅ JWT generated successfully.");

    // 🧾 Step 7: Build success response
    const successResponse = {
      success: true,
      message: "Login successful!",
      token,
      member: {
        userid: userItem.userid,
        profileName: userItem.profileName,
        role: userItem.role,
        lastActive: userItem.lastActive,
      },
    };

    console.log("🏁 AUTH HANDLER COMPLETE — Success:", successResponse);

    return response(200, successResponse);
  } catch (err) {
    console.error("🔥 UNCAUGHT ERROR:", err);
    return response(500, {
      success: false,
      message: err.message || "Internal server error",
      stack: err.stack,
    });
  }
};
