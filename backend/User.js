import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    },

    emailVerified: {
      type: Boolean,
      default: false
    },

    emailVerificationTokenHash: {
      type: String,
      default: null
    },

    emailVerificationExpires: {
      type: Date,
      default: null
    },

    passwordResetTokenHash: {
      type: String,
      default: null
    },

    passwordResetExpires: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const User =
  mongoose.models.User || mongoose.model("User", userSchema);

export default User;