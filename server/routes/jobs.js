const express = require("express");
const { getDb, uid } = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// Helper: convert DB row to app format
function rowToJob(row) {
  return {
    ...row,
    damage: JSON.parse(row.damage_json || "{}"),
    weather: JSON.parse(row.weather_json || "{}"),
    operations: JSON.parse(row.operations_json || "[]"),
    materials: JSON.parse(row.materials_json || "[]"),
  };
}

// GET /api/jobs
router.get("/", (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM jobs ORDER BY date DESC, created_at DESC").all();
  res.json(rows.map(rowToJob));
});

// POST /api/jobs
router.post("/", (req, res) => {
  const db = getDb();
  const id = req.body.id || uid();
  const {
    project_id, turbine_id, blade_id, damage_id,
    turbine, blade_ref, damage, date, technician,
    access_method, weather, notes, operations, materials,
  } = req.body;

  db.prepare(`
    INSERT INTO jobs (id, project_id, turbine_id, blade_id, damage_id, turbine, blade_ref,
      damage_json, date, technician, access_method, weather_json, notes, operations_json, materials_json, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, project_id || null, turbine_id || null, blade_id || null, damage_id || null,
    turbine || "", blade_ref || "",
    JSON.stringify(damage || {}), date || "", technician || "",
    access_method || "", JSON.stringify(weather || {}), notes || "",
    JSON.stringify(operations || []), JSON.stringify(materials || []),
    req.user.id
  );

  // Apply material deductions
  if (operations && operations.length > 0) {
    const adjustItem = db.prepare("UPDATE items SET quantity = MAX(0, quantity - ?), updated_at = datetime('now') WHERE id = ?");
    for (const op of operations) {
      for (const m of (op.materials || [])) {
        if (m.itemId && m.amount) adjustItem.run(Number(m.amount), String(m.itemId));
      }
    }
  }
  if (materials && materials.length > 0) {
    const adjustItem = db.prepare("UPDATE items SET quantity = MAX(0, quantity - ?), updated_at = datetime('now') WHERE id = ?");
    for (const m of materials) {
      if (m.itemId && m.amount) adjustItem.run(Number(m.amount), String(m.itemId));
    }
  }

  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  res.status(201).json(rowToJob(row));
});

// PUT /api/jobs/:id
router.put("/:id", (req, res) => {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Job not found" });

  const {
    project_id, turbine_id, blade_id, damage_id,
    turbine, blade_ref, damage, date, technician,
    access_method, weather, notes, operations, materials,
  } = req.body;

  // Reverse old material deductions
  const oldOps = JSON.parse(existing.operations_json || "[]");
  const oldMats = JSON.parse(existing.materials_json || "[]");
  const restoreItem = db.prepare("UPDATE items SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?");
  for (const op of oldOps) {
    for (const m of (op.materials || [])) {
      if (m.itemId && m.amount) restoreItem.run(Number(m.amount), String(m.itemId));
    }
  }
  for (const m of oldMats) {
    if (m.itemId && m.amount) restoreItem.run(Number(m.amount), String(m.itemId));
  }

  // Update job
  db.prepare(`
    UPDATE jobs SET project_id=?, turbine_id=?, blade_id=?, damage_id=?,
      turbine=?, blade_ref=?, damage_json=?, date=?, technician=?,
      access_method=?, weather_json=?, notes=?, operations_json=?, materials_json=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    project_id || null, turbine_id || null, blade_id || null, damage_id || null,
    turbine || "", blade_ref || "",
    JSON.stringify(damage || {}), date || "", technician || "",
    access_method || "", JSON.stringify(weather || {}), notes || "",
    JSON.stringify(operations || []), JSON.stringify(materials || []),
    req.params.id
  );

  // Apply new material deductions
  const adjustItem = db.prepare("UPDATE items SET quantity = MAX(0, quantity - ?), updated_at = datetime('now') WHERE id = ?");
  if (operations) {
    for (const op of operations) {
      for (const m of (op.materials || [])) {
        if (m.itemId && m.amount) adjustItem.run(Number(m.amount), String(m.itemId));
      }
    }
  }
  if (materials) {
    for (const m of materials) {
      if (m.itemId && m.amount) adjustItem.run(Number(m.amount), String(m.itemId));
    }
  }

  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
  res.json(rowToJob(row));
});

// DELETE /api/jobs/:id
router.delete("/:id", (req, res) => {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Job not found" });

  // Reverse material deductions
  const oldOps = JSON.parse(existing.operations_json || "[]");
  const oldMats = JSON.parse(existing.materials_json || "[]");
  const restoreItem = db.prepare("UPDATE items SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?");
  for (const op of oldOps) {
    for (const m of (op.materials || [])) {
      if (m.itemId && m.amount) restoreItem.run(Number(m.amount), String(m.itemId));
    }
  }
  for (const m of oldMats) {
    if (m.itemId && m.amount) restoreItem.run(Number(m.amount), String(m.itemId));
  }

  db.prepare("DELETE FROM jobs WHERE id = ?").run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
