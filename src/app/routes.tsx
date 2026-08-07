import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

const Dashboard = lazy(() =>
  import("./components/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const Goals = lazy(() =>
  import("./components/Goals").then((module) => ({ default: module.Goals })),
);
const Installments = lazy(() =>
  import("./components/Installments").then((module) => ({ default: module.Installments })),
);
const FutureCommitments = lazy(() =>
  import("./components/FutureCommitments").then((module) => ({
    default: module.FutureCommitments,
  })),
);
const Settings = lazy(() =>
  import("./components/Settings").then((module) => ({ default: module.Settings })),
);

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-500">
      Carregando...
    </div>
  );
}

function ProtectedPage({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedPage>
        <Dashboard />
      </ProtectedPage>
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
      <ProtectedPage>
        <Goals />
      </ProtectedPage>
    ),
  },
  {
    path: "/installments",
    element: (
      <ProtectedPage>
        <Installments />
      </ProtectedPage>
    ),
  },
  {
    path: "/future",
    element: (
      <ProtectedPage>
        <FutureCommitments />
      </ProtectedPage>
    ),
  },
  {
    path: "/settings",
    element: (
      <ProtectedPage>
        <Settings />
      </ProtectedPage>
    ),
  },
]);
