const amqp = require("amqplib");
const logger = require("./logger.js");
require("dotenv").config();

let connection = null;
let channel = null;

const EXCHANGE_NAME = "socialp_events";

const connectToRabbitMQ = async (retries = 10, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const amqpUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";
      connection = await amqp.connect(amqpUrl);
      channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: false });
      logger.info("Connected to RabbitMQ");
      return channel;
    } catch (error) {
      logger.error(`RabbitMQ connection failed (Attempt ${i + 1}/${retries}): ${error.message}`);
      if (i === retries - 1) {
        logger.error("Could not connect to RabbitMQ. Exiting.");
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

const getChannel = () => {
  if (!channel) {
    throw new Error("RabbitMQ channel not established. Connect first.");
  }
  return channel;
};

const publishEvent = async (routingKey, message) => {//routingKey=>just an action string(describes event),message=>actual data to be send
  try {
    const channel = getChannel();
    channel.publish(
      EXCHANGE_NAME,
      routingKey,
      Buffer.from(JSON.stringify(message))
    );
    logger.info(`Event published to RabbitMQ: ${routingKey}`);
  } catch (error) {
    logger.error(
      `Failed to publish event with routingKey ${routingKey}`,
      error
    );
  }
};

module.exports = { connectToRabbitMQ, EXCHANGE_NAME, publishEvent };
