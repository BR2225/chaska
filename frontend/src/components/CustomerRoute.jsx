import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function CustomerRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]" aria-label="Checking your account">
        <Loader2 className="h-6 w-6 animate-spin text-[#D96C4A]" aria-hidden="true" />
      </div>
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
