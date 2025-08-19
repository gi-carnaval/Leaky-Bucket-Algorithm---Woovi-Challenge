import { MAX_TOKENS, REFILL_TOKENS_INTERVAL } from "../../../utils/constants";
import {
	createOrUpdateUserBucket,
	getUserBucket,
} from "../services/tokenBucketService";

export const verifyAndReffilTokens = async (
	userToken: string,
	tokensCount: number,
	lastRequest: number,
) => {
	const tokensToAdd = calculateRefill(lastRequest, REFILL_TOKENS_INTERVAL);

	if (tokensToAdd > 0 && tokensCount < MAX_TOKENS) {
		const newTokenCount = Math.min(MAX_TOKENS, tokensCount + tokensToAdd);

		await createOrUpdateUserBucket(userToken, newTokenCount.toString());

		return {
			tokensCount: newTokenCount,
			lastRequest: Date.now(),
		};
	}

	return {
		tokensCount: tokensCount,
		lastRequest: lastRequest,
	};
};

export const getOrCreateUserBucket = async (
	userToken: string,
): Promise<{
	tokensCount: number;
	lastRequest: number;
}> => {
	const userData = await getUserBucket(userToken);

	const now = Date.now().toString();

	if (isNaN(userData.tokensCount) || isNaN(userData.lastRequest)) {
		await createOrUpdateUserBucket(userToken, MAX_TOKENS.toString());

		const bucketData = {
			tokensCount: MAX_TOKENS,
			lastRequest: parseInt(now, 10),
		};

		return bucketData;
	}

	const refilledTokens = await verifyAndReffilTokens(
		userToken,
		userData.tokensCount,
		userData.lastRequest,
	);

	const bucketData = {
		tokensCount: refilledTokens.tokensCount,
		lastRequest: refilledTokens.lastRequest,
	};

	return bucketData;
};

export function calculateRefill(lastRequest: number, rate: number): number {
	const now = Date.now();
	const elapsed = now - lastRequest;

	return Math.floor(elapsed / rate);
}
