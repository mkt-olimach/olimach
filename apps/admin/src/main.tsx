import "@olimach/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { CompanyProvider } from "./lib/company";
import { ToastProvider } from "./lib/toast";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <CompanyProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </CompanyProvider>
    </BrowserRouter>
  </StrictMode>,
);
