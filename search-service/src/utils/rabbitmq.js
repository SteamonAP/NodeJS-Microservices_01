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

const consumeEvent = async (routingKey, callback) => {
  try {
    const channel = getChannel();

    const q = await channel.assertQueue("", { exclusive: true }); //exclusive option means: "This queue is mine and mine alone. When my connection to you closes (e.g., my server crashes), you can automatically delete this queue.
    logger.info(`Waiting for messages in queue: ${q.queue}`);

    await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey);//routing key for partial matching and sending messages 

    channel.consume(
      q.queue,
      (msg) => {
        if (msg !== null) {
          const content = JSON.parse(msg.content.toString());

          callback(content);
          channel.ack(msg); //acknoledge the message to remove from queue
        }
      },
      { noAck: false }
    );

    logger.info(`Subscribed to event: ${routingKey}`);
  } catch (error) {
    logger.info(`Error in subscribing to event: ${routingKey}`, error);
    throw error;
  }
};

module.exports = {
  connectToRabbitMQ,
  EXCHANGE_NAME,
  consumeEvent,
};
