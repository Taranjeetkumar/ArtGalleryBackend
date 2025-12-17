import express from "express";
import { uploadARImage } from "../services/s3Service.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Upload AR preview image
router.post("/upload", protect, async (req, res) => {
  try {
    const { imageData, projectId } = req.body;

    if (!imageData || !projectId) {
      return res
        .status(400)
        .json({ message: "Image data and project ID are required" });
    }

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Upload to S3
    const result = await uploadARImage(imageBuffer, projectId);

    res.json({
      success: true,
      url: result.url,
      key: result.key,
    });
  } catch (error) {
    console.error("AR upload error:", error);
    res
      .status(500)
      .json({ message: "Failed to upload AR preview", error: error.message });
  }
});

export default router;
