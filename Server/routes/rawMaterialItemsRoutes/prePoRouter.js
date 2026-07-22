const express = require('express');
const { createPrePoRequest, getPrePoRequest, changeRequestStatus ,editPrePoRequest} = require('../../controllers/rawMaterialItemsController/prePoController');
const { tokenVerification } = require('../../middlewares/rawMaterialMiddlewares/tokenVerification');

const router = express.Router();




// get pre po
router.get('/pre-po-request', tokenVerification(['PrePurchase', 'Purchase','Production']), getPrePoRequest);

// create request
router.post('/pre-po-request', tokenVerification(['PrePurchase','Production']), createPrePoRequest);

// edit request
router.put('/pre-po-request/:prePoId',tokenVerification(['PrePurchase','Production']),editPrePoRequest);

// change request status
router.post('/pre-po-request/:prePoId', tokenVerification(['PrePurchase', 'Purchase','Production']), changeRequestStatus);


module.exports = router;