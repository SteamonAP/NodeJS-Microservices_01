const RefreshToken = require("../models/refreshToken.js");
const User = require("../models/user.js");
const generateTokens = require("../utils/generateToken.js");
const logger = require("../utils/logger.js");
const {
  validateRegistration,
  validateLogin,
} = require("../utils/validation.js");

//register logic

const registerUser = async (req, res) => {
  logger.info("Registration endpoint reached");

  try {
    const { error } = validateRegistration(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { email, password, username } = req.body;
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      logger.warn(
        `Registration attempt with existing email or username: ${email} or ${username}`
      );
      return res.status(409).json({
        success: false,
        message: "USer already exists",
      });
    }
    user = new User({ username, email, password });
    await user.save();
    logger.info(`User created successfully: ${user._id}`);

    const { accessToken, refreshToken } = await generateTokens(user);

    res.status(201).json({
      success: true,
      message: "User registered Successfully",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error("Registration error occured", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//login logic
const loginUser = async (req, res) => {
  logger.info(`Login endpoint reached`);
  try {
    const { error } = validateLogin(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      logger.warn(`Login attempt for non-existent user: ${email}`);
      return res.status(401).json({
        success: false,
        message: "Incorrect credentials",
      });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      logger.warn(`Failed login attempt for user: ${email}`);
      return res.status(400).json({
        success: false,
        message: "Incorrect user credentials",
      });
    }

    logger.info(`User logged in successfully: ${user._id}`);

    const { accessToken, refreshToken } = await generateTokens(user);
    res.json({
      success: true,
      accessToken,
      refreshToken,
      userId: user._id,
    });
  } catch (error) {
    logger.error("Login error occured", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//refresh token

const refreshTokenUser = async (req, res) => {
  logger.info(`RefreshToken endpoint reached`);
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn("Refresh token missing");
      return res.status(400).json({
        success: false,
        message: "RefreshToken missing",
      });
    }
    const existingToken = await RefreshToken.findOne({ token: refreshToken });
    if (!existingToken || existingToken.expiresAt < new Date()) {
      logger.warn("Invalid or expired RefreshToken");
      return res.status(401).json({
        success: false,
        message: `Invalid or expired refresh token`,
      });
    }
    const user = await User.findById(existingToken.user);
    if (!user) {
      logger.warn("Invalid user");
      return res.status(401).json({
        success: false,
        message: `Invalid user`,
      });
    }
    await RefreshToken.deleteOne({ _id: existingToken._id });
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateTokens(user);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    logger.error("Login error occured", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//logout

const logoutUser = async (req, res) => {
  logger.info("Logout endpoint reached");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn("Refresh token missing");
      return res.status(400).json({
        success: false,
        message: "RefreshToken missing",
      });
    }
    await RefreshToken.deleteOne({ token: refreshToken });
    logger.info("Refresh Token deleted Successfully");
    res.status(200).json({
      success: true,
      message: "LoggedOut Successfully",
    });
  } catch (error) {
    logger.error("Logout error occured", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { registerUser, loginUser, refreshTokenUser, logoutUser };
