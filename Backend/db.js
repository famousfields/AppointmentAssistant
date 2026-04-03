require("dotenv").config();
const mysql = require("mysql2");

const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST || "localhost";
const DB_PORT = Number.parseInt(process.env.DB_PORT || process.env.MYSQLPORT || "3306", 10);
const DB_USER = process.env.DB_USER || process.env.MYSQLUSER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || "";
const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || "Jobs";

const db = mysql.createConnection({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", {
      code: err.code,
      errno: err.errno,
      message: err.message,
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER
    });
  } else {
    console.log(`Connected to MySQL at ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  }
});

module.exports = db;
