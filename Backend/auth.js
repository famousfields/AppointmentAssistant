const crypto = require("crypto");

const TOKEN_HEADER = {
  alg: "HS256",
  typ: "JWT"
};

const base64UrlEncode = (value) => Buffer.from(value).toString("base64url");
const base64UrlDecode = (value) => Buffer.from(value, "base64url").toString("utf8");
const base64UrlDecodeJson = (value) => JSON.parse(base64UrlDecode(value));

const createSignedToken = (payload, secret) => {
  const header = base64UrlEncode(JSON.stringify(TOKEN_HEADER));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
};

const verifySignedToken = (token, secret) => {
  const [header, payload, signature] = (token || "").split(".");
  if (!header || !payload || !signature) {
    throw new Error("Invalid token format");
  }

  const data = `${header}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid token signature");
  }

  const decodedHeader = base64UrlDecodeJson(header);
  if (decodedHeader.alg !== TOKEN_HEADER.alg || decodedHeader.typ !== TOKEN_HEADER.typ) {
    throw new Error("Invalid token header");
  }

  const decodedPayload = base64UrlDecodeJson(payload);
  if (decodedPayload.exp && Math.floor(Date.now() / 1000) > decodedPayload.exp) {
    throw new Error("Expired token");
  }

  return decodedPayload;
};

const createAccessToken = (user, secret, ttlMs) =>
  createSignedToken(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      exp: Math.floor((Date.now() + ttlMs) / 1000)
    },
    secret
  );

const createRefreshToken = (user, secret, ttlDays) =>
  createSignedToken(
    {
      sub: user.id,
      exp: Math.floor((Date.now() + ttlDays * 24 * 60 * 60 * 1000) / 1000)
    },
    secret
  );

const parseCookies = (headerValue = "") =>
  headerValue
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce((cookies, pair) => {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) {
        return cookies;
      }

      const key = pair.slice(0, separatorIndex);
      const value = pair.slice(separatorIndex + 1);
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});

const serializeRefreshTokenCookie = (token, options = {}) => {
  const parts = [
    `refreshToken=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${options.sameSite || "Lax"}`
  ];

  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

const clearRefreshTokenCookie = (options = {}) =>
  serializeRefreshTokenCookie("", { ...options, maxAgeSeconds: 0 });

module.exports = {
  clearRefreshTokenCookie,
  createAccessToken,
  createRefreshToken,
  parseCookies,
  serializeRefreshTokenCookie,
  verifySignedToken
};
