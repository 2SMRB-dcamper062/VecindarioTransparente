import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import http from "http";
import multer from "multer";
import { WebSocketServer, WebSocket as WS } from "ws";
import { createServer as createViteServer } from "vite";
import { dbSource, User, Community, Property, Vote, Finance, Booking, CastVote, PropertyHistoryItem, Issue, PushSubscriptionItem } from "./src/db/localDb.js";
import webpush from "web-push";
import { GoogleGenAI } from "@google/genai";

// Optional real Mongoose connection logic for MongoDB Atlas
import mongoose from "mongoose";

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "vecindario-transparente-secret-2026";
const MONGODB_URI = process.env.MONGODB_URI;

// Web Push VAPID keys setup
let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "",
  privateKey: process.env.VAPID_PRIVATE_KEY || ""
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  try {
    const keys = webpush.generateVAPIDKeys();
    vapidKeys.publicKey = keys.publicKey;
    vapidKeys.privateKey = keys.privateKey;
    console.log("¡Llaves VAPID de notificación Push generadas automáticamente para esta sesión!");
    console.log("Key Pública VAPID:", keys.publicKey);
  } catch (err: any) {
    console.error("No se pudieron generar VAPID keys automáticas:", err.message);
  }
}

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    "mailto:soporte@vecindariotransparente.es",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

// Resilient Gemini Client configuration (Lazy loading to avoid startup crashes)
let aiClient: any = null;
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta la variable de entorno GEMINI_API_KEY. Configúrala en el panel de Settings > Secrets.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
};

// Establish database strategy
let isUsingMongoDB = false;

if (MONGODB_URI) {
  try {
    console.log("Intentando conectar a MongoDB Atlas...");
    mongoose.connect(MONGODB_URI)
      .then(() => {
        isUsingMongoDB = true;
        console.log("¡Conectado exitosamente a MongoDB Atlas!");
      })
      .catch((err) => {
        console.error("Fallo al conectar a MongoDB. Utilizando sistema de persistencia local resiliente.", err.message);
      });
  } catch (e: any) {
    console.error("Esquema de URI inválido u otros errores de Mongoose, fallback al almacenamiento local:", e.message);
  }
} else {
  console.log("No se detectó MONGODB_URI en .env. Se usará el almacenamiento local persistente JSON (db-local.json) con datos pre-sembrados.");
}

// ---------------- Mongoose Schema Definitions for Reference & Atlas Use ----------------
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatarUrl: String,
  role: { type: String, enum: ["admin", "vecino", "presidente"], default: "vecino" },
  status: { type: String, enum: ["active", "pending"], default: "active" },
  communityId: String
});

const CommunitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  inviteCode: { type: String, required: true, unique: true }
});

const PropertySchema = new mongoose.Schema({
  block: String,
  floor: String,
  door: String,
  balanceStatus: { type: String, enum: ["al_dia", "pendiente"], default: "al_dia" },
  pendingAmount: { type: Number, default: 0 },
  paymentHistory: [
    {
      date: String,
      amount: Number,
      concept: String,
      status: { type: String, enum: ["pagado", "pendiente"] }
    }
  ],
  userId: String,
  communityId: String
});

const VoteSchema = new mongoose.Schema({
  title: String,
  description: String,
  status: { type: String, enum: ["active", "closed"], default: "active" },
  options: [String],
  castVotes: [
    {
      userId: String,
      userName: String,
      option: String,
      timestamp: String
    }
  ],
  communityId: String,
  createdDate: String,
  endDate: String
});

const FinanceSchema = new mongoose.Schema({
  type: { type: String, enum: ["gasto", "ingreso"], required: true },
  concept: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  invoiceUrl: String,
  communityId: String
});

const BookingSchema = new mongoose.Schema({
  facilityName: { type: String, required: true },
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  propertyId: { type: String, required: true },
  propertyName: { type: String, required: true },
  communityId: String
});

// We only compile Mongoose models if connected to standard database,
// otherwise our JSON driver functions as the data repository
const MongooseUserObj = mongoose.models.User || mongoose.model("User", UserSchema);
const MongooseCommunityObj = mongoose.models.Community || mongoose.model("Community", CommunitySchema);
const MongoosePropertyObj = mongoose.models.Property || mongoose.model("Property", PropertySchema);
const MongooseVoteObj = mongoose.models.Vote || mongoose.model("Vote", VoteSchema);
const MongooseFinanceObj = mongoose.models.Finance || mongoose.model("Finance", FinanceSchema);
const MongooseBookingObj = mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

// ---------------- Express Application Instantiation ----------------
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Multer file upload error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err && typeof err.message === "string" && err.message.includes("Sólo se permiten archivos de imagen")) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Context-Aware User Request Interface
interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: "superadmin" | "admin" | "owner" | "tenant";
    communityId?: string;
  };
  file?: Express.Multer.File;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB máximo por imagen
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Sólo se permiten archivos de imagen para el reporte de incidencias."));
      return;
    }
    cb(null, true);
  }
});

// Security Authentication Middleware
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "No se proporcionó token de autorización o es inválido." });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      res.status(403).json({ error: "Token inválido o expirado. Vuelva a iniciar sesión." });
      return;
    }
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      communityId: decoded.communityId
    };
    next();
  });
};

// ---------------- REST API Endpoints ----------------

// Base Health check
app.get("/api/health", (req, res) => {
  const users = dbSource.getUsers();
  res.json({
    status: "online",
    database: isUsingMongoDB ? "MongoDB Atlas" : "Local JSON Store Fallback",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    demoUsers: users.length,
    time: new Date().toISOString()
  });
});

