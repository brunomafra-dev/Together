import { createBrowserRouter } from "react-router";
import { Dashboard } from "./components/Dashboard";
import { Goals } from "./components/Goals";
import { Installments } from "./components/Installments";
import { FutureCommitments } from "./components/FutureCommitments";
import { Settings } from "./components/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Dashboard,
  },
  {
    path: "/goals",
    Component: Goals,
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
