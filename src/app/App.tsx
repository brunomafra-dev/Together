import { RouterProvider } from "react-router";
import { router } from "./routes";
import { FinanceProvider } from "./context/FinanceContext";
import { useCategoriesConnectionCheck } from "../lib/use-categories-connection-check";

export default function App() {
  useCategoriesConnectionCheck();
  return (
    <FinanceProvider>
      <RouterProvider router={router} />
    </FinanceProvider>
  );
}
