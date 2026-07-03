import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "./index.css";

import WidgetPage from "./widget/WidgetPage";
import AdminLayout from "./admin/AdminLayout";
import Dashboard from "./admin/Dashboard";
import TenantList from "./admin/TenantList";
import TenantDetail from "./admin/TenantDetail";
import LeadsTable from "./admin/LeadsTable";
import TestConsole from "./test-console/TestConsole";
import Landing from "./admin/Landing";

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/widget", element: <WidgetPage /> },
  { path: "/embed", element: <WidgetPage bare /> },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/tenants" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "tenants", element: <TenantList /> },
      { path: "tenants/:id", element: <TenantDetail /> },
      { path: "leads", element: <LeadsTable /> },
    ],
  },
  // Test console is full-screen (its own chrome), outside the admin shell.
  { path: "/admin/tenants/:id/test", element: <TestConsole /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
