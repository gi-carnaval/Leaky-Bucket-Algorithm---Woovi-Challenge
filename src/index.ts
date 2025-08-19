import Koa from "koa";
import Router from "@koa/router";
import { StatusCodes } from "http-status-codes";
import { leakyBucketMiddleware } from "./middleware/leakyBucket";
import { authorizationMiddleware } from "./middleware/authorization";

const app = new Koa();
const router = new Router();

app
	.use(authorizationMiddleware)
	.use(leakyBucketMiddleware)
	.use(
		router
			.get("/path", (ctx) => {
				const { fail } = ctx.query;

				if (fail === "true") {
					ctx.status = StatusCodes.BAD_REQUEST;
					ctx.body = { error: "Pix key not found" };
					return;
				}

				ctx.status = StatusCodes.OK;
				ctx.body = { pixKey: "fake-pix-key", value: 100 };
			})
			.routes(),
	);

export { app };
