const mongoose = require("mongoose");

// This schema is a read-only "contract" for the post-service.
// It defines the shape of User data so Mongoose can populate it.
// It does not need to enforce rules like 'unique' as that is the
// responsibility of the user_Id-service.
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  // We don't even need the password field here, as the post-service
  // will never handle authentication.
});

// The most important part is registering the model with the name 'User'
const User = mongoose.model("User", userSchema);

module.exports = User;