// Resembrar base de datos local (solo desarrollo)
if (process.env.NODE_ENV !== "production") {
  app.post("/api/dev/seed", (req, res) => {
    try {
      dbSource.reseed();
      res.json({
        message: "Base de datos local resembrada con datos de demostración.",
        users: dbSource.getUsers().map(u => ({ username: u.username, role: u.role, name: u.name }))
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Auth / Register: Formulario de Registro Completo con Roles y Estados Estrictos
app.post("/api/auth/register", async (req, res) => {
  const { username, name, email, password, inviteCode, role, block, floor, door } = req.body;

  if (!username || !name || !email || !password || !inviteCode || !role) {
    res.status(400).json({ error: "Todos los campos obligatorios de registro (usuario, nombre, email, password, código, rol) deben ser provistos." });
    return;
  }

  const requestedRole = role.toLowerCase();
  if (!["admin", "owner", "tenant"].includes(requestedRole)) {
    res.status(400).json({ error: "El rol solicitado no es válido. Debe elegir entre Administrador, Propietario o Inquilino." });
    return;
  }

  try {
    // 1. Validate community exists (matches invite code)
    const normalizedCode = inviteCode.trim().toUpperCase();
    const community = dbSource.getCommunities().find(c => c.inviteCode.toUpperCase() === normalizedCode);

    if (!community) {
      res.status(400).json({ error: "El código de invitación ingresado no pertenece a ninguna comunidad activa." });
      return;
    }

    // 2. Check duplicate username or email
    const users = dbSource.getUsers();
    const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      res.status(400).json({ error: "El nombre de usuario o el correo electrónico ya se encuentra registrado." });
      return;
    }

    // 3. Create Password Hash
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = "user_" + Math.random().toString(36).substring(2, 9);
    
    // Dicebear avatar for elegant aesthetic customization
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

    // Admin goes approved immediately, owned and tenant start as "pending"
    const isNeighbor = requestedRole === "owner" || requestedRole === "tenant";
    const autoApproved = req.body.autoApproved === true || req.body.autoApproved === "true";
    const initialStatus = isNeighbor ? (autoApproved ? "approved" : "pending") : "approved";

    const newUser: User = {
      _id: userId,
      username,
      name,
      email,
      passwordHash,
      avatarUrl,
      role: requestedRole as any,
      status: initialStatus,
      communityId: community._id
    };

    // 4. Create property association for user if neighbor
    if (isNeighbor) {
      const propertyId = "prop_" + Math.random().toString(36).substring(2, 9);
      const newProperty: Property = {
        _id: propertyId,
        block: block || "A",
        floor: floor || "1º",
        door: door || "A",
        balanceStatus: "al_dia", // clean by default
        pendingAmount: 0,
        paymentHistory: [
          {
            date: new Date().toISOString().split("T")[0],
            amount: 0,
            concept: "Matrícula de Alta de Vecino en espera de aprobación",
            status: "pagado"
          }
        ],
        userId: userId,
        communityId: community._id
      };
      dbSource.getProperties().push(newProperty);
    } else {
      // Create admin placeholder property or none
      const propertyId = "prop_" + Math.random().toString(36).substring(2, 9);
      const newProperty: Property = {
        _id: propertyId,
        block: "Admin",
        floor: "0º",
        door: "0",
        balanceStatus: "al_dia",
        pendingAmount: 0,
        paymentHistory: [],
        userId: userId,
        communityId: community._id
      };
      dbSource.getProperties().push(newProperty);
    }

    // Write to DB
    dbSource.getUsers().push(newUser);
    dbSource.save();

    // 5. Generate Access Token JWT
    const token = jwt.sign(
      { userId: newUser._id, username: newUser.username, role: newUser.role, communityId: newUser.communityId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: isNeighbor 
        ? "¡Registro inicial completado! Su solicitud está en estado 'Pendiente' esperando aprobación del Administrador de su bloque."
        : "¡Administrador de comunidad registrado y activado exitosamente!",
      token,
      user: {
        userId: newUser._id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        avatarUrl: newUser.avatarUrl,
        role: newUser.role,
        status: newUser.status,
        communityId: newUser.communityId
      }
    });

  } catch (error: any) {
    res.status(500).json({ error: "Sucedió un error durante la creación de la cuenta: " + error.message });
  }
});

// Auth / Login: Formulario de Login
app.post("/api/auth/login", async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    res.status(400).json({ error: "Debe ingresar el usuario o correo, junto con su contraseña." });
    return;
  }

  try {
    const users = dbSource.getUsers();
    // support username OR email search
    let user = users.find(
      u => u.username.toLowerCase() === usernameOrEmail.toLowerCase() || u.email.toLowerCase() === usernameOrEmail.toLowerCase()
    );

    // Fallback alias support: 'admin' and 'presidente' can be used interchangeably
    if (!user) {
      if (usernameOrEmail.toLowerCase() === "admin") {
        user = users.find(u => u.username.toLowerCase() === "presidente");
      } else if (usernameOrEmail.toLowerCase() === "presidente") { // in case database got mutated or updated to 'admin'
        user = users.find(u => u.username.toLowerCase() === "admin");
      }
    }

    if (!user) {
      res.status(401).json({ error: "Credenciales de acceso inválidas." });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: "Credenciales de acceso inválidas." });
      return;
    }

    // Generate Token
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username, 
        role: user.role, 
        communityId: user.communityId || "" 
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "¡Sesión iniciada correctamente!",
      token,
      user: {
        userId: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        communityId: user.communityId || ""
      }
    });

  } catch (error: any) {
    res.status(500).json({ error: "Error de autenticación: " + error.message });
  }
});

