require('dotenv').config();

const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars');
const Stripe = require('stripe');

const { createPaymentIntent } = require('./PaymentIntent');

const app = express();
const port = process.env.PORT || 3000;

/**
 * Validate required environment variables
 */
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

if (!process.env.STRIPE_PUBLISHABLE_KEY) {
  throw new Error('Missing STRIPE_PUBLISHABLE_KEY environment variable');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Product catalog
 *
 * Prices are stored server-side in the smallest currency unit.
 * For USD, 2300 represents $23.00.
 */
const books = {
  '1': {
    title: 'The Art of Doing Science and Engineering',
    amount: 2300,
  },
  '2': {
    title: 'The Making of Prince of Persia: Journals 1985-1993',
    amount: 2500,
  },
  '3': {
    title: 'Working in Public: The Making and Maintenance of Open Source',
    amount: 2800,
  },
};

/**
 * View engine setup
 */
app.engine(
  'hbs',
  exphbs({
    defaultLayout: 'main',
    extname: '.hbs',
  })
);

app.set('view engine', 'hbs');

/**
 * Middleware
 */
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/**
 * Home route
 */
app.get('/', (req, res) => {
  res.render('index');
});

/**
 * Checkout route
 *
 * Creates a PaymentIntent using the price stored on the server
 * and passes its client secret to the Payment Element.
 */
app.get('/checkout', async (req, res) => {
  const book = books[req.query.item];

  if (!book) {
    return res.status(400).render('index', {
      error: 'Please select a valid book.',
    });
  }

  try {
    const paymentIntent = await createPaymentIntent({
      amount: book.amount,
      currency: 'usd',
    });

    return res.render('checkout', {
      title: book.title,
      amount: book.amount,
      clientSecret: paymentIntent.client_secret,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (error) {
    console.error('Checkout initialization error:', error);

    return res.status(500).render('checkout', {
      title: book.title,
      amount: book.amount,
      error: 'Unable to initialize the payment. Please try again.',
    });
  }
});

/**
 * 
 * conncatenate the PaymentIntent ID to the return URL after stripe.confirmPayment() 
 */
app.get('/success', async (req, res) => {
  const paymentIntentId = req.query.payment_intent;

  if (
    typeof paymentIntentId !== 'string' ||
    !paymentIntentId.startsWith('pi_')
  ) {
    return res.status(400).render('success', {
      error: 'Invalid or missing payment confirmation.',
    });
  }

  try {
    /*
     * Retrieve the PaymentIntent from Stripe instead of trusting
     * payment information received directly from the browser.
     */
    const paymentIntent =
      await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).render('success', {
        error: 'The payment has not been completed.',
        paymentIntentId: paymentIntent.id,
        paymentStatus: paymentIntent.status,
      });
    }

    const amountReceived = paymentIntent.amount_received || paymentIntent.amount;

    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: paymentIntent.currency.toUpperCase(),
    }).format(amountReceived / 100);

    return res.render('success', {
      amount: formattedAmount,
      paymentIntentId: paymentIntent.id,
      paymentStatus: paymentIntent.status,
    });
  } catch (error) {
    console.error('Payment verification error:', error);

    return res.status(500).render('success', {
      error: 'Unable to verify the payment.',
    });
  }
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).render('index', {
    error: 'Page not found.',
  });
});

/**
 * Start server
 */
app.listen(port, () => {
  console.log(`Stripe Press is running at http://localhost:${port}`);
});