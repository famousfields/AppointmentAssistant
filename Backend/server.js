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
const START_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const JOB_TYPE_NAME_PATTERN = /^.{2,120}$/;
const JOB_TYPE_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;
const DEFAULT_JOB_TYPES = [
  { name: "0 Turn Mower", color: "#22c55e", sortOrder: 0 },
  { name: "Push Mower", color: "#f97316", sortOrder: 1 },
  { name: "Riding Mower", color: "#3b82f6", sortOrder: 2 },
  { name: "Pressure Washer", color: "#06b6d4", sortOrder: 3 }
];

const ACCESS_TOKEN_TTL_MS = Number.parseInt(process.env.ACCESS_TOKEN_TTL_MS || `${15 * 60 * 1000}`, 10);
const REFRESH_TOKEN_TTL_DAYS = Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "14", 10);
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || (IS_PRODUCTION ? "None" : "Lax");
const COOKIE_SECURE = (process.env.COOKIE_SECURE || `${IS_PRODUCTION}`) === "true";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
  "https://appointmentassistant.netlify.app"
];
const normalizeOrigin = (origin) => origin.trim().replace(/\/+$/, "");
const allowedOrigins = (
  (process.env.CORS_ORIGINS && process.env.CORS_ORIGINS.split(",")) || DEFAULT_CORS_ORIGINS
)
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);
const allowedOriginRegexes = ((process.env.CORS_ORIGIN_REGEXES && process.env.CORS_ORIGIN_REGEXES.split(",")) || [])
  .map((pattern) => pattern.trim())
  .filter(Boolean)
  .map((pattern) => new RegExp(pattern));

const isAllowedOrigin = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  return (
    allowedOrigins.includes(normalizedOrigin) ||
    allowedOriginRegexes.some((pattern) => pattern.test(normalizedOrigin))
  );
};

const getRefreshCookieOptions = () => ({
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAME_SITE,
  maxAgeSeconds: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60
});

const validateRuntimeConfig = () => {
  const missing = [];
  if (!ACCESS_TOKEN_SECRET) missing.push("ACCESS_TOKEN_SECRET");
  if (!REFRESH_TOKEN_SECRET) missing.push("REFRESH_TOKEN_SECRET");
  if (COOKIE_SAME_SITE.toLowerCase() === "none" && !COOKIE_SECURE) {
    missing.push("COOKIE_SECURE=true (required when COOKIE_SAME_SITE=None)");
  }

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

const normalizeJobTypeName = (value) => String(value || "").trim();

const normalizeJobTypeKey = (value) => normalizeJobTypeName(value).toLowerCase();

const normalizeHexColor = (value) => {
  const trimmed = String(value || "").trim();
  return JOB_TYPE_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : "";
};

const buildColorFromName = (value) => {
  const normalized = normalizeJobTypeKey(value);
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }

  const red = 96 + (hash & 0x3f);
  const green = 96 + ((hash >> 6) & 0x3f);
  const blue = 96 + ((hash >> 12) & 0x3f);

  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
};

const seedDefaultJobTypesForUser = async (userId) => {
  const values = DEFAULT_JOB_TYPES.map((type) => [
    userId,
    type.name,
    normalizeJobTypeKey(type.name),
    type.color,
    type.sortOrder
  ]);

  await db.promise().query(
    `
      INSERT IGNORE INTO job_types (user_id, name, normalized_name, color, sort_order)
      VALUES ?
    `,
    [values]
  );
};

const fetchJobTypeById = async (userId, jobTypeId) => {
  const [[row]] = await db.promise().query(
    `
      SELECT id, user_id, name, normalized_name, color, sort_order
      FROM job_types
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `,
    [jobTypeId, userId]
  );

  return row || null;
};

const fetchJobTypeByName = async (userId, jobTypeName) => {
  const normalizedName = normalizeJobTypeKey(jobTypeName);
  if (!normalizedName) return null;

  const [[row]] = await db.promise().query(
    `
      SELECT id, user_id, name, normalized_name, color, sort_order
      FROM job_types
      WHERE user_id = ? AND normalized_name = ?
      LIMIT 1
    `,
    [userId, normalizedName]
  );

  return row || null;
};