// Auth / Me: Acceso de usuario autenticado con datos robustos
app.get("/api/auth/me", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Error de sesión." });
    return;
  }

  const userObj = dbSource.getUsers().find(u => u._id === req.user?.userId);
  if (!userObj) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  const communityObj = userObj.communityId 
    ? dbSource.getCommunities().find(c => c._id === userObj.communityId)
    : null;
    
  const propertyObj = dbSource.getProperties().find(p => p.userId === userObj._id);

  res.json({
    user: {
      userId: userObj._id,
      username: userObj.username,
      name: userObj.name,
      email: userObj.email,
      avatarUrl: userObj.avatarUrl,
      role: userObj.role,
      status: userObj.status,
      communityId: userObj.communityId || ""
    },
    community: communityObj || null,
    property: propertyObj || null
  });
});

// Self-Approve Endpoint for testing convenience
app.post("/api/auth/self-approve", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }
  const userObj = dbSource.getUsers().find(u => u._id === req.user?.userId);
  if (!userObj) {
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }
  userObj.status = "approved";
  dbSource.save();
  res.json({ message: "¡Su cuenta ha sido aprobada automáticamente para la demostración!", status: "approved" });
});

// Módulo 1: "Mis Recibos" -> Mis recibos personales actualizados
app.get("/api/properties/my", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Sin autorización." });
    return;
  }

  const prop = dbSource.getProperties().find(p => p.userId === req.user?.userId);
  if (!prop) {
    res.status(404).json({ error: "No se encuentra ninguna propiedad registrada para el usuario actual." });
    return;
  }

  res.json(prop);
});

// Presidente: Ver todas las viviendas de la comunidad
app.get("/api/properties", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    res.status(403).json({ error: "Acceso denegado. Se requieren permisos de administración o presidencia." });
    return;
  }

  // Get properties in current community
  const props = dbSource.getProperties().filter(p => p.communityId === req.user?.communityId);
  const users = dbSource.getUsers();

  const augmentedProps = props.map(p => {
    const owner = users.find(u => u._id === p.userId);
    return {
      ...p,
      ownerName: owner ? owner.name : "Sin asignar/Vacante",
      ownerEmail: owner ? owner.email : ""
    };
  });

  res.json(augmentedProps);
});

// Presidente: Actualizar estado de cuotas de una vivienda
app.put("/api/properties/:id/status", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    res.status(403).json({ error: "Petición denegada." });
    return;
  }

  const { id } = req.params;
  const { balanceStatus, pendingAmount, newReceipt } = req.body;

  const prop = dbSource.getProperties().find(p => p._id === id);
  if (!prop) {
    res.status(404).json({ error: "Vivienda no encontrada." });
    return;
  }

  prop.balanceStatus = balanceStatus;
  prop.pendingAmount = Number(pendingAmount) || 0;

  if (newReceipt && newReceipt.concept && newReceipt.amount) {
    const recipeItem: PropertyHistoryItem = {
      date: new Date().toISOString().split("T")[0],
      amount: Number(newReceipt.amount),
      concept: newReceipt.concept,
      status: newReceipt.status || "pendiente"
    };
    prop.paymentHistory.unshift(recipeItem);
  }

  dbSource.save();
  res.json({ message: "¡Vivienda y recibos actualizados correctamente!", property: prop });
});

// Módulo 2: "Transparencia Económica" -> Balance de Finanzas
app.get("/api/finances", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Sin autorización." });
    return;
  }

  const comFinances = dbSource.getFinances().filter(f => f.communityId === req.user?.communityId);

  // calculate summary metrics
  let totalIngresos = 0;
  let totalGastos = 0;

  comFinances.forEach(f => {
    if (f.type === "ingreso") {
      totalIngresos += f.amount;
    } else {
      totalGastos += f.amount;
    }
  });

  res.json({
    finances: comFinances.sort((a,b) => b.date.localeCompare(a.date)),
    summary: {
      totalIngresos,
      totalGastos,
      balance: totalIngresos - totalGastos
    }
  });
});

// Presidente: Adicionar un concepto financiero (gasto o ingreso)
app.post("/api/finances/add", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    res.status(403).json({ error: "Solo administradores pueden agregar conceptos financieros." });
    return;
  }

  const { type, concept, amount, date, invoiceUrl } = req.body;

  if (!type || !concept || !amount || !date) {
    res.status(400).json({ error: "Todos los campos de finanzas (tipo, concepto, cantidad y fecha) son requeridos." });
    return;
  }

  const dummyInvoices = [
    "/factura-mantenimiento.pdf",
    "/factura-jardineria.pdf",
    "/factura-luz-comunal.pdf",
    "/factura-administrador.pdf"
  ];

  const newFinance: Finance = {
    _id: "fin_" + Math.random().toString(36).substring(2, 9),
    type,
    concept,
    amount: Number(amount),
    date,
    invoiceUrl: invoiceUrl || dummyInvoices[Math.floor(Math.random() * dummyInvoices.length)],
    communityId: req.user.communityId
  };

  dbSource.getFinances().push(newFinance);
  dbSource.save();

  res.status(201).json({ message: "Movimiento financiero registrado.", finance: newFinance });
});

// Módulo 3: "Votaciones Comunitarias" -> Propuestas Activas/Cerradas
app.get("/api/votes", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Sin autorización." });
    return;
  }

  const activeVotes = dbSource.getVotes().filter(v => v.communityId === req.user?.communityId);
  res.json(activeVotes);
});

