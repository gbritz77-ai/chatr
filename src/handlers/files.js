// src/handlers/files.js
import AWS from "aws-sdk";
import crypto from "crypto";

const s3 = new AWS.S3();
const BUCKET = process.env.ATTACHMENTS_BUCKET;

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  console.log("📤 FILE UPLOAD EVENT:", event.body ? event.body.slice(0, 200) + "..." : "No body");

  try {
    const body = JSON.parse(event.body || "{}");
    const { base64, name, type } = body;

    if (!base64 || !name || !type)
      return response(400, { success: false, message: "Missing base64, name or type" });

    const fileBuffer = Buffer.from(base64, "base64");
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `attachments/${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName}`;

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
    return response(500, { success: false, message: err.message });
  }
};
