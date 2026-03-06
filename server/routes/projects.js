const express = require("express");
const { getDb, uid } = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// Helper: build nested project object from flat rows
function buildProject(db, projectRow) {
  const turbines = db.prepare("SELECT * FROM turbines WHERE project_id = ? ORDER BY name").all(projectRow.id);
  for (const t of turbines) {
    const blades = db.prepare("SELECT * FROM blades WHERE turbine_id = ? ORDER BY name").all(t.id);
    for (const b of blades) {
      const damages = db.prepare("SELECT * FROM damages WHERE blade_id = ? ORDER BY number").all(b.id);
      b.damages = damages.map((d) => ({ ...d, locations: JSON.parse(d.locations || "[]") }));
    }
    t.blades = blades;
  }
  return { ...projectRow, turbines };
}

// GET /api/projects
router.get("/", (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  const projects = rows.map((r) => buildProject(db, r));
  res.json(projects);
});

// GET /api/projects/:id
router.get("/:id", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Project not found" });
  res.json(buildProject(db, row));
});

// POST /api/projects
router.post("/", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });

  const db = getDb();
  const id = uid();
  db.prepare("INSERT INTO projects (id, name, created_by) VALUES (?, ?, ?)").run(id, name.trim(), req.user.id);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  res.status(201).json(buildProject(db, row));
});

// PUT /api/projects/:id
router.put("/:id", (req, res) => {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Project not found" });

  const allowed = ["name", "status", "client", "wind_farm", "location", "project_ref", "turbine_model", "blade_type", "team", "start_date", "mob_date", "planned_end_date", "project_notes", "archived"];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE projects SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  }

  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  res.json(buildProject(db, row));
});

// DELETE /api/projects/:id
router.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.json({ deleted: true });
});

// --- Turbines ---

// POST /api/projects/:projectId/turbines
router.post("/:projectId/turbines", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });

  const db = getDb();
  const id = uid();
  db.prepare("INSERT INTO turbines (id, project_id, name) VALUES (?, ?, ?)").run(id, req.params.projectId, name.trim());

  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.projectId);
  res.status(201).json(buildProject(db, row));
});

// PUT /api/turbines/:id
router.put("/turbines/:id", (req, res) => {
  const db = getDb();
  const turbine = db.prepare("SELECT * FROM turbines WHERE id = ?").get(req.params.id);
  if (!turbine) return res.status(404).json({ error: "Turbine not found" });

  if (req.body.name) db.prepare("UPDATE turbines SET name = ? WHERE id = ?").run(req.body.name.trim(), req.params.id);

  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(turbine.project_id);
  res.json(buildProject(db, row));
});

// DELETE /api/turbines/:id
router.delete("/turbines/:id", (req, res) => {
  const db = getDb();
  const turbine = db.prepare("SELECT * FROM turbines WHERE id = ?").get(req.params.id);
  if (!turbine) return res.status(404).json({ error: "Turbine not found" });

  db.prepare("DELETE FROM turbines WHERE id = ?").run(req.params.id);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(turbine.project_id);
  res.json(buildProject(db, row));
});