// Módulo 3: Emitir un Voto
app.post("/api/votes/:id/vote", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Sin autorización." });
    return;
  }

  const { id } = req.params;
  const { option } = req.body;

  if (!option) {
    res.status(400).json({ error: "Debe seleccionar una opción para registrar el voto." });
    return;
  }

  const vote = dbSource.getVotes().find(v => v._id === id);
  if (!vote) {
    res.status(404).json({ error: "Propuesta de votación no encontrada." });
    return;
  }

  if (vote.status === "closed") {
    res.status(400).json({ error: "Esta propuesta ya está cerrada y no admite más votos." });
    return;
  }

  // Check if voter already cast a vote
  const existingVoteIndex = vote.castVotes.findIndex(cv => cv.userId === req.user?.userId);
  const userObj = dbSource.getUsers().find(u => u._id === req.user?.userId);

  const castItem: CastVote = {
    userId: req.user.userId,
    userName: userObj ? userObj.name : req.user.username,
    option: option,
    timestamp: new Date().toISOString()
  };

  if (existingVoteIndex !== -1) {
    // Overwrite vote (or block, depending on policy. The user requirements state: "se bloquean visualmente tras votar", overwriting on backend or registering update)
    vote.castVotes[existingVoteIndex] = castItem;
  } else {
    vote.castVotes.push(castItem);
  }

  dbSource.save();
  res.json({ message: "¡Su voto ha sido registrado con éxito!", vote });
});

// Presidente: Crear Propuesta de Votación Comunitaria
app.post("/api/votes/create", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    res.status(403).json({ error: "Solo administradores pueden iniciar propuestas de votación." });
    return;
  }

  const { title, description, options, daysDuration } = req.body;

  if (!title || !description) {
    res.status(400).json({ error: "El título y la descripción de la votación son requeridos." });
    return;
  }

  const parsedOptions = options && options.length > 0 ? options : ["A Favor", "En Contra", "Abstención"];
  
  const createdDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (Number(daysDuration) || 7));

  const newVote: Vote = {
    _id: "vote_" + Math.random().toString(36).substring(2, 9),
    title,
    description,
    status: "active",
    options: parsedOptions,
    castVotes: [],
    communityId: req.user.communityId,
    createdDate: createdDate.toISOString(),
    endDate: endDate.toISOString()
  };

  dbSource.getVotes().push(newVote);
  dbSource.save();

  res.status(201).json({ message: "¡Nueva votación creada exitosamente!", vote: newVote });
});

// Presidente: Cerrar Votación
app.put("/api/votes/:id/close", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    res.status(403).json({ error: "Acceso restringido." });
    return;
  }

  const { id } = req.params;
  const vote = dbSource.getVotes().find(v => v._id === id);

  if (!vote) {
    res.status(404).json({ error: "Votación no encontrada." });
    return;
  }

  vote.status = "closed";
  dbSource.save();

  res.json({ message: "La votación ha sido cerrada satisfactoriamente.", vote });
});

// Módulo 4: "Reservas de Zonas Comunes" -> Ver todas las reservas
app.get("/api/bookings", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Sin autorización." });
    return;
  }

  const comBookings = dbSource.getBookings().filter(b => b.communityId === req.user?.communityId);
  res.json(comBookings);
});

// Módulo 4: Crear una nueva reserva (con validación estricta de conflictos de horario)
app.post("/api/bookings/add", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Sin autorización." });
    return;
  }

  const { facilityName, date, startTime, endTime } = req.body;

  if (!facilityName || !date || !startTime || !endTime) {
    res.status(400).json({ error: "Se requieren los campos: Instalación, Fecha, Hora Inicio, Hora Fin." });
    return;
  }

  // Prevent retroactive bookings
  const todayStr = new Date().toISOString().split("T")[0];
  if (date < todayStr) {
    res.status(400).json({ error: "No es posible reservar en fechas anteriores al día de hoy." });
    return;
  }

  try {
    const propertyObj = dbSource.getProperties().find(p => p.userId === req.user?.userId);
    const userObj = dbSource.getUsers().find(u => u._id === req.user?.userId);
    const propertyLabel = propertyObj 
      ? `Portal ${propertyObj.block}, ${propertyObj.floor}º ${propertyObj.door} (${userObj?.name})` 
      : `${userObj?.name || req.user.username}`;

    const bookings = dbSource.getBookings();

    // 1. Conflict Validation on Same Facility & Date
    const facilityBookings = bookings.filter(
      b => b.communityId === req.user?.communityId &&
           b.facilityName.toLowerCase() === facilityName.toLowerCase() &&
           b.date === date
    );

    // Conflict algorithm: Check if input range overlaps with any booked slot
    const inputStartValue = parseInt(startTime.replace(":", ""), 10);
    const inputEndValue = parseInt(endTime.replace(":", ""), 10);

    if (inputStartValue >= inputEndValue) {
      res.status(400).json({ error: "La hora de fin debe ser posterior a la hora de inicio de la reserva." });
      return;
    }

    const overlapFound = facilityBookings.some(existing => {
      const exStart = parseInt(existing.startTime.replace(":", ""), 10);
      const exEnd = parseInt(existing.endTime.replace(":", ""), 10);

      // (StartA < EndB) and (EndA > StartB)
      return (inputStartValue < exEnd && inputEndValue > exStart);
    });

    if (overlapFound) {
      res.status(400).json({ error: `El horario solicitado ${startTime}-${endTime} entra en conflicto directo con otra reserva existente para ${facilityName}.` });
      return;
    }

    // 2. Add Booking
    const newBooking: Booking = {
      _id: "book_" + Math.random().toString(36).substring(2, 9),
      facilityName,
      date,
      startTime,
      endTime,
      propertyId: propertyObj ? propertyObj._id : "prop_unknown",
      propertyName: propertyLabel,
      communityId: req.user.communityId
    };

    dbSource.getBookings().push(newBooking);
    dbSource.save();

    res.status(201).json({ message: "¡Reserva realizada exitosamente!", booking: newBooking });

  } catch (error: any) {
    res.status(500).json({ error: "Error de servidor al reservar: " + error.message });
  }
});

