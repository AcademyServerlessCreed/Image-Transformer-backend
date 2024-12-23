import fs from "fs";
import path from "path";
import axios from "axios";

// Configuration
const API_ENDPOINT =
  "https://tiot1bxrt6.execute-api.ap-south-1.amazonaws.com/prod/";
const TEST_IMAGE_PATH = path.join(__dirname, "test-image.jpg");

async function convertImageToBase64(imagePath: string): Promise<string> {
  // Read image file with a specific maximum size
  const maxFileSizeInBytes = 5 * 1024 * 1024; // 5MB
  const stats = fs.statSync(imagePath);

  if (stats.size > maxFileSizeInBytes) {
    throw new Error("Image file is too large. Maximum size is 5MB");
  }

  const image = fs.readFileSync(imagePath);
  return `data:image/jpeg;base64,${image.toString("base64")}`;
}

async function testImageUpload() {
  try {
    console.log("Reading image file...");
    const base64Image = await convertImageToBase64(TEST_IMAGE_PATH);

    // Prepare request payload
    const payload = {
      filename: "test-image.jpg",
      contentType: "image/jpeg",
      base64Image,
      sizes: [
        { width: 200, height: 200 },
        { width: 800, height: 600 },
      ],
    };

    console.log("Sending request to:", `${API_ENDPOINT}/upload`);
    console.log("Payload size:", JSON.stringify(payload).length, "bytes");
    console.log("Requested sizes:", payload.sizes);

    // Make API request with increased timeout
    const response = await axios.post(`${API_ENDPOINT}/upload`, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 seconds timeout
      maxContentLength: 10 * 1024 * 1024, // 10MB
      maxBodyLength: 10 * 1024 * 1024, // 10MB
    });

    console.log("Upload successful!");
    console.log("Response:", response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Upload failed:", error.response?.data || error.message);
      console.error("Status code:", error.response?.status);
      console.error("Headers:", error.response?.headers);
      if (error.response?.data) {
        console.error("Error details:", error.response.data);
      }
    } else {
      console.error("Error:", error);
    }
    throw error;
  }
}

// Run the test
async function runTests() {
  try {
    console.log("Starting image upload test...\n");
    await testImageUpload();
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

runTests();
