import request from 'supertest';
import { app } from '../index';

describe("Leaky Bucket API", () => {
  it("Should return 401 when user is not authorized", async () => {
    const res = await request(app.listen()).get('/path');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  })
})