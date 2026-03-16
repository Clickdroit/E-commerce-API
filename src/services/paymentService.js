const stripe = require('../config/stripe');
const logger = require('../utils/logger');

const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'eur';

const paymentService = {
  async createPaymentIntent(amount, currency = DEFAULT_CURRENCY, metadata = {}) {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses smallest currency unit
      currency,
      metadata,
      automatic_payment_methods: { enabled: true },
    });
    logger.info('Payment intent created', { paymentIntentId: paymentIntent.id, amount });
    return paymentIntent;
  },

  async confirmPayment(paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    logger.info('Payment intent retrieved', { paymentIntentId, status: paymentIntent.status });
    return paymentIntent;
  },

  async createRefund(chargeId, amount) {
    const refundParams = { charge: chargeId };
    if (amount !== undefined) {
      refundParams.amount = Math.round(amount * 100);
    }
    const refund = await stripe.refunds.create(refundParams);
    logger.info('Refund created', { chargeId, refundId: refund.id });
    return refund;
  },
};

module.exports = paymentService;
