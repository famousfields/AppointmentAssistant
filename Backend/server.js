// ...existing code...
const express = require("express");
const cors = require("cors");
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

    const { name, phone, address, jobType, jobDate, comments } = req.body;

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
          INSERT INTO Jobs (client_id, job_type, job_date, comments, status)
          VALUES (?, ?, ?, ?, ?)
        `;
        db.query(jobQuery, [clientId, jobType, jobDate, comments, "Pending"], (err, result) => {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
