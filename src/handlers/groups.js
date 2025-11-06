// src/handlers/groups.js
const AWS = require("aws-sdk");
const crypto = require("crypto");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const GROUPS_TABLE = process.env.GROUPS_TABLE || "chatr-groups";

/* ============================================================
   🧰 Response Helper
============================================================ */
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

  // ✅ Handle CORS preflight
  if (method === "OPTIONS") {
    return response(200, { message: "CORS preflight success" });
  }

  try {
    /* ============================================================
       ➕ POST /groups — Create a new group
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
        members: Array.from(new Set([creator, ...members])),
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
       📋 GET /groups or /groups?username=<user>
    ============================================================= */
    if (method === "GET") {
      const username = params.username || null;

      const result = await dynamodb
        .scan({
          TableName: GROUPS_TABLE,
        })
        .promise();

      // 🧩 Normalize & clean member arrays
      let groups = (result.Items || []).map((g) => {
        const rawMembers = g.members || [];
        const normalizedMembers = Array.isArray(rawMembers)
          ? rawMembers.map((m) => (m.S ? m.S : m))
          : [];

        return {
          groupid: g.groupid,
          groupname: g.groupName || g.groupname || "Unnamed Group",
          creator: g.creator,
          members: normalizedMembers,
          createdAt: g.createdAt,
        };
      });

      // If username provided → filter groups that include that member
      if (username) {
        groups = groups.filter((g) =>
          (g.members || []).some(
            (m) => m.toLowerCase() === username.toLowerCase()
          )
        );
      }

      console.log(
        `✅ Returning ${groups.length} group(s) ${
          username ? `for user: ${username}` : "(all groups)"
        }`
      );

      return response(200, { success: true, groups });
    }

    /* ============================================================
       🧩 PUT /groups/add — Add a member
    ============================================================= */
    if (method === "PUT" && event.path.includes("add")) {
      const { groupid, username } = body;
      if (!groupid || !username)
        return response(400, { success: false, message: "Missing groupid or username" });

      const group = await dynamodb
        .get({ TableName: GROUPS_TABLE, Key: { groupid } })
        .promise();

      if (!group.Item)
        return response(404, { success: false, message: "Group not found" });

      const oldMembers = Array.isArray(group.Item.members)
        ? group.Item.members.map((m) => (m.S ? m.S : m))
        : [];

      const newMembers = Array.from(new Set([...oldMembers, username]));

      await dynamodb
        .update({
          TableName: GROUPS_TABLE,
          Key: { groupid },
          UpdateExpression: "set #m = :m",
          ExpressionAttributeNames: { "#m": "members" },
          ExpressionAttributeValues: { ":m": newMembers },
        })
        .promise();

      console.log(`✅ Member added: ${username} → ${groupid}`);
      return response(200, { success: true, members: newMembers });
    }

    /* ============================================================
       🧹 PUT /groups/remove — Remove a member
    ============================================================= */
    if (method === "PUT" && event.path.includes("remove")) {
      const { groupid, username } = body;
      if (!groupid || !username)
        return response(400, { success: false, message: "Missing groupid or username" });

      const group = await dynamodb
        .get({ TableName: GROUPS_TABLE, Key: { groupid } })
        .promise();

      if (!group.Item)
        return response(404, { success: false, message: "Group not found" });

      const oldMembers = Array.isArray(group.Item.members)
        ? group.Item.members.map((m) => (m.S ? m.S : m))
        : [];

      const newMembers = oldMembers.filter(
        (m) => m.toLowerCase() !== username.toLowerCase()
      );

      await dynamodb
        .update({
          TableName: GROUPS_TABLE,
          Key: { groupid },
          UpdateExpression: "set #m = :m",
          ExpressionAttributeNames: { "#m": "members" },
          ExpressionAttributeValues: { ":m": newMembers },
        })
        .promise();

      console.log(`🧹 Member removed: ${username} from ${groupid}`);
      return response(200, { success: true, members: newMembers });
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

      console.log(`🗑️ Group deleted: ${groupid}`);
      return response(200, { success: true, message: "Group deleted" });
    }

    /* ============================================================
       🚫 Unsupported
    ============================================================= */
    return response(405, { success: false, message: "Unsupported method" });
  } catch (err) {
    console.error("❌ GROUPS ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
