// src/components/ProtectedRoute.tsx
// Wrap any page with this to require login.
// If user has no token, they get sent to /login automatically.
// After login, they come back to the page they were trying to visit.

import { Navigate, useLocation } from "react-router-dom";
import { isLoggedIn } from "@/lib/api";

interface Props {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: Props) => {
  const location = useLocation();

  if (!isLoggedIn()) {
    // Save where they were trying to go so we can redirect after login
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;