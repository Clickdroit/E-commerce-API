const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createPaymentIntent, handleWebhook, refundPayment } = require('../controllers/paymentController');

// Stripe webhook — raw body parsing handled globally in app.js for this path
router.post('/webhook', handleWebhook);

router.post('/intent', authenticate, createPaymentIntent);
router.post('/:orderId/refund', authenticate, refundPayment);

module.exports = router;
