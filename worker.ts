import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redisConnection } from './queue.js';
import type { NotificationJobData } from './queue.js';
import { db } from './src/prisma/db.js';
import { providers } from './providers.js';

console.log('Background Notification Worker starting...');

const worker = new Worker<NotificationJobData>('notifications', 
    async (job: Job<NotificationJobData>) => {
        const { userId, type, message } = job.data;
        console.log(`Job ${job.id} processing ${type} for user ${userId}...`);

        const provider = providers[type];
        await provider.send(userId, message);

        const savedRecord = await db.orm.public.notification.create({
            userId, 
            type, 
            message, 
            status: 'SENT'
        });
        console.log(`Job:${job.id} Delivered and saved to DB. (Row id: ${savedRecord.id})`);

        return savedRecord;
    },
    { connection: redisConnection }
);


worker.on('failed', (job, err) => {
    console.error(`Job:${job?.id} failed permanently after all retries: `, err.message);
});

const shutdownWorker = async () => {
    console.log('Shutting down worker gracefully...');
    await worker.close();
    await redisConnection.quit();
    process.exit(0);
};

process.on('SIGTERM', shutdownWorker);
process.on('SIGINT', shutdownWorker);