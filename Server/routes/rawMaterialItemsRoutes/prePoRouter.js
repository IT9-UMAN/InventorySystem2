const express = require('express');
const { createPrePoRequest, getPrePoRequest } = require('../../controllers/rawMaterialItemsController/prePoController');

const router = express.Router();


router.get('/pre-po-request', getPrePoRequest);
router.post('/pre-po-request', createPrePoRequest);






module.exports = router;