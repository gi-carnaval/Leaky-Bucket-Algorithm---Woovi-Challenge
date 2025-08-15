import request from 'supertest';
import { app } from '../index';
import { createOrUpdateUserBucket } from "../utils/redisTestHelpers";
import { client, connectRedis } from '../lib/redis';

describe("Authorization", () => {

  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await client.quit();
  });

  it("should return 401 if Authorization header is missing", async () => {
    const res = await request(app.callback()).get('/path');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  })

  it("should return 401 if Authorization header is invalid format", async () => {
    const token = "fake-token";
    const res = await request(app.callback())
      .get('/path')
      .set('Authorization', `${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid token format');
  })

  it("should allow request with valid Bearer token", async () => {
    const token = "rightToken";
    createOrUpdateUserBucket(token, 10)

    const res = await request(app.callback())
      .get('/path')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({
      "pixKey": "fake-pix-key",
      "value": 100
    });
  })
})

describe("Leaky Bucket - Tokens usage", () => {
  beforeAll(async () => {
    await connectRedis();
  });

  afterAll(async () => {
    await client.quit();
  });

  it("should decrease token count on failed request (status >= 400)", async () => {
    const token = "user123";
    createOrUpdateUserBucket(token, 10)

    const res = await request(app.callback())
      .get('/path?fail=true')
      .set('Authorization', `Bearer ${token}`)

    const data = await client.hGetAll(token)

    expect(parseInt(data.tokens_count)).toBe(9)
    expect(res.status).toBe(400)
  })

  it("should not decrease token count on successful request (status < 400)", async () => {
    const token = "user123";
    createOrUpdateUserBucket(token, 10)

    const res = await request(app.callback())
      .get('/path')
      .set('Authorization', `Bearer ${token}`)

    const data = await client.hGetAll(token)

    expect(parseInt(data.tokens_count)).toBe(10)
    expect(res.status).toBe(200)
  }
  )

  it("should block request with 429 when tokens are zero", async () => {
    const token = "user123";
    createOrUpdateUserBucket(token, 0)

    const res = await request(app.callback())
      .get('/path')
      .set('Authorization', `Bearer ${token}`)

    const data = await client.hGetAll(token)

    expect(parseInt(data.tokens_count)).toBe(0)
    expect(res.status).toBe(429)
    expect(res.body.error).toBe("Too Many Requests")
  })

  //To-do
  // it("should allow request when tokens have been refilled")

  // it("Should return 429 after 10 bad requests, when user exceeds token limit", async () => {
  //   const token = "fake-token";

  //   for (let i = 1; i <= 11; i++) {
  //     const res = await request(app.callback()).get('/path')
  //       .set('Authorization', `Bearer ${token}`);
  //     if (i == 12) {
  //       expect(res.status).toBe(429);
  //       expect(res.body.error).toBe('Too Many Requests');
  //     }
  //   }
  // })
})