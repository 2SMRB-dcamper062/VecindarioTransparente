import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

// Definitions matching the requested mongoose collections
export interface User {
  _id: string;
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl: string;
  role: "superadmin" | "admin" | "owner" | "tenant";
  status: "approved" | "pending";
  communityId?: string; // Optional for superadmin
}

export interface Community {
  _id: string;
  name: string;
  address: string;
  inviteCode: string;
}

export interface PropertyHistoryItem {
  date: string;
  amount: number;
  concept: string;
  status: "pagado" | "pendiente";
}

export interface Property {
  _id: string;
  block: string;
  floor: string;
  door: string;
  balanceStatus: "al_dia" | "pendiente";
  pendingAmount: number;
  paymentHistory: PropertyHistoryItem[];
  userId?: string; // Associated user id
  communityId: string;
}

export interface CastVote {
  userId: string;
  userName: string;
  option: string;
  timestamp: string;
}

export interface Vote {
  _id: string;
  title: string;
  description: string;
  status: "active" | "closed";
  options: string[];
  castVotes: CastVote[];
  communityId: string;
  createdDate: string;
  endDate: string;
}

export interface Finance {
  _id: string;
  type: "gasto" | "ingreso";
  concept: string;
  amount: number;
  date: string;
  invoiceUrl?: string;
  communityId: string;
}

export interface Booking {
  _id: string;
  facilityName: string; // "Piscina" | "Pista de Pádel" | "Gimnasio"
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  propertyId: string; // ID representation of property
  propertyName: string; // "Portal A, 1º B"
  communityId: string;
}

export interface Issue {
  _id: string;
  title: string;
  description: string;
  category: string; // "fontaneria" | "electricidad" | "ascensor" | "limpieza" | "otros"
  photo?: string; // Base64 representation
  status: "pendiente" | "en_proceso" | "resuelto";
  reporterName: string;
  reporterProperty: string;
  date: string;
  communityId: string;
}

export interface PushSubscriptionItem {
  _id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  communityId: string;
}

const DB_FILE = path.join(process.cwd(), "db-local.json");

interface DatabaseSchema {
  users: User[];
  communities: Community[];
  properties: Property[];
  votes: Vote[];
  finances: Finance[];
  bookings: Booking[];
  issues: Issue[];
  subscriptions: PushSubscriptionItem[];
}

class LocalDB {
  private data: DatabaseSchema = {
    users: [],
    communities: [],
    properties: [],
    votes: [],
    finances: [],
    bookings: [],
    issues: [],
    subscriptions: []
  };

  constructor() {
    this.load();
  }

