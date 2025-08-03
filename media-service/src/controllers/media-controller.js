const Media = require("../models/media");
const { uploadMediaToCloudinary } = require("../utils/cloudinary");
const logger = require("../utils/logger.js");

const uploadMedia = async (req, res) => {
  logger.info("File upload initiated");

  try {
    if (!req.file) {
      logger.error("Media file not found,Please try again!");
      return res.status(404).json({
        success: false,
        message: "Media file not found!",
      });
    }

    const { originalname, mimetype, buffer } = req.file;
    const userId = req.user.userId;

    logger.info(`File details : name=${originalname} , type=${mimetype}`);
    logger.info("Uploading to Cloudinary");

    const cloudinaryUploadResult = await uploadMediaToCloudinary(req.file);
    logger.info(
      `Cloudinary upload successfully. Public Id:-${cloudinaryUploadResult.public_id}`
    );

    const newlyCreatedMedia = new Media({
      publicId: cloudinaryUploadResult.public_id,
      mediaName: originalname,
      mimeType: mimetype,
      url: cloudinaryUploadResult.secure_url,
      userId,
    });
    await newlyCreatedMedia.save();

    res.status(201).json({
      success: true,
      mediaId: newlyCreatedMedia._id,
      url: newlyCreatedMedia.url,
      message: "Media uplaod Successful",
    });
  } catch (error) {
    logger.error("Error uploading Media file", error);
    res.status(500).json({
      success: false,
      message: "Error uploading Media file",
    });
  }
};

const getAllMedia = async (req, res) => {
  try {
    const results = await Media.find({});
    res.json({
      results,
    });
  } catch (error) {
    logger.error("Error fetching Media from Cloud", error);
    res.status(500).json({
      success: false,
      message: "Error fetching Media from Cloud",
    });
  }
};

module.exports = { uploadMedia, getAllMedia };
