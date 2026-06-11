import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const DB_FILE = path.resolve(process.cwd(), "db-local.json");

function computePending(history: any[]) {
  return history
    .filter((h) => h.status === "pendiente")
    .reduce((sum, h) => sum + Number(h.amount || 0), 0);
}

async function main() {
  const users = [
    { _id: "user_superadmin", username: "superadmin", name: "Super Admin", email: "superadmin@vecindariotransparente.es", password: "superadmin123", role: "superadmin", status: "active", communityId: "comm_demo" },
    { _id: "user_presidente", username: "presidente", name: "Presidente Demo", email: "presidente@vecindariotransparente.es", password: "admin123", role: "presidente", status: "active", communityId: "comm_demo" },
    { _id: "user_vecino_juan", username: "vecino_juan", name: "Vecino Juan", email: "juan@vecindariotransparente.es", password: "vecino123", role: "vecino", status: "active", communityId: "comm_demo" }
  ];

  const communities = [
    { _id: "comm_demo", name: "Comunidad Demo", address: "Calle Demo 123", inviteCode: "ALAMEDA2026" }
  ];

  const properties = [
    { _id: "prop_1", block: "A", floor: "1", door: "1", balanceStatus: "", pendingAmount: 0, paymentHistory: [
      { date: "2025-01-15", amount: 85.5, concept: "Cuota mensual enero", status: "pagado" },
      { date: "2025-02-15", amount: 85.5, concept: "Cuota mensual febrero", status: "pagado" },
      { date: "2025-03-15", amount: 85.5, concept: "Cuota mensual marzo", status: "pendiente" }
    ], userId: "user_vecino_juan", communityId: "comm_demo" },
    { _id: "prop_2", block: "A", floor: "1", door: "2", balanceStatus: "", pendingAmount: 0, paymentHistory: [
      { date: "2025-01-15", amount: 85.5, concept: "Cuota mensual enero", status: "pagado" },
      { date: "2025-02-15", amount: 85.5, concept: "Cuota mensual febrero", status: "pagado" },
      { date: "2025-03-15", amount: 85.5, concept: "Cuota mensual marzo", status: "pagado" }
    ], userId: "user_presidente", communityId: "comm_demo" },
    { _id: "prop_3", block: "B", floor: "1", door: "1", balanceStatus: "", pendingAmount: 0, paymentHistory: [], userId: "user_superadmin", communityId: "comm_demo" }
  ];

  for (const p of properties) {
    const pend = computePending(p.paymentHistory);
    p.pendingAmount = pend;
    p.balanceStatus = pend > 0 ? "pendiente" : "al_dia";
  }

  const votes = [
    { _id: "vote_1", title: "Pintura fachada", description: "Presupuesto para pintar la fachada del edificio principal en color blanco", status: "closed", options: ["Si", "No"], castVotes: [
      { userId: "user_vecino_juan", userName: "Vecino Juan", option: "Si", timestamp: new Date(Date.now() - 172800000).toISOString() },
      { userId: "user_presidente", userName: "Presidente Demo", option: "Si", timestamp: new Date(Date.now() - 170000000).toISOString() }
    ], communityId: "comm_demo", createdDate: new Date(Date.now() - 604800000).toISOString(), endDate: new Date(Date.now() - 86400000).toISOString() },
    { _id: "vote_2", title: "Instalacion de camaras seguridad", description: "Instalar sistema de videovigilancia en zonas comunes y entrada principal", status: "active", options: ["A favor", "En contra", "Abstencion"], castVotes: [
      { userId: "user_vecino_juan", userName: "Vecino Juan", option: "A favor", timestamp: new Date(Date.now() - 43200000).toISOString() },
      { userId: "user_presidente", userName: "Presidente Demo", option: "A favor", timestamp: new Date(Date.now() - 40000000).toISOString() }
    ], communityId: "comm_demo", createdDate: new Date(Date.now() - 259200000).toISOString(), endDate: new Date(Date.now() + 604800000).toISOString() },
    { _id: "vote_3", title: "Nuevo horario piscina verano", description: "Ampliar horario de apertura de la piscina hasta las 22:00 en verano", status: "active", options: ["Si", "No"], castVotes: [
      { userId: "user_vecino_juan", userName: "Vecino Juan", option: "Si", timestamp: new Date(Date.now() - 10000000).toISOString() }
    ], communityId: "comm_demo", createdDate: new Date(Date.now() - 86400000).toISOString(), endDate: new Date(Date.now() + 1209600000).toISOString() }
  ];

  const finances = [
    { _id: "fin_1", type: "gasto", concept: "Luz portal", amount: 120.5, date: new Date(Date.now() - 2592000000).toISOString(), invoiceUrl: "", communityId: "comm_demo" },
    { _id: "fin_2", type: "gasto", concept: "Agua zonas comunes", amount: 89.0, date: new Date(Date.now() - 2592000000).toISOString(), invoiceUrl: "", communityId: "comm_demo" },
    { _id: "fin_3", type: "gasto", concept: "Limpieza mensual", amount: 450.0, date: new Date(Date.now() - 1209600000).toISOString(), invoiceUrl: "", communityId: "comm_demo" },
    { _id: "fin_4", type: "gasto", concept: "Mantenimiento ascensor", amount: 320.0, date: new Date(Date.now() - 604800000).toISOString(), invoiceUrl: "", communityId: "comm_demo" },
    { _id: "fin_5", type: "ingreso", concept: "Cuotas enero 2025", amount: 684.0, date: new Date(Date.now() - 2592000000).toISOString(), invoiceUrl: "", communityId: "comm_demo" },
    { _id: "fin_6", type: "ingreso", concept: "Cuotas febrero 2025", amount: 684.0, date: new Date(Date.now() - 1209600000).toISOString(), invoiceUrl: "", communityId: "comm_demo" }
  ];

  const bookings = [
    { _id: "book_1", facilityName: "Salon comunal", date: new Date(Date.now() + 86400000).toISOString(), startTime: "10:00", endTime: "14:00", propertyId: "prop_1", propertyName: "A-1-1", communityId: "comm_demo" },
    { _id: "book_2", facilityName: "Piscina", date: new Date(Date.now() + 172800000).toISOString(), startTime: "16:00", endTime: "18:00", propertyId: "prop_2", propertyName: "A-1-2", communityId: "comm_demo" }
  ];

  const issues = [];

  for (const u of users) {
    u.passwordHash = await bcrypt.hash(u.password, 10);
    delete u.password;
  }

  const data = {
    users,
    communities,
    properties,
    votes,
    finances,
    bookings,
    issues,
    subscriptions: []
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  console.log("db-local.json regenerado con 3 usuarios.");
}

main().catch(console.error);
