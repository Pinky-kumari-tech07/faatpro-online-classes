import { useWorkspace } from "@/shared/hooks/useWorkspace";
import AdminDashboard from "./views/AdminDashboard";
import InstructorDashboard from "./views/InstructorDashboard";
import StudentDashboard from "./views/StudentDashboard";

export default function DashboardContainer() {
  const { primaryRole } = useWorkspace();

  switch (primaryRole) {
    case "super_admin":
    case "organization_admin":
    case "staff":
      return <AdminDashboard />;
    case "instructor":
      return <InstructorDashboard />;
    case "student":
    case "parent":
    default:
      return <StudentDashboard />;
  }
}