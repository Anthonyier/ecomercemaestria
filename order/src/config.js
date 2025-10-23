require('dotenv').config();

module.exports = {
  port: process.env.PORT ||3002,
  mongoURI: process.env.MONGODB_ORDER_URI || 'mongodb://sa:Abc12345@mongodb_order:27017/orders_db?authSource=admin',
  rabbitMQURI: process.env.RABBITMQ_URI || 'amqp://Admin:Abc12345@rabbitmq:5672/%2F',
  // mongoURI: process.env.MONGODB_ORDER_URI || 'mongodb://localhost/orders',
  // rabbitMQURI: 'amqp://localhost',
  exchangeName: 'orders',
  queueName: "orders_queue",
    
};
  