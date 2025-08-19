import request from "supertest";
import { app } from "../index";

import { client, connectRedis } from "../lib/redis";
import { createOrUpdateUserBucket } from "../middleware/leakyBucket/services/tokenBucketService";
import { getOrCreateUserBucket } from "../middleware/leakyBucket/utils/utils";

describe("Authorization", () => {
	beforeAll(async () => {
		await connectRedis();
	});

	afterAll(async () => {
		await client.quit();
	});

	it("should return 401 if Authorization header is missing", async () => {
		const res = await request(app.callback()).get("/path");
		expect(res.status).toBe(401);
		expect(res.body.error).toBe("Unauthorized");
	});

	it("should return 401 if Authorization header is invalid format", async () => {
		const token = "fake-token";
		const res = await request(app.callback())
			.get("/path")
			.set("Authorization", `${token}`);
		expect(res.status).toBe(401);
		expect(res.body.error).toBe("Invalid token format");
	});

	it("should allow request with valid Bearer token", async () => {
		const token = "rightToken";
		const tokensQuantity = "10";
		createOrUpdateUserBucket(token, tokensQuantity);

		const res = await request(app.callback())
			.get("/path")
			.set("Authorization", `Bearer ${token}`);
		expect(res.status).toBe(200);
		expect(res.body).toStrictEqual({
			pixKey: "fake-pix-key",
			value: 100,
		});
	});
});

describe("Leaky Bucket - Tokens usage", () => {
	beforeAll(async () => {
		await connectRedis();
	});

	afterAll(async () => {
		await client.quit();
	});

	it("should decrease token count on failed request (status >= 400)", async () => {
		const token = "user123";
		const tokensQuantity = "10";
		createOrUpdateUserBucket(token, tokensQuantity);

		const res = await request(app.callback())
			.get("/path?fail=true")
			.set("Authorization", `Bearer ${token}`);

		const data = await client.hGetAll(token);

		expect(parseInt(data.tokensCount)).toBe(9);
		expect(res.status).toBe(400);
	});

	it("should not decrease token count on successful request (status < 400)", async () => {
		const token = "user123";
		const tokensQuantity = "10";
		createOrUpdateUserBucket(token, tokensQuantity);

		const res = await request(app.callback())
			.get("/path")
			.set("Authorization", `Bearer ${token}`);

		const data = await client.hGetAll(token);

		expect(parseInt(data.tokensCount)).toBe(10);
		expect(res.status).toBe(200);
	});

	it("should block request with 429 when tokens are zero", async () => {
		const token = "user123";
		const tokensQuantity = "0";

		createOrUpdateUserBucket(token, tokensQuantity);

		const res = await request(app.callback())
			.get("/path")
			.set("Authorization", `Bearer ${token}`);

		const data = await client.hGetAll(token);

		expect(parseInt(data.tokensCount, 10)).toBe(0);
		expect(res.status).toBe(429);
		expect(res.body.error).toBe("Too Many Requests");
	});

	it("should allow request when tokens have been refilled", async () => {
		const token = "user123";
		const tokensQuantity = "0";

		createOrUpdateUserBucket(token, tokensQuantity);

		const oneHour = 60 * 60 * 1000;

		const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => {
			return new Date().getTime() + oneHour;
		});

		const res = await request(app.callback())
			.get("/path")
			.set("Authorization", `Bearer ${token}`);

		expect(res.status).toBe(200);
		expect(res.body).toStrictEqual({
			pixKey: "fake-pix-key",
			value: 100,
		});
		nowSpy.mockRestore();
	});

	// jest.useFakeTimers

	//To-do
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
});

describe("Tokens Refill", () => {
	beforeAll(async () => {
		await connectRedis();
	});

	afterAll(async () => {
		await client.quit();
	});

	it("should add tokens after REFILL_INTERVAL has passed", async () => {
		const token = "user123";
		const tokensQuantity = "0";

		createOrUpdateUserBucket(token, tokensQuantity);

		const REFILL_INTERVAL = 60 * 60 * 1000;

		const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => {
			return new Date().getTime() + REFILL_INTERVAL;
		});

		await request(app.callback())
			.get("/path")
			.set("Authorization", `Bearer ${token}`);

		const { tokensCount } = await getOrCreateUserBucket(token);

		expect(tokensCount).toBe(1);

		nowSpy.mockRestore();
	});

	it("should not exceed MAX_TOKENS when refilling", async () => {
		const token = "user123";
		const tokensQuantity = "9";

		const MAX_TOKENS = 10;

		createOrUpdateUserBucket(token, tokensQuantity);

		const TWO_TIMES_REFILL_INTERVAL = 2 * 60 * 60 * 1000;

		const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => {
			return new Date().getTime() + TWO_TIMES_REFILL_INTERVAL;
		});

		await request(app.callback())
			.get("/path")
			.set("Authorization", `Bearer ${token}`);

		const { tokensCount } = await getOrCreateUserBucket(token);

		expect(tokensCount).toBe(MAX_TOKENS);

		nowSpy.mockRestore();
	});

	it("should not update last_request if tokens are zero", async () => {
		const token = "user123";
		const tokensQuantity = "0";

		createOrUpdateUserBucket(token, tokensQuantity);

		const currentlyLastRequest = (await getOrCreateUserBucket(token))
			.lastRequest;

		await request(app.callback())
			.get("/path")
			.set("Authorization", `Bearer ${token}`)
			.expect(429);

		const { lastRequest } = await getOrCreateUserBucket(token);

		expect(currentlyLastRequest).toEqual(lastRequest);
	});

	it("should update last_request if tokens > 0", async () => {
		const token = "user123";
		const tokensQuantity = "10";
		createOrUpdateUserBucket(token, tokensQuantity);

		const currentlyLastRequest = (await getOrCreateUserBucket(token))
			.lastRequest;

		await request(app.callback())
			.get("/path?fail=true")
			.set("Authorization", `Bearer ${token}`)
			.expect(400);

		const { lastRequest } = await getOrCreateUserBucket(token);

		expect(currentlyLastRequest).not.toEqual(lastRequest);
	});
});

