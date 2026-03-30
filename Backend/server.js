const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const db = require("./db");
const runMigrations = require("./runMigrations");
const {
  clearRefreshTokenCookie,
  createAccessToken,
  createRefreshToken,
  parseCookies,
  serializeRefreshTokenCookie,
  verifySignedToken
} = require("./auth");
const { body, validationResult } = require("express-validator");

const app = express();

const ACCESS_TOKEN_TTL_MS = Number.parseInt(process.env.ACCESS_TOKEN_TTL_MS || `${15 * 60 * 1000}`, 10);
const REFRESH_TOKEN_TTL_DAYS = Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "14", 10);
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:3000"
];
const allowedOrigins = (
  (process.env.CORS_ORIGINS && process.env.CORS_ORIGINS.split(",")) || DEFAULT_CORS_ORIGINS
)
  .map((origin) => origin.trim())
  .filter(Boolean);

const getRefreshCookieOptions = () => ({
  secure: IS_PRODUCTION,
  sameSite: "Lax",
  maxAgeSeconds: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60
});

const validateRuntimeConfig = () => {
  const missing = [];
  if (!ACCESS_TOKEN_SECRET) missing.push("ACCESS_TOKEN_SECRET");
  if (!REFRESH_TOKEN_SECRET) missing.push("REFRESH_TOKEN_SECRET");

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
};

const createRateLimiter = ({ windowMs, max }) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    const recentHits = (requests.get(key) || []).filter((hit) => hit > windowStart);
    recentHits.push(now);
    requests.set(key, recentHits);

    if (recentHits.length > max) {
      return res.status(429).json({ error: "Too many requests" });
    }

    return next();
  };
};

const requireAuth = (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authorization token is required" });
  }

  try {
    const payload = verifySignedToken(token, ACCESS_TOKEN_SECRET);
    req.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email
    };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const storeRefreshToken = async (userId, token) => {
  await db.promise().query(
    `
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))
    `,
    [userId, token, REFRESH_TOKEN_TTL_DAYS]
  );
};

const rotateRefreshToken = async (user, currentToken) => {
  const nextRefreshToken = createRefreshToken(user, REFRESH_TOKEN_SECRET, REFRESH_TOKEN_TTL_DAYS);

  await db.promise().query("START TRANSACTION");
  try {
    await db.promise().query("DELETE FROM refresh_tokens WHERE token = ?", [currentToken]);
    await storeRefreshToken(user.id, nextRefreshToken);
    await db.promise().query("COMMIT");
    return nextRefreshToken;
  } catch (error) {
    await db.promise().query("ROLLBACK");
    throw error;
  }
};

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(
  createRateLimiter({
    windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    max: Number.parseInt(process.env.RATE_LIMIT_MAX || "200", 10)
  })
);

const authLimiter = createRateLimiter({
  windowMs: Number.parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || "900000", 10),
  max: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || "20", 10)
});

