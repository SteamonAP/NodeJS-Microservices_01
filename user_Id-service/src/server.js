require("dotenv").config();
const mongoose = require("mongoose");
const logger = require("./utils/logger.js");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const app = express();
// const { RateLimiterRedis } = require("rate-limiter-flexible");
const { Redis } = require("@upstash/redis");
const { Ratelimit } = require("@upstash/ratelimit");
// const { rateLimit } = require("express-rate-limit");
// const { RedisStore } = require("rate-limit-redis");
const routes = require("./routes/userId.js");
const errorHandler = require("./middleware/errorHandler.js");

const PORT = process.env.PORT || 3001;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info("Connected to DB"))
  .catch((e) => logger.error("Connection error with DB", e));

const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

app.use(helmet()); //secure  the express app  by setting various http headers
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`Recieved ${req.method} request to ${req.url}`);
  if (req.body) {
    const { password, ...bodyToLog } = req.body;
    logger.info(`Request body: ${JSON.stringify(bodyToLog)}`);
  }
  next();
});

//DDos and Rate Limiting

const globalRateLimiter = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  prefix: "ratelimit_global",
});

const authEndpointLimiter = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.slidingWindow(500, "15 m"),
  prefix: "ratelimit_auth",
});

// const globalRateLimiterMiddleware = (req, res, next) => {
//   if (req.method === "OPTIONS") {
//     return next();
//   }
//   globalRateLimiter
//     .consume(req.ip)
//     .then(() => next())
//     .catch((err) => {
//       logger.error("CRITICAL: Rate limiter failed", err);
//       logger.warn(`DDos protection: Request Limit exceeded for IP ${req.ip}`);
//       res.status(429).json({
//         success: false,
//         message: "Too many requests, please slow down.",
//       });
//     });
// };

// const authLimiterMiddleware = (req, res, next) => {
//   authEndpointLimiter
//     .consume(req.ip)
//     .then(() => next())
//     .catch(() => {
//       logger.warn(`Auth Endpoint Rate Limit exceeded for IP: ${req.ip}`);
//       res.status(429).json({
//         success: false,
//         message: "Too many requests to this endpoint, please try again later.",
//       });
//     });
// };

const createLimiterMiddleware =
  (limiter, message) => async (req, res, next) => {
    if (req.method === "OPTIONS") {
      return next();
    }
    const ip = req.ip ?? "127.0.0.1";
    const { success, remaining } = await limiter.limit(ip);
    if (success) {
      return next();
    } else {
      logger.warn(`Rate Limit exceeded for IP: ${ip}. Message: ${message}`);
      return res.status(429).json({
        success: false,
        message: `Rate limit exceeded. Try again later. (Remaining requests: ${remaining})`,
      });
    }
  };

app.use(createLimiterMiddleware(globalRateLimiter, "Global limit exceeded"));
app.use("/api/auth/register", createLimiterMiddleware(authEndpointLimiter, "Auth limit exceeded"));

app.use("/api/auth", routes);

//errorHandler

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`user_Id service running on port ${PORT}`);
});

//unhandled promise rejection

process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    `Unhandled Rejection at: ${promise} reason: ${
      typeof reason === "object" ? JSON.stringify(reason) : String(reason)
    }`
  );
});
