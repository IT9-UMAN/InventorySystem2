const express = require("express");
const router = express.Router();
const adminController = require("../../controllers/rawMaterialItemsController/adminController");
const commonController = require("../../controllers/rawMaterialItemsController/commonController");
const {generateRawMaterialStockPDF, generateServiceRecordPDF, generateDailyServiceRecordPDF} = require("../../helpers/rawMaterialItemsHelpers/generateReports");
const {deleteRawMaterialReport} = require("../../helpers/rawMaterialItemsHelpers/deleteRawMaterialReports");
const {tokenVerification} = require("../../middlewares/rawMaterialMiddlewares/tokenVerification");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.get("/showEmployees", tokenVerification(['Admin']), adminController.showEmployees);
router.put("/deactivateEmployee", tokenVerification(['Admin']), adminController.deactivateEmployee);
router.put("/activateEmployee", tokenVerification(['Admin']), adminController.activateEmployee);
router.post("/addItem", tokenVerification(['Admin']),  adminController.addItem);

router.post("/addRawMaterial", tokenVerification(['Admin']), adminController.addRawMaterial);

router.get("/showItems", tokenVerification(['Admin']), adminController.showItems);

router.get("/showRawMaterials", tokenVerification(['Admin']), adminController.showRawMaterials);

router.delete("/deleteItem", tokenVerification(['Admin']), adminController.deleteItem);

router.delete("/deleteAllRawMaterials", tokenVerification(['Admin']), adminController.deleteAllRawMaterials);

router.post("/updateRawMaterialStock", tokenVerification(['Admin']), adminController.updateRawMaterialStock);

router.post("/addWarehouse", tokenVerification(['Admin']), adminController.addWarehouse);
router.get("/showDefectiveItemsOfWarehouse", tokenVerification(['Admin']), adminController.getDefectiveItemsForWarehouse);
router.get("/getItemsByName", tokenVerification(['Admin']), adminController.getItemsByName);
router.get("/getRawMaterialsByItemId", tokenVerification(['Admin']), adminController.getRawMaterialsByItemId);
router.post("/addServiceRecord", tokenVerification(['Admin']), adminController.addServiceRecord);
router.get("/getItemRawMaterials", tokenVerification(['Admin']), adminController.getItemRawMaterials);
router.get("/getRepairedServiceRecords", tokenVerification(['Admin']), adminController.getRepairedServiceRecords);
router.get("/getRejectedServiceRecords", tokenVerification(['Admin']), adminController.getRejectedServiceRecords);
router.post("/addUnit", tokenVerification(['Admin']), adminController.addUnit);
router.get("/showUnit", tokenVerification(['Admin']), adminController.showUnit);
router.post("/attachItemToRawMaterial", tokenVerification(['Admin']), adminController.attachItemToRawMaterial);
router.put("/updateItemRawMaterial", tokenVerification(['Admin']), adminController.updateItemRawMaterial);
router.delete("/deleteItemRawMaterial", tokenVerification(['Admin']), adminController.deleteItemRawMaterial);
router.post("/produceNewItem", adminController.produceNewItem);
router.get("/getItemsProducibleCount", adminController.getItemsProducibleCount);
router.get("/getInsufficientRawMaterials", adminController.getInsufficientRawMaterials);
router.get("/showOverallServiceData", tokenVerification(['Admin']), adminController.showOverallRepairedOrRejectedData);
router.get("/showProductionSummary", tokenVerification(['Admin']), adminController.showProductionSummary);
router.get("/getAllProductionLogs", tokenVerification(['Admin']), adminController.getAllProductionLogs);

router.get("/generateServiceRecordPDF", generateServiceRecordPDF);
router.get("/generateRawMaterialStockPDF", generateRawMaterialStockPDF);
router.get("/generateDailyServiceRecordPDF", generateDailyServiceRecordPDF);
router.delete("/deleteRawMaterialReport", deleteRawMaterialReport);

router.post("/addBOM", adminController.addBOM);
router.post("/addBOMByExcel", upload.single("file"), adminController.addBOMByExcel);
router.post("/updateBOM", adminController.updateBOM);
router.delete("/detachRawMaterialFromItem", adminController.detachRawMaterialFromItem);
router.post("/addStage", adminController.addStage);
router.post("/addItemType", adminController.addItemType);
router.post("/attachItemTypeWithStage", adminController.attachItemTypeWithStage);
router.post("/addStageFlow", adminController.addStageFlow);
router.post("/addFailureRedirectStage", adminController.addFailureRedirectStage);
router.get("/showStages", adminController.showStages);
router.get("/showProductType", adminController.showProductType);
router.get("/showStagesByItemType", adminController.showStagesByItemType);
router.get("/showStageFlow", adminController.showStageFlow);
router.get("/showFailureRedirectStage", adminController.showFailureRedirectStage);

router.get("/showStockUpdateHistory", adminController.showStockUpdateHistory);
router.get("/showDefectiveItemsList", commonController.getDefectiveItemsListByWarehouse);

router.get("/showPaymentRequests", tokenVerification(['Admin']), adminController.showDocsVerifiedPaymentRequests);
router.patch("/updateApprovalStatus", tokenVerification(['Admin']), adminController.approveOrRejectMultiplePaymentsByAdmin);
router.get("/getPOsForApproval", tokenVerification(['Admin', "Verification"]), adminController.getPOsForAdminApproval);
router.put("/poApprovalAction", tokenVerification(['Admin']), adminController.poApprovalAction);
router.get("/previewPOPdf", tokenVerification(['Admin', "Verification", "Accounts"]), adminController.previewPOPdf);

//Version2 - Routes
router.get("/getPOsForApproval2", tokenVerification(['Admin', "Verification"]), adminController.getPOsForAdminApproval2);
router.get("/showPaymentRequests2", tokenVerification(['Admin']), adminController.showDocsVerifiedPaymentRequests2);

module.exports = router;