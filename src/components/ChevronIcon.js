import React from "react";

const ChevronIcon = ({ up }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: up ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", display: "block" }}
    aria-hidden="true">
    <polyline points="2,5 7,10 12,5" />
  </svg>
);

export default ChevronIcon;
