// src/handlers/files.js
const AWS = require("aws-sdk");
const crypto = require("crypto");
const { response } = require("../helpers/response"); // ✅ shared helper

const s3 = new AWS.S3({ region: "eu-west-2" });
const BUCKET = process.env.ATTACHMENTS_BUCKET;

exports.handler = async (event) => {
  console.log("📤 FILE UPLOAD EVENT:", JSON.stringify(event, null, 2));

  const method = (event.httpMethod || "").toUpperCase();

  // ✅ Handle CORS preflight requests
  if (method === "OPTIONS") {
    return response(200, { message: "CORS preflight OK" });
  }

  if (method !== "POST") {
    return response(405, { success: false, message: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { base64, name, type } = body;

    if (!base64 || !name || !type) {
      console.error("⚠️ Missing fields:", { base64: !!base64, name, type });
      return response(400, {
        success: false,
        message: "Missing base64, name, or type",
      });
    }

    // Strip possible "data:mime/type;base64," prefix
    const cleanBase64 = base64.replace(/^data:.*;base64,/, "");

    const fileBuffer = Buffer.from(cleanBase64, "base64");
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `attachments/${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")}-${safeName}`;

    console.log(`🪣 Uploading to S3: ${BUCKET}/${key} (${type})`);

    await s3
      .putObject({
        Bucket: BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: type,
      })
      .promise();

    const fileUrl = `https://${BUCKET}.s3.eu-west-2.amazonaws.com/${key}`;
    console.log("✅ File uploaded:", fileUrl);

    return response(200, { success: true, key, url: fileUrl });
  } catch (err) {
    console.error("❌ FILE UPLOAD ERROR:", err);
    return response(500, {
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
