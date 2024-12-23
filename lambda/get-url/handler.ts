// lambda/get-url/handler.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3 } from "aws-sdk";

const s3 = new S3();
const EXPIRATION = 3600; // URL expires in 1 hour

interface QueryParams {
  key: string;
  width?: string;
  height?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const params = event.queryStringParameters;
    console.log("Key:", params?.key);
    if (!params?.key) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "Missing required parameter: key",
        }),
      };
    }

    // Now TypeScript knows params.key exists
    const { key } = params;

    // key with 200x200
    const key1 = `200x200/${key}`;
    // key with 800x600
    const key2 = `800x600/${key}`;

    // Generate pre-signed URL
    const url1 = s3.getSignedUrl("getObject", {
      Bucket: process.env.RESIZED_BUCKET,
      Key: key1,
      Expires: EXPIRATION,
    });
    const url2 = s3.getSignedUrl("getObject", {
      Bucket: process.env.RESIZED_BUCKET,
      Key: key2,
      Expires: EXPIRATION,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url1,
        url2,
        expiresIn: EXPIRATION,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Error generating pre-signed URL",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
