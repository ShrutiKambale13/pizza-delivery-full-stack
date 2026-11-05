import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: true,
      default: "Guest Customer"
    },
    userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true
},
    pizza: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: ["Order Received", "In Kitchen", "Sent to Delivery"],
      default: "Order Received"
    },
    paymentStatus: {
      type: String,
      default: "Demo payment pending"
    },
    razorpayOrderId: {
  type: String,
  default: null,
},
razorpayPaymentId: {
  type: String,
  default: null,
},
inventoryRestored: {
  type: Boolean,
  default: false
},
},
  {
    timestamps: true
  }
);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;