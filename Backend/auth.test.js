const test = require("node:test");
const assert = require("node:assert/strict");

const {
  clearRefreshTokenCookie,
  createAccessToken,
  createRefreshToken,
  parseCookies,
  serializeRefreshTokenCookie,
  verifySignedToken
} = require("./auth");

test("access tokens are signed in jwt-style format and decode exp in seconds", () => {
  const token = createAccessToken(
    { id: 42, name: "Ada", email: "ada@example.com" },
    "test-secret",
    60_000
  );

  assert.equal(token.split(".").length, 3);
  const payload = verifySignedToken(token, "test-secret");
  assert.equal(payload.sub, 42);
  assert.equal(payload.name, "Ada");
  assert.equal(payload.email, "ada@example.com");
  assert.equal(typeof payload.exp, "number");
});

test("refresh token cookies are httpOnly and can be cleared", () => {
  const token = createRefreshToken({ id: 7 }, "refresh-secret", 14);
  const cookie = serializeRefreshTokenCookie(token, { secure: true, maxAgeSeconds: 120 });
  assert.match(cookie, /refreshToken=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Max-Age=120/);

  const cleared = clearRefreshTokenCookie({ secure: true });
  assert.match(cleared, /Max-Age=0/);
});

test("cookie parsing returns named cookie values", () => {
  const parsed = parseCookies("foo=bar; refreshToken=abc123; theme=light");
  assert.equal(parsed.refreshToken, "abc123");
  assert.equal(parsed.foo, "bar");
  assert.equal(parsed.theme, "light");
});
