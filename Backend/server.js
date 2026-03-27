// ...existing code...
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const db = require("./db");
const { body, validationResult } = require("express-validator");

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// test route
app.get("/", (req, res) => {
  res.send("API is running");
});

app.get("/test-db", (req, res) => {
  db.query("SELECT 1", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "DB connected", result });
  });
});

app.post(
  "/users",
  [
    body("username").trim().isLength({ min: 3 }).withMessage("Name must be at least 3 characters"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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
      res.status(201).json({ message: "Account created successfully" });
    } catch (err) {
      console.error("Error creating user:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post(
  "/auth/login",
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

      res.json({
        message: "Login successful",
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post(
  "/jobs",
  [
    body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
    body("phone").custom((v) => {
      const digits = (v || "").replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) throw new Error("Invalid phone number");
      return true;
    }),
    body("address").trim().isLength({ min: 5 }).withMessage("Address must be at least 5 characters"),
    body("jobType").trim().notEmpty().withMessage("Job type is required"),
    body("jobDate").isISO8601().withMessage("Invalid date").custom((d) => {
      const date = new Date(d);
      const today = new Date();
      today.setHours(0,0,0,0);
      if (date < today) throw new Error("Date must be today or later");
      return true;
    }),
    body("comments").optional().isLength({ max: 500 }).withMessage("Comments max 500 chars")
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, phone, address, jobType, jobDate, comments, userId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "User ID is required" });
    }

    // Step 1: Check if client already exists
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

      // Client exists → use their id
      if (clientResult.length > 0) {
        const clientId = clientResult[0].id;
        insertJob(clientId);
      } else {
        // Client does NOT exist → insert new client
        const insertClientQuery = `
          INSERT INTO Clients (name, phone, address)
          VALUES (?, ?, ?)
        `;
        db.query(insertClientQuery, [name, phone, address], (err, result) => {
          if (err) {
            console.error("Error inserting client:", err);
            return res.status(500).json({ error: "Database error" });
          }
          const clientId = result.insertId;
          insertJob(clientId);
        });
      }

      // Function to insert job for a given client_id
      function insertJob(clientId) {
        const jobQuery = `
        INSERT INTO Jobs (client_id, job_type, job_date, comments, status, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
        db.query(
          jobQuery,
          [clientId, jobType, jobDate, comments, "Pending", userId],
          (err, result) => {
            if (err) {
            console.error("Error inserting job:", err);
            return res.status(500).json({ error: "Database error" });
          }
          res.json({ message: "Job saved successfully", jobId: result.insertId });
        });
      }
    });
  }
);

app.get("/jobs", (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(401).json({ error: "User ID is required" });
  }

  const query = `
    SELECT j.id, j.job_type, j.job_date, j.comments, j.status,
           c.id AS client_id, c.name, c.phone, c.address
    FROM Jobs j
    JOIN Clients c ON j.client_id = c.id
    WHERE j.user_id = ?
    ORDER BY j.job_date DESC
    `;
  
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error fetching jobs:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

app.patch("/jobs/:id/comments", (req, res) => {
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

  const query = "UPDATE Jobs SET comments = ? WHERE id = ?";
  db.query(query, [trimmed === "" ? null : trimmed, jobId], (err, result) => {
    if (err) {
      console.error("Error updating comments:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json({ message: "Comments updated successfully" });
  });
});

app.put("/jobs/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  const validStatuses = ["Pending", "In Progress", "Completed", "Cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const query = "UPDATE Jobs SET status = ? WHERE id = ?";
  db.query(query, [status, id], (err, result) => {
    if (err) {
      console.error("Error updating job:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json({ message: "Job status updated successfully" });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
