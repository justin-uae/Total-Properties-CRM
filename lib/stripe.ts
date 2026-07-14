export function getStripeConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
  return { enabled: Boolean(secretKey), secretKey, publishableKey };
}
