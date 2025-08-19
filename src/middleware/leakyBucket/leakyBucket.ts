import Koa from "koa";

import { StatusCodes, ReasonPhrases } from "http-status-codes";
import { getOrCreateUserBucket } from "./utils/utils";
import {
	consumeToken,
	createOrUpdateUserBucket,
} from "./services/tokenBucketService";

export const leakyBucketMiddleware = async (
	ctx: Koa.Context,
	next: () => Promise<void>,
) => {
	const userId = ctx.state.userToken;

	const userData = await getOrCreateUserBucket(userId);

	if (userData.tokensCount <= 0) {
		ctx.status = StatusCodes.TOO_MANY_REQUESTS;
		ctx.body = { error: ReasonPhrases.TOO_MANY_REQUESTS };
		return;
	}

	const tokensBefore = userData.tokensCount;

	await next();

	if (ctx.status >= StatusCodes.BAD_REQUEST) {
		await consumeToken(userId);
		return;
	}

	if (tokensBefore > 0) {
		await createOrUpdateUserBucket(userId, tokensBefore.toString());
	}
};
