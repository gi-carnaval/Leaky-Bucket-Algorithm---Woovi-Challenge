import Koa from 'koa';
import Router from '@koa/router';
import { client, connectRedis } from './lib/redis';

const leakyBucketAlgorithm = async (ctx: Koa.Context, next: () => Promise<void>) => {
  const authorization = ctx.headers.authorization

  if (!authorization) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  const userToken = authorization.split(' ')[1]
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
    ctx.status = 429
    return
  }

  await next();

  if (ctx.status >= 400) {
    const currentTokens = await client.hIncrBy(userToken, "tokens_count", -1)
    console.log(`Usuário ${userToken} fez uma requisição com erro. Tokens restantes: ${currentTokens}`)
  }

}

const app = new Koa()
const router = new Router();

connectRedis().then(() => {
  app
    .use(leakyBucketAlgorithm)
    .use(
      router
        .get(
          "/path",
          ctx => {
            ctx.status = 200;
          }
        )
        .routes(),
    )
    .listen(3000);
})


// app.use(bodyParser())
// app.use(router.routes())

// connectRedis().then(() => {
//   app.listen(3000, () => console.log("Server running on port 3000"))
// })