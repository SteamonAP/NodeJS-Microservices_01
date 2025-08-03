const logger = require("../utils/logger.js");
const Post = require("../models/post");
const User = require("../models/user.js");
const { validateCreatePost } = require("../utils/validation.js");
const { publishEvent } = require("../utils/rabbitmq.js");

const invalidatePostCache = async (req, postId) => {
  try {
    logger.info(`Invalidating cache for post ${postId} and post lists.`);
    const pipeline = req.redisClient.multi();
    pipeline.del(`post:${postId}`);
    pipeline.del(`posts:1:10`);
    await pipeline.exec();
    logger.info("Post cache invalidated successfully.");
  } catch (error) {
    logger.error("Error invalidating the post cache", error);
  }
};

const createPost = async (req, res) => {
  logger.info("Create Post endpoint hit...");
  try {
    const { error } = validateCreatePost(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { content, mediaIds } = req.body;
    const newCreatedPost = new Post({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || [],
    });
    await newCreatedPost.save();

    await publishEvent("post.created", {
      postId: newCreatedPost._id.toString(),
      userId: newCreatedPost.user.toString(),
      content: newCreatedPost.content,
      createdAt: newCreatedPost.createdAt,
    });

    await invalidatePostCache(req, newCreatedPost._id.toString());
    logger.info("Post created Successfully", newCreatedPost);
    res.status(201).json({
      success: true,
      message: "Post created successfully",
    });
  } catch (error) {
    logger.error("Error creating post", error);
    res.status(500).json({
      success: false,
      message: "Error creating Post",
    });
  }
};

const getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    const cacheKey = `posts:${page}:${limit}`;
    const cachedPosts = await req.redisClient.get(cacheKey);
    if (cachedPosts) {
      logger.info(`fetched data from Cache`);
      return res.json(cachedPosts);
    }

    logger.info("Serving posts from database");
    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate("user", "username");

    const totalNoPosts = await Post.countDocuments();
    const result = {
      posts,
      currentPage: page,
      totalPages: Math.ceil(totalNoPosts / limit),
      totalPosts: totalNoPosts,
    };
    //redis save
    await req.redisClient.setex(cacheKey, 300, JSON.stringify(result)); //SETEX[SET along with EXpire] (key,seconds,value)

    res.json(result);
  } catch (error) {
    logger.error("Error fetching all posts", error);
    res.status(500).json({
      success: false,
      message: "Error fetching all Posts",
    });
  }
};
const getPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const cachekey = `post:${postId}`;
    const cachedPost = await req.redisClient.get(cachekey);
    if (cachedPost) {
      return res.json(cachedPost);
    }
    const singlePost = await Post.findById(postId);
    if (!singlePost) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }
    await req.redisClient.setex(cachekey, 3600, JSON.stringify(singlePost));
    res.json(singlePost);
  } catch (error) {
    logger.error("Error fetching post", error);
    res.status(500).json({
      success: false,
      message: "Error fetching Post by ID",
    });
  }
};
const deletePost = async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId,
    });
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    //publish event

    await publishEvent("post.deleted", {
      postId: post._id.toString(),
      userId: req.user.userId,
      mediaIds: post.mediaIds,
    }); //('eventname/key',message)

    await invalidatePostCache(req, req.params.id);
    res.json({
      message: "Post deleted Successfully",
    });
  } catch (error) {
    logger.error("Error deleting post", error);
    res.status(500).json({
      success: false,
      message: "Error deleting Post by ID",
    });
  }
};

module.exports = { createPost, getAllPosts, getPost, deletePost };
