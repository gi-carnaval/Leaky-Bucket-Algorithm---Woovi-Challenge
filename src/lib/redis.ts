import { createClient } from "redis";

const client = createClient({
	url: "redis://localhost:6379",
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
