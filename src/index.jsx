import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { startFaviconAnimation } from "@/lib/animatedFavicon";

const stopFaviconAnimation = startFaviconAnimation();

if (import.meta.hot) {
  import.meta.hot.dispose(stopFaviconAnimation);
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
