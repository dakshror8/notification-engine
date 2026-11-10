// 1. Strategy Interface
export interface DeliveryProvider {
    send(userId: string, message: string): Promise<void>;
}

// 2. Concrete Provider Implementations
class EmailProvider implements DeliveryProvider {
    async send(userId: string, message: string): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate SMTP latency
        console.log(`[SMTP Mock] Sent email to ${userId}: "${message}"`);
    }
}

class SmsProvider implements DeliveryProvider {
    async send(userId: string, message: string): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate Twilio latency
        console.log(`[SMS Mock] Sent text to ${userId}: "${message}"`);
    }
}

class PushProvider implements DeliveryProvider {
    async send(userId: string, message: string): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate Firebase FCM latency
        console.log(`[Push Mock] Sent push alert to ${userId}: "${message}"`);
    }
}

// 3. Export the Provider Registry
export const providers: Record<'EMAIL' | 'SMS' | 'PUSH', DeliveryProvider> = {
    EMAIL: new EmailProvider(),
    SMS: new SmsProvider(),
    PUSH: new PushProvider(),
};
