import { createBrowserRouter } from "react-router";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Dashboard } from "./components/Dashboard";
import { Goals } from "./components/Goals";
import { Installments } from "./components/Installments";
import { FutureCommitments } from "./components/FutureCommitments";
import { Settings } from "./components/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/register",
    Component: RegisterPage,
  },
  {
    path: "/goals",
    element: (
      <ProtectedRoute>
        <Goals />
      </ProtectedRoute>
    ),
  },
  {
    path: "/installments",
    element: (
      <ProtectedRoute>
        <Installments />
      </ProtectedRoute>
    ),
  },
  {
    path: "/future",
    element: (
      <ProtectedRoute>
        <FutureCommitments />
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    ),
  },
]);
