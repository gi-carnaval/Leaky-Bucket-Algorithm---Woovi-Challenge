import { client } from "../lib/redis";

export async function createOrUpdateUserBucket(userToken: string, tokens: number) {
  await client.hSet(userToken, {
    tokens_count: tokens.toString(),
    last_request: Date.now().toString()
  })
}