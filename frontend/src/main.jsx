// C:\Dev\Chatr\src\main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// ✅ FIX: correct relative path to your stylesheet folder
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
