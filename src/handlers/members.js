import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.MEMBERS_TABLE || "chatr-members";

export const handler = async () => {
  try {
    const result = await dynamodb.scan({ TableName: TABLE_NAME }).promise();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        members: result.Items || [],
      }),
    };
  } catch (err) {
    console.error("❌ Failed to list members:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, message: "Failed to fetch members" }),
    };
  }
};
