import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "./Order.js";
import Inventory from "./Inventory.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import User from "./User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import cron from "node-cron";
import { authenticateToken, authorizeAdmin } from "./authMiddleware.js";

dotenv.config();
const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
const razorpay = process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_SECRET
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

const app = express();
async function checkLowStockAndNotifyAdmin() {
  try {
    const lowStockItems = await Inventory.find({
      stock: { $lt: LOW_STOCK_THRESHOLD }
    }).sort({ id: 1 });

    if (lowStockItems.length === 0) {
      return;
    }

    if (!process.env.ADMIN_EMAIL) {
      console.error("ADMIN_EMAIL is not configured.");
      return;
    }

    const itemList = lowStockItems
      .map(item => `${item.name}: ${item.stock} remaining`)
      .join("\n");

    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: "Pizza Delivery - Low Stock Alert",
      text: `The following inventory items are below ${LOW_STOCK_THRESHOLD}:\n\n${itemList}`
    });

    console.log("Low-stock email notification sent.");
  } catch (error) {
    console.error("Low-stock check failed:", error.message);
  }
}

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:5173",
      "http://localhost:5174"
    ].filter(Boolean)
  })
);
app.use(express.json());

const menu = {
  bases: [
    "Classic Hand Tossed",
    "Thin Crust",
    "Cheese Burst",
    "Whole Wheat",
    "Gluten Free"
  ],
  sauces: [
    "Classic Tomato",
    "Spicy Marinara",
    "Pesto",
    "BBQ",
    "White Garlic"
  ],
  cheeses: ["Mozzarella", "Cheddar", "Parmesan", "Vegan Cheese"],
  vegetables: [
    "Capsicum",
    "Onion",
    "Sweet Corn",
    "Olives",
    "Mushrooms",
    "Tomato",
    "Jalapeños"
  ]
};
// User Registration
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Name, email and password are required."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters."
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const verificationToken = crypto.randomBytes(32).toString("hex");

    const verificationTokenHash = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "user",
      emailVerified: false,
      emailVerificationTokenHash: verificationTokenHash,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    await emailTransporter.sendMail({
  from: process.env.EMAIL_USER,
  to: user.email,
  subject: "Verify Your Pizza Delivery Account",
  html: `
    <h2>Welcome to Pizza Delivery!</h2>
    <p>Click the link below to verify your email address:</p>
    <a href="${process.env.BACKEND_URL}/api/auth/verify-email?token=${verificationToken}">
      Verify My Email
    </a>
    <p>This link expires in 24 hours.</p>
  `
});

    res.status(201).json({
      message: "Account created. Email verification setup is the next step.",
      userId: user._id
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists."
      });
    }

    console.error("Registration failed:", error.message);

    res.status(500).json({
      message: "Could not create account."
    });
  }
});
// Verify Email
app.get("/api/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send("Verification token is missing.");
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).send(
        "Invalid or expired verification link."
      );
    }

    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;

    await user.save();

    res.send("Email verified successfully! You can now log in.");
  } catch (error) {
    console.error("Email verification failed:", error.message);
    res.status(500).send("Email verification failed.");
  }
});
// User Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email?.trim() || !password) {
      return res.status(400).json({
        message: "Email and password are required."
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in."
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login failed:", error.message);

    res.status(500).json({
      message: "Login failed."
    });
  }
});
// FORGOT PASSWORD
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });

    // Do not reveal whether an account exists.
    if (!user) {
      return res.json({
        message: "If this email is registered, a reset link will be sent."
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.passwordResetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.passwordResetExpires = Date.now() + 15 * 60 * 1000;

    await user.save();

    const resetLink =
  `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await emailTransporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "PizzaCraft Password Reset",
      html: `
        <h2>Password Reset</h2>
        <p>Click below to reset your PizzaCraft password.</p>
        <a href="${resetLink}">Reset My Password</a>
        <p>This link expires in 15 minutes.</p>
      `
    });

    res.json({
      message: "If this email is registered, a reset link will be sent."
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Unable to send reset email." });
  }
});
// RESET PASSWORD
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        message: "Valid token and password of at least 6 characters are required."
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: "Reset link is invalid or expired."
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    res.json({
      message: "Password reset successful. Please login."
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      message: "Unable to reset password."
    });
  }
});
const LOW_STOCK_THRESHOLD = Number(
  process.env.LOW_STOCK_THRESHOLD || 20
);
const initialInventory = [
  { id: "base", name: "Pizza Bases", stock: 100 },
  { id: "sauce", name: "Sauces", stock: 100 },
  { id: "cheese", name: "Cheese Portions", stock: 100 },
  { id: "capsicum", name: "Capsicum", stock: 50 },
  { id: "onion", name: "Onion", stock: 50 },
  { id: "sweet-corn", name: "Sweet Corn", stock: 50 },
  { id: "olives", name: "Olives", stock: 50 },
  { id: "mushrooms", name: "Mushrooms", stock: 50 },
  { id: "tomato", name: "Tomato", stock: 50 },
  { id: "jalapenos", name: "Jalapeños", stock: 50 }
];

const vegetableInventoryIds = {
  Capsicum: "capsicum",
  Onion: "onion",
  "Sweet Corn": "sweet-corn",
  Olives: "olives",
  Mushrooms: "mushrooms",
  Tomato: "tomato",
  Jalapeños: "jalapenos"
};

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "pizza-delivery-api" });
});

// Menu
app.get("/api/menu", (_req, res) => {
  res.json(menu);
});

// Get all orders
app.get("/api/orders", async (_req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({ message: "Could not fetch orders." });
  }
});
// Create Razorpay order linked to pizza order
app.post(
  "/api/payment/create-order",
  authenticateToken,
  async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({
        message: "Razorpay API keys are not configured.",
      });
    }

    const { appOrderId } = req.body || {};

    if (!mongoose.isValidObjectId(appOrderId)) {
      return res.status(400).json({
        message: "Invalid pizza order ID.",
      });
    }

    const pizzaOrder = await Order.findById(appOrderId);

    if (!pizzaOrder) {
      return res.status(404).json({
        message: "Pizza order not found.",
      });
    }
    // Check whether this order belongs to the logged-in user
if (
  !pizzaOrder.userId ||
  pizzaOrder.userId.toString() !== req.user.userId
) {
  return res.status(403).json({
    message: "You are not authorized to verify this order.",
  });
}
    if (pizzaOrder.userId.toString() !== req.user.userId) {
  return res.status(403).json({
    message: "You are not authorized to pay for this order.",
  });
}

    if (pizzaOrder.paymentStatus !== "Demo payment pending") {
      return res.status(409).json({
        message: "This order is not awaiting payment.",
      });
    }

    const amountInPaise = Math.round(pizzaOrder.amount * 100);

    const paymentOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `pizza_${pizzaOrder._id}`,
    });

    pizzaOrder.razorpayOrderId = paymentOrder.id;
    await pizzaOrder.save();

    res.json({
      id: paymentOrder.id,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      appOrderId: pizzaOrder._id,
      customerName: pizzaOrder.customerName,
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error.message);
    res.status(500).json({
      message: "Could not create payment order.",
    });
  }
});
// Create order and deduct inventory
// Create order and deduct inventory
app.post(
  "/api/orders",
  authenticateToken,
  async (req, res) => {
  const { customerName, pizza } = req.body || {};

  // Validate required pizza options
  if (!pizza?.base || !pizza?.sauce || !pizza?.cheese) {
    return res.status(400).json({
      message: "Choose a base, sauce, and cheese first."
    });
  }

  // Validate base, sauce and cheese selections
  if (
    !menu.bases.includes(pizza.base) ||
    !menu.sauces.includes(pizza.sauce) ||
    !menu.cheeses.includes(pizza.cheese)
  ) {
    return res.status(400).json({
      message: "Invalid pizza selection."
    });
  }

  // Validate vegetables
  const vegetables = Array.isArray(pizza.vegetables)
    ? [...new Set(pizza.vegetables)]
    : [];

  const unknownVegetables = vegetables.filter(
    (vegetable) =>
      !menu.vegetables.includes(vegetable) ||
      !vegetableInventoryIds[vegetable]
  );

  if (unknownVegetables.length > 0) {
    return res.status(400).json({
      message: "One or more selected vegetables are invalid."
    });
  }

  // Calculate price on the backend
  const amount =
    249 +
    vegetables.length * 15 +
    (pizza.base === "Cheese Burst" ? 50 : 0);

  // Prepare inventory quantities
  const quantities = new Map([
    ["base", 1],
    ["sauce", 1],
    ["cheese", 1]
  ]);

  for (const vegetable of vegetables) {
    quantities.set(vegetableInventoryIds[vegetable], 1);
  }

  let session;

  try {
    session = await mongoose.startSession();

    let createdOrder;

    await session.withTransaction(async () => {

      // Check stock availability
      for (const [id, quantity] of quantities) {
        const item = await Inventory.findOne({ id }).session(session);

        if (!item) {
          const error = new Error(`Inventory item ${id} was not found.`);
          error.statusCode = 500;
          throw error;
        }

        if (item.stock < quantity) {
          const error = new Error(`Not enough stock for ${item.name}.`);
          error.statusCode = 409;
          throw error;
        }
      }

      // Deduct stock
      for (const [id, quantity] of quantities) {
        const updatedItem = await Inventory.findOneAndUpdate(
          { id, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          {
            new: true,
            runValidators: true,
            session
          }
        );

        if (!updatedItem) {
          const error = new Error(
            "Stock changed during ordering. Please try again."
          );
          error.statusCode = 409;
          throw error;
        }
      }

      // Save order in MongoDB
      [createdOrder] = await Order.create(
        [
          {
            customerName:
              typeof customerName === "string" && customerName.trim()
                ? customerName.trim()
                : "Guest Customer",
                userId: req.user.userId,

            pizza: {
              base: pizza.base,
              sauce: pizza.sauce,
              cheese: pizza.cheese,
              vegetables
            },

            amount,
            status: "Order Received",
            paymentStatus: "Demo payment pending"
          }
        ],
        { session }
      );
    });

    res.status(201).json(createdOrder);

  } catch (error) {
    console.error("Order creation failed:", error.message);

    res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Could not place order. Check the backend terminal."
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
});
// Update order status
app.patch(
  "/api/orders/:id/status",
  authenticateToken,
  authorizeAdmin,
  async (req, res) => {
  const allowed = [
    "Order Received",
    "In Kitchen",
    "Sent to Delivery"
  ];

  if (!allowed.includes(req.body?.status)) {
    return res.status(400).json({ message: "Invalid status." });
  }

  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    res.json(order);
  } catch (error) {
    console.error("Order status update failed:", error.message);
    res.status(500).json({ message: "Could not update order status." });
  }
});


// Verify Razorpay payment signature
// Verify Razorpay payment and update pizza order
app.post(
  "/api/payment/verify",
  authenticateToken,
  async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      appOrderId,
    } = req.body || {};

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !mongoose.isValidObjectId(appOrderId)
    ) {
      return res.status(400).json({
        message: "Missing or invalid payment details.",
      });
    }

    if (!razorpay || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        message: "Razorpay is not configured.",
      });
    }

    const pizzaOrder = await Order.findById(appOrderId);


    if (!pizzaOrder) {
      return res.status(404).json({
        message: "Pizza order not found.",
      });
    }
    // Check order ownership
if (
  !pizzaOrder.userId ||
  pizzaOrder.userId.toString() !== req.user.userId
) {
  return res.status(403).json({
    message: "You are not authorized to pay for this order.",
  });
}

    if (pizzaOrder.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        message: "Payment order does not match the pizza order.",
      });
    }

    if (pizzaOrder.paymentStatus === "Paid (Razorpay Test Mode)") {
      return res.json({
        message: "Payment was already verified.",
        order: pizzaOrder,
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const provided = Buffer.from(razorpay_signature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");

    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      return res.status(400).json({
        message: "Payment signature verification failed.",
      });
    }

    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== razorpay_order_id ||
      payment.amount !== Math.round(pizzaOrder.amount * 100) ||
      payment.currency !== "INR"
    ) {
      return res.status(400).json({
        message: "Payment details do not match the order.",
      });
    }

    if (payment.status !== "captured") {
      return res.status(409).json({
        message: "Payment has not been captured yet.",
      });
    }

    pizzaOrder.paymentStatus = "Paid (Razorpay Test Mode)";
    pizzaOrder.razorpayPaymentId = razorpay_payment_id;

    await pizzaOrder.save();

    res.json({
      message: "Payment verified successfully.",
      order: pizzaOrder,
    });
  } catch (error) {
    console.error("Payment verification failed:", error.message);
    res.status(500).json({
      message: "Could not verify payment.",
    });
  }
});

// Get inventory
app.get(
  "/api/admin/inventory",
  authenticateToken,
  authorizeAdmin,
  async (req, res) => {
  try {
    const inventoryItems = await Inventory.find().sort({ id: 1 });
    res.json(inventoryItems);
  } catch (error) {
    console.error("Inventory fetch failed:", error.message);
    res.status(500).json({ message: "Could not fetch inventory." });
  }
});

// Update inventory
app.patch(
  "/api/admin/inventory/:id",
  authenticateToken,
  authorizeAdmin,
  async (req, res) => {
  const stock = Number(req.body?.stock);

  if (!Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({
      message: "Stock must be a non-negative whole number."
    });
  }

  try {
    const item = await Inventory.findOneAndUpdate(
      { id: req.params.id },
      { stock },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        message: "Inventory item not found."
      });
    }

    res.json(item);
  } catch (error) {
    console.error("Inventory update failed:", error.message);
    res.status(500).json({
      message: "Could not update inventory."
    });
  }
});

// Connect MongoDB, initialize inventory, then start server
const port = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing from the .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    for (const item of initialInventory) {
      await Inventory.updateOne(
        { id: item.id },
        { $setOnInsert: item },
        { upsert: true, runValidators: true }
      );
    }

    console.log("Initial inventory is ready.");
    cron.schedule("0 * * * *", () => {
  console.log("Checking inventory for low stock...");
  checkLowStockAndNotifyAdmin();
});

    app.listen(port, () => {
      console.log(`Pizza API running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();