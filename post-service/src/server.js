require("dotenv").config();
const logger = require("./utils/logger.js");
const mongoose = require("mongoose");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const app = express();
const { Redis } = require("@upstash/redis");
const { Ratelimit } = require("@upstash/ratelimit");
const errorHandler = require("./middleware/errorHandler.js");
const postRoutes = require("./routes/post-routes.js");
const { connectToRabbitMQ } = require("./utils/rabbitmq.js");

const PORT = process.env.PORT || 3002;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info("Connected to DB"))
  .catch((e) => logger.error("Connection error with DB", e));

const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(helmet()); //secure  the express app  by setting various http headers
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

const postEndpointLimiter = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.slidingWindow(10, "1 s"),
  prefix: "ratelimit_create_post",
});

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
app.use(
  "/api/posts/create-post",
  createLimiterMiddleware(postEndpointLimiter, "create-post limit exceeded")
);

app.use(
  "/api/posts",
  (req, res, next) => {
    req.redisClient = redisClient; //Dependency injection
    next();
  },
  postRoutes
);

app.use(errorHandler);

const startServer = async () => {
  try {
    await connectToRabbitMQ();
    app.listen(PORT, () => {
      logger.info(`Post-service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to Server", error);
    process.exit(1);
  }
};
startServer();

process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    `Unhandled Rejection at: ${promise} reason: ${
      typeof reason === "object" ? JSON.stringify(reason) : String(reason)
    }`
  );
});
