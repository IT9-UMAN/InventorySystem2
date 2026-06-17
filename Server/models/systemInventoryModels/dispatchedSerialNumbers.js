const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const dispatchSerialNumbersSchema = new Schema(
  {
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      required: true,
    },
    farmerSaralIds: {
      type: [String],
      default: [],
    },
    panels: {
      type: [String],
      default: [],
    },
    motors: {
      type: [String],
      default: [],
    },
    pumps: {
      type: [String],
      default: [],
    },
    controllers: {
      type: [String],
      default: [],
    }, 
    rmus: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "WarehousePerson",
      required: true,
    },
    updatedBy: {
      type: String,
    },
  },
  { timestamps: true, collection: "inDispatchSerialNumbers" },
);

const DispatchSerialNumbers = mongoose.model("DispatchSerialNumbers", dispatchSerialNumbersSchema);
module.exports = DispatchSerialNumbers;
