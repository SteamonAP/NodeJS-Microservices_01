const Search = require("../models/search");
const logger = require("../utils/logger");

const invalidateSearchCache = async (redisClient) => {
  try {
    let cursor = 0;
    const keysToDelete = [];

    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, {
        //scan non-blocking and paginates through the keyspace
        MATCH: "search:*",
        COUNT: 100,
      });
      if (keys.length > 0) {
        keysToDelete.push(...keys);
      }
      cursor = parseInt(nextCursor, 10);
    } while (cursor !== 0);
    if (keysToDelete.length > 0) {
      await redisClient.del(keysToDelete);
      logger.info(
        `Search cache invalidated. Deleted ${keysToDelete.length} keys.`
      );
    } else {
      logger.info(`No search:* keys found for invalidation.`);
    }
  } catch (error) {
    logger.error("Error invalidating search cache", error);
  }
};

const handlePostCreated = async (event, redisClient) => {
  try {
    await Search.findOneAndUpdate(
      { postId: event.postId },
      {
        $set: {
          userId: event.userId,
          content: event.content,
          createdAt: event.createdAt,
        },
      },
      { upsert: true, new: true } // upsert: create if not found. new: return the new doc
    );
    logger.info(`Search document created/updated for postId: ${event.postId}`);
    await invalidateSearchCache(redisClient);
  } catch (error) {
    logger.error(
      `Error handling post.created event for postId ${event.postId}`,
      error
    );
  }
};

const handlePostDeleted = async (event, redisClient) => {
  try {
    await Search.deleteOne({ postId: event.postId });
    logger.info(`Search document deleted for postId: ${event.postId}`);
    await invalidateSearchCache(redisClient);
  } catch (error) {
    logger.error(
      `Error handling post.deleted event for postId ${event.postId}`,
      error
    );
  }
};

module.exports = { handlePostCreated, handlePostDeleted };
