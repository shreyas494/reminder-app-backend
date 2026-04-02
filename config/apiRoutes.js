import authRoutes from "../routes/authRoutes.js";
import adminRoutes from "../routes/adminRoutes.js";
import reminderRoutes from "../routes/reminderRoutes.js";
import contactRoutes from "../routes/contacts.js";
import quotationRoutes from "../routes/quotationRoutes.js";
import serviceTypeRoutes from "../routes/serviceTypeRoutes.js";

export const API_ROUTES = [
  { path: "/api/auth", router: authRoutes, label: "Auth" },
  { path: "/api/admin", router: adminRoutes, label: "Admin" },
  { path: "/api/reminders", router: reminderRoutes, label: "Reminders" },
  { path: "/api/contacts", router: contactRoutes, label: "Contacts" },
  { path: "/api/quotations", router: quotationRoutes, label: "Quotations" },
  { path: "/api/service-types", router: serviceTypeRoutes, label: "Service Types" },
];

export function registerApiRoutes(app) {
  API_ROUTES.forEach(({ path, router }) => {
    app.use(path, router);
  });
}