const ensureJobTypeForJob = async (userId, payload) => {
  const jobTypeId = payload.jobTypeId ? Number(payload.jobTypeId) : null;
  const jobTypeName = normalizeJobTypeName(payload.jobType);
  const jobTypeColor = normalizeHexColor(payload.jobTypeColor);

  if (jobTypeId) {
    const row = await fetchJobTypeById(userId, jobTypeId);
    if (!row) {
      const error = new Error("Job type not found");
      error.statusCode = 400;
      throw error;
    }
    return row;
  }

  if (!jobTypeName) {
    const error = new Error("Job type is required");
    error.statusCode = 400;
    throw error;
  }

  const existing = await fetchJobTypeByName(userId, jobTypeName);
  if (existing) {
    return existing;
  }

  const color = jobTypeColor || buildColorFromName(jobTypeName);
  const sortOrder = await getNextJobTypeSortOrder(userId);

  const [result] = await db.promise().query(
    `
      INSERT INTO job_types (user_id, name, normalized_name, color, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `,
    [userId, jobTypeName, normalizeJobTypeKey(jobTypeName), color, sortOrder]
  );

  return {
    id: result.insertId,
    user_id: userId,
    name: jobTypeName,
    normalized_name: normalizeJobTypeKey(jobTypeName),
    color,
    sort_order: sortOrder
  };
};

const getNextJobTypeSortOrder = async (userId) => {
  const [[row]] = await db.promise().query(
    `
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
      FROM job_types
      WHERE user_id = ?
    `,
    [userId]
  );

  return Number(row?.next_sort_order ?? 0);
};

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    console.log(`Preflight request for ${req.path} from origin: ${req.headers.origin || "unknown"}`);
  }
  next();
});

const corsOptions = {
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) return callback(null, true);
    console.warn(`Blocked CORS origin: ${origin}`);
    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options("/users", cors(corsOptions));
app.options("/auth/login", cors(corsOptions));
app.options("/auth/refresh", cors(corsOptions));
app.options("/auth/logout", cors(corsOptions));
app.options("/jobs", cors(corsOptions));
app.options("/jobs/:id", cors(corsOptions));
app.options("/jobs/:id/comments", cors(corsOptions));
app.options("/job-types", cors(corsOptions));
app.options("/job-types/:id", cors(corsOptions));
app.options("/clients/:id", cors(corsOptions));
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

      const [insertResult] = await db.promise().query(insertQuery, [username, email, hashedPassword]);
      if (insertResult?.insertId) {
        await seedDefaultJobTypesForUser(insertResult.insertId);
      }
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
        accessToken,
        refreshToken
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
    return res.json({ accessToken, refreshToken: nextRefreshToken, user });
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
    body("jobTypeId").optional({ values: "falsy" }).isInt({ min: 1 }).withMessage("Job type is required"),
    body("jobType").optional().trim().isLength({ min: 2 }).withMessage("Job type is required"),
    body("jobDate")
      .isISO8601()
      .withMessage("Invalid date")
      .custom((d) => {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
        return true;
      }),
    body("startTime")
      .matches(START_TIME_PATTERN)
      .withMessage("Start time must use HH:MM in 24-hour format"),
    body("comments").optional().isLength({ max: 500 }).withMessage("Comments max 500 chars"),
    body("payment")
      .optional({ values: "falsy" })
      .isFloat({ min: 0 })
      .withMessage("Payment must be a number greater than or equal to 0")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, phone, address, jobDate, startTime, comments, payment } = req.body;
    const normalizedPayment = Number.parseFloat(payment ?? 0);
    const normalizedStartTime = `${startTime}:00`;
    const userId = req.user.id;
    let jobType;

    try {
      jobType = await ensureJobTypeForJob(userId, req.body);
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message || "Invalid job type" });
    }

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
        INSERT INTO Jobs (client_id, job_type_id, job_type, job_date, start_time, comments, status, payment, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
        db.query(
          jobQuery,
          [
            clientId,
            jobType.id,
            jobType.name,
            jobDate,
            normalizedStartTime,
            comments,
            "Pending",
            normalizedPayment,
            userId
          ],
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
    SELECT j.id, j.job_type_id, COALESCE(jt.name, j.job_type) AS job_type, jt.color AS job_type_color,
           j.job_date, j.start_time, j.comments, j.status, j.payment,
           c.id AS client_id, c.name, c.phone, c.address
    FROM Jobs j
    JOIN Clients c ON j.client_id = c.id
    LEFT JOIN job_types jt ON jt.id = j.job_type_id AND jt.user_id = j.user_id
    WHERE j.user_id = ?
    ORDER BY j.job_date DESC, j.start_time ASC
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

app.get("/job-types", requireAuth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `
        SELECT id, name, color, sort_order, created_at, updated_at
        FROM job_types
        WHERE user_id = ?
        ORDER BY sort_order ASC, name ASC
      `,
      [req.user.id]
    );

    return res.json(rows);
  } catch (error) {
    console.error("Error fetching job types:", error);
    return res.status(500).json({ error: "Database error" });
  }
});

