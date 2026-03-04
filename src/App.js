import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import NavBar from "./components/NavBar";
import InventoryPage from "./components/InventoryPage";
import JobLogPage from "./components/JobLogPage";
import ProjectSetupPage from "./components/ProjectSetupPage";

const INITIAL_ITEMS = [
  {
    id: 1,
    name: "Epoxy Resin Kit",
    quantity: 3,
    unit: "kits",
    category: "Resin",
    notes: "2-part laminating resin for structural repairs",
  },
  {
    id: 2,
    name: "Filler Paste",
    quantity: 1,
    unit: "tubs",
    category: "Filler",
    notes: "High-density blade leading-edge filler",
  },
  {
    id: 3,
    name: "Fiberglass Biaxial Cloth 600gsm",
    quantity: 8,
    unit: "m²",
    category: "Fiberglass",
    notes: "Main reinforcement for structural patches",
  },
  {
    id: 4,
    name: "Peel Ply Nylon 85gsm",
    quantity: 6,
    unit: "m²",
    category: "Consumable",
    notes: "For vacuum consolidation and clean surface prep",
  },
  {
    id: 5,
    name: "Mixing Cups 600ml",
    quantity: 25,
    unit: "pcs",
    category: "Consumable",
    notes: "Graduated cups for resin mixing",
  },
  {
    id: 6,
    name: "80-grit Sandpaper Discs",
    quantity: 40,
    unit: "pcs",
    category: "Consumable",
    notes: "For initial grinding and feathering",
  },
];

const CATEGORY_OPTIONS = [
  "Resin",
  "Filler",
  "Fiberglass",
  "Adhesive",
  "Consumable",
  "Tool",
  "Other",
];

