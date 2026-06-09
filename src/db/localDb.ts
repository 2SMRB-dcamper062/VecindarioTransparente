import fs from "fs";
import path from "path";

const DB_FILE = path.resolve(process.cwd(), "db-local.json");

export interface User {
  _id: string;
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  role?: string;
  status?: string;
  communityId?: string;
}

export interface Community { _id: string; name: string; address: string; inviteCode: string }
export interface PropertyHistoryItem { date: string; amount: number; concept: string; status: string }
export interface Property { _id: string; block: string; floor: string; door: string; balanceStatus: string; pendingAmount: number; paymentHistory: PropertyHistoryItem[]; userId?: string; communityId?: string }
export interface CastVote { userId: string; userName: string; option: string; timestamp: string }
export interface Vote { _id: string; title: string; description: string; status: string; options: string[]; castVotes: CastVote[]; communityId?: string; createdDate?: string; endDate?: string }
export interface Finance { _id: string; type: string; concept: string; amount: number; date: string; invoiceUrl?: string; communityId?: string }
export interface Booking { _id: string; facilityName: string; date: string; startTime: string; endTime: string; propertyId?: string; propertyName?: string; communityId?: string }
export interface Issue { _id: string; title: string; description: string; category?: string; photo?: string; photoUrl?: string; status?: string; reporterName?: string; reporterProperty?: string; date?: string; communityId?: string }
export interface PushSubscriptionItem { _id?: string; userId?: string; communityId?: string; endpoint: string; keys: { p256dh: string; auth: string } }

type DBShape = {
  users: User[];
  communities: Community[];
  properties: Property[];
  votes: Vote[];
  finances: Finance[];
  bookings: Booking[];
  issues: Issue[];
  subscriptions: PushSubscriptionItem[];
};

let data: DBShape = loadFile();

function loadFile(): DBShape {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw) as DBShape;
  } catch (e: any) {
    console.error("No se pudo leer db-local.json:", e.message);
    // return empty structure to avoid crashes
    return { users: [], communities: [], properties: [], votes: [], finances: [], bookings: [], issues: [], subscriptions: [] };
  }
}

function persist() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e: any) {
    console.error("Error escribiendo db-local.json:", e.message);
  }
}

export const dbSource = {
  getUsers(): User[] {
    return data.users;
  },
  getCommunities(): Community[] {
    return data.communities;
  },
  getProperties(): Property[] {
    return data.properties;
  },
  getVotes(): Vote[] {
    return data.votes;
  },
  getFinances(): Finance[] {
    return data.finances;
  },
  getBookings(): Booking[] {
    return data.bookings;
  },
  getIssues(): Issue[] {
    return data.issues;
  },
  getSubscriptions(): PushSubscriptionItem[] {
    return data.subscriptions;
  },
  save(): void {
    persist();
  },
  reseed(): void {
    data = loadFile();
  }
};

export default dbSource;