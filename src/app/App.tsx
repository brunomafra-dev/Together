import { RouterProvider } from "react-router";
import { router } from "./routes";
import { FinanceProvider } from "./context/FinanceContext";

export default function App() {
  return (
    <FinanceProvider>
      <RouterProvider router={router} />
    </FinanceProvider>
  );
}