// POST /api/projects/:projectId/turbines/:turbineId/duplicate
router.post("/:projectId/turbines/:turbineId/duplicate", (req, res) => {
  const db = getDb();
  const src = db.prepare("SELECT * FROM turbines WHERE id = ?").get(req.params.turbineId);
  if (!src) return res.status(404).json({ error: "Turbine not found" });

  const newName = req.body.name || `${src.name} (copy)`;
  const newTurbineId = uid();
  db.prepare("INSERT INTO turbines (id, project_id, name) VALUES (?, ?, ?)").run(newTurbineId, req.params.projectId, newName);

  const blades = db.prepare("SELECT * FROM blades WHERE turbine_id = ?").all(req.params.turbineId);
  for (const blade of blades) {
    const newBladeId = uid();
    db.prepare("INSERT INTO blades (id, turbine_id, name) VALUES (?, ?, ?)").run(newBladeId, newTurbineId, blade.name);
    const damages = db.prepare("SELECT * FROM damages WHERE blade_id = ?").all(blade.id);
    for (const d of damages) {
      db.prepare(`INSERT INTO damages (id, blade_id, number, type, severity, radius, locations, notes, estimated_hours, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uid(), newBladeId, d.number, d.type, d.severity, d.radius, d.locations, d.notes, d.estimated_hours, "notstarted");
    }
  }

  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.projectId);
  res.status(201).json(buildProject(db, row));
});

// --- Blades ---

// POST /api/turbines/:turbineId/blades
router.post("/turbines/:turbineId/blades", (req, res) => {
  const db = getDb();
  const turbine = db.prepare("SELECT * FROM turbines WHERE id = ?").get(req.params.turbineId);
  if (!turbine) return res.status(404).json({ error: "Turbine not found" });

  const names = req.body.names || [req.body.name];
  for (const name of names) {
    if (name && name.trim()) {
      db.prepare("INSERT INTO blades (id, turbine_id, name) VALUES (?, ?, ?)").run(uid(), req.params.turbineId, name.trim());
    }
  }

  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(turbine.project_id);
  res.json(buildProject(db, row));
});

// PUT /api/blades/:id
router.put("/blades/:id", (req, res) => {
  const db = getDb();
  const blade = db.prepare("SELECT * FROM blades WHERE id = ?").get(req.params.id);
  if (!blade) return res.status(404).json({ error: "Blade not found" });

  if (req.body.name) db.prepare("UPDATE blades SET name = ? WHERE id = ?").run(req.body.name.trim(), req.params.id);

  const turbine = db.prepare("SELECT * FROM turbines WHERE id = ?").get(blade.turbine_id);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(turbine.project_id);
  res.json(buildProject(db, row));
});

// DELETE /api/blades/:id
router.delete("/blades/:id", (req, res) => {
  const db = getDb();
  const blade = db.prepare("SELECT * FROM blades WHERE id = ?").get(req.params.id);
  if (!blade) return res.status(404).json({ error: "Blade not found" });

  const turbine = db.prepare("SELECT * FROM turbines WHERE id = ?").get(blade.turbine_id);
  db.prepare("DELETE FROM blades WHERE id = ?").run(req.params.id);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(turbine.project_id);
  res.json(buildProject(db, row));
});

// --- Damages ---

// POST /api/blades/:bladeId/damages
router.post("/blades/:bladeId/damages", (req, res) => {
  const db = getDb();
  const blade = db.prepare("SELECT * FROM blades WHERE id = ?").get(req.params.bladeId);
  if (!blade) return res.status(404).json({ error: "Blade not found" });

  const id = uid();
  const { number, type, severity, radius, locations, notes, estimated_hours, status } = req.body;
  db.prepare(`INSERT INTO damages (id, blade_id, number, type, severity, radius, locations, notes, estimated_hours, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, req.params.bladeId,
    number || "", type || "", severity || "", radius || "",
    JSON.stringify(locations || []), notes || "",
    estimated_hours || 0, status || "notstarted"
  );

  const turbine = db.prepare("SELECT * FROM turbines WHERE id = ?").get(blade.turbine_id);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(turbine.project_id);
  res.json(buildProject(db, row));
});

// PUT /api/damages/:id
router.put("/damages/:id", (req, res) => {
  const db = getDb();
  const damage = db.prepare("SELECT * FROM damages WHERE id = ?").get(req.params.id);
  if (!damage) return res.status(404).json({ error: "Damage not found" });

  const allowed = ["number", "type", "severity", "radius", "locations", "notes", "estimated_hours", "status"];
  const updates = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) {
      updates[f] = f === "locations" ? JSON.stringify(req.body[f]) : req.body[f];
    }
  });

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    db.prepare(`UPDATE damages SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(updates), req.params.id);
  }

  const blade = db.prepare("SELECT * FROM blades WHERE id = ?").get(damage.blade_id);
  const turbine = db.prepare("SELECT * FROM turbines WHERE id = ?").get(blade.turbine_id);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(turbine.project_id);
  res.json(buildProject(db, row));
});

// DELETE /api/damages/:id
router.delete("/damages/:id", (req, res) => {
  const db = getDb();
  const damage = db.prepare("SELECT * FROM damages WHERE id = ?").get(req.params.id);
  if (!damage) return res.status(404).json({ error: "Damage not found" });

  const blade = db.prepare("SELECT * FROM blades WHERE id = ?").get(damage.blade_id);
  const turbine = db.prepare("SELECT * FROM turbines WHERE id = ?").get(blade.turbine_id);
  db.prepare("DELETE FROM damages WHERE id = ?").run(req.params.id);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(turbine.project_id);
  res.json(buildProject(db, row));
});

// --- Active project ---

// GET /api/projects/active/current
router.get("/active/current", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT project_id FROM active_project WHERE user_id = ?").get(req.user.id);
  res.json({ activeProjectId: row ? row.project_id : null });
});

// PUT /api/projects/active/current
router.put("/active/current", (req, res) => {
  const db = getDb();
  const { projectId } = req.body;
  db.prepare("INSERT OR REPLACE INTO active_project (user_id, project_id) VALUES (?, ?)").run(req.user.id, projectId || null);
  res.json({ activeProjectId: projectId || null });
});

module.exports = router;
