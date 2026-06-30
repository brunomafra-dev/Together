import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./app/routes";
import { AuthProvider } from "./app/context/AuthContext";
import { FinanceProvider } from "./app/context/FinanceContext";
import { Toaster } from "sonner";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <FinanceProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </FinanceProvider>
  </AuthProvider>,
);
