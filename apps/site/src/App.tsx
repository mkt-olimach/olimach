import { Navigate, Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { Home } from "./pages/Home";
import { Privacy } from "./pages/Privacy";
import { Validate } from "./pages/Validate";
import { ValidateResult } from "./pages/ValidateResult";

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/galeria" element={<Navigate to="/#galeria" replace />} />
        <Route path="/validar" element={<Validate />} />
        <Route path="/validar/:code" element={<ValidateResult />} />
        <Route path="/privacidade" element={<Privacy />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
