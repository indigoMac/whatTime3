import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";

// Import global styles including Tailwind CSS
import "../styles/globals.css";

/* global document, Office, module, require */

const title = "What Time";

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

/* Render application after Office initializes */
Office.onReady(() => {
  root?.render(<App title={title} />);
});

if ((module as any).hot) {
  (module as any).hot.accept("./components/App", () => {
    const NextApp = require("./components/App").default;
    root?.render(<NextApp title={title} />);
  });
}