// Módulo 4: Eliminar una reserva (Solo por el creador o presidente)
app.delete("/api/bookings/:id", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Sin autorización" });
    return;
  }

  const { id } = req.params;
  const bookings = dbSource.getBookings();
  const bookingIndex = bookings.findIndex(b => b._id === id);

  if (bookingIndex === -1) {
    res.status(404).json({ error: "Reserva municipal o vecinal no encontrada." });
    return;
  }

  const booking = bookings[bookingIndex];
  const userProperty = dbSource.getProperties().find(p => p.userId === req.user?.userId);

  // Validate Owner or presidential privileges
  const isOwner = userProperty && booking.propertyId === userProperty._id;
  const isPresident = req.user.role === "admin" || req.user.role === "superadmin";

  if (!isOwner && !isPresident) {
    res.status(403).json({ error: "No tiene permisos para eliminar esta reserva. Solo su propietario o el presidente pueden hacerlo." });
    return;
  }

  bookings.splice(bookingIndex, 1);
  dbSource.save();

  res.json({ message: "¡Reserva cancelada correctamente!" });
});


// ---------------- Web Push Broadcast Helper ----------------
const sendPushToCommunity = async (communityId: string, title: string, body: string, url: string = "") => {
  const subs = dbSource.getSubscriptions().filter(s => s.communityId === communityId);
  const payload = JSON.stringify({ title, body, url });
  
  console.log(`[WebPush] Broadcasting notification to community ${communityId}: "${title}" to ${subs.length} devices.`);
  
  const promises = subs.map(sub => {
    return webpush.sendNotification({
      endpoint: sub.endpoint,
      keys: sub.keys
    }, payload).catch(err => {
      console.error(`[WebPush] Fallo al enviar a ${sub.endpoint.substring(0, 30)}... status: ${err.statusCode}`);
      // Clean up dead subscriptions
      if (err.statusCode === 410 || err.statusCode === 404) {
        const list = dbSource.getSubscriptions();
        const idx = list.findIndex(s => s.endpoint === sub.endpoint);
        if (idx !== -1) {
          list.splice(idx, 1);
          dbSource.save();
          console.log("[WebPush] Suscripción fallecida eliminada.");
        }
      }
    });
  });
  
  await Promise.all(promises);
};


// ---------------- NEW CORE ENDPOINTS: Web Push, Issues, Approvals, Assistant ----------------

// 1. Get Push Public Key
app.get("/api/push/public-key", (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey || null });
});

// 2. Register Client Push Subscription
app.post("/api/push/register", authenticateToken, (req: AuthRequest, res) => {
  const { subscription } = req.body;
  
  if (!subscription || !subscription.endpoint) {
    res.status(400).json({ error: "Suscripción de notificaciones inválida o incompleta." });
    return;
  }
  
  try {
    const list = dbSource.getSubscriptions();
    const existingIdx = list.findIndex(s => s.endpoint === subscription.endpoint);
    
    const newSub: PushSubscriptionItem = {
      _id: "sub_" + Math.random().toString(36).substring(2, 9),
      userId: req.user?.userId || "unknown",
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      communityId: req.user?.communityId || "unknown"
    };
    
    if (existingIdx !== -1) {
      list[existingIdx] = newSub;
    } else {
      list.push(newSub);
    }
    
    dbSource.save();
    res.json({ message: "¡Suscripción registrada con éxito en el servidor!" });
  } catch (err: any) {
    res.status(500).json({ error: "No se pudo registrar la suscripción: " + err.message });
  }
});

// 3. Broadcast Admin Alert Message
app.post("/api/push/broadcast", authenticateToken, async (req: AuthRequest, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    res.status(403).json({ error: "Solo administradores pueden emitir alertas generales." });
    return;
  }
  
  const { title, body } = req.body;
  if (!title || !body) {
    res.status(400).json({ error: "Se requiere título y texto para la alerta." });
    return;
  }
  
  try {
    await sendPushToCommunity(req.user.communityId, title, body, "#avisos");
    res.json({ message: "Alerta de comunidad difundida satélitemente por Push." });
  } catch (err: any) {
    res.status(500).json({ error: "Error en la difusión Push: " + err.message });
  }
});

// 4. Get All Community Issues (Incidencias)
app.get("/api/issues", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }
  
  const list = dbSource.getIssues()
    .filter(i => i.communityId === req.user?.communityId)
    .map((issue) => ({
      ...issue,
      photoUrl: issue.photoUrl || issue.photo || ""
    }));
  // Return issues sorted by date (newest first)
  res.json(list.sort((a, b) => b.date.localeCompare(a.date)));
});

