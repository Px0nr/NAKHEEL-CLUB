import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/tajawal/900.css";
import NakheelSystemRoot from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <NakheelSystemRoot />
  </React.StrictMode>
);
