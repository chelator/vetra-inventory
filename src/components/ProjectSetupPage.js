import React, { useState, useEffect, useMemo } from "react";
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
  "Lightning Strike",
  "Gelcoat Damage", "Void / Air Pocket", "Impact Damage",
  "Vortex Generator Damage", "Surface Contamination", "Bond Line Failure",
  "Other",
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
  onUpdateProject,
  onDuplicateTurbine,
  onAddMultipleBlades,
  jobHistory,
}) {
  // Drill-down state
  const [showAllProjects, setShowAllProjects] = useState(!activeProject);
  const [selectedTurbineId, setSelectedTurbineId] = useState(null);
  const [selectedBladeId, setSelectedBladeId] = useState(null);

  // Form state
  const [newProjectName, setNewProjectName] = useState("");
  const [newTurbineName, setNewTurbineName] = useState("");
  const [newBladeName, setNewBladeName] = useState("");

  // Toast state
  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Inline rename state
  const [renamingTurbineId, setRenamingTurbineId] = useState(null);
  const [renamingTurbineName, setRenamingTurbineName] = useState("");
  const [renamingBladeId, setRenamingBladeId] = useState(null);
  const [renamingBladeName, setRenamingBladeName] = useState("");

  // All Damages view state
  const [showAllDamagesView, setShowAllDamagesView] = useState(false);
  const [damageViewFilter, setDamageViewFilter] = useState("all");
  const [damageViewSort, setDamageViewSort] = useState("turbine");

  // Collapsible sections
  const [projectInfoOpen, setProjectInfoOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(true);

  // Damage expand state (persisted)
  const [expandedDamages, setExpandedDamages] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-expanded-damages");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem("vetra-expanded-damages", JSON.stringify(expandedDamages)); } catch {}
  }, [expandedDamages]);

  // Reset drill-down navigation when active project changes
  useEffect(() => {
    setSelectedTurbineId(null);
    setSelectedBladeId(null);
    if (!activeProjectId) {
      setShowAllProjects(true);
    }
  }, [activeProjectId]);

  // Damage stats: damageId → { jobCount, totalHours, opCount }
  const damageStats = useMemo(() => {
    const stats = {};
    (jobHistory || []).forEach((job) => {
      const dId = job.damageId;
      if (!dId) return;
      if (!stats[dId]) stats[dId] = { jobCount: 0, totalHours: 0, opCount: 0 };
      stats[dId].jobCount += 1;
      (job.operations || []).forEach((op) => {
        const h = parseFloat(op.duration || 0);
        if (!isNaN(h)) stats[dId].totalHours += h;
        stats[dId].opCount += 1;
      });
    });
    return stats;
  }, [jobHistory]);

  // Project-level hours
  const projectHoursLogged = useMemo(() => {
    if (!activeProject) return 0;
    const turbineNames = new Set(activeProject.turbines.map((t) => t.name));
    let total = 0;
    (jobHistory || []).forEach((job) => {
      const belongsToProject =
        job.projectId === activeProject.id ||
        (!job.projectId && turbineNames.has(job.turbine));
      if (!belongsToProject) return;
      (job.operations || []).forEach((op) => {
        const h = parseFloat(op.duration || 0);
        if (!isNaN(h)) total += h;
      });
    });
    return total;
  }, [jobHistory, activeProject]);

  // Project-level aggregates for dashboard
  const overviewStats = useMemo(() => {
    if (!activeProject) return null;
    const allDamages = activeProject.turbines.flatMap((t) =>
      t.blades.flatMap((b) => b.damages)
    );
    let notStarted = 0, inProgress = 0, complete = 0;
    let low = 0, medium = 0, high = 0, critical = 0;

    allDamages.forEach((d) => {
      const s = d.status || "notstarted";
      if (s === "complete") complete++;
      else if (s === "inprogress") inProgress++;
      else notStarted++;

      const sev = (d.severity || "").toLowerCase();
      if (sev === "low") low++;
      else if (sev === "medium") medium++;
      else if (sev === "high") high++;
      else if (sev === "critical") critical++;
    });

    return {
      turbines: activeProject.turbines.length,
      blades: activeProject.turbines.reduce((s, t) => s + t.blades.length, 0),
      damages: allDamages.length,
      totalHoursLogged: projectHoursLogged,
      statusCounts: { notStarted, inProgress, complete },
      severityCounts: { low, medium, high, critical },
    };
  }, [activeProject, damageStats, projectHoursLogged]);

  // All damages flat list
  const allDamagesFlat = useMemo(() => {
    if (!activeProject || !showAllDamagesView) return [];
    const list = [];
    activeProject.turbines.forEach((turbine) => {
      turbine.blades.forEach((blade) => {
        blade.damages.forEach((damage) => {
          const ds = damageStats[damage.id] || { jobCount: 0, totalHours: 0, opCount: 0 };
          list.push({
            turbine, blade, damage,
            turbineId: turbine.id, bladeId: blade.id,
            status: damage.status || "notstarted",
            jobCount: ds.jobCount,
            totalHours: ds.totalHours,
            estimatedHours: damage.estimatedHours ? Number(damage.estimatedHours) : 0,
          });
        });
      });
    });
    // Filter
    const filtered = damageViewFilter === "all"
      ? list
      : list.filter((d) => d.status === damageViewFilter);
    // Sort
    filtered.sort((a, b) => {
      if (damageViewSort === "severity") {
        const order = { critical: 0, high: 1, medium: 2, low: 3, "": 4 };
        return (order[(a.damage.severity || "").toLowerCase()] ?? 4) - (order[(b.damage.severity || "").toLowerCase()] ?? 4);
      }
      if (damageViewSort === "status") {
        const order = { notstarted: 0, inprogress: 1, complete: 2 };
        return (order[a.status] ?? 0) - (order[b.status] ?? 0);
      }
      // default: turbine
      const tCmp = a.turbine.name.localeCompare(b.turbine.name);
      if (tCmp !== 0) return tCmp;
      return a.blade.name.localeCompare(b.blade.name);
    });
    return filtered;
  }, [activeProject, showAllDamagesView, damageViewFilter, damageViewSort, damageStats]);

  // Derived navigation objects
  const selectedTurbine = activeProject?.turbines.find((t) => t.id === selectedTurbineId) || null;
  const selectedBlade = selectedTurbine?.blades.find((b) => b.id === selectedBladeId) || null;

  // Current drill level
  const drillLevel = showAllProjects ? 0 : (selectedTurbineId ? (selectedBladeId ? 3 : 2) : 1);

  // Navigation helpers
  const navigateToProjects = () => {
    setShowAllProjects(true);
    setSelectedTurbineId(null);
    setSelectedBladeId(null);
  };

  const navigateToTurbines = () => {
    setShowAllProjects(false);
    setSelectedTurbineId(null);
    setSelectedBladeId(null);
  };

  // --- Delete handlers with confirm + localStorage cleanup ---
  const handleDeleteProject = (project) => {
    if (!window.confirm(`Delete project "${project.name}" and all its turbines and damages?`)) return;
    onDeleteProject(project.id);
    showToast(`Project "${project.name}" deleted`);
  };

  const handleDeleteTurbine = (turbine) => {
    if (!window.confirm(`Delete turbine "${turbine.name}"? All its blades and damages will be removed.`)) return;
    onDeleteTurbine(turbine.id);
    showToast(`Turbine "${turbine.name}" deleted`);
    if (selectedTurbineId === turbine.id) {
      setSelectedTurbineId(null);
      setSelectedBladeId(null);
    }
  };

  const handleDeleteBlade = (turbineId, blade) => {
    if (!window.confirm(`Delete blade "${blade.name}"? All its damages will be removed.`)) return;
    onDeleteBlade(turbineId, blade.id);
    showToast(`Blade "${blade.name}" deleted`);
    if (selectedBladeId === blade.id) {
      setSelectedBladeId(null);
    }
    setExpandedDamages((prev) => {
      const next = { ...prev };
      blade.damages.forEach((d) => delete next[d.id]);
      return next;
    });
  };

  const handleDeleteDamage = (turbineId, bladeId, damage) => {
    if (!window.confirm(`Delete ${damage.number || "this damage"}?`)) return;
    onDeleteDamage(turbineId, bladeId, damage.id);
    showToast(`${damage.number || "Damage"} deleted`);
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

  const toggleDamageExpanded = (damageId) => {
    setExpandedDamages((prev) => ({ ...prev, [damageId]: !prev[damageId] }));
  };

  // Helper: get status class + text for a damage
  const getDamageStatus = (damage) => {
    const s = damage.status || "notstarted";
    if (s === "complete") return { cls: "status-badge-complete", text: "Complete" };
    if (s === "inprogress") return { cls: "status-badge-inprogress", text: "In Progress" };
    return { cls: "status-badge-notstarted", text: "Not Started" };
  };

  // Helper: get turbine aggregate stats
  const getTurbineStats = (turbine) => {
    const bladeCount = turbine.blades.length;
    const damages = turbine.blades.flatMap((b) => b.damages);
    const damageCount = damages.length;
    let ns = 0, ip = 0, done = 0;
    damages.forEach((d) => {
      const s = d.status || "notstarted";
      if (s === "complete") done++;
      else if (s === "inprogress") ip++;
      else ns++;
    });
    return { bladeCount, damageCount, ns, ip, done };
  };

  // Helper: get blade aggregate stats
  const getBladeStats = (blade) => {
    const damageCount = blade.damages.length;
    let ns = 0, ip = 0, done = 0;
    blade.damages.forEach((d) => {
      const s = d.status || "notstarted";
      if (s === "complete") done++;
      else if (s === "inprogress") ip++;
      else ns++;
    });
    return { damageCount, ns, ip, done };
  };

  return (
    <div className="setup-page">
      <header className="app-header">
        <h1>
          Project Setup
          {activeProject ? ` / ${activeProject.name}` : ""}
        </h1>
        <p>
          {activeProject
            ? "Define turbines, blades, and damages for the active project."
            : "Create or select a project to get started."}
        </p>
      </header>

      <main className="setup-main">

        {/* ── Project Information (collapsible) ── */}
        {activeProject && drillLevel >= 1 && (
          <section className="setup-collapsible">
            <button
              type="button"
              className="setup-collapsible-header"
              onClick={() => setProjectInfoOpen(!projectInfoOpen)}
            >
              <span className="setup-collapsible-title">Project Information</span>
              <span className="setup-collapsible-hint">
                {[activeProject.client, activeProject.windFarm, activeProject.location].filter(Boolean).join(" / ") || "No details yet"}
              </span>
              <span className="setup-collapsible-chevron">{projectInfoOpen ? "\u25B2" : "\u25BC"}</span>
            </button>
            {projectInfoOpen && (
              <div className="setup-collapsible-body">
                <div className="project-info-grid">
                  <div className="field">
                    <label>Client</label>
                    <input
                      type="text"
                      value={activeProject.client || ""}
                      onChange={(e) => onUpdateProject(activeProject.id, { client: e.target.value })}
                      placeholder="e.g. Orsted"
                    />
                  </div>
                  <div className="field">
                    <label>Wind Farm</label>
                    <input
                      type="text"
                      value={activeProject.windFarm || ""}
                      onChange={(e) => onUpdateProject(activeProject.id, { windFarm: e.target.value })}
                      placeholder="e.g. Hornsea Two"
                    />
                  </div>
                  <div className="field">
                    <label>Location</label>
                    <input
                      type="text"
                      value={activeProject.location || ""}
                      onChange={(e) => onUpdateProject(activeProject.id, { location: e.target.value })}
                      placeholder="e.g. North Sea, UK"
                    />
                  </div>
                  <div className="field">
                    <label>Project Ref / PO</label>
                    <input
                      type="text"
                      value={activeProject.projectRef || ""}
                      onChange={(e) => onUpdateProject(activeProject.id, { projectRef: e.target.value })}
                      placeholder="e.g. PO-2026-001"
                    />
                  </div>
                  <div className="field">
                    <label>Turbine Model</label>
                    <input
                      type="text"
                      value={activeProject.turbineModel || ""}
                      onChange={(e) => onUpdateProject(activeProject.id, { turbineModel: e.target.value })}
                      placeholder="e.g. SG 14-222 DD"
                    />
                  </div>
                  <div className="field">
                    <label>Blade Type</label>
                    <input
                      type="text"
                      value={activeProject.bladeType || ""}
                      onChange={(e) => onUpdateProject(activeProject.id, { bladeType: e.target.value })}
                      placeholder="e.g. LM 107.0 P"
                    />
                  </div>
                  <div className="field">
                    <label>Team</label>
                    <input
                      type="text"
                      value={activeProject.team || ""}
                      onChange={(e) => onUpdateProject(activeProject.id, { team: e.target.value })}
                      placeholder="e.g. Alpha Team"
                    />
                  </div>
                  <div className="field">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={activeProject.startDate || ""}
                      onChange={(e) => onUpdateProject(activeProject.id, { startDate: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Mobilisation Date</label>
                    <input
                      type="date"
                      value={activeProject.mobDate || ""}
                      onChange={(e) => onUpdateProject(activeProject.id, { mobDate: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Planned Completion</label>
                    <input
                      type="date"
                      value={activeProject.plannedEndDate || ""}
                      onChange={(e) => onUpdateProject(activeProject.id, { plannedEndDate: e.target.value })}
                    />
                  </div>
                  <div className="field field-full">
                    <label>Notes / Scope</label>
                    <textarea
                      value={activeProject.projectNotes || ""}
                      onChange={(e) => onUpdateProject(activeProject.id, { projectNotes: e.target.value })}
                      placeholder="Project scope, special instructions, access notes..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Dashboard (collapsible) ── */}
        {activeProject && overviewStats && (
          <section className="setup-collapsible">
            <button
              type="button"
              className="setup-collapsible-header"
              onClick={() => setDashboardOpen(!dashboardOpen)}
            >
              <span className="setup-collapsible-title">Dashboard</span>
              <span className="setup-collapsible-hint">
                {overviewStats.turbines}T / {overviewStats.blades}B / {overviewStats.damages}D / {overviewStats.totalHoursLogged.toFixed(1)}h
              </span>
              <span className="setup-collapsible-chevron">{dashboardOpen ? "\u25B2" : "\u25BC"}</span>
            </button>
            {dashboardOpen && (
              <div className="setup-collapsible-body">
                <div className="setup-stat-grid">
                  <div className="setup-stat-card">
                    <span className="setup-stat-value">{overviewStats.turbines}</span>
                    <span className="setup-stat-label">Turbines</span>
                  </div>
                  <div className="setup-stat-card">
                    <span className="setup-stat-value">{overviewStats.blades}</span>
                    <span className="setup-stat-label">Blades</span>
                  </div>
                  <div className="setup-stat-card">
                    <span className="setup-stat-value">{overviewStats.damages}</span>
                    <span className="setup-stat-label">Damages</span>
                  </div>
                  <div className="setup-stat-card">
                    <span className="setup-stat-value">{overviewStats.totalHoursLogged.toFixed(1)}</span>
                    <span className="setup-stat-label">Hrs Logged</span>
                  </div>
                </div>

                <div className="setup-breakdown-row">
                  <span className="status-badge-notstarted">
                    Not Started {overviewStats.statusCounts.notStarted}
                  </span>
                  <span className="status-badge-inprogress">
                    In Progress {overviewStats.statusCounts.inProgress}
                  </span>
                  <span className="status-badge-complete">
                    Complete {overviewStats.statusCounts.complete}
                  </span>
                  {overviewStats.severityCounts.low > 0 && (
                    <span className="sev-badge sev-low">Low {overviewStats.severityCounts.low}</span>
                  )}
                  {overviewStats.severityCounts.medium > 0 && (
                    <span className="sev-badge sev-medium">Med {overviewStats.severityCounts.medium}</span>
                  )}
                  {overviewStats.severityCounts.high > 0 && (
                    <span className="sev-badge sev-high">High {overviewStats.severityCounts.high}</span>
                  )}
                  {overviewStats.severityCounts.critical > 0 && (
                    <span className="sev-badge sev-critical">Critical {overviewStats.severityCounts.critical}</span>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Breadcrumb ── */}
        <nav className="setup-breadcrumb">
          {drillLevel === 0 ? (
            <span className="setup-breadcrumb-current">All Projects</span>
          ) : (
            <button type="button" className="setup-breadcrumb-link" onClick={navigateToProjects}>
              All Projects
            </button>
          )}

          {drillLevel >= 1 && activeProject && (
            <>
              <span className="setup-breadcrumb-sep">/</span>
              {drillLevel === 1 ? (
                <span className="setup-breadcrumb-current">{activeProject.name}</span>
              ) : (
                <button type="button" className="setup-breadcrumb-link" onClick={navigateToTurbines}>
                  {activeProject.name}
                </button>
              )}
            </>
          )}

          {drillLevel >= 2 && selectedTurbine && (
            <>
              <span className="setup-breadcrumb-sep">/</span>
              {drillLevel === 2 ? (
                <span className="setup-breadcrumb-current">{selectedTurbine.name}</span>
              ) : (
                <button
                  type="button"
                  className="setup-breadcrumb-link"
                  onClick={() => {
                    setSelectedBladeId(null);
                  }}
                >
                  {selectedTurbine.name}
                </button>
              )}
            </>
          )}

          {drillLevel === 3 && selectedBlade && (
            <>
              <span className="setup-breadcrumb-sep">/</span>
              <span className="setup-breadcrumb-current">{selectedBlade.name}</span>
            </>
          )}
        </nav>

        {/* ── Level 0: Projects ── */}
        {drillLevel === 0 && (
          <section className="setup-level">
            <form
              className="setup-add-row"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newProjectName.trim();
                if (!trimmed) return;
                onAddProject(trimmed);
                setNewProjectName("");
                setShowAllProjects(false);
                showToast(`Project "${trimmed}" created`);
              }}
            >
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="New project name..."
              />
              <button type="submit" className="primary-button">Add Project</button>
            </form>

            {projects.length === 0 ? (
              <p className="empty-state">No projects yet — create one above to get started.</p>
            ) : (
              <div className="setup-project-grid">
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
                      className={"setup-nav-card project-card" + (isActive ? " project-card-active" : "") + (isArchived ? " project-card-archived" : "")}
                      onClick={() => {
                        if (!isArchived) {
                          onSwitchActiveProject(project.id);
                          setShowAllProjects(false);
                        }
                      }}
                      style={{ cursor: isArchived ? "default" : "pointer" }}
                    >
                      <div className="project-card-header">
                        <span className="setup-nav-card-title">
                          {project.name || "Untitled project"}
                        </span>
                        <span className={isArchived ? "project-status-archived" : isActive ? "project-status-active" : ""}>
                          {isArchived ? "ARCHIVED" : isActive ? "ACTIVE" : ""}
                        </span>
                      </div>

                      <p className="setup-nav-card-meta">
                        {turbineCount} {turbineCount === 1 ? "turbine" : "turbines"} ·{" "}
                        {bladeCount} {bladeCount === 1 ? "blade" : "blades"} ·{" "}
                        {damageCount} {damageCount === 1 ? "damage" : "damages"}
                      </p>

                      {(project.client || project.windFarm) && (
                        <p className="card-meta-detail">
                          {[project.client, project.windFarm].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {project.turbineModel && (
                        <p className="card-meta-detail">Model: {project.turbineModel}</p>
                      )}
                      {project.location && (
                        <p className="card-meta-detail">{project.location}</p>
                      )}

                      {(project.startDate || project.plannedEndDate) && (
                        <p className="setup-nav-card-meta">
                          {project.startDate && <>Start: {project.startDate}</>}
                          {project.startDate && project.plannedEndDate && " · "}
                          {project.plannedEndDate && <>End: {project.plannedEndDate}</>}
                          {project.plannedEndDate && (() => {
                            const today = new Date().toISOString().slice(0,10);
                            const diff = Math.ceil((new Date(project.plannedEndDate) - new Date(today)) / 86400000);
                            if (diff > 0) return <span style={{ color: "#22c55e" }}> ({diff}d left)</span>;
                            if (diff < 0) return <span style={{ color: "#ef4444" }}> ({Math.abs(diff)}d overdue)</span>;
                            return <span style={{ color: "#f59e0b" }}> (due today)</span>;
                          })()}
                        </p>
                      )}

                      <div
                        className="setup-nav-card-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
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
          </section>
        )}

        {/* ── Level 1: Turbines ── */}
        {drillLevel === 1 && activeProject && (
          <section className="setup-level">
            {/* View toggle */}
            <div className="setup-view-toggle">
              <button
                type="button"
                className={`setup-view-toggle-btn${!showAllDamagesView ? " setup-view-toggle-active" : ""}`}
                onClick={() => setShowAllDamagesView(false)}
              >
                Turbines
              </button>
              <button
                type="button"
                className={`setup-view-toggle-btn${showAllDamagesView ? " setup-view-toggle-active" : ""}`}
                onClick={() => setShowAllDamagesView(true)}
              >
                All Damages
              </button>
            </div>

            {/* ── All Damages flat view ── */}
            {showAllDamagesView ? (
              <>
                <div className="all-damages-controls">
                  <div className="pill-row">
                    {[
                      { key: "all", label: "All" },
                      { key: "notstarted", label: "Not Started" },
                      { key: "inprogress", label: "In Progress" },
                      { key: "complete", label: "Complete" },
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        className={`pill-button pill-button-sm${damageViewFilter === f.key ? " pill-button-active" : ""}`}
                        onClick={() => setDamageViewFilter(f.key)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <select
                    value={damageViewSort}
                    onChange={(e) => setDamageViewSort(e.target.value)}
                    style={{ minWidth: 120 }}
                  >
                    <option value="turbine">Sort: Turbine</option>
                    <option value="severity">Sort: Severity</option>
                    <option value="status">Sort: Status</option>
                  </select>
                </div>

                {allDamagesFlat.length === 0 ? (
                  <p className="empty-state">No damages match the selected filter.</p>
                ) : (
                  <div className="all-damages-list">
                    {allDamagesFlat.map((item) => {
                      const { turbine, blade, damage, status, jobCount, totalHours, estimatedHours } = item;
                      const statusMeta = {
                        notstarted: { cls: "status-badge-notstarted", text: "Not Started" },
                        inprogress: { cls: "status-badge-inprogress", text: "In Progress" },
                        complete: { cls: "status-badge-complete", text: "Complete" },
                      };
                      const sm = statusMeta[status] || statusMeta.notstarted;
                      return (
                        <div
                          key={damage.id}
                          className="all-damages-card"
                          onClick={() => {
                            setShowAllDamagesView(false);
                            setSelectedTurbineId(turbine.id);
                            setSelectedBladeId(blade.id);
                          }}
                        >
                          <span className="all-damages-location">
                            {turbine.name} / {blade.name}
                          </span>
                          <div className="all-damages-card-header">
                            <span className="all-damages-card-title">
                              {damage.number} — {damage.type}
                            </span>
                            <div className="all-damages-card-badges">
                              <span className={sm.cls}>{sm.text}</span>
                              {damage.severity && (
                                <span className={`sev-badge sev-${damage.severity.toLowerCase()}`}>
                                  {damage.severity}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="all-damages-card-footer">
                            <span>{totalHours.toFixed(1)}{estimatedHours > 0 ? ` / ${estimatedHours}` : ""} hrs</span>
                            <span>{jobCount} job{jobCount !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
            <>
            <form
              className="setup-add-row"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newTurbineName.trim();
                if (!trimmed) return;
                onAddTurbine(trimmed);
                setNewTurbineName("");
                showToast(`Turbine "${trimmed}" added`);
              }}
            >
              <input
                type="text"
                value={newTurbineName}
                onChange={(e) => setNewTurbineName(e.target.value)}
                placeholder="Turbine name (T1, T2...)"
              />
              <button type="submit" className="primary-button">Add Turbine</button>
            </form>

            {activeProject.turbines.length === 0 ? (
              <p className="empty-state">Add a turbine to start tracking blades and damages.</p>
            ) : (
              <div className="setup-project-grid">
                {activeProject.turbines.map((turbine) => {
                  const { bladeCount, damageCount, ns, ip, done } = getTurbineStats(turbine);
                  const isRenaming = renamingTurbineId === turbine.id;

                  return (
                    <div
                      key={turbine.id}
                      className="setup-nav-card"
                      onClick={() => {
                        if (!isRenaming) {
                          setSelectedTurbineId(turbine.id);
                          setSelectedBladeId(null);
                        }
                      }}
                    >
                      <div className="setup-nav-card-title">
                        {isRenaming ? (
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
                          turbine.name
                        )}
                      </div>
                      <div className="setup-nav-card-meta">
                        {bladeCount} {bladeCount === 1 ? "blade" : "blades"} · {damageCount} {damageCount === 1 ? "damage" : "damages"}
                      </div>
                      {(turbine.serial || turbine.sitePosition) && (
                        <p className="card-meta-detail">
                          {[turbine.serial && `S/N: ${turbine.serial}`, turbine.sitePosition && `Pos: ${turbine.sitePosition}`].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {damageCount > 0 && (
                        <div className="setup-status-badges">
                          {ns > 0 && <span className="status-badge-notstarted">{ns}</span>}
                          {ip > 0 && <span className="status-badge-inprogress">{ip}</span>}
                          {done > 0 && <span className="status-badge-complete">{done}</span>}
                        </div>
                      )}
                      <div
                        className="setup-nav-card-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isRenaming ? (
                          <>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => commitTurbineRename(turbine.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setRenamingTurbineId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                setRenamingTurbineId(turbine.id);
                                setRenamingTurbineName(turbine.name);
                              }}
                            >
                              Rename
                            </button>
                            {onDuplicateTurbine && (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => { onDuplicateTurbine(turbine.id); showToast(`Turbine "${turbine.name}" duplicated`); }}
                              >
                                Duplicate
                              </button>
                            )}
                            <button
                              type="button"
                              className="delete-button small"
                              onClick={() => handleDeleteTurbine(turbine)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </>
            )}
          </section>
        )}

        {/* ── Level 2: Blades ── */}
        {drillLevel === 2 && selectedTurbine && (
          <section className="setup-level">
            <div className="setup-collapsible">
              <button
                type="button"
                className="setup-collapsible-header setup-collapsible-header-sm"
                onClick={(e) => {
                  const body = e.currentTarget.nextElementSibling;
                  if (body) body.classList.toggle("hidden");
                  e.currentTarget.querySelector(".setup-collapsible-chevron").textContent =
                    body?.classList.contains("hidden") ? "\u25BC" : "\u25B2";
                }}
              >
                <span className="setup-collapsible-title">Turbine Details</span>
                <span className="setup-collapsible-hint">
                  {[selectedTurbine.serial && `S/N: ${selectedTurbine.serial}`, selectedTurbine.hubHeight && `${selectedTurbine.hubHeight}m`, selectedTurbine.sitePosition].filter(Boolean).join(" · ") || "No details"}
                </span>
                <span className="setup-collapsible-chevron">{"\u25B2"}</span>
              </button>
              <div className="setup-collapsible-body">
                <div className="setup-meta-row">
                  <div className="field">
                    <label>Serial Number</label>
                    <input
                      type="text"
                      value={selectedTurbine.serial || ""}
                      onChange={(e) => onUpdateTurbine(selectedTurbine.id, { serial: e.target.value })}
                      placeholder="Turbine serial..."
                    />
                  </div>
                  <div className="field">
                    <label>Hub Height</label>
                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="0"
                        value={selectedTurbine.hubHeight || ""}
                        onChange={(e) => onUpdateTurbine(selectedTurbine.id, { hubHeight: e.target.value })}
                        placeholder="Hub height"
                      />
                      <span className="radius-unit">m</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>Site Position</label>
                    <input
                      type="text"
                      value={selectedTurbine.sitePosition || ""}
                      onChange={(e) => onUpdateTurbine(selectedTurbine.id, { sitePosition: e.target.value })}
                      placeholder="e.g. Row A, Pos 3"
                    />
                  </div>
                </div>
              </div>
            </div>

            <form
              className="setup-add-row"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newBladeName.trim();
                if (!trimmed) return;
                onAddBlade(selectedTurbine.id, trimmed);
                setNewBladeName("");
                showToast(`Blade "${trimmed}" added`);
              }}
            >
              <input
                type="text"
                value={newBladeName}
                onChange={(e) => setNewBladeName(e.target.value)}
                placeholder="Blade name (A, B, C or 1, 2, 3...)"
              />
              <button type="submit" className="primary-button">Add Blade</button>
              {onAddMultipleBlades && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => { onAddMultipleBlades(selectedTurbine.id, ["A", "B", "C"]); showToast("Blades A, B, C added"); }}
                >
                  + A, B, C
                </button>
              )}
            </form>

            {selectedTurbine.blades.length === 0 ? (
              <p className="empty-state">Add blades to this turbine to begin tracking repairs.</p>
            ) : (
              <div className="setup-project-grid">
                {selectedTurbine.blades.map((blade) => {
                  const { damageCount, ns, ip, done } = getBladeStats(blade);
                  const isRenaming = renamingBladeId === blade.id;

                  return (
                    <div
                      key={blade.id}
                      className="setup-nav-card"
                      onClick={() => {
                        if (!isRenaming) {
                          setSelectedBladeId(blade.id);
                        }
                      }}
                    >
                      <div className="setup-nav-card-title">
                        {isRenaming ? (
                          <input
                            type="text"
                            className="turbine-rename-input"
                            value={renamingBladeName}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setRenamingBladeName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitBladeRename(selectedTurbine.id, blade.id);
                              else if (e.key === "Escape") setRenamingBladeId(null);
                            }}
                          />
                        ) : (
                          blade.name
                        )}
                      </div>
                      <div className="setup-nav-card-meta">
                        {damageCount} {damageCount === 1 ? "damage" : "damages"}
                      </div>
                      {blade.serial && (
                        <p className="card-meta-detail">S/N: {blade.serial}</p>
                      )}
                      {damageCount > 0 && (
                        <div className="setup-status-badges">
                          {ns > 0 && <span className="status-badge-notstarted">{ns}</span>}
                          {ip > 0 && <span className="status-badge-inprogress">{ip}</span>}
                          {done > 0 && <span className="status-badge-complete">{done}</span>}
                        </div>
                      )}
                      <div
                        className="setup-nav-card-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isRenaming ? (
                          <>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => commitBladeRename(selectedTurbine.id, blade.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setRenamingBladeId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                setRenamingBladeId(blade.id);
                                setRenamingBladeName(blade.name);
                              }}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              className="delete-button small"
                              onClick={() => handleDeleteBlade(selectedTurbine.id, blade)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Level 3: Damages ── */}
        {drillLevel === 3 && selectedBlade && selectedTurbine && (
          <section className="setup-level">
            <div className="setup-collapsible">
              <button
                type="button"
                className="setup-collapsible-header setup-collapsible-header-sm"
                onClick={(e) => {
                  const body = e.currentTarget.nextElementSibling;
                  if (body) body.classList.toggle("hidden");
                  e.currentTarget.querySelector(".setup-collapsible-chevron").textContent =
                    body?.classList.contains("hidden") ? "\u25BC" : "\u25B2";
                }}
              >
                <span className="setup-collapsible-title">Blade Details</span>
                <span className="setup-collapsible-hint">
                  {[selectedBlade.serial && `S/N: ${selectedBlade.serial}`, selectedBlade.bladeLength && `${selectedBlade.bladeLength}m`].filter(Boolean).join(" · ") || "No details"}
                </span>
                <span className="setup-collapsible-chevron">{"\u25B2"}</span>
              </button>
              <div className="setup-collapsible-body">
                <div className="setup-meta-row setup-meta-row-2col">
                  <div className="field">
                    <label>Serial Number</label>
                    <input
                      type="text"
                      value={selectedBlade.serial || ""}
                      onChange={(e) => onUpdateBlade(selectedTurbine.id, selectedBlade.id, { serial: e.target.value })}
                      placeholder="Blade serial..."
                    />
                  </div>
                  <div className="field">
                    <label>Blade Length</label>
                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="0"
                        value={selectedBlade.bladeLength || ""}
                        onChange={(e) => onUpdateBlade(selectedTurbine.id, selectedBlade.id, { bladeLength: e.target.value })}
                        placeholder="Blade length"
                      />
                      <span className="radius-unit">m</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="damage-header">
              <span className="damage-header-title">
                Damages ({selectedBlade.damages.length})
              </span>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  const newId = onAddDamage(selectedTurbine.id, selectedBlade.id);
                  if (newId) {
                    setExpandedDamages((prev) => ({ ...prev, [newId]: true }));
                  }
                  showToast("Damage added");
                }}
              >
                + Add Damage
              </button>
            </div>

            {selectedBlade.damages.length === 0 ? (
              <p className="empty-state">No damages recorded — add one to start tracking repairs.</p>
            ) : (
              <div className="damage-list">
                {selectedBlade.damages.map((damage) => {
                  const isDamageExpanded = expandedDamages[damage.id] ?? true;
                  const { cls: jobStatusClass, text: jobStatusText } = getDamageStatus(damage);
                  const ds = damageStats[damage.id] || { jobCount: 0, totalHours: 0 };

                  // ── Collapsed card ──
                  if (!isDamageExpanded) {
                    return (
                      <div
                        key={damage.id}
                        className="dmg-card-collapsed"
                        onClick={() => toggleDamageExpanded(damage.id)}
                      >
                        <div className="dmg-card-collapsed-top">
                          <span className="dmg-card-collapsed-id">{damage.number}</span>
                          <span className="dmg-card-collapsed-type">{damage.type}</span>
                          <div className="dmg-card-collapsed-badges">
                            <span className={jobStatusClass}>{jobStatusText}</span>
                            {damage.severity && (
                              <span className={`sev-badge sev-${damage.severity.toLowerCase()}`}>
                                {damage.severity}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="dmg-card-collapsed-bottom">
                          <span className="dmg-card-collapsed-detail">
                            {damage.radius ? `R: ${damage.radius}mm` : ""}
                            {damage.radius && (damage.locations || []).length > 0 ? " · " : ""}
                            {(damage.locations || []).length > 0 ? (damage.locations || []).join(", ") : ""}
                          </span>
                          <span className="dmg-card-collapsed-hours">
                            {ds.totalHours > 0 ? `${ds.totalHours.toFixed(1)}h logged` : ""}
                            {damage.estimatedHours ? ` / ${damage.estimatedHours}h est` : ""}
                          </span>
                          <div className="dmg-card-collapsed-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="delete-button small"
                              onClick={() => handleDeleteDamage(selectedTurbine.id, selectedBlade.id, damage)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ── Expanded form ──
                  return (
                    <div key={damage.id} className="dmg-form">
                      <div className="dmg-form-header">
                        <span className="dmg-form-title">{damage.number || "New Damage"} — {damage.type}</span>
                        <div className="dmg-form-header-actions">
                          <button
                            type="button"
                            className="primary-button dmg-form-done-btn"
                            onClick={() => toggleDamageExpanded(damage.id)}
                          >
                            Done
                          </button>
                          <button
                            type="button"
                            className="delete-button small"
                            onClick={() => handleDeleteDamage(selectedTurbine.id, selectedBlade.id, damage)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Identity row */}
                      <div className="dmg-form-section">
                        <div className="dmg-form-row-2col">
                          <div className="field">
                            <label>Damage ID</label>
                            <input
                              type="text"
                              value={damage.number}
                              onChange={(e) =>
                                onUpdateDamage(selectedTurbine.id, selectedBlade.id, damage.id, { number: e.target.value })
                              }
                              placeholder="D1, D2..."
                            />
                          </div>
                          <div className="field">
                            <label>Damage Type</label>
                            <select
                              value={damage.type}
                              onChange={(e) =>
                                onUpdateDamage(selectedTurbine.id, selectedBlade.id, damage.id, { type: e.target.value })
                              }
                            >
                              {DAMAGE_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Radius */}
                      <div className="dmg-form-section">
                        <label className="dmg-form-section-label">Radius</label>
                        <div className="dmg-form-row-2col">
                          <div className="field">
                            <label>Preset</label>
                            <select
                              value={RADIUS_PRESETS.includes(damage.radius || "") ? damage.radius : ""}
                              onChange={(e) =>
                                onUpdateDamage(selectedTurbine.id, selectedBlade.id, damage.id, { radius: e.target.value })
                              }
                            >
                              <option value="">Select preset...</option>
                              {RADIUS_PRESETS.map((r) => (
                                <option key={r} value={r}>{Number(r) / 1000}m ({r}mm)</option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>Custom (mm)</label>
                            <div className="input-with-unit">
                              <input
                                type="text"
                                value={damage.radius || ""}
                                onChange={(e) =>
                                  onUpdateDamage(selectedTurbine.id, selectedBlade.id, damage.id, { radius: e.target.value })
                                }
                                placeholder="Enter radius"
                              />
                              <span className="radius-unit">mm</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Location pills */}
                      <div className="dmg-form-section">
                        <label className="dmg-form-section-label">Location on Blade</label>
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
                                  onUpdateDamage(selectedTurbine.id, selectedBlade.id, damage.id, { locations: next });
                                }}
                              >
                                {loc}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Severity */}
                      <div className="dmg-form-section">
                        <label className="dmg-form-section-label">Severity</label>
                        <div className="damage-locations">
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
                                  onUpdateDamage(selectedTurbine.id, selectedBlade.id, damage.id, {
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

                      {/* Status */}
                      <div className="dmg-form-section">
                        <label className="dmg-form-section-label">Status</label>
                        <div className="ddc-status-row">
                          {["notstarted", "inprogress", "complete"].map((s) => {
                            const meta = { notstarted: { label: "Not Started" }, inprogress: { label: "In Progress" }, complete: { label: "Complete" } };
                            const isActive = (damage.status || "notstarted") === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                className={`ddc-status-btn ddc-status-${s}${isActive ? " ddc-status-active" : ""}`}
                                onClick={() => onUpdateDamage(selectedTurbine.id, selectedBlade.id, damage.id, { status: s })}
                              >
                                {meta[s].label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Notes & Hours */}
                      <div className="dmg-form-section">
                        <div className="dmg-form-row-2col">
                          <div className="field">
                            <label>Notes</label>
                            <input
                              type="text"
                              value={damage.notes || ""}
                              onChange={(e) =>
                                onUpdateDamage(selectedTurbine.id, selectedBlade.id, damage.id, { notes: e.target.value })
                              }
                              placeholder="Additional notes..."
                            />
                          </div>
                          <div className="field">
                            <label>Estimated Hours</label>
                            <div className="input-with-unit">
                              <input
                                type="number"
                                min="0"
                                value={damage.estimatedHours || ""}
                                onChange={(e) =>
                                  onUpdateDamage(selectedTurbine.id, selectedBlade.id, damage.id, { estimatedHours: e.target.value ? Number(e.target.value) : "" })
                                }
                                placeholder="Est. hours"
                              />
                              <span className="radius-unit">hrs</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

      </main>

      {toastMessage && (
        <div className="success-banner">{toastMessage}</div>
      )}
    </div>
  );
}

export default ProjectSetupPage;
