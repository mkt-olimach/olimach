import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { Certificates } from "./pages/Certificates";
import { ClassDetail } from "./pages/ClassDetail";
import { Classes } from "./pages/Classes";
import { Courses } from "./pages/Courses";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { People } from "./pages/People";
import { Placeholder } from "./pages/Placeholder";
import { Students } from "./pages/Students";
import { ResetPassword } from "./pages/ResetPassword";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="/alunos" element={<Students />} />
        <Route path="/cursos" element={<Courses />} />
        <Route path="/turmas" element={<Classes />} />
        <Route path="/turmas/:id" element={<ClassDetail />} />
        <Route path="/certificados" element={<Certificates />} />
        <Route path="/instrutores" element={<People />} />
        <Route path="/relatorios" element={<Placeholder title="Relatórios" />} />
        <Route path="/configuracoes" element={<Placeholder title="Configurações" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
