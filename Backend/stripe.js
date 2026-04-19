const crypto = require("crypto");

const STRIPE_API_BASE = "https://api.stripe.com/v1";

const getPlanPriceIdMap = () => ({
  starter: process.env.STRIPE_PRICE_ID_STARTER || "",
  team: process.env.STRIPE_PRICE_ID_TEAM || "",
  pro: process.env.STRIPE_PRICE_ID_PRO || ""
});

const getStripeConfig = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const successUrl = process.env.STRIPE_SUCCESS_URL || "";
  const cancelUrl = process.env.STRIPE_CANCEL_URL || "";
  const portalReturnUrl = process.env.STRIPE_PORTAL_RETURN_URL || successUrl || cancelUrl || "";
  const priceIds = getPlanPriceIdMap();

  return {
    secretKey,
    webhookSecret,
    successUrl,
    cancelUrl,
    portalReturnUrl,
    priceIds
  };
};

const isStripeReady = () => {
  const config = getStripeConfig();
  return Boolean(
    config.secretKey &&
      config.webhookSecret &&
      config.successUrl &&
      config.cancelUrl &&
      Object.values(config.priceIds).some(Boolean)
  );
};

const resolveStripePriceId = (planCode) => getStripeConfig().priceIds[planCode] || "";

const buildStripeFormBody = (fields = {}) => {
  const params = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.append(key, String(value));
  });
  return params;
};

const stripeRequest = async (path, { method = "POST", fields = {}, secretKey = getStripeConfig().secretKey } = {}) => {
  const headers = {
    Authorization: `Bearer ${secretKey}`
  };
  const requestInit = { method, headers };

  if (method === "GET" || method === "HEAD") {
    const query = buildStripeFormBody(fields).toString();
    const url = query ? `${STRIPE_API_BASE}${path}?${query}` : `${STRIPE_API_BASE}${path}`;
    const response = await fetch(url, requestInit);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = payload?.error?.message || payload?.error || `Stripe request failed with ${response.status}`;
      const error = new Error(message);
      error.statusCode = response.status;
      error.stripe = payload;
      throw error;
    }
    return payload;
  }

  headers["Content-Type"] = "application/x-www-form-urlencoded";
  requestInit.body = buildStripeFormBody(fields);
  const response = await fetch(`${STRIPE_API_BASE}${path}`, requestInit);

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || `Stripe request failed with ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.stripe = payload;
    throw error;
  }

  return payload;
};

const ensureStripeCustomer = async ({ user, existingCustomerId } = {}) => {
  const config = getStripeConfig();
  if (!config.secretKey) {
    throw new Error("Stripe is not configured");
  }

  if (existingCustomerId) {
    return existingCustomerId;
  }

  const customer = await stripeRequest("/customers", {
    fields: {
      email: user?.email || "",
      name: user?.name || "",
      "metadata[user_id]": user?.id || ""
    }
  });

  return customer.id;
};

const createCheckoutSession = async ({ user, planCode, customerId, subscriptionId }) => {
  const config = getStripeConfig();
  const priceId = resolveStripePriceId(planCode);
  if (!config.secretKey || !config.successUrl || !config.cancelUrl || !priceId) {
    throw new Error("Stripe checkout is not configured for that plan");
  }

  const session = await stripeRequest("/checkout/sessions", {
    fields: {
      mode: "subscription",
      customer: customerId || "",
      client_reference_id: user?.id || "",
      success_url: config.successUrl,
      cancel_url: config.cancelUrl,
      allow_promotion_codes: "true",
      "metadata[user_id]": user?.id || "",
      "metadata[plan_code]": planCode,
      "subscription_data[metadata][user_id]": user?.id || "",
      "subscription_data[metadata][plan_code]": planCode,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1
    }
  });

  return {
    id: session.id,
    url: session.url || null,
    customerId: customerId || null,
    priceId,
    subscriptionId: subscriptionId || null
  };
};

const createPortalSession = async ({ customerId, returnUrl }) => {
  const config = getStripeConfig();
  if (!config.secretKey || !customerId) {
    throw new Error("Stripe customer portal is not configured");
  }

  const session = await stripeRequest("/billing_portal/sessions", {
    fields: {
      customer: customerId,
      return_url: returnUrl || config.portalReturnUrl || config.successUrl || config.cancelUrl
    }
  });

  return {
    id: session.id,
    url: session.url || null
  };
};

const parseStripeSignatureHeader = (headerValue = "") =>
  String(headerValue)
    .split(",")
    .map((part) => part.trim())
    .reduce((accumulator, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return accumulator;
      const key = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      if (!accumulator[key]) accumulator[key] = [];
      accumulator[key].push(value);
      return accumulator;
    }, {});

const verifyStripeWebhookSignature = (rawBody, signatureHeader, secret) => {
  if (!rawBody || !signatureHeader || !secret) return false;

  const parsed = parseStripeSignatureHeader(signatureHeader);
  const timestamp = parsed.t?.[0];
  const signatures = parsed.v1 || [];
  if (!timestamp || signatures.length === 0) return false;

  const timestampNumber = Number(timestamp);
  if (Number.isNaN(timestampNumber)) return false;
  const toleranceSeconds = 5 * 60;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${timestamp}.${Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody)}`;
  const expectedSignature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  return signatures.some((signature) => {
    if (signature.length !== expectedSignature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  });
};

module.exports = {
  createCheckoutSession,
  createPortalSession,
  ensureStripeCustomer,
  getStripeConfig,
  isStripeReady,
  resolveStripePriceId,
  stripeRequest,
  verifyStripeWebhookSignature
};
