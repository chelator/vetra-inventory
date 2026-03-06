import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import ChevronIcon from "./ChevronIcon";

const OPERATION_TYPES = [
  "Grinding", "Sanding Coarse", "Sanding Fine", "Filler Application",
  "Lamination", "Curing", "Topcoat", "Primer", "Inspection",
  "Vacuum Infusion", "Weather Delay", "Custom",
];

const ACCESS_METHODS = ["Rope Access", "Platform", "MEWP", "Ground", "Internal"];
const WEATHER_CONDITIONS = ["Clear", "Overcast", "Rain", "High Wind Stop", "Fog"];

// Logical repair workflow sequence for smart suggestions
const OPERATION_WORKFLOW = [
  "Grinding", "Sanding Coarse", "Filler Application", "Sanding Fine",
  "Lamination", "Curing", "Vacuum Infusion", "Primer", "Topcoat", "Inspection",
];
const MULTI_PASS_OPS = new Set(["Filler Application", "Sanding Fine", "Topcoat", "Primer"]);

const TIMESHEET_ACTIVITIES = [
  "Hotel Leave", "Arrive Turbine", "Work Starts", "Break Start",
  "Break End", "Work Finishes", "Turbine Leave", "Hotel Arrive", "Custom",
];

function formatLongDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const opts = sameYear
    ? { weekday: "long", day: "numeric", month: "long" }
    : { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  return d.toLocaleDateString("en-GB", opts);
}

function getNowTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getThisWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function formatMinutes(mins) {
  if (mins == null || mins <= 0) return "0h 0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Smart time parser: accepts "1300", "13:00", "13.00", "1:00", "800" etc.
function parseSmartTime(raw) {
  if (!raw) return "";
  const cleaned = raw.replace(/[^0-9]/g, "");
  if (cleaned.length === 0) return "";
  let h, m;
  if (cleaned.length <= 2) {
    h = parseInt(cleaned, 10);
    m = 0;
  } else if (cleaned.length === 3) {
    h = parseInt(cleaned[0], 10);
    m = parseInt(cleaned.slice(1), 10);
  } else {
    h = parseInt(cleaned.slice(0, cleaned.length - 2), 10);
    m = parseInt(cleaned.slice(-2), 10);
  }
  if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <line x1="3" y1="3" x2="13" y2="13" />
    <line x1="13" y1="3" x2="3" y2="13" />
  </svg>
);

function JobLogPage({ items, project, projects, jobHistory, timesheets, setTimesheets, onSubmitJob, onEditJob, onDeleteJob, onUpdateDamage }) {
  const today = new Date().toISOString().slice(0, 10);
  const formRef = useRef(null);
  const successTimerRef = useRef(null);
  const hoursInputRefs = useRef({});
  const location = useLocation();

  // ── Form state ────────────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [formProjectId, setFormProjectId] = useState(project?.id || null);
  const [selectedTurbineId, setSelectedTurbineId] = useState(null);
  const [selectedBladeId, setSelectedBladeId] = useState(null);
  const [selectedBladeIds, setSelectedBladeIds] = useState([]); // #13 multi-blade
  const [multiBladeMode, setMultiBladeMode] = useState(false); // #13
  const [selectedDamageId, setSelectedDamageId] = useState(null);
  const [chipOps, setChipOps] = useState({});
  const [opNotes, setOpNotes] = useState({}); // #6 per-operation notes
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [technician, setTechnician] = useState(() => {
    try { return localStorage.getItem("vetra-last-technician") || ""; } catch { return ""; }
  });
  const [accessMethod, setAccessMethod] = useState(() => {
    try { return localStorage.getItem("vetra-last-access-method") || ""; } catch { return ""; }
  });
  const [weather, setWeather] = useState({ windSpeed: "", temp: "", condition: "" });
  const [notes, setNotes] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState([]);
  const [matSearchTerms, setMatSearchTerms] = useState({});
  const [matDropdownOpen, setMatDropdownOpen] = useState({});
  const [editingJobId, setEditingJobId] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [successMessage, setSuccessMessage] = useState("");
  const [undoJob, setUndoJob] = useState(null); // #11 undo after submit
  const [deletingJobId, setDeletingJobId] = useState(null); // #2 two-step delete
  const [highlightedJobId, setHighlightedJobId] = useState(null);
  const [activeTab, setActiveTab] = useState("logwork");
  const [historyTurbineFilter, setHistoryTurbineFilter] = useState("All");
  const [historyDateFilter, setHistoryDateFilter] = useState("All");
  const [historyDamageFilter, setHistoryDamageFilter] = useState(null);
  const [tsWeekView, setTsWeekView] = useState(false); // #10 weekly timesheet

  // ── Timesheet state ────────────────────────────────────────────────────────
  const [timesheetDate, setTimesheetDate] = useState(today);
  const [timesheetOpen, setTimesheetOpen] = useState(true);
  const [customActivity, setCustomActivity] = useState("");

  // ── Persistent state ──────────────────────────────────────────────────────
  const [expandedDates, setExpandedDates] = useState(() => {
    try {
      const stored = localStorage.getItem("vetra-expanded-dates");
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    if (jobHistory.length === 0) return new Set();
    const mostRecent = [...jobHistory].sort((a, b) => b.date.localeCompare(a.date))[0].date;
    return new Set([mostRecent]);
  });
  useEffect(() => {
    localStorage.setItem("vetra-expanded-dates", JSON.stringify([...expandedDates]));
  }, [expandedDates]);

  // ── Selections ────────────────────────────────────────────────────────────
  const activeProjects = (projects || []).filter((p) => p.status !== "archived");
  const formProject = (projects || []).find((p) => p.id === formProjectId) || null;

  // Keep formProjectId in sync when active project changes (and form not open)
  useEffect(() => {
    if (!isFormOpen && project?.id) setFormProjectId(project.id);
  }, [project?.id, isFormOpen]);

  // Auto-select if only one project
  useEffect(() => {
    if (!formProjectId && activeProjects.length === 1) {
      setFormProjectId(activeProjects[0].id);
    }
  }, [formProjectId, activeProjects]);

  // ── Handle navigation state (from standalone dashboard "Log Work") ────────
  useEffect(() => {
    if (location.state?.prefillTurbineId) {
      if (location.state.prefillProjectId) setFormProjectId(location.state.prefillProjectId);
      setSelectedTurbineId(location.state.prefillTurbineId);
      setSelectedBladeId(location.state.prefillBladeId || null);
      setSelectedDamageId(location.state.prefillDamageId || null);
      setIsFormOpen(true);
      setActiveTab("logwork");
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleDate = (d) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };
  const selectedTurbine = formProject?.turbines?.find((t) => t.id === selectedTurbineId);
  const selectedBlade = selectedTurbine?.blades?.find((b) => b.id === selectedBladeId);
  const selectedDamage = selectedBlade?.damages?.find((d) => d.id === selectedDamageId);

  // ── Form open/close/reset ─────────────────────────────────────────────────
  const resetFormFields = () => {
    setFormProjectId(project?.id || null);
    setSelectedTurbineId(null);
    setSelectedBladeId(null);
    setSelectedBladeIds([]);
    setMultiBladeMode(false);
    setSelectedDamageId(null);
    setChipOps({});
    setOpNotes({});
    setMaterialsUsed([]);
    setNotes("");
    setTechnician(() => { try { return localStorage.getItem("vetra-last-technician") || ""; } catch { return ""; } });
    setAccessMethod(() => { try { return localStorage.getItem("vetra-last-access-method") || ""; } catch { return ""; } });
    setWeather({ windSpeed: "", temp: "", condition: "" });
    setFormErrors([]);
    setShowOptionalDetails(false);
    setEditingJobId(null);
    setDate(today);
    localStorage.removeItem("vetra-job-draft");
  };

  const openForm = (prefillDate) => {
    resetFormFields();
    // #5 — try to restore draft
    const hasDraft = localStorage.getItem("vetra-job-draft");
    if (hasDraft && !prefillDate) {
      restoreDraft();
    } else if (prefillDate) {
      setDate(prefillDate);
    }
    setIsFormOpen(true);
    setActiveTab("logwork");
    setTimeout(() => formRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    resetFormFields();
  };

  // #5 — Auto-save form draft
  useEffect(() => {
    if (!isFormOpen || editingJobId) return;
    const hasContent = selectedTurbineId || selectedBladeId || Object.keys(chipOps).length > 0;
    if (!hasContent) return;
    const draft = { date, formProjectId, selectedTurbineId, selectedBladeId, selectedDamageId, chipOps, opNotes, technician, accessMethod, weather, notes, materialsUsed };
    try { localStorage.setItem("vetra-job-draft", JSON.stringify(draft)); } catch {}
  }, [isFormOpen, editingJobId, date, formProjectId, selectedTurbineId, selectedBladeId, selectedDamageId, chipOps, opNotes, technician, accessMethod, weather, notes, materialsUsed]);

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem("vetra-job-draft");
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.formProjectId) setFormProjectId(d.formProjectId);
      if (d.selectedTurbineId) setSelectedTurbineId(d.selectedTurbineId);
      if (d.selectedBladeId) setSelectedBladeId(d.selectedBladeId);
      if (d.selectedDamageId) setSelectedDamageId(d.selectedDamageId);
      if (d.chipOps) setChipOps(d.chipOps);
      if (d.opNotes) setOpNotes(d.opNotes);
      if (d.date) setDate(d.date);
      if (d.technician) setTechnician(d.technician);
      if (d.accessMethod) setAccessMethod(d.accessMethod);
      if (d.weather) setWeather(d.weather);
      if (d.notes) setNotes(d.notes);
      if (d.materialsUsed?.length) setMaterialsUsed(d.materialsUsed);
      if (d.technician || d.accessMethod || d.notes || (d.weather && (d.weather.windSpeed || d.weather.temp || d.weather.condition))) {
        setShowOptionalDetails(true);
      }
      localStorage.removeItem("vetra-job-draft");
      return true;
    } catch { return false; }
  };

  const prefillFromJob = (job) => {
    const newChipOps = {};
    const newOpNotes = {};
    (job.operations || []).forEach((op) => {
      newChipOps[op.type] = { hours: String(op.duration || "") };
      if (op.notes) newOpNotes[op.type] = op.notes;
    });
    setChipOps(newChipOps);
    setOpNotes(newOpNotes);
    setDate(job.date || today);
    setFormProjectId(job.projectId || project?.id || null);
    setSelectedTurbineId(job.turbineId || null);
    setSelectedBladeId(job.bladeId || null);
    setSelectedDamageId(job.damageId || null);
    setTechnician(job.technician || "");
    setAccessMethod(job.accessMethod || "");
    setWeather(job.weather || { windSpeed: "", temp: "", condition: "" });
    setNotes(job.notes || "");
    setMaterialsUsed(
      (job.materials || []).map((m) => ({ ...m, id: m.id || Date.now() + Math.random() }))
    );
    setIsFormOpen(true);
    setEditingJobId(job.id);
    setFormErrors([]);
    setActiveTab("logwork");
    // Auto-expand optional details if the job had any filled in
    if (job.technician || job.accessMethod || (job.weather && (job.weather.windSpeed || job.weather.temp || job.weather.condition)) || job.notes) {
      setShowOptionalDetails(true);
    }
    setTimeout(() => formRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  // ── Chip ops ──────────────────────────────────────────────────────────────
  const toggleChip = (opType) => {
    setChipOps((prev) => {
      if (prev[opType]) {
        const next = { ...prev };
        delete next[opType];
        setOpNotes((pn) => { const n = { ...pn }; delete n[opType]; return n; });
        return next;
      }
      return { ...prev, [opType]: { hours: "" } };
    });
  };

  const setChipHours = (opType, val) => {
    setChipOps((prev) => ({ ...prev, [opType]: { ...(prev[opType] || {}), hours: val } }));
  };

  // ── Materials ─────────────────────────────────────────────────────────────
  const handleAddMaterialRow = () => {
    setMaterialsUsed((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), itemId: items[0]?.id || null, amount: "", batch: "" },
    ]);
  };

  const handleUpdateRow = (rowId, field, value) => {
    setMaterialsUsed((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const handleRemoveRow = (rowId) => {
    setMaterialsUsed((prev) => prev.filter((row) => row.id !== rowId));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = [];
    if (!formProjectId) errors.push("Please select a project.");
    if (!selectedTurbineId) errors.push("Please select a turbine.");
    // #13 multi-blade: validate at least one blade
    if (multiBladeMode) {
      if (selectedBladeIds.length === 0) errors.push("Please select at least one blade.");
    } else {
      if (!selectedBladeId) errors.push("Please select a blade.");
    }
    const activeOps = Object.entries(chipOps);
    if (activeOps.length === 0) errors.push("Select at least one operation.");
    activeOps.forEach(([opName, v]) => {
      if (!v.hours || Number(v.hours) <= 0) {
        errors.push(`Please enter hours for ${opName}.`);
      }
    });
    if (errors.length > 0) { setFormErrors(errors); return; }
    setFormErrors([]);

    const turbine = formProject?.turbines?.find((t) => t.id === selectedTurbineId);

    const operationsPayload = activeOps.map(([type, v]) => ({
      id: Date.now() + Math.random(),
      type,
      duration: v.hours,
      notes: opNotes[type] || "", // #6 per-operation notes
      materials: [],
    }));

    const parsedMaterials = materialsUsed
      .map((row) => {
        const amountNum = Number(row.amount);
        if (!row.itemId || isNaN(amountNum) || amountNum <= 0) return null;
        return { itemId: Number(row.itemId), amount: amountNum, batch: (row.batch || "").trim() };
      })
      .filter(Boolean);

    // #13 multi-blade: build list of blades to submit for
    const bladeIdsToSubmit = multiBladeMode ? selectedBladeIds : (selectedBladeId ? [selectedBladeId] : []);
    const submittedJobs = [];

    bladeIdsToSubmit.forEach((bId, idx) => {
      const blade = turbine?.blades?.find((b) => b.id === bId);
      // For multi-blade, skip damage selection (different blades have different damages)
      const dmgId = multiBladeMode ? null : selectedDamageId;
      const damage = blade?.damages?.find((d) => d.id === dmgId);

      const job = {
        id: editingJobId || Date.now() + Math.random() + idx,
        projectId: formProject?.id || null,
        projectName: formProject?.name || "",
        date,
        turbineId: selectedTurbineId,
        bladeId: bId,
        damageId: dmgId || null,
        turbine: turbine?.name || "",
        bladeRef: blade?.name || "",
        damage: damage
          ? { number: damage.number, type: damage.type, radius: damage.radius || "", locations: damage.locations || [], notes: damage.notes || "" }
          : null,
        technician: technician.trim(),
        accessMethod,
        weather: (weather.windSpeed || weather.temp || weather.condition) ? { ...weather } : null,
        notes: notes.trim(),
        operations: operationsPayload.map((op) => ({ ...op, id: Date.now() + Math.random() })),
        materials: idx === 0 ? parsedMaterials : [], // only deduct materials once
      };

      const wasEditing = !!editingJobId;
      if (wasEditing && idx === 0) {
        const oldJob = jobHistory.find((j) => j.id === editingJobId);
        if (oldJob) onEditJob(oldJob, job);
      } else {
        onSubmitJob(job);
      }
      submittedJobs.push(job);
    });

    const firstJob = submittedJobs[0];
    setExpandedDates((prev) => new Set([...prev, date]));
    setHighlightedJobId(firstJob?.id);
    setTimeout(() => setHighlightedJobId(null), 2500);

    // #11 — undo support (only for new jobs, not edits)
    const wasEditing = !!editingJobId;
    if (!wasEditing && submittedJobs.length > 0) {
      setUndoJob(submittedJobs);
    }

    // Persist last-used technician & access method as presets
    try {
      if (technician.trim()) localStorage.setItem("vetra-last-technician", technician.trim());
      if (accessMethod) localStorage.setItem("vetra-last-access-method", accessMethod);
    } catch {}

    closeForm();
    const count = submittedJobs.length;
    setSuccessMessage(wasEditing ? "Job updated \u2713" : count > 1 ? `${count} jobs logged \u2713` : "Job logged \u2713");
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => { setSuccessMessage(""); setUndoJob(null); }, 5000);
    if (!wasEditing) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  };

  // #11 — Undo last submission
  const handleUndo = () => {
    if (!undoJob || !onDeleteJob) return;
    undoJob.forEach((job) => onDeleteJob(job));
    setUndoJob(null);
    setSuccessMessage("Job undone");
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMessage(""), 2000);
  };

  // #2 — Delete job with two-step confirmation
  const handleDeleteJob = (job) => {
    if (deletingJobId === job.id) {
      if (onDeleteJob) onDeleteJob(job);
      setDeletingJobId(null);
      setSuccessMessage("Job deleted");
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(""), 2000);
    } else {
      setDeletingJobId(job.id);
      setTimeout(() => setDeletingJobId((prev) => prev === job.id ? null : prev), 3000);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const todayJobs = jobHistory.filter((j) => j.date === today);
  const todayHours = todayJobs.reduce(
    (sum, j) => sum + (j.operations || []).reduce((s, op) => s + (parseFloat(op.duration) || 0), 0), 0
  );

  const turbineNames = [...new Set(jobHistory.map((j) => j.turbine).filter(Boolean))];
  const weekStart = getThisWeekStart();

  const hasAnyProject = activeProjects.some((p) => p.turbines && p.turbines.length > 0);

  // ── Last used project ID (most recent job's projectId) ──────────────────
  const lastUsedProjectId = useMemo(() => {
    if (jobHistory.length === 0) return null;
    const sorted = [...jobHistory].sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.id || 0) - (a.id || 0);
    });
    return sorted[0]?.projectId || null;
  }, [jobHistory]);

  // ── Per-damage stats from job history ───────────────────────────────────
  const damageStats = useMemo(() => {
    const stats = {};
    jobHistory.forEach((j) => {
      if (!j.damageId) return;
      if (!stats[j.damageId]) {
        stats[j.damageId] = {
          totalHours: 0, jobCount: 0, lastDate: null,
          operations: new Set(), materialCount: 0,
          daysWorked: new Set(), jobs: [],
        };
      }
      const s = stats[j.damageId];
      s.jobCount++;
      s.jobs.push(j);
      if (j.date) s.daysWorked.add(j.date);
      if (!s.lastDate || j.date > s.lastDate) s.lastDate = j.date;
      (j.operations || []).forEach((op) => {
        s.totalHours += parseFloat(op.duration) || 0;
        s.operations.add(op.type);
      });
      s.materialCount += (j.materials || []).length;
    });
    // Sort jobs by date descending
    Object.values(stats).forEach((s) => {
      s.jobs.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id || 0) - (a.id || 0));
    });
    return stats;
  }, [jobHistory]);

  // ── Suggested next operations for selected damage ──────────────────────
  const suggestedOps = useMemo(() => {
    if (!selectedDamageId) return new Set();
    const ds = damageStats[selectedDamageId];
    if (!ds || ds.operations.size === 0) {
      // No history — suggest first step
      return new Set([OPERATION_WORKFLOW[0]]);
    }
    const doneOps = ds.operations;
    const suggestions = new Set();
    // Find the last done op in workflow and suggest next
    let lastIdx = -1;
    OPERATION_WORKFLOW.forEach((op, i) => {
      if (doneOps.has(op) && i > lastIdx) lastIdx = i;
    });
    if (lastIdx >= 0 && lastIdx < OPERATION_WORKFLOW.length - 1) {
      suggestions.add(OPERATION_WORKFLOW[lastIdx + 1]);
    }
    // Multi-pass ops: suggest again if done in last job
    const lastJob = ds.jobs[0];
    if (lastJob) {
      (lastJob.operations || []).forEach((op) => {
        if (MULTI_PASS_OPS.has(op.type)) suggestions.add(op.type);
      });
    }
    return suggestions;
  }, [selectedDamageId, damageStats]);

  // ── Project metadata helper ─────────────────────────────────────────────
  const getProjectMeta = (p) => {
    let turbineCount = 0, bladeCount = 0, damageCount = 0;
    (p.turbines || []).forEach((t) => {
      turbineCount++;
      (t.blades || []).forEach((b) => {
        bladeCount++;
        damageCount += (b.damages || []).length;
      });
    });
    return { turbineCount, bladeCount, damageCount };
  };

  // ── Repeat last job handler ─────────────────────────────────────────────
  const lastJob = useMemo(() => {
    if (jobHistory.length === 0) return null;
    return [...jobHistory].sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.id || 0) - (a.id || 0);
    })[0];
  }, [jobHistory]);

  const handleRepeatLast = () => {
    if (!lastJob) return;
    handleRepeatJob(lastJob);
  };

  // #7 — Repeat a specific job from history
  const handleRepeatJob = (job) => {
    const newChipOps = {};
    const newOpNotes = {};
    (job.operations || []).forEach((op) => {
      newChipOps[op.type] = { hours: "" };
      if (op.notes) newOpNotes[op.type] = op.notes;
    });
    setChipOps(newChipOps);
    setOpNotes(newOpNotes);
    setDate(today);
    setFormProjectId(job.projectId || project?.id || null);
    setSelectedTurbineId(job.turbineId || null);
    setSelectedBladeId(job.bladeId || null);
    setSelectedBladeIds([]);
    setMultiBladeMode(false);
    setSelectedDamageId(job.damageId || null);
    setTechnician(job.technician || "");
    setAccessMethod(job.accessMethod || "");
    setWeather(job.weather || { windSpeed: "", temp: "", condition: "" });
    setNotes("");
    setMaterialsUsed([]);
    setEditingJobId(null);
    setFormErrors([]);
    setIsFormOpen(true);
    setActiveTab("logwork");
    if (job.technician || job.accessMethod || (job.weather && (job.weather.windSpeed || job.weather.temp || job.weather.condition))) {
      setShowOptionalDetails(true);
    } else {
      setShowOptionalDetails(false);
    }
    setTimeout(() => formRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  // ── Batch suggestions (autocomplete from previous jobs) ─────────────────
  const batchSuggestions = useMemo(() => {
    const map = {};
    jobHistory.forEach((job) => {
      (job.materials || []).forEach((m) => {
        if (m.batch) {
          const key = String(m.itemId);
          if (!map[key]) map[key] = new Set();
          map[key].add(m.batch);
        }
      });
    });
    const result = {};
    Object.entries(map).forEach(([k, s]) => {
      result[k] = [...s].sort();
    });
    return result;
  }, [jobHistory]);

  // ── Timesheet logic ────────────────────────────────────────────────────────
  const currentTimesheet = useMemo(() => {
    return (timesheets || []).find((ts) => ts.date === timesheetDate) || null;
  }, [timesheets, timesheetDate]);

  const addTimesheetEntry = (time, activity) => {
    setTimesheets((prev) => {
      const sheets = [...(prev || [])];
      const idx = sheets.findIndex((ts) => ts.date === timesheetDate);
      const entry = { id: Date.now() + Math.random(), time, activity };
      if (idx >= 0) {
        const updated = { ...sheets[idx], entries: [...sheets[idx].entries, entry].sort((a, b) => a.time.localeCompare(b.time)) };
        sheets[idx] = updated;
      } else {
        sheets.push({
          id: Date.now() + Math.random(),
          date: timesheetDate,
          projectId: project?.id || null,
          entries: [entry],
        });
      }
      return sheets;
    });
  };

  const removeTimesheetEntry = (entryId) => {
    setTimesheets((prev) => {
      return (prev || []).map((ts) => {
        if (ts.date !== timesheetDate) return ts;
        const filtered = ts.entries.filter((e) => e.id !== entryId);
        return { ...ts, entries: filtered };
      }).filter((ts) => ts.entries.length > 0);
    });
  };

  const updateTimesheetEntry = (entryId, field, value) => {
    setTimesheets((prev) => {
      return (prev || []).map((ts) => {
        if (ts.date !== timesheetDate) return ts;
        const updated = ts.entries.map((e) => e.id === entryId ? { ...e, [field]: value } : e);
        return { ...ts, entries: updated.sort((a, b) => a.time.localeCompare(b.time)) };
      });
    });
  };

  const timesheetTotals = useMemo(() => {
    if (!currentTimesheet || currentTimesheet.entries.length === 0) {
      return { totalDay: 0, normal: 0, overtime: 0, onSite: 0, productive: 0, travel: 0, breakTime: 0 };
    }
    const entries = currentTimesheet.entries;
    const findTime = (activity) => {
      const e = entries.find((en) => en.activity === activity);
      return e ? parseTimeToMinutes(e.time) : null;
    };

    const arrive = findTime("Arrive Turbine");
    const leave = findTime("Turbine Leave");
    const hotelLeave = findTime("Hotel Leave");
    const hotelArrive = findTime("Hotel Arrive");

    // Total day = Hotel Leave → Hotel Arrive (entire working day including travel)
    const totalDay = (hotelLeave != null && hotelArrive != null && hotelArrive > hotelLeave) ? hotelArrive - hotelLeave : 0;

    const NORMAL_HOURS = 8 * 60; // 480 minutes
    const normal = Math.min(totalDay, NORMAL_HOURS);
    const overtime = Math.max(0, totalDay - NORMAL_HOURS);

    const onSite = (arrive != null && leave != null && leave > arrive) ? leave - arrive : 0;

    // Break time
    let breakTime = 0;
    const breakStarts = entries.filter((e) => e.activity === "Break Start").map((e) => parseTimeToMinutes(e.time)).filter((t) => t != null);
    const breakEnds = entries.filter((e) => e.activity === "Break End").map((e) => parseTimeToMinutes(e.time)).filter((t) => t != null);
    for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
      if (breakEnds[i] > breakStarts[i]) breakTime += breakEnds[i] - breakStarts[i];
    }

    const productive = Math.max(0, onSite - breakTime);

    let travel = 0;
    if (hotelLeave != null && arrive != null && arrive > hotelLeave) travel += arrive - hotelLeave;
    if (leave != null && hotelArrive != null && hotelArrive > leave) travel += hotelArrive - leave;

    return { totalDay, normal, overtime, onSite, productive, travel, breakTime };
  }, [currentTimesheet]);

  // ── Damage summary ────────────────────────────────────────────────────────
  const damageSummary = useMemo(() => {
    if (!project) return { total: 0, complete: 0, inprogress: 0, notstarted: 0 };
    let total = 0, complete = 0, inprogress = 0, notstarted = 0;
    (project.turbines || []).forEach((turbine) => {
      (turbine.blades || []).forEach((blade) => {
        (blade.damages || []).forEach((d) => {
          total++;
          const status = d.status || "notstarted";
          if (status === "complete") complete++;
          else if (status === "inprogress") inprogress++;
          else notstarted++;
        });
      });
    });
    return { total, complete, inprogress, notstarted };
  }, [project]);

  // ── Renderers ─────────────────────────────────────────────────────────────

  const renderTodayGlance = () => (
    <div className="today-glance">
      <div className="tg-date">{formatLongDate(today)}</div>
      <div className="tg-summary">
        <span className="tg-hours">{todayHours.toFixed(1)} hrs</span>
        <span className="tg-sep">&middot;</span>
        <span className="tg-jobs">{todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""} logged</span>
      </div>
      {todayJobs.length === 0 ? (
        <p className="tg-empty">No work logged today.</p>
      ) : (
        <div className="tg-job-list">
          {todayJobs.map((job) => (
            <button
              key={job.id}
              type="button"
              className="tg-job-card tg-job-card-clickable"
              onClick={() => prefillFromJob(job)}
            >
              <div className="tg-job-card-top">
                <div className="tg-job-label">
                  {job.turbine}{job.bladeRef ? ` \u00b7 ${job.bladeRef}` : ""}{job.damage ? ` \u00b7 ${job.damage.number}` : ""}
                </div>
                <span className="tg-job-edit-hint">Edit</span>
              </div>
              <div className="tg-job-ops">
                {(job.operations || []).map((op, i) => (
                  <span key={i} className="op-badge">{op.type}{op.duration ? ` \u00b7 ${op.duration}h` : ""}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="tg-actions">
        <button type="button" className="primary-button tg-log-btn" onClick={() => openForm()}>
          + Log Work
        </button>
        <button type="button" className="secondary-button" onClick={() => openForm(getYesterday())}
          title="Opens the job form with yesterday's date pre-filled">
          + Log for Yesterday
        </button>
        {lastJob && (
          <button type="button" className="secondary-button" onClick={handleRepeatLast}
            title={`Repeat: ${lastJob.turbine} · ${lastJob.bladeRef || ""}${lastJob.damage ? ` · ${lastJob.damage.number}` : ""}`}>
            Repeat Last
          </button>
        )}
      </div>
    </div>
  );

  const renderDamageCards = () => {
    const damages = selectedBlade?.damages || [];
    if (damages.length === 0)
      return <p className="empty-state small">No damages configured for this blade. Add damages in Project Setup.</p>;
    return (
      <div className="damage-card-grid">
        {damages.map((d) => {
          const sev = (d.severity || "").toLowerCase();
          const isSelected = selectedDamageId === d.id;
          const ds = damageStats[d.id];
          const estimatedH = parseFloat(d.estimatedHours) || 0;
          const loggedH = ds ? ds.totalHours : 0;
          const pct = estimatedH > 0 ? Math.min(100, Math.round((loggedH / estimatedH) * 100)) : 0;
          const status = d.status || "notstarted";
          return (
            <div key={d.id} className="damage-select-card-wrap">
              <button
                type="button"
                className={`damage-select-card${isSelected ? " damage-select-card-active" : ""}`}
                onClick={() => setSelectedDamageId(d.id)}
              >
                <div className="dsc-top">
                  <span className="dsc-id">{d.number} — {d.type}</span>
                  <div className="dsc-top-right">
                    <span className={`dsc-status-dot dsc-status-${status}`} title={status} />
                    {sev && <span className={`sev-badge sev-${sev}`}>{sev.toUpperCase()}</span>}
                  </div>
                </div>
                {(d.radius || (d.locations && d.locations.length > 0)) && (
                  <div className="dsc-sub">
                    {[d.radius ? `${d.radius}mm` : "", (d.locations || []).join(", ")].filter(Boolean).join(" \u00b7 ")}
                  </div>
                )}
                {ds && (
                  <>
                    <div className="dsc-progress">
                      <span className="dsc-hours-text">
                        {loggedH.toFixed(1)}{estimatedH > 0 ? ` / ${estimatedH}` : ""} hrs
                      </span>
                      {estimatedH > 0 && (
                        <div className="dsc-progress-bar">
                          <div className="dsc-progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="dsc-meta">
                      <span className="dsc-meta-item">Last: {ds.lastDate}</span>
                      <span className="dsc-meta-item">{ds.jobCount} {ds.jobCount === 1 ? "entry" : "entries"}</span>
                    </div>
                    {ds.operations.size > 0 && (
                      <div className="dsc-ops">
                        {[...ds.operations].map((op) => (
                          <span key={op} className="dsc-op-badge">{op}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </button>
              {onUpdateDamage && (
                <div className="dsc-status-row">
                  {["notstarted", "inprogress", "complete"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`dsc-status-btn dsc-status-${s}${status === s ? " dsc-status-active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const turbine = formProject?.turbines?.find((t) => t.id === selectedTurbineId);
                        const blade = turbine?.blades?.find((b) => b.id === selectedBladeId);
                        if (turbine && blade) {
                          onUpdateDamage(turbine.id, blade.id, d.id, { status: s });
                        }
                      }}
                      aria-pressed={status === s}
                    >
                      {s === "notstarted" ? "○" : s === "inprogress" ? "⚡" : "✓"} {s === "notstarted" ? "Not Started" : s === "inprogress" ? "In Progress" : "Complete"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderChipGrid = () => (
    <div className="op-chip-grid">
      {OPERATION_TYPES.map((opType) => {
        const active = !!chipOps[opType];
        const hasError = active && formErrors.some((e) => e.includes(opType));
        const isSuggested = !active && suggestedOps.has(opType);
        return (
          <div key={opType} className="op-chip-row">
            <button
              type="button"
              className={`op-chip${active ? " op-chip-active" : ""}${isSuggested ? " op-chip-suggested" : ""}`}
              onClick={() => toggleChip(opType)}
            >
              {active && <span className="op-chip-check" aria-hidden="true">&#10003;</span>}
              {isSuggested && <span className="op-chip-suggest-hint" aria-hidden="true">&#9733;</span>}
              {opType}
            </button>
            {active && (
              <>
                <div className="op-chip-hours-wrap">
                  <input
                    type="number"
                    className={`op-chip-hours${hasError ? " op-chip-hours-error" : ""}`}
                    step="0.5"
                    min="0"
                    max="24"
                    value={chipOps[opType].hours}
                    onChange={(e) => setChipHours(opType, e.target.value)}
                    ref={(el) => {
                      const key = opType;
                      if (el && !el._wheelBound) {
                        el._wheelBound = true;
                        el.addEventListener("wheel", (ev) => {
                          ev.preventDefault();
                          const cur = parseFloat(el.value) || 0;
                          const delta = ev.deltaY < 0 ? 0.5 : -0.5;
                          const next = Math.min(24, Math.max(0, cur + delta));
                          setChipHours(key, String(next));
                        }, { passive: false });
                      }
                    }}
                    placeholder="e.g. 1.5"
                    aria-label={`${opType} hours`}
                  />
                  <span className="op-chip-hours-label">hours</span>
                </div>
                {/* #3 — Quick-set hours buttons */}
                <div className="op-quick-hours">
                  {[0.5, 1, 1.5, 2, 3, 4].map((h) => (
                    <button key={h} type="button" className="op-quick-hour-btn"
                      onClick={() => setChipHours(opType, String(h))}>{h}h</button>
                  ))}
                </div>
                {/* #6 — Per-operation notes */}
                <input
                  type="text"
                  className="op-chip-note"
                  value={opNotes[opType] || ""}
                  onChange={(e) => setOpNotes((prev) => ({ ...prev, [opType]: e.target.value }))}
                  placeholder="Note (optional)..."
                  aria-label={`${opType} note`}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderForm = () => {
    const stepProjectDone = !!formProjectId && !!formProject;
    const formTurbines = formProject?.turbines || [];
    const step1Done = !!selectedTurbineId;
    const step2Done = multiBladeMode ? selectedBladeIds.length > 0 : !!selectedBladeId;
    const step3Done = multiBladeMode ? step2Done : !!selectedDamageId;

    // Step progress indicator
    const steps = [
      { label: "Project", done: stepProjectDone },
      { label: "Turbine", done: step1Done },
      { label: "Blade", done: step2Done },
      { label: "Damage", done: step3Done },
      { label: "Operations", done: Object.keys(chipOps).length > 0 },
    ];
    const currentStepIdx = steps.findIndex((s) => !s.done);

    return (
      <form onSubmit={handleSubmit} className="jl-form-inner">
        {/* Header */}
        <div className="jl-form-header">
          <h2 className="jl-form-title">{editingJobId ? "Edit Job" : "New Job Entry"}</h2>
          <button type="button" className="jl-close-btn" onClick={closeForm} aria-label="Close form">
            <XIcon /> Close
          </button>
        </div>

        {/* Step progress strip */}
        <div className="step-progress-strip">
          {steps.map((s, i) => {
            const isCurrent = i === currentStepIdx;
            const isDone = s.done;
            return (
              <React.Fragment key={s.label}>
                {i > 0 && <div className={`step-progress-line${isDone || isCurrent ? " step-progress-line-active" : ""}`} />}
                <div className={`step-progress-item${isDone ? " step-done" : ""}${isCurrent ? " step-current" : ""}`}>
                  <span className={`step-progress-circle${isDone ? " step-progress-circle-done" : ""}${isCurrent ? " step-progress-circle-current" : ""}`}>
                    {isDone ? "\u2713" : i + 1}
                  </span>
                  <span className="step-progress-label">{s.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Date */}
        <div className="field jl-date-field">
          <label htmlFor="jl-date">Date</label>
          <input id="jl-date" type="date" className="jl-date-input" value={date}
            onChange={(e) => setDate(e.target.value)} />
        </div>

        {/* Steps */}
        <div className="selection-steps">
          {/* Step 0: Project */}
          <div className="selection-step">
            <p className="step-label">
              <span className={`step-num${stepProjectDone ? " step-num-done" : ""}`}>
                {stepProjectDone ? "\u2713" : "1"}
              </span>
              Project
            </p>
            {activeProjects.length >= 3 && (
              <input
                type="text"
                className="jl-project-search"
                placeholder="Search projects..."
                value={projectSearchTerm}
                onChange={(e) => setProjectSearchTerm(e.target.value)}
              />
            )}
            {(() => {
              const filteredProjects = projectSearchTerm.trim()
                ? activeProjects.filter((p) => {
                    const q = projectSearchTerm.toLowerCase();
                    return (p.name || "").toLowerCase().includes(q)
                      || (p.client || "").toLowerCase().includes(q)
                      || (p.windFarm || "").toLowerCase().includes(q);
                  })
                : activeProjects;
              const selectProject = (pid) => {
                setFormProjectId(pid);
                setSelectedTurbineId(null);
                setSelectedBladeId(null);
                setSelectedDamageId(null);
                setChipOps({});
                setFormErrors([]);
              };
              if (activeProjects.length === 1) {
                const p = activeProjects[0];
                const meta = getProjectMeta(p);
                return (
                  <div className="jl-project-grid jl-project-grid-single">
                    <div className="jl-project-card jl-project-card-active">
                      <div className="jl-project-card-name">{p.name}</div>
                      <span className={`status-badge-${(p.status || "notstarted").replace(/\s+/g, "")}`}>{(p.status || "not started").replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
                      <div className="jl-project-card-meta">
                        {meta.turbineCount} turbine{meta.turbineCount !== 1 ? "s" : ""} · {meta.bladeCount} blade{meta.bladeCount !== 1 ? "s" : ""} · {meta.damageCount} damage{meta.damageCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="jl-project-grid">
                  {filteredProjects.map((p) => {
                    const meta = getProjectMeta(p);
                    const isSelected = formProjectId === p.id;
                    const isLastUsed = p.id === lastUsedProjectId;
                    const daysLeft = p.plannedEndDate ? Math.ceil((new Date(p.plannedEndDate + "T00:00:00") - new Date()) / 86400000) : null;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`jl-project-card${isSelected ? " jl-project-card-active" : ""}`}
                        onClick={() => selectProject(p.id)}
                      >
                        <div className="jl-project-card-top-row">
                          <span className="jl-project-card-name">{p.name}</span>
                          {isLastUsed && <span className="jl-project-last-used">Last used</span>}
                        </div>
                        <span className={`status-badge-${(p.status || "notstarted").replace(/\s+/g, "")}`}>{(p.status || "not started").replace(/([a-z])([A-Z])/g, "$1 $2")}</span>
                        <div className="jl-project-card-meta">
                          {meta.turbineCount} turbine{meta.turbineCount !== 1 ? "s" : ""} · {meta.bladeCount} blade{meta.bladeCount !== 1 ? "s" : ""} · {meta.damageCount} damage{meta.damageCount !== 1 ? "s" : ""}
                        </div>
                        {(p.client || p.windFarm) && (
                          <div className="jl-project-card-detail">{[p.client, p.windFarm].filter(Boolean).join(" · ")}</div>
                        )}
                        {p.plannedEndDate && (
                          <div className="jl-project-card-detail">
                            End: {p.plannedEndDate}{daysLeft !== null && daysLeft >= 0 ? ` (${daysLeft}d left)` : daysLeft !== null ? " (overdue)" : ""}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Step 1: Turbine */}
          {stepProjectDone && (
            <div className="selection-step">
              <p className="step-label">
                <span className={`step-num${step1Done ? " step-num-done" : ""}`}>
                  {step1Done ? "\u2713" : "2"}
                </span>
                Turbine
              </p>
              <div className="pill-row">
                {formTurbines.map((t) => {
                  const tDmgCount = (t.blades || []).reduce((sum, b) => sum + (b.damages || []).length, 0);
                  return (
                    <button
                      key={t.id} type="button"
                      className={`pill-button${selectedTurbineId === t.id ? " pill-button-active" : ""}`}
                      onClick={() => {
                        setSelectedTurbineId(t.id);
                        setSelectedBladeId(null);
                        setSelectedDamageId(null);
                        setChipOps({});
                        setFormErrors([]);
                      }}
                    >
                      {t.name}
                      {tDmgCount > 0 && <span className="pill-button-badge">{tDmgCount}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Blade */}
          {step1Done && (
            <div className="selection-step">
              <div className="step-label-row">
                <p className="step-label">
                  <span className={`step-num${step2Done ? " step-num-done" : ""}`}>
                    {step2Done ? "\u2713" : "3"}
                  </span>
                  Blade
                </p>
                {/* #13 — Multi-blade toggle */}
                {!editingJobId && (selectedTurbine?.blades || []).length > 1 && (
                  <label className="multi-blade-toggle">
                    <input type="checkbox" checked={multiBladeMode}
                      onChange={(e) => {
                        setMultiBladeMode(e.target.checked);
                        if (e.target.checked) {
                          setSelectedBladeId(null);
                          setSelectedDamageId(null);
                          setSelectedBladeIds([]);
                        } else {
                          setSelectedBladeIds([]);
                        }
                      }} />
                    <span>All blades</span>
                  </label>
                )}
              </div>
              <div className="pill-row">
                {(selectedTurbine?.blades || []).map((b) => {
                  const bDmgCount = (b.damages || []).length;
                  const isActive = multiBladeMode
                    ? selectedBladeIds.includes(b.id)
                    : selectedBladeId === b.id;
                  return (
                    <button
                      key={b.id} type="button"
                      className={`pill-button${isActive ? " pill-button-active" : ""}`}
                      onClick={() => {
                        if (multiBladeMode) {
                          setSelectedBladeIds((prev) =>
                            prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]
                          );
                          setSelectedDamageId(null);
                        } else {
                          setSelectedBladeId(b.id);
                          setSelectedDamageId(null);
                          setChipOps({});
                          setFormErrors([]);
                        }
                      }}
                    >
                      {b.name}
                      {bDmgCount > 0 && <span className="pill-button-badge">{bDmgCount}</span>}
                    </button>
                  );
                })}
              </div>
              {multiBladeMode && selectedBladeIds.length > 0 && (
                <p className="multi-blade-hint">{selectedBladeIds.length} blade{selectedBladeIds.length !== 1 ? "s" : ""} selected — same operation will be logged for each</p>
              )}
            </div>
          )}

          {/* Step 3: Damage (skip in multi-blade mode) */}
          {step2Done && !multiBladeMode && (
            <div className="selection-step">
              <p className="step-label">
                <span className={`step-num${step3Done ? " step-num-done" : ""}`}>
                  {step3Done ? "\u2713" : "4"}
                </span>
                Damage
              </p>
              {renderDamageCards()}
              {step3Done && selectedDamage && damageStats[selectedDamage.id]?.jobs.length > 0 && (
                <div className="dsc-recent-activity">
                  <p className="dsc-recent-title">Recent Activity</p>
                  {damageStats[selectedDamage.id].jobs.slice(0, 3).map((j) => (
                    <div key={j.id} className="dsc-recent-entry">
                      <span className="dsc-recent-date">{j.date}</span>
                      <span className="dsc-recent-ops">
                        {(j.operations || []).map((op) =>
                          `${op.type} (${op.duration || 0}h)`
                        ).join(", ")}
                      </span>
                      {j.technician && <span className="dsc-recent-tech">{j.technician}</span>}
                    </div>
                  ))}
                </div>
              )}
              {step3Done && (
                <button
                  type="button"
                  className="dmg-history-link"
                  onClick={() => {
                    setHistoryDamageFilter({
                      turbineName: selectedTurbine?.name,
                      damageNumber: selectedDamage?.number,
                    });
                    setActiveTab("history");
                  }}
                >
                  View history for this damage &rarr;
                </button>
              )}
            </div>
          )}
        </div>

        {/* Operations area — only after damage selected */}
        {step3Done && (
          <>
            {/* Summary strip */}
            <div className="summary-strip">
              <span className="summary-strip-text">
                {multiBladeMode
                  ? `${formProject?.name} / ${selectedTurbine?.name} / ${selectedBladeIds.length} blades`
                  : <>
                      {formProject?.name} / {selectedTurbine?.name} / {selectedBlade?.name}
                      {selectedDamage && <> / {selectedDamage.number} — {selectedDamage.type}</>}
                      {selectedDamage?.radius ? ` — ${selectedDamage.radius}mm` : ""}
                      {selectedDamage?.locations?.length > 0 ? ` \u00b7 ${selectedDamage.locations.join(", ")}` : ""}
                      {selectedDamage?.severity ? ` [${selectedDamage.severity.toUpperCase()}]` : ""}
                    </>
                }
              </span>
              <button
                type="button"
                className="summary-strip-change"
                onClick={() => {
                  setSelectedTurbineId(null);
                  setSelectedBladeId(null);
                  setSelectedDamageId(null);
                  setChipOps({});
                }}
              >Change</button>
            </div>

            {selectedDamage && damageStats[selectedDamage.id] && (() => {
              const ds = damageStats[selectedDamage.id];
              const estH = parseFloat(selectedDamage.estimatedHours) || 0;
              const pct = estH > 0 ? Math.min(100, Math.round((ds.totalHours / estH) * 100)) : null;
              return (
                <div className="dsc-stats-banner">
                  <span className="dsc-stats-banner-item">
                    <span className="dsc-stats-banner-val">{ds.totalHours.toFixed(1)}{estH > 0 ? ` / ${estH}` : ""}</span> hrs
                  </span>
                  {pct !== null && (
                    <span className="dsc-stats-banner-item">
                      <span className="dsc-stats-banner-val">{pct}%</span> progress
                    </span>
                  )}
                  <span className="dsc-stats-banner-item">
                    <span className="dsc-stats-banner-val">{ds.materialCount}</span> materials
                  </span>
                  <span className="dsc-stats-banner-item">
                    <span className="dsc-stats-banner-val">{ds.daysWorked.size}</span> {ds.daysWorked.size === 1 ? "day" : "days"}
                  </span>
                  <span className="dsc-stats-banner-item">
                    <span className="dsc-stats-banner-val">{ds.jobCount}</span> {ds.jobCount === 1 ? "entry" : "entries"}
                  </span>
                </div>
              );
            })()}

            <div className="jl-ops-section">
              <h3 className="jl-section-label">Operations</h3>
              {renderChipGrid()}
            </div>

            {/* Materials — always visible */}
            <div className="materials-used jl-materials-section">
              <div className="materials-used-header">
                <h3 className="jl-section-label" style={{ margin: 0 }}>Materials</h3>
                <button type="button" className="secondary-button small"
                  onClick={handleAddMaterialRow} disabled={items.length === 0}>
                  + Add Material
                </button>
              </div>
              {materialsUsed.length === 0 ? (
                <p className="empty-state small">No materials added. Tap "+ Add Material" to log consumed materials.</p>
              ) : (
                <div className="materials-table">
                  {materialsUsed.map((row) => {
                    const selectedItem = items.find((it) => String(it.id) === String(row.itemId));
                    const unitLabel = selectedItem?.unit || "";
                    const stockQty = selectedItem?.quantity ?? 0;
                    const amountNum = Number(row.amount) || 0;
                    const overStock = amountNum > 0 && amountNum > stockQty;
                    // Group items by category
                    const searchTerm = (matSearchTerms[row.id] || "").toLowerCase();
                    const isDropOpen = !!matDropdownOpen[row.id];
                    const filteredItems = searchTerm
                      ? items.filter((it) => it.name.toLowerCase().includes(searchTerm) || (it.category || "").toLowerCase().includes(searchTerm))
                      : items;
                    const categories = [...new Set(filteredItems.map((it) => it.category || "Other"))].sort();
                    return (
                      <div key={row.id} className="materials-row">
                        <div className="mat-search-wrap">
                          <input
                            type="text"
                            className="mat-search-input"
                            value={isDropOpen ? (matSearchTerms[row.id] ?? "") : (selectedItem?.name || "")}
                            onChange={(e) => {
                              setMatSearchTerms((p) => ({ ...p, [row.id]: e.target.value }));
                              setMatDropdownOpen((p) => ({ ...p, [row.id]: true }));
                            }}
                            onFocus={() => {
                              setMatSearchTerms((p) => ({ ...p, [row.id]: "" }));
                              setMatDropdownOpen((p) => ({ ...p, [row.id]: true }));
                            }}
                            onBlur={() => setTimeout(() => setMatDropdownOpen((p) => ({ ...p, [row.id]: false })), 150)}
                            placeholder="Search materials..."
                            aria-label="Search materials"
                          />
                          {isDropOpen && (
                            <div className="mat-search-dropdown">
                              {filteredItems.length === 0 ? (
                                <div className="mat-search-empty">No matches</div>
                              ) : (
                                categories.map((cat) => (
                                  <div key={cat}>
                                    <div className="mat-search-cat">{cat}</div>
                                    {filteredItems.filter((it) => (it.category || "Other") === cat).map((item) => (
                                      <button
                                        key={item.id}
                                        type="button"
                                        className={`mat-search-option${String(item.id) === String(row.itemId) ? " mat-search-option-active" : ""}`}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleUpdateRow(row.id, "itemId", String(item.id));
                                          setMatDropdownOpen((p) => ({ ...p, [row.id]: false }));
                                          setMatSearchTerms((p) => ({ ...p, [row.id]: "" }));
                                        }}
                                      >
                                        {item.name} <span className="mat-search-meta">— {item.unit} ({item.quantity} avail)</span>
                                      </button>
                                    ))}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                        <div className="material-amount-wrap">
                          <input type="number" min="0" value={row.amount}
                            className={overStock ? "material-over-stock" : ""}
                            onChange={(e) => handleUpdateRow(row.id, "amount", e.target.value)}
                            placeholder="Qty" />
                          {unitLabel && <span className="material-unit-badge">{unitLabel}</span>}
                        </div>
                        {/* #4 — Stock availability indicator */}
                        {selectedItem && (
                          <span className={`material-stock-hint${overStock ? " material-stock-warn" : ""}`}>
                            {overStock ? `Only ${stockQty} in stock!` : `${stockQty} avail`}
                          </span>
                        )}
                        <input type="text" value={row.batch || ""}
                          onChange={(e) => handleUpdateRow(row.id, "batch", e.target.value)}
                          placeholder="Batch/Lot"
                          list={`batch-list-${row.id}`} />
                        <datalist id={`batch-list-${row.id}`}>
                          {(batchSuggestions[String(row.itemId)] || []).map((b) => (
                            <option key={b} value={b} />
                          ))}
                        </datalist>
                        <button type="button" className="delete-button small"
                          onClick={() => handleRemoveRow(row.id)}>Remove</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Optional details */}
            <div className="optional-details">
              <button
                type="button"
                className="optional-details-toggle"
                onClick={() => setShowOptionalDetails((p) => !p)}
              >
                <span>Optional Details</span>
                <ChevronIcon up={showOptionalDetails} />
              </button>
              {showOptionalDetails && (
                <div className="optional-details-body">
                  <div className="field">
                    <label>Technician(s)</label>
                    <input type="text" value={technician}
                      onChange={(e) => setTechnician(e.target.value)}
                      placeholder="e.g. J. Smith, A. Park" />
                  </div>
                  <div className="field">
                    <label>Access Method</label>
                    <select value={accessMethod} onChange={(e) => setAccessMethod(e.target.value)}
                      onWheel={(e) => { e.preventDefault(); e.target.blur(); }}>
                      <option value="">— Select —</option>
                      {ACCESS_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="weather-row">
                    <div className="field">
                      <label>Wind Speed (m/s)</label>
                      <input type="number" min="0" value={weather.windSpeed}
                        onChange={(e) => setWeather((w) => ({ ...w, windSpeed: e.target.value }))}
                        onWheel={(e) => { e.preventDefault(); e.target.blur(); }}
                        placeholder="e.g. 8" />
                    </div>
                    <div className="field">
                      <label>Temperature (&deg;C)</label>
                      <input type="number" value={weather.temp}
                        onChange={(e) => setWeather((w) => ({ ...w, temp: e.target.value }))}
                        onWheel={(e) => { e.preventDefault(); e.target.blur(); }}
                        placeholder="e.g. 14" />
                    </div>
                    <div className="field">
                      <label>Condition</label>
                      <select value={weather.condition}
                        onChange={(e) => setWeather((w) => ({ ...w, condition: e.target.value }))}
                        onWheel={(e) => { e.preventDefault(); e.target.blur(); }}>
                        <option value="">— Select —</option>
                        {WEATHER_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label>Notes</label>
                    <textarea rows="2" value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Damage summary, access issues, observations..." />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {formErrors.length > 0 && (
          <div className="form-error-list" role="alert">
            {formErrors.map((err, i) => (
              <p key={i} className="form-error-item">{err}</p>
            ))}
          </div>
        )}

        {/* Sticky submit footer */}
        <div className="jl-sticky-submit">
          <button type="submit" className="primary-button jl-submit-btn">
            {editingJobId ? "Save Changes" : "Submit Job"}
          </button>
          <button type="button" className="secondary-button" onClick={resetFormFields}>
            Reset
          </button>
        </div>
      </form>
    );
  };

  const renderTimesheet = () => {
    const entries = currentTimesheet?.entries || [];
    // Which activities already have entries
    const usedActivities = new Set(entries.map((e) => e.activity));

    // Jobs logged for the same date as the timesheet
    const dayJobs = jobHistory.filter((j) => j.date === timesheetDate);
    const dayJobHours = dayJobs.reduce(
      (sum, j) => sum + (j.operations || []).reduce((s, op) => s + (parseFloat(op.duration) || 0), 0), 0
    );

    return (
      <div className="ts-section">
        <div className="ts-header">
          <div className="ts-header-left">
            <h2 className="section-panel-title">Daily Timesheet</h2>
            <input
              type="date"
              className="ts-date-input"
              value={timesheetDate}
              onChange={(e) => setTimesheetDate(e.target.value)}
            />
          </div>
          <div className="ts-header-right">
            {/* #10 — Week view toggle */}
            <button type="button"
              className={`ts-week-toggle${tsWeekView ? " ts-week-toggle-active" : ""}`}
              onClick={() => setTsWeekView((p) => !p)}>
              {tsWeekView ? "Day" : "Week"}
            </button>
            <button
              type="button"
              className="section-panel-collapse-btn"
              onClick={() => setTimesheetOpen((p) => !p)}
              aria-label={timesheetOpen ? "Collapse timesheet" : "Expand timesheet"}
            >
              <ChevronIcon up={timesheetOpen} />
            </button>
          </div>
        </div>

        {/* Collapsed summary — show hours check inline */}
        {!timesheetOpen && dayJobs.length > 0 && (() => {
          const entries = currentTimesheet?.entries || [];
          const loggedMins = Math.round(dayJobHours * 60);
          const hasTimesheet = entries.length > 0 && timesheetTotals.productive > 0;
          const diff = hasTimesheet ? timesheetTotals.productive - loggedMins : 0;
          const diffStatus = !hasTimesheet ? "none" : diff === 0 ? "ok" : diff > 0 ? "gap" : "over";

          return (
            <div className={`ts-collapsed-summary${diffStatus !== "none" ? ` ts-hours-check-${diffStatus}` : ""}`}>
              <div className="ts-hc-header">
                <span className="ts-hc-title">
                  {diffStatus === "ok" ? "\u2713" : diffStatus === "gap" || diffStatus === "over" ? "\u26A0" : "\u2139"}{" "}
                  Hours Check
                </span>
                <span className="ts-hc-total">{dayJobHours.toFixed(1)}h logged across {dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}</span>
              </div>

              {hasTimesheet && (
                <div className="ts-hc-recon">
                  <div className="ts-hc-bar-wrap">
                    <div className="ts-hc-bar">
                      <div className="ts-hc-bar-logged" style={{ width: `${Math.min(100, (loggedMins / timesheetTotals.productive) * 100)}%` }} />
                    </div>
                    <div className="ts-hc-bar-labels">
                      <span>Logged: {formatMinutes(loggedMins)}</span>
                      <span>Productive: {formatMinutes(timesheetTotals.productive)}</span>
                    </div>
                  </div>
                  <div className={`ts-hc-status ts-hc-status-${diffStatus}`}>
                    {diffStatus === "ok" && "Hours match"}
                    {diffStatus === "gap" && `${formatMinutes(diff)} unaccounted — missing a job entry?`}
                    {diffStatus === "over" && `${formatMinutes(Math.abs(diff))} over-logged — check operation hours`}
                  </div>
                </div>
              )}

              <div className="ts-hc-jobs">
                {dayJobs.map((job) => {
                  const ops = job.operations || [];
                  const jobHrs = ops.reduce((s, op) => s + (parseFloat(op.duration) || 0), 0);
                  return (
                    <div key={job.id} className="ts-hc-job">
                      <div className="ts-hc-job-top">
                        <span className="ts-hc-job-label">
                          {job.turbine}{job.bladeRef ? ` / ${job.bladeRef}` : ""}
                          {job.damage ? ` / ${job.damage.number}` : ""}
                        </span>
                        <span className="ts-hc-job-hrs">{jobHrs.toFixed(1)}h</span>
                      </div>
                      <div className="ts-hc-job-ops">
                        {ops.map((op, i) => (
                          <span key={i} className="ts-hc-op">
                            {op.type}: {parseFloat(op.duration) || 0}h
                          </span>
                        ))}
                      </div>
                      <button type="button" className="ts-hc-edit-btn" onClick={() => prefillFromJob(job)}>
                        Edit
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {!timesheetOpen && dayJobs.length === 0 && (
          <div className="ts-collapsed-summary">
            <p className="empty-state small" style={{ margin: 0 }}>No jobs logged for {timesheetDate === today ? "today" : formatLongDate(timesheetDate)}.</p>
          </div>
        )}

        {timesheetOpen && (
          <div className="ts-body">
            {/* Quick-add buttons — dim already-added ones */}
            <p className="ts-quick-instruction">Tap to log at current time:</p>
            <div className="ts-quick-add">
              {TIMESHEET_ACTIVITIES.filter((a) => a !== "Custom").map((activity) => (
                <button
                  key={activity}
                  type="button"
                  className={`ts-quick-btn${usedActivities.has(activity) ? " ts-quick-btn-used" : ""}`}
                  onClick={() => addTimesheetEntry(getNowTime(), activity)}
                >
                  {activity}
                </button>
              ))}
              <div className="ts-custom-row">
                <input
                  type="text"
                  className="ts-custom-input"
                  value={customActivity}
                  onChange={(e) => setCustomActivity(e.target.value)}
                  placeholder="Custom activity..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customActivity.trim()) {
                      addTimesheetEntry(getNowTime(), customActivity.trim());
                      setCustomActivity("");
                    }
                  }}
                />
                <button
                  type="button"
                  className="ts-quick-btn ts-quick-btn-custom"
                  disabled={!customActivity.trim()}
                  onClick={() => {
                    addTimesheetEntry(getNowTime(), customActivity.trim());
                    setCustomActivity("");
                  }}
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Entries list with smart time input */}
            {entries.length > 0 && (
              <div className="ts-entries">
                {entries.map((entry) => (
                  <div key={entry.id} className="ts-entry">
                    <div className="ts-entry-time-wrap">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="ts-entry-time"
                        defaultValue={entry.time}
                        placeholder="hh:mm"
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => {
                          const parsed = parseSmartTime(e.target.value);
                          if (parsed) {
                            e.target.value = parsed;
                            updateTimesheetEntry(entry.id, "time", parsed);
                          } else {
                            e.target.value = entry.time;
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.target.blur();
                        }}
                      />
                      <span className="ts-entry-pencil" aria-hidden="true">&#9998;</span>
                    </div>
                    <span className="ts-entry-activity">{entry.activity}</span>
                    <button
                      type="button"
                      className="ts-entry-remove"
                      onClick={() => removeTimesheetEntry(entry.id)}
                      aria-label="Remove entry"
                    >
                      <XIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {entries.length === 0 && (
              <p className="empty-state small">No entries yet. Tap a button above to log your time.</p>
            )}

            {/* #8 — Timesheet order validation warnings */}
            {entries.length > 1 && (() => {
              const EXPECTED_ORDER = ["Hotel Leave", "Arrive Turbine", "Work Starts", "Break Start", "Break End", "Work Finishes", "Turbine Leave", "Hotel Arrive"];
              const warnings = [];
              const entryTimes = entries.map((e) => ({ activity: e.activity, mins: parseTimeToMinutes(e.time) }));
              // Check logical time ordering for known activities
              for (let i = 0; i < EXPECTED_ORDER.length; i++) {
                for (let j = i + 1; j < EXPECTED_ORDER.length; j++) {
                  const a = entryTimes.find((e) => e.activity === EXPECTED_ORDER[i]);
                  const b = entryTimes.find((e) => e.activity === EXPECTED_ORDER[j]);
                  if (a && b && a.mins != null && b.mins != null && a.mins > b.mins) {
                    warnings.push(`${EXPECTED_ORDER[i]} (${entries.find((e) => e.activity === EXPECTED_ORDER[i])?.time}) is after ${EXPECTED_ORDER[j]} (${entries.find((e) => e.activity === EXPECTED_ORDER[j])?.time})`);
                  }
                }
              }
              if (warnings.length === 0) return null;
              return (
                <div className="ts-warnings">
                  {warnings.map((w, i) => (
                    <p key={i} className="ts-warning-item">&#9888; {w}</p>
                  ))}
                </div>
              );
            })()}

            {/* Totals — with overtime */}
            {entries.length > 0 && (
              <div className="ts-totals-grid">
                <div className="ts-total-item">
                  <span className="ts-total-label">Total Day</span>
                  <span className="ts-total-value">{formatMinutes(timesheetTotals.totalDay)}</span>
                </div>
                <div className="ts-total-item">
                  <span className="ts-total-label">Normal (8h)</span>
                  <span className="ts-total-value">{formatMinutes(timesheetTotals.normal)}</span>
                </div>
                <div className="ts-total-item ts-total-overtime">
                  <span className="ts-total-label">Overtime</span>
                  <span className="ts-total-value">{formatMinutes(timesheetTotals.overtime)}</span>
                </div>
                <div className="ts-total-item">
                  <span className="ts-total-label">On-site</span>
                  <span className="ts-total-value">{formatMinutes(timesheetTotals.onSite)}</span>
                </div>
                <div className="ts-total-item">
                  <span className="ts-total-label">Productive</span>
                  <span className="ts-total-value">{formatMinutes(timesheetTotals.productive)}</span>
                </div>
                <div className="ts-total-item">
                  <span className="ts-total-label">Travel</span>
                  <span className="ts-total-value">{formatMinutes(timesheetTotals.travel)}</span>
                </div>
                {timesheetTotals.breakTime > 0 && (
                  <div className="ts-total-item">
                    <span className="ts-total-label">Break</span>
                    <span className="ts-total-value">{formatMinutes(timesheetTotals.breakTime)}</span>
                  </div>
                )}
              </div>
            )}

            {/* #12 — Hours check: reconciliation + linked jobs + warnings */}
            {dayJobs.length > 0 && (() => {
              const loggedMins = Math.round(dayJobHours * 60);
              const hasTimesheet = entries.length > 0 && timesheetTotals.productive > 0;
              const diff = hasTimesheet ? timesheetTotals.productive - loggedMins : 0;
              const diffStatus = !hasTimesheet ? "none" : diff === 0 ? "ok" : diff > 0 ? "gap" : "over";

              // Per-job sanity warnings
              const jobWarnings = [];
              dayJobs.forEach((job) => {
                const jobHrs = (job.operations || []).reduce((s, op) => s + (parseFloat(op.duration) || 0), 0);
                const label = `${job.turbine}${job.bladeRef ? ` / ${job.bladeRef}` : ""}${job.damage ? ` / ${job.damage.number}` : ""}`;
                (job.operations || []).forEach((op) => {
                  const dur = parseFloat(op.duration) || 0;
                  if (dur > 8) jobWarnings.push(`${label}: ${op.type} is ${dur}h — did you mean ${dur > 10 ? (dur / 10).toFixed(1) : dur}h?`);
                  if (dur > 0 && dur < 0.25) jobWarnings.push(`${label}: ${op.type} is only ${dur}h (${Math.round(dur * 60)}min)`);
                });
                if (jobHrs > 12) jobWarnings.push(`${label}: total ${jobHrs}h — unusually long day`);
              });
              if (dayJobHours > 16) jobWarnings.push(`Total logged: ${dayJobHours.toFixed(1)}h — exceeds 16 hours for one day`);

              return (
                <div className={`ts-hours-check${diffStatus !== "none" ? ` ts-hours-check-${diffStatus}` : ""}`}>
                  <div className="ts-hc-header">
                    <span className="ts-hc-title">
                      {diffStatus === "ok" ? "\u2713" : diffStatus === "gap" || diffStatus === "over" ? "\u26A0" : "\u2139"}{" "}
                      Hours Check
                    </span>
                    <span className="ts-hc-total">{dayJobHours.toFixed(1)}h logged across {dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Reconciliation bar */}
                  {hasTimesheet && (
                    <div className="ts-hc-recon">
                      <div className="ts-hc-bar-wrap">
                        <div className="ts-hc-bar">
                          <div className="ts-hc-bar-logged" style={{ width: `${Math.min(100, (loggedMins / timesheetTotals.productive) * 100)}%` }} />
                        </div>
                        <div className="ts-hc-bar-labels">
                          <span>Logged: {formatMinutes(loggedMins)}</span>
                          <span>Productive: {formatMinutes(timesheetTotals.productive)}</span>
                        </div>
                      </div>
                      <div className={`ts-hc-status ts-hc-status-${diffStatus}`}>
                        {diffStatus === "ok" && "Hours match"}
                        {diffStatus === "gap" && `${formatMinutes(diff)} unaccounted — missing a job entry?`}
                        {diffStatus === "over" && `${formatMinutes(Math.abs(diff))} over-logged — check operation hours`}
                      </div>
                    </div>
                  )}

                  {/* Per-job breakdown */}
                  <div className="ts-hc-jobs">
                    {dayJobs.map((job) => {
                      const ops = job.operations || [];
                      const jobHrs = ops.reduce((s, op) => s + (parseFloat(op.duration) || 0), 0);
                      const hasIssue = ops.some((op) => (parseFloat(op.duration) || 0) > 8) || jobHrs > 12;
                      return (
                        <div key={job.id} className={`ts-hc-job${hasIssue ? " ts-hc-job-warn" : ""}`}>
                          <div className="ts-hc-job-top">
                            <span className="ts-hc-job-label">
                              {job.turbine}{job.bladeRef ? ` / ${job.bladeRef}` : ""}
                              {job.damage ? ` / ${job.damage.number}` : ""}
                            </span>
                            <span className="ts-hc-job-hrs">{jobHrs.toFixed(1)}h</span>
                          </div>
                          <div className="ts-hc-job-ops">
                            {ops.map((op, i) => {
                              const dur = parseFloat(op.duration) || 0;
                              const opWarn = dur > 8 || (dur > 0 && dur < 0.25);
                              return (
                                <span key={i} className={`ts-hc-op${opWarn ? " ts-hc-op-warn" : ""}`}>
                                  {op.type}: {dur}h{opWarn ? " \u26A0" : ""}
                                </span>
                              );
                            })}
                          </div>
                          <button type="button" className="ts-hc-edit-btn" onClick={() => prefillFromJob(job)}>
                            Edit
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Warnings */}
                  {jobWarnings.length > 0 && (
                    <div className="ts-hc-warnings">
                      {jobWarnings.map((w, i) => (
                        <p key={i} className="ts-hc-warning">{"\u26A0"} {w}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* #10 — Weekly summary view */}
            {tsWeekView && (() => {
              const d = new Date(timesheetDate + "T00:00:00");
              const day = d.getDay();
              const monday = new Date(d);
              monday.setDate(d.getDate() - ((day + 6) % 7));
              const weekDays = [];
              for (let i = 0; i < 7; i++) {
                const wd = new Date(monday);
                wd.setDate(monday.getDate() + i);
                weekDays.push(wd.toISOString().slice(0, 10));
              }
              let weekTotal = 0;
              const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
              return (
                <div className="ts-week-grid">
                  <div className="ts-week-header">
                    {dayLabels.map((lbl, i) => <span key={lbl} className="ts-week-day-label">{lbl}</span>)}
                  </div>
                  <div className="ts-week-row">
                    {weekDays.map((wd, i) => {
                      const ts = (timesheets || []).find((t) => t.date === wd);
                      const dayEntries = ts?.entries || [];
                      const hotelLeave = dayEntries.find((e) => e.activity === "Hotel Leave");
                      const hotelArrive = dayEntries.find((e) => e.activity === "Hotel Arrive");
                      const hlMin = hotelLeave ? parseTimeToMinutes(hotelLeave.time) : null;
                      const haMin = hotelArrive ? parseTimeToMinutes(hotelArrive.time) : null;
                      const dayMins = (hlMin != null && haMin != null && haMin > hlMin) ? haMin - hlMin : 0;
                      weekTotal += dayMins;
                      const dayJobsW = jobHistory.filter((j) => j.date === wd);
                      const dayJobHrsW = dayJobsW.reduce(
                        (sum, j) => sum + (j.operations || []).reduce((s, op) => s + (parseFloat(op.duration) || 0), 0), 0
                      );
                      const isToday = wd === today;
                      const isSelected = wd === timesheetDate;
                      return (
                        <button key={wd} type="button"
                          className={`ts-week-cell${isToday ? " ts-week-today" : ""}${isSelected ? " ts-week-selected" : ""}`}
                          onClick={() => setTimesheetDate(wd)}>
                          <span className="ts-week-date">{new Date(wd + "T00:00:00").getDate()}</span>
                          {dayMins > 0 && <span className="ts-week-hrs">{formatMinutes(dayMins)}</span>}
                          {dayJobHrsW > 0 && <span className="ts-week-logged">{dayJobHrsW.toFixed(1)}h</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="ts-week-total">Week total: {formatMinutes(weekTotal)}</div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  const [dsDamageExpanded, setDsDamageExpanded] = useState(true);
  const [dsStatusFilter, setDsStatusFilter] = useState("all");

  const renderDamageSummary = () => {
    if (!project) return null;
    const { total, complete, inprogress, notstarted } = damageSummary;
    if (total === 0) return null;

    const pctComplete = (complete / total) * 100;
    const pctInProgress = (inprogress / total) * 100;
    const pctNotStarted = (notstarted / total) * 100;

    // Collect all damages from project with their turbine/blade context
    const allDamages = [];
    (project.turbines || []).forEach((turbine) => {
      (turbine.blades || []).forEach((blade) => {
        (blade.damages || []).forEach((damage) => {
          allDamages.push({ damage, turbine, blade });
        });
      });
    });

    const filteredDamages = dsStatusFilter === "all"
      ? allDamages
      : allDamages.filter((d) => (d.damage.status || "notstarted") === dsStatusFilter);

    return (
      <div className="ds-section">
        <div className="ds-header">
          <div className="ds-headline">
            <span className="ds-total-number">{total}</span>
            <span className="ds-total-label">Damages</span>
          </div>
          <div className="ds-header-right">
            <Link to="/dashboard" className="ds-view-all">Full Dashboard &rarr;</Link>
            <button
              type="button"
              className="section-panel-collapse-btn"
              onClick={() => setDsDamageExpanded((p) => !p)}
              aria-label={dsDamageExpanded ? "Collapse damages" : "Expand damages"}
            >
              <ChevronIcon up={dsDamageExpanded} />
            </button>
          </div>
        </div>
        <div className="ds-bar">
          {pctComplete > 0 && (
            <div className="ds-bar-seg ds-bar-complete" style={{ width: `${pctComplete}%` }} />
          )}
          {pctInProgress > 0 && (
            <div className="ds-bar-seg ds-bar-inprogress" style={{ width: `${pctInProgress}%` }} />
          )}
          {pctNotStarted > 0 && (
            <div className="ds-bar-seg ds-bar-notstarted" style={{ width: `${pctNotStarted}%` }} />
          )}
        </div>
        <div className="ds-legend">
          {[
            { key: "all", label: `All (${total})` },
            { key: "complete", label: `Complete (${complete})`, dotClass: "ds-dot-complete" },
            { key: "inprogress", label: `In Progress (${inprogress})`, dotClass: "ds-dot-inprogress" },
            { key: "notstarted", label: `Not Started (${notstarted})`, dotClass: "ds-dot-notstarted" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              className={`ds-legend-item ds-legend-btn${dsStatusFilter === f.key ? " ds-legend-active" : ""}`}
              onClick={() => setDsStatusFilter(f.key)}
            >
              {f.dotClass && <span className={`ds-dot ${f.dotClass}`} />}
              {f.label}
            </button>
          ))}
        </div>

        {dsDamageExpanded && (
          <div className="ds-damage-grid">
            {filteredDamages.length === 0 ? (
              <p className="empty-state small">No damages match the selected filter.</p>
            ) : (
              filteredDamages.map(({ damage: d, turbine, blade }) => {
                const ds = damageStats[d.id];
                const status = d.status || "notstarted";
                const estimatedH = parseFloat(d.estimatedHours) || 0;
                const loggedH = ds ? ds.totalHours : 0;
                const pct = estimatedH > 0 ? Math.min(100, Math.round((loggedH / estimatedH) * 100)) : 0;
                return (
                  <div key={d.id} className="ds-damage-card">
                    <div className="ds-damage-card-top">
                      <span className="ds-damage-card-loc">{turbine.name} · {blade.name}</span>
                      <span className={`dsc-status-dot dsc-status-${status}`} title={status} />
                    </div>
                    <div className="ds-damage-card-id">{d.number} — {d.type}</div>
                    {(d.radius || (d.locations && d.locations.length > 0)) && (
                      <div className="ds-damage-card-sub">
                        {[d.radius ? `${d.radius}mm` : "", (d.locations || []).join(", ")].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {ds && (
                      <div className="ds-damage-card-stats">
                        <span>{loggedH.toFixed(1)}{estimatedH > 0 ? ` / ${estimatedH}` : ""} hrs</span>
                        <span>{ds.jobCount} {ds.jobCount === 1 ? "entry" : "entries"}</span>
                      </div>
                    )}
                    {estimatedH > 0 && (
                      <div className="dsc-progress-bar" style={{ marginTop: "0.25rem" }}>
                        <div className="dsc-progress-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {ds?.operations?.size > 0 && (
                      <div className="ds-damage-card-ops">
                        {[...ds.operations].map((op) => (
                          <span key={op} className="dsc-op-badge">{op}</span>
                        ))}
                      </div>
                    )}
                    {onUpdateDamage && (
                      <div className="dsc-status-row">
                        {["notstarted", "inprogress", "complete"].map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={`dsc-status-btn dsc-status-${s}${status === s ? " dsc-status-active" : ""}`}
                            onClick={() => onUpdateDamage(turbine.id, blade.id, d.id, { status: s })}
                            aria-pressed={status === s}
                          >
                            {s === "notstarted" ? "○" : s === "inprogress" ? "⚡" : "✓"} {s === "notstarted" ? "Not Started" : s === "inprogress" ? "In Progress" : "Complete"}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="ds-damage-card-actions">
                      <button
                        type="button"
                        className="ds-damage-log-btn"
                        onClick={() => {
                          setFormProjectId(project.id);
                          setSelectedTurbineId(turbine.id);
                          setSelectedBladeId(blade.id);
                          setSelectedDamageId(d.id);
                          setIsFormOpen(true);
                          setActiveTab("logwork");
                          setTimeout(() => formRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
                        }}
                      >
                        + Log Work
                      </button>
                      <button
                        type="button"
                        className="ds-damage-history-btn"
                        onClick={() => {
                          setHistoryDamageFilter({ turbineName: turbine.name, damageNumber: d.number });
                          setActiveTab("history");
                        }}
                      >
                        History
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  const renderHistory = () => {
    let filtered = [...jobHistory];
    if (historyDamageFilter) {
      filtered = filtered.filter(
        (j) => j.turbine === historyDamageFilter.turbineName &&
          j.damage?.number === historyDamageFilter.damageNumber
      );
    }
    if (historyTurbineFilter !== "All")
      filtered = filtered.filter((j) => j.turbine === historyTurbineFilter);
    if (historyDateFilter === "Today")
      filtered = filtered.filter((j) => j.date === today);
    else if (historyDateFilter === "This week")
      filtered = filtered.filter((j) => j.date >= weekStart);

    const grouped = {};
    filtered.forEach((job) => {
      const d = job.date || "Unknown";
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(job);
    });
    const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    return (
      <div className="job-history-section">
        {/* Filter bar — #1 added labels to distinguish filter groups */}
        <div className="history-filter-bar">
          {historyDamageFilter && (
            <div className="history-dmg-filter-chip">
              <span>Filtering: {historyDamageFilter.turbineName} &middot; {historyDamageFilter.damageNumber}</span>
              <button type="button" className="filter-clear-btn"
                onClick={() => setHistoryDamageFilter(null)}>&times; Clear</button>
            </div>
          )}
          <div className="filter-chip-row">
            <div className="filter-chip-group">
              <span className="filter-group-label">Turbine:</span>
              {["All", ...turbineNames].map((t) => {
                let tooltip = t;
                if (t !== "All") {
                  for (const p of (projects || [])) {
                    const turb = (p.turbines || []).find((tb) => tb.name === t);
                    if (turb) {
                      tooltip = turb.model ? `${t} (${turb.model})` : t;
                      break;
                    }
                  }
                }
                return (
                  <button key={t} type="button"
                    className={`filter-chip${historyTurbineFilter === t ? " filter-chip-active" : ""}`}
                    title={tooltip}
                    onClick={() => setHistoryTurbineFilter(t)}>{t}</button>
                );
              })}
            </div>
            <div className="filter-chip-sep" aria-hidden="true" />
            <div className="filter-chip-group">
              <span className="filter-group-label">Period:</span>
              {["All", "Today", "This week"].map((d) => (
                <button key={d} type="button"
                  className={`filter-chip${historyDateFilter === d ? " filter-chip-active" : ""}`}
                  onClick={() => setHistoryDateFilter(d)}>{d}</button>
              ))}
            </div>
          </div>
        </div>

        {dates.length === 0 ? (
          jobHistory.length === 0
            ? <p className="empty-state">No jobs logged yet. Select a turbine and blade above to start logging work.</p>
            : <p className="empty-state">No jobs match the current filters. Try adjusting your search or date range.</p>
        ) : (
          <div className="job-history-list">
            {dates.map((d) => {
              const dayJobs = grouped[d];
              const isExpanded = expandedDates.has(d);
              const dayTotal = dayJobs.reduce(
                (sum, job) => sum + (job.operations || []).reduce((s, op) => s + (parseFloat(op.duration) || 0), 0), 0
              );
              const dayDelay = dayJobs.reduce(
                (sum, job) => sum + (job.operations || [])
                  .filter((op) => op.type === "Weather Delay")
                  .reduce((s, op) => s + (parseFloat(op.duration) || 0), 0), 0
              );
              const dayProductive = dayTotal - dayDelay;

              return (
                <div key={d}>
                  <button
                    type="button"
                    className="day-group-header"
                    aria-expanded={isExpanded}
                    onClick={() => toggleDate(d)}
                  >
                    <div className="day-group-header-inner">
                      <div className="day-group-top-row">
                        <span className="day-group-date">{formatLongDate(d)}</span>
                        <div className="day-group-meta">
                          {dayTotal > 0 && (
                            <span>
                              {dayDelay > 0
                                ? `${dayProductive.toFixed(1)} productive \u00b7 ${dayDelay.toFixed(1)} delay`
                                : `${dayTotal.toFixed(1)} hrs`}
                            </span>
                          )}
                          <span>{dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}</span>
                          <span className="day-group-chevron"><ChevronIcon up={isExpanded} /></span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="day-group-jobs">
                      {dayJobs.map((job) => (
                        <article
                          key={job.id}
                          className={`job-card${highlightedJobId === job.id ? " job-card-highlight" : ""}`}
                        >
                          <header className="job-card-header">
                            <div>
                              <div className="job-card-line1">
                                <strong>{job.turbine} &middot; {job.bladeRef}{job.damage ? ` \u00b7 ${job.damage.number} — ${job.damage.type}` : ""}</strong>
                                {job.projectName && <span className="job-project-tag">{job.projectName}</span>}
                              </div>
                              {job.damage && (job.damage.radius || job.damage.locations?.length > 0) && (
                                <div className="job-card-line2">
                                  {[
                                    job.damage.radius ? `${job.damage.radius}mm` : "",
                                    (job.damage.locations || []).join(", "),
                                  ].filter(Boolean).join(" \u00b7 ")}
                                </div>
                              )}
                            </div>
                          </header>
                          <div className="job-card-body">
                            {(job.operations || []).length > 0 && (
                              <div className="job-card-ops">
                                {job.operations.map((op, i) => (
                                  <span key={op.id || i} className="op-badge" title={op.notes || ""}>
                                    {op.type}{op.duration ? ` \u00b7 ${op.duration}h` : ""}
                                    {op.notes ? " *" : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                            {(job.materials || []).length > 0 && (
                              <div className="job-card-materials">
                                {job.materials.map((mat, i) => {
                                  const item = items.find((it) => it.id === Number(mat.itemId));
                                  return (
                                    <span key={i} className="material-badge">
                                      {item ? item.name : `Item #${mat.itemId}`} &middot; {mat.amount}{item?.unit ? ` ${item.unit}` : ""}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {(job.technician || job.accessMethod || job.weather) && (
                              <div className="job-meta-row">
                                {job.technician && <span className="job-meta-chip">{job.technician}</span>}
                                {job.accessMethod && <span className="job-meta-chip">{job.accessMethod}</span>}
                                {job.weather && (
                                  <span className="job-meta-chip">
                                    {job.weather.windSpeed ? `${job.weather.windSpeed} m/s` : ""}
                                    {job.weather.temp ? ` ${job.weather.temp}\u00b0C` : ""}
                                    {job.weather.condition ? ` \u00b7 ${job.weather.condition}` : ""}
                                  </span>
                                )}
                              </div>
                            )}
                            {job.notes && <p className="job-notes"><strong>Notes:</strong> {job.notes}</p>}
                          </div>
                          <div className="job-card-action-bar">
                            <button type="button" className="jc-action-btn jc-action-edit"
                              onClick={() => prefillFromJob(job)}>
                              <span className="jc-action-icon">&#9998;</span> Edit
                            </button>
                            <button type="button" className="jc-action-btn jc-action-repeat"
                              onClick={() => handleRepeatJob(job)}
                              title="Log same work again with today's date">
                              <span className="jc-action-icon">&#8635;</span> Repeat
                            </button>
                            {onDeleteJob && (
                              <button type="button"
                                className={`jc-action-btn jc-action-delete${deletingJobId === job.id ? " jc-action-delete-confirm" : ""}`}
                                onClick={() => handleDeleteJob(job)}>
                                <span className="jc-action-icon">{deletingJobId === job.id ? "!" : "\u2715"}</span>
                                {deletingJobId === job.id ? "Confirm Delete" : "Delete"}
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── No-project state ──────────────────────────────────────────────────────
  if (!hasAnyProject) {
    return (
      <div className="job-page">
        <header className="app-header app-header-compact">
          <h1>Job Log <span className="app-header-sub">Track jobs &amp; deduct materials</span></h1>
        </header>
        <main className="jl-layout-v3">
          <section className="section-panel">
            <div className="section-panel-hd">
              <h2 className="section-panel-title">Log Work</h2>
            </div>
            <div className="section-panel-body">
              <p className="empty-state">
                Please set up a project first. Go to{" "}
                <Link to="/setup" className="inline-link">Project Setup</Link>{" "}
                to define turbines, blades, and damages.
              </p>
            </div>
          </section>
          {/* Timesheet always available */}
          <section className="section-panel">
            {renderTimesheet()}
          </section>
          <section className="section-panel">
            <div className="section-panel-hd">
              <h2 className="section-panel-title">Job History</h2>
              {jobHistory.length > 0 && (
                <span className="section-panel-badge">{jobHistory.length}</span>
              )}
            </div>
            {renderHistory()}
          </section>
        </main>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="job-page">
      <header className="app-header app-header-compact">
        <h1>Job Log <span className="app-header-sub">Track jobs &amp; deduct materials</span></h1>
      </header>

      {successMessage && (
        <div className="success-banner" role="alert" aria-live="polite" aria-atomic="true">
          <span>{successMessage}</span>
          {/* #11 — Undo button */}
          {undoJob && (
            <button type="button" className="undo-btn" onClick={handleUndo}>Undo</button>
          )}
        </div>
      )}

      {/* Mobile tab bar */}
      <div className="jl-mobile-tabs">
        {[
          { id: "logwork",   label: "Log Work" },
          { id: "timesheet", label: "Timesheet" },
          { id: "history",   label: "History" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`jl-tab${activeTab === tab.id ? " jl-tab-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >{tab.label}</button>
        ))}
      </div>

      <main className="jl-layout-v3">
        {/* Top row: Log Work + Daily Timesheet side by side */}
        <div className="jl-top-row">
          {/* 1. Log Work — primary */}
          <section
            className={`section-panel jl-top-panel${activeTab !== "logwork" ? " jl-col-hidden-mobile" : ""}`}
            ref={formRef}
          >
            <div className="section-panel-hd">
              <h2 className="section-panel-title">Log Work</h2>
            </div>
            <div className="section-panel-body" style={{ padding: 0 }}>
              {isFormOpen ? renderForm() : renderTodayGlance()}
            </div>
          </section>

          {/* 2. Daily Timesheet */}
          <section className={`section-panel jl-top-panel${activeTab !== "timesheet" && activeTab !== "logwork" ? " jl-col-hidden-mobile" : ""}`}>
            {renderTimesheet()}
          </section>
        </div>

        {/* 3. Damage Summary — always visible */}
        {renderDamageSummary()}

        {/* 4. Job History */}
        <section className={`section-panel${activeTab !== "history" && activeTab !== "logwork" ? " jl-col-hidden-mobile" : ""}`}>
          <div className="section-panel-hd">
            <h2 className="section-panel-title">Job History</h2>
            {jobHistory.length > 0 && (
              <span className="section-panel-badge">{jobHistory.length}</span>
            )}
          </div>
          {renderHistory()}
        </section>
      </main>
    </div>
  );
}

export default JobLogPage;
