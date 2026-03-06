const express = require("express");
const { getDb, uid } = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/items
router.get("/", (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM items ORDER BY category, name").all();
  res.json(rows);
});

// POST /api/items
router.post("/", (req, res) => {
  const { name, quantity, unit, category, notes, min_stock, batch_number, expiry_date, stock_alert } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });

  const db = getDb();
  const id = uid();
  db.prepare(`
    INSERT INTO items (id, name, quantity, unit, category, notes, min_stock, batch_number, expiry_date, stock_alert)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), quantity || 0, unit || "", category || "Other", notes || "", min_stock || 0, batch_number || "", expiry_date || "", stock_alert ? 1 : 0);

  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  res.status(201).json(item);
});

// PUT /api/items/:id
router.put("/:id", (req, res) => {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Item not found" });

  const fields = ["name", "quantity", "unit", "category", "notes", "min_stock", "batch_number", "expiry_date", "stock_alert"];
  const updates = {};
  fields.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  if (Object.keys(updates).length === 0) return res.json(existing);

  const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  const values = Object.values(updates);
  db.prepare(`UPDATE items SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`).run(...values, req.params.id);

  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  res.json(item);
});

// PATCH /api/items/:id/adjust — adjust quantity by delta
router.patch("/:id/adjust", (req, res) => {
  const { delta } = req.body;
  if (delta === undefined || typeof delta !== "number") return res.status(400).json({ error: "delta is required" });

  const db = getDb();
  const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Item not found" });

  const newQty = Math.max(0, existing.quantity + delta);
  db.prepare("UPDATE items SET quantity = ?, updated_at = datetime('now') WHERE id = ?").run(newQty, req.params.id);

  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  res.json(item);
});

// DELETE /api/items/:id
router.delete("/:id", (req, res) => {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Item not found" });

  db.prepare("DELETE FROM items WHERE id = ?").run(req.params.id);
  res.json({ deleted: true, item: existing });
});

// POST /api/items/bulk — bulk import
router.post("/bulk", (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array is required" });

  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO items (id, name, quantity, unit, category, notes, min_stock, batch_number, expiry_date, stock_alert)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const update = db.prepare(`
    UPDATE items SET quantity = ?, unit = ?, category = ?, notes = ?, min_stock = ?,
    batch_number = ?, expiry_date = ?, stock_alert = ?, updated_at = datetime('now')
    WHERE name = ?
  `);

  const tx = db.transaction((items) => {
    let created = 0, updated = 0;
    for (const item of items) {
      const existing = db.prepare("SELECT id FROM items WHERE name = ?").get(item.name);
      if (existing) {
        update.run(item.quantity || 0, item.unit || "", item.category || "Other", item.notes || "", item.min_stock || 0, item.batch_number || "", item.expiry_date || "", item.stock_alert ? 1 : 0, item.name);
        updated++;
      } else {
        insert.run(uid(), item.name, item.quantity || 0, item.unit || "", item.category || "Other", item.notes || "", item.min_stock || 0, item.batch_number || "", item.expiry_date || "", item.stock_alert ? 1 : 0);
        created++;
      }
    }
    return { created, updated };
  });

  const result = tx(items);
  const all = db.prepare("SELECT * FROM items ORDER BY category, name").all();
  res.json({ ...result, items: all });
});

module.exports = router;
