import Koa from 'koa';
import Router from '@koa/router';
import { client } from './lib/redis';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';

const MAX_TOKENS = 10;
const REFILL_TOKENS_INTERVAL = 60 * 60 * 1000;

const authorizationMiddleware = async (ctx: Koa.Context, next: () => Promise<void>) => {

  const authorization = ctx.headers.authorization

  if (!authorization) {
    ctx.status = StatusCodes.UNAUTHORIZED
    ctx.body = { error: ReasonPhrases.UNAUTHORIZED }
    return
  }

  if (!authorization.startsWith("Bearer ")) {
    ctx.status = StatusCodes.UNAUTHORIZED;
    ctx.body = { error: "Invalid token format" };
    return;
  }

  const userToken = authorization?.split(' ')[1]

  ctx.state.userToken = userToken;

  await next()
}

const refillTokens = async (userToken: string) => {

  const userData = await client.hGetAll(userToken)

  const now = Date.now()

  if (!userData.tokens_count || !userData.last_request) {
    await client.hSet(userToken, {
      tokens_count: MAX_TOKENS.toString(),
      last_request: now.toString()
    })
    return
  }

  const tokensCount = parseInt(userData.tokens_count, 10)
  const lastRequest = parseInt(userData.last_request, 10)

  const elapsed = now - lastRequest

  const tokensToAdd = Math.floor(elapsed / REFILL_TOKENS_INTERVAL)

  if (tokensToAdd > 0 && tokensCount < MAX_TOKENS) {
    const newTokenCount = Math.min(MAX_TOKENS, tokensCount + tokensToAdd)

    await client.hSet(userToken, {
      tokens_count: newTokenCount.toString(),
      last_request: now.toString()
    })
  }
}

const leakyBucketAlgorithm = async (ctx: Koa.Context, next: () => Promise<void>) => {
  const userToken = ctx.state.userToken;

  await refillTokens(userToken);

  const userData = await client.hGetAll(userToken);

  const tokensCount = parseInt(userData.tokens_count ?? "0", 10);

  if (tokensCount <= 0) {
    ctx.status = StatusCodes.TOO_MANY_REQUESTS
    ctx.body = { error: ReasonPhrases.TOO_MANY_REQUESTS }
    return
  }

  const tokensBefore = tokensCount;

  await next();

  if (ctx.status >= StatusCodes.BAD_REQUEST) {
    await client.hIncrBy(userToken, "tokens_count", -1)
    return
  }

  if (tokensBefore > 0) {
    await client.hSet(userToken, { last_request: Date.now().toString() });
  }
}

const app = new Koa()
const router = new Router();

app
  .use(authorizationMiddleware)
  .use(leakyBucketAlgorithm)
  .use(
    router
      .get(
        "/path",
        ctx => {
          const { fail } = ctx.query

          if (fail === "true") {
            ctx.status = StatusCodes.BAD_REQUEST
            ctx.body = { error: "Pix key not found" }
            return
          }

          ctx.status = StatusCodes.OK;
          ctx.body = { pixKey: "fake-pix-key", value: 100 }
        }
      )
      .routes(),
  )

export { app }