describe("Multi-tenant Behavior", () => {
	beforeAll(async () => {
		await connectRedis();
	});

	afterAll(async () => {
		await client.quit();
	});

	it("should maintain separate token counts per user", async () => {
		const tokenUser1 = "user1";
		const tokenUser2 = "user2";
		const tokensQuantity = "10";

		createOrUpdateUserBucket(tokenUser1, tokensQuantity);
		createOrUpdateUserBucket(tokenUser2, tokensQuantity);

		for (let i = 1; i <= 4; i++) {
			await request(app.callback())
				.get("/path?fail=true")
				.set("Authorization", `Bearer ${tokenUser1}`)
				.expect(400);
		}

		await request(app.callback())
			.get("/path?fail=true")
			.set("Authorization", `Bearer ${tokenUser2}`)
			.expect(400);

		const dataUser1 = await getOrCreateUserBucket(tokenUser1);
		const dataUser2 = await getOrCreateUserBucket(tokenUser2);

		expect(dataUser1.tokensCount).toBe(6);
		expect(dataUser2.tokensCount).toBe(9);
	});

	it("should refill tokens independently for each user", async () => {
		const tokenUser1 = "user1";
		const tokenUser2 = "user2";
		const tokensQuantityUser1 = "5";
		const tokensQuantityUser2 = "2";

		const TWO_TIMES_REFILL_INTERVAL = 2 * 60 * 60 * 1000;

		createOrUpdateUserBucket(tokenUser1, tokensQuantityUser1);
		createOrUpdateUserBucket(tokenUser2, tokensQuantityUser2);

		const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => {
			return new Date().getTime() + TWO_TIMES_REFILL_INTERVAL;
		});

		await request(app.callback())
			.get("/path")
			.set("Authorization", `Bearer ${tokenUser1}`)
			.expect(200);

		await request(app.callback())
			.get("/path")
			.set("Authorization", `Bearer ${tokenUser2}`)
			.expect(200);

		const dataUser1 = await getOrCreateUserBucket(tokenUser1);
		const dataUser2 = await getOrCreateUserBucket(tokenUser2);

		expect(dataUser1.tokensCount).toBe(7);
		expect(dataUser2.tokensCount).toBe(4);

		nowSpy.mockRestore();
	});
});

describe("Request sequence", () => {
	beforeAll(async () => {
		await connectRedis();
	});

	afterAll(async () => {
		await client.quit();
	});

	it("should correctly handle multiple rapid requests decreasing tokens one by one", async () => {
		const token = "user1";
		const tokensQuantity = "10";

		createOrUpdateUserBucket(token, tokensQuantity);

		for (let i = 1; i <= 10; i++) {
			await request(app.callback())
				.get("/path?fail=true")
				.set("Authorization", `Bearer ${token}`)
				.expect(400);

			const data = await getOrCreateUserBucket(token);
			expect(data.tokensCount).toBe(10 - i);
		}
	});

	it("should return 429 when tokens run out during rapid requests", async () => {
		const token = "user1";
		const tokensQuantity = "10";

		createOrUpdateUserBucket(token, tokensQuantity);

		for (let i = 1; i <= 11; i++) {
			const res = await request(app.callback())
				.get("/path?fail=true")
				.set("Authorization", `Bearer ${token}`);

			const data = await getOrCreateUserBucket(token);

			const EXPECTED_TOKENS = Math.max(10 - i, 0);

			expect(data.tokensCount).toBe(EXPECTED_TOKENS);

			if (i > 10) {
				expect(res.status).toBe(429);
				expect(res.body.error).toBe("Too Many Requests");
			} else {
				expect(res.status).toBe(400);
			}
		}
	});
});
