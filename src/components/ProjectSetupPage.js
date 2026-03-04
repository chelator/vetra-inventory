import React, { useState, useEffect } from "react";
import { formatDamageLabel } from "../utils/formatDamageLabel";

const RADIUS_PRESETS = [
  "5000", "10000", "15000", "20000", "25000",
  "30000", "35000", "40000", "45000", "50000",
];

const LOCATION_OPTIONS = ["LE", "TE", "PS", "SS", "Root", "Tip"];
const SEVERITY_OPTIONS = ["Low", "Medium", "High", "Critical"];
const DAMAGE_TYPES = [
  "Erosion", "Crack", "Delamination",
  "Leading Edge Damage", "Trailing Edge Damage",
  "Lightning Strike", "Other",
];

function ProjectSetupPage({
  projects,
  activeProjectId,
  activeProject,
  onAddProject,
  onDeleteProject,
  onArchiveProject,
  onUnarchiveProject,
  onSwitchActiveProject,
  onSetProjectName,
  onAddTurbine,
  onUpdateTurbine,
  onDeleteTurbine,
  onAddBlade,
  onUpdateBlade,
  onDeleteBlade,
  onAddDamage,
  onUpdateDamage,
  onDeleteDamage,
  jobHistory,
}) {
  const [turbineName, setTurbineName] = useState("");
  const [bladeNamesByTurbine, setBladeNamesByTurbine] = useState({});
  const [newProjectName, setNewProjectName] = useState("");

  // Inline rename state
  const [renamingTurbineId, setRenamingTurbineId] = useState(null);
  const [renamingTurbineName, setRenamingTurbineName] = useState("");
  const [renamingBladeId, setRenamingBladeId] = useState(null);
  const [renamingBladeName, setRenamingBladeName] = useState("");

  const [expandedTurbines, setExpandedTurbines] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-expanded-turbines");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [expandedBlades, setExpandedBlades] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-expanded-blades");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [expandedDamages, setExpandedDamages] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-expanded-damages");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem("vetra-expanded-turbines", JSON.stringify(expandedTurbines)); } catch {}
  }, [expandedTurbines]);

  useEffect(() => {
    try { localStorage.setItem("vetra-expanded-blades", JSON.stringify(expandedBlades)); } catch {}
  }, [expandedBlades]);

  useEffect(() => {
    try { localStorage.setItem("vetra-expanded-damages", JSON.stringify(expandedDamages)); } catch {}
  }, [expandedDamages]);

  // Build a lookup: damageId → number of jobs logged against it
  const damageJobCounts = React.useMemo(() => {
    const counts = {};
    (jobHistory || []).forEach((job) => {
      if (job.damageId) {
        counts[job.damageId] = (counts[job.damageId] || 0) + 1;
      }
    });
    return counts;
  }, [jobHistory]);

  // --- Add handlers ---
  const handleAddProjectLocal = (e) => {
    e.preventDefault();
    const trimmed = newProjectName.trim();
    if (!trimmed) return;
    onAddProject(trimmed);
    setNewProjectName("");
  };

  const handleAddTurbineLocal = (e) => {
    e.preventDefault();
    const trimmed = turbineName.trim();
    if (!trimmed) return;
    onAddTurbine(trimmed);
    setTurbineName("");
  };

  const handleBladeInputChange = (turbineId, value) => {
    setBladeNamesByTurbine((prev) => ({ ...prev, [turbineId]: value }));
  };

  const handleAddBladeLocal = (e, turbineId) => {
    e.preventDefault();
    const name = (bladeNamesByTurbine[turbineId] || "").trim();
    if (!name) return;
    onAddBlade(turbineId, name);
    setBladeNamesByTurbine((prev) => ({ ...prev, [turbineId]: "" }));
  };

  // --- Delete handlers with confirm + localStorage cleanup ---
  const handleDeleteProject = (project) => {
    if (!window.confirm(`Delete project "${project.name}" and all its turbines and damages?`)) return;
    onDeleteProject(project.id);
    // clean up any expanded state for turbines/blades/damages in this project
    const turbineIds = project.turbines.map((t) => t.id);
    const bladeIds = project.turbines.flatMap((t) => t.blades.map((b) => b.id));
    const damageIds = project.turbines.flatMap((t) =>
      t.blades.flatMap((b) => b.damages.map((d) => d.id))
    );
    setExpandedTurbines((prev) => prev.filter((id) => !turbineIds.includes(id)));
    setExpandedBlades((prev) => {
      const next = { ...prev };
      bladeIds.forEach((id) => delete next[id]);
      return next;
    });
    setExpandedDamages((prev) => {
      const next = { ...prev };
      damageIds.forEach((id) => delete next[id]);
      return next;
    });
  };

  const handleDeleteTurbine = (turbine) => {
    if (!window.confirm(`Delete turbine "${turbine.name}"? All its blades and damages will be removed.`)) return;
    onDeleteTurbine(turbine.id);
    setExpandedTurbines((prev) => prev.filter((id) => id !== turbine.id));
    const bladeIds = turbine.blades.map((b) => b.id);
    const damageIds = turbine.blades.flatMap((b) => b.damages.map((d) => d.id));
    setExpandedBlades((prev) => {
      const next = { ...prev };
      bladeIds.forEach((id) => delete next[id]);
      return next;
    });
    setExpandedDamages((prev) => {
      const next = { ...prev };
      damageIds.forEach((id) => delete next[id]);
      return next;
    });
  };

  const handleDeleteBlade = (turbineId, blade) => {
    if (!window.confirm(`Delete blade "${blade.name}"? All its damages will be removed.`)) return;
    onDeleteBlade(turbineId, blade.id);
    setExpandedBlades((prev) => { const next = { ...prev }; delete next[blade.id]; return next; });
    setExpandedDamages((prev) => {
      const next = { ...prev };
      blade.damages.forEach((d) => delete next[d.id]);
      return next;
    });
  };

  const handleDeleteDamage = (turbineId, bladeId, damage) => {
    if (!window.confirm(`Delete ${damage.number || "this damage"}?`)) return;
    onDeleteDamage(turbineId, bladeId, damage.id);
    setExpandedDamages((prev) => { const next = { ...prev }; delete next[damage.id]; return next; });
  };

  // --- Rename helpers ---
  const commitTurbineRename = (turbineId) => {
    const trimmed = renamingTurbineName.trim();
    if (trimmed) onUpdateTurbine(turbineId, { name: trimmed });
    setRenamingTurbineId(null);
  };

  const commitBladeRename = (turbineId, bladeId) => {
    const trimmed = renamingBladeName.trim();
    if (trimmed) onUpdateBlade(turbineId, bladeId, { name: trimmed });
    setRenamingBladeId(null);
  };

  // --- Expand toggles ---
  const toggleTurbineExpanded = (turbineId) => {
    setExpandedTurbines((prev) =>
      prev.includes(turbineId) ? prev.filter((id) => id !== turbineId) : [...prev, turbineId]
    );
  };

  const toggleBladeExpanded = (bladeId) => {
    setExpandedBlades((prev) => ({ ...prev, [bladeId]: !prev[bladeId] }));
  };

  const toggleDamageExpanded = (damageId) => {
    setExpandedDamages((prev) => ({ ...prev, [damageId]: !prev[damageId] }));
  };

  return (
    <div className="setup-page">
      <header className="app-header">
        <h1>Project Setup</h1>
        <p>Define the active project, turbines, blades, and damages.</p>
      </header>

      <main className="setup-main">
        <section className="project-section">

          {/* ── Add Project ── */}
          <form className="project-form" onSubmit={handleAddProjectLocal}>
            <h2>Add Project</h2>
            <div className="field">
              <label htmlFor="new-project-name">Project name</label>
              <div className="project-add-row">
                <input
                  id="new-project-name"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Galata Wind Farm 2026"
                />
                <button type="submit" className="primary-button">Add Project</button>
              </div>
            </div>
          </form>

          {/* ── Projects list ── */}
          {projects.length === 0 ? (
            <p className="empty-state">No projects yet. Create your first project above.</p>
          ) : (
            <div className="projects-list">
              {projects.map((project) => {
                const turbineCount = project.turbines.length;
                const bladeCount = project.turbines.reduce((s, t) => s + t.blades.length, 0);
                const damageCount = project.turbines.reduce(
                  (s, t) => s + t.blades.reduce((bs, b) => bs + b.damages.length, 0), 0
                );
                const isActive = project.id === activeProjectId;
                const isArchived = project.status === "archived";
                return (
                  <div
                    key={project.id}
                    className={"project-card" + (isActive ? " project-card-active" : "")}
                  >
                    <div className="project-card-header">
                      {isActive ? (
                        <input
                          type="text"
                          className="project-name-inline-input"
                          value={project.name}
                          onChange={(e) => onSetProjectName(e.target.value)}
                          placeholder="Project name"
                        />
                      ) : (
                        <h3>{project.name || "Untitled project"}</h3>
                      )}
                      <span className={isArchived ? "project-status-archived" : "project-status-active"}>
                        {isArchived ? "ARCHIVED" : "ACTIVE"}
                      </span>
                    </div>

                    <p className="project-meta">
                      {turbineCount} {turbineCount === 1 ? "turbine" : "turbines"} ·{" "}
                      {bladeCount} {bladeCount === 1 ? "blade" : "blades"} ·{" "}
                      {damageCount} {damageCount === 1 ? "damage" : "damages"}
                    </p>

                    <div className="project-card-actions">
                      {isActive ? (
                        <span className="project-status-active">Currently Active</span>
                      ) : isArchived ? (
                        <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                          Unarchive to activate
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => onSwitchActiveProject(project.id)}
                        >
                          Set Active
                        </button>
                      )}
                      {isArchived ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => onUnarchiveProject(project.id)}
                        >
                          Unarchive
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => onArchiveProject(project.id)}
                        >
                          Archive
                        </button>
                      )}
                      <button
                        type="button"
                        className="delete-button small"
                        onClick={() => handleDeleteProject(project)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Add Turbine ── */}
          <form className="turbine-form" onSubmit={handleAddTurbineLocal}>
            <h2>Turbines</h2>
            {!activeProject && (
              <p className="empty-state" style={{ marginBottom: "0.75rem" }}>
                Select or create a project above to add turbines.
              </p>
            )}
            <fieldset disabled={!activeProject} style={{ border: "none", padding: 0, margin: 0 }}>
              <div className="turbine-input-row">
                <div className="field">
                  <label htmlFor="turbine-name">Add turbine</label>
                  <input
                    id="turbine-name"
                    type="text"
                    value={turbineName}
                    onChange={(e) => setTurbineName(e.target.value)}
                    placeholder="T1, T2, T3..."
                  />
                </div>
                <button type="submit" className="primary-button">Add turbine</button>
              </div>
            </fieldset>
          </form>

          {activeProject && activeProject.turbines.length === 0 ? (
            <p className="empty-state">
              No turbines yet. Add turbines to start defining blades and damages.
            </p>
          ) : (
            <div className="turbine-grid">
              {activeProject && activeProject.turbines.map((turbine) => {
                const bladeCount = turbine.blades.length;
                const damageCount = turbine.blades.reduce((sum, b) => sum + b.damages.length, 0);
                const isExpanded = expandedTurbines.includes(turbine.id);
                const isRenamingThisTurbine = renamingTurbineId === turbine.id;

                return (
                  <article key={turbine.id} className="turbine-card">
                    <header className="turbine-card-header">
                      <button
                        type="button"
                        className="turbine-header-button"
                        onClick={() => { if (!isRenamingThisTurbine) toggleTurbineExpanded(turbine.id); }}
                      >
                        {isRenamingThisTurbine ? (
                          <input
                            type="text"
                            className="turbine-rename-input"
                            value={renamingTurbineName}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setRenamingTurbineName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitTurbineRename(turbine.id);
                              else if (e.key === "Escape") setRenamingTurbineId(null);
                            }}
                          />
                        ) : (
                          <h3>{turbine.name}</h3>
                        )}
                        <span className="turbine-summary-badge">
                          {bladeCount} blades · {damageCount} damages
                        </span>
                        <span className="turbine-chevron">{isExpanded ? "▾" : "▸"}</span>
                      </button>

                      {isRenamingThisTurbine ? (
                        <>
                          <button
                            type="button"
                            className="secondary-button small"
                            onClick={() => commitTurbineRename(turbine.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="secondary-button small"
                            onClick={() => setRenamingTurbineId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button small"
                          onClick={() => {
                            setRenamingTurbineId(turbine.id);
                            setRenamingTurbineName(turbine.name);
                          }}
                        >
                          Rename
                        </button>
                      )}
                      <button
                        type="button"
                        className="delete-button small"
                        onClick={() => handleDeleteTurbine(turbine)}
                      >
                        Delete
                      </button>
                    </header>

                    {isExpanded && (
                      <div className="turbine-card-body">
                        <form
                          className="blade-form-row"
                          onSubmit={(e) => handleAddBladeLocal(e, turbine.id)}
                        >
                          <div className="field">
                            <label>Add blade</label>
                            <input
                              type="text"
                              value={bladeNamesByTurbine[turbine.id] || ""}
                              onChange={(e) => handleBladeInputChange(turbine.id, e.target.value)}
                              placeholder="A, B, C or 1, 2, 3..."
                            />
                          </div>
                          <button type="submit" className="secondary-button">Add Blade</button>
                        </form>

                        {turbine.blades.length === 0 ? (
                          <p className="empty-state small">
                            No blades yet. Add blades for this turbine.
                          </p>
                        ) : (
                          <div className="blade-grid">
                            {turbine.blades.map((blade) => {
                              const isBladeExpanded = !!expandedBlades[blade.id];
                              const bladeDamageCount = blade.damages.length;
                              const isRenamingThisBlade = renamingBladeId === blade.id;

                              return (
                                <div key={blade.id} className="blade-card">
                                  <div
                                    className="blade-header"
                                    onClick={() => { if (!isRenamingThisBlade) toggleBladeExpanded(blade.id); }}
                                  >
                                    {isRenamingThisBlade ? (
                                      <input
                                        type="text"
                                        className="turbine-rename-input"
                                        value={renamingBladeName}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setRenamingBladeName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") commitBladeRename(turbine.id, blade.id);
                                          else if (e.key === "Escape") setRenamingBladeId(null);
                                        }}
                                      />
                                    ) : (
                                      <span className="blade-name">{blade.name}</span>
                                    )}
                                    <span className="turbine-summary-badge">
                                      {bladeDamageCount} damages
                                    </span>
                                    <span className="turbine-chevron">
                                      {isBladeExpanded ? "▾" : "▸"}
                                    </span>

                                    {isRenamingThisBlade ? (
                                      <>
                                        <button
                                          type="button"
                                          className="secondary-button small"
                                          onClick={(e) => { e.stopPropagation(); commitBladeRename(turbine.id, blade.id); }}
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          className="secondary-button small"
                                          onClick={(e) => { e.stopPropagation(); setRenamingBladeId(null); }}
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        className="secondary-button small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRenamingBladeId(blade.id);
                                          setRenamingBladeName(blade.name);
                                        }}
                                      >
                                        Rename
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className="delete-button small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteBlade(turbine.id, blade);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>

                                  {isBladeExpanded && (
                                    <div className="damage-section">
                                      <div className="damage-header">
                                        <span>Damages</span>
                                        <button
                                          type="button"
                                          className="secondary-button"
                                          onClick={() => {
                                            const newId = onAddDamage(turbine.id, blade.id);
                                            if (newId) {
                                              setExpandedDamages((prev) => ({ ...prev, [newId]: true }));
                                            }
                                          }}
                                        >
                                          Add Damage
                                        </button>
                                      </div>

                                      {blade.damages.length === 0 ? (
                                        <p className="empty-state small">
                                          No damages yet. Add damages for this blade.
                                        </p>
                                      ) : (
                                        <div className="damage-list">
                                          {blade.damages.map((damage) => {
                                            const isDamageExpanded = expandedDamages[damage.id] ?? true;
                                            const jobCount = damageJobCounts[damage.id] || 0;
                                            const jobStatusClass = jobCount > 0
                                              ? "status-badge-inprogress"
                                              : "status-badge-notstarted";
                                            const jobStatusText = jobCount > 0
                                              ? `${jobCount} job${jobCount !== 1 ? "s" : ""}`
                                              : "No jobs";

                                            // ── Collapsed row ──
                                            if (!isDamageExpanded) {
                                              return (
                                                <div key={damage.id} className="damage-collapsed-row">
                                                  <span>{formatDamageLabel(damage)}</span>
                                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                                    <span className={jobStatusClass} style={{ fontSize: "0.72rem" }}>
                                                      {jobStatusText}
                                                    </span>
                                                    {damage.severity && (
                                                      <span className={`severity-badge severity-${damage.severity.toLowerCase()}`}>
                                                        {damage.severity}
                                                      </span>
                                                    )}
                                                    <div className="pill-row">
                                                      <button
                                                        type="button"
                                                        className="secondary-button"
                                                        onClick={() => toggleDamageExpanded(damage.id)}
                                                      >
                                                        Edit
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className="delete-button small"
                                                        onClick={() => handleDeleteDamage(turbine.id, blade.id, damage)}
                                                      >
                                                        Delete
                                                      </button>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            }

                                            // ── Expanded row ──
                                            return (
                                              <div key={damage.id} className="damage-row">
                                                <div className="damage-top-row">
                                                  <input
                                                    type="text"
                                                    value={damage.number}
                                                    onChange={(e) =>
                                                      onUpdateDamage(turbine.id, blade.id, damage.id, { number: e.target.value })
                                                    }
                                                    className="damage-number-input"
                                                  />
                                                  <select
                                                    value={damage.type}
                                                    onChange={(e) =>
                                                      onUpdateDamage(turbine.id, blade.id, damage.id, { type: e.target.value })
                                                    }
                                                  >
                                                    {DAMAGE_TYPES.map((t) => (
                                                      <option key={t} value={t}>{t}</option>
                                                    ))}
                                                  </select>

                                                  <div className="damage-radius-group">
                                                    <select
                                                      value={RADIUS_PRESETS.includes(damage.radius || "") ? damage.radius : ""}
                                                      onChange={(e) =>
                                                        onUpdateDamage(turbine.id, blade.id, damage.id, { radius: e.target.value })
                                                      }
                                                    >
                                                      <option value="">Radius presets</option>
                                                      {RADIUS_PRESETS.map((r) => (
                                                        <option key={r} value={r}>{r}</option>
                                                      ))}
                                                    </select>
                                                    <div className="damage-radius-input">
                                                      <input
                                                        type="text"
                                                        value={damage.radius || ""}
                                                        onChange={(e) =>
                                                          onUpdateDamage(turbine.id, blade.id, damage.id, { radius: e.target.value })
                                                        }
                                                        placeholder="Radius"
                                                      />
                                                      <span className="radius-unit">mm</span>
                                                    </div>
                                                  </div>

                                                  <input
                                                    type="text"
                                                    value={damage.notes || ""}
                                                    onChange={(e) =>
                                                      onUpdateDamage(turbine.id, blade.id, damage.id, { notes: e.target.value })
                                                    }
                                                    placeholder="Notes"
                                                    className="damage-notes-input"
                                                  />
                                                </div>

                                                {/* Locations */}
                                                <div className="damage-bottom-row">
                                                  <div className="damage-locations">
                                                    {LOCATION_OPTIONS.map((loc) => {
                                                      const isSelected = (damage.locations || []).includes(loc);
                                                      return (
                                                        <button
                                                          key={loc}
                                                          type="button"
                                                          className={
                                                            (isSelected ? "pill-button pill-button-active" : "pill-button") +
                                                            " pill-button-sm"
                                                          }
                                                          onClick={() => {
                                                            const current = damage.locations || [];
                                                            const next = isSelected
                                                              ? current.filter((l) => l !== loc)
                                                              : [...current, loc];
                                                            onUpdateDamage(turbine.id, blade.id, damage.id, { locations: next });
                                                          }}
                                                        >
                                                          {loc}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                </div>

                                                {/* Severity */}
                                                <div className="damage-bottom-row">
                                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                                    <span style={{ fontSize: "0.8rem", color: "#94a3b8", marginRight: "0.25rem" }}>
                                                      Severity:
                                                    </span>
                                                    {SEVERITY_OPTIONS.map((sev) => {
                                                      const isSelected = damage.severity === sev;
                                                      return (
                                                        <button
                                                          key={sev}
                                                          type="button"
                                                          className={
                                                            (isSelected
                                                              ? `pill-button pill-button-active severity-pill-active-${sev.toLowerCase()}`
                                                              : "pill-button") + " pill-button-sm"
                                                          }
                                                          onClick={() =>
                                                            onUpdateDamage(turbine.id, blade.id, damage.id, {
                                                              severity: isSelected ? "" : sev,
                                                            })
                                                          }
                                                        >
                                                          {sev}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                </div>

                                                <div className="damage-bottom-row">
                                                  <button
                                                    type="button"
                                                    className="primary-button damage-finish-button"
                                                    onClick={() => toggleDamageExpanded(damage.id)}
                                                  >
                                                    Finish
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="delete-button small"
                                                    onClick={() => handleDeleteDamage(turbine.id, blade.id, damage)}
                                                  >
                                                    Delete Damage
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default ProjectSetupPage;
