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
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  console.log("📦 PRESIGNED UPLOAD EVENT:", event);

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return response(200, { message: "CORS preflight success" });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { name, type } = body;

    if (!name || !type)
      return response(400, { success: false, message: "Missing file name or type" });

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `attachments/${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")}-${safeName}`;

    const params = {
      Bucket: BUCKET,
      Key: key,
      ContentType: type,
      Expires: 300, // valid for 5 minutes
    };

    const uploadURL = await s3.getSignedUrlPromise("putObject", params);

    return response(200, {
      success: true,
      uploadURL,
      fileKey: key,
      publicUrl: `https://${BUCKET}.s3.eu-west-2.amazonaws.com/${key}`,
    });
  } catch (err) {
    console.error("❌ PRESIGNED URL ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