app.post(
  "/job-types",
  requireAuth,
  [
    body("name").trim().isLength({ min: 2, max: 120 }).withMessage("Job type name must be 2-120 characters"),
    body("color").optional().trim().isHexColor().withMessage("Color must be a valid hex color"),
    body("sortOrder").optional().isInt({ min: 0 }).withMessage("Sort order must be a positive number")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const name = normalizeJobTypeName(req.body.name);
    const normalizedName = normalizeJobTypeKey(name);
    const color = normalizeHexColor(req.body.color) || buildColorFromName(name);
    const sortOrder =
      req.body.sortOrder !== undefined && req.body.sortOrder !== null
        ? Number(req.body.sortOrder)
        : await getNextJobTypeSortOrder(req.user.id);

    try {
      const existing = await fetchJobTypeByName(req.user.id, name);
      if (existing) {
        return res.status(409).json({ error: "Job type already exists" });
      }

      const [result] = await db.promise().query(
        `
          INSERT INTO job_types (user_id, name, normalized_name, color, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `,
        [req.user.id, name, normalizedName, color, sortOrder]
      );

      const created = await fetchJobTypeById(req.user.id, result.insertId);
      return res.status(201).json(created);
    } catch (error) {
      console.error("Error creating job type:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Job type already exists" });
      }
      return res.status(500).json({ error: "Database error" });
    }
  }
);

app.put(
  "/job-types/:id",
  requireAuth,
  [
    body("name").trim().isLength({ min: 2, max: 120 }).withMessage("Job type name must be 2-120 characters"),
    body("color").optional().trim().isHexColor().withMessage("Color must be a valid hex color"),
    body("sortOrder").optional().isInt({ min: 0 }).withMessage("Sort order must be a positive number")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const jobTypeId = Number(req.params.id);
    if (Number.isNaN(jobTypeId)) {
      return res.status(400).json({ error: "Invalid job type ID" });
    }

    const existing = await fetchJobTypeById(req.user.id, jobTypeId);
    if (!existing) {
      return res.status(404).json({ error: "Job type not found" });
    }

    const name = normalizeJobTypeName(req.body.name);
    const normalizedName = normalizeJobTypeKey(name);
    const color = normalizeHexColor(req.body.color) || existing.color;
    const sortOrder =
      req.body.sortOrder !== undefined && req.body.sortOrder !== null
        ? Number(req.body.sortOrder)
        : existing.sort_order;

    try {
      const duplicate = await fetchJobTypeByName(req.user.id, name);
      if (duplicate && duplicate.id !== jobTypeId) {
        return res.status(409).json({ error: "Job type already exists" });
      }

      await db.promise().query(
        `
          UPDATE job_types
          SET name = ?, normalized_name = ?, color = ?, sort_order = ?
          WHERE id = ? AND user_id = ?
        `,
        [name, normalizedName, color, sortOrder, jobTypeId, req.user.id]
      );

      const updated = await fetchJobTypeById(req.user.id, jobTypeId);
      return res.json(updated);
    } catch (error) {
      console.error("Error updating job type:", error);
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Job type already exists" });
      }
      return res.status(500).json({ error: "Database error" });
    }
  }
);

