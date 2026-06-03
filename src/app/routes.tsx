import { createBrowserRouter } from "react-router";
import { Dashboard } from "./components/Dashboard";
import { Installments } from "./components/Installments";
import { FutureCommitments } from "./components/FutureCommitments";
import { Settings } from "./components/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Dashboard,
  },
  {
    path: "/installments",
    Component: Installments,
  },
  {
    path: "/future",
    Component: FutureCommitments,
  },
  {
    path: "/settings",
    Component: Settings,
  },
]);
