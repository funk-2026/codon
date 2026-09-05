import { apiFetch } from './client';
import { SubscriptionPlan } from './profile';

export type ListPlansResponse = {
  plans: SubscriptionPlan[];
};

/** GET /api/v1/subscription-plans */
export function listPlans(): Promise<ListPlansResponse> {
  return apiFetch<ListPlansResponse>('/subscription-plans', { method: 'GET' });
}

export type CheckoutRequest = {
  plan_id: string;
};

export type CheckoutResponse = {
  razorpay_order_id: string;
  amount_paise: number;
  currency: string;
  key_id: string;
};

/** POST /api/v1/subscriptions/checkout */
export function checkout(data: CheckoutRequest): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>('/subscriptions/checkout', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export type VerifyPaymentRequest = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

/** POST /api/v1/subscriptions/verify-payment */
export function verifyPayment(data: VerifyPaymentRequest): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/subscriptions/verify-payment', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
