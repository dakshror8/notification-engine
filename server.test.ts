import { describe, it, expect, afterAll } from "vitest";
import { app } from "./server.js";
import { notificationQueue, redisConnection } from "./queue.js";
import request  from "supertest";
import crypto from 'node:crypto';

describe("Notification Engine API Gateway", () => {
    afterAll(async () => {
        await notificationQueue.close();
        await redisConnection.quit();
    });

    it("GET /health should return 200 UP", async () => {
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("UP");
    });

    it("POST /api/v1/notifications should reject invalid type with 400", async () => {
        const res = await request(app)
            .post("/api/v1/notifications")
            .send({ userId: "test-user", type: "INVALID_CHANNEL", message: "Hello"});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it("POST /api/v1/notifications should queue valid request and block duplicate Idempotency-Key", async () => {
        const uniqueKey = `test-key-${crypto.randomUUID()}`;
        const payload = { userId: 'test-user', type: 'EMAIL', message: 'Automated test alert' };

        const firstRes = await request(app)
            .post("/api/v1/notifications")
            .set("Idempotency-Key", uniqueKey)
            .send(payload);

        expect(firstRes.status).toBe(202);
        expect(firstRes.body.success).toBe(true);
        expect(firstRes.body.jobId).toBeDefined();

        const duplicateRes = await request(app)
            .post("/api/v1/notifications")
            .set("Idempotency-Key", uniqueKey)
            .send(payload);
        
        expect(duplicateRes.status).toBe(409);
        expect(duplicateRes.body.success).toBe(false);
    });
});