// 5. Submit New Issue with photo (Base64) (and alias /api/incidents)
const handleIncidentSubmission = async (req: AuthRequest, res: any) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "No autorizado." });
      return;
    }

    console.log("[Incident Debug] req.body=", req.body);
    console.log("[Incident Debug] req.file=", req.file ? { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size } : null);
    
    const { title, description, category } = req.body;
    let photo = req.body.photo;
    if (!title || !description || !category) {
      res.status(400).json({ error: "Título, descripción y categoría son requeridos para reportar una incidencia." });
      return;
    }

    if (req.file) {
      const mimeType = req.file.mimetype;
      if (!mimeType.startsWith("image/")) {
        res.status(400).json({ error: "Sólo se permiten archivos de imagen en el reporte." });
        return;
      }
      photo = `data:${mimeType};base64,${req.file.buffer.toString("base64")}`;
    }

    // Validate Base64 image integrity safely if provided
    if (photo && typeof photo === "string" && photo.length > 0) {
      if (!photo.startsWith("data:image/")) {
        throw new Error("El formato de la imagen Base64 no es válido.");
      }
    }

    const { userId } = req.user;
    const userObj = dbSource.getUsers().find(u => u._id === userId);
    const propObj = dbSource.getProperties().find(p => p.userId === userId);
    const propStr = propObj ? `Portal ${propObj.block}, ${propObj.floor}º ${propObj.door}` : "Vecino";
    
    const newIssue: Issue = {
      _id: "issue_" + Math.random().toString(36).substring(2, 9),
      title,
      description,
      category,
      photo: photo || "",
      photoUrl: photo || "",
      status: "pendiente",
      reporterName: userObj?.name || req.user.username,
      reporterProperty: propStr,
      date: new Date().toISOString().split("T")[0],
      communityId: req.user.communityId
    };
    
    dbSource.getIssues().push(newIssue);
    dbSource.save();
    
    // Notify community of the new incident
    await sendPushToCommunity(
      req.user.communityId,
      "⚠️ Nueva Incidencia Reportada",
      `${newIssue.reporterName} (${propStr}) ha reportado: ${title}`,
      "#incidencias"
    );
    
    res.status(201).json({ message: "¡Incidencia guardada con éxito!", issue: newIssue });
  } catch (err: any) {
    console.error("Error al reportar la incidencia:", err);
    res.status(500).json({ error: "Error fatal procesando incidencias en el servidor: " + err.message });
  }
};

app.post("/api/issues", authenticateToken, upload.single("photo"), handleIncidentSubmission);
app.post("/api/incidents", authenticateToken, upload.single("photo"), handleIncidentSubmission);

// 6. Update Issue Status (Admin only)
app.put("/api/issues/:id/status", authenticateToken, async (req: AuthRequest, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    res.status(403).json({ error: "Acceso denegado. Se requiere cuenta de administración." });
    return;
  }
  
  const { id } = req.params;
  const { status } = req.body;
  
  const validStatuses = ["pendiente", "en_proceso", "resuelto"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Estado proporcionado no es un estado válido (pendiente, en_proceso, resuelto)." });
    return;
  }
  
  try {
    const issue = dbSource.getIssues().find(i => i._id === id);
    if (!issue) {
      res.status(404).json({ error: "Incidencia no encontrada." });
      return;
    }
    
    issue.status = status as any;
    dbSource.save();
    
    const statusLabels: Record<string, string> = {
      pendiente: 'PENDIENTE',
      en_proceso: 'EN PROCESO',
      resuelto: 'RESUELTA (CERRADA)'
    };
    
    // Notify the community of status update
    await sendPushToCommunity(
      req.user.communityId,
      "🛠️ Actualización de Incidencia",
      `La avería "${issue.title}" ha cambiado de estado a: ${statusLabels[status]}`,
      "#incidencias"
    );
    
    res.json({ message: "Estado de la avería actualizado correctamente.", issue });
  } catch (err: any) {
    res.status(500).json({ error: "No se pudo actualizar el estado: " + err.message });
  }
});

// 7. Get All Users for Approvals (Admin only)
app.get("/api/users", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    res.status(403).json({ error: "Acceso denegado." });
    return;
  }
  
  const list = dbSource.getUsers().filter(u => u.communityId === req.user?.communityId);
  // hide security hashes
  const sanitized = list.map(u => {
    const { passwordHash, ...safe } = u;
    return safe;
  });
  
  res.json(sanitized);
});

// 8. Approve Pending Neighbors (Admin only)
app.put("/api/users/:id/approve", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    res.status(403).json({ error: "Se requieren permisos de administrador." });
    return;
  }
  
  const { id } = req.params;
  const neighbor = dbSource.getUsers().find(u => u._id === id);
  
  if (!neighbor) {
    res.status(404).json({ error: "Vecino no encontrado en la base de datos." });
    return;
  }
  
  neighbor.status = "approved";
  dbSource.save();
  res.json({ message: `¡Se ha activado y aprobado correctamente el ingreso de ${neighbor.name}!`, neighbor });
});

// 9. Mass billing: Emit raw receipts to all homes at once
app.post("/api/properties/mass-receipt", authenticateToken, async (req: AuthRequest, res) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "superadmin")) {
    res.status(403).json({ error: "Acceso denegado. Se requiere cuenta de administración." });
    return;
  }
  
  const { concept, amount } = req.body;
  if (!concept || !amount || isNaN(amount)) {
    res.status(400).json({ error: "Indique la descripción y cuantía numérica del recibo extraordinario." });
    return;
  }
  
  try {
    const amt = Number(amount);
    const props = dbSource.getProperties().filter(p => p.communityId === req.user?.communityId);
    
    props.forEach(p => {
      p.pendingAmount += amt;
      p.balanceStatus = "pendiente";
      p.paymentHistory.unshift({
        date: new Date().toISOString().split("T")[0],
        amount: amt,
        concept: concept.trim(),
        status: "pendiente"
      });
    });
    
    dbSource.save();
    
    // Broadcast mass receipt notifications
    await sendPushToCommunity(
      req.user.communityId,
      "💳 Recibo Colectivo Emitido",
      `Nuevo recibo comunitario de ${amt.toFixed(2)} €: "${concept}" cargado a todas las viviendas.`,
      "#recibos"
    );
    
    res.json({ message: `Recibo general de ${amt.toFixed(2)} € emitido con éxito a las ${props.length} viviendas.` });
  } catch (err: any) {
    res.status(500).json({ error: "No se pudo realizar el cargo general: " + err.message });
  }
});

// ---------------- SuperAdmin Core Endpoints ----------------

