// src/handlers/presignUpload.handler.js
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

/* ============================================================
   🔏 Presign Upload Lambda
   Request:  POST /files/presign
   Body:     { name: "file.png", type: "image/png" }
   Response: { success, uploadURL, fileKey, publicUrl }
============================================================ */
export const handler = async (event) => {
  console.log("📤 PRESIGN EVENT:", event.body);

  try {
    const body = JSON.parse(event.body || "{}");
    const { name, type } = body;

    if (!name || !type) {
      return response(400, { success: false, message: "Missing file name or type" });
    }

    // Generate unique file key
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const fileKey = `attachments/${Date.now()}-${uniqueId}-${safeName}`;

    // Generate presigned URL (5 min expiry)
    const uploadURL = s3.getSignedUrl("putObject", {
      Bucket: BUCKET,
      Key: fileKey,
      ContentType: type,
      Expires: 300, // seconds
    });

    const publicUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION || "eu-west-2"}.amazonaws.com/${fileKey}`;

    console.log("✅ Presigned URL generated:", { fileKey, publicUrl });

    return response(200, {
      success: true,
      uploadURL,
      fileKey,
      publicUrl,
    });
  } catch (err) {
    console.error("❌ PRESIGN ERROR:", err);
    return response(500, {
      success: false,
      message: err.message || "Failed to generate presigned URL",
    });
  }
};
