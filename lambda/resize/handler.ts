// lambda/resize/index.ts
import { S3Event } from "aws-lambda";
import { S3 } from "aws-sdk";
import Sharp from "sharp";

const s3 = new S3();

interface Size {
  width: number;
  height: number;
}

const SIZES: Size[] = [
  { width: 200, height: 200 },
  { width: 800, height: 600 },
];

export const handler = async (event: S3Event): Promise<void> => {
  console.log("Event received:", JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      const sourceBucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

      console.log("Processing image:", {
        sourceBucket,
        key,
      });

      // Get the image from S3
      const image = await s3
        .getObject({
          Bucket: sourceBucket,
          Key: key,
        })
        .promise();

      if (!image.Body) {
        throw new Error("No image body received from S3");
      }

      // Process each size
      for (const size of SIZES) {
        console.log("Processing size:", size);

        const resized = await Sharp(image.Body as Buffer)
          .resize(size.width, size.height, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .toBuffer();

        const resizedKey = `${size.width}x${size.height}/${key}`;

        console.log("Uploading resized image:", {
          Bucket: process.env.RESIZED_BUCKET,
          Key: resizedKey,
        });

        await s3
          .putObject({
            Bucket: process.env.RESIZED_BUCKET!,
            Key: resizedKey,
            Body: resized,
            ContentType: image.ContentType,
          })
          .promise();

        console.log("Successfully uploaded resized image:", resizedKey);
      }
    }
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
};
