require("dotenv").config();

module.exports = {
  port: process.env.PORT ||3001,
  mongoURI: process.env.MONGODB_PRODUCT_URI || "mongodb://sa:Abc12345@mongodb_product:27017/products_db?authSource=admin",
  rabbitMQURI: process.env.RABBITMQ_URI || "amqp://Admin:Abc12345@rabbitmq:5672/%2F",
  // mongoURI: process.env.MONGODB_PRODUCT_URI || "mongodb://localhost/products",
  // rabbitMQURI: process.env.RABBITMQ_URI || "amqp://localhost",
  exchangeName: "products",
  queueName: "products_queue",
};
