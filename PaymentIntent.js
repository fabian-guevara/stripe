const Stripe = require('stripe');

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(secretKey);

const createPaymentIntent = async ({ amount, currency }) => {
  try {
    return await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
    });
  } catch (error) {
    console.error('Error creating PaymentIntent:', error.message);
    throw error;
  }
};

module.exports = {
  createPaymentIntent,
};