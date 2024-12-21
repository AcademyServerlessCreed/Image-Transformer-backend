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
    const { key, width, height } = params;

    // Construct the key for resized image
    let imageKey = key;
    if (width && height) {
      imageKey = `${width}x${height}/${key}`;
    }

    // Generate pre-signed URL
    const url = s3.getSignedUrl("getObject", {
      Bucket: process.env.RESIZED_BUCKET,
      Key: imageKey,
      Expires: EXPIRATION,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url,
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