app.delete("/job-types/:id", requireAuth, async (req, res) => {
  const jobTypeId = Number(req.params.id);
  if (Number.isNaN(jobTypeId)) {
    return res.status(400).json({ error: "Invalid job type ID" });
  }

  try {
    const jobType = await fetchJobTypeById(req.user.id, jobTypeId);
    if (!jobType) {
      return res.status(404).json({ error: "Job type not found" });
    }

    const [[usage]] = await db.promise().query(
      `
        SELECT COUNT(*) AS count
        FROM Jobs
        WHERE user_id = ? AND job_type_id = ?
      `,
      [req.user.id, jobTypeId]
    );

    if ((usage?.count || 0) > 0) {
      return res.status(409).json({ error: "This job type is in use and cannot be deleted yet" });
    }

    await db.promise().query("DELETE FROM job_types WHERE id = ? AND user_id = ?", [jobTypeId, req.user.id]);
    return res.json({ message: "Job type deleted successfully" });
  } catch (error) {
    console.error("Error deleting job type:", error);
    return res.status(500).json({ error: "Database error" });
  }
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
    body("jobTypeId").optional({ values: "falsy" }).isInt({ min: 1 }).withMessage("Invalid job type"),
    body("jobType").optional().trim().isLength({ min: 2 }).withMessage("Job type is required"),
    body("jobDate")
      .optional()
      .isISO8601()
      .withMessage("Invalid date")
      .custom((d) => {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
        return true;
      }),
    body("startTime")
      .optional()
      .matches(START_TIME_PATTERN)
      .withMessage("Start time must use HH:MM in 24-hour format"),
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

    const { name, phone, address, jobDate, startTime, comments, status, payment } = req.body;
    const jobUpdates = [];
    const jobValues = [];
    const clientUpdates = [];
    const clientValues = [];
    let jobType;

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

    if (startTime !== undefined) {
      jobUpdates.push("start_time = ?");
      jobValues.push(`${startTime}:00`);
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

    try {
      if (req.body.jobTypeId !== undefined || req.body.jobType !== undefined) {
        jobType = await ensureJobTypeForJob(req.user.id, req.body);
        jobUpdates.push("job_type_id = ?");
        jobValues.push(jobType.id);
        jobUpdates.push("job_type = ?");
        jobValues.push(jobType.name);
      }
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message || "Invalid job type" });
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

app.delete("/jobs/:id", requireAuth, async (req, res) => {
  const jobId = Number(req.params.id);
  if (Number.isNaN(jobId)) {
    return res.status(400).json({ error: "Invalid job ID" });
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
    await db.promise().query("DELETE FROM Jobs WHERE id = ? AND user_id = ?", [jobId, req.user.id]);

    const [[remainingClientJobs]] = await db.promise().query(
      "SELECT COUNT(*) AS count FROM Jobs WHERE client_id = ?",
      [jobRow.client_id]
    );

    if (remainingClientJobs.count === 0) {
      await db.promise().query("DELETE FROM Clients WHERE id = ?", [jobRow.client_id]);
    }

    await db.promise().query("COMMIT");
    return res.json({ message: "Job deleted successfully" });
  } catch (err) {
    await db.promise().query("ROLLBACK");
    console.error("Error deleting job:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.delete("/clients/:id", requireAuth, async (req, res) => {
  const clientId = Number(req.params.id);
  if (Number.isNaN(clientId)) {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  try {
    const [[clientRow]] = await db.promise().query(
      `
        SELECT c.id
        FROM Clients c
        JOIN Jobs j ON j.client_id = c.id
        WHERE c.id = ? AND j.user_id = ?
        LIMIT 1
      `,
      [clientId, req.user.id]
    );

    if (!clientRow) {
      return res.status(404).json({ error: "Client not found" });
    }

    await db.promise().query("START TRANSACTION");
    await db.promise().query("DELETE FROM Jobs WHERE client_id = ? AND user_id = ?", [clientId, req.user.id]);

    const [[remainingClientJobs]] = await db.promise().query(
      "SELECT COUNT(*) AS count FROM Jobs WHERE client_id = ?",
      [clientId]
    );

    if (remainingClientJobs.count === 0) {
      await db.promise().query("DELETE FROM Clients WHERE id = ?", [clientId]);
    }

    await db.promise().query("COMMIT");
    return res.json({ message: "Client deleted successfully" });
  } catch (err) {
    await db.promise().query("ROLLBACK");
    console.error("Error deleting client:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";
(async () => {
  try {
    validateRuntimeConfig();
    await runMigrations(db.promise());
    app.listen(PORT, HOST, () => {
      console.log(`Server running on ${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to prepare database schema:", error);
    process.exit(1);
  }
})();
