// src/handlers/files.js
import AWS from "aws-sdk";
import crypto from "crypto";

const s3 = new AWS.S3({ region: "eu-west-2" });
const BUCKET = process.env.ATTACHMENTS_BUCKET;

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  console.log("📤 FILE UPLOAD EVENT:", event);

  if (event.httpMethod === "OPTIONS") {
    return response(200, { message: "CORS preflight ok" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { base64, name, type } = body;

    if (!base64 || !name || !type) {
      console.error("⚠️ Missing fields:", { base64: !!base64, name, type });
      return response(400, { success: false, message: "Missing base64, name, or type" });
    }

    // Strip possible "data:mime/type;base64," prefix
    const cleanBase64 = base64.replace(/^data:.*;base64,/, "");

    const fileBuffer = Buffer.from(cleanBase64, "base64");
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `attachments/${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName}`;

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
