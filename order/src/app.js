const express = require("express");
const mongoose = require("mongoose");
const Order = require("./models/order");
const config = require("./config");
const broker = require("./utils/messageBroker");

class App {
  constructor() {
    this.app = express();
    this.setRoutes(); // 
  }

  setRoutes() {
    this.app.use(express.json());

    this.app.get("/health", (_req, res) => res.json({ ok: true }));

    this.app.get("/orders", async (_req, res) => {
      try {
        const orders = await Order.find().sort({ createdAt: -1 }).limit(50);
        res.json(orders);
      } catch (err) {
        res.status(500).json({ message: "Error fetching orders" });
      }
    });
  }

  async connectDB() {
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
  }

  async disconnectDB() {
    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  }

  async start() {
    await this.connectDB();
    await broker.connect();

    await broker.consumeMessage("orders", async (data) => {
      console.log("Consuming ORDER service");
      const { products, username, orderId } = data;

      const newOrder = new Order({
        products,
        user: username,
        totalPrice: products.reduce((acc, p) => acc + p.price, 0),
      });

      await newOrder.save();

      const { user, products: savedProducts, totalPrice } = newOrder.toJSON();
      await broker.publishMessage("products", {
        orderId,
        user,
        products: savedProducts,
        totalPrice,
      });

      console.log("Order saved to DB and published to PRODUCTS queue");
    });

    this.server = this.app.listen(config.port, () =>
      console.log(`Server started on port ${config.port}`)
    );
  }

  async stop() {
    await mongoose.disconnect();
    if (this.server) this.server.close();
    console.log("Server stopped");
  }
}

module.exports = App;