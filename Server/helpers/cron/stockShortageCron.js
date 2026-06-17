const cron = require("node-cron");
const {sendAllSystemStockShortageReport2, sendAllSystemStockShortageReport3} = require("../../controllers/rawMaterialItemsController/commonController");

const now = new Date();
const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", " IST");
 
cron.schedule(
  "59 10 * * *",
  async () => {
    console.log(`⏰ Running system stock shortage cron (IST): ${istTime}`);
    await sendAllSystemStockShortageReport2();
  },
  {
    timezone: "Asia/Kolkata",
  }
);

// cron.schedule(
//   "36 12 * * *",
//   async () => {
//     console.log(`⏰ Running system stock shortage cron (IST): ${istTime}`);
//     await sendAllSystemStockShortageReport3();
//   },
//   {
//     timezone: "Asia/Kolkata",
//   }
// );