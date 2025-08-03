const express = require("express");

const { searchPostController } = require("../controllers/search-controller.js");

const { authenticationCheck } = require("../middleware/authMiddleware.js");

const router = express.Router();

router.use(authenticationCheck);

router.get("/posts", searchPostController);

module.exports = router;
