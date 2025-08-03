const express = require("express");
const { createPost,getAllPosts,getPost,deletePost } = require("../controllers/post-controller.js");
const { authenticationCheck } = require("../middleware/authMiddleware.js");

const router = express.Router();

router.use(authenticationCheck);

router.post("/create-post", createPost);
router.get("/all-posts", getAllPosts);
router.get("/:id", getPost);
router.delete("/:id", deletePost);


module.exports = router;
