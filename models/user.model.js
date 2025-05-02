// // models/user.model.js
// // Make sure your user model includes githubUsername field:

// import mongoose from "mongoose";
// const { Schema } = mongoose;

// const userSchema = new Schema(
//   {
//     username: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     email: {
//       type: String,
//       required: true,
//       unique: true,
//     },
//     password: {
//       type: String,
//       required: true,
//     },
//     img: {
//       type: String,
//       required: false,
//     },
//     country: {
//       type: String,
//       required: true,
//     },
//     phone: {
//       type: String,
//       required: false,
//     },
//     desc: {
//       type: String,
//       required: false,
//     },
//     isSeller: {
//       type: Boolean,
//       default: false,
//     },
//     certifications: {
//       type: [String],
//       required: false,
//       default: [],
//     },
//     totalRating: {
//       type: Number,
//       default: 0,
//     },
//     reviewCount: {
//       type: Number,
//       default: 0,
//     },
//     // GitHub integration fields
//     githubUsername: {
//       type: String,
//       required: false,
//     },
//     githubToken: {
//       type: String,
//       required: false,
//     },
//     // Email verification status
//     emailVerified: {
//       type: Boolean,
//       default: false,
//     },
//     // Verification code for email verification
//     verificationCode: {
//       type: String,
//       required: false,
//     },
//     // Skills field
//     skills: {
//       type: String,
//       required: false,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// export default mongoose.model("User", userSchema);




// models/user.model.js
// Make sure your user model includes githubUsername field:

import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    img: {
      type: String,
      required: false,
    },
    country: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: false,
    },
    desc: {
      type: String,
      required: false,
    },
    isSeller: {
      type: Boolean,
      default: false,
    },
    certifications: {
      type: [String],
      required: false,
      default: [],
    },
    totalRating: {
      type: Number,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    // GitHub integration fields
    githubUsername: {
      type: String,
      required: false,
    },
    githubToken: {
      type: String,
      required: false,
    },
    // Email verification status - changed default to true
    emailVerified: {
      type: Boolean,
      default: true,
    },
    // Skills field
    skills: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);