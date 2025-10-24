const express = require("express");
const mongoose = require("mongoose");
const Order = require("./models/order");
const config = require("./config");
const broker = require("./utils/messageBroker"); // <- usa el broker con reintentos

class App {
  constructor() {
    this.app = express();
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
    // 1) DB
    await this.connectDB();

    // 2) RabbitMQ con reintentos (ya no usamos setTimeout)
    await broker.connect();

    // 3) Consumer de la cola "orders"
    await broker.consumeMessage("orders", async (data) => {
      console.log("Consuming ORDER service");

      // data puede venir como objeto (nuestro broker ya hace JSON.parse seguro)
      const { products, username, orderId } = data;

      const newOrder = new Order({
        products,
        user: username,
        totalPrice: products.reduce((acc, p) => acc + p.price, 0),
      });

      await newOrder.save();

      // Publica en "products" el pedido cumplido (usa el broker)
      const { user, products: savedProducts, totalPrice } = newOrder.toJSON();
      await broker.publishMessage("products", {
        orderId,
        user,
        products: savedProducts,
        totalPrice,
      });

      console.log("Order saved to DB and published to PRODUCTS queue");
    });

    // 4) Server HTTP
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