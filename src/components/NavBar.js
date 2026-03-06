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
            {activeProject && (
              <span className="nav-project-name">{activeProject.name}</span>
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
    </header>
  );
}

export default NavBar;

