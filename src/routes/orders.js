const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createOrder, getOrder, listOrders, cancelOrder } = require('../controllers/orderController');

router.post('/', authenticate, createOrder);
router.get('/', authenticate, listOrders);
router.get('/:id', authenticate, getOrder);
router.delete('/:id', authenticate, cancelOrder);

module.exports = router;
