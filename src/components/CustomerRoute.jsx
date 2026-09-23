import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ChaskaLoader from "@/components/ChaskaLoader";

export default function CustomerRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <ChaskaLoader label="Checking your account" />
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location, reason: location.pathname.slice(1) || "account" }} replace />;
  }

  if (user.role !== "customer") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}
