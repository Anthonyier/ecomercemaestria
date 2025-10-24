require("dotenv").config();
const App = require("./src/app");

const app = new App();
app.start().catch((e) => {
  console.error("Fatal start error:", e);
  process.exit(1);
});