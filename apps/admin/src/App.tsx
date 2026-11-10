import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Placeholder } from "./pages/Placeholder";
import { ResetPassword } from "./pages/ResetPassword";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="/alunos" element={<Placeholder title="Alunos" />} />
        <Route path="/cursos" element={<Placeholder title="Cursos" />} />
        <Route path="/turmas" element={<Placeholder title="Turmas" />} />
        <Route path="/certificados" element={<Placeholder title="Certificados" />} />
        <Route path="/instrutores" element={<Placeholder title="Instrutores" />} />
        <Route path="/relatorios" element={<Placeholder title="Relatórios" />} />
        <Route path="/configuracoes" element={<Placeholder title="Configurações" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
