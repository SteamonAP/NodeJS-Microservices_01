const logger = require("../utils/logger.js");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const validateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; //bearer token

  if (!token) {
    logger.warn(`Access token without valid token!`);
    return res.status(401).json({
      success: false,
      message: "Authorization required",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn(`Invalid token`);
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
    req.user = user;
    next();
  });
};

module.exports = { validateToken };
