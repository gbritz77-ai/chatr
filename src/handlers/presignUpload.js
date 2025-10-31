// src/handlers/presignUpload.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

AWS.config.update({ region: process.env.AWS_REGION || "eu-west-2" });
const s3 = new AWS.S3({ signatureVersion: "v4" });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const BUCKET = process.env.ATTACHMENTS_BUCKET;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;

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
  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : {};
    let { name, type, sender, recipient, text } = body;

    if (!name) return response(400, { success: false, message: "Missing file name" });

    const ext = name.split(".").pop().toLowerCase();
    const mimeMap = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      pdf: "application/pdf",
    };
    type = mimeMap[ext] || type || "application/octet-stream";

    const uniqueId = crypto.randomBytes(8).toString("hex");
    const fileKey = `attachments/${Date.now()}-${uniqueId}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const uploadURL = await s3.getSignedUrlPromise("putObject", {
      Bucket: BUCKET,
      Key: fileKey,
      ContentType: type,
      Expires: 300,
    });

    const viewURL = await s3.getSignedUrlPromise("getObject", {
      Bucket: BUCKET,
      Key: fileKey,
      Expires: 86400,
    });

    // Optional: Save metadata to DynamoDB
    if (sender && recipient) {
      const messageItem = {
        messageid: crypto.randomUUID(),
        sender,
        recipient,
        text: text || "",
        attachmentKey: fileKey,
        attachmentType: type,
        attachmentUrl: viewURL,
        timestamp: new Date().toISOString(),
        read: false,
      };
      await dynamodb.put({ TableName: MESSAGES_TABLE, Item: messageItem }).promise();
    }

    return response(200, { success: true, uploadURL, fileKey, viewURL, contentType: type });
  } catch (err) {
    console.error("❌ PRESIGN ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
