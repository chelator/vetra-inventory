import React, { useState } from "react";
import { NavLink } from "react-router-dom";

// Top-level navigation between Inventory, Job Log, and Project Setup pages.
function NavBar({ activeProject }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="nav-wrapper">
      <nav className="nav-bar">
        <div className="nav-left">
          <div className="nav-brand">
            <span className="nav-emoji" aria-hidden="true">
              🌬️
            </span>
            <span className="nav-title">Vetra Van</span>
            {activeProject ? (
              <span className="nav-project-name">{activeProject.name}</span>
            ) : (
              <span className="nav-project-name nav-project-none">No project</span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="nav-toggle"
          aria-label="Toggle navigation"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="nav-links nav-links-desktop">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive ? "nav-link nav-link-active" : "nav-link"
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/jobs"
            className={({ isActive }) =>
              isActive ? "nav-link nav-link-active" : "nav-link"
            }
          >
            Job Log
          </NavLink>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? "nav-link nav-link-active" : "nav-link"
            }
          >
            Inventory
          </NavLink>
          <NavLink
            to="/repair-drawing"
            className={({ isActive }) =>
              isActive ? "nav-link nav-link-active" : "nav-link"
            }
          >
            Repair Drawing
          </NavLink>
          <NavLink
            to="/setup"
            className={({ isActive }) =>
              isActive ? "nav-link nav-link-active" : "nav-link"
            }
          >
            Project Setup
          </NavLink>
        </div>
      </nav>

      <div className={`nav-links-mobile ${isOpen ? "open" : ""}`}>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            isActive ? "nav-link nav-link-active" : "nav-link"
          }
          onClick={() => setIsOpen(false)}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/jobs"
          className={({ isActive }) =>
            isActive ? "nav-link nav-link-active" : "nav-link"
          }
          onClick={() => setIsOpen(false)}
        >
          Job Log
        </NavLink>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "nav-link nav-link-active" : "nav-link"
          }
          onClick={() => setIsOpen(false)}
        >
          Inventory
        </NavLink>
        <NavLink
          to="/repair-drawing"
          className={({ isActive }) =>
            isActive ? "nav-link nav-link-active" : "nav-link"
          }
          onClick={() => setIsOpen(false)}
        >
          Repair Drawing
        </NavLink>
        <NavLink
          to="/setup"
          className={({ isActive }) =>
            isActive ? "nav-link nav-link-active" : "nav-link"
          }
          onClick={() => setIsOpen(false)}
        >
          Project Setup
        </NavLink>
      </div>

      <nav className="nav-bottom-tabs">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            isActive ? "nav-bottom-tab nav-bottom-tab-active" : "nav-bottom-tab"
          }
        >
          <svg className="nav-bottom-tab-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="6" height="6" /><rect x="11" y="3" width="6" height="6" /><rect x="3" y="11" width="6" height="6" /><rect x="11" y="11" width="6" height="6" />
          </svg>
          <span>Dash</span>
        </NavLink>
        <NavLink
          to="/jobs"
          className={({ isActive }) =>
            isActive ? "nav-bottom-tab nav-bottom-tab-active" : "nav-bottom-tab"
          }
        >
          <svg className="nav-bottom-tab-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" /><line x1="7" y1="7" x2="13" y2="7" /><line x1="7" y1="10" x2="13" y2="10" /><line x1="7" y1="13" x2="10" y2="13" />
          </svg>
          <span>Jobs</span>
        </NavLink>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "nav-bottom-tab nav-bottom-tab-active" : "nav-bottom-tab"
          }
        >
          <svg className="nav-bottom-tab-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7l6-4 6 4v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" /><line x1="8" y1="17" x2="8" y2="11" /><line x1="12" y1="17" x2="12" y2="11" />
          </svg>
          <span>Van</span>
        </NavLink>
        <NavLink
          to="/repair-drawing"
          className={({ isActive }) =>
            isActive ? "nav-bottom-tab nav-bottom-tab-active" : "nav-bottom-tab"
          }
        >
          <svg className="nav-bottom-tab-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" />
          </svg>
          <span>Draw</span>
        </NavLink>
        <NavLink
          to="/setup"
          className={({ isActive }) =>
            isActive ? "nav-bottom-tab nav-bottom-tab-active" : "nav-bottom-tab"
          }
        >
          <svg className="nav-bottom-tab-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="3" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
          </svg>
          <span>Setup</span>
        </NavLink>
      </nav>
    </header>
  );
}

export default NavBar;