// Get all communities/buildings (SuperAdmin only)
app.get("/api/superadmin/communities", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user || req.user.role !== "superadmin") {
    res.status(403).json({ error: "Acceso denegado. Se requieren privilegios de SuperAdmin global." });
    return;
  }
  const communities = dbSource.getCommunities();
  res.json(communities);
});

// Create a new community and auto-generate invite code (SuperAdmin only)
app.post("/api/superadmin/communities", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user || req.user.role !== "superadmin") {
    res.status(403).json({ error: "Acceso denegado. Se requieren privilegios de SuperAdmin global." });
    return;
  }

  const { name, address } = req.body;
  if (!name || !address) {
    res.status(400).json({ error: "Debe ingresar el nombre y dirección para la comunidad." });
    return;
  }

  // Generate clean code like ALAMEDA-XXXX or VEC-XXXX
  const code = "VEC-" + Math.random().toString(36).substring(2, 6).toUpperCase();
  const community: Community = {
    _id: "com_" + Math.random().toString(36).substring(2, 9),
    name,
    address,
    inviteCode: code
  };

  dbSource.getCommunities().push(community);
  dbSource.save();

  res.status(201).json({
    message: "¡Comunidad registrada exitosamente!",
    community
  });
});

// See all users with their community names associated (SuperAdmin only)
app.get("/api/superadmin/users", authenticateToken, (req: AuthRequest, res) => {
  if (!req.user || req.user.role !== "superadmin") {
    res.status(403).json({ error: "Acceso denegado. Se requieren privilegios de SuperAdmin global." });
    return;
  }

  const users = dbSource.getUsers();
  const communities = dbSource.getCommunities();
  const properties = dbSource.getProperties();

  const augmentedUsers = users.map(u => {
    const com = communities.find(c => c._id === u.communityId);
    const prop = properties.find(p => p.userId === u._id);
    const { passwordHash, ...safe } = u;
    return {
      ...safe,
      communityName: com ? com.name : "Global / SuperAdmin",
      property: prop ? `${prop.block} - ${prop.floor}º ${prop.door}` : ""
    };
  });

  res.json(augmentedUsers);
});

// 10. Gemini Multimodal & Voice Assistant endpoint
app.post("/api/assistant", authenticateToken, async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Autorización requerida." });
    return;
  }
  
  const { prompt } = req.body;
  if (!prompt) {
    res.status(400).json({ error: "Falta el mensaje de voz/texto para el asistente." });
    return;
  }
  
  try {
    const ai = getGeminiClient();
    
    // 1. Gather context of the requesting neighbor
    const userObj = dbSource.getUsers().find(u => u._id === req.user?.userId);
    const propObj = dbSource.getProperties().find(p => p.userId === req.user?.userId);
    
    const balanceText = propObj 
      ? `Saldo adeudado actual: ${propObj.pendingAmount} € (Estado de cuotas: ${propObj.balanceStatus === 'al_dia' ? 'Al corriente de pago' : 'Pendiente de liquidar'}).`
      : 'No posee viviendas registradas en esta comunidad vecinal.';
      
    const lastReceipts = propObj && propObj.paymentHistory.length > 0
      ? `Historial de sus últimos recibos:\n` + propObj.paymentHistory.slice(0, 3).map(h => `- ${h.date}: ${h.concept} (${h.amount}€) -> ${h.status.toUpperCase()}`).join("\n")
      : 'Ningún historial de movimientos registrados.';
      
    const activeIssues = dbSource.getIssues()
      .filter(i => i.communityId === req.user?.communityId && i.status !== 'resuelto')
      .slice(0, 5);
      
    const activeIssuesText = activeIssues.length > 0
      ? `Averías activas en el edificio actualmente:\n` + activeIssues.map(i => `- ${i.title} (${i.status})`).join("\n")
      : 'No hay ninguna avería ni incidencia activa reportada en la comunidad actualmente.';
      
    // 2. Set up context guidelines and rules ground truth
    const statutes = `Estatutos y normas de la comunidad 'Residencial Alameda':
- El horario de la piscina de verano es de 10:00 h a 22:00 h de lunes a domingo. Prohibidos los altavoces a volumen alto.
- Las mascotas deben ir totalmente atadas e identificadas en todas las zonas comunes y prohibido que orinen/defequen en el césped.
- El límite de reserva de la pista de pádel es de 1.5 horas al día por vivienda para garantizar equidad.
- El horario de descanso vecinal estricto es de 23:00 h a 08:00 h.
- Se puede reportar averías al conserje o directamente mediante la sección "Incidencias" de esta APP.`;

    const instructions = `Actúas como el Asistente Virtual Inteligente de 'VecindarioTransparente'.
Tu objetivo principal es asistir cordialmente a los copropietarios mediante voz y chat. 
Te entregaremos el contexto exacto del usuario. Usa esta información real para responder exactamente a sus consultas. No inventes balanzas ni datos ficticios.
Idioma: Responde de manera profesional y amable en el idioma seleccionado por el usuario.
Límites: Mantén las respuestas asombrosamente concisas, breves y óptimas para la lectura de voz (máximo 3 frases).

DATOS EN TIEMPO REAL DEL VECINO CONSULTOR:
- Nombre: ${userObj?.name || 'Vecino'}
- Correo: ${userObj?.email || ''}
- Vivienda: Portal ${propObj?.block || 'A'},¹ Piso ${propObj?.floor || '1º'}, Puerta ${propObj?.door || 'A'}
- ${balanceText}
- ${lastReceipts}

INCIDENCIAS ACTUALES DEL EDIFICIO:
${activeIssuesText}

ESTATUTOS DE LA COMUNIDAD:
${statutes}

Petición del vecino: "${prompt}"`;

    console.log(`[Assistant-Gemini] Generando respuesta para ${userObj?.name}. Prompt consultor: "${prompt}"`);

    // Call Gemini 3.5 Flash via correct @google/genai syntax
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: instructions,
    });

    const reply = response.text || "No obtuve una respuesta clara del núcleo del asistente.";
    res.json({ reply });

  } catch (err: any) {
    console.error("[Assistant-Gemini] Error al procesar consulta:", err.message);
    res.status(500).json({ error: "Surgió un error en el motor de inteligencia artificial: " + err.message });
  }
});


