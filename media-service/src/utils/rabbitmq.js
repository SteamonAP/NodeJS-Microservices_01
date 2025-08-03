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

const publishEvent = async (routingKey, message) => {
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

const consumeEvent = async (routingKey, callback) => {
  try {
    const channel = getChannel();

    const q = await channel.assertQueue("", { exclusive: true });//exclusive option means: "This queue is mine and mine alone. When my connection to you closes (e.g., my server crashes), you can automatically delete this queue.
    logger.info(`Waiting for messages in queue: ${q.queue}`);

    await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey);

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
  publishEvent,
  consumeEvent,
};
