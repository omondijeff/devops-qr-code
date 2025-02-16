require("dotenv").config();
const express = require("express");
const QRCode = require("qrcode");
const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");

const app = express();
const PORT = process.env.PORT || 3000;

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Middleware to upload to S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    acl: "public-read",
    key: (req, file, cb) => {
      cb(null, `qr_codes/${file.originalname}`);
    },
  }),
});

// API to generate and upload QR code to S3
app.get("/generate", async (req, res) => {
  const { data } = req.query;

  if (!data) {
    return res.status(400).json({ error: "Missing 'data' parameter" });
  }

  const fileName = `${Buffer.from(data).toString("hex")}.png`;

  try {
    // Generate QR Code as a buffer
    const qrCodeBuffer = await QRCode.toBuffer(data);

    // Upload to S3
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `qr_codes/${fileName}`,
      Body: qrCodeBuffer,
      ContentType: "image/png",
      ACL: "public-read",
    };

    const uploadResult = await s3.upload(uploadParams).promise();

    res.json({ qrCodeUrl: uploadResult.Location });
  } catch (err) {
    console.error("Error uploading QR code  :", err);
    res.status(500).json({ error: "Error generating QR code" });
  }
});

app.listen(PORT, () => {
  console.log(`QR Code API is running on http://localhost:${PORT}`);
});
