# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # Start dev server (localhost:3000)
npm run build    # Production build
npm test         # Run tests in watch mode
npm test -- --watchAll=false  # Run tests once
```

## Architecture

**Vetra Van Inventory** is a React SPA for wind turbine blade repair teams to track materials and job history. No backend — all state is persisted to `localStorage`.

### State management
All application state lives in `src/App.js` as `useState` hooks. There is no external state library. `App.js` owns:
- `items` — inventory materials (`vetra-items`)
- `jobHistory` — submitted jobs (`vetra-jobs`)
- `projects` — wind farm projects with nested turbines → blades → damages (`vetra-projects`)
- `activeProjectId` — which project the Job Log operates against (`vetra-active-project-id`)

Each piece of state is synced to localStorage via a dedicated `useEffect`.

### Data model
The project hierarchy is deeply nested inside `projects` state:
```
Project → turbines[] → blades[] → damages[]
```
Mutations at any level (add/update/delete turbine, blade, damage) are handled by updater functions in `App.js` and passed as props to `ProjectSetupPage`. When a job is submitted or edited in `JobLogPage`, `App.js` recomputes inventory quantities by reversing old material deductions and applying new ones.

### Routing (react-router-dom v7)
| Path | Component |
|------|-----------|
| `/` | `InventoryPage` — material list, filters, add-item form |
| `/jobs` | `JobLogPage` — job log form, operations, job history, dashboard |
| `/setup` | `ProjectSetupPage` — project/turbine/blade/damage management |

### Component pattern
Pages are purely presentational — they receive all state and handlers as props from `App.js`. UI expand/collapse state (turbines, blades, damages) is kept locally in `ProjectSetupPage` and also persisted to localStorage (`vetra-expanded-*`).

### Styling
Single stylesheet `src/App.css` — no CSS modules or utility framework. All class names are written by hand. Dark theme using a slate/sky color palette. Responsive breakpoints at 600px, 768px, 900px, 1024px.

### Stock status
Items with `quantity === 0` get class `card-low` (red left border). Items with `quantity === 1 || 2` get `card-warning` (orange left border). Logic is in `getStockStatusClass` in `App.js`.

### Operation types (Job Log)
Predefined in `JobLogPage.js`: Grinding, Sanding Coarse, Sanding Fine, Lamination, Curing, Filler Application, Primer, Topcoat, Inspection, Vacuum Infusion, Custom.

### Damage attributes
Each damage has: `number` (e.g. "D1"), `type` (Erosion/Crack/Delamination/etc.), `radius` (mm, free text + presets 5000–50000), `locations` (multi-select: LE, TE, PS, SS, Root, Tip), `notes`.
