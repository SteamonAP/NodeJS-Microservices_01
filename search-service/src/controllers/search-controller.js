const Search = require("../models/search");
const logger = require("../utils/logger");

const searchPostController = async (req, res) => {
  logger.info(`Accessing Search-Service Endpoint`);

  try {
    const { query } = req.query;
    if (!query) {
      return res
        .status(400)
        .json({ success: false, message: "Search query is required." });
    }

    const cacheKey = `search:${query.toLowerCase().replace(/\s+/g, "_")}`;

    const cacheResults = await req.redisClient.get(cacheKey);
    if (cacheResults) {
      logger.info(`Serving search results from cache for query: "${query}"`);
      return res.json(cacheResults);
    }

    logger.info(`Serving search results from database for query: "${query}"`);
    const results = await Search.find(
      {
        $text: { $search: query },
      },
      {
        score: { $meta: "textScore" },
      }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(10);

    await req.redisClient.setex(cacheKey, 300, JSON.stringify(results));
    res.json(results);
  } catch (error) {
    logger.error("Error while searching post", error);
    res.status(500).json({
      success: false,
      message: "Error while searching post",
    });
  }
};

module.exports = { searchPostController };
