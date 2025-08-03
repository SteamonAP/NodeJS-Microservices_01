require("dotenv").config();
const logger = require("./utils/logger.js");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const app = express();
const { Redis } = require("@upstash/redis");
const { Ratelimit } = require("@upstash/ratelimit");
const errorHandler = require("./middleware/errorHandler.js");
const proxy = require("express-http-proxy");
const { validateToken } = require("./middleware/authMiddleware.js");
const PORT = process.env.PORT || 3000;

const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

app.use(helmet()); //secure  the express app  by setting various http response headers
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
// app.use(express.json());

app.use((req, res, next) => {
  logger.info(`Recieved method ${req.method} to/from url ${req.url}`);
  if (req.body) {
    const { password, ...bodyToLog } = req.body;
    logger.info(`Request body : ${JSON.stringify(bodyToLog)}`);
  }
  next();
});

//rate limiting

const requestLimiter = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  prefix: "ratelimit_proxy_request",
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

app.use(
  createLimiterMiddleware(requestLimiter, "Proxy request limit exceeded")
);

const proxyOptions = {
  proxyReqPathResolver: (req) => {
    const newPath = req.originalUrl.replace(/^\/v1/, "/api");
    logger.info(`Proxy Path Rewrite: '${req.originalUrl}' -> '${newPath}'`);
    return newPath;
  },
  proxyErrorHandler: (err, res, next) => {
    logger.error(`Proxy error: ${err.message}`);
    res.status(502).json({
      message: "Error connecting to the downstream service",
      error: err.message,
    });
  },
};

// Public User Routes
app.use(
  ["/v1/auth/login", "/v1/auth/register"],
  proxy(process.env.USERID_SERVICE_URL, {
    ...proxyOptions,
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(`Response from User Service: ${proxyRes.statusCode}`);
      return proxyResData;
    },
  })
);

// Protected Routes (Post and User)
app.use(
  ["/v1/auth", "/v1/posts"],
  validateToken,
  proxy(
    (req) => {
      if (req.originalUrl.startsWith("/v1/auth"))
        return process.env.USERID_SERVICE_URL;
      if (req.originalUrl.startsWith("/v1/posts"))
        return process.env.POST_SERVICE_URL;
    },
    {
      ...proxyOptions,
      proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers["Content-Type"] = "application/json";
        if (srcReq.user) {
          const userId =
            srcReq.user.userId || srcReq.user.id || srcReq.user._id;
          if (userId) {
            logger.info(`Setting 'x-user-id' header to: ${userId}`);
            proxyReqOpts.headers["x-user-id"] = userId;
          }
        }
        return proxyReqOpts;
      },
    }
  )
);

//media proxyy
app.use(
  "/v1/media",
  validateToken,
  proxy(process.env.MEDIA_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.user) {
        const userId = srcReq.user.userId || srcReq.user.id || srcReq.user._id;
        if (userId) {
          logger.info(`Setting 'x-user-id' header to: ${userId}`);
          proxyReqOpts.headers["x-user-id"] = userId;
        }
      }
      if (
        srcReq.headers["content-type"] &&
        !srcReq.headers["content-type"].startsWith("multipart/form-data")
      ) {
        proxyReqOpts.headers["Content-Type"] = "application/json";
      }

      return proxyReqOpts;
    },
    parseReqBody: false,
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(`Response from Media Service: ${proxyRes.statusCode}`);
      return proxyResData;
    },
  })
);

//search-service proxy

app.use(
  "/v1/search",
  validateToken,
  proxy(process.env.SEARCH_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      if (srcReq.user) {
        const userId = srcReq.user.userId || srcReq.user.id || srcReq.user._id;
        if (userId) {
          logger.info(`Setting 'x-user-id' header to: ${userId}`);
          proxyReqOpts.headers["x-user-id"] = userId;
        }
      }
      return proxyReqOpts;
    },
  })
);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API Gateway is running on PORT ${PORT}`);
  logger.info(
    `User_Id service is running on PORT ${process.env.USERID_SERVICE_URL}`
  );
  logger.info(
    `Post service is running on PORT ${process.env.POST_SERVICE_URL}`
  );
  logger.info(
    `Media service is running on PORT ${process.env.MEDIA_SERVICE_URL}`
  );
  logger.info(
    `Search service is running on PORT ${process.env.SEARCH_SERVICE_URL}`
  );
  logger.info(`Redis Client is running  ${process.env.UPSTASH_REDIS_REST_URL}`);
});
