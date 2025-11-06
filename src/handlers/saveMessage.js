// src/handlers/saveMessages.js
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient(); // region inherited automatically

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { chatId, sender, text, timestamp } = body;

    if (!chatId || !sender || !text || !timestamp) {
      return {
        statusCode: 400,
       headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
      },
        body: JSON.stringify({ message: "Missing required fields" }),
      };
    }

    const params = {
      TableName: process.env.DYNAMODB_TABLE,
      Item: {
        chatId: { S: chatId },
        sender: { S: sender },
        text: { S: text },
        timestamp: { S: timestamp },
      },
    };

    await client.send(new PutItemCommand(params));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ success: true, message: "Message saved" }),
    };
  } catch (err) {
    console.error("SaveMessages error:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
