import RedisMemoryServer from "redis-memory-server";
import { createClient, RedisClientType } from "redis";
import { createRedisClient } from "../lib/redis";

let redisServer: RedisMemoryServer
let testClient: RedisClientType

export async function startRedisMemory() {
  redisServer = new RedisMemoryServer();
  const port = await redisServer.getPort();

  testClient = createClient({ socket: { port, host: '127.0.0.1' } });
  await testClient.connect();

  createRedisClient(testClient);

  return testClient;
}

export async function stopRedisMemory() {
  if (testClient) await testClient.quit();
  if (redisServer) await redisServer.stop();
}

export { testClient as client }