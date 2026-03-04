import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatDamageLabel } from "../utils/formatDamageLabel";

const OPERATION_TYPES = [
  "Grinding",
  "Sanding Coarse",
  "Sanding Fine",
  "Lamination",
  "Curing",
  "Filler Application",
  "Primer",
  "Topcoat",
  "Inspection",
  "Vacuum Infusion",
  "Custom",
];

// Job log page for recording jobs and materials used.
function JobLogPage({ items, project, jobHistory, onSubmitJob, onEditJob }) {
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [selectedTurbineId, setSelectedTurbineId] = useState(null);
  const [selectedBladeId, setSelectedBladeId] = useState(null);
  const [selectedDamageId, setSelectedDamageId] = useState(null);
  const [notes, setNotes] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [editingJobId, setEditingJobId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [operationRows, setOperationRows] = useState([]);
  const [operationDraftMaterials, setOperationDraftMaterials] = useState({});
  const [showDashboard, setShowDashboard] = useState(false);

  const handleAddMaterialRow = () => {
    setMaterialsUsed((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), itemId: items[0]?.id || null, amount: "" },
    ]);
  };

  const handleUpdateRow = (rowId, field, value) => {
    setMaterialsUsed((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  };

  const handleRemoveRow = (rowId) => {
    setMaterialsUsed((prev) => prev.filter((row) => row.id !== rowId));
  };

  // Add a new operation in edit mode
  const handleAddOperation = () => {
    setOperationRows((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        type: "Grinding",
        customType: "",
        duration: "",
        notes: "",
        savedNotes: "",
        materials: [],
        isEditing: true,
      },
    ]);
  };

  // Update fields on a specific operation row
  const handleUpdateOperation = (operationId, fields) => {
    setOperationRows((prev) =>
      prev.map((op) => (op.id === operationId ? { ...op, ...fields } : op))
    );
  };

  // Remove an entire operation
  const handleRemoveOperation = (operationId) => {
    setOperationRows((prev) => prev.filter((op) => op.id !== operationId));
    setOperationDraftMaterials((prev) => {
      const next = { ...prev };
      delete next[operationId];
      return next;
    });
  };

  // Start adding a material row for an operation
  const handleStartAddOperationMaterial = (operationId) => {
    setOperationDraftMaterials((prev) => ({
      ...prev,
      [operationId]: {
        itemId: items[0]?.id || "",
        amount: "",
      },
    }));
  };

  // Update the draft material row for an operation
  const handleUpdateDraftOperationMaterial = (operationId, fields) => {
    setOperationDraftMaterials((prev) => ({
      ...prev,
      [operationId]: {
        ...(prev[operationId] || { itemId: items[0]?.id || "", amount: "" }),
        ...fields,
      },
    }));
  };

  // Save the draft material into the operation's materials list
  const handleSaveOperationMaterial = (operationId) => {
    const draft = operationDraftMaterials[operationId];
    if (!draft) return;
    const amountNum = Number(draft.amount);
    if (!draft.itemId || Number.isNaN(amountNum) || amountNum <= 0) {
      return;
    }
    setOperationRows((prev) =>
      prev.map((op) =>
        op.id === operationId
          ? {
              ...op,
              materials: [
                ...op.materials,
                {
                  id: Date.now() + Math.random(),
                  itemId: Number(draft.itemId),
                  amount: amountNum,
                },
              ],
            }
          : op
      )
    );
    setOperationDraftMaterials((prev) => {
      const next = { ...prev };
      delete next[operationId];
      return next;
    });
  };

  // Remove a saved material from an operation
  const handleRemoveOperationMaterial = (operationId, materialId) => {
    setOperationRows((prev) =>
      prev.map((op) =>
        op.id === operationId
          ? {
              ...op,
              materials: op.materials.filter((m) => m.id !== materialId),
            }
          : op
      )
    );
  };

  // Save current notes into savedNotes for an operation
  const handleSaveOperationNotes = (operationId) => {
    setOperationRows((prev) =>
      prev.map((op) =>
        op.id === operationId ? { ...op, savedNotes: op.notes } : op
      )
    );
  };

  // Toggle between edit and saved mode for an operation
  const handleToggleOperationEditing = (operationId, isEditing) => {
    setOperationRows((prev) =>
      prev.map((op) => (op.id === operationId ? { ...op, isEditing } : op))
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!selectedTurbineId || !selectedBladeId) {
      return;
    }

    const turbine =
      project.turbines.find((t) => t.id === selectedTurbineId) || null;
    const blade =
      turbine?.blades.find((b) => b.id === selectedBladeId) || null;
    const damage =
      blade?.damages.find((d) => d.id === selectedDamageId) || null;

    const parsedMaterials = materialsUsed
      .map((row) => {
        const amountNum = Number(row.amount);
        if (!row.itemId || Number.isNaN(amountNum) || amountNum <= 0) {
          return null;
        }
        return { itemId: Number(row.itemId), amount: amountNum };
      })
      .filter(Boolean);

    const operationsPayload = operationRows.map((op) => {
      const resolvedType =
        op.type === "Custom"
          ? (op.customType || "Custom").trim() || "Custom"
          : op.type;
      return {
        id: op.id,
        type: resolvedType,
        duration: op.duration,
        notes: op.savedNotes || op.notes,
        materials: op.materials.map((m) => ({
          itemId: m.itemId,
          amount: m.amount,
        })),
      };
    });

    const job = {
      id: Date.now() + Math.random(),
      date,
      turbine: turbine ? turbine.name : "",
      bladeRef: blade ? blade.name : "",
      damage:
        damage && {
          number: damage.number,
          type: damage.type,
          radius: damage.radius || "",
          locations: damage.locations || [],
          notes: damage.notes || "",
        },
      notes: notes.trim(),
      operations: operationsPayload,
      materials: parsedMaterials,
    };

    onSubmitJob(job);

    setDate(today);
    setSelectedTurbineId(null);
    setSelectedBladeId(null);
    setSelectedDamageId(null);
    setNotes("");
    setMaterialsUsed([]);
    setOperationRows([]);
    setOperationDraftMaterials({});
    setSuccessMessage("✅ Job submitted! Materials have been deducted from inventory.");
  };

  const getItemNameById = (itemId) =>
    items.find((i) => i.id === itemId)?.name || "Unknown item";

  useEffect(() => {
    if (!successMessage) return;
    const timeoutId = setTimeout(() => {
      setSuccessMessage("");
    }, 4000);
    return () => clearTimeout(timeoutId);
  }, [successMessage]);

  const renderEditCard = (job) => (
    <article key={job.id} className="job-card">
      <header className="job-card-header">
        <div>
          <h3>Editing Job</h3>
          <span className="job-date">Original: {job.date}</span>
        </div>
      </header>
      <div className="job-card-body">
        <div className="field">
          <label>Date</label>
          <input
            type="date"
            value={editForm?.date || ""}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, date: e.target.value }))
            }
          />
        </div>
        <div className="field field-notes">
          <label>Notes</label>
          <textarea
            rows="2"
            value={editForm?.notes || ""}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, notes: e.target.value }))
            }
          />
        </div>
        <div className="materials-used">
          <div className="materials-used-header">
            <h3>General Materials</h3>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setEditForm((prev) => ({
                  ...prev,
                  materials: [
                    ...(prev.materials || []),
                    { id: Date.now() + Math.random(), itemId: items[0]?.id || "", amount: 0 },
                  ],
                }))
              }
              disabled={items.length === 0}
            >
              Add Material
            </button>
          </div>
          {(editForm?.materials || []).length === 0 ? (
            <p className="empty-state small">No materials added.</p>
          ) : (
            <div className="materials-table">
              {(editForm?.materials || []).map((m, idx) => (
                <div key={m.id || idx} className="materials-row">
                  <select
                    value={m.itemId || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditForm((prev) => {
                        const nextMats = [...(prev.materials || [])];
                        nextMats[idx] = { ...nextMats[idx], itemId: value };
                        return { ...prev, materials: nextMats };
                      });
                    }}
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={m.amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditForm((prev) => {
                        const nextMats = [...(prev.materials || [])];
                        nextMats[idx] = { ...nextMats[idx], amount: Number(value) };
                        return { ...prev, materials: nextMats };
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="delete-button small"
                    onClick={() =>
                      setEditForm((prev) => ({
                        ...prev,
                        materials: (prev.materials || []).filter((_m, i) => i !== idx),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {(editForm?.operations || []).length > 0 && (
          <div className="materials-used">
            <h3>Operations</h3>
            {(editForm?.operations || []).map((op, opIdx) => (
              <div key={op.id || opIdx} className="operation-card">
                <div className="operation-header-row">
                  <strong>{op.type}</strong>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Duration (hrs)</label>
                    <input
                      type="number"
                      value={op.duration || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditForm((prev) => {
                          const nextOps = [...(prev.operations || [])];
                          nextOps[opIdx] = { ...nextOps[opIdx], duration: value };
                          return { ...prev, operations: nextOps };
                        });
                      }}
                    />
                  </div>
                  <div className="field">
                    <label>Notes</label>
                    <input
                      type="text"
                      value={op.notes || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditForm((prev) => {
                          const nextOps = [...(prev.operations || [])];
                          nextOps[opIdx] = { ...nextOps[opIdx], notes: value };
                          return { ...prev, operations: nextOps };
                        });
                      }}
                    />
                  </div>
                </div>
                <div className="operation-materials">
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
                    Materials
                  </div>
                  <div>
                    {(op.materials || []).map((m, mIdx) => (
                      <span key={m.id || mIdx} className="material-chip">
                        {getItemNameById(m.itemId) || "Item"} × {m.amount}
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm((prev) => {
                              const nextOps = [...(prev.operations || [])];
                              const matList = [...(nextOps[opIdx].materials || [])].filter(
                                (_mm, ii) => ii !== mIdx
                              );
                              nextOps[opIdx] = { ...nextOps[opIdx], materials: matList };
                              return { ...prev, operations: nextOps };
                            })
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="damage-bottom-row">
          <button
            type="button"
            className="primary-button damage-finish-button"
            onClick={() => {
              if (editForm) onEditJob(job, editForm);
              setEditingJobId(null);
              setEditForm(null);
              setSuccessMessage("✅ Job updated successfully.");
            }}
          >
            Save Changes
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setEditingJobId(null);
              setEditForm(null);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </article>
  );

  const hasProject =
    project && project.name && project.turbines && project.turbines.length > 0;

  const dashboardData = {};
  jobHistory.forEach((job) => {
    if (!job.damage) return;
    const tKey = job.turbine || "Unknown";
    const bKey = job.bladeRef || "Unknown";
    const dKey = `${job.damage.number}::${job.damage.type}::${job.damage.radius || ""}::${(job.damage.locations || []).join(",")}`;
    if (!dashboardData[tKey]) dashboardData[tKey] = {};
    if (!dashboardData[tKey][bKey]) dashboardData[tKey][bKey] = {};
    if (!dashboardData[tKey][bKey][dKey])
      dashboardData[tKey][bKey][dKey] = {
        damage: job.damage,
        jobs: [],
        totalHours: 0,
        materials: {},
        operations: new Set(),
        lastDate: "",
      };
    const entry = dashboardData[tKey][bKey][dKey];
    entry.jobs.push(job);
    if (!entry.lastDate || job.date > entry.lastDate) entry.lastDate = job.date;
    (job.operations || []).forEach((op) => {
      const h = parseFloat(op.duration || 0);
      if (!isNaN(h)) entry.totalHours += h;
      entry.operations.add(op.type || op.customType || "Unknown");
      (op.materials || []).forEach((m) => {
        const item = items.find((i) => i.id === Number(m.itemId));
        const name = item?.name || "Unknown item";
        const unit = item?.unit || "";
        if (!entry.materials[name])
          entry.materials[name] = { total: 0, unit };
        entry.materials[name].total += Number(m.amount);
      });
    });
    (job.materials || []).forEach((m) => {
      const item = items.find((i) => i.id === Number(m.itemId));
      const name = item?.name || "Unknown item";
      const unit = item?.unit || "";
      if (!entry.materials[name]) entry.materials[name] = { total: 0, unit };
      entry.materials[name].total += Number(m.amount);
    });
  });

  if (!hasProject) {
    return (
      <div className="job-page">
        <header className="app-header">
          <h1>Job Log</h1>
          <p>Track jobs and automatically deduct used materials.</p>
        </header>
        <main className="job-main single-column">
          <section className="job-form-section">
            <div className="job-form info-only">
              <h2>Start a Job</h2>
              <p className="empty-state">
                Please set up a project first. Go to{" "}
                <Link to="/setup" className="inline-link">
                  Project Setup
                </Link>{" "}
                to define turbines, blades, and damages.
              </p>
            </div>
          </section>
          <section className="job-history-section">
            <h2>Job History</h2>
            {jobHistory.length === 0 ? (
              <p className="empty-state">
                No jobs logged yet. Completed jobs will appear here.
              </p>
            ) : (
              <div className="job-history-list">
                {jobHistory.map((job) => {
                  const isEditing = editingJobId === job.id;

                  if (!isEditing) {
                    return (
                      <article key={job.id} className="job-card">
                        <header className="job-card-header">
                          <div>
                            <h3>
                              {job.turbine} – {job.bladeRef}
                              {job.damage ? ` – ${formatDamageLabel(job.damage)}` : ""}
                            </h3>
                            <span className="job-date">{job.date}</span>
                          </div>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              setEditingJobId(job.id);
                              setEditForm({
                                ...job,
                                materials: [...(job.materials || [])],
                                operations: (job.operations || []).map((op) => ({
                                  ...op,
                                  materials: [...(op.materials || [])],
                                })),
                              });
                            }}
                          >
                            Edit Job
                          </button>
                        </header>
                        <div className="job-card-body">
                          {job.notes && (
                            <p className="job-notes">
                              <strong>Notes:</strong> {job.notes}
                            </p>
                          )}
                          {job.damage && (
                            <p className="job-notes">
                              <strong>Damage:</strong>{" "}
                              {formatDamageLabel(job.damage)}
                            </p>
                          )}
                          {job.materials.length > 0 ? (
                            <div className="job-materials">
                              <strong>Materials used:</strong>
                              <ul>
                                {job.materials.map((mat, index) => (
                                  <li key={index}>
                                    {getItemNameById(mat.itemId)} – {mat.amount}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p className="job-materials none">
                              No materials were recorded for this job.
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  }

                  return renderEditCard(job);
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="job-page">
      <header className="app-header">
        <h1>Job Log</h1>
        <p>Track jobs and automatically deduct used materials.</p>
      </header>

      <main className="job-main">
        <section className="job-form-section">
          <form className="job-form" onSubmit={handleSubmit}>
            <h2>Start a Job</h2>

            <div className="form-grid job-form-grid">
              <div className="field">
                <label htmlFor="job-date">Date</label>
                <input
                  id="job-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="selection-steps">
              <div className="selection-step">
                <p className="step-label">Step 1: Select turbine</p>
                <div className="pill-row">
                  {project.turbines.map((turbine) => (
                    <button
                      key={turbine.id}
                      type="button"
                      className={
                        selectedTurbineId === turbine.id
                          ? "pill-button pill-button-active"
                          : "pill-button"
                      }
                      onClick={() => {
                        setSelectedTurbineId(turbine.id);
                        setSelectedBladeId(null);
                        setSelectedDamageId(null);
                      }}
                    >
                      {turbine.name}
                    </button>
                  ))}
                </div>
              </div>

              {selectedTurbineId && (
                <div className="selection-step">
                  <p className="step-label">Step 2: Select blade</p>
                  <div className="pill-row">
                    {project.turbines
                      .find((t) => t.id === selectedTurbineId)
                      ?.blades.map((blade) => (
                        <button
                          key={blade.id}
                          type="button"
                          className={
                            selectedBladeId === blade.id
                              ? "pill-button pill-button-active"
                              : "pill-button"
                          }
                          onClick={() => {
                            setSelectedBladeId(blade.id);
                            setSelectedDamageId(null);
                          }}
                        >
                          {blade.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {selectedBladeId && (
                <div className="selection-step">
                  <p className="step-label">Step 3: Select damage</p>
                  <div className="pill-row">
                {project.turbines
                  .find((t) => t.id === selectedTurbineId)
                  ?.blades.find((b) => b.id === selectedBladeId)
                  ?.damages.map((damage) => (
                    <button
                      key={damage.id}
                      type="button"
                      className={
                        selectedDamageId === damage.id
                          ? "pill-button pill-button-active"
                          : "pill-button"
                      }
                      onClick={() => setSelectedDamageId(damage.id)}
                    >
                      {formatDamageLabel(damage)}
                    </button>
                  ))}
                  </div>
                </div>
              )}
            </div>

            {selectedDamageId && (
              <div className="materials-used">
                <div className="materials-used-header">
                  <h3>Operations</h3>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleAddOperation}
                    disabled={items.length === 0}
                  >
                    Add Operation
                  </button>
                </div>

                {operationRows.length === 0 ? (
                  <p className="empty-state small">
                    No operations added yet. Click &quot;Add Operation&quot; to
                    record work steps.
                  </p>
                ) : (
                  <div>
                    {operationRows.map((op) => {
                      const isEditing = op.isEditing;
                      const resolvedType =
                        op.type === "Custom"
                          ? (op.customType || "Custom").trim() || "Custom"
                          : op.type;

                      if (!isEditing) {
                        const durationLabel = op.duration
                          ? `${op.duration} hrs`
                          : "";
                        const previewSource = op.savedNotes || op.notes || "";
                        const notesPreview =
                          previewSource.length > 60
                            ? `${previewSource.slice(0, 60)}…`
                            : previewSource;

                        return (
                          <div key={op.id} className="operation-card">
                            <div className="operation-saved-row">
                              <strong>{resolvedType}</strong>
                              {durationLabel && (
                                <span className="op-badge">
                                  {durationLabel}
                                </span>
                              )}
                              {op.materials.map((m) => (
                                <span
                                  key={m.id}
                                  className="material-chip"
                                >
                                  {getItemNameById(m.itemId)} × {m.amount}
                                </span>
                              ))}
                              {notesPreview && (
                                <span className="job-notes">
                                  {notesPreview}
                                </span>
                              )}
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  handleToggleOperationEditing(op.id, true)
                                }
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const draft = operationDraftMaterials[op.id];

                      return (
                        <div key={op.id} className="operation-card">
                          <div className="operation-header-row">
                            <select
                              value={op.type}
                              onChange={(e) =>
                                handleUpdateOperation(op.id, {
                                  type: e.target.value,
                                })
                              }
                            >
                              {OPERATION_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                            {op.type === "Custom" && (
                              <input
                                type="text"
                                value={op.customType || ""}
                                onChange={(e) =>
                                  handleUpdateOperation(op.id, {
                                    customType: e.target.value,
                                  })
                                }
                                placeholder="Custom operation name"
                              />
                            )}
                            <input
                              type="number"
                              value={op.duration}
                              onChange={(e) =>
                                handleUpdateOperation(op.id, {
                                  duration: e.target.value,
                                })
                              }
                              placeholder="Hours e.g. 1.5"
                            />
                          </div>

                          <div className="operation-notes-row">
                            <textarea
                              rows="2"
                              value={op.notes}
                              onChange={(e) =>
                                handleUpdateOperation(op.id, {
                                  notes: e.target.value,
                                })
                              }
                              placeholder="Operation notes..."
                            />
                            <button
                              type="button"
                              className="save-notes-btn"
                              onClick={() => handleSaveOperationNotes(op.id)}
                            >
                              Save Notes
                            </button>
                          </div>

                          <div className="operation-materials">
                            {op.materials.length > 0 && (
                              <div className="pill-row">
                                {op.materials.map((m) => (
                                  <span
                                    key={m.id}
                                    className="material-chip"
                                  >
                                    {getItemNameById(m.itemId)} × {m.amount}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveOperationMaterial(
                                          op.id,
                                          m.id
                                        )
                                      }
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}

                            {draft ? (
                              <div className="add-material-row">
                                <select
                                  value={draft.itemId || ""}
                                  onChange={(e) =>
                                    handleUpdateDraftOperationMaterial(op.id, {
                                      itemId: e.target.value,
                                    })
                                  }
                                >
                                  {items.map((item) => (
                                    <option
                                      key={item.id}
                                      value={item.id}
                                    >
                                      {item.name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="0"
                                  value={draft.amount}
                                  onChange={(e) =>
                                    handleUpdateDraftOperationMaterial(op.id, {
                                      amount: e.target.value,
                                    })
                                  }
                                  placeholder="Amount"
                                />
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() =>
                                    handleSaveOperationMaterial(op.id)
                                  }
                                >
                                  Save Material
                                </button>
                                <button
                                  type="button"
                                  className="delete-button small"
                                  onClick={() =>
                                    setOperationDraftMaterials((prev) => {
                                      const next = { ...prev };
                                      delete next[op.id];
                                      return next;
                                    })
                                  }
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  handleStartAddOperationMaterial(op.id)
                                }
                                disabled={items.length === 0}
                              >
                                Add Material
                              </button>
                            )}
                          </div>

                          <div className="damage-bottom-row">
                            <button
                              type="button"
                              className="primary-button damage-finish-button"
                              onClick={() =>
                                handleToggleOperationEditing(op.id, false)
                              }
                            >
                              Save Operation
                            </button>
                            <button
                              type="button"
                              className="delete-button small"
                              onClick={() => handleRemoveOperation(op.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="field field-notes">
              <label htmlFor="job-notes">Notes (optional)</label>
              <textarea
                id="job-notes"
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Weather, access notes, damage summary..."
              />
            </div>

            <div className="materials-used">
              <div className="materials-used-header">
                <h3>General Materials (not operation-specific)</h3>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleAddMaterialRow}
                  disabled={items.length === 0}
                >
                  Add Material
                </button>
              </div>

              {materialsUsed.length === 0 ? (
                <p className="empty-state small">
                  No materials added yet. Click &quot;Add Material&quot; to
                  record usage.
                </p>
              ) : (
                <div className="materials-table">
                  {materialsUsed.map((row) => (
                    <div key={row.id} className="materials-row">
                      <select
                        value={row.itemId || ""}
                        onChange={(e) =>
                          handleUpdateRow(row.id, "itemId", e.target.value)
                        }
                      >
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={row.amount}
                        onChange={(e) =>
                          handleUpdateRow(row.id, "amount", e.target.value)
                        }
                        placeholder="Amount"
                      />
                      <button
                        type="button"
                        className="delete-button small"
                        onClick={() => handleRemoveRow(row.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {successMessage && (
              <div className="success-banner">{successMessage}</div>
            )}

            <button type="submit" className="primary-button">
              Submit Job
            </button>
          </form>
        </section>

        <section className="job-history-section">
          <h2>Job History</h2>
          {jobHistory.length === 0 ? (
            <p className="empty-state">
              No jobs logged yet. Completed jobs will appear here.
            </p>
          ) : (
            <div className="job-history-list">
              {jobHistory.map((job) => {
                const isEditing = editingJobId === job.id;

                if (!isEditing) {
                  return (
                    <article key={job.id} className="job-card">
                      <header className="job-card-header">
                        <div>
                          <h3>
                            {job.turbine} – {job.bladeRef}
                            {job.damage
                              ? ` – ${formatDamageLabel(job.damage)}`
                              : ""}
                          </h3>
                          <span className="job-date">{job.date}</span>
                        </div>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setEditingJobId(job.id);
                            setEditForm({
                              ...job,
                              materials: [...(job.materials || [])],
                              operations: (job.operations || []).map((op) => ({
                                ...op,
                                materials: [...(op.materials || [])],
                              })),
                            });
                          }}
                        >
                          Edit Job
                        </button>
                      </header>

                      <div className="job-card-body">
                        {job.notes && (
                          <p className="job-notes">
                            <strong>Notes:</strong> {job.notes}
                          </p>
                        )}

                        {job.damage && (
                          <p className="job-notes">
                            <strong>Damage:</strong>{" "}
                            {formatDamageLabel(job.damage)}
                          </p>
                        )}

                        {job.materials.length > 0 ? (
                          <div className="job-materials">
                            <strong>Materials used:</strong>
                            <ul>
                              {job.materials.map((mat, index) => (
                                <li key={index}>
                                  {getItemNameById(mat.itemId)} – {mat.amount}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="job-materials none">
                            No materials were recorded for this job.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                }

                // Editing mode
                return renderEditCard(job);
              })}
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <div className="list-header">
            <h2>Damage Dashboard</h2>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowDashboard((prev) => !prev)}
            >
              {showDashboard ? "Hide Dashboard" : "Show Dashboard"}
            </button>
          </div>
          {showDashboard && (
            <div>
              {Object.keys(dashboardData).length === 0 ? (
                <p className="empty-state">
                  No damage data yet. Submit jobs to see dashboard.
                </p>
              ) : (
                Object.entries(dashboardData).map(
                  ([turbineName, blades]) => (
                    <div
                      key={turbineName}
                      className="dashboard-turbine-section"
                    >
                      <h3 className="dashboard-turbine-header">
                        🌀 {turbineName}
                      </h3>
                      {Object.entries(blades).map(
                        ([bladeName, damages]) => (
                          <div key={bladeName}>
                            <h4 className="dashboard-blade-header">
                              Blade: {bladeName}
                            </h4>
                            <div className="dashboard-blade-grid">
                              {Object.entries(damages).map(
                                ([dKey, entry]) => {
                                  const {
                                    damage,
                                    jobs,
                                    totalHours,
                                    materials,
                                    operations,
                                    lastDate,
                                  } = entry;
                                  const opArray = Array.from(operations);
                                  const opCount = opArray.length;
                                  const isComplete =
                                    totalHours > 0 && opCount > 0;
                                  const isInProgress =
                                    jobs.length > 0 && !isComplete;
                                  const statusClass = isComplete
                                    ? "status-badge-complete"
                                    : isInProgress
                                    ? "status-badge-inprogress"
                                    : "status-badge-notstarted";
                                  const statusText = isComplete
                                    ? "✓ Complete"
                                    : isInProgress
                                    ? "⚡ In Progress"
                                    : "○ Not Started";
                                  const subtitle = [
                                    damage.radius
                                      ? `${damage.radius}mm`
                                      : "",
                                    (damage.locations || []).join(", "),
                                  ]
                                    .filter(Boolean)
                                    .join(" · ");
                                  return (
                                    <div
                                      key={dKey}
                                      className="dashboard-damage-card"
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "flex-start",
                                          marginBottom: "0.75rem",
                                        }}
                                      >
                                        <div>
                                          <div className="damage-card-title">
                                            {damage.number} — {damage.type}
                                          </div>
                                          {subtitle && (
                                            <div className="damage-card-subtitle">
                                              {subtitle}
                                            </div>
                                          )}
                                        </div>
                                        <span className={statusClass}>
                                          {statusText}
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "baseline",
                                          gap: "0.35rem",
                                          marginBottom: "0.75rem",
                                        }}
                                      >
                                        <span className="hours-display">
                                          {totalHours.toFixed(1)}
                                        </span>
                                        <span
                                          style={{
                                            color: "#94a3b8",
                                            fontSize: "0.9rem",
                                          }}
                                        >
                                          hrs total
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: "0.75rem",
                                          marginBottom: "0.75rem",
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: "0.8rem",
                                            color: "#64748b",
                                          }}
                                        >
                                          📅 {lastDate}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: "0.8rem",
                                            color: "#64748b",
                                          }}
                                        >
                                          🔧 {jobs.length} job
                                          {jobs.length !== 1 ? "s" : ""}
                                        </span>
                                      </div>
                                      {opCount > 0 && (
                                        <div
                                          style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: "0.25rem",
                                            marginBottom: "0.75rem",
                                          }}
                                        >
                                          {opArray.map((op) => (
                                            <span key={op} className="op-badge">
                                              ✓ {op}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {Object.keys(materials).length > 0 && (
                                        <div>
                                          <div
                                            style={{
                                              fontSize: "0.8rem",
                                              fontWeight: 600,
                                              color: "#cbd5e1",
                                              marginBottom: "0.4rem",
                                            }}
                                          >
                                            Materials consumed
                                          </div>
                                          <table className="dashboard-materials-table">
                                            <thead>
                                              <tr>
                                                <th>Material</th>
                                                <th>Total Used</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {Object.entries(
                                                materials
                                              ).map(
                                                ([
                                                  name,
                                                  { total, unit },
                                                ]) => (
                                                  <tr key={name}>
                                                    <td>{name}</td>
                                                    <td>
                                                      {total} {unit}
                                                    </td>
                                                  </tr>
                                                )
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )
                )
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default JobLogPage;

