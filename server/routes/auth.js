const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb, uid } = require("../db");
const { signToken, authMiddleware } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/register
router.post("/register", (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const id = uid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)"
  ).run(id, email.toLowerCase().trim(), hash, (name || "").trim() || "User");

  const user = { id, email: email.toLowerCase().trim(), name: (name || "").trim() || "User", role: "technician" };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const user = { id: row.id, email: row.email, name: row.name, role: row.role };
  const token = signToken(user);
  res.json({ token, user });
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT id, email, name, role, created_at FROM users WHERE id = ?").get(req.user.id);
  if (!row) return res.status(404).json({ error: "User not found" });
  res.json({ user: row });
});

module.exports = router;
