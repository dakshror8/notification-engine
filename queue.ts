import {Queue} from 'bullmq';
import { createClient } from 'redis';

export interface NotificationJobData{
    userId: string;
    type: 'EMAIL' | 'SMS' | 'PUSH';
    message: string;
}

export const redisConnection = createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
});

redisConnection.on('error', (err) => {console.error("redis Client error: ", err)});
await redisConnection.connect();

export const notificationQueue = new Queue<NotificationJobData>('notifications', {
        connection: redisConnection as any,
        defaultJobOptions: {
            attempts: 3, // Automatically retry up to 3 times if a job fails
            backoff: {
                type: 'exponential',
                delay: 1000, // Wait 1s, then 2s, then 4s between retries
            },
            removeOnComplete: true, // Keep Redis memory clean after success
        },
});