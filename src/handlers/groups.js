import AWS from "aws-sdk";
import crypto from "crypto";
import { response } from "../helpers/response.js"; // ✅ shared CORS-safe helper

const dynamodb = new AWS.DynamoDB.DocumentClient();
const GROUPS_TABLE = process.env.GROUPS_TABLE || "chatr-groups";

/* ============================================================
   🪵 Structured Logger for CloudWatch
============================================================ */
const log = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(
    JSON.stringify({
      level,
      timestamp,
      message,
      ...data,
    })
  );
};

/* ============================================================
   🧠 Main Handler
============================================================ */
export const handler = async (event) => {
  const requestId = event.requestContext?.requestId || "N/A";
  log("INFO", "🚀 GROUPS HANDLER START", { requestId });

  const method = (event.httpMethod || "GET").toUpperCase();
  const path = (event.path || "").toLowerCase();
  const params = event.queryStringParameters || {};
  let body = {};

  // ✅ Handle CORS preflight early
  if (method === "OPTIONS") {
    log("INFO", "🟡 OPTIONS preflight received", { requestId, path });
    return response(200, { message: "CORS preflight success" });
  }

  // ✅ Safe JSON body parse
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch (err) {
    log("WARN", "⚠️ Invalid JSON body in request", { error: err.message, requestId });
    return response(400, { success: false, message: "Invalid JSON body" });
  }

  try {
    if (!GROUPS_TABLE) {
      log("ERROR", "❌ Missing GROUPS_TABLE environment variable", { requestId });
      return response(500, { success: false, message: "Server misconfiguration" });
    }

    /* ============================================================
       ➕ POST /groups — Create new group
    ============================================================= */
    if (method === "POST" && path.endsWith("/groups")) {
      const { groupName, creator, members } = body;
      if (!groupName || !creator || !Array.isArray(members)) {
        log("WARN", "Missing required fields for group creation", { body, requestId });
        return response(400, {
          success: false,
          message: "Missing groupName, creator, or members",
        });
      }

      const groupid = crypto.randomUUID();
      const item = {
        groupid,
        groupName: groupName.trim(),
        creator,
        members: Array.from(new Set([creator, ...members])),
        createdAt: new Date().toISOString(),
      };

      await dynamodb.put({ TableName: GROUPS_TABLE, Item: item }).promise();
      log("INFO", "✅ Group created", {
        groupid,
        groupName,
        creator,
        count: item.members.length,
        requestId,
      });

      return response(200, { success: true, message: "Group created", group: item });
    }

    /* ============================================================
       📋 GET /groups or /groups?username=<user>
    ============================================================= */
    if (method === "GET" && path.endsWith("/groups")) {
      const username = params.username || null;
      log("INFO", "🔍 Fetching groups", { username, requestId });

      const result = await dynamodb.scan({ TableName: GROUPS_TABLE }).promise();

      let groups = (result.Items || []).map((g) => ({
        groupid: g.groupid,
        groupName: g.groupName || g.groupname || "Unnamed Group",
        creator: g.creator,
        members: Array.isArray(g.members)
          ? g.members.map((m) => (m.S ? m.S : m))
          : [],
        createdAt: g.createdAt,
      }));

      if (username) {
        groups = groups.filter((g) =>
          g.members.some((m) => m.toLowerCase() === username.toLowerCase())
        );
      }

      log("INFO", "✅ Groups retrieved", {
        total: result.Items?.length || 0,
        returned: groups.length,
        requestId,
      });

      return response(200, { success: true, groups });
    }

    /* ============================================================
       ➕ PUT /groups/add — Add a member
    ============================================================= */
    if (method === "PUT" && path.includes("/groups/add")) {
      const { groupid, username } = body;
      if (!groupid || !username) {
        log("WARN", "Missing groupid or username for add", { body, requestId });
        return response(400, {
          success: false,
          message: "Missing groupid or username",
        });
      }

      const group = await dynamodb.get({ TableName: GROUPS_TABLE, Key: { groupid } }).promise();
      if (!group.Item) {
        log("WARN", "Group not found for add", { groupid, requestId });
        return response(404, { success: false, message: "Group not found" });
      }

      const oldMembers = Array.isArray(group.Item.members)
        ? group.Item.members.map((m) => (m.S ? m.S : m))
        : [];
      const newMembers = Array.from(new Set([...oldMembers, username]));

      await dynamodb
        .update({
          TableName: GROUPS_TABLE,
          Key: { groupid },
          UpdateExpression: "SET #m = :m",
          ExpressionAttributeNames: { "#m": "members" },
          ExpressionAttributeValues: { ":m": newMembers },
        })
        .promise();

      log("INFO", "✅ Member added to group", { groupid, username, requestId });
      return response(200, { success: true, members: newMembers });
    }

    /* ============================================================
       🧹 PUT /groups/remove — Remove a member
    ============================================================= */
    if (method === "PUT" && path.includes("/groups/remove")) {
      const { groupid, username } = body;
      if (!groupid || !username) {
        log("WARN", "Missing groupid or username for remove", { body, requestId });
        return response(400, { success: false, message: "Missing groupid or username" });
      }

      const group = await dynamodb.get({ TableName: GROUPS_TABLE, Key: { groupid } }).promise();
      if (!group.Item) {
        log("WARN", "Group not found for remove", { groupid, requestId });
        return response(404, { success: false, message: "Group not found" });
      }

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
          UpdateExpression: "SET #m = :m",
          ExpressionAttributeNames: { "#m": "members" },
          ExpressionAttributeValues: { ":m": newMembers },
        })
        .promise();

      log("INFO", "🧹 Member removed from group", { groupid, username, requestId });
      return response(200, { success: true, members: newMembers });
    }

    /* ============================================================
       🗑️ DELETE /groups/delete — Delete group
    ============================================================= */
    if (method === "DELETE" && path.includes("/groups/delete")) {
      const { groupid } = body;
      if (!groupid) {
        log("WARN", "Missing groupid for delete", { body, requestId });
        return response(400, { success: false, message: "Missing groupid" });
      }

      await dynamodb.delete({ TableName: GROUPS_TABLE, Key: { groupid } }).promise();
      log("INFO", "🗑️ Group deleted", { groupid, requestId });

      return response(200, { success: true, message: "Group deleted" });
    }

    /* ============================================================
       🚫 Unsupported route/method
    ============================================================= */
    log("WARN", "🚫 Unsupported method/path", { method, path, requestId });
    return response(405, { success: false, message: "Unsupported route or method" });
  } catch (err) {
    log("ERROR", "❌ GROUPS ERROR", { error: err.message, stack: err.stack, requestId });
    return response(500, {
      success: false,
      message: err.message || "Internal server error",
      errorCode: err.code || "UnknownError",
    });
  } finally {
    log("INFO", "🏁 GROUPS HANDLER COMPLETE", { requestId });
  }
};
