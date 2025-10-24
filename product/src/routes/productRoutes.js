const express = require("express");
const ProductController = require("../controllers/productController");
const isAuthenticated = require("../utils/isAuthenticated");

const router = express.Router();
const productController = new ProductController();

//router.post("/", isAuthenticated, productController.createProduct);
//router.post("/buy", isAuthenticated, productController.createOrder);
//router.get("/", isAuthenticated, productController.getProducts);
router.post("/", /* isAuthenticated, */ productController.createProduct);   // POST /api/products
router.post("/buy", /* isAuthenticated, */ productController.createOrder);  // POST /api/products/buy
router.get("/", /* isAuthenticated, */ productController.getProducts);      // GET  /api/products


module.exports = router;
