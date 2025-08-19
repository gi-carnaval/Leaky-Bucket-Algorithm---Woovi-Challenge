import { createClient, RedisClientType } from "redis";
import 'dotenv/config'

let client: RedisClientType

function createRedisClient(customClient?: RedisClientType) {
	if (customClient) {
		client = customClient
	} else {
		const redisHost = process.env.REDIS_HOST;
		const redisPort = process.env.REDIS_PORT;

		const client = createClient({
			url: `redis://${redisHost}:${redisPort}`,
		});

		client.on("error", (err) => {
			console.error("Erro no Redis: ", err);
		});

		return client

	}
}

async function connectRedis() {
	if (!client) {
		createRedisClient();
	}
	if (!client.isOpen) {
		await client.connect();
	}
}

export { client, connectRedis, createRedisClient };
