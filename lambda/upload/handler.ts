// lambda/upload/index.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3 } from "aws-sdk";

const s3 = new S3();

// Helper function to validate image type
const isValidImageType = (contentType: string): boolean => {
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  return validTypes.includes(contentType);
};

// Helper function to validate file size (max 5MB) (API Gateway limits the request size to 10MB)
const isValidFileSize = (base64Data: string): boolean => {
  const sizeInBytes = Buffer.from(base64Data, "base64").length;
  const maxSize = 5 * 1024 * 1024; // 5MB
  return sizeInBytes <= maxSize;
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Processing upload event");

  // Common headers for CORS
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    // Handle CORS preflight requests
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers,
        body: "",
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "No body provided",
        }),
      };
    }

    const { filename, contentType, base64Image } = JSON.parse(event.body);

    // Validate required fields
    if (!filename || !contentType || !base64Image) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message:
            "Missing required fields: filename, contentType, or base64Image",
        }),
      };
    }

    // Validate image type
    if (!isValidImageType(contentType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "Invalid image type. Supported types: JPEG, PNG, GIF, WebP",
        }),
      };
    }

    // Remove header from base64 if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    // Validate file size
    if (!isValidFileSize(base64Data)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "File size exceeds 5MB limit",
        }),
      };
    }

    const buffer = Buffer.from(base64Data, "base64");
    const key = `${Date.now()}-${filename}`;

    console.log("Uploading to S3:", {
      bucket: process.env.SOURCE_BUCKET,
      key: key,
    });

    // Upload to S3
    await s3
      .putObject({
        Bucket: process.env.SOURCE_BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          originalname: filename,
        },
      })
      .promise();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Image uploaded successfully",
        filename: key,
        url: `https://${process.env.SOURCE_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      }),
    };
  } catch (error: any) {
    console.error("Error:", error);

    return {
      statusCode: error.statusCode || 500,
      headers,
      body: JSON.stringify({
        message: "Error uploading image",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