  private load() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        this.data = JSON.parse(raw);
        if (!this.data.issues) this.data.issues = [];
        if (!this.data.subscriptions) this.data.subscriptions = [];
        if (!this.data.users) this.data.users = [];
        if (!this.data.properties) this.data.properties = [];
        if (!this.data.votes) this.data.votes = [];
        if (!this.data.finances) this.data.finances = [];
        if (!this.data.bookings) this.data.bookings = [];
      } catch (e) {
        console.error("Error reading database file, resetting:", e);
        this.seed();
      }
    } else {
      this.seed();
    }
  }

  public save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (e) {
      console.error("Error writing to database file:", e);
    }
  }

  private seed() {
    console.log("Seeding initial VecindarioTransparente mock data...");
    
    // Default Community
    const communityId = "com_alameda";
    const community: Community = {
      _id: communityId,
      name: "Residencial Alameda",
      address: "Calle de la Transparencia 42, Madrid",
      inviteCode: "ALAMEDA2026"
    };    // Users (Default Admin, SuperAdmin and Default Vecinos)
    const superPassHash = bcrypt.hashSync("superadmin123", 10);
    const adminPassHash = bcrypt.hashSync("admin123", 10);
    const vecinoPassHash = bcrypt.hashSync("vecino123", 10);

    const userSuperAdmin: User = {
      _id: "user_superadmin",
      username: "superadmin",
      name: "Soporte Global Vecindario",
      email: "soporte@vecindariotransparente.es",
      passwordHash: superPassHash,
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=superglobal",
      role: "superadmin",
      status: "approved"
    };

    const userAdmin: User = {
      _id: "user_presidente",
      username: "presidente",
      name: "Don Carlos Gómez",
      email: "presidente@alameda.es",
      passwordHash: adminPassHash,
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=carlos",
      role: "admin",
      status: "approved",
      communityId
    };

    const userVecino1: User = {
      _id: "user_vecino1",
      username: "vecino_juan",
      name: "Juan Martínez",
      email: "juan@alameda.es",
      passwordHash: vecinoPassHash,
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=juan",
      role: "owner",
      status: "approved",
      communityId
    };

    const userVecino2: User = {
      _id: "user_vecino2",
      username: "vecina_maria",
      name: "María Rodríguez",
      email: "maria@alameda.es",
      passwordHash: vecinoPassHash,
      avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=maria",
      role: "tenant",
      status: "approved",
      communityId
    };

    // Properties
    const prop1: Property = {
      _id: "prop_1",
      block: "A",
      floor: "2º",
      door: "B",
      balanceStatus: "al_dia",
      pendingAmount: 0,
      paymentHistory: [
        { date: "2026-06-01", amount: 80, concept: "Cuota Ordinaria Junio 2026", status: "pagado" },
        { date: "2026-05-01", amount: 80, concept: "Cuota Ordinaria Mayo 2026", status: "pagado" },
        { date: "2026-04-15", amount: 150, concept: "Derrama Fachada (1/3)", status: "pagado" }
      ],
      userId: "user_vecino1",
      communityId
    };

    const prop2: Property = {
      _id: "prop_2",
      block: "B",
      floor: "1º",
      door: "A",
      balanceStatus: "pendiente",
      pendingAmount: 120,
      paymentHistory: [
        { date: "2026-06-01", amount: 80, concept: "Cuota Ordinaria Junio 2026", status: "pendiente" },
        { date: "2026-05-01", amount: 80, concept: "Cuota Ordinaria Mayo 2026", status: "pagado" },
        { date: "2026-04-15", amount: 40, concept: "Cuota Climatización Extraordinaria", status: "pendiente" }
      ],
      userId: "user_vecino2",
      communityId
    };

    const propPresidente: Property = {
      _id: "prop_3",
      block: "A",
      floor: "Ático",
      door: "A",
      balanceStatus: "al_dia",
      pendingAmount: 0,
      paymentHistory: [
        { date: "2026-06-01", amount: 84, concept: "Cuota Ordinaria Junio 2026", status: "pagado" },
        { date: "2026-05-01", amount: 84, concept: "Cuota Ordinaria Mayo 2026", status: "pagado" }
      ],
      userId: "user_presidente",
      communityId
    };

    // Votes
    const vote1: Vote = {
      _id: "vote_grass",
      title: "Sustitución césped de la piscina",
      description: "Propuesta para cambiar el césped artificial actual (deteriorado por el sol) por un césped de alta densidad, con tratamiento UV y mejor drenaje. Presupuesto total: 1.200 € sin derrama extraordinaria (se asume con fondos de reserva).",
      status: "active",
      options: ["A Favor", "En Contra", "Abstention"],
      castVotes: [
        { userId: "user_vecino1", userName: "Juan Martínez", option: "A Favor", timestamp: "2026-06-08T14:30:00Z" }
      ],
      communityId,
      createdDate: "2026-06-05T08:00:00Z",
      endDate: "2026-06-20T23:59:59Z"
    };

    const vote2: Vote = {
      _id: "vote_painting",
      title: "Pintura del portal principal",
      description: "Aprobar el presupuesto de Pinturas López SL para pintar el portal principal y los pasillos de los portales A y B de color crema suave. Coste: 850 €.",
      status: "active",
      options: ["A Favor", "En Contra", "Abstention"],
      castVotes: [],
      communityId,
      createdDate: "2026-06-08T09:00:00Z",
      endDate: "2026-06-25T23:59:59Z"
    };

    const vote3: Vote = {
      _id: "vote_clima",
      title: "Instalación de toldo de protección en zona infantil",
      description: "Votación de urgencia para colocar una vela de protección solar en el arenero infantil para proteger a los niños durante las tardes de verano. Importe: 450 €.",
      status: "closed",
      options: ["A Favor", "En Contra", "Abstention"],
      castVotes: [
        { userId: "user_vecino1", userName: "Juan Martínez", option: "A Favor", timestamp: "2026-06-01T12:00:00Z" },
        { userId: "user_vecino2", userName: "María Rodríguez", option: "A Favor", timestamp: "2026-06-02T11:00:00Z" },
        { userId: "user_presidente", userName: "Don Carlos Gómez", option: "A Favor", timestamp: "2026-06-01T10:00:00Z" }
      ],
      communityId,
      createdDate: "2026-05-30T08:00:00Z",
      endDate: "2026-06-05T20:00:00Z"
    };

    // Finances
    const finances: Finance[] = [
      { _id: "fin_1", type: "ingreso", concept: "Recaudación Cuotas Ordinarias Junio 2026", amount: 2480, date: "2026-06-01", communityId },
      { _id: "fin_2", type: "gasto", concept: "Mantenimiento Ascensores OTIS (Mensual)", amount: 145.20, date: "2026-06-02", invoiceUrl: "/factura-otis.pdf", communityId },
      { _id: "fin_3", type: "gasto", concept: "Servicio de Limpieza Grupo Neto (Junio)", amount: 480.00, date: "2026-06-05", invoiceUrl: "/factura-limpieza.pdf", communityId },
      { _id: "fin_4", type: "ingreso", concept: "Subvención Eficiencia Energética Ayuntamiento", amount: 1500, date: "2026-06-06", communityId },
      { _id: "fin_5", type: "gasto", concept: "Reparación electrobomba de riego", amount: 181.50, date: "2026-06-07", invoiceUrl: "/factura-bomba.pdf", communityId }
    ];

    // Bookings
    const today = new Date().toISOString().split("T")[0]; // Use current local time representation
    const tomorrowDateRef = new Date();
    tomorrowDateRef.setDate(tomorrowDateRef.getDate() + 1);
    const tomorrow = tomorrowDateRef.toISOString().split("T")[0];

    const bookings: Booking[] = [
      {
        _id: "book_1",
        facilityName: "Pista de Pádel",
        date: today,
        startTime: "18:00",
        endTime: "19:30",
        propertyId: "prop_1",
        propertyName: "B-2º B (Juan Martínez)",
        communityId
      },
      {
        _id: "book_2",
        facilityName: "Pista de Pádel",
        date: today,
        startTime: "19:30",
        endTime: "21:00",
        propertyId: "prop_3",
        propertyName: "A-Ático A (Carlos Gómez)",
        communityId
      },
      {
        _id: "book_3",
        facilityName: "Salón Social",
        date: tomorrow,
        startTime: "17:00",
        endTime: "21:00",
        propertyId: "prop_2",
        propertyName: "B-1º A (María Rodríguez)",
        communityId
      }
    ];

    // Seeding issues
    const seedIssue1: Issue = {
      _id: "issue_1",
      title: "Rotura de tubería en sótano -1",
      description: "Se ha detectado una fuga de agua constante que inunda la plaza 23 del sótano -1. Urge fontanero.",
      category: "fontaneria",
      photo: "",
      status: "en_proceso",
      reporterName: "Juan Martínez",
      reporterProperty: "B - 2º B",
      date: "2026-06-08",
      communityId
    };

    const seedIssue2: Issue = {
      _id: "issue_2",
      title: "Bombilla fundida portal A",
      description: "La segunda bombilla del rellano del portal A de la 3ª planta está parpadeando y se apaga.",
      category: "electricidad",
      photo: "",
      status: "pendiente",
      reporterName: "Don Carlos Gómez",
      reporterProperty: "A - Ático A",
      date: "2026-06-09",
      communityId
    };

    this.data = {
      users: [userSuperAdmin, userAdmin, userVecino1, userVecino2],
      communities: [community],
      properties: [prop1, prop2, propPresidente],
      votes: [vote1, vote2, vote3],
      finances,
      bookings,
      issues: [seedIssue1, seedIssue2],
      subscriptions: []
    };

    this.save();
  }

  /** Restablece la base de datos local con datos de demostración. */
  public reseed() {
    this.seed();
    console.log("Base de datos local resembrada correctamente.");
  }

  // API helper accessors
  public getUsers() { return this.data.users; }
  public getCommunities() { return this.data.communities; }
  public getProperties() { return this.data.properties; }
  public getVotes() { return this.data.votes; }
  public getFinances() { return this.data.finances; }
  public getBookings() { return this.data.bookings; }
  public getIssues() { return this.data.issues; }
  public getSubscriptions() { return this.data.subscriptions; }
}

export const dbSource = new LocalDB();
