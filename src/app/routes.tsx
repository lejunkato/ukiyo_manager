import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import RoomOrder from "./pages/RoomOrder";
import AdminMenu from "./pages/AdminMenu";
import AdminOrders from "./pages/AdminOrders";
import AdminRooms from "./pages/AdminRooms";
import AdminLogin from "./pages/AdminLogin";
import ProtectedRoute from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/room/:roomId",
    Component: RoomOrder,
  },
  {
    path: "/admin/login",
    Component: AdminLogin,
  },
  {
    path: "/admin/menu",
    element: (
      <ProtectedRoute>
        <AdminMenu />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/orders",
    element: (
      <ProtectedRoute>
        <AdminOrders />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/rooms",
    element: (
      <ProtectedRoute>
        <AdminRooms />
      </ProtectedRoute>
    ),
  },
]);