// ---------------- WebSocket Server for Gemini Live Relay ----------------
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, request) => {
  console.log("[WS] Nueva conexión entrante para Gemini Live.");
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    ws.send(JSON.stringify({ type: "error", error: "Falta la API Key de Gemini en el servidor." }));
    ws.close();
    return;
  }

  // Connect to Gemini Live bidirectional WebSocket
  const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1.GenerativeService.BidiGenerateContent?key=${apiKey}`;
  const geminiWs = new WS(geminiUrl);

  geminiWs.on("open", () => {
    console.log("[WS] Conectado exitosamente con Gemini Live API.");
    // Send initial configuration message
    const setupMsg = {
      setup: {
        model: "gemini-live-2.5-flash-preview",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede" // friendly voice
              }
            }
          }
        },
        systemInstruction: {
          parts: [{
            text: `Actúas como el Asistente de Voz de la comunidad Residencial Alameda.
            Tu objetivo es asistir de manera asombrosamente concisa, breve y óptima para la lectura de voz (máximo 2 a 3 frases por respuesta).
            El vecino te hablará por voz (PCM @ 16kHz). Respóndele a sus dudas comunitarias con el tono de un conserje o presidente amable. No inventes balanzas ni datos ficticios, y sé siempre cordial.`
          }]
        }
      }
    };
    geminiWs.send(JSON.stringify(setupMsg));
    ws.send(JSON.stringify({ type: "status", status: "connected", message: "Conectado al asistente de voz Gemini Live." }));
  });

  geminiWs.on("message", (data) => {
    try {
      const dataStr = data.toString().trim();
      if (!dataStr) return; // Prevent parsing empty messages

      const resp = JSON.parse(dataStr);
      const parts = resp.serverContent?.modelTurn?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            ws.send(JSON.stringify({
              type: "audio",
              data: part.inlineData.data
            }));
          }
          if (part.text && part.text.trim()) {
            ws.send(JSON.stringify({
              type: "text",
              data: part.text
            }));
          }
        }
      }
      if (resp.serverContent?.turnComplete) {
        ws.send(JSON.stringify({ type: "turnComplete" }));
      }
    } catch (e: any) {
      console.warn("[WS] Error parseando respuesta del socket de Gemini:", e.message);
      // Fallback: send clean status structure or log safely without crashing
    }
  });

  geminiWs.on("error", (err) => {
    console.error("[WS] Error de Gemini WS: ", err.message);
    try {
      ws.send(JSON.stringify({ type: "error", error: `Error de red directo con la API de Gemini: ${err.message}` }));
    } catch (_) {}
  });

  geminiWs.on("close", (code, reason) => {
    console.log("[WS] Conexión de Gemini WS cerrada.", code, reason.toString());
    try {
      ws.close();
    } catch (_) {}
  });

  ws.on("message", (message) => {
    try {
      const msgStr = message.toString().trim();
      if (!msgStr) return; // ignore completely empty frames or pings

      const reqMsg = JSON.parse(msgStr);
      if (reqMsg.type === "audio" && reqMsg.data && reqMsg.data.trim()) {
        const normalizedData = reqMsg.data.trim();
        const realTimeInput = {
          realtimeInput: {
            audio: {
              mimeType: "audio/pcm;rate=16000",
              data: normalizedData
            }
          }
        };
        console.log("[WS] audio packet desde cliente, bytes=" + Math.ceil(normalizedData.length * 3 / 4));
        if (geminiWs.readyState === WS.OPEN) {
          geminiWs.send(JSON.stringify(realTimeInput));
        }
      } else if (reqMsg.type === "text" && reqMsg.data && reqMsg.data.trim()) {
        const normalizedText = reqMsg.data.trim();
        const realTimeInput = {
          realtimeInput: {
            parts: [{
              text: normalizedText
            }]
          }
        };
        if (geminiWs.readyState === WS.OPEN) {
          geminiWs.send(JSON.stringify(realTimeInput));
        }
      }
    } catch (err: any) {
      console.error("[WS] Error parseando mensaje del cliente:", err.message);
      try {
        ws.send(JSON.stringify({ type: "error", error: "Mensaje malformado procesado en el servidor." }));
      } catch (_) {}
    }
  });

  ws.on("close", () => {
    console.log("[WS] Cliente de voz cerró conexión.");
    if (geminiWs.readyState === WS.OPEN || geminiWs.readyState === WS.CONNECTING) {
      geminiWs.close();
    }
  });
});

server.on("upgrade", (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : "";
  if (pathname === "/api/assistant/live") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ---------------- Vite or SPA static file server middleware ----------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted in development.");
  } else {
    // In production, serve index.html directly from root folder
    const rootPath = process.cwd();
    app.use(express.static(rootPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(rootPath, "index.html"));
    });
    console.log("Static file server active for production files.");
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[VecindarioTransparente] Server running on port ${PORT}`);
    console.log(`Access standard local service URL: http://localhost:${PORT}`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Error: el puerto ${PORT} ya está en uso. Usa otra instancia o ajusta PORT en tu entorno.`);
    } else {
      console.error("Error inesperado al iniciar el servidor:", err);
    }
    process.exit(1);
  });
}

startServer();
