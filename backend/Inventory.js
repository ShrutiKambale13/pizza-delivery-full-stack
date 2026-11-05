import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: true
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Stock must be a whole number."
      }
    }
  },
  {
    timestamps: true
  }
);

const Inventory =
  mongoose.models.Inventory ||
  mongoose.model("Inventory", inventorySchema);

export default Inventory;