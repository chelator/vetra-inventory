import React, { useState } from "react";
import { useAuth } from "./AuthContext";

function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-emoji" aria-hidden="true">&#127744;</span>
          <h1 className="auth-title">Vetra Van</h1>
          <p className="auth-subtitle">Wind Turbine Blade Repair Inventory</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2 className="auth-form-title">{isRegister ? "Create Account" : "Sign In"}</h2>

          {error && <div className="auth-error">{error}</div>}

          {isRegister && (
            <div className="field">
              <label htmlFor="auth-name">Name</label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? "Min 6 characters" : "Your password"}
              required
              minLength={isRegister ? 6 : undefined}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          <button type="submit" className="primary-button auth-submit" disabled={loading}>
            {loading ? "..." : isRegister ? "Create Account" : "Sign In"}
          </button>

          <button
            type="button"
            className="auth-switch"
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
          >
            {isRegister ? "Already have an account? Sign in" : "Need an account? Register"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
