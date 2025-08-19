import { createClient } from "redis";
import 'dotenv/config'

const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;

const client = createClient({
	url: `redis://${redisHost}:${redisPort}`,
});

client.on("error", (err) => {
	console.error("Erro no Redis: ", err);
});

async function connectRedis() {
	if (!client.isOpen) {
		await client.connect();
	}
}

export { client, connectRedis };
