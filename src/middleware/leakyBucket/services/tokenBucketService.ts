import { client } from "../../../lib/redis";

export async function createOrUpdateUserBucket(userId: string, tokens: string) {
	await client.hSet(userId, {
		tokensCount: tokens,
		lastRequest: Date.now().toString(),
	});
}

export async function consumeToken(userId: string): Promise<number> {
	const remainingTokens = await client.hIncrBy(userId, "tokensCount", -1);

	if (remainingTokens >= 0) {
		await client.hSet(userId, {
			lastRequest: Date.now().toString(),
		});
	} else {
		await client.hSet(userId, { tokensCount: 0 });
	}

	return remainingTokens;
}

export async function getUserBucket(
	userId: string,
): Promise<{ tokensCount: number; lastRequest: number }> {
	const userData = await client.hGetAll(userId);
	const parsedUserData = {
		tokensCount: parseInt(userData.tokensCount, 10),
		lastRequest: parseInt(userData.lastRequest, 10),
	};
	return parsedUserData;
}
