const express = require('express');
const { createPrePoRequest, getPrePoRequest, changeRequestStatus } = require('../../controllers/rawMaterialItemsController/prePoController');
const { tokenVerification } = require('../../middlewares/rawMaterialMiddlewares/tokenVerification');

const router = express.Router();



// get pre po
router.get('/pre-po-request', tokenVerification(['PrePurchase', 'Purchase']), getPrePoRequest);

// create request
router.post('/pre-po-request', tokenVerification(['PrePurchase']), createPrePoRequest);


// change request status
router.post('/pre-po-request/:prePoId', tokenVerification(['PrePurchase', 'Purchase']), changeRequestStatus);


module.exports = router;