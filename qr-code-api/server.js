require("dotenv").config();
const express = require("express");
const QRCode = require("qrcode");
const { Readable } = require("stream");
const { URL } = require("url");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
const PORT = process.env.PORT || 3000;

// AWS SDK automatically loads credentials from ~/.aws/credentials
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  // The credentials will automatically be loaded from AWS CLI settings
});

const sanitizeFilename = (url) => {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.hostname +
      parsedUrl.pathname.replace(/\W+/g, "-").replace(/^-+|-+$/g, "")
    );
  } catch (err) {
    return null;
  }
};

app.get("/generate", async (req, res) => {
  const { data } = req.query;

  if (!data) {
    return res.status(400).json({ error: "Missing 'data' parameter" });
  }

  const sanitizedFilename = sanitizeFilename(data);
  if (!sanitizedFilename) {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  const fileName = `qr_codes/${sanitizedFilename}.png`;

  try {
    console.log("Generating QR code for:", data);
    const qrCodeBuffer = await QRCode.toBuffer(data, { type: "png" });

    if (!qrCodeBuffer || qrCodeBuffer.length === 0) {
      throw new Error("QR Code buffer is empty");
    }

    console.log("QR Code buffer generated, uploading to S3...");

    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: qrCodeBuffer, // Ensure this is not empty
      ContentType: "image/png",
    };

    const command = new PutObjectCommand(uploadParams);
    await s3.send(command);

    const qrCodeUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    res.json({ qrCodeUrl });
  } catch (err) {
    console.error("Error generating/uploading QR code:", err);
    res.status(500).json({
      error: "Server error while generating QR code",
      details: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`QR Code API is running on http://localhost:${PORT}`);
});
