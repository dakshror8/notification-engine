import './worker.js';
import 'dotenv/config';
import express from 'express';
import type {Request, Response} from 'express';
import { z } from 'zod';
import {db} from './src/prisma/db.js';
import { notificationQueue, redisConnection } from './queue.js';

const app = express();
app.use(express.json());

const createNotificationSchema = z.object({
    userId: z.string().min(1, "userId cannot be empty."),
    type: z.enum(['EMAIL', 'SMS', 'PUSH']),
    message: z.string().min(1).max(500, "message must be 1 to 500 characters long.")
});

app.use(express.static('public'));


// get '/health' endpoint
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({status: 'UP', timestamp: new Date()});
});

// create new notification
app.post('/api/v1/notifications', async (req: Request, res: Response) => {
    
    const validation = createNotificationSchema.safeParse(req.body);
    if(!validation.success){
        res.status(400).json({
            success: false,
            error: 'Invalid request payload',
            details: z.flattenError(validation.error).fieldErrors,
        });
        return;
    }

    const idempotencyKey = req.header('Idempotency-Key');
    let lockedRedisKey: string | null = null;

    try{
        if (idempotencyKey) {
            const redisKey = `idempotency:${idempotencyKey}`;
            
            const result = await redisConnection.set(redisKey, 'PROCESSING', {
                condition: 'NX',
                expiration: { type: 'EX', value: 86400 },
            });
            const isFirstRequest = result === 'OK';

            if (!isFirstRequest) {
                console.log(`Blocked duplicate request with Idempotency-Key: ${idempotencyKey}`);
                res.status(409).json({
                    success: false,
                    error: 'Duplicate request detected. Notification already queued.',
                });
                return;
            }
            lockedRedisKey = redisKey;
        }

        const { userId, type, message } = validation.data;
        const job = await notificationQueue.add('send-alert', {
            userId,
            type,
            message,
        });

        res.status(202).json({
            success: true,
            message: 'Notification queued for asynchronous delivery.',
            jobId: job.id,
        });
    }catch(error){
        if (lockedRedisKey) {
            await redisConnection.del(lockedRedisKey);
        }
        console.error('Queue Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to queue notification.' 
        });
    }
    
});

app.get('/api/v1/notifications', async (req: Request, res: Response) => {
    try {
        const notifications = await db.orm.public.notification.all();
        const recentNotifications = notifications.slice(-20).reverse();

        res.status(200).json({
            success: true,
            count: recentNotifications.length,
            data: recentNotifications,
        });
    } catch (error) {
        console.error('Fetch Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch notifications.' });
    }
});

export { app };

const PORT = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV !== 'test') {
    await import('./worker.js');

    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`API Gateway listening on port ${PORT}`);
    });

    // Graceful shutdown when cloud containers restart
    const shutdown = async () => {
        console.log('Shutting down API Gateway gracefully...');
        server.close();
        await notificationQueue.close();
        await redisConnection.quit();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

