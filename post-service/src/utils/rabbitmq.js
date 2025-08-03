const amqp = require("amqplib");
const logger = require("./logger.js");
require("dotenv").config();

let connection = null;
let channel = null;

const EXCHANGE_NAME = "socialp_events";

const connectToRabbitMQ = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: false });
    logger.info("Connected to RabbitMQ");
    return channel;
  } catch (error) {
    logger.error("Error connecting to Rabbit MQ", error);
    process.exit(1);
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
