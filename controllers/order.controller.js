import createError from "../utils/createError.js";
import Order from "../models/order.model.js";
import Gig from "../models/gig.model.js";
import Stripe from "stripe";

export const checkUserPurchase = async (req, res, next) => {
  try {
    const gigId = req.params.gigId;
    
    // If not authenticated, return false
    if (!req.userId) {
      return res.status(200).json({ hasPurchased: false });
    }
    
    const orders = await Order.find({
      gigId: gigId,
      buyerId: req.userId,
      isCompleted: true,
    });
    
    res.status(200).json({ hasPurchased: orders.length > 0 });
  } catch (err) {
    next(err);
  }
};

export const intent = async (req, res, next) => {
  const stripe = new Stripe(process.env.STRIPE);

  const gig = await Gig.findById(req.params.id);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: gig.price * 100,
    currency: "usd",
    automatic_payment_methods: {
      enabled: true,
    },
  });

  const newOrder = new Order({
    gigId: gig._id,
    img: gig.cover,
    title: gig.title,
    buyerId: req.userId,
    sellerId: gig.userId,
    price: gig.price,
    payment_intent: paymentIntent.id,
  });

  await newOrder.save();

  res.status(200).send({
    clientSecret: paymentIntent.client_secret,
  });
};

export const getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({
      ...(req.isSeller ? { sellerId: req.userId } : { buyerId: req.userId }),
      isCompleted: true,
    });

    res.status(200).send(orders);
  } catch (err) {
    next(err);
  }
};

export const confirm = async (req, res, next) => {
  try {
    // Find the order by payment_intent
    const order = await Order.findOne({
      payment_intent: req.body.payment_intent,
    });
    
    if (!order) {
      return next(createError(404, "Order not found"));
    }
    
    // Check if order is already completed to avoid double counting
    if (order.isCompleted) {
      return res.status(200).send("Order was already confirmed.");
    }
    
    // Update order status to completed
    await Order.findOneAndUpdate(
      {
        payment_intent: req.body.payment_intent,
      },
      {
        $set: {
          isCompleted: true,
        },
      }
    );

    // Increment the sales count for the gig (only once)
    await Gig.findByIdAndUpdate(
      order.gigId,
      {
        $inc: { sales: 1 },  // Ensure this is exactly 1
      }
    );

    res.status(200).send("Order has been confirmed.");
  } catch (err) {
    next(err);
  }
};