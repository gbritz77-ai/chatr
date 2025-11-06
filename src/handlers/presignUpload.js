// src/handlers/presignUpload.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

AWS.config.update({ region: process.env.AWS_REGION });
const s3 = new AWS.S3({ signatureVersion: "v4" });
const BUCKET = process.env.ATTACHMENTS_BUCKET;

// src/helpers/response.js
export const response = (statusCode, body = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
  },
  body: JSON.stringify(body),
});


module.exports.handler = async (event) => {
  console.log("📦 PRESIGN UPLOAD EVENT:", JSON.stringify(event, null, 2));

  try {
    // Support both raw object and stringified body
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body || {};

    const { filename, contentType } = body;

    if (!filename || !contentType) {
      return response(400, {
        success: false,
        message: "Missing filename or contentType",
      });
    }

    // 🔹 Generate unique key safely
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const key = `attachments/${Date.now()}-${uniqueId}-${safeName}`;

    // 🔹 Create presigned PUT URL (for uploading)
    const uploadURL = await s3.getSignedUrlPromise("putObject", {
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      Expires: 300, // 5 min
    });

    // (Optional) create presigned GET URL if you want immediate preview
    const viewURL = await s3.getSignedUrlPromise("getObject", {
      Bucket: BUCKET,
      Key: key,
      Expires: 86400, // 24 hours
    });

    return response(200, {
      success: true,
      uploadURL,
      key,
      viewURL,
      contentType,
    });
  } catch (err) {
    console.error("❌ PRESIGN UPLOAD ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