function App() {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-items");
      return saved ? JSON.parse(saved) : INITIAL_ITEMS;
    } catch {
      return INITIAL_ITEMS;
    }
  });
  const [jobHistory, setJobHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-jobs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-projects");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeProjectId, setActiveProjectId] = useState(() => {
    try {
      const saved = localStorage.getItem("vetra-active-project-id");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newCategory, setNewCategory] = useState("Resin");
  const [newNotes, setNewNotes] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("vetra-items", JSON.stringify(items));
    } catch {}
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem("vetra-jobs", JSON.stringify(jobHistory));
    } catch {}
  }, [jobHistory]);

  useEffect(() => {
    try {
      localStorage.setItem("vetra-projects", JSON.stringify(projects));
    } catch {}
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "vetra-active-project-id",
        JSON.stringify(activeProjectId)
      );
    } catch {}
  }, [activeProjectId]);

  const activeProject =
    projects.find((project) => project.id === activeProjectId) || null;

  const setProjectName = (name) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId ? { ...project, name } : project
      )
    );
  };

  const addProject = (name) => {
    const newProject = {
      id: Date.now() + Math.random(),
      name,
      status: "active",
      turbines: [],
    };
    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProject.id);
  };

  const deleteProject = (projectId) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
  };

  const archiveProject = (projectId) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, status: "archived" } : project
      )
    );
  };

  const unarchiveProject = (projectId) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, status: "active" } : project
      )
    );
  };

  const switchActiveProject = (projectId) => {
    if (
      !window.confirm(
        "Switch to this project? The Job Log will now use this project."
      )
    ) {
      return;
    }
    setActiveProjectId(projectId);
  };

  const addTurbine = (name) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: [
                ...project.turbines,
                { id: Date.now() + Math.random(), name, blades: [] },
              ],
            }
          : project
      )
    );
  };

  const deleteTurbine = (turbineId) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.filter((t) => t.id !== turbineId),
            }
          : project
      )
    );
  };

  const updateTurbine = (turbineId, fields) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((t) =>
                t.id === turbineId ? { ...t, ...fields } : t
              ),
            }
          : project
      )
    );
  };

  const addBlade = (turbineId, bladeName) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((turbine) =>
                turbine.id === turbineId
                  ? {
                      ...turbine,
                      blades: [
                        ...turbine.blades,
                        {
                          id: Date.now() + Math.random(),
                          name: bladeName,
                          damages: [],
                        },
                      ],
                    }
                  : turbine
              ),
            }
          : project
      )
    );
  };

  const deleteBlade = (turbineId, bladeId) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((turbine) =>
                turbine.id === turbineId
                  ? {
                      ...turbine,
                      blades: turbine.blades.filter((b) => b.id !== bladeId),
                    }
                  : turbine
              ),
            }
          : project
      )
    );
  };

  const updateBlade = (turbineId, bladeId, fields) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((t) =>
                t.id === turbineId
                  ? {
                      ...t,
                      blades: t.blades.map((b) =>
                        b.id === bladeId ? { ...b, ...fields } : b
                      ),
                    }
                  : t
              ),
            }
          : project
      )
    );
  };

  const addDamage = (turbineId, bladeId) => {
    const newId = Date.now() + Math.random();
    if (!activeProjectId) return newId;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((turbine) => {
                if (turbine.id !== turbineId) return turbine;
                return {
                  ...turbine,
                  blades: turbine.blades.map((blade) => {
                    if (blade.id !== bladeId) return blade;
                    const nextIndex = blade.damages.length + 1;
                    const newDamage = {
                      id: newId,
                      number: `D${nextIndex}`,
                      type: "Erosion",
                      severity: "",
                      radius: "",
                      locations: [],
                      notes: "",
                    };
                    return {
                      ...blade,
                      damages: [...blade.damages, newDamage],
                    };
                  }),
                };
              }),
            }
          : project
      )
    );
    return newId;
  };

  const updateDamage = (turbineId, bladeId, damageId, fields) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((turbine) => {
                if (turbine.id !== turbineId) return turbine;
                return {
                  ...turbine,
                  blades: turbine.blades.map((blade) => {
                    if (blade.id !== bladeId) return blade;
                    return {
                      ...blade,
                      damages: blade.damages.map((damage) =>
                        damage.id === damageId
                          ? { ...damage, ...fields }
                          : damage
                      ),
                    };
                  }),
                };
              }),
            }
          : project
      )
    );
  };

  const deleteDamage = (turbineId, bladeId, damageId) => {
    if (!activeProjectId) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              turbines: project.turbines.map((t) => {
                if (t.id !== turbineId) return t;
                return {
                  ...t,
                  blades: t.blades.map((b) => {
                    if (b.id !== bladeId) return b;
                    return {
                      ...b,
                      damages: b.damages.filter((d) => d.id !== damageId),
                    };
                  }),
                };
              }),
            }
          : project
      )
    );
  };

  const handleAdjustQuantity = (id, delta) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.max(0, item.quantity + delta),
            }
          : item
      )
    );
  };

  const handleDelete = (id) => {
    // Confirm before deleting an inventory item
    if (!window.confirm("Delete this inventory item?")) {
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const editJob = (oldJob, newJob) => {
    setItems((prev) => {
      let updated = [...prev];

      const oldMats = [
        ...(oldJob.materials || []),
        ...(oldJob.operations || []).flatMap((op) => op.materials || []),
      ];
      oldMats.forEach((mat) => {
        const idx = updated.findIndex((i) => i.id === Number(mat.itemId));
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            quantity:
              (updated[idx].quantity || 0) + Number(mat.amount || 0),
          };
        }
      });

      const newMats = [
        ...(newJob.materials || []),
        ...(newJob.operations || []).flatMap((op) => op.materials || []),
      ];
      newMats.forEach((mat) => {
        const idx = updated.findIndex((i) => i.id === Number(mat.itemId));
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            quantity: Math.max(
              0,
              (updated[idx].quantity || 0) - Number(mat.amount || 0)
            ),
          };
        }
      });

      return updated;
    });

    setJobHistory((prev) =>
      prev.map((j) => (j.id === newJob.id ? newJob : j))
    );
  };

  const handleAddItem = (e) => {
    e.preventDefault();

    const trimmedName = newName.trim();
    if (!trimmedName) {
      return;
    }

    const parsedQuantity = Number(newQuantity);
    const safeQuantity = Number.isNaN(parsedQuantity) || parsedQuantity < 0 ? 0 : parsedQuantity;

    const nextId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;

    const newItem = {
      id: nextId,
      name: trimmedName,
      quantity: safeQuantity,
      unit: newUnit || "",
      category: newCategory || "Other",
      notes: newNotes || "",
    };

    setItems((prev) => [...prev, newItem]);

    setNewName("");
    setNewQuantity("");
    setNewUnit("");
    setNewCategory("Resin");
    setNewNotes("");
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "All" ? true : item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getStockStatusClass = (quantity) => {
    if (quantity === 0) return "card-low";
    if (quantity === 1 || quantity === 2) return "card-warning";
    return "";
  };

  return (
    <BrowserRouter>
      <div className="app-root">
        <NavBar />
        <Routes>
          <Route
            path="/"
            element={
              <InventoryPage
                items={items}
                filteredItems={filteredItems}
                categoryOptions={CATEGORY_OPTIONS}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                newName={newName}
                setNewName={setNewName}
                newQuantity={newQuantity}
                setNewQuantity={setNewQuantity}
                newUnit={newUnit}
                setNewUnit={setNewUnit}
                newCategory={newCategory}
                setNewCategory={setNewCategory}
                newNotes={newNotes}
                setNewNotes={setNewNotes}
                handleAddItem={handleAddItem}
                handleAdjustQuantity={handleAdjustQuantity}
                handleDelete={handleDelete}
                getStockStatusClass={getStockStatusClass}
              />
            }
          />
          <Route
            path="/jobs"
            element={
              <JobLogPage
                items={items}
                project={activeProject}
                jobHistory={jobHistory}
                onSubmitJob={(job) => {
                  setItems((prevItems) => {
                    const updated = [...prevItems];
                    const applyDeduction = (mat) => {
                      const index = updated.findIndex(
                        (i) => i.id === mat.itemId
                      );
                      if (index === -1) return;
                      const current = updated[index];
                      const newQuantity = Math.max(
                        0,
                        (current.quantity || 0) - mat.amount
                      );
                      updated[index] = { ...current, quantity: newQuantity };
                    };
                    (job.materials || []).forEach(applyDeduction);
                    (job.operations || []).forEach((op) =>
                      (op.materials || []).forEach(applyDeduction)
                    );
                    return updated;
                  });
                  setJobHistory((prev) => [job, ...prev]);
                }}
                onEditJob={editJob}
              />
            }
          />
          <Route
            path="/setup"
            element={
              <ProjectSetupPage
                projects={projects}
                activeProjectId={activeProjectId}
                activeProject={activeProject}
                onAddProject={addProject}
                onDeleteProject={deleteProject}
                onArchiveProject={archiveProject}
                onUnarchiveProject={unarchiveProject}
                onSwitchActiveProject={switchActiveProject}
                onSetProjectName={setProjectName}
                onAddTurbine={addTurbine}
                onUpdateTurbine={updateTurbine}
                onDeleteTurbine={deleteTurbine}
                onAddBlade={addBlade}
                onUpdateBlade={updateBlade}
                onDeleteBlade={deleteBlade}
                onAddDamage={addDamage}
                onUpdateDamage={updateDamage}
                onDeleteDamage={deleteDamage}
                jobHistory={jobHistory}
              />
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;