import Koa from 'koa';
import Router from '@koa/router';
import { client } from './lib/redis';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';

const authorizationMiddleware = async (ctx: Koa.Context, next: () => Promise<void>) => {
  const authorization = ctx.headers.authorization

  if (!authorization) {
    ctx.status = StatusCodes.UNAUTHORIZED
    ctx.body = { error: ReasonPhrases.UNAUTHORIZED }
    return
  }
}

const leakyBucketAlgorithm = async (ctx: Koa.Context, next: () => Promise<void>) => {
  const authorization = ctx.headers.authorization

  const userToken = authorization?.split(' ')[1] ?? ''
  let userData = await client.hGetAll(userToken)

  if (Object.keys(userData).length === 0) {
    await client.hSet(userToken, {
      tokens_count: '10',
      last_request: Date.now().toString()
    })

    userData = await client.hGetAll(userToken)
  }

  const parsedUser = {
    tokens_count: parseInt(userData.tokens_count, 10),
    last_request: parseInt(userData.last_request, 10),
  };

  if (parsedUser.tokens_count == 0) {
    ctx.status = StatusCodes.TOO_MANY_REQUESTS
    ctx.body = { error: ReasonPhrases.TOO_MANY_REQUESTS }
    return
  }

  await next();

  if (ctx.status >= StatusCodes.BAD_REQUEST) {
    const currentTokens = await client.hIncrBy(userToken, "tokens_count", -1)
    return
    // console.log(`Usuário ${userToken} fez uma requisição com erro. Tokens restantes: ${currentTokens}`)
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
          ctx.status = StatusCodes.OK;
        }
      )
      .routes(),
  )

export { app }

// app.use(bodyParser())
// app.use(router.routes())

// connectRedis().then(() => {
//   app.listen(3000, () => console.log("Server running on port 3000"))
// })