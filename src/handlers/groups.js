// src/handlers/groups.js
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.GROUPS_TABLE || "chatr-groups";

/* ============================================================
   📦 Helper — Standard JSON Response
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
   💬 GROUPS HANDLER
============================================================ */
exports.handler = async (event) => {
  console.log("👥 GROUPS EVENT:", JSON.stringify(event, null, 2));
  const method = event.httpMethod || "GET";
  const path = event.path || "";
  const params = event.queryStringParameters || {};
  let body = {};

  try {
    if (event.body) body = JSON.parse(event.body);
  } catch {
    return response(400, { success: false, message: "Invalid JSON body" });
  }

  if (method === "OPTIONS")
    return response(200, { success: true, message: "CORS preflight OK" });

  try {
    /* ============================================================
       🧩 GET /groups?username=...
    ============================================================ */
    if (method === "GET") {
      const username = params.username;
      if (!username)
        return response(400, { success: false, message: "Missing username" });

      const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();

      // Normalize members + filter by user
      const groups = (result.Items || [])
        .map((item) => ({
          groupid: item.groupid,
          groupName: item.groupName,
          creator: item.creator,
          createdAt: item.createdAt,
          members: (item.members || []).map((m) =>
            typeof m === "string" ? m : m?.S || null
          ).filter(Boolean),
        }))
        .filter((g) => g.members.includes(username));

      return response(200, { success: true, groups });
    }

    /* ============================================================
       🆕 POST /groups — Create a new group
    ============================================================ */
    if (method === "POST") {
      const { groupName, creator, members } = body;
      if (!groupName || !creator || !Array.isArray(members))
        return response(400, {
          success: false,
          message: "Missing or invalid groupName, creator, or members",
        });

      const uniqueMembers = [...new Set(members.concat(creator))];
      const groupid = `grp-${Date.now()}`;

      const newGroup = {
        groupid,
        groupName,
        creator,
        members: uniqueMembers,
        createdAt: new Date().toISOString(),
      };

      await dynamodb.put({ TableName: TABLE_NAME, Item: newGroup }).promise();

      return response(200, { success: true, group: newGroup });
    }

    /* ============================================================
       ➕ PUT /groups/add — Add a member
    ============================================================ */
    if (method === "PUT" && path.endsWith("/add")) {
      const { groupid, username, requester } = body;
      if (!groupid || !username || !requester)
        return response(400, {
          success: false,
          message: "Missing groupid, username, or requester",
        });

      const { Item: group } = await dynamodb
        .get({ TableName: TABLE_NAME, Key: { groupid } })
        .promise();

      if (!group)
        return response(404, { success: false, message: "Group not found" });
      if (group.creator !== requester)
        return response(403, {
          success: false,
          message: "Only the group creator can add members",
        });

      const members = [...new Set((group.members || []).map((m) => (m.S ? m.S : m)))];
      if (!members.includes(username)) members.push(username);

      await dynamodb
        .update({
          TableName: TABLE_NAME,
          Key: { groupid },
          UpdateExpression: "SET members = :m",
          ExpressionAttributeValues: { ":m": members },
        })
        .promise();

      return response(200, {
        success: true,
        message: "Member added successfully",
        groupid,
        members,
      });
    }

    /* ============================================================
       ➖ PUT /groups/remove — Remove a member
    ============================================================ */
    if (method === "PUT" && path.endsWith("/remove")) {
      const { groupid, username, requester } = body;
      if (!groupid || !username || !requester)
        return response(400, {
          success: false,
          message: "Missing groupid, username, or requester",
        });

      const { Item: group } = await dynamodb
        .get({ TableName: TABLE_NAME, Key: { groupid } })
        .promise();

      if (!group)
        return response(404, { success: false, message: "Group not found" });
      if (group.creator !== requester)
        return response(403, {
          success: false,
          message: "Only the group creator can remove members",
        });

      const updatedMembers = (group.members || [])
        .map((m) => (m.S ? m.S : m))
        .filter((m) => m !== username);

      await dynamodb
        .update({
          TableName: TABLE_NAME,
          Key: { groupid },
          UpdateExpression: "SET members = :m",
          ExpressionAttributeValues: { ":m": updatedMembers },
        })
        .promise();

      return response(200, {
        success: true,
        message: "Member removed successfully",
        groupid,
        members: updatedMembers,
      });
    }

    /* ============================================================
       🗑️ DELETE /groups/delete — Delete entire group
    ============================================================ */
    if (method === "DELETE" && path.endsWith("/delete")) {
      const { groupid, requester } = body;
      if (!groupid || !requester)
        return response(400, {
          success: false,
          message: "Missing groupid or requester",
        });

      const { Item: group } = await dynamodb
        .get({ TableName: TABLE_NAME, Key: { groupid } })
        .promise();

      if (!group)
        return response(404, { success: false, message: "Group not found" });
      if (group.creator !== requester)
        return response(403, {
          success: false,
          message: "Only the group creator can delete the group",
        });

      await dynamodb.delete({ TableName: TABLE_NAME, Key: { groupid } }).promise();

      return response(200, { success: true, message: "Group deleted" });
    }

    /* ============================================================
       ❌ Unsupported operation
    ============================================================ */
    return response(405, { success: false, message: "Unsupported method" });
  } catch (err) {
    console.error("❌ GROUPS HANDLER ERROR:", err);
    return response(500, { success: false, message: err.message });
  }
};
