// src/handlers/presign-download.js
const AWS = require("aws-sdk");

AWS.config.update({ region: process.env.AWS_REGION });
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

exports.handler = async (event) => {
  console.log("📥 PRESIGN-DOWNLOAD EVENT:", JSON.stringify(event, null, 2));

  if (event.httpMethod === "OPTIONS") {
    return response(200, { success: true, message: "CORS OK" });
  }

  try {
    const body = (() => {
      try {
        return JSON.parse(event.body || "{}");
      } catch {
        return {};
      }
    })();

    const key = decodeURIComponent(body.key || body.fileKey || "").trim();
    if (!key) {
      console.warn("⚠️ Missing 'key' or 'fileKey' in request body.");
      return response(400, { success: false, message: "Missing file key" });
    }

    console.log(`🪣 Generating presigned URL for s3://${BUCKET}/${key}`);

    // Check existence and get metadata
    const head = await s3.headObject({ Bucket: BUCKET, Key: key }).promise();
    const contentType = head.ContentType || "application/octet-stream";

    const expiresIn = 3600 * 6; // 6 hours
    const filename = key.split("/").pop();

    const params = {
      Bucket: BUCKET,
      Key: key,
      Expires: expiresIn,
      ResponseCacheControl: "no-cache",
      ResponseContentType: contentType,
      ResponseContentDisposition: `inline; filename="${filename}"`,
    };

    const viewURL = await s3.getSignedUrlPromise("getObject", params);

    console.log("✅ Presigned download URL generated.");
    return response(200, { success: true, viewURL, expiresIn });
  } catch (err) {
    console.error("❌ PRESIGN-DOWNLOAD ERROR:", err);

    const safeMessage =
      err.code === "NotFound"
        ? "File not found in S3"
        : err.code === "AccessDenied"
        ? "Access denied to file"
        : err.code === "CredentialsError"
        ? "Server configuration issue (missing S3 credentials)"
        : "Failed to generate download URL";

    return response(500, { success: false, message: safeMessage });
  }
};
