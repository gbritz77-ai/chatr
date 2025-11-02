// src/handlers/groups.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const GROUPS_TABLE = process.env.GROUPS_TABLE || "chatr-groups";

/* ============================================================
   🧰 Response Helper
============================================================ */
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
  },
  body: JSON.stringify(body),
});

/* ============================================================
   🧠 Main Handler
============================================================ */
exports.handler = async (event) => {
  console.log("📦 GROUPS EVENT:", JSON.stringify(event, null, 2));

  const method = event.httpMethod || "GET";
  const params = event.queryStringParameters || {};
  let body = {};
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch {
    return response(400, { success: false, message: "Invalid JSON body" });
  }

  // ✅ CORS preflight
  if (method === "OPTIONS") {
    return response(200, { message: "CORS preflight success" });
  }

  try {
    /* ============================================================
       ➕ POST /groups — Create new group
    ============================================================= */
    if (method === "POST") {
      const { groupName, creator, members } = body;
      if (!groupName || !creator || !Array.isArray(members)) {
        return response(400, {
          success: false,
          message: "Missing groupName, creator, or members",
        });
      }

      const groupid = crypto.randomUUID();
      const item = {
        groupid,
        groupName,
        creator,
        members: Array.from(new Set([creator, ...members])), // ensure creator included
        createdAt: new Date().toISOString(),
      };

      await dynamodb
        .put({
          TableName: GROUPS_TABLE,
          Item: item,
        })
        .promise();

      console.log("✅ Group created:", item);
      return response(200, { success: true, message: "Group created", group: item });
    }

    /* ============================================================
       📋 GET /groups?username=...
    ============================================================= */
    if (method === "GET") {
      const username = params.username;
      if (!username)
        return response(400, { success: false, message: "Missing username" });

      const result = await dynamodb
        .scan({
          TableName: GROUPS_TABLE,
        })
        .promise();

      const groups = (result.Items || []).filter((g) =>
        g.members?.includes(username)
      );

      return response(200, { success: true, groups });
    }

    /* ============================================================
       🧩 PUT /groups/add — Add a member
    ============================================================= */
    if (method === "PUT" && event.path.includes("add")) {
      const { groupid, username } = body;
      if (!groupid || !username)
        return response(400, { success: false, message: "Missing data" });

      const group = await dynamodb
        .get({ TableName: GROUPS_TABLE, Key: { groupid } })
        .promise();

      if (!group.Item)
        return response(404, { success: false, message: "Group not found" });

      const members = Array.from(new Set([...(group.Item.members || []), username]));

      await dynamodb
        .update({
          TableName: GROUPS_TABLE,
          Key: { groupid },
          UpdateExpression: "set #m = :m",
          ExpressionAttributeNames: { "#m": "members" },
          ExpressionAttributeValues: { ":m": members },
        })
        .promise();

      return response(200, { success: true, members });
    }

    /* ============================================================
       🧹 PUT /groups/remove — Remove a member
    ============================================================= */
    if (method === "PUT" && event.path.includes("remove")) {
      const { groupid, username } = body;
      if (!groupid || !username)
        return response(400, { success: false, message: "Missing data" });

      const group = await dynamodb
        .get({ TableName: GROUPS_TABLE, Key: { groupid } })
        .promise();

      if (!group.Item)
        return response(404, { success: false, message: "Group not found" });

      const members = (group.Item.members || []).filter((m) => m !== username);

      await dynamodb
        .update({
          TableName: GROUPS_TABLE,
          Key: { groupid },
          UpdateExpression: "set #m = :m",
          ExpressionAttributeNames: { "#m": "members" },
          ExpressionAttributeValues: { ":m": members },
        })
        .promise();

      return response(200, { success: true, members });
    }

    /* ============================================================
       🗑️ DELETE /groups/delete — Delete group
    ============================================================= */
    if (method === "DELETE" && event.path.includes("delete")) {
      const { groupid } = body;
      if (!groupid)
        return response(400, { success: false, message: "Missing groupid" });

      await dynamodb
        .delete({
          TableName: GROUPS_TABLE,
          Key: { groupid },
        })
        .promise();

      return response(200, { success: true, message: "Group deleted" });
    }

    return response(405, { success: false, message: "Unsupported method" });
  } catch (err) {
    console.error("❌ GROUPS ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
