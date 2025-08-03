const logger = require("../utils/logger.js");

const authenticationCheck = (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    logger.warn(`Access attempted without userId`);
    return res.status(401).json({
      success: false,
      message: `Acthentication required to access this Service! Pls Login!`,
    });
  }

  req.user = { userId };
  next();
};

module.exports = { authenticationCheck };
