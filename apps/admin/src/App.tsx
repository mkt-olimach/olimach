import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { Certificates } from "./pages/Certificates";
import { ClassDetail } from "./pages/ClassDetail";
import { Classes } from "./pages/Classes";
import { Courses } from "./pages/Courses";
import { Dashboard } from "./pages/Dashboard";
import { Exams } from "./pages/Exams";
import { Gallery } from "./pages/Gallery";
import { Login } from "./pages/Login";
import { People } from "./pages/People";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import { Students } from "./pages/Students";
import { WhiteLabel } from "./pages/WhiteLabel";
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
        <Route path="/provas" element={<Exams />} />
        <Route path="/galeria" element={<Gallery />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/configuracoes" element={<Settings />} />
        <Route path="/white-label" element={<WhiteLabel />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
