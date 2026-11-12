import "@olimach/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { CompanyProvider } from "./lib/company";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CompanyProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CompanyProvider>
  </StrictMode>,
);
