// src/handlers/presignUpload.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

AWS.config.update({ region: process.env.AWS_REGION || "eu-west-2" });
const s3 = new AWS.S3({ signatureVersion: "v4" });
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

module.exports.handler = async (event) => {
  console.log("📤 PRESIGN EVENT:", JSON.stringify(event, null, 2));

  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : {};
    let { name, type } = body;

    if (!name)
      return response(400, { success: false, message: "Missing file name" });

    // Infer MIME
    const ext = name.split(".").pop().toLowerCase();
    const mimeMap = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      pdf: "application/pdf",
      txt: "text/plain",
      mp4: "video/mp4",
      webm: "video/webm",
    };
    type = mimeMap[ext] || type || "application/octet-stream";

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const fileKey = `attachments/${Date.now()}-${uniqueId}-${safeName}`;

    const params = {
      Bucket: BUCKET,
      Key: fileKey,
      ContentType: type,
      Expires: 300, // 5 min upload link
    };

    // ✅ Generate upload & view links
    const uploadURL = await s3.getSignedUrlPromise("putObject", params);
    const viewURL = await s3.getSignedUrlPromise("getObject", {
      Bucket: BUCKET,
      Key: fileKey,
      Expires: 86400, // 24-hour view link
    });

    console.log("✅ Generated presigned URLs");

    return response(200, {
      success: true,
      uploadURL,
      fileKey,
      viewURL,
      contentType: type,
    });
  } catch (err) {
    console.error("❌ PRESIGN ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
