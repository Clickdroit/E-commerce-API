const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getShipment, trackShipment, updateShipmentStatus } = require('../controllers/shipmentController');

router.get('/track/:trackingNumber', trackShipment);
router.get('/order/:orderId', authenticate, getShipment);
router.patch('/:id/status', authenticate, updateShipmentStatus);

module.exports = router;
