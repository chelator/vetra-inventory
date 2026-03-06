import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "2rem",
          maxWidth: "500px",
          margin: "4rem auto",
          fontFamily: "'DM Sans', sans-serif",
          textAlign: "center",
        }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", marginBottom: "0.5rem" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#4A4845", marginBottom: "1rem", fontSize: "0.9rem" }}>
            {this.props.fallbackMessage || "An unexpected error occurred. Your data is safe."}
          </p>
          <pre style={{
            background: "#F5F4F0",
            padding: "1rem",
            borderRadius: "4px",
            fontSize: "0.75rem",
            textAlign: "left",
            overflow: "auto",
            maxHeight: "150px",
            marginBottom: "1rem",
            color: "#E63329",
          }}>
            {this.state.error?.message || "Unknown error"}
          </pre>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
            }}
            style={{
              padding: "0.6rem 1.5rem",
              background: "#1A1917",
              color: "white",
              border: "none",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              marginRight: "0.5rem",
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.6rem 1.5rem",
              background: "transparent",
              color: "#1A1917",
              border: "2px solid #1A1917",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
