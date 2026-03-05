import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import ChevronIcon from "./ChevronIcon";

function InventoryPage({
  items,
  filteredItems,
  categoryOptions,
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  newName,
  setNewName,
  newQuantity,
  setNewQuantity,
  newUnit,
  setNewUnit,
  newCategory,
  setNewCategory,
  newNotes,
  setNewNotes,
  newMinStock,
  setNewMinStock,
  newBatchNumber,
  setNewBatchNumber,
  newExpiryDate,
  setNewExpiryDate,
  handleAddItem,
  handleAdjustQuantity,
  handleSetQuantity,
  handleUpdateItem,
  handleDelete,
  handleRestoreItem,
  getStockStatusClass,
  consumedByProject,
  consumedTotal,
  activeProjectName,
  jobHistory,
  activeProjectId,
  projects,
  sortBy,
  setSortBy,
  auditLog,
}) {
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [customQty, setCustomQty] = useState({});
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const importInputRef = useRef(null);
  const searchInputRef = useRef(null);

  // Side detail panel
  const [selectedItemId, setSelectedItemId] = useState(null);
  const detailPanelRef = useRef(null);

  // New local state
  const [quickFilter, setQuickFilter] = useState("stocked");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedConsumption, setExpandedConsumption] = useState({});
  const [importPreview, setImportPreview] = useState(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [pendingQtyChange, setPendingQtyChange] = useState(null); // {itemId, amount}
  const pendingQtyTimerRef = useRef(null);
  const addFormRef = useRef(null);

  // Receive stock state
  const [receiveStockOpen, setReceiveStockOpen] = useState(false);
  const [receiveSearch, setReceiveSearch] = useState("");
  const [receiveSelectedItemId, setReceiveSelectedItemId] = useState(null);
  const [receiveQty, setReceiveQty] = useState("");
  const [receiveBatch, setReceiveBatch] = useState("");
  const [receiveExpiry, setReceiveExpiry] = useState("");
  const [receiveLog, setReceiveLog] = useState([]); // session log of received items
  const receiveFormRef = useRef(null);
  const receiveSearchRef = useRef(null);
  const receiveQtyRef = useRef(null);

  // View mode: cards or list (list is default)
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem("vetra-inv-view") || "list"; } catch { return "list"; }
  });
  useEffect(() => {
    try { localStorage.setItem("vetra-inv-view", viewMode); } catch {}
  }, [viewMode]);

  // Mobile add menu (bottom sheet for + button)
  const [mobileAddMenuOpen, setMobileAddMenuOpen] = useState(false);
  // Expanded qty controls per card (Issue 3)
  const [expandedQtyId, setExpandedQtyId] = useState(null);

  // Collapsed category sections (for category grouping)
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const actionsRef = useRef(null);
  const confirmTimerRef = useRef(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      if (pendingQtyTimerRef.current) clearTimeout(pendingQtyTimerRef.current);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!exportMenuOpen && !mobileAddMenuOpen) return;
    const handler = (e) => {
      if (exportMenuOpen && actionsRef.current && !actionsRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
      if (mobileAddMenuOpen) {
        setMobileAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportMenuOpen, mobileAddMenuOpen]);

  // ── Selected item for detail panel ─────────────────────────────
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return items.find((i) => i.id === selectedItemId) || null;
  }, [selectedItemId, items]);

  const openDetailPanel = useCallback((item) => {
    setSelectedItemId(item.id);
    // If editing a different item, cancel that edit
    if (editingItemId && editingItemId !== item.id) {
      setEditingItemId(null);
      setEditFields({});
    }
  }, [editingItemId]);

  const closeDetailPanel = useCallback(() => {
    setSelectedItemId(null);
    setEditingItemId(null);
    setEditFields({});
  }, []);

  // Keyboard shortcuts: / focuses search, n opens add form, Escape closes panel
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && selectedItemId) {
        closeDetailPanel();
        return;
      }
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setAddFormOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedItemId, closeDetailPanel]);

  // ── Consumption rate (weekly, last 30 days) ───────────────────
  const consumptionRates = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const totals = {};
    (jobHistory || []).forEach((job) => {
      const jobDate = new Date(job.date).getTime();
      if (jobDate < cutoff) return;
      const allMats = [
        ...(job.materials || []),
        ...(job.operations || []).flatMap((op) => op.materials || []),
      ];
      allMats.forEach((m) => {
        const key = Number(m.itemId);
        totals[key] = (totals[key] || 0) + Number(m.amount || 0);
      });
    });
    const rates = {};
    Object.entries(totals).forEach(([id, total]) => {
      rates[id] = +(total / 4.29).toFixed(1); // 30 days ≈ 4.29 weeks
    });
    return rates;
  }, [jobHistory]);

  // ── Consumption breakdown per item (for drill-down, filtered by active project) ───
  const consumptionBreakdown = useMemo(() => {
    const result = {};
    (jobHistory || []).forEach((job) => {
      if (activeProjectId && job.projectId !== activeProjectId) return;
      const allMats = [
        ...(job.materials || []),
        ...(job.operations || []).flatMap((op) => op.materials || []),
      ];
      allMats.forEach((m) => {
        const key = Number(m.itemId);
        if (!result[key]) result[key] = [];
        result[key].push({
          date: job.date || "",
          turbine: job.turbine || "",
          blade: job.bladeRef || "",
          amount: Number(m.amount || 0),
        });
      });
    });
    return result;
  }, [jobHistory, activeProjectId]);

  // ── Quick filter counts (Issue 5) ────────────────────────────
  const quickFilterCounts = useMemo(() => {
    const stocked = filteredItems.filter((i) => i.quantity > 0).length;
    const notloaded = filteredItems.filter((i) => i.quantity === 0).length;
    const low = filteredItems.filter((i) => i.quantity > 0 && i.minStock > 0 && i.quantity <= i.minStock).length;
    const reorder = filteredItems.filter((i) => i.minStock > 0 && i.quantity < i.minStock).length;
    return { stocked, all: filteredItems.length, notloaded, low, reorder };
  }, [filteredItems]);

  // ── Apply quick filters on top of filteredItems ───────────────
  const quickFilteredItems = useMemo(() => {
    if (quickFilter === "stocked") return filteredItems.filter((item) => item.quantity > 0);
    if (quickFilter === "all") return filteredItems;
    if (quickFilter === "notloaded") return filteredItems.filter((item) => item.quantity === 0);
    if (quickFilter === "low") {
      return filteredItems.filter((item) => {
        return item.quantity > 0 && item.minStock > 0 && item.quantity <= item.minStock;
      });
    }
    if (quickFilter === "reorder") {
      return filteredItems.filter((item) => item.minStock > 0 && item.quantity < item.minStock);
    }
    return filteredItems;
  }, [filteredItems, quickFilter]);

  // ── Summary stats (Issue 4) ───────────────────────────────────
  const summaryStats = useMemo(() => {
    const total = items.length;
    const inVan = items.filter((i) => i.quantity > 0).length;
    const notLoaded = items.filter((i) => i.quantity === 0).length;
    const low = items.filter((i) => i.quantity > 0 && i.minStock > 0 && i.quantity <= i.minStock).length;
    return { total, inVan, notLoaded, low };
  }, [items]);

  // ── Receive stock: live selected item (always fresh from items array) ──
  const receiveSelectedItem = useMemo(() => {
    if (!receiveSelectedItemId) return null;
    return items.find((i) => i.id === receiveSelectedItemId) || null;
  }, [receiveSelectedItemId, items]);

  // ── Receive stock search results (grouped by category, show all when no search) ──────
  const receiveSearchResults = useMemo(() => {
    const term = receiveSearch.trim().toLowerCase();
    let filtered = categoryFilter && categoryFilter !== "All"
      ? items.filter((item) => item.category === categoryFilter)
      : items;
    if (term) {
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(term) ||
        (item.category || "").toLowerCase().includes(term)
      );
    }
    const groups = {};
    filtered.forEach((item) => {
      const cat = item.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return { groups, total: filtered.length };
  }, [items, receiveSearch, categoryFilter]);

  const handleReceiveStock = () => {
    if (!receiveSelectedItem || !receiveQty || Number(receiveQty) <= 0) return;
    const qty = Number(receiveQty);
    handleAdjustQuantity(receiveSelectedItem.id, qty);
    const updates = {};
    if (receiveBatch) updates.batchNumber = receiveBatch;
    if (receiveExpiry) updates.expiryDate = receiveExpiry;
    if (Object.keys(updates).length > 0) {
      handleUpdateItem(receiveSelectedItem.id, updates);
    }
    // Add to session log
    setReceiveLog((prev) => [{
      name: receiveSelectedItem.name,
      qty,
      unit: receiveSelectedItem.unit || "units",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }, ...prev]);
    showToast(`Received ${qty} ${receiveSelectedItem.unit || "units"} of ${receiveSelectedItem.name}`, "success");
    // Stay on same item — reset qty fields for quick repeat, keep search intact
    setReceiveQty("");
    setReceiveBatch("");
    setReceiveExpiry("");
    setTimeout(() => receiveQtyRef.current?.focus(), 50);
  };

  const closeReceiveStock = () => {
    setReceiveStockOpen(false);
    setReceiveSelectedItemId(null);
    setReceiveQty("");
    setReceiveBatch("");
    setReceiveExpiry("");
    setReceiveSearch("");
    setReceiveLog([]);
  };

  // ── Inline editing ──────────────────────────────────────────
  const startEdit = (item) => {
    setEditingItemId(item.id);
    setEditFields({
      name: item.name,
      notes: item.notes || "",
      unit: item.unit || "",
      category: item.category || "Other",
      minStock: item.minStock || 0,
      batchNumber: item.batchNumber || "",
      expiryDate: item.expiryDate || "",
      stockAlert: !!item.stockAlert,
    });
  };

  const commitEdit = () => {
    if (editingItemId == null) return;
    const trimmedName = editFields.name.trim();
    if (!trimmedName) {
      cancelEdit();
      return;
    }
    const parsedMinStock = Number(editFields.minStock);
    const finalMinStock = Number.isNaN(parsedMinStock) || parsedMinStock < 0 ? 0 : parsedMinStock;
    handleUpdateItem(editingItemId, {
      name: trimmedName,
      notes: editFields.notes,
      unit: editFields.unit,
      category: editFields.category,
      minStock: editFields.stockAlert && finalMinStock === 0 ? 1 : finalMinStock,
      batchNumber: editFields.batchNumber || "",
      expiryDate: editFields.expiryDate || "",
      stockAlert: editFields.stockAlert,
    });
    setEditingItemId(null);
    setEditFields({});
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditFields({});
  };

  const handleEditKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") cancelEdit();
  };

  // ── Delete with two-step confirm ──────────────────────────────
  const handleDeleteStep = useCallback((item) => {
    if (confirmDeleteId === item.id) {
      // Second click — actually delete
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmDeleteId(null);
      handleDelete(item.id);
      if (selectedItemId === item.id) setSelectedItemId(null);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast({ item, message: `"${item.name}" deleted`, type: "delete" });
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 5000);
    } else {
      // First click — show confirm
      setConfirmDeleteId(item.id);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => {
        setConfirmDeleteId(null);
        confirmTimerRef.current = null;
      }, 3000);
    }
  }, [confirmDeleteId, handleDelete, selectedItemId]);

  const handleUndo = useCallback(() => {
    if (!toast) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    handleRestoreItem(toast.item);
    setToast(null);
  }, [toast, handleRestoreItem]);

  // ── Show toast helper ─────────────────────────────────────────
  const showToast = useCallback((message, type = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  // ── Restock to minStock ───────────────────────────────────────
  const handleRestock = useCallback((item) => {
    if (!item.minStock || item.quantity >= item.minStock) return;
    handleSetQuantity(item.id, item.minStock);
    showToast(`"${item.name}" restocked to ${item.minStock} ${item.unit}`);
  }, [handleSetQuantity, showToast]);

  // ── Safe quantity adjustment (warns if going to 0) ───────────
  const safeAdjustQuantity = useCallback((itemId, amount) => {
    if (amount >= 0) {
      handleAdjustQuantity(itemId, amount);
      return;
    }
    const item = items.find((i) => i.id === itemId);
    if (item && item.quantity + amount <= 0) {
      setPendingQtyChange({ itemId, amount, itemName: item.name });
      if (pendingQtyTimerRef.current) clearTimeout(pendingQtyTimerRef.current);
      pendingQtyTimerRef.current = setTimeout(() => {
        setPendingQtyChange(null);
        pendingQtyTimerRef.current = null;
      }, 5000);
      return;
    }
    handleAdjustQuantity(itemId, amount);
  }, [handleAdjustQuantity, items]);

  const confirmPendingQty = useCallback(() => {
    if (!pendingQtyChange) return;
    if (pendingQtyTimerRef.current) clearTimeout(pendingQtyTimerRef.current);
    handleAdjustQuantity(pendingQtyChange.itemId, pendingQtyChange.amount);
    setPendingQtyChange(null);
  }, [pendingQtyChange, handleAdjustQuantity]);

  const cancelPendingQty = useCallback(() => {
    if (pendingQtyTimerRef.current) clearTimeout(pendingQtyTimerRef.current);
    setPendingQtyChange(null);
  }, []);

  // ── Wrapped handleAddItem with toast ──────────────────────────
  const handleAddItemWithToast = useCallback((e) => {
    e.preventDefault();
    const trimmedName = (typeof newName === "string" ? newName : "").trim();
    if (!trimmedName) return;
    handleAddItem(e);
    showToast(`"${trimmedName}" added to inventory`);
    setAddFormOpen(false);
  }, [handleAddItem, newName, showToast]);

  // ── Expiry helpers ────────────────────────────────────────────
  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    const now = Date.now();
    const exp = new Date(expiryDate).getTime();
    const daysLeft = Math.ceil((exp - now) / (24 * 60 * 60 * 1000));
    if (daysLeft <= 0) return "expired";
    if (daysLeft <= 30) return "warning";
    return "ok";
  };

  // ── Export items CSV (enhanced) ───────────────────────────────
  const handleExportItems = () => {
    if (items.length === 0) return;
    const escapeCSV = (val) => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const headers = ["Name", "Quantity", "Unit", "Category", "Min Stock", "Batch Number", "Expiry Date", "Stock Status", "Total Consumed", "Rate/Week", "Reorder Qty", "Notes"];
    const csvLines = [headers.join(",")];
    items.forEach((item) => {
      const status = item.quantity === 0 ? "Out of Stock" : (item.minStock > 0 && item.quantity <= item.minStock) ? "Low Stock" : "In Stock";
      const consumed = consumedTotal[item.id] || 0;
      const rate = consumptionRates[item.id] || 0;
      const reorderQty = item.minStock > 0 && item.quantity < item.minStock ? item.minStock - item.quantity : 0;
      csvLines.push(
        [item.name, item.quantity, item.unit, item.category, item.minStock || 0, item.batchNumber || "", item.expiryDate || "", status, consumed, rate, reorderQty, item.notes]
          .map(escapeCSV)
          .join(",")
      );
    });
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vetra_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  // ── Import items CSV with preview ─────────────────────────────
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return;
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const nameIdx = header.indexOf("name");
      const qtyIdx = header.indexOf("quantity");
      const unitIdx = header.indexOf("unit");
      const catIdx = header.indexOf("category");
      const minIdx = header.indexOf("min stock");
      const notesIdx = header.indexOf("notes");
      const batchIdx = header.indexOf("batch number");
      const expiryIdx = header.indexOf("expiry date");
      if (nameIdx === -1) { alert("CSV must have a 'Name' column."); return; }
      const parsed = [];
      let newCount = 0;
      let updateCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const name = (cols[nameIdx] || "").trim();
        if (!name) continue;
        const qty = Number(cols[qtyIdx]) || 0;
        const unit = (cols[unitIdx] || "").trim();
        const category = (cols[catIdx] || "Other").trim();
        const minStock = Number(cols[minIdx]) || 0;
        const notes = (cols[notesIdx] || "").trim();
        const batchNumber = batchIdx >= 0 ? (cols[batchIdx] || "").trim() : "";
        const expiryDate = expiryIdx >= 0 ? (cols[expiryIdx] || "").trim() : "";
        const existing = items.find((it) => it.name.toLowerCase() === name.toLowerCase());
        if (existing) updateCount++;
        else newCount++;
        parsed.push({ name, quantity: qty, unit, category, minStock, notes, batchNumber, expiryDate, isUpdate: !!existing, existingId: existing?.id });
      }
      setImportPreview({ rows: parsed, newCount, updateCount });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const applyImport = () => {
    if (!importPreview) return;
    let imported = 0;
    importPreview.rows.forEach((row) => {
      if (row.isUpdate && row.existingId) {
        handleUpdateItem(row.existingId, { quantity: row.quantity, unit: row.unit, category: row.category, minStock: row.minStock, notes: row.notes, batchNumber: row.batchNumber, expiryDate: row.expiryDate });
      } else {
        const nextId = items.length > 0 ? Math.max(...items.map((it) => it.id)) + 1 + imported : 1 + imported;
        handleRestoreItem({ id: nextId, name: row.name, quantity: row.quantity, unit: row.unit, category: row.category, minStock: row.minStock, notes: row.notes, batchNumber: row.batchNumber, expiryDate: row.expiryDate, stockAlert: row.minStock > 0 });
        imported++;
      }
    });
    showToast(`Imported ${importPreview.rows.length} items`);
    setImportPreview(null);
    setExportMenuOpen(false);
  };

  // ── Export project materials CSV ──────────────────────────────
  const handleExportCSV = () => {
    if (!activeProjectId) return;
    const projectJobs = (jobHistory || []).filter((j) => j.projectId === activeProjectId);
    const rows = [];
    projectJobs.forEach((job) => {
      const allMats = [
        ...(job.materials || []),
        ...(job.operations || []).flatMap((op) => op.materials || []),
      ];
      allMats.forEach((m) => {
        const item = (items || []).find((i) => i.id === Number(m.itemId));
        rows.push({
          date: job.date || "",
          turbine: job.turbine || "",
          blade: job.bladeRef || "",
          damage: job.damage ? `${job.damage.number} — ${job.damage.type}` : "",
          material: item?.name || "Unknown",
          amount: m.amount,
          unit: item?.unit || "",
          batch: m.batch || "",
          technician: job.technician || "",
        });
      });
    });
    if (rows.length === 0) {
      alert("No material usage data for this project.");
      return;
    }
    const escapeCSV = (val) => {
      const s = String(val);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const headers = ["Date", "Turbine", "Blade", "Damage", "Material", "Amount", "Unit", "Batch/Lot", "Technician"];
    const csvLines = [headers.join(",")];
    rows.forEach((r) => {
      csvLines.push([r.date, r.turbine, r.blade, r.damage, r.material, r.amount, r.unit, r.batch, r.technician].map(escapeCSV).join(","));
    });
    const csvContent = csvLines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const projectName = ((projects || []).find((p) => p.id === activeProjectId)?.name || "project").replace(/\s+/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}_materials_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  // ── Clear all filters ─────────────────────────────────────────
  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("All");
    setQuickFilter("stocked");
  };

  // ── Render a single card ──────────────────────────────────────
  const renderCard = (item) => {
    const isEditing = editingItemId === item.id;
    const expiryStatus = getExpiryStatus(item.expiryDate);
    const rate = consumptionRates[item.id];
    const weeksRemaining = rate && rate > 0 && item.quantity > 0 ? Math.round(item.quantity / rate) : null;
    const isLowOrOut = item.quantity === 0 || (item.minStock > 0 && item.quantity <= item.minStock);
    const isConsumptionExpanded = expandedConsumption[item.id];
    const breakdown = consumptionBreakdown[item.id] || [];

    const isQtyExpanded = expandedQtyId === item.id;

    return (
      <article
        key={item.id}
        className={`card ${getStockStatusClass(item)}`}
      >
        <header className="card-header">
          <div>
            {isEditing ? (
              <>
                <input
                  className="card-edit-input card-edit-name"
                  value={editFields.name}
                  onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={handleEditKeyDown}
                  autoFocus
                />
                <select
                  className="card-edit-select"
                  value={editFields.category}
                  onChange={(e) => setEditFields((f) => ({ ...f, category: e.target.value }))}
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <div className="card-name-row">
                  <h3
                    className={`card-name-clickable card-name-truncate${selectedItemId === item.id ? " card-name-selected" : ""}`}
                    onClick={() => openDetailPanel(item)}
                    title={item.name}
                  >
                    {item.name}
                  </h3>
                  <span className="card-edit-icon" onClick={() => startEdit(item)} title="Edit item details">&#9998;</span>
                </div>
                <span className="card-category">{item.category}</span>
                {/* Only show badges for actionable states (Issue 11) */}
                {item.quantity === 0 && (
                  <span className="inv-row-badge inv-row-badge-notloaded" title="Not loaded — quantity is 0">Not loaded</span>
                )}
                {item.quantity > 0 && item.minStock > 0 && item.quantity <= item.minStock && (
                  <span className="inv-row-badge inv-row-badge-low" title="Below minimum stock level">Low</span>
                )}
                {expiryStatus === "warning" && <span className="card-warning-icon" title="Expiry date approaching">&#9888;</span>}
                {expiryStatus === "expired" && <span className="card-warning-icon card-warning-expired" title="Expired — do not use">&#9888;</span>}
              </>
            )}
          </div>
          {isEditing && (
            <div className="card-edit-actions">
              <button type="button" className="secondary-button small" onClick={commitEdit}>Save</button>
              <button type="button" className="delete-button small" onClick={cancelEdit}>Cancel</button>
            </div>
          )}
        </header>

        <div className="card-body">
          {/* Issue 7: simplified display for qty=0 items */}
          {item.quantity === 0 && !isQtyExpanded ? (
            <div className="quantity-row quantity-row-zero">
              <span className="quantity-value quantity-value-zero">0 {item.unit}</span>
              <button
                type="button"
                className="secondary-button small"
                onClick={() => handleAdjustQuantity(item.id, 1)}
                title="Add 1"
              >
                + Add to Van
              </button>
            </div>
          ) : (
            <div className="quantity-row">
              {/* Issue 3: compact by default, tap qty to expand */}
              {!isQtyExpanded ? (
                <div className="quantity-controls">
                  <button type="button" onClick={() => safeAdjustQuantity(item.id, -1)} disabled={item.quantity === 0} title="Remove 1">−</button>
                  <span className="quantity-value quantity-value-tappable" onClick={() => setExpandedQtyId(item.id)} title="Tap for more controls">
                    {item.quantity} {item.unit}
                  </span>
                  <button type="button" onClick={() => handleAdjustQuantity(item.id, 1)} title="Add 1">+</button>
                </div>
              ) : (
                <div className="quantity-controls-expanded">
                  <div className="quantity-controls">
                    <button type="button" onClick={() => safeAdjustQuantity(item.id, -5)} disabled={item.quantity === 0} title="Remove 5">-5</button>
                    <button type="button" onClick={() => safeAdjustQuantity(item.id, -1)} disabled={item.quantity === 0} title="Remove 1">−</button>
                    <span className="quantity-value quantity-value-tappable" onClick={() => setExpandedQtyId(null)} title="Collapse controls">
                      {item.quantity} {item.unit}
                    </span>
                    <button type="button" onClick={() => handleAdjustQuantity(item.id, 1)} title="Add 1">+</button>
                    <button type="button" onClick={() => handleAdjustQuantity(item.id, 5)} title="Add 5">+5</button>
                  </div>
                  <div className="custom-qty-row">
                    <input
                      type="number"
                      min="0"
                      className="custom-qty-input"
                      placeholder="Qty"
                      value={customQty[item.id] || ""}
                      onChange={(e) => setCustomQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = Number(customQty[item.id]);
                          if (!Number.isNaN(val) && val >= 0) {
                            handleAdjustQuantity(item.id, val);
                            setCustomQty((prev) => ({ ...prev, [item.id]: "" }));
                          }
                        }
                      }}
                    />
                    <button type="button" className="secondary-button small" onClick={() => { const val = Number(customQty[item.id]); if (!Number.isNaN(val) && val >= 0) { handleAdjustQuantity(item.id, val); setCustomQty((prev) => ({ ...prev, [item.id]: "" })); } }}>Add</button>
                    <button type="button" className="secondary-button small" onClick={() => { const val = Number(customQty[item.id]); if (!Number.isNaN(val) && val >= 0) { safeAdjustQuantity(item.id, -val); setCustomQty((prev) => ({ ...prev, [item.id]: "" })); } }}>Sub</button>
                    <button type="button" className="secondary-button small" onClick={() => { const val = Number(customQty[item.id]); if (!Number.isNaN(val) && val >= 0) { handleSetQuantity(item.id, val); setCustomQty((prev) => ({ ...prev, [item.id]: "" })); } }}>Set</button>
                  </div>
                </div>
              )}
              {pendingQtyChange && pendingQtyChange.itemId === item.id && (
                <div className="qty-zero-warning">
                  <span>Quantity will reach 0</span>
                  <button type="button" className="secondary-button small" onClick={confirmPendingQty}>Confirm</button>
                  <button type="button" className="secondary-button small" onClick={cancelPendingQty}>Cancel</button>
                </div>
              )}
            </div>
          )}

          {isEditing ? (
            <>
              <div className="field">
                <label>Unit</label>
                <input
                  className="card-edit-input"
                  value={editFields.unit}
                  onChange={(e) => setEditFields((f) => ({ ...f, unit: e.target.value }))}
                  onKeyDown={handleEditKeyDown}
                  placeholder="kits, m², pcs..."
                />
              </div>
              <div className="field">
                <label>Min Stock</label>
                <input
                  className="card-edit-input"
                  type="number"
                  min="0"
                  value={editFields.minStock}
                  onChange={(e) => setEditFields((f) => ({ ...f, minStock: e.target.value }))}
                  onKeyDown={handleEditKeyDown}
                />
              </div>
              <div className="field">
                <label>Batch Number</label>
                <input
                  className="card-edit-input"
                  value={editFields.batchNumber}
                  onChange={(e) => setEditFields((f) => ({ ...f, batchNumber: e.target.value }))}
                  onKeyDown={handleEditKeyDown}
                  placeholder="e.g. LOT-2026-001"
                />
              </div>
              <div className="field">
                <label>Expiry Date</label>
                <input
                  className="card-edit-input"
                  type="date"
                  value={editFields.expiryDate}
                  onChange={(e) => setEditFields((f) => ({ ...f, expiryDate: e.target.value }))}
                  onKeyDown={handleEditKeyDown}
                />
              </div>
              <div className="field field-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={editFields.stockAlert || false}
                    onChange={(e) => setEditFields((f) => ({ ...f, stockAlert: e.target.checked }))}
                  />
                  Stock Alert
                </label>
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea
                  className="card-edit-input"
                  rows="2"
                  value={editFields.notes}
                  onChange={(e) => setEditFields((f) => ({ ...f, notes: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                />
              </div>
            </>
          ) : (
            <div className="card-meta">
              {item.notes && (
                <p className="card-notes">{item.notes}</p>
              )}

              {item.minStock > 0 && (
                <p className="card-min-stock">
                  Min alert: {item.minStock} {item.unit}
                </p>
              )}

              {item.batchNumber && (
                <p className="card-batch">Batch: {item.batchNumber}</p>
              )}

              {item.expiryDate && (
                <p className={`card-expiry ${expiryStatus === "expired" ? "card-expiry-expired" : expiryStatus === "warning" ? "card-expiry-warning" : ""}`}>
                  Expires: {item.expiryDate}{expiryStatus === "expired" ? " — EXPIRED" : expiryStatus === "warning" ? " — Expiring soon" : ""}
                </p>
              )}

              {/* Burn rate */}
              {rate > 0 && (
                <p className="card-burn-rate">
                  ~{rate}/{item.unit || "unit"} per week{weeksRemaining != null ? ` · ~${weeksRemaining} weeks remaining` : ""}
                </p>
              )}
            </div>
          )}

          {/* Consumed display */}
          {activeProjectName && (consumedByProject[item.id] || 0) > 0 && (
            <p
              className="card-consumed card-consumed-clickable"
              onClick={() => setExpandedConsumption((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
            >
              Consumed ({activeProjectName}): {consumedByProject[item.id]} {item.unit}
              <span className="card-consumed-toggle">{isConsumptionExpanded ? "▲" : "▼"}</span>
            </p>
          )}
          {isConsumptionExpanded && breakdown.length > 0 && (
            <div className="card-consumption-breakdown">
              {breakdown.slice(0, 10).map((entry, i) => (
                <div key={i} className="consumption-entry">
                  <span>{entry.date}</span>
                  <span>{entry.turbine}{entry.blade ? ` / ${entry.blade}` : ""}</span>
                  <span>-{entry.amount}</span>
                </div>
              ))}
              {breakdown.length > 10 && <p className="consumption-more">+{breakdown.length - 10} more</p>}
            </div>
          )}
          {(consumedTotal[item.id] || 0) > 0 && (
            (!activeProjectName || consumedTotal[item.id] !== (consumedByProject[item.id] || 0)) && (
              <p className="card-consumed">
                Total consumed: {consumedTotal[item.id]} {item.unit}
              </p>
            )
          )}

          {/* Restock button */}
          {isLowOrOut && item.minStock > 0 && item.quantity < item.minStock && (
            <button
              type="button"
              className="secondary-button small restock-btn"
              onClick={() => handleRestock(item)}
            >
              Restock to {item.minStock}
            </button>
          )}
        </div>
      </article>
    );
  };

  // ── Render a single list row ─────────────────────────────────
  const getStatusDot = (item) => {
    if (item.quantity === 0) return "status-dot status-dot-red";
    if (item.minStock > 0 && item.quantity <= item.minStock) return "status-dot status-dot-orange";
    return "status-dot status-dot-green";
  };

  const getStockLabel = (item) => {
    if (item.quantity === 0) return "Not loaded";
    if (item.minStock > 0 && item.quantity <= item.minStock) return "Low";
    return null; // Issue 11: no badge for OK items
  };

  const getStockBadgeClass = (item) => {
    if (item.quantity === 0) return "inv-row-badge inv-row-badge-notloaded";
    if (item.minStock > 0 && item.quantity <= item.minStock) return "inv-row-badge inv-row-badge-low";
    return null; // Issue 11: no badge for OK items
  };

  const renderListRow = (item) => {
    const isEditing = editingItemId === item.id;
    const expiryStatus = getExpiryStatus(item.expiryDate);
    const rate = consumptionRates[item.id];
    const isLowOrOut = item.quantity === 0 || (item.minStock > 0 && item.quantity <= item.minStock);

    // Build secondary info text
    const secondaryParts = [];
    if (item.batchNumber) secondaryParts.push(`Batch: ${item.batchNumber}`);
    if (item.expiryDate) {
      let expText = `Exp: ${item.expiryDate}`;
      if (expiryStatus === "expired") expText += " — EXPIRED";
      else if (expiryStatus === "warning") expText += " — Soon";
      secondaryParts.push(expText);
    }
    if (item.minStock > 0) secondaryParts.unshift(`Min: ${item.minStock}`);
    if (rate > 0) secondaryParts.push(`~${rate}/${item.unit || "unit"}/wk`);

    return (
      <div key={item.id} className={`inv-row ${getStockStatusClass(item)}`}>
        <div className="inv-row-status-bar" />
        <div className="inv-row-main">
          <div className="inv-row-top">
            <div className="inv-row-info">
              {isEditing ? (
                <div className="inv-row-edit-fields">
                  <input
                    className="card-edit-input inv-row-edit-name"
                    value={editFields.name}
                    onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
                    onKeyDown={handleEditKeyDown}
                    autoFocus
                  />
                  <select
                    className="card-edit-select"
                    value={editFields.category}
                    onChange={(e) => setEditFields((f) => ({ ...f, category: e.target.value }))}
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <span
                    className={`inv-row-name inv-row-name-clickable${selectedItemId === item.id ? " inv-row-name-selected" : ""}`}
                    onClick={() => openDetailPanel(item)}
                    title="View details"
                  >{item.name}</span>
                  <span className="inv-row-category">{item.category}</span>
                </>
              )}
            </div>
            <div className="inv-row-right">
                <div className="inv-row-qty-controls">
                  <button type="button" onClick={() => safeAdjustQuantity(item.id, -5)} disabled={item.quantity === 0} title="Remove 5">-5</button>
                  <button type="button" onClick={() => safeAdjustQuantity(item.id, -1)} disabled={item.quantity === 0} title="Remove 1">−</button>
                  <span className="inv-row-qty-value">{item.quantity} {item.unit}</span>
                  <button type="button" onClick={() => handleAdjustQuantity(item.id, 1)} title="Add 1">+</button>
                  <button type="button" onClick={() => handleAdjustQuantity(item.id, 5)} title="Add 5">+5</button>
                </div>
                {pendingQtyChange && pendingQtyChange.itemId === item.id && (
                  <div className="qty-zero-warning">
                    <span>Qty will reach 0</span>
                    <button type="button" className="secondary-button small" onClick={confirmPendingQty}>Confirm</button>
                    <button type="button" className="secondary-button small" onClick={cancelPendingQty}>Cancel</button>
                  </div>
                )}
              {getStockBadgeClass(item) && (
                <span className={getStockBadgeClass(item)} title={
                  item.quantity === 0 ? "Not loaded — quantity is 0" :
                  "Low — below minimum stock level"
                }>{getStockLabel(item)}</span>
              )}
              <div className="inv-row-actions">
                {isEditing ? (
                  <>
                    <button type="button" className="inv-list-save-btn" onClick={commitEdit}>Save</button>
                    <button type="button" className="inv-list-cancel-btn" onClick={cancelEdit}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="inv-list-action-btn" onClick={() => startEdit(item)} title="Edit">&#9998;</button>
                    {confirmDeleteId === item.id ? (
                      <span className="inv-row-delete-confirm">
                        <span className="inv-row-delete-prompt">Delete?</span>
                        <button type="button" className="inv-list-action-btn inv-list-action-danger" onClick={() => handleDeleteStep(item)}>Yes</button>
                        <button type="button" className="inv-list-action-btn" onClick={() => { setConfirmDeleteId(null); if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); }}>No</button>
                      </span>
                    ) : (
                      <button type="button" className="inv-list-action-btn" onClick={() => handleDeleteStep(item)} title="Delete item">&#10005;</button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Secondary line: notes, batch, expiry, rate */}
          {(secondaryParts.length > 0 || (item.notes && !isEditing)) && (
            <div className="inv-row-secondary">
              {item.notes && !isEditing && <span className="inv-row-notes">{item.notes}</span>}
              {secondaryParts.length > 0 && (
                <span className={`inv-row-meta${expiryStatus === "expired" ? " inv-row-meta-expired" : expiryStatus === "warning" ? " inv-row-meta-warning" : ""}`}>
                  {secondaryParts.join(" · ")}
                </span>
              )}
            </div>
          )}
          {/* Edit fields for restock mode */}
          {isEditing && (
            <div className="inv-row-edit-extra">
              <div className="inv-row-edit-grid">
                <div className="inv-row-edit-field">
                  <label className="inv-row-edit-label">Unit</label>
                  <input className="card-edit-input" value={editFields.unit} onChange={(e) => setEditFields((f) => ({ ...f, unit: e.target.value }))} placeholder="kits, m², pcs..." onKeyDown={handleEditKeyDown} />
                </div>
                <div className="inv-row-edit-field">
                  <label className="inv-row-edit-label">Min Stock Alert</label>
                  <input className="card-edit-input" type="number" min="0" value={editFields.minStock} onChange={(e) => setEditFields((f) => ({ ...f, minStock: e.target.value }))} placeholder="0" onKeyDown={handleEditKeyDown} />
                </div>
                <div className="inv-row-edit-field">
                  <label className="inv-row-edit-label">Batch #</label>
                  <input className="card-edit-input" value={editFields.batchNumber} onChange={(e) => setEditFields((f) => ({ ...f, batchNumber: e.target.value }))} placeholder="e.g. LOT-2026-001" onKeyDown={handleEditKeyDown} />
                </div>
                <div className="inv-row-edit-field">
                  <label className="inv-row-edit-label">Expiry Date</label>
                  <input className="card-edit-input" type="date" value={editFields.expiryDate} onChange={(e) => setEditFields((f) => ({ ...f, expiryDate: e.target.value }))} onKeyDown={handleEditKeyDown} />
                </div>
              </div>
              <div className="inv-row-edit-field">
                <label className="inv-row-edit-label">Notes / Description</label>
                <textarea className="card-edit-input" rows="2" value={editFields.notes} onChange={(e) => setEditFields((f) => ({ ...f, notes: e.target.value }))} onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }} placeholder="Batch, supplier, typical use..." />
              </div>
            </div>
          )}
          {/* Restock button for low/out items */}
          {isLowOrOut && item.minStock > 0 && item.quantity < item.minStock && (
            <button type="button" className="secondary-button small restock-btn inv-row-restock" onClick={() => handleRestock(item)}>
              Restock to {item.minStock}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Render list wrapper ──────────────────────────────────────
  const renderListView = (itemsToRender) => (
    <div className="inv-row-list">
      {itemsToRender.map(renderListRow)}
    </div>
  );

  // ── Helper: render items in the current viewMode ──────────────
  const renderItemsInView = (itemsToRender) => {
    if (viewMode === "list") return renderListView(itemsToRender);
    return <div className="cards-grid">{itemsToRender.map(renderCard)}</div>;
  };

  // ── Section headers when sorted by status / category ──────────
  const renderCards = () => {
    if (quickFilter === "reorder") {
      // Reorder list / shopping table
      if (quickFilteredItems.length === 0) {
        return (
          <div className="empty-state">
            {searchTerm === "" && categoryFilter === "All" ? (
              <p>No items are flagged for reorder. Items that fall below their minimum stock threshold will appear here.</p>
            ) : (
              <>
                <p>No items match your filters.</p>
                <button type="button" className="secondary-button small" onClick={clearFilters}>Clear all filters</button>
              </>
            )}
          </div>
        );
      }
      return (
        <div className="inv-reorder-table-wrap">
          <table className="inv-reorder-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Current</th>
                <th>Min Stock</th>
                <th>Order Qty</th>
              </tr>
            </thead>
            <tbody>
              {quickFilteredItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.quantity} {item.unit}</td>
                  <td>{item.minStock} {item.unit}</td>
                  <td className="reorder-qty">{item.minStock - item.quantity} {item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (quickFilter === "all") {
      // Always group by In Van / Not Loaded in "All Materials" view
      const inVanItems = quickFilteredItems.filter((i) => i.quantity > 0);
      const notLoadedItems = quickFilteredItems.filter((i) => i.quantity === 0);
      return (
        <>
          {inVanItems.length > 0 && (
            <>
              <div className="inv-section-header">In Van ({inVanItems.length})</div>
              {renderItemsInView(inVanItems)}
            </>
          )}
          {notLoadedItems.length > 0 && (
            <div className="inv-not-loaded-section">
              <div className="inv-section-header inv-section-notloaded">Not Loaded ({notLoadedItems.length})</div>
              {renderItemsInView(notLoadedItems)}
            </div>
          )}
        </>
      );
    }

    if (sortBy === "category" && quickFilter !== "all" && quickFilter !== "reorder") {
      // Group by category with collapsible sections
      const groups = {};
      quickFilteredItems.forEach((item) => {
        const cat = item.category || "Other";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
      });
      const sortedCategories = Object.keys(groups).sort((a, b) => a.localeCompare(b));
      return (
        <>
          {sortedCategories.map((cat) => {
            const isCollapsed = collapsedCategories[cat];
            return (
              <div key={cat}>
                <div
                  className="inv-section-header inv-section-collapsible"
                  onClick={() => setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                >
                  <span>{cat} ({groups[cat].length})</span>
                  <ChevronIcon up={!isCollapsed} />
                </div>
                {!isCollapsed && renderItemsInView(groups[cat])}
              </div>
            );
          })}
        </>
      );
    }

    return renderItemsInView(quickFilteredItems);
  };

  const hasAnyItems = items.length > 0;
  const hasResults = quickFilteredItems.length > 0;

  return (
    <>
      <main className="app-main inv-main">
        {/* ── Toolbar ──────────────────────────────────────────── */}
        <section className="inv-toolbar">
          {/* Row 1: Search (full width on mobile) */}
          <div className="inv-toolbar-search-row">
            <div className="search-wrapper">
              <input
                ref={searchInputRef}
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search materials... (press /)"
                className="inv-search-input"
              />
              {searchTerm.length > 0 && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Sort + View toggle + Add buttons + Actions */}
          <div className="inv-toolbar-row">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort by"
              className="inv-toolbar-select"
            >
              <option value="name">Sort: Name</option>
              <option value="quantity">Sort: Qty</option>
              <option value="category">Sort: Category</option>
              <option value="status">Sort: Status</option>
            </select>

            <button
              type="button"
              className="inv-view-toggle-btn"
              onClick={() => setViewMode(viewMode === "list" ? "cards" : "list")}
              title={viewMode === "list" ? "Switch to card view" : "Switch to list view"}
              aria-label={viewMode === "list" ? "Card view" : "List view"}
            >
              {viewMode === "list" ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" /><rect x="9" y="1" width="6" height="6" /><rect x="1" y="9" width="6" height="6" /><rect x="9" y="9" width="6" height="6" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2" /><rect x="1" y="7" width="14" height="2" /><rect x="1" y="12" width="14" height="2" /></svg>
              )}
            </button>

            {/* Desktop: full buttons. Mobile: single + icon that opens menu */}
            <button
              type="button"
              className="secondary-button small inv-desktop-add-btn"
              onClick={() => {
                setReceiveStockOpen(false);
                setAddFormOpen((v) => {
                  if (v) {
                    setNewName(""); setNewQuantity(""); setNewUnit(""); setNewCategory("Resin");
                    setNewNotes(""); setNewMinStock(""); setNewBatchNumber(""); setNewExpiryDate("");
                  } else {
                    setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                  }
                  return !v;
                });
              }}
              title="Add a brand new material to the system"
            >
              + New Material
            </button>

            <button
              type="button"
              className="secondary-button small inv-desktop-add-btn"
              onClick={() => {
                setAddFormOpen(false);
                if (receiveStockOpen) { closeReceiveStock(); } else {
                  setReceiveStockOpen(true);
                  setTimeout(() => receiveFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                  setTimeout(() => receiveSearchRef.current?.focus(), 100);
                }
              }}
              title="Add quantity to an existing material"
            >
              + Receive Stock
            </button>

            {/* Mobile: single + icon button */}
            <div className="inv-mobile-add-wrapper">
              <button
                type="button"
                className="inv-mobile-add-btn"
                onClick={() => setMobileAddMenuOpen((v) => !v)}
                title="Add"
              >
                +
              </button>
              {mobileAddMenuOpen && (
                <div className="inv-mobile-add-menu">
                  <button type="button" onClick={() => {
                    setMobileAddMenuOpen(false);
                    setReceiveStockOpen(false);
                    setAddFormOpen(true);
                    setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                  }}>New Material</button>
                  <button type="button" onClick={() => {
                    setMobileAddMenuOpen(false);
                    setAddFormOpen(false);
                    setReceiveStockOpen(true);
                    setTimeout(() => receiveFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                    setTimeout(() => receiveSearchRef.current?.focus(), 100);
                  }}>Receive Stock</button>
                </div>
              )}
            </div>

            <div className="inv-actions-dropdown" ref={actionsRef}>
              <button
                type="button"
                className="inv-actions-icon-btn"
                onClick={() => setExportMenuOpen((v) => !v)}
                title="Actions"
              >
                &#8943;
              </button>
              {exportMenuOpen && (
                <div className="inv-actions-menu">
                  <button type="button" onClick={handleExportItems}>Export Items CSV</button>
                  <button type="button" onClick={() => { importInputRef.current?.click(); setExportMenuOpen(false); }}>Import Items CSV</button>
                  {activeProjectId && (
                    <button type="button" onClick={handleExportCSV}>Export Project Usage</button>
                  )}
                </div>
              )}
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
          </div>

          {/* Summary stats strip (Issue 4) */}
          <div className="inv-summary-strip">
            <span>{summaryStats.inVan} in van</span>
            <span className="inv-summary-sep">/</span>
            <span>{summaryStats.notLoaded} not loaded</span>
            {summaryStats.low > 0 && (
              <>
                <span className="inv-summary-sep">/</span>
                <span className="inv-summary-low">{summaryStats.low} low stock</span>
              </>
            )}
          </div>

          {/* Quick filter chips with counts (Issue 5) */}
          <div className="inv-quick-filters">
            {[
              { key: "stocked", label: "In Van", count: quickFilterCounts.stocked },
              { key: "all", label: "All", count: quickFilterCounts.all },
              { key: "notloaded", label: "Not Loaded", count: quickFilterCounts.notloaded },
              { key: "low", label: "Low Stock", count: quickFilterCounts.low },
              { key: "reorder", label: "Reorder", count: quickFilterCounts.reorder },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                className={`filter-chip ${quickFilter === f.key ? "filter-chip-active" : ""}`}
                onClick={() => {
                  setQuickFilter(f.key);
                  setCategoryFilter("All");
                }}
              >
                {f.label} <span className="filter-chip-count">{f.count}</span>
              </button>
            ))}
          </div>

          {/* Category filter chips (Issue 2: horizontal scroll on mobile) */}
          <div className="inv-category-chips">
            {categoryOptions.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`filter-chip ${categoryFilter === cat ? "filter-chip-active" : ""}`}
                onClick={() => {
                  if (categoryFilter === cat) {
                    setCategoryFilter("All");
                  } else {
                    setCategoryFilter(cat);
                    setQuickFilter("all");
                  }
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* ── Add Form (inline below toolbar) ──────────────────── */}
        {addFormOpen && (
        <section className="inv-add-form-section" ref={addFormRef}>
          <div className="add-form">
              <form onSubmit={handleAddItemWithToast}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="name">Name</label>
                    <input
                      id="name"
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Epoxy Resin Kit"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="quantity">Quantity</label>
                    <input
                      id="quantity"
                      type="number"
                      min="0"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="unit">Unit</label>
                    <input
                      id="unit"
                      type="text"
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      placeholder="kits, m², pcs..."
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="category">Category</label>
                    <select
                      id="category"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="minStock">Min Stock Alert</label>
                    <input
                      id="minStock"
                      type="number"
                      min="0"
                      value={newMinStock}
                      onChange={(e) => setNewMinStock(e.target.value)}
                      placeholder="0 = no alert"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="batchNumber">Batch Number</label>
                    <input
                      id="batchNumber"
                      type="text"
                      value={newBatchNumber}
                      onChange={(e) => setNewBatchNumber(e.target.value)}
                      placeholder="e.g. LOT-2026-001"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="expiryDate">Expiry Date</label>
                    <input
                      id="expiryDate"
                      type="date"
                      value={newExpiryDate}
                      onChange={(e) => setNewExpiryDate(e.target.value)}
                    />
                  </div>

                  <div className="field field-notes">
                    <label htmlFor="notes">Notes</label>
                    <textarea
                      id="notes"
                      rows="2"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Batch, supplier, typical use, etc."
                    />
                  </div>
                </div>

                <div className="inv-add-form-actions">
                  <button type="submit" className="primary-button">
                    Add to inventory
                  </button>
                  <button type="button" className="secondary-button" onClick={() => {
                    setAddFormOpen(false);
                    setNewName(""); setNewQuantity(""); setNewUnit(""); setNewCategory("Resin");
                    setNewNotes(""); setNewMinStock(""); setNewBatchNumber(""); setNewExpiryDate("");
                  }}>
                    Cancel
                  </button>
                </div>
              </form>
          </div>
        </section>
        )}

        {/* ── Receive Stock form (inline below toolbar) ────────── */}
        {receiveStockOpen && (
        <section className="inv-add-form-section receive-stock-section" ref={receiveFormRef}>
          <div className="add-form">
            <div className="receive-stock-header">
              <h3 className="receive-stock-title">Receive Stock</h3>
              <button type="button" className="receive-stock-done-btn" onClick={closeReceiveStock}>
                Done{receiveLog.length > 0 ? ` (${receiveLog.length})` : ""}
              </button>
            </div>

            <div className={`receive-stock-split${receiveSelectedItem ? " receive-stock-split-with-form" : ""}`}>
              {/* LEFT: material list (always visible) */}
              <div className="receive-stock-picker">
                <input
                  ref={receiveSearchRef}
                  type="text"
                  className="inv-search-input"
                  value={receiveSearch}
                  onChange={(e) => setReceiveSearch(e.target.value)}
                  placeholder="Search materials..."
                  autoFocus
                />
                <div className="receive-stock-results">
                  {receiveSearchResults.total === 0 ? (
                    <div className="receive-stock-empty">No materials matching "{receiveSearch}"</div>
                  ) : (
                    <>
                      <div className="receive-stock-result-count">{receiveSearchResults.total} material{receiveSearchResults.total !== 1 ? "s" : ""}</div>
                      {Object.keys(receiveSearchResults.groups).sort().map((cat) => (
                        <div key={cat} className="receive-stock-group">
                          <div className="receive-stock-group-header">{cat}</div>
                          {receiveSearchResults.groups[cat].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className={`receive-stock-item${receiveSelectedItemId === item.id ? " receive-stock-item-active" : ""}`}
                              onClick={() => {
                                setReceiveSelectedItemId(item.id);
                                setReceiveQty("");
                                setReceiveBatch("");
                                setReceiveExpiry("");
                                setTimeout(() => receiveQtyRef.current?.focus(), 50);
                              }}
                            >
                              <span className="receive-stock-item-name">{item.name}</span>
                              <span className="receive-stock-item-meta">
                                <span className={`receive-stock-item-qty${item.quantity === 0 ? " receive-stock-item-qty-zero" : ""}`}>
                                  {item.quantity} {item.unit}
                                </span>
                                {item.quantity === 0 ? " not loaded" : " in stock"}
                              </span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* RIGHT: receive form (visible when item selected) */}
              {receiveSelectedItem && (
                <div className="receive-stock-form-fields">
                  <div className="receive-stock-selected">
                    <div className="receive-stock-selected-info">
                      <span className="receive-stock-selected-name">{receiveSelectedItem.name}</span>
                      <span className="receive-stock-selected-qty">
                        Current: {receiveSelectedItem.quantity} {receiveSelectedItem.unit}
                        {receiveSelectedItem.batchNumber ? ` · ${receiveSelectedItem.batchNumber}` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Quick qty presets */}
                  <div className="receive-stock-qty-section">
                    <label className="receive-stock-field-label">Quantity Received</label>
                    <div className="receive-stock-qty-presets">
                      {[1, 2, 5, 10, 25, 50].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`receive-stock-preset${receiveQty === String(n) ? " receive-stock-preset-active" : ""}`}
                          onClick={() => setReceiveQty(String(n))}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <input
                      ref={receiveQtyRef}
                      id="receiveQty"
                      type="number"
                      min="1"
                      value={receiveQty}
                      onChange={(e) => setReceiveQty(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleReceiveStock();
                        }
                      }}
                      placeholder="Or enter custom amount..."
                      autoFocus
                    />
                    {receiveQty && Number(receiveQty) > 0 && (
                      <div className="receive-stock-new-total">
                        New total: {receiveSelectedItem.quantity + Number(receiveQty)} {receiveSelectedItem.unit}
                      </div>
                    )}
                  </div>

                  <div className="receive-stock-optional-fields">
                    <div className="field">
                      <label htmlFor="receiveBatch">Batch / Lot Number</label>
                      <input
                        id="receiveBatch"
                        type="text"
                        value={receiveBatch}
                        onChange={(e) => setReceiveBatch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleReceiveStock(); } }}
                        placeholder={receiveSelectedItem.batchNumber || "e.g. LOT-2026-001"}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="receiveExpiry">Expiry Date</label>
                      <input
                        id="receiveExpiry"
                        type="date"
                        value={receiveExpiry}
                        onChange={(e) => setReceiveExpiry(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="inv-add-form-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleReceiveStock}
                      disabled={!receiveQty || Number(receiveQty) <= 0}
                    >
                      Receive {receiveQty && Number(receiveQty) > 0 ? `${receiveQty} ${receiveSelectedItem.unit || "units"}` : ""}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Session receive log */}
            {receiveLog.length > 0 && (
              <div className="receive-stock-log">
                <div className="receive-stock-log-title">Received this session ({receiveLog.length})</div>
                {receiveLog.map((entry, i) => (
                  <div key={i} className="receive-stock-log-entry">
                    <span className="receive-stock-log-name">{entry.name}</span>
                    <span className="receive-stock-log-qty">+{entry.qty} {entry.unit}</span>
                    <span className="receive-stock-log-time">{entry.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        )}

        {/* ── Materials list + Detail panel ─────────────────────── */}
        <div className={`inv-content-area${selectedItem ? " inv-content-with-panel" : ""}`}>
          <section className="list-section">
            <div className="list-header">
              <h2 className="inv-context-heading">{
                quickFilter === "stocked" ? `In Van — ${quickFilteredItems.length} items` :
                quickFilter === "all" ? `All Materials — ${quickFilteredItems.length}` :
                quickFilter === "notloaded" ? `Not Loaded — ${quickFilteredItems.length} items` :
                quickFilter === "low" ? `Low Stock — ${quickFilteredItems.length} items` :
                quickFilter === "reorder" ? `Reorder — ${quickFilteredItems.length} items` :
                `Materials (${quickFilteredItems.length})`
              }</h2>
            </div>

            {!hasAnyItems ? (
              <div className="empty-state-hero">
                <h3 className="empty-state-title">No inventory items yet</h3>
                <p>Add your first material to get started tracking your wind turbine repair supplies.</p>
                <button type="button" className="primary-button" onClick={() => setAddFormOpen(true)}>
                  Add your first item
                </button>
              </div>
            ) : !hasResults ? (
              <div className="empty-state">
                {quickFilter === "notloaded" && searchTerm === "" && categoryFilter === "All" ? (
                  <p>All materials are currently loaded in the van.</p>
                ) : quickFilter === "low" && searchTerm === "" && categoryFilter === "All" ? (
                  <p>No items are below their minimum stock level. Set a Min Stock Alert on any item to track it here.</p>
                ) : quickFilter === "reorder" && searchTerm === "" && categoryFilter === "All" ? (
                  <p>No items are flagged for reorder. Items that fall below their minimum stock threshold will appear here.</p>
                ) : (
                  <>
                    <p>No items match your filters.</p>
                    {(searchTerm !== "" || categoryFilter !== "All") && (
                      <button type="button" className="secondary-button small" onClick={clearFilters}>
                        Clear all filters
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              renderCards()
            )}
          </section>

          {/* ── Detail Side Panel ────────────────────────────────── */}
          {selectedItem && (
            <aside className="inv-detail-panel" ref={detailPanelRef}>
              <div className="inv-detail-panel-header">
                <h3 className="inv-detail-panel-title">{selectedItem.name}</h3>
                <button
                  type="button"
                  className="inv-detail-panel-close"
                  onClick={closeDetailPanel}
                  title="Close panel"
                >
                  ×
                </button>
              </div>

              <div className="inv-detail-panel-body">
                {/* Status badge */}
                <div className="inv-detail-status-row">
                  <span className={getStockBadgeClass(selectedItem)}>{getStockLabel(selectedItem)}</span>
                  <span className="inv-detail-category">{selectedItem.category}</span>
                </div>

                {/* Quantity section */}
                <div className="inv-detail-section">
                  <label className="inv-detail-label">Quantity</label>
                  <div className="inv-detail-qty-value">{selectedItem.quantity} {selectedItem.unit}</div>
                  <div className="inv-detail-qty-controls">
                    <button type="button" onClick={() => safeAdjustQuantity(selectedItem.id, -5)} disabled={selectedItem.quantity === 0}>-5</button>
                    <button type="button" onClick={() => safeAdjustQuantity(selectedItem.id, -1)} disabled={selectedItem.quantity === 0}>−</button>
                    <button type="button" onClick={() => handleAdjustQuantity(selectedItem.id, 1)}>+</button>
                    <button type="button" onClick={() => handleAdjustQuantity(selectedItem.id, 5)}>+5</button>
                  </div>
                  {pendingQtyChange && pendingQtyChange.itemId === selectedItem.id && (
                    <div className="qty-zero-warning">
                      <span>Quantity will reach 0</span>
                      <button type="button" className="secondary-button small" onClick={confirmPendingQty}>Confirm</button>
                      <button type="button" className="secondary-button small" onClick={cancelPendingQty}>Cancel</button>
                    </div>
                  )}
                  <div className="inv-detail-custom-qty">
                    <input
                      type="number"
                      min="0"
                      className="custom-qty-input"
                      placeholder="Qty"
                      value={customQty[selectedItem.id] || ""}
                      onChange={(e) => setCustomQty((prev) => ({ ...prev, [selectedItem.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = Number(customQty[selectedItem.id]);
                          if (!Number.isNaN(val) && val >= 0) {
                            handleAdjustQuantity(selectedItem.id, val);
                            setCustomQty((prev) => ({ ...prev, [selectedItem.id]: "" }));
                          }
                        }
                      }}
                    />
                    <button type="button" className="secondary-button small" onClick={() => { const val = Number(customQty[selectedItem.id]); if (!Number.isNaN(val) && val >= 0) { handleAdjustQuantity(selectedItem.id, val); setCustomQty((prev) => ({ ...prev, [selectedItem.id]: "" })); } }}>Add</button>
                    <button type="button" className="secondary-button small" onClick={() => { const val = Number(customQty[selectedItem.id]); if (!Number.isNaN(val) && val >= 0) { safeAdjustQuantity(selectedItem.id, -val); setCustomQty((prev) => ({ ...prev, [selectedItem.id]: "" })); } }}>Sub</button>
                    <button type="button" className="secondary-button small" onClick={() => { const val = Number(customQty[selectedItem.id]); if (!Number.isNaN(val) && val >= 0) { handleSetQuantity(selectedItem.id, val); setCustomQty((prev) => ({ ...prev, [selectedItem.id]: "" })); } }}>Set</button>
                  </div>
                </div>

                {/* Info section (read-only) or edit form */}
                {editingItemId === selectedItem.id ? (
                  <div className="inv-detail-section inv-detail-edit-section">
                    <div className="inv-detail-edit-grid">
                      <div className="field">
                        <label>Name</label>
                        <input className="card-edit-input" value={editFields.name} onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))} onKeyDown={handleEditKeyDown} autoFocus />
                      </div>
                      <div className="field">
                        <label>Category</label>
                        <select className="card-edit-select" value={editFields.category} onChange={(e) => setEditFields((f) => ({ ...f, category: e.target.value }))}>
                          {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label>Unit</label>
                        <input className="card-edit-input" value={editFields.unit} onChange={(e) => setEditFields((f) => ({ ...f, unit: e.target.value }))} onKeyDown={handleEditKeyDown} placeholder="kits, m², pcs..." />
                      </div>
                      <div className="field">
                        <label>Min Stock Alert</label>
                        <input className="card-edit-input" type="number" min="0" value={editFields.minStock} onChange={(e) => setEditFields((f) => ({ ...f, minStock: e.target.value }))} onKeyDown={handleEditKeyDown} />
                      </div>
                      <div className="field">
                        <label>Batch Number</label>
                        <input className="card-edit-input" value={editFields.batchNumber} onChange={(e) => setEditFields((f) => ({ ...f, batchNumber: e.target.value }))} onKeyDown={handleEditKeyDown} placeholder="e.g. LOT-2026-001" />
                      </div>
                      <div className="field">
                        <label>Expiry Date</label>
                        <input className="card-edit-input" type="date" value={editFields.expiryDate} onChange={(e) => setEditFields((f) => ({ ...f, expiryDate: e.target.value }))} onKeyDown={handleEditKeyDown} />
                      </div>
                      <div className="field field-checkbox">
                        <label><input type="checkbox" checked={editFields.stockAlert || false} onChange={(e) => setEditFields((f) => ({ ...f, stockAlert: e.target.checked }))} /> Stock Alert</label>
                      </div>
                      <div className="field field-notes">
                        <label>Notes</label>
                        <textarea className="card-edit-input" rows="3" value={editFields.notes} onChange={(e) => setEditFields((f) => ({ ...f, notes: e.target.value }))} onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }} placeholder="Batch, supplier, typical use..." />
                      </div>
                    </div>
                    <div className="inv-detail-edit-actions">
                      <button type="button" className="primary-button" onClick={commitEdit}>Save</button>
                      <button type="button" className="secondary-button" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="inv-detail-section inv-detail-info">
                    {selectedItem.notes && <div className="inv-detail-info-row"><span className="inv-detail-label">Notes</span><span>{selectedItem.notes}</span></div>}
                    {selectedItem.minStock > 0 && <div className="inv-detail-info-row"><span className="inv-detail-label">Min Stock</span><span>{selectedItem.minStock} {selectedItem.unit}</span></div>}
                    {selectedItem.batchNumber && <div className="inv-detail-info-row"><span className="inv-detail-label">Batch</span><span>{selectedItem.batchNumber}</span></div>}
                    {selectedItem.expiryDate && (
                      <div className="inv-detail-info-row">
                        <span className="inv-detail-label">Expiry</span>
                        <span className={getExpiryStatus(selectedItem.expiryDate) === "expired" ? "card-expiry-expired" : getExpiryStatus(selectedItem.expiryDate) === "warning" ? "card-expiry-warning" : ""}>
                          {selectedItem.expiryDate}{getExpiryStatus(selectedItem.expiryDate) === "expired" ? " — EXPIRED" : getExpiryStatus(selectedItem.expiryDate) === "warning" ? " — Expiring soon" : ""}
                        </span>
                      </div>
                    )}
                    {(consumptionRates[selectedItem.id] || 0) > 0 && (
                      <div className="inv-detail-info-row">
                        <span className="inv-detail-label">Burn Rate</span>
                        <span>~{consumptionRates[selectedItem.id]}/{selectedItem.unit || "unit"} per week
                          {selectedItem.quantity > 0 && consumptionRates[selectedItem.id] > 0 ? ` · ~${Math.round(selectedItem.quantity / consumptionRates[selectedItem.id])} weeks remaining` : ""}
                        </span>
                      </div>
                    )}
                    {activeProjectName && (consumedByProject[selectedItem.id] || 0) > 0 && (
                      <div className="inv-detail-info-row">
                        <span className="inv-detail-label">Consumed ({activeProjectName})</span>
                        <span>{consumedByProject[selectedItem.id]} {selectedItem.unit}</span>
                      </div>
                    )}
                    {(consumedTotal[selectedItem.id] || 0) > 0 && (
                      <div className="inv-detail-info-row">
                        <span className="inv-detail-label">Total Consumed</span>
                        <span>{consumedTotal[selectedItem.id]} {selectedItem.unit}</span>
                      </div>
                    )}

                    {/* Consumption breakdown */}
                    {(consumptionBreakdown[selectedItem.id] || []).length > 0 && (
                      <div className="inv-detail-consumption">
                        <span
                          className="inv-detail-label inv-detail-label-clickable"
                          onClick={() => setExpandedConsumption((prev) => ({ ...prev, [selectedItem.id]: !prev[selectedItem.id] }))}
                        >
                          Usage History {expandedConsumption[selectedItem.id] ? "▲" : "▼"}
                        </span>
                        {expandedConsumption[selectedItem.id] && (
                          <div className="card-consumption-breakdown">
                            {(consumptionBreakdown[selectedItem.id] || []).slice(0, 15).map((entry, i) => (
                              <div key={i} className="consumption-entry">
                                <span>{entry.date}</span>
                                <span>{entry.turbine}{entry.blade ? ` / ${entry.blade}` : ""}</span>
                                <span>-{entry.amount}</span>
                              </div>
                            ))}
                            {(consumptionBreakdown[selectedItem.id] || []).length > 15 && <p className="consumption-more">+{consumptionBreakdown[selectedItem.id].length - 15} more</p>}
                          </div>
                        )}
                      </div>
                    )}

                    <button type="button" className="secondary-button inv-detail-edit-btn" onClick={() => startEdit(selectedItem)}>
                      &#9998; Edit Details
                    </button>

                    {/* Restock button */}
                    {selectedItem.minStock > 0 && selectedItem.quantity < selectedItem.minStock && (
                      <button type="button" className="secondary-button small restock-btn" onClick={() => handleRestock(selectedItem)}>
                        Restock to {selectedItem.minStock}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </main>

      {/* Import preview dialog */}
      {importPreview && (
        <div className="import-preview-overlay" onClick={() => setImportPreview(null)}>
          <div className="import-preview-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Import Preview</h3>
            <p>{importPreview.newCount} new items, {importPreview.updateCount} updates</p>
            <div className="import-preview-list">
              {importPreview.rows.slice(0, 20).map((row, i) => (
                <div key={i} className="import-preview-row">
                  <span className={row.isUpdate ? "import-update-badge" : "import-new-badge"}>
                    {row.isUpdate ? "Update" : "New"}
                  </span>
                  <span>{row.name}</span>
                  <span>{row.quantity} {row.unit}</span>
                </div>
              ))}
              {importPreview.rows.length > 20 && (
                <p className="consumption-more">+{importPreview.rows.length - 20} more rows</p>
              )}
            </div>
            <div className="import-preview-actions">
              <button type="button" className="primary-button" onClick={applyImport}>Confirm Import</button>
              <button type="button" className="secondary-button" onClick={() => setImportPreview(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`undo-toast ${toast.type === "success" ? "undo-toast-success" : ""}`}>
          <span>{toast.message}</span>
          {toast.type === "delete" && toast.item && (
            <button type="button" className="undo-toast-btn" onClick={handleUndo}>
              Undo
            </button>
          )}
        </div>
      )}
    </>
  );
}

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export default InventoryPage;
