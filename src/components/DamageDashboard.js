import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import ChevronIcon from "./ChevronIcon";

const STATUS_META = {
  notstarted: { label: "Not Started", icon: "○" },
  inprogress: { label: "In Progress", icon: "⚡" },
  complete:   { label: "Complete",    icon: "✓" },
};

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

function DamageDashboard({
  project: initialProject,
  projects,
  items,
  jobHistory: allJobHistory,
  timesheets,
  getStockStatusClass,
  onUpdateDamage,
  onLogWork,
  standalone,
  highlightedDamageKey,
  setHighlightedDamageKey,
}) {
  const navigate = useNavigate();

  // ── Project selector (standalone mode) ──────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState(initialProject?.id || null);

  useEffect(() => {
    if (initialProject?.id && !selectedProjectId) setSelectedProjectId(initialProject.id);
  }, [initialProject?.id, selectedProjectId]);

  const project = standalone && projects?.length > 1
    ? (projects.find((p) => p.id === selectedProjectId) || initialProject)
    : initialProject;

  // Filter jobHistory to selected project
  const jobHistory = useMemo(() => {
    if (!standalone || !projects || projects.length <= 1) return allJobHistory;
    if (!project) return allJobHistory;
    const turbineNames = new Set(project.turbines.map((t) => t.name));
    return allJobHistory.filter((j) => {
      if (j.projectId === project.id) return true;
      if (!j.projectId && turbineNames.has(j.turbine)) return true;
      return false;
    });
  }, [allJobHistory, project, standalone, projects]);

  // ── Filter state ──────────────────────────────────────────────
  const [dashStatusFilter, setDashStatusFilter] = useState("All");

  // ── Selected damage detail panel ────────────────────────────
  const [selectedDamageKey, setSelectedDamageKey] = useState(null);

  // ── Collapsible state (persisted) ─────────────────────────────
  const [collapsedTurbines, setCollapsedTurbines] = useState(() => {
    try {
      const stored = localStorage.getItem("vetra-dash-collapsed-turbines");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const [collapsedBlades, setCollapsedBlades] = useState(() => {
    try {
      const stored = localStorage.getItem("vetra-dash-collapsed-blades");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem("vetra-dash-collapsed-turbines", JSON.stringify([...collapsedTurbines]));
  }, [collapsedTurbines]);

  useEffect(() => {
    localStorage.setItem("vetra-dash-collapsed-blades", JSON.stringify([...collapsedBlades]));
  }, [collapsedBlades]);

  const toggleTurbine = (key) => {
    setCollapsedTurbines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleBlade = (key) => {
    setCollapsedBlades((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Helper to find damage IDs from project data
  const findDamageIds = (turbineName, bladeName, damageNumber) => {
    if (!project) return null;
    const turbine = project.turbines.find((t) => t.name === turbineName);
    if (!turbine) return null;
    const blade = turbine.blades.find((b) => b.name === bladeName);
    if (!blade) return null;
    const damage = blade.damages.find((d) => d.number === damageNumber);
    if (!damage) return null;
    return { turbineId: turbine.id, bladeId: blade.id, damageId: damage.id };
  };

  // Get damage status from project data
  const getDamageStatusFromProject = (turbineName, bladeName, damageNumber) => {
    if (!project) return "notstarted";
    const turbine = project.turbines.find((t) => t.name === turbineName);
    if (!turbine) return "notstarted";
    const blade = turbine.blades.find((b) => b.name === bladeName);
    if (!blade) return "notstarted";
    const damage = blade.damages.find((d) => d.number === damageNumber);
    return damage?.status || "notstarted";
  };

  const setDamageStatus = (turbineName, bladeName, damageNumber, newStatus) => {
    if (!onUpdateDamage) return;
    const ids = findDamageIds(turbineName, bladeName, damageNumber);
    if (!ids) return;
    onUpdateDamage(ids.turbineId, ids.bladeId, ids.damageId, { status: newStatus });
  };

  // ── Build dashboard data ──────────────────────────────────────
  const dashboardData = useMemo(() => {
    const data = {};
    jobHistory.forEach((job) => {
      if (!job.damage) return;
      const tKey = job.turbine || "Unknown";
      const bKey = job.bladeRef || "Unknown";
      const dKey = `${job.damage.number}::${job.damage.type}::${job.damage.radius || ""}::${(job.damage.locations || []).join(",")}`;
      if (!data[tKey]) data[tKey] = {};
      if (!data[tKey][bKey]) data[tKey][bKey] = {};
      if (!data[tKey][bKey][dKey])
        data[tKey][bKey][dKey] = { damage: job.damage, jobs: [], totalHours: 0, delayHours: 0, materials: {}, operations: new Set(), lastDate: "" };
      const entry = data[tKey][bKey][dKey];
      entry.jobs.push(job);
      if (!entry.lastDate || job.date > entry.lastDate) entry.lastDate = job.date;
      (job.operations || []).forEach((op) => {
        const h = parseFloat(op.duration || 0);
        if (!isNaN(h)) { entry.totalHours += h; if (op.type === "Weather Delay") entry.delayHours += h; }
        entry.operations.add(op.type || "Unknown");
        (op.materials || []).forEach((m) => {
          const item = items.find((i) => i.id === Number(m.itemId));
          const key = String(m.itemId);
          if (!entry.materials[key]) entry.materials[key] = { name: item?.name || "Unknown", unit: item?.unit || "", total: 0 };
          entry.materials[key].total += Number(m.amount);
        });
      });
      (job.materials || []).forEach((m) => {
        const item = items.find((i) => i.id === Number(m.itemId));
        const key = String(m.itemId);
        if (!entry.materials[key]) entry.materials[key] = { name: item?.name || "Unknown", unit: item?.unit || "", total: 0 };
        entry.materials[key].total += Number(m.amount);
      });
    });
    return data;
  }, [jobHistory, items]);

  const handleLogWork = (turbineObj, bladeObj, damageObj) => {
    if (onLogWork) {
      onLogWork(turbineObj, bladeObj, damageObj);
    } else {
      // Standalone mode: navigate to /jobs with state
      navigate("/jobs", { state: { prefillTurbineId: turbineObj.id, prefillBladeId: bladeObj.id, prefillDamageId: damageObj.id } });
    }
  };

  // ── Render ────────────────────────────────────────────────────
  const filterMap = { "Not Started": "notstarted", "In Progress": "inprogress", "Complete": "complete" };

  // ── Overview computations (standalone mode) ──────────────────────────
  const today = new Date().toISOString().slice(0, 10);

  const overviewStats = useMemo(() => {
    if (!standalone) return null;
    const sumHours = (jobs) => jobs.reduce((s, j) => s + (j.operations || []).reduce((os, op) => os + (parseFloat(op.duration) || 0), 0), 0);
    const sumDelay = (jobs) => jobs.reduce((s, j) => s + (j.operations || []).filter((op) => op.type === "Weather Delay").reduce((os, op) => os + (parseFloat(op.duration) || 0), 0), 0);

    const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
    const monthStart = today.slice(0, 7) + "-01";

    // Project-specific stats — use the same filtered jobHistory used by the damage grid
    // (jobHistory is already filtered to the selected project via projectId or turbine name match)
    const pTodayJobs = jobHistory.filter((j) => j.date === today);
    const pWeekJobs = jobHistory.filter((j) => j.date >= weekStart);
    const pMonthJobs = jobHistory.filter((j) => j.date >= monthStart);

    // All-projects stats — use allJobHistory (the unfiltered full list from App.js)
    const allTodayJobs = allJobHistory.filter((j) => j.date === today);
    const allWeekJobs = allJobHistory.filter((j) => j.date >= weekStart);
    const allMonthJobs = allJobHistory.filter((j) => j.date >= monthStart);

    return {
      // Project (uses filtered jobHistory)
      totalJobs: jobHistory.length,
      totalHours: sumHours(jobHistory),
      todayJobs: pTodayJobs.length,
      todayHours: sumHours(pTodayJobs),
      weekJobs: pWeekJobs.length,
      weekHours: sumHours(pWeekJobs),
      weekDelay: sumDelay(pWeekJobs),
      monthJobs: pMonthJobs.length,
      monthHours: sumHours(pMonthJobs),
      monthDelay: sumDelay(pMonthJobs),
      // All projects (uses unfiltered allJobHistory)
      allTodayHours: sumHours(allTodayJobs),
      allTodayJobs: allTodayJobs.length,
      allWeekHours: sumHours(allWeekJobs),
      allWeekJobs: allWeekJobs.length,
      allMonthHours: sumHours(allMonthJobs),
      allMonthJobs: allMonthJobs.length,
      allTotalHours: sumHours(allJobHistory),
      allTotalJobs: allJobHistory.length,
    };
  }, [standalone, jobHistory, allJobHistory, today]);

  // ── Weekly breakdown chart data ──────────────────────────────────────
  const weeklyBreakdown = useMemo(() => {
    if (!standalone) return null;
    const DAYS = 7;
    const days = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return days.map((dateStr) => {
      const dayJobs = jobHistory.filter((j) => j.date === dateStr);
      let work = 0, weatherDelay = 0;
      dayJobs.forEach((j) => {
        (j.operations || []).forEach((op) => {
          const h = parseFloat(op.duration) || 0;
          if (op.type === "Weather Delay") weatherDelay += h;
          else work += h;
        });
      });

      // Timesheet data for this day
      const ts = (timesheets || []).find((t) => t.date === dateStr);
      let overtime = 0, travel = 0, breakTime = 0;
      if (ts && ts.entries.length > 0) {
        const findTime = (activity) => {
          const e = ts.entries.find((en) => en.activity === activity);
          return e ? parseTimeToMinutes(e.time) : null;
        };
        const hotelLeave = findTime("Hotel Leave");
        const hotelArrive = findTime("Hotel Arrive");
        const arrive = findTime("Arrive Turbine");
        const leave = findTime("Turbine Leave");
        const totalDay = (hotelLeave != null && hotelArrive != null && hotelArrive > hotelLeave) ? (hotelArrive - hotelLeave) / 60 : 0;
        overtime = Math.max(0, totalDay - 8);
        if (hotelLeave != null && arrive != null && arrive > hotelLeave) travel += (arrive - hotelLeave) / 60;
        if (leave != null && hotelArrive != null && hotelArrive > leave) travel += (hotelArrive - leave) / 60;
        const breakStarts = ts.entries.filter((e) => e.activity === "Break Start").map((e) => parseTimeToMinutes(e.time)).filter((t) => t != null);
        const breakEnds = ts.entries.filter((e) => e.activity === "Break End").map((e) => parseTimeToMinutes(e.time)).filter((t) => t != null);
        for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
          if (breakEnds[i] > breakStarts[i]) breakTime += (breakEnds[i] - breakStarts[i]) / 60;
        }
      }

      const dt = new Date(dateStr + "T00:00:00");
      const label = dayNames[dt.getDay()];
      const isWeatherDay = weatherDelay > 0 && work === 0;
      return { date: dateStr, label, work, weatherDelay, overtime, travel, breakTime, isWeatherDay };
    });
  }, [standalone, jobHistory, timesheets, today]);

  const chartMax = useMemo(() => {
    if (!weeklyBreakdown) return 10;
    const max = Math.max(...weeklyBreakdown.map((d) => d.work + d.weatherDelay + d.overtime + d.travel + d.breakTime));
    return Math.max(max, 1);
  }, [weeklyBreakdown]);

  // Damage summary bar
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

  // Today's timesheet
  const todayTimesheet = useMemo(() => {
    if (!standalone || !timesheets) return null;
    return timesheets.find((ts) => ts.date === today) || null;
  }, [standalone, timesheets, today]);

  const timesheetTotals = useMemo(() => {
    if (!todayTimesheet || todayTimesheet.entries.length === 0) {
      return { totalDay: 0, normal: 0, overtime: 0, onSite: 0, productive: 0, travel: 0, breakTime: 0 };
    }
    const entries = todayTimesheet.entries;
    const findTime = (activity) => {
      const e = entries.find((en) => en.activity === activity);
      return e ? parseTimeToMinutes(e.time) : null;
    };
    const arrive = findTime("Arrive Turbine");
    const leave = findTime("Turbine Leave");
    const hotelLeave = findTime("Hotel Leave");
    const hotelArrive = findTime("Hotel Arrive");
    const totalDay = (hotelLeave != null && hotelArrive != null && hotelArrive > hotelLeave) ? hotelArrive - hotelLeave : 0;
    const NORMAL_HOURS = 8 * 60;
    const normal = Math.min(totalDay, NORMAL_HOURS);
    const overtime = Math.max(0, totalDay - NORMAL_HOURS);
    const onSite = (arrive != null && leave != null && leave > arrive) ? leave - arrive : 0;
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
  }, [todayTimesheet]);

  // Inventory: alerts first, then rest
  const [showFullInventory, setShowFullInventory] = useState(false);
  const stockAlerts = useMemo(() => {
    if (!standalone || !items || !getStockStatusClass) return [];
    return items.filter((item) => {
      if (!item.stockAlert) return false;
      const cls = getStockStatusClass(item);
      return cls === "card-low" || cls === "card-warning";
    });
  }, [standalone, items, getStockStatusClass]);
  const stockOk = useMemo(() => {
    if (!standalone || !items) return [];
    return items.filter((item) => item.quantity > 0 && getStockStatusClass(item) !== "card-low" && getStockStatusClass(item) !== "card-warning");
  }, [standalone, items, getStockStatusClass]);

  const renderStandaloneHeader = () => {
    if (!standalone) return null;
    return (
      <header className="app-header">
        <h1>Dashboard</h1>
        {projects && projects.filter((p) => p.status !== "archived").length > 1 ? (
          <select
            className="dashboard-project-select"
            value={selectedProjectId || ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value))}
          >
            {projects.filter((p) => p.status !== "archived").map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : project?.name ? (
          <p>Project: <strong>{project.name}</strong></p>
        ) : null}
      </header>
    );
  };

  // ── Overview panels (standalone mode only) ──────────────────────
  const hasMultipleProjects = projects && projects.filter((p) => p.status !== "archived").length > 1;

  const renderOverview = () => {
    if (!standalone) return null;
    const stats = overviewStats;
    const ds = damageSummary;
    const pctComplete = ds.total > 0 ? (ds.complete / ds.total) * 100 : 0;
    const pctInProgress = ds.total > 0 ? (ds.inprogress / ds.total) * 100 : 0;
    const pctNotStarted = ds.total > 0 ? (ds.notstarted / ds.total) * 100 : 0;

    return (
      <div className="dash-overview">
        {/* ── Row 1: Damage bar (full width) ── */}
        {ds.total > 0 && (
          <div className="dash-ov-card dash-ov-full">
            <div className="dash-ov-card-header">
              <span className="dash-ov-card-title">Damage Progress</span>
              <span className="dash-ov-card-badge">{ds.total} total</span>
            </div>
            <div className="ds-bar">
              {pctComplete > 0 && <div className="ds-bar-seg ds-bar-complete" style={{ width: `${pctComplete}%` }} />}
              {pctInProgress > 0 && <div className="ds-bar-seg ds-bar-inprogress" style={{ width: `${pctInProgress}%` }} />}
              {pctNotStarted > 0 && <div className="ds-bar-seg ds-bar-notstarted" style={{ width: `${pctNotStarted}%` }} />}
            </div>
            <div className="ds-legend">
              <span className="ds-legend-item"><span className="ds-dot ds-dot-complete" />{ds.complete} Complete</span>
              <span className="ds-legend-item"><span className="ds-dot ds-dot-inprogress" />{ds.inprogress} In Progress</span>
              <span className="ds-legend-item"><span className="ds-dot ds-dot-notstarted" />{ds.notstarted} Not Started</span>
            </div>
          </div>
        )}

        {/* ── Row 2: Hours (project) + Hours (all projects) ── */}
        {stats && (
          <>
            <div className="dash-ov-card">
              <div className="dash-ov-card-header">
                <span className="dash-ov-card-title">{project?.name || "Project"} Hours</span>
              </div>
              <div className="dash-ov-stats-grid dash-ov-stats-4col">
                <div className="dash-ov-stat">
                  <span className="dash-ov-stat-val">{stats.todayHours.toFixed(1)}</span>
                  <span className="dash-ov-stat-label">Today</span>
                </div>
                <div className="dash-ov-stat">
                  <span className="dash-ov-stat-val">{stats.weekHours.toFixed(1)}</span>
                  <span className="dash-ov-stat-label">This week</span>
                </div>
                <div className="dash-ov-stat">
                  <span className="dash-ov-stat-val">{stats.monthHours.toFixed(1)}</span>
                  <span className="dash-ov-stat-label">This month</span>
                </div>
                <div className="dash-ov-stat">
                  <span className="dash-ov-stat-val">{stats.totalHours.toFixed(1)}</span>
                  <span className="dash-ov-stat-label">All time</span>
                </div>
              </div>
              {(stats.weekDelay > 0 || stats.monthDelay > 0) && (
                <div className="dash-ov-delay-row">
                  {stats.weekDelay > 0 && <span className="dash-ov-delay-chip">Week delay: {stats.weekDelay.toFixed(1)}h</span>}
                  {stats.monthDelay > 0 && <span className="dash-ov-delay-chip">Month delay: {stats.monthDelay.toFixed(1)}h</span>}
                </div>
              )}
              <div className="dash-ov-jobs-row">
                <span>{stats.todayJobs} today</span>
                <span>{stats.weekJobs} this week</span>
                <span>{stats.monthJobs} this month</span>
                <span>{stats.totalJobs} total</span>
              </div>
              {weeklyBreakdown && weeklyBreakdown.some((d) => d.work + d.weatherDelay > 0) && (
                <div className="wk-chart">
                  <div className="wk-chart-title">Last 7 Days</div>
                  <div className="wk-chart-bars">
                    {weeklyBreakdown.map((d) => {
                      const total = d.work + d.weatherDelay + d.overtime + d.travel + d.breakTime;
                      return (
                        <div key={d.date} className={`wk-chart-col${d.date === today ? " wk-chart-today" : ""}`}>
                          <div className="wk-chart-bar-wrap" title={
                            total > 0
                              ? `${d.work.toFixed(1)}h work${d.weatherDelay > 0 ? `, ${d.weatherDelay.toFixed(1)}h weather` : ""}${d.overtime > 0 ? `, ${d.overtime.toFixed(1)}h OT` : ""}${d.travel > 0 ? `, ${d.travel.toFixed(1)}h travel` : ""}`
                              : "No data"
                          }>
                            {total > 0 ? (
                              <>
                                {d.work > 0 && <div className="wk-seg wk-seg-work" style={{ height: `${(d.work / chartMax) * 100}%` }} />}
                                {d.overtime > 0 && <div className="wk-seg wk-seg-ot" style={{ height: `${(d.overtime / chartMax) * 100}%` }} />}
                                {d.weatherDelay > 0 && <div className="wk-seg wk-seg-weather" style={{ height: `${(d.weatherDelay / chartMax) * 100}%` }} />}
                                {d.travel > 0 && <div className="wk-seg wk-seg-travel" style={{ height: `${(d.travel / chartMax) * 100}%` }} />}
                                {d.breakTime > 0 && <div className="wk-seg wk-seg-break" style={{ height: `${(d.breakTime / chartMax) * 100}%` }} />}
                              </>
                            ) : (
                              <div className="wk-seg wk-seg-empty" />
                            )}
                          </div>
                          <span className="wk-chart-label">{d.label}</span>
                          {total > 0 && <span className="wk-chart-val">{total.toFixed(1)}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="wk-chart-legend">
                    <span className="wk-legend-item"><span className="wk-legend-dot wk-leg-work" /> Work</span>
                    <span className="wk-legend-item"><span className="wk-legend-dot wk-leg-ot" /> Overtime</span>
                    <span className="wk-legend-item"><span className="wk-legend-dot wk-leg-weather" /> Weather</span>
                    <span className="wk-legend-item"><span className="wk-legend-dot wk-leg-travel" /> Travel</span>
                  </div>
                </div>
              )}
            </div>

            {hasMultipleProjects && (
              <div className="dash-ov-card dash-ov-card-alt">
                <div className="dash-ov-card-header">
                  <span className="dash-ov-card-title">All Projects</span>
                </div>
                <div className="dash-ov-stats-grid dash-ov-stats-4col">
                  <div className="dash-ov-stat">
                    <span className="dash-ov-stat-val">{stats.allTodayHours.toFixed(1)}</span>
                    <span className="dash-ov-stat-label">Today</span>
                  </div>
                  <div className="dash-ov-stat">
                    <span className="dash-ov-stat-val">{stats.allWeekHours.toFixed(1)}</span>
                    <span className="dash-ov-stat-label">This week</span>
                  </div>
                  <div className="dash-ov-stat">
                    <span className="dash-ov-stat-val">{stats.allMonthHours.toFixed(1)}</span>
                    <span className="dash-ov-stat-label">This month</span>
                  </div>
                  <div className="dash-ov-stat">
                    <span className="dash-ov-stat-val">{stats.allTotalHours.toFixed(1)}</span>
                    <span className="dash-ov-stat-label">All time</span>
                  </div>
                </div>
                <div className="dash-ov-jobs-row">
                  <span>{stats.allTodayJobs} today</span>
                  <span>{stats.allWeekJobs} this week</span>
                  <span>{stats.allMonthJobs} this month</span>
                  <span>{stats.allTotalJobs} total</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Row 3: Timesheet + Inventory ── */}
        <div className="dash-ov-card">
          <div className="dash-ov-card-header">
            <span className="dash-ov-card-title">Today's Timesheet</span>
            <Link to="/jobs" className="dash-ov-card-link">Edit</Link>
          </div>
          {todayTimesheet && todayTimesheet.entries.length > 0 ? (
            <>
              <div className="dash-ov-ts-entries">
                {todayTimesheet.entries.map((entry) => (
                  <div key={entry.id} className="dash-ov-ts-entry">
                    <span className="dash-ov-ts-time">{entry.time}</span>
                    <span className="dash-ov-ts-activity">{entry.activity}</span>
                  </div>
                ))}
              </div>
              <div className="dash-ov-ts-totals">
                <div className="dash-ov-ts-total">
                  <span className="dash-ov-stat-label">Total Day</span>
                  <span className="dash-ov-stat-val">{formatMinutes(timesheetTotals.totalDay)}</span>
                </div>
                <div className="dash-ov-ts-total">
                  <span className="dash-ov-stat-label">Normal</span>
                  <span className="dash-ov-stat-val">{formatMinutes(timesheetTotals.normal)}</span>
                </div>
                {timesheetTotals.overtime > 0 && (
                  <div className="dash-ov-ts-total dash-ov-ts-overtime">
                    <span className="dash-ov-stat-label">Overtime</span>
                    <span className="dash-ov-stat-val">{formatMinutes(timesheetTotals.overtime)}</span>
                  </div>
                )}
                <div className="dash-ov-ts-total">
                  <span className="dash-ov-stat-label">On-site</span>
                  <span className="dash-ov-stat-val">{formatMinutes(timesheetTotals.onSite)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="empty-state small">No timesheet entries for today. <Link to="/jobs" className="inline-link">Log time</Link></p>
          )}
        </div>

        {/* Inventory — full list, expandable */}
        <div className="dash-ov-card">
          <div className="dash-ov-card-header">
            <span className="dash-ov-card-title">Inventory ({stockAlerts.length + stockOk.length} in van)</span>
            <Link to="/" className="dash-ov-card-link">Manage</Link>
          </div>
          {stockAlerts.length > 0 && (
            <div className="dash-ov-stock-list">
              {stockAlerts.map((item) => {
                const cls = getStockStatusClass(item);
                return (
                  <div key={item.id} className={`dash-ov-stock-item${cls === "card-low" ? " dash-ov-stock-critical" : " dash-ov-stock-warn"}`}>
                    <span className="dash-ov-stock-name">{item.name}</span>
                    <span className="dash-ov-stock-qty">{item.quantity} {item.unit}</span>
                  </div>
                );
              })}
            </div>
          )}
          {stockAlerts.length === 0 && (
            <p className="dash-ov-stock-ok">All stock levels OK</p>
          )}
          {stockOk.length > 0 && (
            <>
              <button
                type="button"
                className="dash-ov-expand-btn"
                onClick={() => setShowFullInventory((p) => !p)}
              >
                {showFullInventory ? "Hide" : "Show"} {stockOk.length} in-stock items
                <ChevronIcon up={showFullInventory} />
              </button>
              {showFullInventory && (
                <div className="dash-ov-stock-list">
                  {stockOk.map((item) => (
                    <div key={item.id} className="dash-ov-stock-item dash-ov-stock-ok">
                      <span className="dash-ov-stock-name">{item.name}</span>
                      <span className="dash-ov-stock-qty">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (!project) {
    return (
      <div className={`dash-page${standalone ? " dash-standalone" : ""}`}>
        {renderStandaloneHeader()}
        <p className="empty-state">
          No active project. Go to{" "}
          <Link to="/setup" className="inline-link">Project Setup</Link>{" "}
          to select a project.
        </p>
      </div>
    );
  }

  if (!standalone && Object.keys(dashboardData).length === 0) {
    return (
      <div className="dash-page">
        <p className="empty-state">No damage data yet. Submit jobs to see dashboard.</p>
      </div>
    );
  }

  return (
    <div className={`dash-page${standalone ? " dash-standalone" : ""}`}>
      {renderStandaloneHeader()}
      {renderOverview()}

      <div className="dash-root">
        {/* Status filter */}
        <div className="dash-filter-bar">
          {["All", "Not Started", "In Progress", "Complete"].map((f) => (
            <button key={f} type="button"
              className={`filter-chip${dashStatusFilter === f ? " filter-chip-active" : ""}`}
              onClick={() => setDashStatusFilter(f)}>{f}</button>
          ))}
        </div>

        {Object.entries(dashboardData).map(([turbineName, blades]) => {
          const turbineObj = project?.turbines.find((t) => t.name === turbineName);
          const isTurbineCollapsed = collapsedTurbines.has(turbineName);

          // Compute turbine-level totals
          let turbineTotalHours = 0;
          let turbineTotalDamages = 0;
          Object.values(blades).forEach((damages) => {
            turbineTotalDamages += Object.keys(damages).length;
            Object.values(damages).forEach((e) => { turbineTotalHours += e.totalHours; });
          });

          const hasVisible = Object.entries(blades).some(([bladeName, damages]) =>
            Object.entries(damages).some(([dKey, entry]) => {
              if (dashStatusFilter === "All") return true;
              const status = getDamageStatusFromProject(turbineName, bladeName, entry.damage.number);
              return filterMap[dashStatusFilter] === status;
            })
          );
          if (!hasVisible) return null;

          return (
            <div key={turbineName} className="dash2-turbine">
              <button
                type="button"
                className="dash2-turbine-hd dash2-collapsible-hd"
                onClick={() => toggleTurbine(turbineName)}
                aria-expanded={!isTurbineCollapsed}
              >
                <div className="dash2-turbine-badge">
                  <span className="dash2-turbine-level">TURBINE</span>
                  <span className="dash2-turbine-name">{turbineName}</span>
                </div>
                <div className="dash2-turbine-right">
                  <div className="dash2-turbine-stats">
                    <span>{Object.keys(blades).length} blade{Object.keys(blades).length !== 1 ? "s" : ""}</span>
                    <span className="dash2-stat-sep">·</span>
                    <span>{turbineTotalDamages} damage{turbineTotalDamages !== 1 ? "s" : ""}</span>
                    {turbineTotalHours > 0 && (
                      <>
                        <span className="dash2-stat-sep">·</span>
                        <span>{turbineTotalHours.toFixed(1)} hrs</span>
                      </>
                    )}
                  </div>
                  <span className="dash2-collapse-chevron">
                    <ChevronIcon up={!isTurbineCollapsed} />
                  </span>
                </div>
              </button>

              <div className={`dash2-turbine-body${isTurbineCollapsed ? " dash2-collapsed" : ""}`}>
                {Object.entries(blades).map(([bladeName, damages]) => {
                  const bladeObj = turbineObj?.blades.find((b) => b.name === bladeName);
                  const bladeKey = `${turbineName}::${bladeName}`;
                  const isBladeCollapsed = collapsedBlades.has(bladeKey);
                  const bladeHours = Object.values(damages).reduce((s, e) => s + e.totalHours, 0);

                  const visibleDamages = Object.entries(damages).filter(([dKey, entry]) => {
                    if (dashStatusFilter === "All") return true;
                    const status = getDamageStatusFromProject(turbineName, bladeName, entry.damage.number);
                    return filterMap[dashStatusFilter] === status;
                  });
                  if (visibleDamages.length === 0) return null;

                  return (
                    <div key={bladeName} className="dash2-blade">
                      <button
                        type="button"
                        className="dash2-blade-hd dash2-collapsible-hd"
                        onClick={() => toggleBlade(bladeKey)}
                        aria-expanded={!isBladeCollapsed}
                      >
                        <div className="dash2-blade-left">
                          <span className="dash2-blade-level">BLADE</span>
                          <span className="dash2-blade-name">{bladeName}</span>
                        </div>
                        <div className="dash2-blade-right">
                          <div className="dash2-blade-stats">
                            <span>{visibleDamages.length} damage{visibleDamages.length !== 1 ? "s" : ""}</span>
                            {bladeHours > 0 && (
                              <>
                                <span className="dash2-stat-sep">·</span>
                                <span>{bladeHours.toFixed(1)} hrs</span>
                              </>
                            )}
                          </div>
                          <span className="dash2-collapse-chevron">
                            <ChevronIcon up={!isBladeCollapsed} />
                          </span>
                        </div>
                      </button>

                      <div className={`dash2-damage-grid${isBladeCollapsed ? " dash2-collapsed" : ""}`}>
                        {visibleDamages.map(([dKey, entry]) => {
                          const { damage, jobs, totalHours, materials, operations, lastDate } = entry;
                          const opArray = Array.from(operations);
                          const currentStatus = getDamageStatusFromProject(turbineName, bladeName, damage.number);
                          const fullHighlightKey = `${turbineName}::${dKey}`;
                          const isHighlighted = highlightedDamageKey === fullHighlightKey;
                          const subtitle = [
                            damage.radius ? `${damage.radius}mm` : "",
                            (damage.locations || []).join(", "),
                          ].filter(Boolean).join(" · ");

                          const configuredDamage = turbineObj?.blades
                            .find((b) => b.name === bladeName)
                            ?.damages.find((d) => d.number === damage.number);
                          const estimatedHours = configuredDamage?.estimatedHours
                            ? Number(configuredDamage.estimatedHours) : 0;
                          const progressPct = estimatedHours > 0
                            ? Math.min(100, Math.round((totalHours / estimatedHours) * 100))
                            : null;

                          const damageObj = bladeObj?.damages.find((d) => d.number === damage.number);

                          const cardKey = `${turbineName}::${bladeName}::${dKey}`;
                          const isExpanded = selectedDamageKey === cardKey;
                          const delayHours = entry.delayHours || 0;
                          const productiveHours = totalHours - delayHours;

                          // Sort jobs by date descending for the detail view
                          const sortedJobs = [...jobs].sort((a, b) => b.date.localeCompare(a.date));

                          // Group jobs by date
                          const jobsByDate = {};
                          sortedJobs.forEach((job) => {
                            const d = job.date || "Unknown";
                            if (!jobsByDate[d]) jobsByDate[d] = [];
                            jobsByDate[d].push(job);
                          });

                          return (
                            <div
                              key={dKey}
                              className={`dash2-damage-card${isHighlighted ? " ddc-pulse-yellow" : ""}${isExpanded ? " ddc-expanded" : ""}`}
                            >
                              {/* Clickable summary area */}
                              <div
                                className="ddc-clickable-area"
                                onClick={() => setSelectedDamageKey(isExpanded ? null : cardKey)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDamageKey(isExpanded ? null : cardKey); } }}
                                aria-expanded={isExpanded}
                              >
                                <div className="dash2-damage-strip">
                                  <div className="dash2-damage-id-row">
                                    <span className="dash2-damage-level">DMG</span>
                                    <span className="dash2-damage-number">{damage.number}</span>
                                    <span className="dash2-damage-type">{damage.type}</span>
                                  </div>
                                  <div className="ddc-strip-right">
                                    {turbineObj && bladeObj && damageObj && (
                                      <button
                                        type="button"
                                        className="ddc-log-work-btn"
                                        onClick={(e) => { e.stopPropagation(); handleLogWork(turbineObj, bladeObj, damageObj); }}
                                      >▶ Log Work</button>
                                    )}
                                    <span className={`ddc-expand-chevron${isExpanded ? " ddc-expand-chevron-up" : ""}`}>
                                      <ChevronIcon up={isExpanded} />
                                    </span>
                                  </div>
                                </div>

                                {subtitle && (
                                  <div className="dash2-damage-subtitle">{subtitle}</div>
                                )}

                                <div className="ddc-hours-row">
                                  {totalHours > 0 ? (
                                    <>
                                      <span className="hours-display">{totalHours.toFixed(1)}</span>
                                      <span className="ddc-hours-unit">
                                        {estimatedHours > 0 ? ` / ${estimatedHours} hrs` : " hrs total"}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="ddc-no-hours">No hours logged yet</span>
                                  )}
                                </div>

                                <div className="ddc-progress-wrap">
                                  {progressPct !== null ? (
                                    <>
                                      <div className="progress-bar-track">
                                        <div
                                          className="progress-bar-fill"
                                          style={{ width: `${progressPct}%` }}
                                          role="progressbar"
                                          aria-valuenow={progressPct}
                                          aria-valuemin={0}
                                          aria-valuemax={100}
                                        />
                                      </div>
                                      <span className="ddc-progress-label">{progressPct}%</span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="progress-bar-track progress-bar-dashed" />
                                      <span className="ddc-progress-label ddc-progress-hint">Set estimate</span>
                                    </>
                                  )}
                                </div>

                                <div className="ddc-meta-row">
                                  <span className="ddc-meta-item">📅 {lastDate}</span>
                                  <span className="ddc-meta-item">🔧 {jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
                                </div>

                                {opArray.length > 0 && (
                                  <div className="ddc-ops-row">
                                    {opArray.map((op) => (
                                      <span key={op} className="op-badge">✓ {op}</span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Status row — always visible, not part of clickable area */}
                              <div className="ddc-status-row">
                                {["notstarted", "inprogress", "complete"].map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    className={`ddc-status-btn ddc-status-${s}${currentStatus === s ? " ddc-status-active" : ""}`}
                                    onClick={() => setDamageStatus(turbineName, bladeName, damage.number, s)}
                                    aria-pressed={currentStatus === s}
                                  >
                                    {STATUS_META[s].icon} {STATUS_META[s].label}
                                  </button>
                                ))}
                              </div>

                              {/* ── Expanded detail panel ── */}
                              {isExpanded && (
                                <div className="ddc-detail-panel">
                                  {/* Summary stats bar */}
                                  <div className="ddc-detail-stats">
                                    <div className="ddc-detail-stat">
                                      <span className="ddc-detail-stat-val">{productiveHours.toFixed(1)}</span>
                                      <span className="ddc-detail-stat-label">Productive hrs</span>
                                    </div>
                                    {delayHours > 0 && (
                                      <div className="ddc-detail-stat ddc-detail-stat-delay">
                                        <span className="ddc-detail-stat-val">{delayHours.toFixed(1)}</span>
                                        <span className="ddc-detail-stat-label">Delay hrs</span>
                                      </div>
                                    )}
                                    <div className="ddc-detail-stat">
                                      <span className="ddc-detail-stat-val">{jobs.length}</span>
                                      <span className="ddc-detail-stat-label">Entries</span>
                                    </div>
                                    {Object.keys(materials).length > 0 && (
                                      <div className="ddc-detail-stat">
                                        <span className="ddc-detail-stat-val">{Object.keys(materials).length}</span>
                                        <span className="ddc-detail-stat-label">Materials</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Materials summary table */}
                                  {Object.keys(materials).length > 0 && (
                                    <div className="ddc-detail-section">
                                      <div className="ddc-detail-section-title">Materials consumed</div>
                                      <div className="dashboard-materials-table-wrap">
                                        <table className="dashboard-materials-table">
                                          <thead>
                                            <tr><th>Material</th><th>Total Used</th></tr>
                                          </thead>
                                          <tbody>
                                            {Object.entries(materials).map(([itemId, { name, total, unit }]) => (
                                              <tr key={itemId}>
                                                <td>{name}</td>
                                                <td>{total} {unit}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {/* Work history timeline */}
                                  <div className="ddc-detail-section">
                                    <div className="ddc-detail-section-title">Work History</div>
                                    <div className="ddc-timeline">
                                      {Object.entries(jobsByDate).map(([dateStr, dateJobs]) => (
                                        <div key={dateStr} className="ddc-timeline-day">
                                          <div className="ddc-timeline-date">
                                            <span className="ddc-timeline-dot" />
                                            <span>{dateStr}</span>
                                            <span className="ddc-timeline-day-hours">
                                              {dateJobs.reduce((s, j) => s + (j.operations || []).reduce((os, op) => os + (parseFloat(op.duration) || 0), 0), 0).toFixed(1)} hrs
                                            </span>
                                          </div>

                                          {dateJobs.map((job) => {
                                            const jobHours = (job.operations || []).reduce((s, op) => s + (parseFloat(op.duration) || 0), 0);
                                            const jobMaterials = (job.materials || []).map((m) => {
                                              const item = items.find((i) => i.id === Number(m.itemId));
                                              return { name: item?.name || "Unknown", amount: m.amount, unit: item?.unit || "", batch: m.batch || "" };
                                            });

                                            return (
                                              <div key={job.id} className="ddc-timeline-job">
                                                {/* Operations */}
                                                <div className="ddc-timeline-ops">
                                                  {(job.operations || []).map((op, i) => (
                                                    <div key={op.id || i} className="ddc-timeline-op">
                                                      <span className="ddc-timeline-op-type">{op.type}</span>
                                                      <span className="ddc-timeline-op-hrs">{op.duration}h</span>
                                                    </div>
                                                  ))}
                                                </div>

                                                {/* Meta: technician, access, weather */}
                                                {(job.technician || job.accessMethod || job.weather) && (
                                                  <div className="ddc-timeline-meta">
                                                    {job.technician && <span className="ddc-timeline-chip">👤 {job.technician}</span>}
                                                    {job.accessMethod && <span className="ddc-timeline-chip">🪢 {job.accessMethod}</span>}
                                                    {job.weather && (
                                                      <span className="ddc-timeline-chip">
                                                        🌬️{job.weather.windSpeed ? ` ${job.weather.windSpeed} m/s` : ""}
                                                        {job.weather.temp ? ` ${job.weather.temp}°C` : ""}
                                                        {job.weather.condition ? ` · ${job.weather.condition}` : ""}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}

                                                {/* Materials used on this job */}
                                                {jobMaterials.length > 0 && (
                                                  <div className="ddc-timeline-materials">
                                                    {jobMaterials.map((m, i) => (
                                                      <span key={i} className="ddc-timeline-mat">{m.name}: {m.amount} {m.unit}{m.batch ? ` [${m.batch}]` : ""}</span>
                                                    ))}
                                                  </div>
                                                )}

                                                {/* Notes */}
                                                {job.notes && (
                                                  <div className="ddc-timeline-notes">{job.notes}</div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DamageDashboard;
