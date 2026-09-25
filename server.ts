import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Directory to store server-synced data persistently
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

const ATTENDANCE_FILE = path.join(DATA_DIR, "sync_attendance.json");
const BEHAVIORS_FILE = path.join(DATA_DIR, "sync_behaviors.json");
const DELAYS_FILE = path.join(DATA_DIR, "sync_delays.json");
const GRADES_FILE = path.join(DATA_DIR, "sync_grades.json");
const CLASSES_FILE = path.join(DATA_DIR, "sync_classes.json");
const TEACHERS_FILE = path.join(DATA_DIR, "sync_teachers.json");
const STUDENTS_FILE = path.join(DATA_DIR, "sync_students.json");
const SCHOOL_SETTINGS_FILE = path.join(DATA_DIR, "sync_school_settings.json");

// Helper to safely read JSON file
function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
  }
  return fallback;
}

// Helper to safely write JSON file
function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e);
  }
}

// In-memory caches for 0ms access
let attendanceCache: any[] = readJsonFile(ATTENDANCE_FILE, []);
let behaviorsCache: any[] = readJsonFile(BEHAVIORS_FILE, []);
let delaysCache: any[] = readJsonFile(DELAYS_FILE, []);
let gradesCache: any[] = readJsonFile(GRADES_FILE, []);
let classesCache: any[] = readJsonFile(CLASSES_FILE, []);
let teachersCache: any[] = readJsonFile(TEACHERS_FILE, []);
let studentsCache: any[] = readJsonFile(STUDENTS_FILE, []);
let schoolSettingsCache: any[] = readJsonFile(SCHOOL_SETTINGS_FILE, []);

// Active Server-Sent Events clients for real-time pushing
type SSEClient = {
  id: string;
  res: express.Response;
  schoolCode?: string;
  email?: string;
};
const sseClients: Map<string, SSEClient> = new Map();

function broadcastSyncEvent(type: string, data: any) {
  const payload = `data: ${JSON.stringify({ type, data, timestamp: Date.now() })}\n\n`;
  sseClients.forEach((client, id) => {
    try {
      client.res.write(payload);
    } catch (_) {
      sseClients.delete(id);
    }
  });
}

// Keep-alive heartbeat every 15s to keep SSE connection open through proxies (Vite, Cloud Run, Cloudflare, etc.)
setInterval(() => {
  const pingPayload = `data: ${JSON.stringify({ type: "ping", timestamp: Date.now() })}\n\n`;
  sseClients.forEach((client, id) => {
    try {
      client.res.write(pingPayload);
    } catch (_) {
      sseClients.delete(id);
    }
  });
}, 15000);

function safeDecode(val?: string): string {
  if (!val) return "";
  try {
    return decodeURIComponent(val).toLowerCase().trim();
  } catch (_) {
    return (val || "").toLowerCase().trim();
  }
}

// Helper to check if an entity belongs to the requested school
function matchesSchool(item: any, schoolCode?: string, email?: string, uid?: string): boolean {
  if (!item) return false;

  const isGuestEmail = !email || email.toLowerCase().includes("@school.local") || email.toLowerCase().includes("@school.com");
  const isGuestUid = !uid || uid.toLowerCase().startsWith("guest");
  
  const cleanSchoolCode = safeDecode(schoolCode);
  const cleanEmail = isGuestEmail ? "" : safeDecode(email);
  const cleanUid = isGuestUid ? "" : (uid || "").trim();

  // If no specific schoolCode, authenticated email, or authenticated uid, allow viewing the registered school data
  if (!cleanSchoolCode && !cleanEmail && !cleanUid) return true;

  const sCode = safeDecode(item.schoolCode);
  const sEmail = safeDecode(item.userEmail || item.email);
  const sUid = (item.userId || item.uid || "").trim();

  // If item has no specific school or user metadata, allow viewing it within the school
  if (!sCode && !sEmail && !sUid) return true;

  if (cleanSchoolCode) {
    if (sCode === cleanSchoolCode || sEmail === cleanSchoolCode || sUid === cleanSchoolCode) return true;
  }
  if (cleanEmail) {
    if (sEmail === cleanEmail || sCode === cleanEmail) return true;
  }
  if (cleanUid) {
    if (sUid === cleanUid || sCode === cleanUid) return true;
  }
  return false;
}

