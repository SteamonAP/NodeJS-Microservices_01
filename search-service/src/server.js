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
const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq.js");
const searchRoutes = require("./routes/search-route.js");
const {
  handlePostCreated,
  handlePostDeleted,
} = require("./eventHandlers/search-event.js");

const PORT = process.env.PORT || 3004;

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

app.use(
  "/api/search",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  searchRoutes
);
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectToRabbitMQ();
    await consumeEvent("post.created", (event) =>
      handlePostCreated(event, redisClient)
    );
    await consumeEvent("post.deleted", (event) =>
      handlePostDeleted(event, redisClient)
    );
    app.listen(PORT, () => {
      logger.info(`Search-service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to Server", error);
    process.exit(1);
  }
};
startServer();

//unhandled promise rejection

process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    `Unhandled Rejection at: ${promise} reason: ${
      typeof reason === "object" ? JSON.stringify(reason) : String(reason)
    }`
  );
});
