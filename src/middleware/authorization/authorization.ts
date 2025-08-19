import Koa from "koa";
import { ReasonPhrases, StatusCodes } from "http-status-codes";

export const authorizationMiddleware = async (
	ctx: Koa.Context,
	next: () => Promise<void>,
) => {
	const authorization = ctx.headers.authorization;

	if (!authorization) {
		ctx.status = StatusCodes.UNAUTHORIZED;
		ctx.body = { error: ReasonPhrases.UNAUTHORIZED };
		return;
	}

	if (!authorization.startsWith("Bearer ")) {
		ctx.status = StatusCodes.UNAUTHORIZED;
		ctx.body = { error: "Invalid token format" };
		return;
	}

	const userToken = authorization?.split(" ")[1];

	ctx.state.userToken = userToken;

	await next();
};