// ----------------------------------------------------
// API ROUTES FIRST (Before Vite middleware)
// ----------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    attendanceCount: attendanceCache.length,
    behaviorsCount: behaviorsCache.length,
    delaysCount: delaysCache.length,
    gradesCount: gradesCache.length,
    classesCount: classesCache.length,
    teachersCount: teachersCache.length,
    studentsCount: studentsCache.length,
    schoolsCount: schoolSettingsCache.length,
    sseClientsCount: sseClients.size,
    timestamp: Date.now()
  });
});

// Real-time SSE Stream for instant synchronization across all devices
app.get("/api/sync/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const schoolCode = (req.query.schoolCode as string || "").toLowerCase();
  const email = (req.query.email as string || "").toLowerCase();

  sseClients.set(clientId, { id: clientId, res, schoolCode, email });

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: "connected", clientId, timestamp: Date.now() })}\n\n`);

  req.on("close", () => {
    sseClients.delete(clientId);
  });
});

// Sync Attendance Endpoints
app.get("/api/sync/attendance", (req, res) => {
  const schoolCode = ((req.query.schoolCode as string) || "").toLowerCase().trim();
  const email = ((req.query.email as string) || "").toLowerCase().trim();
  const uid = ((req.query.uid as string) || "").trim();
  const date = ((req.query.date as string) || "").trim();

  let results = attendanceCache;

  if (date) {
    results = results.filter(r => r.date === date);
  }

  results = results.filter(r => matchesSchool(r, schoolCode, email, uid));

  res.json({ success: true, records: results });
});

app.post("/api/sync/attendance", (req, res) => {
  const { record, records, deletedIds, clearAll, schoolCode, userEmail, userId } = req.body;

  if (clearAll) {
    attendanceCache = attendanceCache.filter(r => !matchesSchool(r, schoolCode, userEmail, userId));
    writeJsonFile(ATTENDANCE_FILE, attendanceCache);
    broadcastSyncEvent("attendance_updated", { records: [], clearAll: true, schoolCode });
    return res.json({ success: true, count: 0, cleared: true });
  }

  const deletedList = Array.isArray(deletedIds) ? deletedIds : [];
  if (deletedList.length > 0) {
    const toDelete = new Set(deletedList);
    attendanceCache = attendanceCache.filter(r => !toDelete.has(r.id) && !toDelete.has(r._docId) && !toDelete.has(r.studentId));
  }

  const itemsToProcess = Array.isArray(records) ? records : (record ? [record] : []);
  if (itemsToProcess.length === 0 && deletedList.length === 0) {
    return res.status(400).json({ success: false, error: "No records provided" });
  }

  let updatedCount = 0;
  for (const item of itemsToProcess) {
    if (!item || !item.id) continue;
    const existingIdx = attendanceCache.findIndex(r => r.id === item.id || (item._docId && r.id === item._docId));
    if (existingIdx >= 0) {
      attendanceCache[existingIdx] = { ...attendanceCache[existingIdx], ...item, updatedAt: Date.now() };
    } else {
      attendanceCache.unshift({ ...item, updatedAt: Date.now() });
    }
    updatedCount++;
  }

  // Persist to disk asynchronously
  writeJsonFile(ATTENDANCE_FILE, attendanceCache);

  // Broadcast to all connected clients immediately (with deletedIds and records)
  broadcastSyncEvent("attendance_updated", { records: itemsToProcess, deletedIds: deletedList, schoolCode });

  res.json({ success: true, updatedCount });
});

// Sync Behavior Endpoints
app.get("/api/sync/behaviors", (req, res) => {
  const schoolCode = ((req.query.schoolCode as string) || "").toLowerCase().trim();
  const email = ((req.query.email as string) || "").toLowerCase().trim();
  const uid = ((req.query.uid as string) || "").trim();

  const results = behaviorsCache.filter(r => matchesSchool(r, schoolCode, email, uid));
  res.json({ success: true, records: results });
});

app.post("/api/sync/behaviors", (req, res) => {
  const { record, records, deletedIds, clearAll, schoolCode, userEmail, userId } = req.body;

  if (clearAll) {
    behaviorsCache = behaviorsCache.filter(r => !matchesSchool(r, schoolCode, userEmail, userId));
    writeJsonFile(BEHAVIORS_FILE, behaviorsCache);
    broadcastSyncEvent("behavior_updated", { records: [], clearAll: true, schoolCode });
    return res.json({ success: true, count: 0, cleared: true });
  }

  const deletedList = Array.isArray(deletedIds) ? deletedIds : [];
  if (deletedList.length > 0) {
    const toDelete = new Set(deletedList);
    behaviorsCache = behaviorsCache.filter(r => !toDelete.has(r.id) && !toDelete.has(r._docId) && !toDelete.has(r.studentId));
  }

  const itemsToProcess = Array.isArray(records) ? records : (record ? [record] : []);
  if (itemsToProcess.length === 0 && deletedList.length === 0) {
    return res.status(400).json({ success: false, error: "No behavior records provided" });
  }

  let updatedCount = 0;
  for (const item of itemsToProcess) {
    if (!item || !item.id) continue;
    const existingIdx = behaviorsCache.findIndex(r => r.id === item.id || (item._docId && r.id === item._docId));
    if (existingIdx >= 0) {
      behaviorsCache[existingIdx] = { ...behaviorsCache[existingIdx], ...item, updatedAt: Date.now() };
    } else {
      behaviorsCache.unshift({ ...item, updatedAt: Date.now() });
    }
    updatedCount++;
  }

  writeJsonFile(BEHAVIORS_FILE, behaviorsCache);
  broadcastSyncEvent("behavior_updated", { records: itemsToProcess, deletedIds: deletedList, schoolCode });

  res.json({ success: true, updatedCount });
});

// Sync Morning Delays Endpoints
app.get("/api/sync/delays", (req, res) => {
  const schoolCode = ((req.query.schoolCode as string) || "").toLowerCase().trim();
  const email = ((req.query.email as string) || "").toLowerCase().trim();
  const uid = ((req.query.uid as string) || "").trim();
  const date = ((req.query.date as string) || "").trim();

  let results = delaysCache;
  if (date) {
    results = results.filter(r => r.date === date);
  }
  results = results.filter(r => matchesSchool(r, schoolCode, email, uid));

  res.json({ success: true, records: results });
});

app.post("/api/sync/delays", (req, res) => {
  const { record, records, deletedIds, studentId, date, clearAll, schoolCode, userEmail, userId } = req.body;

  if (clearAll) {
    delaysCache = delaysCache.filter(r => !matchesSchool(r, schoolCode, userEmail, userId));
    writeJsonFile(DELAYS_FILE, delaysCache);
    broadcastSyncEvent("delay_updated", { records: [], clearAll: true, schoolCode });
    return res.json({ success: true, count: 0, cleared: true });
  }

  const deletedList = Array.isArray(deletedIds) ? deletedIds : [];
  const targetStudentId = (studentId || "").trim();
  const targetDate = (date || "").trim();

  if (deletedList.length > 0 || (targetStudentId && targetDate)) {
    const toDelete = new Set(deletedList);
    delaysCache = delaysCache.filter(r => {
      if (toDelete.has(r.id) || (r._docId && toDelete.has(r._docId))) return false;
      if (targetStudentId && targetDate && r.studentId === targetStudentId && r.date === targetDate) return false;
      return true;
    });
  }

  const itemsToProcess = Array.isArray(records) ? records : (record ? [record] : []);
  if (itemsToProcess.length === 0 && deletedList.length === 0 && (!targetStudentId || !targetDate)) {
    return res.status(400).json({ success: false, error: "No delay records provided" });
  }

  let updatedCount = 0;
  for (const item of itemsToProcess) {
    if (!item || !item.id) continue;
    const existingIdx = delaysCache.findIndex(r => r.id === item.id || (item._docId && r.id === item._docId));
    if (existingIdx >= 0) {
      delaysCache[existingIdx] = { ...delaysCache[existingIdx], ...item, updatedAt: Date.now() };
    } else {
      delaysCache.unshift({ ...item, updatedAt: Date.now() });
    }
    updatedCount++;
  }

  writeJsonFile(DELAYS_FILE, delaysCache);
  broadcastSyncEvent("delay_updated", {
    records: itemsToProcess,
    deletedIds: deletedList,
    studentId: targetStudentId,
    date: targetDate,
    schoolCode
  });

  res.json({ success: true, updatedCount });
});

// ----------------------------------------------------
// SYNC SCHOOL SETTINGS (Name, Code)
// ----------------------------------------------------
app.get("/api/sync/school", (req, res) => {
  const schoolCode = ((req.query.schoolCode as string) || "").toLowerCase().trim();
  const email = ((req.query.email as string) || "").toLowerCase().trim();
  const uid = ((req.query.uid as string) || "").trim();

  const match = schoolSettingsCache.find(s => matchesSchool(s, schoolCode, email, uid)) || (schoolSettingsCache.length > 0 ? schoolSettingsCache[0] : null);
  res.json({
    success: true,
    schoolName: match?.schoolName || "",
    schoolCode: match?.schoolCode || schoolCode,
    updatedAt: match?.updatedAt || 0
  });
});

app.post("/api/sync/school", (req, res) => {
  const { schoolName, schoolCode, userEmail, userId, clearAll } = req.body;

  if (clearAll) {
    schoolSettingsCache = schoolSettingsCache.filter(s => !matchesSchool(s, schoolCode, userEmail, userId));
    writeJsonFile(SCHOOL_SETTINGS_FILE, schoolSettingsCache);
    broadcastSyncEvent("school_updated", { schoolName: "", schoolCode: "", cleared: true });
    return res.json({ success: true, cleared: true });
  }

  const trimmedName = (schoolName || "").trim();
  const cleanCode = (schoolCode || userEmail || userId || "default_school").trim();

  const existingIdx = schoolSettingsCache.findIndex(s => matchesSchool(s, cleanCode, userEmail, userId));
  const newSetting = {
    schoolName: trimmedName,
    schoolCode: cleanCode,
    userEmail: (userEmail || "").toLowerCase().trim(),
    userId: (userId || "").trim(),
    updatedAt: Date.now()
  };

  if (existingIdx >= 0) {
    schoolSettingsCache[existingIdx] = { ...schoolSettingsCache[existingIdx], ...newSetting };
  } else {
    schoolSettingsCache.push(newSetting);
  }

  writeJsonFile(SCHOOL_SETTINGS_FILE, schoolSettingsCache);
  broadcastSyncEvent("school_updated", newSetting);

  res.json({ success: true, schoolName: trimmedName, schoolCode: cleanCode });
});

// ----------------------------------------------------
// SYNC GRADES
// ----------------------------------------------------
app.get("/api/sync/grades", (req, res) => {
  const schoolCode = ((req.query.schoolCode as string) || "").toLowerCase().trim();
  const email = ((req.query.email as string) || "").toLowerCase().trim();
  const uid = ((req.query.uid as string) || "").trim();

  const results = gradesCache.filter(g => matchesSchool(g, schoolCode, email, uid));
  res.json({ success: true, records: results });
});

app.post("/api/sync/grades", (req, res) => {
  const { record, records, deletedIds, clearAll, schoolCode, userEmail, userId } = req.body;
  let updatedCount = 0;

  if (clearAll) {
    gradesCache = gradesCache.filter(g => !matchesSchool(g, schoolCode, userEmail, userId));
    writeJsonFile(GRADES_FILE, gradesCache);
    broadcastSyncEvent("grades_updated", { records: [], clearAll: true, schoolCode });
    return res.json({ success: true, count: 0, cleared: true });
  }

  if (Array.isArray(deletedIds) && deletedIds.length > 0) {
    const toDelete = new Set(deletedIds);
    gradesCache = gradesCache.filter(g => !toDelete.has(g.id));
  }

  const itemsToProcess = Array.isArray(records) ? records : (record ? [record] : []);
  for (const item of itemsToProcess) {
    if (!item || !item.id) continue;
    const entry = {
      ...item,
      schoolCode: item.schoolCode || schoolCode,
      userEmail: item.userEmail || userEmail,
      userId: item.userId || userId,
      updatedAt: Date.now()
    };
    const existingIdx = gradesCache.findIndex(g => g.id === item.id);
    if (existingIdx >= 0) {
      gradesCache[existingIdx] = { ...gradesCache[existingIdx], ...entry };
    } else {
      gradesCache.push(entry);
    }
    updatedCount++;
  }

  writeJsonFile(GRADES_FILE, gradesCache);
  broadcastSyncEvent("grades_updated", { records: itemsToProcess, deletedIds, schoolCode });

  res.json({ success: true, updatedCount, totalCount: gradesCache.length });
});

// ----------------------------------------------------
// SYNC CLASSES
// ----------------------------------------------------
app.get("/api/sync/classes", (req, res) => {
  const schoolCode = ((req.query.schoolCode as string) || "").toLowerCase().trim();
  const email = ((req.query.email as string) || "").toLowerCase().trim();
  const uid = ((req.query.uid as string) || "").trim();

  const results = classesCache.filter(c => matchesSchool(c, schoolCode, email, uid));
  res.json({ success: true, records: results });
});

app.post("/api/sync/classes", (req, res) => {
  const { record, records, deletedIds, clearAll, schoolCode, userEmail, userId } = req.body;
  let updatedCount = 0;

  if (clearAll) {
    classesCache = classesCache.filter(c => !matchesSchool(c, schoolCode, userEmail, userId));
    writeJsonFile(CLASSES_FILE, classesCache);
    broadcastSyncEvent("classes_updated", { records: [], clearAll: true, schoolCode });
    return res.json({ success: true, count: 0, cleared: true });
  }

  if (Array.isArray(deletedIds) && deletedIds.length > 0) {
    const toDelete = new Set(deletedIds);
    classesCache = classesCache.filter(c => !toDelete.has(c.id) && !toDelete.has(c._docId));
  }

  const itemsToProcess = Array.isArray(records) ? records : (record ? [record] : []);
  for (const item of itemsToProcess) {
    if (!item || !item.id) continue;
    const entry = {
      ...item,
      schoolCode: item.schoolCode || schoolCode,
      userEmail: item.userEmail || userEmail,
      userId: item.userId || userId,
      updatedAt: Date.now()
    };
    const existingIdx = classesCache.findIndex(c => c.id === item.id);
    if (existingIdx >= 0) {
      classesCache[existingIdx] = { ...classesCache[existingIdx], ...entry };
    } else {
      classesCache.push(entry);
    }
    updatedCount++;
  }

  writeJsonFile(CLASSES_FILE, classesCache);
  broadcastSyncEvent("classes_updated", { records: itemsToProcess, deletedIds, schoolCode });

  res.json({ success: true, updatedCount, totalCount: classesCache.length });
});

// ----------------------------------------------------
// SYNC TEACHERS
// ----------------------------------------------------
app.get("/api/sync/teachers", (req, res) => {
  const schoolCode = ((req.query.schoolCode as string) || "").toLowerCase().trim();
  const email = ((req.query.email as string) || "").toLowerCase().trim();
  const uid = ((req.query.uid as string) || "").trim();

  const results = teachersCache.filter(t => matchesSchool(t, schoolCode, email, uid));
  res.json({ success: true, records: results });
});

app.post("/api/sync/teachers", (req, res) => {
  const { record, records, deletedIds, clearAll, schoolCode, userEmail, userId } = req.body;
  let updatedCount = 0;

  if (clearAll) {
    teachersCache = teachersCache.filter(t => !matchesSchool(t, schoolCode, userEmail, userId));
    writeJsonFile(TEACHERS_FILE, teachersCache);
    broadcastSyncEvent("teachers_updated", { records: [], clearAll: true, schoolCode });
    return res.json({ success: true, count: 0, cleared: true });
  }

  if (Array.isArray(deletedIds) && deletedIds.length > 0) {
    const toDelete = new Set(deletedIds);
    teachersCache = teachersCache.filter(t => !toDelete.has(t.id) && !toDelete.has(t._docId) && !toDelete.has(t._origId));
  }

  const itemsToProcess = Array.isArray(records) ? records : (record ? [record] : []);
  for (const item of itemsToProcess) {
    if (!item || !item.id) continue;
    const entry = {
      ...item,
      schoolCode: item.schoolCode || schoolCode,
      userEmail: item.userEmail || userEmail,
      userId: item.userId || userId,
      updatedAt: Date.now()
    };
    const existingIdx = teachersCache.findIndex(t => t.id === item.id);
    if (existingIdx >= 0) {
      teachersCache[existingIdx] = { ...teachersCache[existingIdx], ...entry };
    } else {
      teachersCache.push(entry);
    }
    updatedCount++;
  }

  writeJsonFile(TEACHERS_FILE, teachersCache);
  broadcastSyncEvent("teachers_updated", { records: itemsToProcess, deletedIds, schoolCode });

  res.json({ success: true, updatedCount, totalCount: teachersCache.length });
});

// ----------------------------------------------------
// SYNC STUDENTS
// ----------------------------------------------------
app.get("/api/sync/students", (req, res) => {
  const schoolCode = ((req.query.schoolCode as string) || "").toLowerCase().trim();
  const email = ((req.query.email as string) || "").toLowerCase().trim();
  const uid = ((req.query.uid as string) || "").trim();

  const results = studentsCache.filter(s => matchesSchool(s, schoolCode, email, uid));
  res.json({ success: true, records: results });
});

app.post("/api/sync/students", (req, res) => {
  const { record, records, deletedIds, clearAll, schoolCode, userEmail, userId } = req.body;
  let updatedCount = 0;

  if (clearAll) {
    studentsCache = studentsCache.filter(s => !matchesSchool(s, schoolCode, userEmail, userId));
    writeJsonFile(STUDENTS_FILE, studentsCache);
    broadcastSyncEvent("students_updated", { records: [], clearAll: true, schoolCode });
    return res.json({ success: true, count: 0, cleared: true });
  }

  if (Array.isArray(deletedIds) && deletedIds.length > 0) {
    const toDelete = new Set(deletedIds);
    studentsCache = studentsCache.filter(s => !toDelete.has(s.id) && !toDelete.has(s._docId) && !toDelete.has(s._origId));
  }

  const itemsToProcess = Array.isArray(records) ? records : (record ? [record] : []);
  for (const item of itemsToProcess) {
    if (!item || !item.id) continue;
    const entry = {
      ...item,
      schoolCode: item.schoolCode || schoolCode,
      userEmail: item.userEmail || userEmail,
      userId: item.userId || userId,
      updatedAt: Date.now()
    };
    const existingIdx = studentsCache.findIndex(s => s.id === item.id);
    if (existingIdx >= 0) {
      studentsCache[existingIdx] = { ...studentsCache[existingIdx], ...entry };
    } else {
      studentsCache.push(entry);
    }
    updatedCount++;
  }

  writeJsonFile(STUDENTS_FILE, studentsCache);
  broadcastSyncEvent("students_updated", { records: itemsToProcess, deletedIds, schoolCode });

  res.json({ success: true, updatedCount, totalCount: studentsCache.length });
});

// ----------------------------------------------------
// SYNC ALL (Unified instantaneous bootstrap for independent links)
// ----------------------------------------------------
app.get("/api/sync/all", (req, res) => {
  const schoolCode = ((req.query.schoolCode as string) || "").toLowerCase().trim();
  const email = ((req.query.email as string) || "").toLowerCase().trim();
  const uid = ((req.query.uid as string) || "").trim();

  const schoolSetting = schoolSettingsCache.find(s => matchesSchool(s, schoolCode, email, uid));
  const grades = gradesCache.filter(g => matchesSchool(g, schoolCode, email, uid));
  const classes = classesCache.filter(c => matchesSchool(c, schoolCode, email, uid));
  const teachers = teachersCache.filter(t => matchesSchool(t, schoolCode, email, uid));
  const students = studentsCache.filter(s => matchesSchool(s, schoolCode, email, uid));
  const attendance = attendanceCache.filter(a => matchesSchool(a, schoolCode, email, uid));
  const delays = delaysCache.filter(d => matchesSchool(d, schoolCode, email, uid));
  const behaviors = behaviorsCache.filter(b => matchesSchool(b, schoolCode, email, uid));

  res.json({
    success: true,
    schoolName: schoolSetting?.schoolName || "",
    schoolCode: schoolSetting?.schoolCode || schoolCode,
    grades,
    classes,
    teachers,
    students,
    attendance,
    delays,
    behaviors,
    timestamp: Date.now()
  });
});

// ----------------------------------------------------
// SYNC PURGE ALL (Permanent irreversible server wipe)
// ----------------------------------------------------
app.post("/api/sync/purge-all", (req, res) => {
  const { schoolCode, userEmail, userId, purgeAllGlobally } = req.body || {};
  const isGlobal = Boolean(purgeAllGlobally || (!schoolCode && !userEmail && !userId));

  if (isGlobal) {
    gradesCache = [];
    classesCache = [];
    teachersCache = [];
    studentsCache = [];
    attendanceCache = [];
    delaysCache = [];
    behaviorsCache = [];
    schoolSettingsCache = [];

    writeJsonFile(GRADES_FILE, []);
    writeJsonFile(CLASSES_FILE, []);
    writeJsonFile(TEACHERS_FILE, []);
    writeJsonFile(STUDENTS_FILE, []);
    writeJsonFile(ATTENDANCE_FILE, []);
    writeJsonFile(DELAYS_FILE, []);
    writeJsonFile(BEHAVIORS_FILE, []);
    writeJsonFile(SCHOOL_SETTINGS_FILE, []);
  } else {
    gradesCache = gradesCache.filter(g => !matchesSchool(g, schoolCode, userEmail, userId));
    classesCache = classesCache.filter(c => !matchesSchool(c, schoolCode, userEmail, userId));
    teachersCache = teachersCache.filter(t => !matchesSchool(t, schoolCode, userEmail, userId));
    studentsCache = studentsCache.filter(s => !matchesSchool(s, schoolCode, userEmail, userId));
    attendanceCache = attendanceCache.filter(a => !matchesSchool(a, schoolCode, userEmail, userId));
    delaysCache = delaysCache.filter(d => !matchesSchool(d, schoolCode, userEmail, userId));
    behaviorsCache = behaviorsCache.filter(b => !matchesSchool(b, schoolCode, userEmail, userId));
    schoolSettingsCache = schoolSettingsCache.filter(s => !matchesSchool(s, schoolCode, userEmail, userId));

    writeJsonFile(GRADES_FILE, gradesCache);
    writeJsonFile(CLASSES_FILE, classesCache);
    writeJsonFile(TEACHERS_FILE, teachersCache);
    writeJsonFile(STUDENTS_FILE, studentsCache);
    writeJsonFile(ATTENDANCE_FILE, attendanceCache);
    writeJsonFile(DELAYS_FILE, delaysCache);
    writeJsonFile(BEHAVIORS_FILE, behaviorsCache);
    writeJsonFile(SCHOOL_SETTINGS_FILE, schoolSettingsCache);
  }

  broadcastSyncEvent("purge_all", { isGlobal, schoolCode, userEmail, userId, timestamp: Date.now() });

  res.json({
    success: true,
    message: "Data permanently purged from server memory and disk files",
    timestamp: Date.now()
  });
});

// ----------------------------------------------------
// SYNC BOOTSTRAP (Bulk sync from Admin to Server)
// ----------------------------------------------------
app.post("/api/sync/bootstrap", (req, res) => {
  const { schoolCode, schoolName, userEmail, userId, grades, classes, teachers, students, clearFirst } = req.body;
  const cleanCode = (schoolCode || userEmail || userId || "").trim();

  if (clearFirst) {
    if (Array.isArray(grades)) {
      gradesCache = gradesCache.filter(g => !matchesSchool(g, cleanCode, userEmail, userId));
      writeJsonFile(GRADES_FILE, gradesCache);
    }
    if (Array.isArray(classes)) {
      classesCache = classesCache.filter(c => !matchesSchool(c, cleanCode, userEmail, userId));
      writeJsonFile(CLASSES_FILE, classesCache);
    }
    if (Array.isArray(teachers)) {
      teachersCache = teachersCache.filter(t => !matchesSchool(t, cleanCode, userEmail, userId));
      writeJsonFile(TEACHERS_FILE, teachersCache);
    }
    if (Array.isArray(students)) {
      studentsCache = studentsCache.filter(s => !matchesSchool(s, cleanCode, userEmail, userId));
      writeJsonFile(STUDENTS_FILE, studentsCache);
    }
  }

  if (schoolName) {
    const existingIdx = schoolSettingsCache.findIndex(s => matchesSchool(s, cleanCode, userEmail, userId));
    const newSetting = {
      schoolName: schoolName.trim(),
      schoolCode: cleanCode,
      userEmail: (userEmail || "").toLowerCase().trim(),
      userId: (userId || "").trim(),
      updatedAt: Date.now()
    };
    if (existingIdx >= 0) {
      schoolSettingsCache[existingIdx] = { ...schoolSettingsCache[existingIdx], ...newSetting };
    } else {
      schoolSettingsCache.push(newSetting);
    }
    writeJsonFile(SCHOOL_SETTINGS_FILE, schoolSettingsCache);
  }

  if (Array.isArray(grades) && grades.length > 0) {
    for (const g of grades) {
      if (!g || !g.id) continue;
      const idx = gradesCache.findIndex(x => x.id === g.id);
      const entry = { ...g, schoolCode: cleanCode, userEmail, userId, updatedAt: Date.now() };
      if (idx >= 0) {
        gradesCache[idx] = { ...gradesCache[idx], ...entry };
      } else {
        gradesCache.push(entry);
      }
    }
    writeJsonFile(GRADES_FILE, gradesCache);
  }

  if (Array.isArray(classes) && classes.length > 0) {
    for (const c of classes) {
      if (!c || !c.id) continue;
      const idx = classesCache.findIndex(x => x.id === c.id);
      const entry = { ...c, schoolCode: cleanCode, userEmail, userId, updatedAt: Date.now() };
      if (idx >= 0) {
        classesCache[idx] = { ...classesCache[idx], ...entry };
      } else {
        classesCache.push(entry);
      }
    }
    writeJsonFile(CLASSES_FILE, classesCache);
  }

  if (Array.isArray(teachers) && teachers.length > 0) {
    for (const t of teachers) {
      if (!t || !t.id) continue;
      const idx = teachersCache.findIndex(x => x.id === t.id);
      const entry = { ...t, schoolCode: cleanCode, userEmail, userId, updatedAt: Date.now() };
      if (idx >= 0) {
        teachersCache[idx] = { ...teachersCache[idx], ...entry };
      } else {
        teachersCache.push(entry);
      }
    }
    writeJsonFile(TEACHERS_FILE, teachersCache);
  }

  if (Array.isArray(students) && students.length > 0) {
    for (const s of students) {
      if (!s || !s.id) continue;
      const idx = studentsCache.findIndex(x => x.id === s.id);
      const entry = { ...s, schoolCode: cleanCode, userEmail, userId, updatedAt: Date.now() };
      if (idx >= 0) {
        studentsCache[idx] = { ...studentsCache[idx], ...entry };
      } else {
        studentsCache.push(entry);
      }
    }
    writeJsonFile(STUDENTS_FILE, studentsCache);
  }

  broadcastSyncEvent("bootstrap_updated", { schoolCode: cleanCode, schoolName });

  res.json({
    success: true,
    gradesCount: gradesCache.length,
    classesCount: classesCache.length,
    teachersCount: teachersCache.length,
    studentsCount: studentsCache.length
  });
});

// ----------------------------------------------------
// VITE MIDDLEWARE & STATIC SERVING
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT, host: "0.0.0.0" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
