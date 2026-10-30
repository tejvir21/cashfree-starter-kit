// @ts-nocheck
import { cashfreeAdapter } from '../services/cashfree';
import { ordersStore } from './payment.controller.js';
export async function cashfreeWebhook(req, res) {
    const rawBody = req.rawBody ?? '';
    const signature = req.headers['x-webhook-signature'];
    if (!signature) {
        res.status(400).json({ error: 'Bad request', message: 'Missing webhook signature' });
        return;
    }
    const signatureValid = await cashfreeAdapter.verifyWebhookSignature(rawBody, signature);
    if (!signatureValid) {
        res.status(400).json({ error: 'Bad request', message: 'Invalid webhook signature' });
        return;
    }
    let payload;
    try {
        payload = JSON.parse(rawBody);
    }
    catch {
        res.status(400).json({ error: 'Bad request', message: 'Invalid JSON payload' });
        return;
    }
    try {
        const data = (payload.data ?? payload);
        const gatewayOrderId = String(data.order_id ?? data.orderId ?? '');
        const gatewayStatus = String(data.payment_status ?? data.order_status ?? data.status ?? '').toUpperCase();
        if (gatewayOrderId) {
            // Try to find order by gateway order ID
            for (const [orderId, order] of ordersStore.entries()) {
                if (order.gatewayOrderId === gatewayOrderId || order.orderId === gatewayOrderId) {
                    if (gatewayStatus === 'PAID' || gatewayStatus === 'SUCCESS' || gatewayStatus === 'SUCCESSFUL') {
                        order.status = 'PAID';
                        ordersStore.set(orderId, order);
                    }
                    else if (gatewayStatus === 'FAILED' || gatewayStatus === 'CANCELLED' || gatewayStatus === 'EXPIRED') {
                        order.status = 'FAILED';
                        ordersStore.set(orderId, order);
                    }
                    break;
                }
            }
        }
        res.json({ received: true });
    }
    catch (err) {
        res.status(200).json({ received: true });
    }
}

