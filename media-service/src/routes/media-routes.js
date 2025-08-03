const express = require("express");
const multer = require("multer");
const logger = require("../utils/logger.js");
const {
  uploadMedia,
  getAllMedia,
} = require("../controllers/media-controller.js");
const { authenticationCheck } = require("../middleware/authMiddleware.js");
const router = express.Router();

const uplaod = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 5 * 1024 * 1024,
  },
}).single("file");

router.post(
  "/upload",
  authenticationCheck,
  (req, res, next) => {
    uplaod(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        logger.error("Multer error while uploading media:", err);
        return res.status(400).json({
          message: "Multer error while uploading media",
          error: err.message,
          stack: err.stack,
        });
      } else if (err) {
        logger.error("Unknown error while uploading media:", err);
        return res.status(500).json({
          message: "Unknown error while uploading media",
          error: err.message,
          stack: err.stack,
        });
      }
      if (!req.file) {
        return res.status(400).json({
          message: "No media file found",
        });
      }
      next();
    });
  },
  uploadMedia
);

router.get("/get-upload", authenticationCheck, getAllMedia);

module.exports = router;
