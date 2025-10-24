const amqp = require("amqplib");

const DEFAULT_URI = "amqp://Admin:Abc12345@rabbitmq:5672/%2F";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let conn = null;
let channel = null;
let connecting = null;

async function ensureConnected() {
  if (channel) return channel;
  if (connecting) return connecting;

  const uri = process.env.RABBITMQ_URI || DEFAULT_URI;

  connecting = (async () => {
    let attempt = 0;
    while (!channel) {
      try {
        attempt++;
        console.log(`Connecting to RabbitMQ (attempt ${attempt})...`);
        conn = await amqp.connect(uri);

        conn.on("error", (err) => console.error("[AMQP] conn error:", err.message));
        conn.on("close", () => {
          console.warn("[AMQP] conn closed. Reconnecting...");
          channel = null;
          conn = null;
          ensureConnected().catch(() => {});
        });

        channel = await conn.createConfirmChannel();

        channel.on("error", (err) => console.error("[AMQP] ch error:", err.message));
        channel.on("close", () => {
          console.warn("[AMQP] ch closed. Recreating...");
          channel = null;
          ensureConnected().catch(() => {});
        });

        console.log("RabbitMQ connected");
      } catch (err) {
        const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
        console.log(
          `RabbitMQ not ready (${err.code || err.message}). Retry in ${Math.round(delay / 1000)}s`
        );
        await sleep(delay);
      }
    }
    return channel;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

class MessageBroker {
  async connect() {
    return ensureConnected();
  }

  async publishMessage(queue, message, options = {}) {
    const ch = await ensureConnected();
    await ch.assertQueue(queue, { durable: true });

    const payload =
      typeof message === "string" ? Buffer.from(message) : Buffer.from(JSON.stringify(message));

    const ok = ch.sendToQueue(queue, payload, {
      persistent: true,
      contentType: "application/json",
      ...options,
    });

    if (!ok) await new Promise((resolve) => ch.once("drain", resolve));
    await ch.waitForConfirms();
  }

  async consumeMessage(queue, handler) {
    const ch = await ensureConnected();
    await ch.assertQueue(queue, { durable: true });
    await ch.prefetch(10);

    await ch.consume(
      queue,
      async (msg) => {
        if (!msg) return;
        try {
          const raw = msg.content.toString();
          const body = safeJson(raw);
          await handler(body);
          ch.ack(msg);
        } catch (e) {
          console.error("Handler error, requeue=false:", e);
          ch.nack(msg, false, false);
        }
      },
      { noAck: false }
    );
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