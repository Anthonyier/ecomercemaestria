const amqp = require("amqplib");

const DEFAULT_URI = "amqp://Admin:Abc12345@rabbitmq:5672/%2F";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class MessageBroker {
  constructor() {
    this.conn = null;
    this.channel = null;
    this.connecting = null;
  }

  async connect() {
    if (this.channel) return this.channel;
    if (this.connecting) return this.connecting;

    const uri = process.env.RABBITMQ_URI || DEFAULT_URI;

    this.connecting = (async () => {
      let attempt = 0;
      while (!this.channel) {
        try {
          attempt++;
          console.log(`Connecting to RabbitMQ (attempt ${attempt})...`);
          this.conn = await amqp.connect(uri);

          this.conn.on("error", (err) =>
            console.error("[AMQP] connection error:", err.message)
          );
          this.conn.on("close", () => {
            console.warn("[AMQP] connection closed. Reconnecting...");
            this._reset();
            this.connect().catch(() => {});
          });

          this.channel = await this.conn.createConfirmChannel();

          this.channel.on("error", (err) =>
            console.error("[AMQP] channel error:", err.message)
          );
          this.channel.on("close", () => {
            console.warn("[AMQP] channel closed. Recreating...");
            this.channel = null;
            this.connect().catch(() => {});
          });

          await this.channel.assertQueue("products", { durable: true });
          await this.channel.prefetch(10);

          console.log("RabbitMQ connected");
          break;
        } catch (err) {
          const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
          console.log(
            `RabbitMQ not ready (${err.code || err.message}). Retry in ${Math.round(
              delay / 1000
            )}s`
          );
          await sleep(delay);
        }
      }
      return this.channel;
    })();

    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async publishMessage(queue, message, options = {}) {
    await this.connect();
    const payload =
      typeof message === "string"
        ? Buffer.from(message)
        : Buffer.from(JSON.stringify(message));

    const ok = this.channel.sendToQueue(queue, payload, {
      persistent: true,
      contentType: "application/json",
      ...options,
    });

    if (!ok) {
      await new Promise((resolve) => this.channel.once("drain", resolve));
    }
    await this.channel.waitForConfirms();
  }

  async consumeMessage(queue, handler) {
    await this.connect();
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.consume(
      queue,
      async (msg) => {
        if (!msg) return;
        try {
          const raw = msg.content.toString();
          const body = safeJson(raw);
          await handler(body);
          this.channel.ack(msg);
        } catch (e) {
          console.error("Handler error, requeue=false:", e);
          this.channel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
    } catch {}
    try {
      if (this.conn) await this.conn.close();
    } catch {}
    this._reset();
  }

  _reset() {
    this.channel = null;
    this.conn = null;
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

module.exports = new MessageBroker();