app.get("/", (req, res) => {
  res.send("API is running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/test-db", (req, res) => {
  db.query("SELECT 1", (err, result) => {
    if (err) return res.status(500).json(err);
    return res.json({ message: "DB connected", result });
  });
});

app.post(
  "/users",
  authLimiter,
  [
    body("username").trim().isLength({ min: 3 }).withMessage("Name must be at least 3 characters"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
      const [existingUsers] = await db.promise().query(
        "SELECT id FROM users WHERE name = ? OR email = ? LIMIT 1",
        [username, email]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({ error: "Name or email already in use" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const insertQuery = `
        INSERT INTO users (name, email, password, created_at)
        VALUES (?, ?, ?, NOW())
      `;

      await db.promise().query(insertQuery, [username, email, hashedPassword]);
      return res.status(201).json({ message: "Account created successfully" });
    } catch (err) {
      console.error("Error creating user:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post(
  "/auth/login",
  authLimiter,
  [
    body("usernameOrEmail").trim().notEmpty().withMessage("Username or email is required"),
    body("password").notEmpty().withMessage("Password is required")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { usernameOrEmail, password } = req.body;

    try {
      const [rows] = await db.promise().query(
        "SELECT id, name, email, password FROM users WHERE name = ? OR email = ? LIMIT 1",
        [usernameOrEmail, usernameOrEmail]
      );

      const user = rows[0];
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const passwordMatches = await bcrypt.compare(password, user.password);
      if (!passwordMatches) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const accessToken = createAccessToken(user, ACCESS_TOKEN_SECRET, ACCESS_TOKEN_TTL_MS);
      const refreshToken = createRefreshToken(user, REFRESH_TOKEN_SECRET, REFRESH_TOKEN_TTL_DAYS);
      await storeRefreshToken(user.id, refreshToken);

      res.setHeader("Set-Cookie", serializeRefreshTokenCookie(refreshToken, getRefreshCookieOptions()));
      return res.json({
        message: "Login successful",
        user: { id: user.id, name: user.name, email: user.email },
        accessToken
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post("/auth/refresh", authLimiter, async (req, res) => {
  const refreshToken =
    req.body?.refreshToken ||
    parseCookies(req.headers.cookie || "").refreshToken;

  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is required" });
  }

  try {
    const payload = verifySignedToken(refreshToken, REFRESH_TOKEN_SECRET);
    const userId = payload.sub;

    const [tokens] = await db.promise().query(
      `SELECT id FROM refresh_tokens WHERE token = ? AND user_id = ? AND expires_at > NOW() LIMIT 1`,
      [refreshToken, userId]
    );

    if (tokens.length === 0) {
      res.setHeader("Set-Cookie", clearRefreshTokenCookie(getRefreshCookieOptions()));
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const [users] = await db.promise().query(
      "SELECT id, name, email FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    const user = users[0];
    if (!user) {
      res.setHeader("Set-Cookie", clearRefreshTokenCookie(getRefreshCookieOptions()));
      return res.status(401).json({ error: "User not found" });
    }

    const accessToken = createAccessToken(user, ACCESS_TOKEN_SECRET, ACCESS_TOKEN_TTL_MS);
    const nextRefreshToken = await rotateRefreshToken(user, refreshToken);
    res.setHeader("Set-Cookie", serializeRefreshTokenCookie(nextRefreshToken, getRefreshCookieOptions()));
    return res.json({ accessToken, user });
  } catch (error) {
    res.setHeader("Set-Cookie", clearRefreshTokenCookie(getRefreshCookieOptions()));
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

app.post("/auth/logout", async (req, res) => {
  const refreshToken =
    req.body?.refreshToken ||
    parseCookies(req.headers.cookie || "").refreshToken;

  try {
    if (refreshToken) {
      await db.promise().query("DELETE FROM refresh_tokens WHERE token = ?", [refreshToken]);
    }
    res.setHeader("Set-Cookie", clearRefreshTokenCookie(getRefreshCookieOptions()));
    return res.json({ message: "Logged out" });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post(
  "/jobs",
  requireAuth,
  [
    body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
    body("phone").custom((v) => {
      const digits = (v || "").replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) throw new Error("Invalid phone number");
      return true;
    }),
    body("address").trim().isLength({ min: 5 }).withMessage("Address must be at least 5 characters"),
    body("jobType").trim().notEmpty().withMessage("Job type is required"),
    body("jobDate")
      .isISO8601()
      .withMessage("Invalid date")
      .custom((d) => {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
        return true;
      }),
    body("comments").optional().isLength({ max: 500 }).withMessage("Comments max 500 chars"),
    body("payment")
      .optional({ values: "falsy" })
      .isFloat({ min: 0 })
      .withMessage("Payment must be a number greater than or equal to 0")
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, phone, address, jobType, jobDate, comments, payment } = req.body;
    const normalizedPayment = Number.parseFloat(payment ?? 0);
    const userId = req.user.id;

    const getClientQuery = `
      SELECT id FROM Clients
      WHERE name = ? AND phone = ? AND address = ?
      LIMIT 1
    `;

    db.query(getClientQuery, [name, phone, address], (err, clientResult) => {
      if (err) {
        console.error("Error fetching client:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (clientResult.length > 0) {
        const clientId = clientResult[0].id;
        insertJob(clientId);
      } else {
        const insertClientQuery = `
          INSERT INTO Clients (name, phone, address, notes)
          VALUES (?, ?, ?, NULL)
        `;
        db.query(insertClientQuery, [name, phone, address], (insertErr, result) => {
          if (insertErr) {
            console.error("Error inserting client:", insertErr);
            return res.status(500).json({ error: "Database error" });
          }
          const clientId = result.insertId;
          return insertJob(clientId);
        });
      }

      function insertJob(clientId) {
        const jobQuery = `
        INSERT INTO Jobs (client_id, job_type, job_date, comments, status, payment, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
        db.query(
          jobQuery,
          [clientId, jobType, jobDate, comments, "Pending", normalizedPayment, userId],
          (insertJobErr, result) => {
            if (insertJobErr) {
              console.error("Error inserting job:", insertJobErr);
              return res.status(500).json({ error: "Database error" });
            }
            return res.json({ message: "Job saved successfully", jobId: result.insertId });
          }
        );
      }
      return undefined;
    });
  }
);

app.get("/jobs", requireAuth, (req, res) => {
  const query = `
    SELECT j.id, j.job_type, j.job_date, j.comments, j.status, j.payment,
           c.id AS client_id, c.name, c.phone, c.address
    FROM Jobs j
    JOIN Clients c ON j.client_id = c.id
    WHERE j.user_id = ?
    ORDER BY j.job_date DESC
    `;

  db.query(query, [req.user.id], (err, results) => {
    if (err) {
      console.error("Error fetching jobs:", err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.json(results);
  });
});

app.patch("/jobs/:id/comments", requireAuth, (req, res) => {
  const { id } = req.params;
  const { comments } = req.body;
  const jobId = Number(id);

  if (Number.isNaN(jobId)) {
    return res.status(400).json({ error: "Invalid job ID" });
  }

  const trimmed = (comments || "").trim();
  if (trimmed.length > 500) {
    return res.status(400).json({ error: "Comments must be 500 characters or less" });
  }

  const query = "UPDATE Jobs SET comments = ? WHERE id = ? AND user_id = ?";
  db.query(query, [trimmed === "" ? null : trimmed, jobId, req.user.id], (err, result) => {
    if (err) {
      console.error("Error updating comments:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    return res.json({ message: "Comments updated successfully" });
  });
});

app.put(
  "/jobs/:id",
  requireAuth,
  [
    body("name").optional().trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
    body("phone")
      .optional()
      .custom((v) => {
        const digits = (v || "").replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 15) throw new Error("Invalid phone number");
        return true;
      }),
    body("address").optional().trim().isLength({ min: 5 }).withMessage("Address must be at least 5 characters"),
    body("jobType").optional().trim().notEmpty().withMessage("Job type is required"),
    body("jobDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid date")
      .custom((d) => {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
        return true;
      }),
    body("comments").optional().isLength({ max: 500 }).withMessage("Comments max 500 chars"),
    body("status")
      .optional()
      .isIn(["Pending", "In Progress", "Completed", "Cancelled"])
      .withMessage("Invalid status"),
    body("payment")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Payment must be a number greater than or equal to 0")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const jobId = Number(req.params.id);
    if (Number.isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }

    const { name, phone, address, jobType, jobDate, comments, status, payment } = req.body;
    const jobUpdates = [];
    const jobValues = [];
    const clientUpdates = [];
    const clientValues = [];

    if (name !== undefined) {
      clientUpdates.push("name = ?");
      clientValues.push(name.trim());
    }

    if (phone !== undefined) {
      clientUpdates.push("phone = ?");
      clientValues.push(phone);
    }

    if (address !== undefined) {
      clientUpdates.push("address = ?");
      clientValues.push(address.trim());
    }

    if (jobType !== undefined) {
      jobUpdates.push("job_type = ?");
      jobValues.push(jobType.trim());
    }

    if (jobDate !== undefined) {
      jobUpdates.push("job_date = ?");
      jobValues.push(jobDate);
    }

    if (comments !== undefined) {
      jobUpdates.push("comments = ?");
      jobValues.push(comments.trim() === "" ? null : comments.trim());
    }

    if (status !== undefined) {
      jobUpdates.push("status = ?");
      jobValues.push(status);
    }

    if (payment !== undefined) {
      jobUpdates.push("payment = ?");
      jobValues.push(Number.parseFloat(payment));
    }

    if (jobUpdates.length === 0 && clientUpdates.length === 0) {
      return res.status(400).json({ error: "At least one field is required" });
    }

    try {
      const [[jobRow]] = await db.promise().query(
        "SELECT id, client_id FROM Jobs WHERE id = ? AND user_id = ? LIMIT 1",
        [jobId, req.user.id]
      );

      if (!jobRow) {
        return res.status(404).json({ error: "Job not found" });
      }

      await db.promise().query("START TRANSACTION");

      if (clientUpdates.length > 0) {
        await db.promise().query(
          `UPDATE Clients SET ${clientUpdates.join(", ")} WHERE id = ?`,
          [...clientValues, jobRow.client_id]
        );
      }

      if (jobUpdates.length > 0) {
        await db.promise().query(
          `UPDATE Jobs SET ${jobUpdates.join(", ")} WHERE id = ? AND user_id = ?`,
          [...jobValues, jobId, req.user.id]
        );
      }

      await db.promise().query("COMMIT");
      return res.json({ message: "Job updated successfully" });
    } catch (err) {
      await db.promise().query("ROLLBACK");
      console.error("Error updating job:", err);
      return res.status(500).json({ error: "Database error" });
    }
  }
);

const PORT = process.env.PORT || 5000;
(async () => {
  try {
    validateRuntimeConfig();
    await runMigrations(db.promise());
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to prepare database schema:", error);
    process.exit(1);
  }
})();
