const express = require("express");
const httpProxy = require("http-proxy");

const proxy = httpProxy.createProxyServer();
const app = express();

// Route requests to the auth service
app.get("/", (_req, res) => {
  res.send("API Gateway OK");
});

app.use("/api/auth", (req, res) => {
   req.url = req.originalUrl.replace(/^\/api\/auth/, "/");
  proxy.web(req, res, { target: "http://auth:3000" });
});

// --- PRODUCT SERVICE ---
app.use("/api/products", (req, res) => {
   req.url = req.originalUrl.replace(/^\/api\/products/, "/api/products");
  proxy.web(req, res, { target: "http://product:3001" });
});

// --- ORDER SERVICE ---
app.use("/api/orders", (req, res) => {
  req.url = req.originalUrl.replace(/^\/api\/orders/, "/orders");
  proxy.web(req, res, { target: "http://order:3002" });
});

proxy.on("error", (err, req, res) => {
  console.error(`Error proxying ${req.url}:`, err.message);
  if (!res.headersSent) {
    res.writeHead(502, { "Content-Type": "application/json" });
  }
  res.end(
    JSON.stringify({
      success: false,
      error: "Service unavailable",
      message: err.message,
    })
  );
});

// Start the server
const port = process.env.PORT || 3003;
app.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});
