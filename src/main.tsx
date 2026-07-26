import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Enforce default dark theme mode on app launch
const savedTheme = localStorage.getItem("varta_theme") || "dark";
document.documentElement.classList.remove("dark", "amoled", "midnight");
document.documentElement.classList.add(savedTheme === "amoled" ? "amoled" : savedTheme === "midnight" ? "midnight" : "dark");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
