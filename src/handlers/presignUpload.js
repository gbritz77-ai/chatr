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

exports.handler = async (event) => {
  console.log("📤 PRESIGN EVENT:", JSON.stringify(event, null, 2));

  try {
    // ✅ Parse body safely
    const body = event.body ? JSON.parse(event.body) : {};
    let { name, type } = body;

    if (!name) {
      console.error("⚠️ Missing file name in request body");
      return response(400, { success: false, message: "Missing file name" });
    }

    // ✅ Infer MIME type if not provided
    if (!type) {
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
      type = mimeMap[ext] || "application/octet-stream";
    }

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const fileKey = `attachments/${Date.now()}-${uniqueId}-${safeName}`;

    // ✅ Generate presigned PUT URL (for upload)
    const putParams = {
      Bucket: BUCKET,
      Key: fileKey,
      ContentType: type,
      Expires: 300, // 5 minutes
      ACL: "private", // works with Block Public Access
    };

    console.log("🧾 Generating presign for:", putParams);
    const uploadURL = await s3.getSignedUrlPromise("putObject", putParams);

    // ✅ Generate presigned GET URL (for view)
    const viewParams = {
      Bucket: BUCKET,
      Key: fileKey,
      Expires: 86400, // 24 hours
    };
    const viewURL = await s3.getSignedUrlPromise("getObject", viewParams);

    console.log("✅ Presign success:", { fileKey, uploadURL, viewURL });

    return response(200, {
      success: true,
      uploadURL,
      fileKey,
      viewURL,
      contentType: type,
    });
  } catch (err) {
    console.error("❌ PRESIGN ERROR:", err);
    return response(500, {
      success: false,
      message: err.message || "Failed to generate presigned URL",
    });
  }
};
