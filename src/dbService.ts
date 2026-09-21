import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  writeBatch,
  serverTimestamp,
  onSnapshot,
  disableNetwork,
  enableNetwork
} from "firebase/firestore";
import { 
  db, 
  auth as firebaseAuth, 
  getActiveFirestoreDatabaseId, 
  setActiveFirestoreDatabaseId, 
  getDbForDatabaseId,
  updateActiveDb
} from "./firebase";
export { getActiveFirestoreDatabaseId, setActiveFirestoreDatabaseId, getDbForDatabaseId, updateActiveDb };

import { Grade, Class, Teacher, Student, AttendanceRecord, BehaviorRecord, MorningDelayRecord, RegisteredUser } from "./types";

// Active user proxy for unauthenticated direct links
let activeUserProxy: any = null;

// In-memory alias cache for UID <-> Email <-> School Name mappings
const userProfileAliasCache = new Map<string, { uid: string; email: string; schoolName?: string }>();

// Pre-populate known cross-device alias mappings for unified sync
userProfileAliasCache.set("qgosybcp28mzmbyt92ah8vdgag33", { uid: "QgOSyBcP28MzmbJT92aH8vdgAG33", email: "majedsoft@gmail.com" });
userProfileAliasCache.set("njxly7awt3txlyaijuvkkabjrovr1", { uid: "njxly7aWt3TxLYAIjUvkabjroVr1", email: "majedsoft@gmail.com" });

// Canonical Grade Definitions for cross-device consistency
export const CANONICAL_GRADES: Grade[] = [
  { id: "grd_1787486478418_m1v1te7", name: "الاول", createdAt: 1 },
  { id: "grd_1787486478419_kzbpntv", name: "الثاني", createdAt: 2 },
  { id: "grd_1787486478421_zpivf6l", name: "الثالث", createdAt: 3 },
];

export const CANONICAL_GRADE_MAP: Record<string, string> = {
  "grd_1787486478418_m1v1te7": "grd_1787486478418_m1v1te7",
  "grd_1788615255472_k1th86n": "grd_1787486478418_m1v1te7",
  "grd_1787424395700_694x0wh": "grd_1787486478418_m1v1te7",
  "grd_1788235762109_91o41jx": "grd_1787486478418_m1v1te7",
  "grd_1787486478419_kzbpntv": "grd_1787486478419_kzbpntv",
  "grd_1788615255474_wdizmo7": "grd_1787486478419_kzbpntv",
  "grd_1787424395700_62c4376": "grd_1787486478419_kzbpntv",
  "grd_1787486478421_zpivf6l": "grd_1787486478421_zpivf6l",
  "grd_1788615255474_yye100i": "grd_1787486478421_zpivf6l",
  "grd_1787424395700_09h1uq4": "grd_1787486478421_zpivf6l",
};

// Canonical 16 Classes for cross-device consistency
export const CANONICAL_CLASSES: Class[] = [
  // الأول
  { id: "cls_1787486481669_2x4wh9m", gradeId: "grd_1787486478418_m1v1te7", name: "الفصل 1" },
  { id: "cls_1787486482643_rnx5wlj", gradeId: "grd_1787486478418_m1v1te7", name: "الفصل 2" },
  { id: "cls_1787486483400_yuc7b8q", gradeId: "grd_1787486478418_m1v1te7", name: "الفصل 3" },
  { id: "cls_1787486484164_nsqjt0r", gradeId: "grd_1787486478418_m1v1te7", name: "الفصل 4" },
  { id: "cls_1787486484899_w1xtbsh", gradeId: "grd_1787486478418_m1v1te7", name: "الفصل 5" },
  // الثاني
  { id: "cls_1787486495096_57tzytm", gradeId: "grd_1787486478419_kzbpntv", name: "الفصل 1" },
  { id: "cls_1787486495963_wb1s5bl", gradeId: "grd_1787486478419_kzbpntv", name: "الفصل 2" },
  { id: "cls_1787486496714_60oev2x", gradeId: "grd_1787486478419_kzbpntv", name: "الفصل 3" },
  { id: "cls_1787486497415_7he949g", gradeId: "grd_1787486478419_kzbpntv", name: "الفصل 4" },
  { id: "cls_1787486498114_n5c95e8", gradeId: "grd_1787486478419_kzbpntv", name: "الفصل 5" },
  { id: "cls_1787486498963_g2n01ns", gradeId: "grd_1787486478419_kzbpntv", name: "الفصل 6" },
  // الثالث
  { id: "cls_1787486501508_hbfxk7x", gradeId: "grd_1787486478421_zpivf6l", name: "الفصل 1" },
  { id: "cls_1787486502966_j74kf43", gradeId: "grd_1787486478421_zpivf6l", name: "الفصل 2" },
  { id: "cls_1787486503966_a9nb3rc", gradeId: "grd_1787486478421_zpivf6l", name: "الفصل 3" },
  { id: "cls_1787486505030_sssv4o6", gradeId: "grd_1787486478421_zpivf6l", name: "الفصل 4" },
  { id: "cls_1787486505867_qthqy83", gradeId: "grd_1787486478421_zpivf6l", name: "الفصل 5" },
];

// Fallback map for cross-device/interrupted student classId assignments
export const CLASS_ID_FALLBACK_MAP: Record<string, { classId: string; gradeId: string }> = {
  // Canonical classes map to themselves
  "cls_1787486481669_2x4wh9m": { classId: "cls_1787486481669_2x4wh9m", gradeId: "grd_1787486478418_m1v1te7" },
  "cls_1787486482643_rnx5wlj": { classId: "cls_1787486482643_rnx5wlj", gradeId: "grd_1787486478418_m1v1te7" },
  "cls_1787486483400_yuc7b8q": { classId: "cls_1787486483400_yuc7b8q", gradeId: "grd_1787486478418_m1v1te7" },
  "cls_1787486484164_nsqjt0r": { classId: "cls_1787486484164_nsqjt0r", gradeId: "grd_1787486478418_m1v1te7" },
  "cls_1787486484899_w1xtbsh": { classId: "cls_1787486484899_w1xtbsh", gradeId: "grd_1787486478418_m1v1te7" },
  "cls_1787486495096_57tzytm": { classId: "cls_1787486495096_57tzytm", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1787486495963_wb1s5bl": { classId: "cls_1787486495963_wb1s5bl", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1787486496714_60oev2x": { classId: "cls_1787486496714_60oev2x", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1787486497415_7he949g": { classId: "cls_1787486497415_7he949g", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1787486498114_n5c95e8": { classId: "cls_1787486498114_n5c95e8", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1787486498963_g2n01ns": { classId: "cls_1787486498963_g2n01ns", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1787486501508_hbfxk7x": { classId: "cls_1787486501508_hbfxk7x", gradeId: "grd_1787486478421_zpivf6l" },
  "cls_1787486502966_j74kf43": { classId: "cls_1787486502966_j74kf43", gradeId: "grd_1787486478421_zpivf6l" },
  "cls_1787486503966_a9nb3rc": { classId: "cls_1787486503966_a9nb3rc", gradeId: "grd_1787486478421_zpivf6l" },
  "cls_1787486505030_sssv4o6": { classId: "cls_1787486505030_sssv4o6", gradeId: "grd_1787486478421_zpivf6l" },
  "cls_1787486505867_qthqy83": { classId: "cls_1787486505867_qthqy83", gradeId: "grd_1787486478421_zpivf6l" },
  // Cross-device alias mappings for second device / alternative uploads
  "cls_1788615257265_78tta7w": { classId: "cls_1787486481669_2x4wh9m", gradeId: "grd_1787486478418_m1v1te7" },
  "cls_1788615258203_hcjbj4u": { classId: "cls_1787486482643_rnx5wlj", gradeId: "grd_1787486478418_m1v1te7" },
  "cls_1788615258818_uestlim": { classId: "cls_1787486483400_yuc7b8q", gradeId: "grd_1787486478418_m1v1te7" },
  "cls_1788615259633_9ejpaz9": { classId: "cls_1787486484164_nsqjt0r", gradeId: "grd_1787486478418_m1v1te7" },
  "cls_1788615260289_8cjn1yl": { classId: "cls_1787486484899_w1xtbsh", gradeId: "grd_1787486478418_m1v1te7" },
  "cls_1788615262369_bddp5w8": { classId: "cls_1787486495096_57tzytm", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1788615262885_at116xm": { classId: "cls_1787486495963_wb1s5bl", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1788615263431_mr7cod9": { classId: "cls_1787486496714_60oev2x", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1788615264001_fryig9h": { classId: "cls_1787486497415_7he949g", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1788615264550_0cx0xgt": { classId: "cls_1787486498114_n5c95e8", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1788615265036_irgyxi7": { classId: "cls_1787486498963_g2n01ns", gradeId: "grd_1787486478419_kzbpntv" },
  "cls_1788615267968_4hj4197": { classId: "cls_1787486501508_hbfxk7x", gradeId: "grd_1787486478421_zpivf6l" },
  "cls_1788615268805_q9w2y9x": { classId: "cls_1787486502966_j74kf43", gradeId: "grd_1787486478421_zpivf6l" },
  "cls_1788615269401_7eccbwh": { classId: "cls_1787486503966_a9nb3rc", gradeId: "grd_1787486478421_zpivf6l" },
  "cls_1788615269965_kn8q6b9": { classId: "cls_1787486505030_sssv4o6", gradeId: "grd_1787486478421_zpivf6l" },
  "cls_1788615270903_f26on4o": { classId: "cls_1787486505867_qthqy83", gradeId: "grd_1787486478421_zpivf6l" }
};

// ----------------------------------------------------
// PERMANENT DELETION TOMBSTONE (Never restore deleted data)
// ----------------------------------------------------
const DELETED_ENTITIES_KEY = "apsent_deleted_entities_record_v1";
const DELETED_ATTENDANCE_ENTRIES_KEY = "apsent_deleted_att_entries_v1";
const DELETED_DELAYS_KEY = "apsent_deleted_delays_v1";

export type SupportedEntityType = "classes" | "grades" | "students" | "teachers" | "attendance" | "morning_delays" | "behaviors" | string;

// In-memory sets for 0ms synchronous lookups
const memoryDeletedEntities = new Set<string>();
const memoryDeletedAttEntries = new Set<string>();
const memoryDeletedDelays = new Set<string>();

// Bootstrap memory sets from localStorage
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(DELETED_ENTITIES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach(k => memoryDeletedEntities.add(k));
    }
  } catch (_) {}
  try {
    const raw = localStorage.getItem(DELETED_ATTENDANCE_ENTRIES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach(k => memoryDeletedAttEntries.add(k));
    }
  } catch (_) {}
  try {
    const raw = localStorage.getItem(DELETED_DELAYS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach(k => memoryDeletedDelays.add(k));
    }
  } catch (_) {}
}

export function recordDeletedId(type: SupportedEntityType, id: string): void {
  if (!id) return;
  const itemKey = `${type}:${id}`;
  memoryDeletedEntities.add(itemKey);
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(DELETED_ENTITIES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(itemKey)) {
      list.push(itemKey);
      if (list.length > 10000) list.shift();
      localStorage.setItem(DELETED_ENTITIES_KEY, JSON.stringify(list));
    }
  } catch (_) {}
}

export function recordDeletedIds(type: SupportedEntityType, ids: string[]): void {
  if (!Array.isArray(ids) || ids.length === 0) return;
  ids.forEach(id => {
    if (id) memoryDeletedEntities.add(`${type}:${id}`);
  });
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(DELETED_ENTITIES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const set = new Set(list);
    ids.forEach(id => {
      if (id) set.add(`${type}:${id}`);
    });
    const updated = Array.from(set);
    if (updated.length > 10000) updated.splice(0, updated.length - 10000);
    localStorage.setItem(DELETED_ENTITIES_KEY, JSON.stringify(updated));
  } catch (_) {}
}

export function isIdDeleted(type: SupportedEntityType, id: string): boolean {
  if (!id) return false;
  const itemKey = `${type}:${id}`;
  if (memoryDeletedEntities.has(itemKey)) return true;
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(DELETED_ENTITIES_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    if (list.includes(itemKey)) {
      memoryDeletedEntities.add(itemKey);
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

export function unmarkDeletedId(type: SupportedEntityType, id: string): void {
  if (!id) return;
  const itemKey = `${type}:${id}`;
  memoryDeletedEntities.delete(itemKey);
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(DELETED_ENTITIES_KEY);
    if (!raw) return;
    let list: string[] = JSON.parse(raw);
    list = list.filter(item => item !== itemKey);
    localStorage.setItem(DELETED_ENTITIES_KEY, JSON.stringify(list));
  } catch (_) {}
}

// Attendance Entry-level tombstones (e.g. deleting specific student absence from period record)
export function recordDeletedAttendanceEntry(recordId: string, studentId: string, isAbsent: boolean): void {
  if (!recordId || !studentId) return;
  const kind = isAbsent ? "abs" : "late";
  const key = `${recordId}:${studentId}:${kind}`;
  memoryDeletedAttEntries.add(key);
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(DELETED_ATTENDANCE_ENTRIES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(key)) {
      list.push(key);
      if (list.length > 10000) list.shift();
      localStorage.setItem(DELETED_ATTENDANCE_ENTRIES_KEY, JSON.stringify(list));
    }
  } catch (_) {}
}

export function isAttendanceEntryDeleted(recordId: string, studentId: string, isAbsent: boolean): boolean {
  if (!recordId || !studentId) return false;
  const kind = isAbsent ? "abs" : "late";
  const key = `${recordId}:${studentId}:${kind}`;
  if (memoryDeletedAttEntries.has(key)) return true;
  // Also check generic slot matches if recordId has prefixes
  for (const item of memoryDeletedAttEntries) {
    if (item.endsWith(`:${studentId}:${kind}`)) {
      const parts = item.split(":");
      const storedRecId = parts[0];
      if (recordId.includes(storedRecId) || storedRecId.includes(recordId)) {
        return true;
      }
    }
  }
  return false;
}

// Morning Delay tombstones by (date, studentId)
export function recordDeletedMorningDelay(date: string, studentId: string): void {
  if (!date || !studentId) return;
  const key = `${date}:${studentId}`;
  memoryDeletedDelays.add(key);
  recordDeletedId("morning_delays", `delay_${date}_${studentId}`);
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(DELETED_DELAYS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(key)) {
      list.push(key);
      if (list.length > 10000) list.shift();
      localStorage.setItem(DELETED_DELAYS_KEY, JSON.stringify(list));
    }
  } catch (_) {}
}

export function isMorningDelayDeleted(date?: string, studentId?: string): boolean {
  if (!date || !studentId) return false;
  const key = `${date}:${studentId}`;
  if (memoryDeletedDelays.has(key)) return true;
  if (isIdDeleted("morning_delays", `delay_${date}_${studentId}`)) return true;
  return false;
}

// Helper to sanitize an attendance record against deleted student absences/lates
export function sanitizeAttendanceRecord(record: any): any {
  if (!record) return record;
  const rId = record.id || record._docId || "";
  let absent = Array.isArray(record.absent) ? [...record.absent] : [];
  let late = Array.isArray(record.late) ? [...record.late] : [];
  let present = Array.isArray(record.present) ? [...record.present] : [];

  let changed = false;
  if (rId) {
    absent = absent.filter(sId => {
      if (isAttendanceEntryDeleted(rId, sId, true)) {
        changed = true;
        if (!present.includes(sId)) present.push(sId);
        return false;
      }
      return true;
    });
    late = late.filter(sId => {
      if (isAttendanceEntryDeleted(rId, sId, false)) {
        changed = true;
        if (!present.includes(sId)) present.push(sId);
        return false;
      }
      return true;
    });
  }

  if (changed) {
    return {
      ...record,
      absent,
      late,
      present,
      isNoAbsence: absent.length === 0 && late.length === 0
    };
  }
  return record;
}

export function isRecordTombstoned(colName: string, item: any): boolean {
  if (!item) return true;
  const id = item.id || item._docId || item._origId;
  if (id && isIdDeleted(colName, id)) return true;

  if (colName === MORNING_DELAYS_COLL) {
    if (isMorningDelayDeleted(item.date, item.studentId)) return true;
    if (id && isMorningDelayDeleted(undefined, id)) return true;
  }
  return false;
}

export function normalizeStudentData(student: any): any {
  if (!student) return student;
  let gradeId = student.gradeId;
  let classId = student.classId;

  if (classId && CLASS_ID_FALLBACK_MAP[classId]) {
    const mapped = CLASS_ID_FALLBACK_MAP[classId];
    gradeId = mapped.gradeId;
    classId = mapped.classId;
  } else if (gradeId && CANONICAL_GRADE_MAP[gradeId]) {
    gradeId = CANONICAL_GRADE_MAP[gradeId];
  }

  return {
    ...student,
    gradeId,
    classId
  };
}

export function setActiveUser(user: any) {
  activeUserProxy = user;
  if (user?.uid || user?.email) {
    const uUid = (user?.uid || "").trim();
    const uEmail = (user?.email || "").toLowerCase().trim();
    const dName = user?.displayName || "";
    if (uUid) {
      userProfileAliasCache.set(uUid.toLowerCase(), { uid: uUid, email: uEmail, schoolName: dName });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`user_alias_${uUid.toLowerCase()}`, JSON.stringify({ uid: uUid, email: uEmail, schoolName: dName }));
        } catch (e) {}
      }
    }
    if (uEmail) {
      userProfileAliasCache.set(uEmail.toLowerCase(), { uid: uUid, email: uEmail, schoolName: dName });
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`user_alias_${uEmail.toLowerCase()}`, JSON.stringify({ uid: uUid, email: uEmail, schoolName: dName }));
        } catch (e) {}
      }
    }
  }
}

/**
 * Resolves the effective UID and Email from Firebase auth or active proxy / URL params.
 * If logged in via Google Auth, uses the Google user.
 * If accessed via direct link with owner/email in URL, uses the linked owner credentials.
 * If unauthenticated with no link params, returns empty credentials.
 */
export function getEffectiveUidAndEmail(): { uid: string; email: string; isGuest?: boolean } {
  // 1. Check URL parameters directly if available in browser (highest priority for shared portal links)
  if (typeof window !== "undefined") {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashIndex = window.location.hash.indexOf("?");
      const hashParams = hashIndex !== -1 ? new URLSearchParams(window.location.hash.substring(hashIndex)) : null;
      const schoolCodeParam = (searchParams.get("schoolCode") || searchParams.get("code") || searchParams.get("schoolId") || hashParams?.get("schoolCode") || hashParams?.get("code") || hashParams?.get("schoolId") || "").trim();
      const ownerParam = (searchParams.get("owner") || searchParams.get("ownerId") || searchParams.get("uid") || hashParams?.get("owner") || hashParams?.get("ownerId") || hashParams?.get("uid") || schoolCodeParam).trim();
      const emailParam = (searchParams.get("email") || searchParams.get("ownerEmail") || searchParams.get("userEmail") || hashParams?.get("email") || hashParams?.get("ownerEmail") || hashParams?.get("userEmail") || (schoolCodeParam.includes("@") ? schoolCodeParam : "")).trim().toLowerCase();

      if (ownerParam || emailParam) {
        if (ownerParam) {
          userProfileAliasCache.set(ownerParam.toLowerCase(), { uid: ownerParam, email: emailParam });
        }
        if (emailParam) {
          userProfileAliasCache.set(emailParam.toLowerCase(), { uid: ownerParam, email: emailParam });
        }
        try {
          localStorage.setItem("last_active_school_owner", JSON.stringify({ uid: ownerParam, email: emailParam }));
          if (schoolCodeParam || ownerParam) {
            localStorage.setItem("linked_school_owner_id", schoolCodeParam || ownerParam);
            localStorage.setItem("school_unique_code", schoolCodeParam || ownerParam);
          }
        } catch (_) {}
        return {
          uid: ownerParam,
          email: emailParam,
          isGuest: false
        };
      }
    } catch (e) {}
  }

  // 2. Active User Proxy (set when linking a school code or switching context)
  if (activeUserProxy && (activeUserProxy.uid || activeUserProxy.email)) {
    const pUid = activeUserProxy.uid || "";
    const pEmail = (activeUserProxy.email || "").toLowerCase();
    return {
      uid: pUid,
      email: pEmail,
      isGuest: false
    };
  }

  // 3. Authenticated Firebase Auth user
  if (firebaseAuth.currentUser) {
    const cUid = firebaseAuth.currentUser.uid;
    const cEmail = firebaseAuth.currentUser.email?.toLowerCase() || "";
    if (cUid) {
      userProfileAliasCache.set(cUid.toLowerCase(), { uid: cUid, email: cEmail });
    }
    if (cEmail) {
      userProfileAliasCache.set(cEmail.toLowerCase(), { uid: cUid, email: cEmail });
    }
    return {
      uid: cUid,
      email: cEmail,
      isGuest: false
    };
  }

  // 4. Stored linked school owner across independent links and tabs
  if (typeof window !== "undefined") {
    try {
      const linked = localStorage.getItem("linked_school_owner_id");
      if (linked && linked.trim()) {
        const cleanLinked = linked.trim();
        const isEmail = cleanLinked.includes("@");
        const cached = userProfileAliasCache.get(cleanLinked.toLowerCase());
        return {
          uid: isEmail ? (cached?.uid || cleanLinked) : cleanLinked,
          email: isEmail ? cleanLinked.toLowerCase() : (cached?.email || `owner_${cleanLinked}@school.com`),
          isGuest: false
        };
      }
      const rawOwner = localStorage.getItem("last_active_school_owner");
      if (rawOwner) {
        const parsed = JSON.parse(rawOwner);
        if (parsed && (parsed.uid || parsed.email)) {
          const pUid = (parsed.uid || "").trim();
          const pEmail = (parsed.email || "").toLowerCase().trim();
          if (pUid) userProfileAliasCache.set(pUid.toLowerCase(), { uid: pUid, email: pEmail });
          if (pEmail) userProfileAliasCache.set(pEmail.toLowerCase(), { uid: pUid, email: pEmail });
          return {
            uid: pUid,
            email: pEmail,
            isGuest: false
          };
        }
      }
    } catch (_) {}
  }

  // 5. Fallback to own local admin ID
  if (typeof window !== "undefined") {
    const ownId = (localStorage.getItem("own_school_admin_id") || "").trim();
    const ownEmail = (localStorage.getItem("own_school_admin_email") || "").trim().toLowerCase();
    if (ownId || ownEmail) {
      return {
        uid: ownId,
        email: ownEmail,
        isGuest: true
      };
    }

    // 6. Check if any cached school owner or admin ID exists in localStorage
    const cachedAdmin = localStorage.getItem("own_school_admin_id") || localStorage.getItem("last_active_school_owner");
    if (cachedAdmin) {
      try {
        if (cachedAdmin.startsWith("{")) {
          const parsed = JSON.parse(cachedAdmin);
          if (parsed && (parsed.uid || parsed.email)) {
            return {
              uid: (parsed.uid || "").trim(),
              email: (parsed.email || "").toLowerCase().trim(),
              isGuest: true
            };
          }
        } else {
          return {
            uid: cachedAdmin.trim(),
            email: "",
            isGuest: true
          };
        }
      } catch (_) {}
    }
  }

  // Guaranteed persistent fallback context for shared links so school data never gets orphaned
  return {
    uid: "guest_school_admin",
    email: "admin@school.local",
    isGuest: true
  };
}

// Get the canonical School Code for cross-device linking and syncing
export function getSchoolCode(): string {
  if (typeof window !== "undefined") {
    // 1. Check current URL params first for explicit active link context
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashIndex = window.location.hash.indexOf("?");
      const hashParams = hashIndex !== -1 ? new URLSearchParams(window.location.hash.substring(hashIndex)) : null;
      const urlCode = (searchParams.get("schoolCode") || searchParams.get("code") || searchParams.get("schoolId") || hashParams?.get("schoolCode") || hashParams?.get("code") || hashParams?.get("schoolId") || "").trim();
      if (urlCode && !urlCode.startsWith("guest")) return urlCode;
    } catch (_) {}

    // 2. Check registered school code cached in localStorage
    const regCode = localStorage.getItem("registered_school_code");
    if (regCode && regCode.trim() && !regCode.startsWith("guest")) return regCode.trim();

    // 3. Check explicitly linked school owner ID
    const linked = localStorage.getItem("linked_school_owner_id");
    if (linked && linked.trim() && !linked.startsWith("guest")) return linked.trim();

    // 4. Check custom school code
    const custom = localStorage.getItem("school_unique_code");
    if (custom && custom.trim() && !custom.startsWith("guest")) return custom.trim();
  }

  // 5. Authenticated Google Email
  const eff = getEffectiveUidAndEmail();
  if (eff.email && !eff.email.endsWith("@school.com") && !eff.email.endsWith("@school.local") && !eff.isGuest) {
    return eff.email;
  }
  // 6. Authenticated UID
  if (eff.uid && eff.uid !== "school_admin" && !eff.uid.startsWith("guest") && !eff.isGuest) {
    return eff.uid;
  }

  // 7. Local admin credentials
  if (typeof window !== "undefined") {
    const ownEmail = (localStorage.getItem("own_school_admin_email") || "").trim();
    if (ownEmail && !ownEmail.endsWith("@school.com") && !ownEmail.endsWith("@school.local") && !ownEmail.startsWith("guest")) return ownEmail;
    const ownId = (localStorage.getItem("own_school_admin_id") || "").trim();
    if (ownId && !ownId.startsWith("guest") && ownId !== "school_admin") return ownId;
  }

  return "";
}

export function setSchoolCode(code: string): void {
  if (typeof window === "undefined" || !code) return;
  const cleanCode = code.trim();
  try {
    localStorage.setItem("school_unique_code", cleanCode);
    localStorage.setItem("linked_school_owner_id", cleanCode);
  } catch (_) {}
  setLinkedSchoolOwnerId(cleanCode);
}

export function getOrCreateOwnSchoolAdminId(): string {
  const eff = getEffectiveUidAndEmail();
  if (eff.uid) return eff.uid;
  if (typeof window !== "undefined") {
    let stored = localStorage.getItem("own_school_admin_id");
    if (!stored) {
      stored = `school_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem("own_school_admin_id", stored);
    }
    return stored;
  }
  return "school_admin";
}

export function setLinkedSchoolOwnerId(id: string): void {
  if (id) {
    const cleanId = id.trim();
    const isEmail = cleanId.includes("@");
    const cached = userProfileAliasCache.get(cleanId.toLowerCase());
    activeUserProxy = {
      uid: isEmail ? (cached?.uid || cleanId) : cleanId,
      email: isEmail ? cleanId.toLowerCase() : (cached?.email || `owner_${cleanId}@school.com`),
      displayName: "المعلم / المشرف",
      isGuest: false
    };
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("linked_school_owner_id", cleanId);
        localStorage.setItem("school_unique_code", cleanId);
        localStorage.setItem("last_active_school_owner", JSON.stringify(activeUserProxy));
      } catch (_) {}
    }
  }
}

// Auth proxy returning actual or effective user
const auth = {
  get currentUser() {
    const eff = getEffectiveUidAndEmail();
    if (eff && (eff.uid || eff.email)) {
      return {
        uid: eff.uid,
        email: eff.email,
        displayName: activeUserProxy?.displayName || firebaseAuth.currentUser?.displayName || "زائر (مباشر)"
      };
    }
    return null;
  }
};

// Collection Names
const GRADES_COLL = "grades";
const CLASSES_COLL = "classes";
const TEACHERS_COLL = "teachers";
const STUDENTS_COLL = "students";
const ATTENDANCE_COLL = "attendance";
const BEHAVIORS_COLL = "behaviors";
const MORNING_DELAYS_COLL = "morning_delays";
const SETTINGS_COLL = "settings";
const USERS_COLL = "registered_users";

// --- ROBUST LOCAL CACHE & SYNC ENGINE ---
function getLocalStorageKey(colName: string, uid?: string): string {
  const eff = getEffectiveUidAndEmail();
  const userUid = uid || eff.uid || "";
  return userUid ? `school_offline_cache_${userUid}_${colName}` : `school_offline_cache_${colName}`;
}

function getLocalItems(colName: string, uid?: string): any[] {
  const eff = getEffectiveUidAndEmail();
  const currentUid = uid || eff.uid || "";
  const currentEmail = (eff.email || "").toLowerCase().trim();
  if (typeof window === "undefined") return [];
  if (!currentUid && !currentEmail) return [];

  try {
    // 1. Check primary Email key (Highest priority for email isolation)
    if (currentEmail) {
      const rawEmail = localStorage.getItem(`school_offline_cache_${currentEmail}_${colName}`);
      if (rawEmail) {
        try {
          const parsed = JSON.parse(rawEmail);
          if (Array.isArray(parsed)) return parsed.filter(i => isDocBelongingToUser(i, currentUid, currentEmail));
        } catch (_) {}
      }
    }

    // 2. Check primary UID key
    if (currentUid) {
      const rawUser = localStorage.getItem(`school_offline_cache_${currentUid}_${colName}`);
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser);
          if (Array.isArray(parsed)) return parsed.filter(i => isDocBelongingToUser(i, currentUid, currentEmail));
        } catch (_) {}
      }
    }

    return [];
  } catch (e) {
    return [];
  }
}

export function getLocalCollection<T = any>(colName: string, uid?: string): T[] {
  const eff = getEffectiveUidAndEmail();
  if (!eff.uid && !eff.email) {
    return [];
  }
  const items = getLocalItems(colName, uid);
  return (Array.isArray(items) ? items : []) as T[];
}

function setLocalItems(colName: string, items: any[], uid?: string) {
  const eff = getEffectiveUidAndEmail();
  const currentUid = uid || eff.uid || "";
  const currentEmail = (eff.email || "").toLowerCase().trim();
  if (typeof window === "undefined" || (!currentUid && !currentEmail)) return;

  try {
    // Only save items that strictly belong to the current user/email
    const safeItems = (Array.isArray(items) ? items : []).filter(i => isDocBelongingToUser(i, currentUid, currentEmail));
    const json = JSON.stringify(safeItems);

    if (currentEmail) {
      const k1 = `school_offline_cache_${currentEmail}_${colName}`;
      if (localStorage.getItem(k1) !== json) {
        localStorage.setItem(k1, json);
      }
    }
    if (currentUid) {
      const k2 = `school_offline_cache_${currentUid}_${colName}`;
      if (localStorage.getItem(k2) !== json) {
        localStorage.setItem(k2, json);
      }
    }
  } catch (e) {}
}

function saveOrUpdateLocalItem(colName: string, item: any, uid?: string) {
  const eff = getEffectiveUidAndEmail();
  const currentUid = uid || eff.uid || "";
  if ((!currentUid && !eff.email) || !item) return;
  const items = getLocalItems(colName, currentUid);
  const safeItems = Array.isArray(items) ? [...items] : [];
  const idx = safeItems.findIndex(i => i && (i.id === item.id || (i._docId && i._docId === item.id)));
  if (idx >= 0) {
    safeItems[idx] = { ...safeItems[idx], ...item };
  } else {
    safeItems.push(item);
  }
  setLocalItems(colName, safeItems, currentUid);
  notifyCollectionSubscribers(colName, safeItems);
}

function bulkSaveOrUpdateLocalItems(colName: string, itemsToSave: any[], uid?: string) {
  const eff = getEffectiveUidAndEmail();
  const currentUid = uid || eff.uid || "";
  if ((!currentUid && !eff.email) || !Array.isArray(itemsToSave) || itemsToSave.length === 0) return;

  const currentItems = getLocalItems(colName, currentUid);
  const safeItems = Array.isArray(currentItems) ? [...currentItems] : [];
  
  let changed = false;
  itemsToSave.forEach(item => {
    if (!item || !item.id) return;
    const idx = safeItems.findIndex(i => i && (i.id === item.id || (i._docId && i._docId === item.id)));
    if (idx >= 0) {
      safeItems[idx] = { ...safeItems[idx], ...item };
    } else {
      safeItems.push(item);
    }
    changed = true;
  });

  if (changed) {
    setLocalItems(colName, safeItems, currentUid);
    notifyCollectionSubscribers(colName, safeItems);
  }
}

function removeLocalItem(colName: string, id: string, uid?: string) {
  if (typeof window === "undefined" || !id) return;
  try {
    const eff = getEffectiveUidAndEmail();
    const currentUid = uid || eff.uid || "";
    const currentEmail = (eff.email || "").toLowerCase().trim();
    if (!currentUid && !currentEmail) return;

    const keys = [
      currentEmail ? `school_offline_cache_${currentEmail}_${colName}` : null,
      currentUid ? `school_offline_cache_${currentUid}_${colName}` : null
    ].filter(Boolean) as string[];

    keys.forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(i => i && i.id !== id && i._docId !== id && i._origId !== id);
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        } catch (_) {}
      }
    });

    const currentItems = getLocalItems(colName, currentUid);
    const filtered = currentItems.filter(i => i && i.id !== id && i._docId !== id && i._origId !== id);
    setLocalItems(colName, filtered, currentUid);
    notifyCollectionSubscribers(colName, filtered);
  } catch (e) {}
}

function removeLocalItemsBy(colName: string, predicate: (item: any) => boolean, uid?: string) {
  if (typeof window === "undefined") return;
  try {
    const eff = getEffectiveUidAndEmail();
    const currentUid = uid || eff.uid || "";
    const currentEmail = (eff.email || "").toLowerCase().trim();
    if (!currentUid && !currentEmail) return;

    const keys = [
      currentEmail ? `school_offline_cache_${currentEmail}_${colName}` : null,
      currentUid ? `school_offline_cache_${currentUid}_${colName}` : null
    ].filter(Boolean) as string[];

    keys.forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(i => !predicate(i));
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        } catch (_) {}
      }
    });

    const currentItems = getLocalItems(colName, currentUid);
    const filtered = currentItems.filter(i => !predicate(i));
    setLocalItems(colName, filtered, currentUid);
    notifyCollectionSubscribers(colName, filtered);
  } catch (e) {}
}

function generateLocalId(prefix: string = "id"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Multiplexed Collection Subscriptions Hub
interface CollectionHub {
  unsub: (() => void) | null;
  callbacks: Set<(items: any[]) => void>;
  latestData: any[];
  latestSerialized?: string;
  lastUpdated: number;
  cleanupTimer: any;
  ownerKey?: string;
}

const collectionHubs = new Map<string, CollectionHub>();

// Cross-tab and Cross-Window Real-time Broadcast Channel for instant (0ms) sync
let realTimeSyncChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  try {
    realTimeSyncChannel = new BroadcastChannel("school_realtime_instant_sync");
    realTimeSyncChannel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      const eff = getEffectiveUidAndEmail();
      const myEmail = (eff.email || "").toLowerCase().trim();
      const myUid = (eff.uid || "").trim();
      const mySchoolCode = getSchoolCode().toLowerCase().trim();
      const msgEmail = (data.ownerEmail || "").toLowerCase().trim();
      const msgUid = (data.ownerUid || "").trim();
      const msgSchoolCode = (data.schoolCode || "").toLowerCase().trim();

      const isMatch = (mySchoolCode && msgSchoolCode && mySchoolCode === msgSchoolCode) ||
                      (mySchoolCode && msgEmail && mySchoolCode === msgEmail) ||
                      (myEmail && msgSchoolCode && myEmail === msgSchoolCode) ||
                      (mySchoolCode && msgUid && mySchoolCode === msgUid) ||
                      (myUid && msgSchoolCode && myUid === msgSchoolCode) ||
                      (myEmail && msgEmail && myEmail === msgEmail) || 
                      (myUid && msgUid && myUid === msgUid) ||
                      (myEmail && msgUid && userProfileAliasCache.get(myEmail)?.uid === msgUid) ||
                      (myUid && msgEmail && userProfileAliasCache.get(myUid.toLowerCase())?.email === msgEmail) ||
                      (!myEmail && !myUid && (msgEmail || msgUid || msgSchoolCode));

      if (!isMatch) return;

      if (data.type === "school_name_updated") {
        const newName = (data.schoolName || "").trim();
        if (newName) {
          if (myEmail) localStorage.setItem(`school_name_${myEmail}`, newName);
          if (myUid) localStorage.setItem(`school_name_${myUid}`, newName);
          localStorage.setItem("school_name_cache", newName);
          localStorage.setItem("school_name_cached", newName);
          try {
            window.dispatchEvent(new CustomEvent("school_name_updated", { detail: newName }));
          } catch (_) {}
        }
        return;
      }

      if (data.type === "attendance_deleted") {
        if (Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach((delId: string) => {
            recordDeletedId(ATTENDANCE_COLL, delId);
            removeLocalItemsBy(ATTENDANCE_COLL, r => r.id === delId || r._docId === delId);
          });
        }
        return;
      }

      if (data.type === "attendance_entry_deleted") {
        if (data.recordId && data.studentId) {
          recordDeletedAttendanceEntry(data.recordId, data.studentId, data.isAbsentType);
          if (data.updatedRecord) {
            saveOrUpdateLocalItem(ATTENDANCE_COLL, data.updatedRecord);
          }
        }
        return;
      }

      if (data.type === "delay_deleted") {
        if (Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach((delId: string) => {
            recordDeletedId(MORNING_DELAYS_COLL, delId);
            removeLocalItemsBy(MORNING_DELAYS_COLL, d => d.id === delId || d._docId === delId);
          });
        }
        if (data.studentId && data.date) {
          recordDeletedMorningDelay(data.date, data.studentId);
          removeLocalItemsBy(MORNING_DELAYS_COLL, d => d.studentId === data.studentId && d.date === data.date);
        }
        return;
      }

      if (data.colName) {
        notifyCollectionSubscribers(data.colName, data.items, true);
      }
    };
  } catch (e) {}
}

// Storage event listener fallback (for iframes / cross-tab contexts when BroadcastChannel is unavailable)
if (typeof window !== "undefined") {
  let storageDebounceTimer: any = null;
  window.addEventListener("storage", (e) => {
    // If BroadcastChannel is actively working, ignore storage events to avoid redundant duplicate notifications
    if (realTimeSyncChannel) return;

    if (e.key && e.key.startsWith("school_offline_cache_")) {
      const parts = e.key.split("_");
      const colName = parts[parts.length - 1];
      if (colName) {
        const eff = getEffectiveUidAndEmail();
        const currentUid = eff.uid;
        const currentEmail = (eff.email || "").toLowerCase().trim();
        if (!currentUid && !currentEmail) return;

        const matchesUser = (currentEmail && e.key.includes(`_${currentEmail}_`)) || 
                            (currentUid && e.key.includes(`_${currentUid}_`));
        if (matchesUser) {
          clearTimeout(storageDebounceTimer);
          storageDebounceTimer = setTimeout(() => {
            notifyCollectionSubscribers(colName, undefined, true);
          }, 200);
        }
      }
    }
  });
}

// Real-time server synchronization helper (Express /api/sync)
export async function postToServerSync(endpoint: string, payload: any): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (_) {}
}

let serverSyncEngineInitialized = false;

export function initServerSyncEngine(): void {
  if (typeof window === "undefined" || serverSyncEngineInitialized) return;
  serverSyncEngineInitialized = true;

  const schoolCode = getSchoolCode();
  const eff = getEffectiveUidAndEmail();
  const queryParams = new URLSearchParams();
  if (schoolCode) queryParams.set("schoolCode", schoolCode);
  if (eff.email) queryParams.set("email", eff.email);
  if (eff.uid) queryParams.set("uid", eff.uid);

  // 1. Connect to SSE stream for 0ms instant broadcast from other devices
  try {
    const sseUrl = `/api/sync/stream?${queryParams.toString()}`;
    const evtSource = new EventSource(sseUrl);

    evtSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "purge_all") {
          const cols = [GRADES_COLL, CLASSES_COLL, TEACHERS_COLL, STUDENTS_COLL, ATTENDANCE_COLL, BEHAVIORS_COLL, MORNING_DELAYS_COLL, SETTINGS_COLL];
          cols.forEach(colName => {
            setLocalItems(colName, []);
            notifyCollectionSubscribers(colName, []);
          });
          collectionHubs.forEach(hub => {
            hub.latestData = [];
            hub.lastUpdated = Date.now();
            hub.callbacks.forEach(cb => { try { cb([]); } catch (_) {} });
          });
          try {
            window.dispatchEvent(new CustomEvent("school_refresh_stats"));
          } catch (_) {}
          return;
        }

        if (payload.type === "attendance_updated") {
          if (payload.data?.clearAll) {
            setLocalItems(ATTENDANCE_COLL, []);
            notifyCollectionSubscribers(ATTENDANCE_COLL, []);
          } else {
            if (Array.isArray(payload.data?.deletedIds)) {
              payload.data.deletedIds.forEach((delId: string) => {
                recordDeletedId(ATTENDANCE_COLL, delId);
                removeLocalItemsBy(ATTENDANCE_COLL, r => r.id === delId || r._docId === delId);
              });
            }
            const items = Array.isArray(payload.data?.records) 
              ? payload.data.records 
              : (Array.isArray(payload.data) ? payload.data : (payload.data ? [payload.data] : []));
            const sanitized = items
              .filter((item: any) => item && item.id && !isIdDeleted(ATTENDANCE_COLL, item.id))
              .map((item: any) => sanitizeAttendanceRecord(item));
            if (sanitized.length > 0) {
              bulkSaveOrUpdateLocalItems(ATTENDANCE_COLL, sanitized);
            }
          }
        } else if (payload.type === "behavior_updated") {
          if (payload.data?.clearAll) {
            setLocalItems(BEHAVIORS_COLL, []);
            notifyCollectionSubscribers(BEHAVIORS_COLL, []);
          } else {
            if (Array.isArray(payload.data?.deletedIds)) {
              payload.data.deletedIds.forEach((delId: string) => {
                recordDeletedId(BEHAVIORS_COLL, delId);
                removeLocalItemsBy(BEHAVIORS_COLL, b => b.id === delId || b._docId === delId);
              });
            }
            const items = Array.isArray(payload.data?.records)
              ? payload.data.records
              : (Array.isArray(payload.data) ? payload.data : (payload.data ? [payload.data] : []));
            const valid = items.filter((b: any) => b && b.id && !isIdDeleted(BEHAVIORS_COLL, b.id));
            if (valid.length > 0) {
              bulkSaveOrUpdateLocalItems(BEHAVIORS_COLL, valid);
            }
          }
        } else if (payload.type === "delay_updated") {
          if (payload.data?.clearAll) {
            setLocalItems(MORNING_DELAYS_COLL, []);
            notifyCollectionSubscribers(MORNING_DELAYS_COLL, []);
          } else {
            if (Array.isArray(payload.data?.deletedIds)) {
              payload.data.deletedIds.forEach((delId: string) => {
                recordDeletedId(MORNING_DELAYS_COLL, delId);
                removeLocalItemsBy(MORNING_DELAYS_COLL, d => d.id === delId || d._docId === delId);
              });
            }
            if (payload.data?.studentId && payload.data?.date) {
              recordDeletedMorningDelay(payload.data.date, payload.data.studentId);
              removeLocalItemsBy(MORNING_DELAYS_COLL, d => d.studentId === payload.data.studentId && d.date === payload.data.date);
            }
            const items = Array.isArray(payload.data?.records)
              ? payload.data.records
              : (Array.isArray(payload.data) ? payload.data : (payload.data ? [payload.data] : []));
            const valid = items.filter((d: any) => d && d.id && !isIdDeleted(MORNING_DELAYS_COLL, d.id) && !isMorningDelayDeleted(d.date, d.studentId));
            if (valid.length > 0) {
              bulkSaveOrUpdateLocalItems(MORNING_DELAYS_COLL, valid);
            }
          }
        } else if (payload.type === "school_updated") {
          if (payload.data?.cleared) {
            const currentEff = getEffectiveUidAndEmail();
            if (currentEff.email) localStorage.removeItem(`school_name_${currentEff.email}`);
            if (currentEff.uid) localStorage.removeItem(`school_name_${currentEff.uid}`);
            localStorage.removeItem("school_name_cache");
            localStorage.removeItem("school_name_cached");
            window.dispatchEvent(new CustomEvent("school_name_updated", { detail: "" }));
          } else {
            const newSchoolName = payload.data?.schoolName || (typeof payload.data === "string" ? payload.data : "");
            if (newSchoolName) {
              const currentEff = getEffectiveUidAndEmail();
              if (currentEff.email) localStorage.setItem(`school_name_${currentEff.email}`, newSchoolName);
              if (currentEff.uid) localStorage.setItem(`school_name_${currentEff.uid}`, newSchoolName);
              localStorage.setItem("school_name_cache", newSchoolName);
              localStorage.setItem("school_name_cached", newSchoolName);
              window.dispatchEvent(new CustomEvent("school_name_updated", { detail: newSchoolName }));
            }
          }
        } else if (payload.type === "grades_updated") {
          if (payload.data?.clearAll) {
            setLocalItems(GRADES_COLL, []);
            notifyCollectionSubscribers(GRADES_COLL, []);
          } else {
            if (Array.isArray(payload.data?.deletedIds)) {
              payload.data.deletedIds.forEach((delId: string) => {
                recordDeletedId(GRADES_COLL, delId);
                removeLocalItemsBy(GRADES_COLL, g => g.id === delId || g._docId === delId);
              });
            }
            if (Array.isArray(payload.data?.records)) {
              const valid = payload.data.records.filter((g: any) => g && g.id && !isIdDeleted(GRADES_COLL, g.id));
              bulkSaveOrUpdateLocalItems(GRADES_COLL, valid);
            }
          }
        } else if (payload.type === "classes_updated") {
          if (payload.data?.clearAll) {
            setLocalItems(CLASSES_COLL, []);
            notifyCollectionSubscribers(CLASSES_COLL, []);
          } else {
            if (Array.isArray(payload.data?.deletedIds)) {
              payload.data.deletedIds.forEach((delId: string) => {
                recordDeletedId(CLASSES_COLL, delId);
                removeLocalItemsBy(CLASSES_COLL, c => c.id === delId || c._docId === delId);
              });
            }
            if (Array.isArray(payload.data?.records)) {
              const valid = payload.data.records.filter((c: any) => c && c.id && !isIdDeleted(CLASSES_COLL, c.id));
              bulkSaveOrUpdateLocalItems(CLASSES_COLL, valid);
            }
          }
        } else if (payload.type === "teachers_updated") {
          if (payload.data?.clearAll) {
            setLocalItems(TEACHERS_COLL, []);
            notifyCollectionSubscribers(TEACHERS_COLL, []);
          } else {
            if (Array.isArray(payload.data?.deletedIds)) {
              payload.data.deletedIds.forEach((delId: string) => {
                recordDeletedId(TEACHERS_COLL, delId);
                removeLocalItemsBy(TEACHERS_COLL, t => t.id === delId || t._docId === delId);
              });
            }
            if (Array.isArray(payload.data?.records)) {
              const valid = payload.data.records.filter((t: any) => t && t.id && !isIdDeleted(TEACHERS_COLL, t.id));
              bulkSaveOrUpdateLocalItems(TEACHERS_COLL, valid);
            }
          }
        } else if (payload.type === "students_updated") {
          if (payload.data?.clearAll) {
            setLocalItems(STUDENTS_COLL, []);
            notifyCollectionSubscribers(STUDENTS_COLL, []);
          } else {
            if (Array.isArray(payload.data?.deletedIds)) {
              payload.data.deletedIds.forEach((delId: string) => {
                recordDeletedId(STUDENTS_COLL, delId);
                removeLocalItemsBy(STUDENTS_COLL, s => s.id === delId || s._docId === delId);
              });
            }
            if (Array.isArray(payload.data?.records)) {
              const valid = payload.data.records.filter((s: any) => s && s.id && !isIdDeleted(STUDENTS_COLL, s.id));
              bulkSaveOrUpdateLocalItems(STUDENTS_COLL, valid);
            }
          }
        } else if (payload.type === "bootstrap_updated") {
          pollServer();
        }
      } catch (_) {}
    };

    evtSource.onerror = () => {
      evtSource.close();
    };
  } catch (_) {}

  // 2. Periodic unified polling sync fallback to guarantee cross-device updates without main thread freezing
  const pollServer = async () => {
    try {
      const code = getSchoolCode();
      const currentEff = getEffectiveUidAndEmail();
      const q = new URLSearchParams();
      if (code) q.set("schoolCode", code);
      if (currentEff.email && !currentEff.isGuest && !currentEff.email.includes("@school.local")) q.set("email", currentEff.email);
      if (currentEff.uid && !currentEff.isGuest && !currentEff.uid.startsWith("guest")) q.set("uid", currentEff.uid);

      const res = await fetch(`/api/sync/all?${q.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          if (json.schoolCode && typeof window !== "undefined") {
            localStorage.setItem("registered_school_code", json.schoolCode);
            if (!code) setSchoolCode(json.schoolCode);
          }

          // School Name Sync
          if (json.schoolName) {
            const curName = localStorage.getItem("school_name_cache");
            if (curName !== json.schoolName) {
              if (currentEff.email) localStorage.setItem(`school_name_${currentEff.email}`, json.schoolName);
              if (currentEff.uid) localStorage.setItem(`school_name_${currentEff.uid}`, json.schoolName);
              localStorage.setItem("school_name_cache", json.schoolName);
              localStorage.setItem("school_name_cached", json.schoolName);
              window.dispatchEvent(new CustomEvent("school_name_updated", { detail: json.schoolName }));
            }
          }

          // Grades Sync (Bulk diff check)
          if (Array.isArray(json.grades)) {
            const filtered = json.grades.filter((g: any) => g && g.id && !isIdDeleted("grades", g.id));
            const cur = getLocalItems(GRADES_COLL, currentEff.uid);
            if (JSON.stringify(cur) !== JSON.stringify(filtered)) {
              setLocalItems(GRADES_COLL, filtered, currentEff.uid);
              notifyCollectionSubscribers(GRADES_COLL, filtered);
            }
          }

          // Classes Sync (Bulk diff check)
          if (Array.isArray(json.classes)) {
            const filtered = json.classes.filter((c: any) => c && c.id && !isIdDeleted("classes", c.id));
            const cur = getLocalItems(CLASSES_COLL, currentEff.uid);
            if (JSON.stringify(cur) !== JSON.stringify(filtered)) {
              setLocalItems(CLASSES_COLL, filtered, currentEff.uid);
              notifyCollectionSubscribers(CLASSES_COLL, filtered);
            }
          }

          // Teachers Sync (Bulk diff check)
          if (Array.isArray(json.teachers)) {
            const filtered = json.teachers.filter((t: any) => t && t.id && !isIdDeleted("teachers", t.id));
            const cur = getLocalItems(TEACHERS_COLL, currentEff.uid);
            if (JSON.stringify(cur) !== JSON.stringify(filtered)) {
              setLocalItems(TEACHERS_COLL, filtered, currentEff.uid);
              notifyCollectionSubscribers(TEACHERS_COLL, filtered);
            }
          }

          // Students Sync (Bulk diff check)
          if (Array.isArray(json.students)) {
            const filtered = json.students.filter((s: any) => s && s.id && !isIdDeleted("students", s.id));
            const cur = getLocalItems(STUDENTS_COLL, currentEff.uid);
            if (JSON.stringify(cur) !== JSON.stringify(filtered)) {
              setLocalItems(STUDENTS_COLL, filtered, currentEff.uid);
              notifyCollectionSubscribers(STUDENTS_COLL, filtered);
            }
          }

          // Attendance Sync (Bulk diff check with tombstones and absent/late sanitization)
          if (Array.isArray(json.attendance)) {
            const sanitized = json.attendance
              .filter((a: any) => a && a.id && !isIdDeleted("attendance", a.id))
              .map((a: any) => sanitizeAttendanceRecord(a));
            const cur = getLocalItems(ATTENDANCE_COLL, currentEff.uid);
            if (JSON.stringify(cur) !== JSON.stringify(sanitized)) {
              setLocalItems(ATTENDANCE_COLL, sanitized, currentEff.uid);
              notifyCollectionSubscribers(ATTENDANCE_COLL, sanitized);
            }
          }

          // Delays Sync (Bulk diff check with tombstones)
          if (Array.isArray(json.delays)) {
            const validDelays = json.delays.filter((d: any) =>
              d && d.id && !isIdDeleted("morning_delays", d.id) && !isMorningDelayDeleted(d.date, d.studentId)
            );
            const cur = getLocalItems(MORNING_DELAYS_COLL, currentEff.uid);
            if (JSON.stringify(cur) !== JSON.stringify(validDelays)) {
              setLocalItems(MORNING_DELAYS_COLL, validDelays, currentEff.uid);
              notifyCollectionSubscribers(MORNING_DELAYS_COLL, validDelays);
            }
          }

          // Behaviors Sync (Bulk diff check)
          if (Array.isArray(json.behaviors)) {
            const validBehaviors = json.behaviors.filter((b: any) => b && b.id && !isIdDeleted("behaviors", b.id));
            const cur = getLocalItems(BEHAVIORS_COLL, currentEff.uid);
            if (JSON.stringify(cur) !== JSON.stringify(validBehaviors)) {
              setLocalItems(BEHAVIORS_COLL, validBehaviors, currentEff.uid);
              notifyCollectionSubscribers(BEHAVIORS_COLL, validBehaviors);
            }
          }
        }
      }
    } catch (_) {}
  };

  pollServer();
  setInterval(pollServer, 25000);
  if (typeof window !== "undefined") {
    window.addEventListener("focus", () => pollServer());
  }
}

// Ensure registered school data is immediately available on startup or guest mode
export async function ensureRegisteredSchoolLoaded(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const code = getSchoolCode();
    const currentEff = getEffectiveUidAndEmail();
    const q = new URLSearchParams();
    if (code) q.set("schoolCode", code);
    if (currentEff.email && !currentEff.isGuest && !currentEff.email.includes("@school.local")) q.set("email", currentEff.email);
    if (currentEff.uid && !currentEff.isGuest && !currentEff.uid.startsWith("guest")) q.set("uid", currentEff.uid);

    const res = await fetch(`/api/sync/all?${q.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        if (json.schoolCode) {
          localStorage.setItem("registered_school_code", json.schoolCode);
          if (!code) setSchoolCode(json.schoolCode);
        }
        if (json.schoolName) {
          localStorage.setItem("school_name_cache", json.schoolName);
          localStorage.setItem("school_name_cached", json.schoolName);
          window.dispatchEvent(new CustomEvent("school_name_updated", { detail: json.schoolName }));
        }
        if (Array.isArray(json.grades)) {
          const filtered = json.grades.filter((g: any) => g && g.id && !isIdDeleted("grades", g.id));
          if (filtered.length > 0) {
            setLocalItems(GRADES_COLL, filtered, currentEff.uid);
            notifyCollectionSubscribers(GRADES_COLL, filtered);
          }
        }
        if (Array.isArray(json.classes)) {
          const filtered = json.classes.filter((c: any) => c && c.id && !isIdDeleted("classes", c.id));
          if (filtered.length > 0) {
            setLocalItems(CLASSES_COLL, filtered, currentEff.uid);
            notifyCollectionSubscribers(CLASSES_COLL, filtered);
          }
        }
        if (Array.isArray(json.teachers)) {
          const filtered = json.teachers.filter((t: any) => t && t.id && !isIdDeleted("teachers", t.id));
          if (filtered.length > 0) {
            setLocalItems(TEACHERS_COLL, filtered, currentEff.uid);
            notifyCollectionSubscribers(TEACHERS_COLL, filtered);
          }
        }
        if (Array.isArray(json.students)) {
          const filtered = json.students.filter((s: any) => s && s.id && !isIdDeleted("students", s.id));
          if (filtered.length > 0) {
            setLocalItems(STUDENTS_COLL, filtered, currentEff.uid);
            notifyCollectionSubscribers(STUDENTS_COLL, filtered);
          }
        }
        if (Array.isArray(json.attendance)) {
          const sanitized = json.attendance
            .filter((a: any) => a && a.id && !isIdDeleted(ATTENDANCE_COLL, a.id))
            .map((a: any) => sanitizeAttendanceRecord(a));
          setLocalItems(ATTENDANCE_COLL, sanitized, currentEff.uid);
          notifyCollectionSubscribers(ATTENDANCE_COLL, sanitized);
        }
        if (Array.isArray(json.delays)) {
          const validDelays = json.delays.filter((d: any) =>
            d && d.id && !isIdDeleted(MORNING_DELAYS_COLL, d.id) && !isMorningDelayDeleted(d.date, d.studentId)
          );
          setLocalItems(MORNING_DELAYS_COLL, validDelays, currentEff.uid);
          notifyCollectionSubscribers(MORNING_DELAYS_COLL, validDelays);
        }
        if (Array.isArray(json.behaviors)) {
          const validBehaviors = json.behaviors.filter((b: any) => b && b.id && !isIdDeleted(BEHAVIORS_COLL, b.id));
          setLocalItems(BEHAVIORS_COLL, validBehaviors, currentEff.uid);
          notifyCollectionSubscribers(BEHAVIORS_COLL, validBehaviors);
        }
      }
    }
  } catch (_) {}
}

// Bootstrap entire school state to server sync store
export async function bootstrapSchoolToServer(
  schoolName: string,
  grades: any[],
  classes: any[],
  teachers: any[],
  students: any[],
  clearFirst: boolean = false
): Promise<void> {
  if (typeof window === "undefined") return;
  const schoolCode = getSchoolCode();
  const eff = getEffectiveUidAndEmail();
  const cleanCode = schoolCode || eff.email || eff.uid || "";
  if (!cleanCode) return;

  try {
    await fetch("/api/sync/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolCode: cleanCode,
        schoolName,
        userEmail: eff.email,
        userId: eff.uid,
        grades,
        classes,
        teachers,
        students,
        clearFirst
      })
    });
  } catch (_) {}
}

function getCollectionHub(colName: string): CollectionHub {
  let hub = collectionHubs.get(colName);
  if (!hub) {
    hub = {
      unsub: null,
      callbacks: new Set(),
      latestData: [],
      lastUpdated: 0,
      cleanupTimer: null
    };
    collectionHubs.set(colName, hub);
  }
  return hub;
}

function notifyCollectionSubscribers(colName: string, items?: any[], fromBroadcast: boolean = false) {
  const hub = collectionHubs.get(colName);
  const eff = getEffectiveUidAndEmail();
  const currentUid = eff.uid;
  const currentEmail = (eff.email || "").toLowerCase().trim();
  
  const rawList = Array.isArray(items) ? items : getLocalItems(colName, currentUid);
  const safeList = Array.isArray(rawList) ? rawList : [];
  const dataToBroadcast = safeList
    .filter(item => isDocBelongingToUser(item, currentUid, currentEmail) && !isRecordTombstoned(colName, item))
    .map(item => colName === ATTENDANCE_COLL ? sanitizeAttendanceRecord(item) : item);
  
  // If items were received (e.g. from local save or broadcast), update local storage cache immediately
  if (Array.isArray(items) && (currentUid || currentEmail)) {
    setLocalItems(colName, dataToBroadcast, currentUid);
  }

  if (hub) {
    const serialized = JSON.stringify(dataToBroadcast);
    // If the data is strictly identical and we have already notified, don't re-trigger callbacks
    if (hub.latestSerialized === serialized && hub.callbacks.size > 0 && hub.lastUpdated > 0) {
      return;
    }
    hub.latestSerialized = serialized;
    hub.latestData = dataToBroadcast;
    hub.lastUpdated = Date.now();
    hub.callbacks.forEach(cb => {
      try { cb(dataToBroadcast); } catch (_) {}
    });
  }

  // Broadcast to other tabs/windows in real time (0ms)
  if (!fromBroadcast && realTimeSyncChannel) {
    try {
      realTimeSyncChannel.postMessage({
        colName,
        items: dataToBroadcast,
        ownerEmail: currentEmail,
        ownerUid: currentUid,
        schoolCode: getSchoolCode(),
        timestamp: Date.now()
      });
    } catch (_) {}
  }
}

// Helper to check if a document belongs to a specific user/school
export function isDocBelongingToUser(data: any, currentUid?: string, currentEmail?: string): boolean {
  if (!data) return false;

  const eff = getEffectiveUidAndEmail();
  const targetEmail = (currentEmail || eff.email || "").toLowerCase().trim();
  const targetUid = (currentUid || eff.uid || "").trim();
  const targetSchoolCode = getSchoolCode().trim();

  const isGuest = Boolean(
    eff.isGuest ||
    targetUid === "guest_school_admin" ||
    targetUid.startsWith("guest") ||
    targetEmail.endsWith("@school.local") ||
    targetEmail.endsWith("@school.com")
  );

  const docEmail = (data.userEmail || data.email || data.schoolEmail || data.ownerEmail || "").toLowerCase().trim();
  const docUid = (data.userId || data.uid || data.ownerId || data.owner || "").trim();
  const docSchoolCode = (data.schoolCode || data.school_code || "").trim();

  // If the user is unauthenticated or in guest view mode:
  // They should view the registered school's data!
  if (isGuest) {
    if (targetSchoolCode) {
      const normTarget = targetSchoolCode.toLowerCase();
      if (docSchoolCode && docSchoolCode.toLowerCase() === normTarget) return true;
      if (docEmail && docEmail === normTarget) return true;
      if (docUid && docUid.toLowerCase() === normTarget) return true;
      if (!docSchoolCode && !docEmail) return true;
    } else {
      // If no specific school code specified yet, allow viewing the registered school data
      if (docSchoolCode && typeof window !== "undefined") {
        try {
          localStorage.setItem("school_unique_code", docSchoolCode);
          localStorage.setItem("registered_school_code", docSchoolCode);
        } catch (_) {}
      }
      return true;
    }
  }

  // If no user context exists, no private user document should be accessible
  if (!targetEmail && !targetUid && !targetSchoolCode) return false;

  // 0. Primary Match on School Code (direct cross-device & independent link synchronization)
  if (targetSchoolCode) {
    const normTarget = targetSchoolCode.toLowerCase();
    if (docSchoolCode && docSchoolCode.toLowerCase() === normTarget) return true;
    if (docEmail && docEmail === normTarget) return true;
    if (docUid && docUid.toLowerCase() === normTarget) return true;
  }
  if (docSchoolCode) {
    const normDoc = docSchoolCode.toLowerCase();
    if (targetEmail && targetEmail === normDoc) return true;
    if (targetUid && targetUid.toLowerCase() === normDoc) return true;
  }

  // 1. Direct match on Email
  if (targetEmail && docEmail && targetEmail === docEmail) {
    if (docUid && docUid !== "school_admin") {
      userProfileAliasCache.set(docUid.toLowerCase(), { uid: docUid, email: targetEmail });
      userProfileAliasCache.set(targetEmail, { uid: docUid, email: targetEmail });
    }
    return true;
  }

  // 2. Direct match on UID
  if (targetUid && docUid && targetUid === docUid && (targetUid === "school_admin" || docUid !== "school_admin")) {
    if (docEmail) {
      userProfileAliasCache.set(targetUid.toLowerCase(), { uid: targetUid, email: docEmail });
      userProfileAliasCache.set(docEmail, { uid: targetUid, email: docEmail });
    }
    return true;
  }

  // 3. Alias match via cached profile linkage
  if (targetEmail && docUid && docUid !== "school_admin") {
    const alias = userProfileAliasCache.get(targetEmail);
    if (alias && alias.uid && alias.uid === docUid) return true;
    const revAlias = userProfileAliasCache.get(docUid.toLowerCase());
    if (revAlias && revAlias.email && revAlias.email.toLowerCase() === targetEmail) return true;
  }

  if (targetUid && docEmail) {
    const alias = userProfileAliasCache.get(targetUid.toLowerCase());
    if (alias && alias.email && alias.email.toLowerCase() === docEmail) return true;
    const revAlias = userProfileAliasCache.get(docEmail);
    if (revAlias && revAlias.uid && revAlias.uid === targetUid) return true;
  }

  // Check stored admin ID linkage from localStorage
  if (typeof window !== "undefined") {
    try {
      const localOwnAdminId = localStorage.getItem("own_school_admin_id") || "";
      if (localOwnAdminId && docUid && docUid === localOwnAdminId) {
        return true;
      }
      const localOwnEmail = (localStorage.getItem("own_school_admin_email") || "").toLowerCase().trim();
      if (localOwnEmail && docEmail && docEmail === localOwnEmail) {
        return true;
      }
    } catch (_) {}
  }

  // 4. Match by tenant prefix encoded inside document ID (e.g. att_majedsoft_gmail_com_... or delay_majedsoft_gmail_com_...)
  const docId = (data.id || data._docId || "").toString();
  if (targetEmail && docId) {
    const safePrefix = targetEmail.replace(/[^a-zA-Z0-9]/g, '_');
    if (docId.includes(`_${safePrefix}_`) || docId.startsWith(`att_${safePrefix}`) || docId.startsWith(`delay_${safePrefix}`)) {
      return true;
    }
  }
  if (targetUid && docId && targetUid !== "school_admin") {
    if (docId.includes(`_${targetUid}_`) || docId.startsWith(`att_${targetUid}`) || docId.startsWith(`delay_${targetUid}`)) {
      return true;
    }
  }
  if (targetSchoolCode && docId) {
    const safeCode = targetSchoolCode.replace(/[^a-zA-Z0-9]/g, '_');
    if (docId.includes(`_${safeCode}_`) || docId.startsWith(`att_${safeCode}`) || docId.startsWith(`delay_${safeCode}`)) {
      return true;
    }
  }

  // 5. Fallback for locally created items without explicit user tags within same local context
  if (!docEmail && (!docUid || docUid === "school_admin") && !targetEmail && targetUid === "school_admin") {
    return true;
  }

  return false;
}

/**
 * Resets all in-memory collection hubs, unsubscribes active Firestore listeners,
 * and clears transient caches to prevent cross-account data leaks upon logout or account switch.
 */
export function clearUserSessionState(): void {
  collectionHubs.forEach((hub) => {
    if (hub.unsub) {
      try { hub.unsub(); } catch (_) {}
      hub.unsub = null;
    }
    if (hub.cleanupTimer) {
      clearTimeout(hub.cleanupTimer);
      hub.cleanupTimer = null;
    }
    hub.callbacks.clear();
    hub.latestData = [];
    hub.lastUpdated = 0;
  });
  collectionHubs.clear();
  userProfileAliasCache.clear();
  activeUserProxy = null;

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("school_name_cache");
      localStorage.removeItem("school_name_cached");
      localStorage.removeItem("last_active_school_owner");
      localStorage.removeItem("own_school_admin_id");
      localStorage.removeItem("own_school_admin_email");
      localStorage.removeItem("linked_school_owner_id");
      localStorage.removeItem("linked_school_owner_email");
    } catch (_) {}
  }
}

/**
 * Resolves the school owner profile from Firestore by UID or Email
 */
export async function resolveOwnerProfileFromDb(ownerIdOrEmail: string): Promise<{ uid: string; email: string; schoolName?: string } | null> {
  if (!ownerIdOrEmail) return null;
  const key = ownerIdOrEmail.trim().toLowerCase();
  
  if (userProfileAliasCache.has(key)) {
    return userProfileAliasCache.get(key)!;
  }

  if (isQuotaExhausted()) {
    return null;
  }

  try {
    // 1. Try querying registered_users by uid
    const qUid = query(collection(db, USERS_COLL), where("uid", "==", ownerIdOrEmail));
    const snapUid = await getDocs(qUid);
    if (!snapUid.empty) {
      const data = snapUid.docs[0].data();
      const profile = {
        uid: data.uid || ownerIdOrEmail,
        email: data.email?.toLowerCase() || "",
        schoolName: data.schoolName || ""
      };
      if (profile.uid) {
        userProfileAliasCache.set(profile.uid.toLowerCase(), profile);
        try { localStorage.setItem(`user_alias_${profile.uid.toLowerCase()}`, JSON.stringify(profile)); } catch (e) {}
      }
      if (profile.email) {
        userProfileAliasCache.set(profile.email.toLowerCase(), profile);
        try { localStorage.setItem(`user_alias_${profile.email.toLowerCase()}`, JSON.stringify(profile)); } catch (e) {}
      }
      return profile;
    }

    // 2. Try querying registered_users by email
    if (ownerIdOrEmail.includes("@")) {
      const qEmail = query(collection(db, USERS_COLL), where("email", "==", key));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        const data = snapEmail.docs[0].data();
        const profile = {
          uid: data.uid || "",
          email: data.email?.toLowerCase() || key,
          schoolName: data.schoolName || ""
        };
        if (profile.uid) {
          userProfileAliasCache.set(profile.uid.toLowerCase(), profile);
          try { localStorage.setItem(`user_alias_${profile.uid.toLowerCase()}`, JSON.stringify(profile)); } catch (e) {}
        }
        if (profile.email) {
          userProfileAliasCache.set(profile.email.toLowerCase(), profile);
          try { localStorage.setItem(`user_alias_${profile.email.toLowerCase()}`, JSON.stringify(profile)); } catch (e) {}
        }
        return profile;
      }
    }

    // 3. Try checking settings document (e.g., settings_QgOSyBcP28MzmbJT92aH8vdgAG33)
    const settingsDoc = await getDoc(doc(db, SETTINGS_COLL, `settings_${ownerIdOrEmail}`));
    if (settingsDoc.exists()) {
      const sData = settingsDoc.data();
      const profile = {
        uid: sData.userId || ownerIdOrEmail,
        email: sData.userEmail?.toLowerCase() || "",
        schoolName: sData.schoolName || ""
      };
      if (profile.uid) {
        userProfileAliasCache.set(profile.uid.toLowerCase(), profile);
        try { localStorage.setItem(`user_alias_${profile.uid.toLowerCase()}`, JSON.stringify(profile)); } catch (e) {}
      }
      if (profile.email) {
        userProfileAliasCache.set(profile.email.toLowerCase(), profile);
        try { localStorage.setItem(`user_alias_${profile.email.toLowerCase()}`, JSON.stringify(profile)); } catch (e) {}
      }
      return profile;
    }
  } catch (e: any) {
    handleFirestoreError(e);
  }

  return null;
}

// Migrate guest records in Firestore to an authenticated user upon Google login
export async function migrateGuestDataToUser(guestUid: string, userUid: string, userEmail: string): Promise<void> {
  if (!guestUid || !userUid || guestUid === userUid) return;
  
  const collections = [
    GRADES_COLL,
    CLASSES_COLL,
    TEACHERS_COLL,
    STUDENTS_COLL,
    ATTENDANCE_COLL,
    BEHAVIORS_COLL,
    MORNING_DELAYS_COLL,
    SETTINGS_COLL
  ];

  try {
    for (const colName of collections) {
      const q = query(collection(db, colName), where("userId", "==", guestUid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach(d => {
          batch.set(doc(db, colName, d.id), {
            userId: userUid,
            userEmail: userEmail,
            updatedAt: Date.now()
          }, { merge: true });
        });
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn("Notice during guest data migration:", err);
  }
}

// Switch Database ID and reload app safely
export function switchDatabaseIdAndReload(newId: string): void {
  setActiveFirestoreDatabaseId(newId);
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

export interface CloudDiagnosticDetails {
  ok: boolean;
  activeDbId: string;
  defaultDbResult: { ok: boolean; code?: string; message: string };
  projectNamedDbResult?: { ok: boolean; code?: string; message: string };
  customDbResult?: { ok: boolean; code?: string; message: string };
  suggestedDbId?: string;
  isRulesIssue?: boolean;
  isNotFoundIssue?: boolean;
  message: string;
}

// Run deep, intelligent multi-database diagnostics
export async function runComprehensiveCloudDiagnostics(customIdToTest?: string): Promise<CloudDiagnosticDetails> {
  const activeId = getActiveFirestoreDatabaseId();
  
  // Test helper against specific database instance
  const testSpecificDb = async (dbId: string) => {
    try {
      const testDbInstance = getDbForDatabaseId(dbId);
      const testDoc = doc(testDbInstance, SETTINGS_COLL, "_ping_test");
      await setDoc(testDoc, { ping: Date.now(), databaseId: dbId }, { merge: true });
      return { ok: true, message: "تم الاتصال والكتابة بنجاح!" };
    } catch (err: any) {
      const msg = err?.message || String(err);
      const code = err?.code || "";
      return { ok: false, code, message: msg };
    }
  };

  // 1. Test "(default)"
  const defaultRes = await testSpecificDb("(default)");

  // 2. Test project-named database "apsent-02"
  const projectNamedRes = await testSpecificDb("apsent-02");

  // 3. Test customId if provided and not equal to (default) or apsent-02
  let customRes: { ok: boolean; code?: string; message: string } | undefined;
  if (customIdToTest && customIdToTest !== "(default)" && customIdToTest !== "apsent-02" && customIdToTest !== "apsents1") {
    customRes = await testSpecificDb(customIdToTest);
  }

  let ok = false;
  let suggestedDbId: string | undefined;
  let isRulesIssue = false;
  let isNotFoundIssue = false;
  let summaryMessage = "";

  // Analyze active database result
  const activeRes = activeId === "apsent-02" || activeId === "apsents1"
    ? projectNamedRes 
    : (customRes && activeId === customIdToTest ? customRes : defaultRes);

  if (activeRes.ok) {
    ok = true;
    summaryMessage = `الاتصال بقاعدة البيانات النشطة (${activeId}) يعمل بنجاح 100%!`;
  } else {
    // Check if another database succeeded
    if (projectNamedRes.ok && activeId !== "apsent-02") {
      suggestedDbId = "apsent-02";
      summaryMessage = `تم العثور على قاعدة بيانات باسم المشروع (apsent-02) وهي تعمل بنجاح! يمكنك تفعيلها بنقرة واحدة.`;
    } else if (defaultRes.ok && activeId !== "(default)") {
      suggestedDbId = "(default)";
      summaryMessage = `قاعدة البيانات الافتراضية (default) تعمل بنجاح! يمكنك تفعيلها بنقرة واحدة.`;
    } else if (customRes && customRes.ok) {
      suggestedDbId = customIdToTest;
      summaryMessage = `قاعدة البيانات المخصصة (${customIdToTest}) تعمل بنجاح!`;
    } else {
      // Both failed, identify exact cause
      const errStr = ((activeRes.message || "") + " " + (activeRes.code || "")).toLowerCase();
      if (errStr.includes("permission-denied") || activeRes.code === "permission-denied") {
        isRulesIssue = true;
        summaryMessage = `قاعدة البيانات موجودة، ولكن المشكلة في «قواعد الأمان» (Rules) حيث تم حظر القراءة والكتابة.\nالحل: فتح تبويب Rules في Firebase واستبدال القواعد للسماح بالوصول (allow read, write: if true;).`;
      } else if (errStr.includes("does not exist") || errStr.includes("not_found") || activeRes.code === "not-found") {
        isNotFoundIssue = true;
        summaryMessage = `قاعدة بيانات Cloud Firestore غير منشأة بعد في حساب Firebase بالاسم (${activeId}).\nالحل: فتح Firebase Console ثم الضغط على Create Database بالوضع الأصلي Native Mode.`;
      } else {
        summaryMessage = `تنبيه الاتصال السحابي: ${activeRes.message || activeRes.code}`;
      }
    }
  }

  return {
    ok,
    activeDbId: activeId,
    defaultDbResult: defaultRes,
    projectNamedDbResult: projectNamedRes,
    customDbResult: customRes,
    suggestedDbId,
    isRulesIssue,
    isNotFoundIssue,
    message: summaryMessage
  };
}

// Test real-time Cloud Firestore connectivity and report precise diagnostic status
export async function testCloudFirestoreConnection(): Promise<{ ok: boolean; message: string; code?: string; details?: CloudDiagnosticDetails }> {
  try {
    const diag = await runComprehensiveCloudDiagnostics();
    return {
      ok: diag.ok,
      message: diag.message,
      code: diag.isRulesIssue ? "PERMISSION_DENIED" : (diag.isNotFoundIssue ? "DATABASE_NOT_FOUND" : undefined),
      details: diag
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    const code = err?.code || "";
    return {
      ok: false,
      code,
      message: `تنبيه الاتصال السحابي: ${msg}`
    };
  }
}

// Helper to fully synchronize all local cached records to Firestore with strict diagnostic feedback
export async function syncAllLocalDataToFirestore(): Promise<{ count: number; success: boolean; message: string; code?: string }> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = eff.email;
  if (!uid && !email) {
    return { count: 0, success: false, message: "يجب تسجيل الدخول أولاً لتتم المزامنة السحابية." };
  }

  // First verify if the Cloud Firestore database actually exists to prevent misleading success messages
  try {
    const pingDoc = doc(db, SETTINGS_COLL, "_sync_connectivity_check");
    await setDoc(pingDoc, { ping: Date.now(), uid, email }, { merge: true });
  } catch (connErr: any) {
    const msg = connErr?.message || String(connErr);
    const code = connErr?.code || "";
    if (msg.includes("does not exist") || msg.includes("NOT_FOUND") || code === "not-found") {
      const currentId = getActiveFirestoreDatabaseId();
      const altId = currentId === "apsent-02" ? "(default)" : "apsent-02";
      try {
        const altDb = getDbForDatabaseId(altId);
        const altPing = doc(altDb, SETTINGS_COLL, "_sync_connectivity_check");
        await setDoc(altPing, { ping: Date.now(), uid, email }, { merge: true });
        updateActiveDb(altId);
        console.info(`Auto-detected and switched active Firestore database to: ${altId}`);
      } catch (altErr) {
        return {
          count: 0,
          success: false,
          code: "DATABASE_NOT_FOUND",
          message: "قاعدة بيانات Cloud Firestore لم يتم إنشاؤها بعد في مشروع Firebase (apsent-02). يرجى فتح Firebase Console ثم اختيار Firestore Database والضغط على زر Create Database."
        };
      }
    } else if (code === "permission-denied" || msg.includes("permission-denied")) {
      return {
        count: 0,
        success: false,
        code: "PERMISSION_DENIED",
        message: "تم رفض الإذن (Permission Denied) في Firestore. تأكد من نشر قواعد firestore.rules بالسماح بالقراءة والكتابة."
      };
    }
    return {
      count: 0,
      success: false,
      code,
      message: `خطأ أثناء الاتصال بقاعدة البيانات السحابية: ${msg}`
    };
  }

  const collections = [
    GRADES_COLL,
    CLASSES_COLL,
    TEACHERS_COLL,
    STUDENTS_COLL,
    ATTENDANCE_COLL,
    BEHAVIORS_COLL,
    MORNING_DELAYS_COLL
  ];

  let totalSynced = 0;
  let hasWriteError = false;
  let lastErrorMessage = "";

  const schoolCode = getSchoolCode();

  try {
    for (const colName of collections) {
      const rawSources = [
        getLocalItems(colName, uid),
        getLocalItems(colName, email),
        getLocalItems(colName, ""),
        collectionHubs.get(colName)?.latestData || []
      ];
      const itemMap = new Map<string, any>();
      rawSources.forEach(src => {
        if (Array.isArray(src)) {
          src.forEach(item => {
            if (item && item.id && !itemMap.has(item.id)) {
              itemMap.set(item.id, item);
            }
          });
        }
      });

      let items = Array.from(itemMap.values());

      // If empty for core collections, fallback to existing async getters
      if (items.length === 0) {
        if (colName === GRADES_COLL) {
          const g = await getGrades();
          if (Array.isArray(g)) items = g;
        } else if (colName === CLASSES_COLL) {
          const c = await getClasses();
          if (Array.isArray(c)) items = c;
        } else if (colName === TEACHERS_COLL) {
          const t = await getTeachers();
          if (Array.isArray(t)) items = t;
        } else if (colName === STUDENTS_COLL) {
          const s = await getStudents();
          if (Array.isArray(s)) items = s;
        }
      }

      if (!Array.isArray(items) || items.length === 0) continue;
      
      const normalizedItems: any[] = [];
      const seenIds = new Set<string>();

      items.forEach(item => {
        if (!item || !item.id || seenIds.has(item.id)) return;
        seenIds.add(item.id);
        const itemBelongs = isDocBelongingToUser(item, uid, email);

        if (itemBelongs) {
          normalizedItems.push({
            ...item,
            userId: item.userId || uid,
            userEmail: item.userEmail || email,
            schoolCode: item.schoolCode || schoolCode,
            updatedAt: Date.now()
          });
        }
      });

      if (normalizedItems.length === 0) continue;

      // Update local storage with properly claimed records
      setLocalItems(colName, normalizedItems, uid);
      if (email) setLocalItems(colName, normalizedItems, email);

      const chunkSize = 350;
      for (let i = 0; i < normalizedItems.length; i += chunkSize) {
        const chunk = normalizedItems.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(item => {
          const docRef = doc(db, colName, item.id);
          batch.set(docRef, item, { merge: true });
        });
        try {
          await batch.commit();
          totalSynced += chunk.length;
        } catch (commitErr: any) {
          hasWriteError = true;
          lastErrorMessage = commitErr?.message || String(commitErr);
          console.warn(`Firestore batch commit issue for ${colName}:`, commitErr);
        }
      }
    }

    const storedName = typeof window !== "undefined" 
      ? (localStorage.getItem(`school_name_${uid}`) || (email ? localStorage.getItem(`school_name_${email}`) : null) || localStorage.getItem("school_name_cached") || localStorage.getItem("school_name_cache")) 
      : null;
    if (storedName) {
      await saveSchoolName(storedName);
    }

    if (hasWriteError && totalSynced === 0) {
      return {
        count: 0,
        success: false,
        message: `تعذر حفظ البيانات في السحابة: ${lastErrorMessage}`
      };
    }

    return { count: totalSynced, success: true, message: `تمت المزامنة بنجاح وحفظ ${totalSynced} سجلاً في السحابة.` };
  } catch (err: any) {
    console.error("Error syncing all local data to Firestore:", err);
    return { count: totalSynced, success: false, message: err?.message || "حدث خطأ أثناء المزامنة." };
  }
}

/**
 * Exports all current school data into a single JSON object for immediate backup or transfer
 */
export function exportSchoolBackupData(): any {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = eff.email;

  const schoolName = (typeof window !== "undefined" 
    ? (localStorage.getItem(`school_name_${uid}`) || (email ? localStorage.getItem(`school_name_${email}`) : null) || localStorage.getItem("school_name_cached") || localStorage.getItem("school_name_cache"))
    : "") || "المدرسة";

  const backup = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    schoolName,
    grades: getLocalItems(GRADES_COLL, uid),
    classes: getLocalItems(CLASSES_COLL, uid),
    teachers: getLocalItems(TEACHERS_COLL, uid),
    students: getLocalItems(STUDENTS_COLL, uid),
    attendance: getLocalItems(ATTENDANCE_COLL, uid),
    behaviors: getLocalItems(BEHAVIORS_COLL, uid),
    morningDelays: getLocalItems(MORNING_DELAYS_COLL, uid)
  };

  return backup;
}

/**
 * Triggers browser download of full school JSON backup file
 */
export function downloadSchoolBackupFile(): void {
  try {
    const backup = exportSchoolBackupData();
    const cleanSchoolName = (backup.schoolName || "School").replace(/[\/\\:*?"<>|]/g, "_").trim();
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `نسخة_مدرسية_${cleanSchoolName}_${dateStr}.json`;

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Error downloading backup file:", err);
  }
}

/**
 * Imports full school backup JSON data, restoring local state and syncing to Firestore
 */
export async function importSchoolBackupData(backupData: any): Promise<{ success: boolean; message: string; counts: any }> {
  if (!backupData || typeof backupData !== "object") {
    return { success: false, message: "ملف النسخة الاحتياطية غير صالح أو تالف.", counts: {} };
  }

  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid || firebaseAuth.currentUser?.uid || "";
  const email = (eff.email || firebaseAuth.currentUser?.email || "").toLowerCase().trim();

  if (!uid && !email) {
    return { success: false, message: "يرجى تسجيل الدخول بحساب المدرسة أولاً قبل استيراد النسخة الاحتياطية.", counts: {} };
  }

  try {
    // 1. School Name
    if (backupData.schoolName) {
      if (typeof window !== "undefined") {
        if (uid) localStorage.setItem(`school_name_${uid}`, backupData.schoolName);
        if (email) localStorage.setItem(`school_name_${email}`, backupData.schoolName);
      }
      saveSchoolName(backupData.schoolName).catch(() => {});
    }

    // 2. Collections restoration
    const restoredCounts: any = {};
    const collectionsToRestore: { key: string; colName: string }[] = [
      { key: "grades", colName: GRADES_COLL },
      { key: "classes", colName: CLASSES_COLL },
      { key: "teachers", colName: TEACHERS_COLL },
      { key: "students", colName: STUDENTS_COLL },
      { key: "attendance", colName: ATTENDANCE_COLL },
      { key: "behaviors", colName: BEHAVIORS_COLL },
      { key: "morningDelays", colName: MORNING_DELAYS_COLL }
    ];

    for (const item of collectionsToRestore) {
      const list = Array.isArray(backupData[item.key]) ? backupData[item.key] : [];
      if (list.length > 0) {
        // Tag strictly with active user credentials
        const tagged = list.map((docItem: any) => ({
          ...docItem,
          userId: uid,
          userEmail: email,
          updatedAt: Date.now()
        }));

        setLocalItems(item.colName, tagged, uid);
        if (email) setLocalItems(item.colName, tagged, email);
        notifyCollectionSubscribers(item.colName, tagged);
        restoredCounts[item.key] = tagged.length;
      } else {
        restoredCounts[item.key] = 0;
      }
    }

    // 3. Trigger cloud sync in background if Firestore is accessible
    syncAllLocalDataToFirestore().catch(() => {});

    return {
      success: true,
      message: "تم استيراد كافة بيانات النسخة الاحتياطية بنجاح!",
      counts: restoredCounts
    };
  } catch (err: any) {
    console.error("Error importing backup:", err);
    return { success: false, message: err?.message || "فشل استيراد النسخة الاحتياطية.", counts: {} };
  }
}

// Clear any legacy quota backoff flags on boot so Firestore is ALWAYS connected
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("firestore_quota_backoff_until");
  } catch (_) {}
}

export type CloudSyncStatus = "connected" | "syncing" | "permission-denied" | "database-not-found" | "offline" | "checking";

let currentCloudSyncStatus: CloudSyncStatus = "checking";
let currentCloudSyncMessage: string = "";
const syncStatusListeners = new Set<(status: CloudSyncStatus, message: string) => void>();

export function getCloudSyncStatus(): { status: CloudSyncStatus; message: string } {
  return { status: currentCloudSyncStatus, message: currentCloudSyncMessage };
}

export function setCloudSyncStatus(status: CloudSyncStatus, message: string = "") {
  if (currentCloudSyncStatus === status && currentCloudSyncMessage === message) return;
  currentCloudSyncStatus = status;
  currentCloudSyncMessage = message;
  syncStatusListeners.forEach(fn => {
    try { fn(status, message); } catch (_) {}
  });
}

export function subscribeToCloudSyncStatus(cb: (status: CloudSyncStatus, message: string) => void): () => void {
  syncStatusListeners.add(cb);
  try { cb(currentCloudSyncStatus, currentCloudSyncMessage); } catch (_) {}
  return () => {
    syncStatusListeners.delete(cb);
  };
}

// Execute Firestore write safely with proper timeout and real-time status reporting
async function safeFirestoreWrite(promise: Promise<any>, timeoutMs: number = 5000): Promise<void> {
  try {
    let timer: any;
    const timeoutPromise = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        console.warn(`Firestore write operation took longer than ${timeoutMs}ms.`);
        resolve();
      }, timeoutMs);
    });

    promise.then(() => {
      setCloudSyncStatus("connected", "المزامنة السحابية اللحظية متصلة ونشطة");
    }).catch((err) => {
      handleFirestoreError(err);
    });

    await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

export function isQuotaExhausted(): boolean {
  return false;
}

export function handleFirestoreError(err: any) {
  if (!err) return;
  const code = err?.code || "";
  const msg = (err?.message || String(err)).toLowerCase();

  if (code === "permission-denied" || msg.includes("permission-denied") || msg.includes("missing or insufficient permissions")) {
    setCloudSyncStatus("permission-denied", "تم رفض الإذن (Permission Denied) في Firestore. قواعد الأمان تمنع المزامنة اللحظية مع موقع كلاودفلير.");
    console.warn("⚠️ Firestore Permission Denied: Security rules in Firebase Console (apsent-02) are blocking real-time sync.");
  } else if (code === "not-found" || msg.includes("does not exist") || msg.includes("not_found")) {
    setCloudSyncStatus("database-not-found", "قاعدة بيانات Cloud Firestore غير موجودة في مشروع Firebase.");
  } else if (msg.includes("offline") || code === "unavailable") {
    setCloudSyncStatus("offline", "غير متصل بالسحابة أو انقطع الاتصال مؤقتاً.");
  } else {
    console.debug("Firestore notification:", err?.message || err);
  }
}

export function markQuotaExhausted() {
  // No-op: Never disable network to guarantee 100% real-time synchronization across all devices
}

// Update Morning Delay Reason (for Admin and Supervisors)
export async function updateMorningDelayReason(id: string, newReason: string): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;

  // 1. Update local cache immediately
  const items = getLocalItems(MORNING_DELAYS_COLL, uid);
  const idx = items.findIndex(r => r && (r.id === id || r._docId === id || r._origId === id));
  if (idx >= 0) {
    items[idx] = { ...items[idx], reason: newReason, updatedAt: Date.now() };
    setLocalItems(MORNING_DELAYS_COLL, items, uid);
    notifyCollectionSubscribers(MORNING_DELAYS_COLL, items);
  } else {
    const hub = collectionHubs.get(MORNING_DELAYS_COLL);
    const existing = hub?.latestData?.find((r: any) => r && (r.id === id || r._docId === id || r._origId === id));
    if (existing) {
      const updated = { ...existing, reason: newReason, updatedAt: Date.now() };
      saveOrUpdateLocalItem(MORNING_DELAYS_COLL, updated, uid);
    }
  }

  // 2. Persist to Firestore
  try {
    const docRef = doc(db, MORNING_DELAYS_COLL, id);
    await setDoc(docRef, { reason: newReason, updatedAt: Date.now() }, { merge: true });
  } catch (err) {
    console.warn("Firestore update morning delay reason notice:", err);
  }
}

// Update Attendance Record student absence excuse
export async function updateAttendanceAbsenceExcuse(recordId: string, studentId: string, isExcused: boolean, reason?: string): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;

  const items = getLocalItems(ATTENDANCE_COLL, uid);
  let idx = items.findIndex(r => r && (r.id === recordId || r._docId === recordId || r._origId === recordId));
  let existing = idx >= 0 ? items[idx] : null;

  if (!existing) {
    const hub = collectionHubs.get(ATTENDANCE_COLL);
    existing = hub?.latestData?.find((r: any) => r && (r.id === recordId || r._docId === recordId || r._origId === recordId));
  }

  if (existing) {
    const excusedList = Array.isArray(existing.excused) ? [...existing.excused] : [];
    const excuseReasons = { ...(existing.excuseReasons || {}) };

    if (isExcused) {
      if (!excusedList.includes(studentId)) excusedList.push(studentId);
      if (reason) excuseReasons[studentId] = reason;
      else if (!excuseReasons[studentId]) excuseReasons[studentId] = "بعذر";
    } else {
      const eIdx = excusedList.indexOf(studentId);
      if (eIdx >= 0) excusedList.splice(eIdx, 1);
      delete excuseReasons[studentId];
    }

    const updated = {
      ...existing,
      excused: excusedList,
      excuseReasons,
      updatedAt: Date.now()
    };

    if (idx >= 0) {
      items[idx] = updated;
      setLocalItems(ATTENDANCE_COLL, items, uid);
      notifyCollectionSubscribers(ATTENDANCE_COLL, items);
    } else {
      saveOrUpdateLocalItem(ATTENDANCE_COLL, updated, uid);
    }

    try {
      const docRef = doc(db, ATTENDANCE_COLL, recordId);
      await setDoc(docRef, { excused: excusedList, excuseReasons, updatedAt: Date.now() }, { merge: true });
    } catch (err) {
      console.warn("Firestore update attendance excuse notice:", err);
    }
  }
}

// Helper to fetch entire collection and filter client-side based on strict multi-tenant user isolation
async function fetchAndFilterCollection(colName: string, force: boolean = false): Promise<any[]> {
  const eff = getEffectiveUidAndEmail();
  const currentUid = eff.uid || "";
  const currentEmail = (eff.email || "").toLowerCase().trim();

  if (!currentUid && !currentEmail) {
    return [];
  }

  // 1. Check in-memory collection hub first (unless forced refresh)
  const hub = collectionHubs.get(colName);
  if (!force && hub && Array.isArray(hub.latestData) && hub.latestData.length > 0 && Date.now() - hub.lastUpdated < 60000) {
    const safeHubList = hub.latestData.filter(item => isDocBelongingToUser(item, currentUid, currentEmail));
    return safeHubList;
  }

  // 2. Load from local storage cache as immediate fallback
  const rawLocal = getLocalItems(colName, currentUid);
  const localList = Array.isArray(rawLocal) ? rawLocal.filter(item => isDocBelongingToUser(item, currentUid, currentEmail)) : [];

  if (isQuotaExhausted()) {
    return localList;
  }

  try {
    const fetchPromise = getDocs(collection(db, colName));
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Firestore fetch timeout")), 12000)
    );
    const querySnapshot = await Promise.race([fetchPromise, timeoutPromise]);
    const results: any[] = [];
    const seenIds = new Set<string>();
    
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (isDocBelongingToUser(data, currentUid, currentEmail) && !seenIds.has(docSnap.id)) {
        seenIds.add(docSnap.id);
        results.push({ ...data, id: docSnap.id, _docId: docSnap.id, _origId: (data as any)?.id });
      }
    });

    // Also merge server-synced records (guarantees cross-device sync even if Firestore quota is exceeded)
    try {
      const code = getSchoolCode();
      const q = new URLSearchParams();
      if (code) q.set("schoolCode", code);
      if (currentEmail && !eff.isGuest && !currentEmail.includes("@school.local")) q.set("email", currentEmail);
      if (currentUid && !eff.isGuest && !currentUid.startsWith("guest")) q.set("uid", currentUid);
      
      const serverEndpoint = colName === ATTENDANCE_COLL ? "/api/sync/attendance" :
                             colName === BEHAVIORS_COLL ? "/api/sync/behaviors" :
                             colName === MORNING_DELAYS_COLL ? "/api/sync/delays" :
                             colName === GRADES_COLL ? "/api/sync/grades" :
                             colName === CLASSES_COLL ? "/api/sync/classes" :
                             colName === TEACHERS_COLL ? "/api/sync/teachers" :
                             colName === STUDENTS_COLL ? "/api/sync/students" : null;
      if (serverEndpoint) {
        const sRes = await fetch(`${serverEndpoint}?${q.toString()}`);
        if (sRes.ok) {
          const sJson = await sRes.json();
          if (sJson.success && Array.isArray(sJson.records)) {
            sJson.records.forEach((sItem: any) => {
              if (sItem && sItem.id && !seenIds.has(sItem.id)) {
                seenIds.add(sItem.id);
                results.push(sItem);
              }
            });
          }
        }
      }
    } catch (_) {}

    // Update local cache and hub with authoritative data
    setLocalItems(colName, results, currentUid);
    const targetHub = getCollectionHub(colName);
    targetHub.latestData = results;
    targetHub.lastUpdated = Date.now();

    return results;
  } catch (err: any) {
    const msg = (err?.message || "").toLowerCase();
    const code = err?.code || "";
    if (code === "not-found" || msg.includes("does not exist") || msg.includes("not_found")) {
      const currentId = getActiveFirestoreDatabaseId();
      if (currentId !== "(default)") {
        try {
          updateActiveDb("(default)");
          const altSnap = await getDocs(collection(db, colName));
          const results: any[] = [];
          const seenIds = new Set<string>();
          altSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (isDocBelongingToUser(data, currentUid, currentEmail) && !seenIds.has(docSnap.id)) {
              const rawItem = { ...data, id: docSnap.id, _docId: docSnap.id, _origId: (data as any)?.id };
              if (!isRecordTombstoned(colName, rawItem)) {
                seenIds.add(docSnap.id);
                const sanitized = colName === ATTENDANCE_COLL ? sanitizeAttendanceRecord(rawItem) : rawItem;
                results.push(sanitized);
              }
            }
          });
          setLocalItems(colName, results, currentUid);
          const targetHub = getCollectionHub(colName);
          targetHub.latestData = results;
          targetHub.lastUpdated = Date.now();
          return results;
        } catch (_) {}
      }
    }
    handleFirestoreError(err);

    // Fallback: If Firestore failed or timed out, attempt to query the server endpoint
    try {
      const sCode = getSchoolCode();
      const sq = new URLSearchParams();
      if (sCode) sq.set("schoolCode", sCode);
      if (currentEmail) sq.set("email", currentEmail);
      if (currentUid) sq.set("uid", currentUid);
      const fallbackEndpoint = colName === ATTENDANCE_COLL ? "/api/sync/attendance" :
                                colName === BEHAVIORS_COLL ? "/api/sync/behaviors" :
                                colName === MORNING_DELAYS_COLL ? "/api/sync/delays" :
                                colName === GRADES_COLL ? "/api/sync/grades" :
                                colName === CLASSES_COLL ? "/api/sync/classes" :
                                colName === TEACHERS_COLL ? "/api/sync/teachers" :
                                colName === STUDENTS_COLL ? "/api/sync/students" : null;
      if (fallbackEndpoint) {
        const sRes = await fetch(`${fallbackEndpoint}?${sq.toString()}`);
        if (sRes.ok) {
          const sJson = await sRes.json();
          if (sJson.success && Array.isArray(sJson.records) && sJson.records.length > 0) {
            setLocalItems(colName, sJson.records, currentUid);
            const targetHub = getCollectionHub(colName);
            targetHub.latestData = sJson.records;
            targetHub.lastUpdated = Date.now();
            return sJson.records;
          }
        }
      }
    } catch (_) {}

    return localList;
  }
}

// Fetch All Grades
export async function getGrades(force: boolean = false): Promise<Grade[]> {
  const rawGrades = (await fetchAndFilterCollection(GRADES_COLL, force)) as Grade[];
  const safeGrades = Array.isArray(rawGrades) ? rawGrades : [];
  
  const result: Grade[] = [];
  const seen = new Set<string>();
  for (const g of safeGrades) {
    if (!g || !g.id || isIdDeleted("grades", g.id)) continue;
    const key = (g.name || "").replace(/[أإآ]/g, "ا").trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(g);
    }
  }
  return result;
}

// Fetch All Classes
export async function getClasses(force: boolean = false): Promise<Class[]> {
  const rawClasses = (await fetchAndFilterCollection(CLASSES_COLL, force)) as Class[];
  const safeClasses = Array.isArray(rawClasses) ? rawClasses : [];
  
  const result: Class[] = [];
  const seen = new Set<string>();

  for (const c of safeClasses) {
    if (!c || !c.id || isIdDeleted("classes", c.id)) continue;
    const gradeId = CANONICAL_GRADE_MAP[c.gradeId] || c.gradeId;
    const key = `${gradeId}_${(c.name || "").trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ ...c, gradeId });
    }
  }
  return result;
}

// Fetch All Teachers
export async function getTeachers(force: boolean = false): Promise<Teacher[]> {
  const list = await fetchAndFilterCollection(TEACHERS_COLL, force);
  const safeList = Array.isArray(list) ? (list as Teacher[]) : [];
  const seen = new Set<string>();
  const uniqueTeachers: Teacher[] = [];
  for (const t of safeList) {
    if (!t || !t.id || isIdDeleted("teachers", t.id)) continue;
    const key = (t.name || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueTeachers.push(t);
  }
  return uniqueTeachers;
}

// Fetch All Students
export async function getStudents(force: boolean = false): Promise<Student[]> {
  const list = await fetchAndFilterCollection(STUDENTS_COLL, force);
  const safeList = Array.isArray(list) ? (list as Student[]) : [];
  const normalized = safeList.map(normalizeStudentData);
  const seenNames = new Set<string>();
  const uniqueStudents: Student[] = [];
  for (const s of normalized) {
    if (!s || !s.id || isIdDeleted("students", s.id)) continue;
    const nameKey = (s.name || "").trim().toLowerCase();
    if (!nameKey || seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);
    uniqueStudents.push(s);
  }
  return uniqueStudents;
}

// Fetch Students by Grade and Class
export async function getStudentsByClass(gradeId: string, classId: string): Promise<Student[]> {
  const students = await getStudents();
  return students.filter(s => s && s.gradeId === gradeId && s.classId === classId);
}

// Normalize period strings for matching (e.g. "حصة 1", "حصة_1", "الأولى", "1")
export const normalizePeriodKey = (p?: string): string => {
  if (!p) return "1";
  const str = String(p).trim();
  const digitMatch = str.match(/\d+/);
  if (digitMatch) return digitMatch[0];
  const norm = str.replace(/[أإآا]/g, "ا").replace(/[ىي]/g, "ي").replace(/[ةه]/g, "ه").trim();
  if (norm.includes("اول") || norm.includes("1")) return "1";
  if (norm.includes("ثاني") || norm.includes("2")) return "2";
  if (norm.includes("ثالث") || norm.includes("3")) return "3";
  if (norm.includes("رابع") || norm.includes("4")) return "4";
  if (norm.includes("خامس") || norm.includes("5")) return "5";
  if (norm.includes("سادس") || norm.includes("6")) return "6";
  if (norm.includes("سابع") || norm.includes("7")) return "7";
  return str.replace(/[\s_]+/g, "").toLowerCase();
};

const normalizeKey = (s?: string) => (s || "").trim().toLowerCase();

// Fetch Attendance Record for a specific date, period, grade, class
export async function getAttendanceRecord(
  date: string,
  period: string,
  gradeId: string,
  classId: string
): Promise<AttendanceRecord | null> {
  const normPeriod = normalizePeriodKey(period);
  const records = await fetchAndFilterCollection(ATTENDANCE_COLL);
  const found = records.find(r => 
    r.date === date && 
    normalizePeriodKey(r.period) === normPeriod && 
    (r.gradeId === gradeId || normalizeKey(r.gradeId) === normalizeKey(gradeId)) && 
    (r.classId === classId || normalizeKey(r.classId) === normalizeKey(classId))
  );
  return found ? (found as AttendanceRecord) : null;
}

// Subscribe to a specific Attendance Record in real-time (routed via multiplexed collection hub)
export function subscribeToAttendanceRecord(
  date: string,
  period: string,
  gradeId: string,
  classId: string,
  callback: (record: AttendanceRecord | null) => void,
  onError?: (error: any) => void
) {
  const normPeriod = normalizePeriodKey(period);
  return subscribeToCollection(ATTENDANCE_COLL, (records) => {
    const found = records.find(r => 
      r.date === date && 
      normalizePeriodKey(r.period) === normPeriod && 
      (r.gradeId === gradeId || normalizeKey(r.gradeId) === normalizeKey(gradeId)) && 
      (r.classId === classId || normalizeKey(r.classId) === normalizeKey(classId))
    ) || null;
    callback(found);
  }, onError);
}

// Save Attendance Record (Instant local-first cache + real-time Firestore sync)
export async function saveAttendanceRecord(record: Omit<AttendanceRecord, "id" | "timestamp">): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  let uid = eff.uid || (firebaseAuth.currentUser?.uid) || "";
  let email = (eff.email || firebaseAuth.currentUser?.email || "").toLowerCase().trim();
  
  if (!email && uid) {
    const cached = userProfileAliasCache.get(uid.toLowerCase());
    if (cached?.email) email = cached.email;
    else {
      try {
        const raw = localStorage.getItem(`user_alias_${uid.toLowerCase()}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.email) email = parsed.email;
        }
      } catch (_) {}
    }
  }
  if (!uid && email) {
    const cached = userProfileAliasCache.get(email.toLowerCase());
    if (cached?.uid) uid = cached.uid;
    else {
      try {
        const raw = localStorage.getItem(`user_alias_${email.toLowerCase()}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.uid) uid = parsed.uid;
        }
      } catch (_) {}
    }
  }

  // Deterministic canonical ID per slot scoped to tenant to guarantee 100% isolation across schools
  const tenantPrefix = email ? email.replace(/[^a-zA-Z0-9]/g, '_') : (uid || "school");
  const normPeriod = normalizePeriodKey(record.period);
  const recordId = `att_${tenantPrefix}_${record.date}_p${normPeriod}_${record.gradeId}_${record.classId}`;

  const fullRecord = {
    ...record,
    id: recordId,
    userId: uid,
    userEmail: email,
    schoolCode: getSchoolCode(),
    timestamp: Date.now(),
    updatedAt: Date.now()
  };

  // 1. Save to local storage cache immediately (0ms)
  saveOrUpdateLocalItem(ATTENDANCE_COLL, fullRecord, uid);

  // 2. Real-time multi-device server sync (guarantees cross-device sync even if Firestore quota is exceeded)
  postToServerSync("/api/sync/attendance", { record: fullRecord });

  // 3. Persist to Firestore (safeguarded non-blocking timeout)
  const docRef = doc(db, ATTENDANCE_COLL, recordId);
  await safeFirestoreWrite(setDoc(docRef, fullRecord, { merge: true }), 2500);
}

// Delete entire Attendance Record (Instant local update + real-time Firestore delete)
export async function deleteAttendanceRecord(id: string): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  recordDeletedId(ATTENDANCE_COLL, id);
  removeLocalItemsBy(ATTENDANCE_COLL, (r) => r.id === id || r._docId === id || r._origId === id, eff.uid);

  // Broadcast deletion across all open tabs/windows immediately (0ms)
  if (realTimeSyncChannel) {
    try {
      realTimeSyncChannel.postMessage({
        type: "attendance_deleted",
        deletedIds: [id],
        schoolCode: getSchoolCode(),
        ownerEmail: eff.email,
        ownerUid: eff.uid,
        timestamp: Date.now()
      });
    } catch (_) {}
  }

  // Multi-device server synchronization
  postToServerSync("/api/sync/attendance", { deletedIds: [id] });

  try {
    await safeFirestoreWrite(deleteDoc(doc(db, ATTENDANCE_COLL, id)), 5000);
  } catch (_) {}
}

// Delete single student absence/late entry from an Attendance Record (Instant 0ms update + Firestore sync)
export async function deleteAttendanceEntry(recordId: string, studentId: string, isAbsentType: boolean): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid || "school_admin";

  if (studentId === "no-absence") {
    return deleteAttendanceRecord(recordId);
  }

  // 1. Permanent entry-level tombstone to prevent revival across network or polling
  recordDeletedAttendanceEntry(recordId, studentId, isAbsentType);

  // 2. Check local storage cache first
  const items = getLocalItems(ATTENDANCE_COLL, uid);
  const idx = items.findIndex(r => r && (r.id === recordId || r._docId === recordId || r._origId === recordId));
  let updatedRecord: any = null;

  if (idx >= 0) {
    const existing = items[idx];
    let updatedAbsent: string[] = Array.isArray(existing.absent) ? [...existing.absent] : [];
    let updatedLate: string[] = Array.isArray(existing.late) ? [...existing.late] : [];
    let updatedPresent: string[] = Array.isArray(existing.present) ? [...existing.present] : [];

    if (isAbsentType) {
      updatedAbsent = updatedAbsent.filter((id: string) => id !== studentId);
      if (!updatedPresent.includes(studentId)) {
        updatedPresent.push(studentId);
      }
    } else {
      updatedLate = updatedLate.filter((id: string) => id !== studentId);
      if (!updatedPresent.includes(studentId)) {
        updatedPresent.push(studentId);
      }
    }

    const isNoAbsence = updatedAbsent.length === 0 && updatedLate.length === 0;

    updatedRecord = {
      ...existing,
      absent: updatedAbsent,
      late: updatedLate,
      present: updatedPresent,
      isNoAbsence,
      updatedAt: Date.now()
    };

    items[idx] = updatedRecord;
    setLocalItems(ATTENDANCE_COLL, items, uid);
    notifyCollectionSubscribers(ATTENDANCE_COLL, items);
  } else {
    // If not found in primary local items, check active in-memory hub or fetch from Firestore
    const hub = collectionHubs.get(ATTENDANCE_COLL);
    const hubExisting = hub?.latestData?.find((r: any) => r && (r.id === recordId || r._docId === recordId || r._origId === recordId));
    let existing: any = hubExisting;

    if (!existing) {
      try {
        const docSnap = await getDoc(doc(db, ATTENDANCE_COLL, recordId));
        if (docSnap.exists()) {
          existing = { ...docSnap.data(), id: docSnap.id };
        }
      } catch (_) {}
    }

    if (existing) {
      let updatedAbsent: string[] = Array.isArray(existing.absent) ? [...existing.absent] : [];
      let updatedLate: string[] = Array.isArray(existing.late) ? [...existing.late] : [];
      let updatedPresent: string[] = Array.isArray(existing.present) ? [...existing.present] : [];

      if (isAbsentType) {
        updatedAbsent = updatedAbsent.filter((id: string) => id !== studentId);
        if (!updatedPresent.includes(studentId)) updatedPresent.push(studentId);
      } else {
        updatedLate = updatedLate.filter((id: string) => id !== studentId);
        if (!updatedPresent.includes(studentId)) updatedPresent.push(studentId);
      }

      const isNoAbsence = updatedAbsent.length === 0 && updatedLate.length === 0;
      updatedRecord = {
        ...existing,
        absent: updatedAbsent,
        late: updatedLate,
        present: updatedPresent,
        isNoAbsence,
        updatedAt: Date.now()
      };

      saveOrUpdateLocalItem(ATTENDANCE_COLL, updatedRecord, uid);
    }
  }

  // 3. Broadcast real-time entry deletion (0ms)
  if (realTimeSyncChannel) {
    try {
      realTimeSyncChannel.postMessage({
        type: "attendance_entry_deleted",
        recordId,
        studentId,
        isAbsentType,
        updatedRecord,
        schoolCode: getSchoolCode(),
        ownerEmail: eff.email,
        ownerUid: eff.uid,
        timestamp: Date.now()
      });
    } catch (_) {}
  }

  // 4. Multi-device server synchronization
  if (updatedRecord) {
    postToServerSync("/api/sync/attendance", { record: updatedRecord });
  }

  // 5. Persist to Firestore
  if (updatedRecord) {
    const docRef = doc(db, ATTENDANCE_COLL, recordId);
    await safeFirestoreWrite(setDoc(docRef, updatedRecord, { merge: true }), 5000);
  }
}

// Fetch Behavior Records for a student
export async function getBehaviorRecords(studentId: string): Promise<BehaviorRecord[]> {
  const records = await fetchAndFilterCollection(BEHAVIORS_COLL);
  const safeRecords = Array.isArray(records) ? records : [];
  const filtered = safeRecords.filter(r => r && r.studentId === studentId) as BehaviorRecord[];
  return filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// Subscribe to Behavior Records for a student in real-time
export function subscribeToBehaviorRecords(
  studentId: string,
  callback: (records: BehaviorRecord[]) => void,
  onError?: (error: any) => void
) {
  return subscribeToCollection(BEHAVIORS_COLL, (records) => {
    const safeRecords = Array.isArray(records) ? records : [];
    const filtered = safeRecords.filter(r => r && r.studentId === studentId);
    filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    callback(filtered);
  }, onError);
}

// Save Behavior Record (Instant local-first cache + real-time Firestore sync)
export async function saveBehaviorRecord(record: Omit<BehaviorRecord, "id" | "timestamp">): Promise<string> {
  const eff = getEffectiveUidAndEmail();
  let uid = eff.uid || (firebaseAuth.currentUser?.uid) || "";
  let email = (eff.email || firebaseAuth.currentUser?.email || "").toLowerCase();
  
  if (!email && uid) {
    const cached = userProfileAliasCache.get(uid.toLowerCase());
    if (cached?.email) email = cached.email;
    else {
      try {
        const raw = localStorage.getItem(`user_alias_${uid.toLowerCase()}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.email) email = parsed.email;
        }
      } catch (_) {}
    }
  }
  if (!uid && email) {
    const cached = userProfileAliasCache.get(email.toLowerCase());
    if (cached?.uid) uid = cached.uid;
    else {
      try {
        const raw = localStorage.getItem(`user_alias_${email.toLowerCase()}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.uid) uid = parsed.uid;
        }
      } catch (_) {}
    }
  }

  const newId = generateLocalId("beh");

  const fullRecord = {
    ...record,
    id: newId,
    userId: uid,
    userEmail: email,
    schoolCode: getSchoolCode(),
    timestamp: Date.now(),
    updatedAt: Date.now()
  };

  // 1. Instant local update (0ms)
  saveOrUpdateLocalItem(BEHAVIORS_COLL, fullRecord, uid);

  // 2. Real-time server sync
  postToServerSync("/api/sync/behaviors", { record: fullRecord });

  // 3. Firestore write
  const docRef = doc(db, BEHAVIORS_COLL, newId);
  await safeFirestoreWrite(setDoc(docRef, fullRecord, { merge: true }), 5000);

  return newId;
}

// Delete Behavior Record (Instant local purge + real-time Firestore delete)
export async function deleteBehaviorRecord(id: string): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  removeLocalItemsBy(BEHAVIORS_COLL, (r) => r.id === id || r._docId === id || r._origId === id, eff.uid);
  await safeFirestoreWrite(deleteDoc(doc(db, BEHAVIORS_COLL, id)), 5000);
}

// --- MORNING DELAY (التأخر الصباحي) ---

// Fetch Morning Delay Records (optionally filtered by date)
export async function getMorningDelayRecords(date?: string): Promise<MorningDelayRecord[]> {
  const records = (await fetchAndFilterCollection(MORNING_DELAYS_COLL)) as MorningDelayRecord[];
  const safeRecords = Array.isArray(records) ? records : [];
  if (date) {
    return safeRecords.filter(r => r && r.date === date).sort((a, b) => (b.arrivalTime || "").localeCompare(a.arrivalTime || ""));
  }
  return safeRecords.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// Subscribe to Morning Delay Records in real-time
export function subscribeToMorningDelayRecords(
  date: string | undefined,
  callback: (records: MorningDelayRecord[]) => void,
  onError?: (error: any) => void
) {
  return subscribeToCollection(MORNING_DELAYS_COLL, (records) => {
    const safeRecords = Array.isArray(records) ? records : [];
    let filtered = safeRecords;
    if (date) {
      filtered = safeRecords.filter(r => r && r.date === date);
    }
    filtered.sort((a, b) => {
      if (a.date !== b.date) return (b.date || "").localeCompare(a.date || "");
      return (a.arrivalTime || "").localeCompare(b.arrivalTime || "");
    });
    callback(filtered);
  }, onError);
}

// Save Morning Delay Record (Instant local-first optimistic cache + real-time Firestore sync)
export async function saveMorningDelayRecord(record: Omit<MorningDelayRecord, "id" | "timestamp">): Promise<string> {
  const eff = getEffectiveUidAndEmail();
  let uid = eff.uid || (firebaseAuth.currentUser?.uid) || "";
  let email = (eff.email || firebaseAuth.currentUser?.email || "").toLowerCase();
  
  if (!email && uid) {
    const cached = userProfileAliasCache.get(uid.toLowerCase());
    if (cached?.email) email = cached.email;
    else {
      try {
        const raw = localStorage.getItem(`user_alias_${uid.toLowerCase()}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.email) email = parsed.email;
        }
      } catch (_) {}
    }
  }
  if (!uid && email) {
    const cached = userProfileAliasCache.get(email.toLowerCase());
    if (cached?.uid) uid = cached.uid;
    else {
      try {
        const raw = localStorage.getItem(`user_alias_${email.toLowerCase()}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.uid) uid = parsed.uid;
        }
      } catch (_) {}
    }
  }
  
  // Deterministic canonical record ID per student per day for rock-solid cross-device sync
  const recordId = `delay_${record.date}_${record.studentId}`;

  const fullRecord: MorningDelayRecord = {
    ...record,
    id: recordId,
    userId: uid,
    userEmail: email,
    schoolCode: getSchoolCode(),
    timestamp: Date.now(),
    updatedAt: Date.now()
  };

  // 1. Instant local cache update (0ms)
  saveOrUpdateLocalItem(MORNING_DELAYS_COLL, fullRecord, uid);

  // 2. Real-time server sync
  postToServerSync("/api/sync/delays", { record: fullRecord });

  // 3. Real-time Firestore write (safeguarded non-blocking timeout)
  const docRef = doc(db, MORNING_DELAYS_COLL, recordId);
  await safeFirestoreWrite(setDoc(docRef, fullRecord, { merge: true }), 2500);

  return recordId;
}

// Save Multiple Morning Delay Records in Batch
export async function saveMorningDelaysBatch(records: Omit<MorningDelayRecord, "id" | "timestamp">[]): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  let uid = eff.uid || (firebaseAuth.currentUser?.uid) || "";
  let email = (eff.email || firebaseAuth.currentUser?.email || "").toLowerCase();
  
  if (!email && uid) {
    const cached = userProfileAliasCache.get(uid.toLowerCase());
    if (cached?.email) email = cached.email;
    else {
      try {
        const raw = localStorage.getItem(`user_alias_${uid.toLowerCase()}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.email) email = parsed.email;
        }
      } catch (_) {}
    }
  }
  if (!uid && email) {
    const cached = userProfileAliasCache.get(email.toLowerCase());
    if (cached?.uid) uid = cached.uid;
    else {
      try {
        const raw = localStorage.getItem(`user_alias_${email.toLowerCase()}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.uid) uid = parsed.uid;
        }
      } catch (_) {}
    }
  }

  const schoolCode = getSchoolCode();

  // Local cache update
  const fullRecords: any[] = [];
  records.forEach(r => {
    const recordId = `delay_${r.date}_${r.studentId}`;
    const full = {
      ...r,
      id: recordId,
      userId: uid,
      userEmail: email,
      schoolCode,
      timestamp: Date.now(),
      updatedAt: Date.now()
    };
    fullRecords.push(full);
    saveOrUpdateLocalItem(MORNING_DELAYS_COLL, full, uid);
  });

  // Real-time server sync
  postToServerSync("/api/sync/delays", { records: fullRecords });

  const batch = writeBatch(db);
  for (const record of records) {
    const recordId = `delay_${record.date}_${record.studentId}`;
    const docRef = doc(db, MORNING_DELAYS_COLL, recordId);
    batch.set(docRef, {
      ...record,
      id: recordId,
      userId: uid,
      userEmail: email,
      schoolCode,
      timestamp: Date.now(),
      updatedAt: Date.now()
    }, { merge: true });
  }
  await safeFirestoreWrite(batch.commit(), 3000);
}

// Delete Morning Delay Record (Instant local purge + real-time Firestore multi-doc delete)
export async function deleteMorningDelayRecord(
  id: string,
  extra?: { studentId?: string; date?: string }
): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = (eff.email || "").toLowerCase();

  // 1. Extract target studentId & date from extra, cache, or id string
  let targetStudentId = extra?.studentId || "";
  let targetDate = extra?.date || "";

  if ((!targetDate || !targetStudentId) && id && id.startsWith("delay_")) {
    const parts = id.split("_");
    const dateIdx = parts.findIndex(p => /^\d{4}-\d{2}-\d{2}$/.test(p));
    if (dateIdx !== -1) {
      if (!targetDate) targetDate = parts[dateIdx];
      if (!targetStudentId) targetStudentId = parts.slice(dateIdx + 1).join("_");
    }
  }

  const localItems = getLocalItems(MORNING_DELAYS_COLL, uid);
  const found = localItems.find(item => item && (
    item.id === id || 
    (targetStudentId && item.studentId === targetStudentId && targetDate && item.date === targetDate)
  ));
  
  if (found) {
    if (!targetStudentId && found.studentId) targetStudentId = found.studentId;
    if (!targetDate && found.date) targetDate = found.date;
  }

  // 1. Permanent tombstones across exact ID, canonical ID, and student/date
  if (id) recordDeletedId(MORNING_DELAYS_COLL, id);
  if (targetDate && targetStudentId) {
    recordDeletedMorningDelay(targetDate, targetStudentId);
    recordDeletedId(MORNING_DELAYS_COLL, `delay_${targetDate}_${targetStudentId}`);
  }

  // 2. Instant local-first purge across all matching criteria (0ms)
  removeLocalItemsBy(MORNING_DELAYS_COLL, (item) => {
    if (item.id === id) return true;
    if (targetStudentId && targetDate && item.studentId === targetStudentId && item.date === targetDate) return true;
    return false;
  }, uid);

  // 3. Broadcast real-time deletion across open tabs/windows (0ms)
  if (realTimeSyncChannel) {
    try {
      realTimeSyncChannel.postMessage({
        type: "delay_deleted",
        deletedIds: [id, targetDate && targetStudentId ? `delay_${targetDate}_${targetStudentId}` : ""].filter(Boolean),
        studentId: targetStudentId,
        date: targetDate,
        schoolCode: getSchoolCode(),
        ownerEmail: eff.email,
        ownerUid: eff.uid,
        timestamp: Date.now()
      });
    } catch (_) {}
  }

  // 4. Multi-device server synchronization
  postToServerSync("/api/sync/delays", {
    deletedIds: [id, targetDate && targetStudentId ? `delay_${targetDate}_${targetStudentId}` : ""].filter(Boolean),
    studentId: targetStudentId,
    date: targetDate
  });

  // 5. Real-time Firestore deletion across exact ID, canonical ID, and all matching docs
  try {
    const batch = writeBatch(db);
    let batchCount = 0;

    // a) Direct ID delete
    if (id) {
      batch.delete(doc(db, MORNING_DELAYS_COLL, id));
      batchCount++;
    }

    // b) Canonical ID delete
    if (targetDate && targetStudentId) {
      const canonicalId = `delay_${targetDate}_${targetStudentId}`;
      if (canonicalId !== id) {
        batch.delete(doc(db, MORNING_DELAYS_COLL, canonicalId));
        batchCount++;
      }
    }

    // c) Scan Firestore collection for any duplicates or mismatched doc IDs belonging to this user
    try {
      const colRef = collection(db, MORNING_DELAYS_COLL);
      const snapshot = await getDocs(colRef);
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (isDocBelongingToUser(d, uid, email)) {
          const matchId = docSnap.id === id || d.id === id;
          const matchStudentAndDate = targetStudentId && targetDate && (d.studentId === targetStudentId && d.date === targetDate);
          if (matchId || matchStudentAndDate) {
            batch.delete(doc(db, MORNING_DELAYS_COLL, docSnap.id));
            batchCount++;
          }
        }
      });
    } catch (scanErr) {
      console.warn("Error scanning morning delays for delete:", scanErr);
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

// Fetch all morning delay records for stats/reports
export async function getAllMorningDelayRecords(force: boolean = false): Promise<MorningDelayRecord[]> {
  return fetchAndFilterCollection(MORNING_DELAYS_COLL, force) as Promise<MorningDelayRecord[]>;
}

// Subscribe to all morning delay records
export function subscribeToAllMorningDelayRecords(callback: (records: MorningDelayRecord[]) => void, onError?: (error: any) => void) {
  return subscribeToCollection(MORNING_DELAYS_COLL, (records) => {
    const safeRecords = Array.isArray(records) ? records : [];
    safeRecords.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    callback(safeRecords);
  }, onError);
}

// --- ADMIN WRITES ---

// Add Grade
export async function addGrade(name: string): Promise<string> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = eff.email;
  const currentSchoolCode = getSchoolCode();

  const existingGrades = await getGrades();
  const trimmedName = name.trim();
  const existing = existingGrades.find(g => g.name?.trim() === trimmedName);
  if (existing) {
    return existing.id;
  }

  const generatedId = generateLocalId("grd");
  unmarkDeletedId("grades", generatedId);
  const newGradeObj = {
    id: generatedId,
    name: trimmedName,
    userId: uid,
    userEmail: email,
    schoolCode: currentSchoolCode,
    createdAt: Date.now()
  };

  // 1. Immediately write to local storage cache
  saveOrUpdateLocalItem(GRADES_COLL, newGradeObj);

  // Real-time server sync
  postToServerSync("/api/sync/grades", { record: newGradeObj });

  // 2. Persist to Firestore with explicit document ID
  const docRef = doc(db, GRADES_COLL, generatedId);
  await safeFirestoreWrite(setDoc(docRef, newGradeObj), 5000);

  return generatedId;
}

// Add Multiple Grades in a Batch
export async function addGradesBatch(names: string[]): Promise<{ id: string; name: string }[]> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = eff.email;
  const currentSchoolCode = getSchoolCode();

  const localGrades = getLocalItems(GRADES_COLL).filter(g => isDocBelongingToUser(g, uid, email));
  const existingMap = new Map<string, string>();
  localGrades.forEach(g => {
    if (g.name) existingMap.set(g.name.trim(), g.id);
  });

  const results: { id: string; name: string }[] = [];
  const toCreate: { id: string; name: string }[] = [];

  names.forEach(rawName => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    if (existingMap.has(trimmed)) {
      results.push({ id: existingMap.get(trimmed)!, name: trimmed });
    } else {
      const generatedId = generateLocalId("grd");
      const gradeItem = { id: generatedId, name: trimmed };
      results.push(gradeItem);
      toCreate.push(gradeItem);
      // Save locally
      saveOrUpdateLocalItem(GRADES_COLL, {
        id: generatedId,
        name: trimmed,
        userId: uid,
        userEmail: email,
        schoolCode: currentSchoolCode,
        createdAt: Date.now()
      });
      existingMap.set(trimmed, generatedId);
    }
  });

  if (toCreate.length > 0) {
    toCreate.forEach(item => unmarkDeletedId("grades", item.id));
    const fullCreated = toCreate.map(item => ({
      id: item.id,
      name: item.name,
      userId: uid,
      userEmail: email,
      schoolCode: currentSchoolCode,
      createdAt: Date.now()
    }));
    postToServerSync("/api/sync/grades", { records: fullCreated });

    const chunkSize = 400;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      const now = Date.now();
      chunk.forEach((item, idx) => {
        const docRef = doc(db, GRADES_COLL, item.id);
        batch.set(docRef, {
          id: item.id,
          name: item.name,
          userId: uid,
          userEmail: email,
          schoolCode: currentSchoolCode,
          createdAt: now + i + idx
        });
      });
      await safeFirestoreWrite(batch.commit(), 5000);
    }
  }

  return results;
}

// Delete Grade (Instant 0ms local purge + authoritative real-time Firestore cascade delete)
export async function deleteGrade(id: string, gradeName?: string): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = (eff.email || "").toLowerCase().trim();

  // 1. Determine grade name if not passed
  const localGrades = getLocalItems(GRADES_COLL, uid);
  const targetGrade = localGrades.find(g => g.id === id || (g._docId && g._docId === id));
  const resolvedGradeName = (gradeName || targetGrade?.name)?.trim();

  // 2. Gather all associated class & student IDs from local cache
  const localClasses = getLocalItems(CLASSES_COLL, uid);
  const matchingClasses = localClasses.filter(c => 
    c.gradeId === id || 
    (resolvedGradeName && (c.gradeId === resolvedGradeName || c.gradeName === resolvedGradeName))
  );
  const classIdsToDelete = new Set<string>(matchingClasses.map(c => c.id));
  
  const localStudents = getLocalItems(STUDENTS_COLL, uid);
  const matchingStudents = localStudents.filter(s => 
    s.gradeId === id || 
    (resolvedGradeName && s.gradeName === resolvedGradeName) || 
    classIdsToDelete.has(s.classId)
  );
  const studentIdsToDelete = new Set<string>(matchingStudents.map(s => s.id));

  // Record permanent deletion tombstones
  recordDeletedId("grades", id);
  if (classIdsToDelete.size > 0) {
    recordDeletedIds("classes", Array.from(classIdsToDelete));
  }
  if (studentIdsToDelete.size > 0) {
    recordDeletedIds("students", Array.from(studentIdsToDelete));
  }

  // 3. Delete from local storage cache immediately across ALL keys (0ms instant UI update)
  removeLocalItemsBy(GRADES_COLL, (g) => g.id === id || (g._docId && g._docId === id) || (resolvedGradeName && g.name?.trim() === resolvedGradeName), uid);
  removeLocalItemsBy(CLASSES_COLL, (c) => c.gradeId === id || classIdsToDelete.has(c.id) || (resolvedGradeName && (c.gradeId === resolvedGradeName || c.gradeName === resolvedGradeName)), uid);
  removeLocalItemsBy(STUDENTS_COLL, (s) => s.gradeId === id || studentIdsToDelete.has(s.id) || (resolvedGradeName && s.gradeName === resolvedGradeName) || classIdsToDelete.has(s.classId), uid);

  // Real-time server sync
  postToServerSync("/api/sync/grades", { deletedIds: [id] });
  if (classIdsToDelete.size > 0) {
    postToServerSync("/api/sync/classes", { deletedIds: Array.from(classIdsToDelete) });
  }
  if (studentIdsToDelete.size > 0) {
    postToServerSync("/api/sync/students", { deletedIds: Array.from(studentIdsToDelete) });
  }

  // 4. Cascade delete from Firestore across all matching documents
  try {
    const batch = writeBatch(db);
    let batchCount = 0;

    // Direct deletion by ID
    if (id) {
      batch.delete(doc(db, GRADES_COLL, id));
      batchCount++;
    }

    // Query Firestore GRADES_COLL for any docs with this id or name
    try {
      const gSnap = await getDocs(collection(db, GRADES_COLL));
      gSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (!isDocBelongingToUser(d, uid, email)) return;
        const matchId = docSnap.id === id || d.id === id;
        const matchName = resolvedGradeName && d.name?.trim() === resolvedGradeName;
        if (matchId || matchName) {
          batch.delete(docSnap.ref);
          batchCount++;
        }
      });
    } catch (_) {}

    // Query Firestore CLASSES_COLL for any classes linked to this grade
    try {
      const cSnap = await getDocs(collection(db, CLASSES_COLL));
      cSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (!isDocBelongingToUser(d, uid, email)) return;
        const matchId = classIdsToDelete.has(docSnap.id) || classIdsToDelete.has(d.id);
        const matchGradeId = d.gradeId === id || (resolvedGradeName && (d.gradeId === resolvedGradeName || d.gradeName === resolvedGradeName));
        if (matchId || matchGradeId) {
          classIdsToDelete.add(docSnap.id);
          batch.delete(docSnap.ref);
          batchCount++;
        }
      });
    } catch (_) {}

    // Query Firestore STUDENTS_COLL for any students linked to this grade or classes
    try {
      const sSnap = await getDocs(collection(db, STUDENTS_COLL));
      sSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (!isDocBelongingToUser(d, uid, email)) return;
        const matchId = studentIdsToDelete.has(docSnap.id) || studentIdsToDelete.has(d.id);
        const matchGrade = d.gradeId === id || (resolvedGradeName && d.gradeName === resolvedGradeName);
        const matchClass = classIdsToDelete.has(d.classId);
        if (matchId || matchGrade || matchClass) {
          batch.delete(docSnap.ref);
          batchCount++;
        }
      });
    } catch (_) {}

    if (batchCount > 0) {
      await safeFirestoreWrite(batch.commit(), 4000);
    }
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

// Add Class (Instant optimistic return + real-time Firestore persistence)
export async function addClass(name: string, gradeId: string): Promise<string> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = eff.email;
  const currentSchoolCode = getSchoolCode();

  const trimmedName = name.trim();
  const localClasses = getLocalItems(CLASSES_COLL).filter(c => isDocBelongingToUser(c, uid, email));
  const existing = localClasses.find(c => c.gradeId === gradeId && c.name?.trim() === trimmedName);
  if (existing) {
    return existing.id;
  }

  const generatedId = generateLocalId("cls");
  unmarkDeletedId("classes", generatedId);
  const newClassObj = {
    id: generatedId,
    name: trimmedName,
    gradeId,
    userId: uid,
    userEmail: email,
    schoolCode: currentSchoolCode,
    createdAt: Date.now()
  };

  saveOrUpdateLocalItem(CLASSES_COLL, newClassObj);

  // Real-time server sync
  postToServerSync("/api/sync/classes", { record: newClassObj });

  // Firestore write with deterministic document ID
  const docRef = doc(db, CLASSES_COLL, generatedId);
  await safeFirestoreWrite(setDoc(docRef, newClassObj), 5000);

  return generatedId;
}

// Add Multiple Classes in a Batch (Ultra-fast atomic save)
export async function addClassesBatch(classesList: { name: string; gradeId: string }[]): Promise<{ id: string; name: string; gradeId: string }[]> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = eff.email;
  const currentSchoolCode = getSchoolCode();

  const localClasses = getLocalItems(CLASSES_COLL).filter(c => isDocBelongingToUser(c, uid, email));
  const existingKeySet = new Set<string>();
  localClasses.forEach(c => {
    if (c.name && c.gradeId) existingKeySet.add(`${c.gradeId}__${c.name.trim()}`);
  });

  const results: { id: string; name: string; gradeId: string }[] = [];
  const toCreate: { id: string; name: string; gradeId: string }[] = [];

  classesList.forEach(item => {
    const trimmed = item.name.trim();
    if (!trimmed || !item.gradeId) return;
    const key = `${item.gradeId}__${trimmed}`;
    if (existingKeySet.has(key)) {
      const match = localClasses.find(c => c.gradeId === item.gradeId && c.name?.trim() === trimmed);
      if (match) results.push({ id: match.id, name: trimmed, gradeId: item.gradeId });
    } else {
      const generatedId = generateLocalId("cls");
      const classObj = { id: generatedId, name: trimmed, gradeId: item.gradeId };
      results.push(classObj);
      toCreate.push(classObj);

      // Save locally immediately
      saveOrUpdateLocalItem(CLASSES_COLL, {
        id: generatedId,
        name: trimmed,
        gradeId: item.gradeId,
        userId: uid,
        userEmail: email,
        schoolCode: currentSchoolCode,
        createdAt: Date.now()
      });
      existingKeySet.add(key);
    }
  });

  if (toCreate.length > 0) {
    toCreate.forEach(item => unmarkDeletedId("classes", item.id));
    const fullCreated = toCreate.map(item => ({
      id: item.id,
      name: item.name,
      gradeId: item.gradeId,
      userId: uid,
      userEmail: email,
      schoolCode: currentSchoolCode,
      createdAt: Date.now()
    }));
    postToServerSync("/api/sync/classes", { records: fullCreated });

    const chunkSize = 400;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      const now = Date.now();
      chunk.forEach((c, idx) => {
        const docRef = doc(db, CLASSES_COLL, c.id);
        batch.set(docRef, {
          id: c.id,
          name: c.name,
          gradeId: c.gradeId,
          userId: uid,
          userEmail: email,
          schoolCode: currentSchoolCode,
          createdAt: now + i + idx
        });
      });
      await safeFirestoreWrite(batch.commit(), 5000);
    }
  }

  return results;
}

// Delete Class (Instant 0ms local purge + authoritative real-time Firestore cascade delete)
export async function deleteClass(id: string, gradeId?: string, className?: string): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = (eff.email || "").toLowerCase().trim();

  // 1. Find class details from local cache
  const localClasses = getLocalItems(CLASSES_COLL, uid);
  const targetClass = localClasses.find(c => c.id === id || (c._docId && c._docId === id));
  const targetGradeId = gradeId || targetClass?.gradeId;
  const targetClassName = (className || targetClass?.name)?.trim();

  // 2. Gather student IDs in this class
  const localStudents = getLocalItems(STUDENTS_COLL, uid);
  const studentIdsToDelete = new Set<string>(
    localStudents
      .filter(s => s.classId === id || (targetGradeId && targetClassName && s.gradeId === targetGradeId && s.className?.trim() === targetClassName))
      .map(s => s.id)
  );

  // Record permanent deletion tombstones
  recordDeletedId("classes", id);
  if (studentIdsToDelete.size > 0) {
    recordDeletedIds("students", Array.from(studentIdsToDelete));
  }

  // 3. Purge from ALL local storage keys immediately (0ms)
  removeLocalItemsBy(CLASSES_COLL, (c) => 
    c.id === id || 
    (c._docId && c._docId === id) || 
    (targetGradeId && targetClassName && (c.gradeId === targetGradeId || c.gradeName === targetGradeId) && c.name?.trim() === targetClassName),
    uid
  );
  removeLocalItemsBy(STUDENTS_COLL, (s) => s.classId === id || studentIdsToDelete.has(s.id), uid);

  // Real-time server sync
  postToServerSync("/api/sync/classes", { deletedIds: [id] });
  if (studentIdsToDelete.size > 0) {
    postToServerSync("/api/sync/students", { deletedIds: Array.from(studentIdsToDelete) });
  }

  // 4. Query & delete all matching docs from Firestore
  try {
    const batch = writeBatch(db);
    let batchCount = 0;

    if (id) {
      batch.delete(doc(db, CLASSES_COLL, id));
      batchCount++;
    }

    try {
      const cSnap = await getDocs(collection(db, CLASSES_COLL));
      cSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (!isDocBelongingToUser(d, uid, email)) return;
        const matchId = docSnap.id === id || d.id === id;
        const matchGradeAndName = targetGradeId && targetClassName && 
          (d.gradeId === targetGradeId || d.gradeName === targetGradeId) && 
          d.name?.trim() === targetClassName;
        if (matchId || matchGradeAndName) {
          batch.delete(docSnap.ref);
          batchCount++;
        }
      });
    } catch (_) {}

    try {
      const sSnap = await getDocs(collection(db, STUDENTS_COLL));
      sSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (!isDocBelongingToUser(d, uid, email)) return;
        const matchId = studentIdsToDelete.has(docSnap.id) || studentIdsToDelete.has(d.id) || d.classId === id;
        if (matchId) {
          batch.delete(docSnap.ref);
          batchCount++;
        }
      });
    } catch (_) {}

    if (batchCount > 0) {
      await safeFirestoreWrite(batch.commit(), 4000);
    }
  } catch (err: any) {
    handleFirestoreError(err);
  }
}

// Delete all classes for a specific grade
export async function deleteClassesForGrade(gradeId: string, gradeName?: string): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = (eff.email || "").toLowerCase().trim();
  const resolvedGradeName = gradeName?.trim();

  // 1. Find all matching classes
  const localClasses = getLocalItems(CLASSES_COLL, uid);
  const matchingClasses = localClasses.filter(c => 
    c.gradeId === gradeId || 
    (resolvedGradeName && (c.gradeId === resolvedGradeName || c.gradeName === resolvedGradeName))
  );
  const classIds = new Set<string>(matchingClasses.map(c => c.id));

  // Find all matching students
  const localStudents = getLocalItems(STUDENTS_COLL, uid);
  const matchingStudents = localStudents.filter(s =>
    s.gradeId === gradeId ||
    classIds.has(s.classId) ||
    (resolvedGradeName && s.gradeName === resolvedGradeName)
  );
  const studentIds = new Set<string>(matchingStudents.map(s => s.id));

  // Record permanent deletion tombstones
  if (classIds.size > 0) {
    recordDeletedIds("classes", Array.from(classIds));
  }
  if (studentIds.size > 0) {
    recordDeletedIds("students", Array.from(studentIds));
  }

  // 2. Local storage purge
  removeLocalItemsBy(CLASSES_COLL, (c) => 
    c.gradeId === gradeId || 
    classIds.has(c.id) || 
    (resolvedGradeName && (c.gradeId === resolvedGradeName || c.gradeName === resolvedGradeName)),
    uid
  );
  removeLocalItemsBy(STUDENTS_COLL, (s) =>
    s.gradeId === gradeId ||
    classIds.has(s.classId) ||
    studentIds.has(s.id) ||
    (resolvedGradeName && s.gradeName === resolvedGradeName),
    uid
  );

  if (classIds.size > 0) {
    postToServerSync("/api/sync/classes", { deletedIds: Array.from(classIds) });
  }
  if (studentIds.size > 0) {
    postToServerSync("/api/sync/students", { deletedIds: Array.from(studentIds) });
  }

  // 3. Firestore delete
  try {
    const batch = writeBatch(db);
    let count = 0;
    const [snapC, snapS] = await Promise.all([
      getDocs(collection(db, CLASSES_COLL)),
      getDocs(collection(db, STUDENTS_COLL))
    ]);

    snapC.forEach(docSnap => {
      const d = docSnap.data();
      if (!isDocBelongingToUser(d, uid, email)) return;
      if (classIds.has(docSnap.id) || classIds.has(d.id) || d.gradeId === gradeId || (resolvedGradeName && (d.gradeId === resolvedGradeName || d.gradeName === resolvedGradeName))) {
        batch.delete(docSnap.ref);
        count++;
      }
    });

    snapS.forEach(docSnap => {
      const d = docSnap.data();
      if (!isDocBelongingToUser(d, uid, email)) return;
      if (studentIds.has(docSnap.id) || studentIds.has(d.id) || classIds.has(d.classId) || d.gradeId === gradeId) {
        batch.delete(docSnap.ref);
        count++;
      }
    });

    if (count > 0) {
      await safeFirestoreWrite(batch.commit(), 4000);
    }
  } catch (e) {
    console.warn("Error deleting classes for grade:", e);
  }
}

// Completely purge all grades and classes
export async function deleteAllGradesAndClasses(): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;

  const localGrades = getLocalItems(GRADES_COLL, uid);
  const localClasses = getLocalItems(CLASSES_COLL, uid);
  const localStudents = getLocalItems(STUDENTS_COLL, uid);

  recordDeletedIds("grades", localGrades.map(g => g.id));
  recordDeletedIds("classes", localClasses.map(c => c.id));
  recordDeletedIds("students", localStudents.map(s => s.id));

  // Clear local storage for grades, classes, and students
  setLocalItems(GRADES_COLL, [], uid);
  setLocalItems(CLASSES_COLL, [], uid);
  setLocalItems(STUDENTS_COLL, [], uid);
  notifyCollectionSubscribers(GRADES_COLL, []);
  notifyCollectionSubscribers(CLASSES_COLL, []);
  notifyCollectionSubscribers(STUDENTS_COLL, []);

  // Server sync clear all
  postToServerSync("/api/sync/grades", { clearAll: true });
  postToServerSync("/api/sync/classes", { clearAll: true });
  postToServerSync("/api/sync/students", { clearAll: true });

  // Delete from Firestore
  try {
    const [gSnap, cSnap, sSnap] = await Promise.all([
      getDocs(collection(db, GRADES_COLL)),
      getDocs(collection(db, CLASSES_COLL)),
      getDocs(collection(db, STUDENTS_COLL))
    ]);

    const batch = writeBatch(db);
    gSnap.forEach(d => batch.delete(d.ref));
    cSnap.forEach(d => batch.delete(d.ref));
    sSnap.forEach(d => batch.delete(d.ref));
    await safeFirestoreWrite(batch.commit(), 5000);
  } catch (e) {
    console.warn("Error deleting all grades and classes:", e);
  }
}

// Restore default classes (e.g. الفصل 1 إلى الفصل 6) for a specific grade or first grade
export async function restoreGradeDefaultClasses(gradeId: string, count: number = 6): Promise<{ id: string; name: string; gradeId: string }[]> {
  const classesToAdd: { name: string; gradeId: string }[] = [];
  for (let i = 1; i <= count; i++) {
    classesToAdd.push({
      name: `الفصل ${i}`,
      gradeId
    });
  }
  return await addClassesBatch(classesToAdd);
}

// Auto-restore First Grade classes if deleted
export async function restoreFirstGradeClasses(targetGradeId?: string, count: number = 6): Promise<{ grade: Grade | null; classes: Class[] }> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = eff.email;

  let grades = await getGrades();
  let firstGrade = targetGradeId 
    ? grades.find(g => g.id === targetGradeId)
    : grades.find(g => {
        const norm = (g.name || "").trim().toLowerCase();
        return norm.includes("اول") || norm.includes("أول") || norm.includes("1");
      });

  if (!firstGrade && grades.length > 0) {
    firstGrade = grades[0];
  }

  if (!firstGrade) {
    // Create first grade if not found
    const gradeId = await addGrade("الصف الأول");
    firstGrade = { id: gradeId, name: "الصف الأول" };
  }

  const restored = await restoreGradeDefaultClasses(firstGrade.id, count);
  const allClasses = await getClasses();

  return {
    grade: firstGrade,
    classes: allClasses.filter(c => c.gradeId === firstGrade!.id)
  };
}

// Add Teacher
export async function addTeacher(name: string): Promise<string> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = eff.email;
  const currentSchoolCode = getSchoolCode();
  const generatedId = generateLocalId("tch");

  const newTeacherObj = {
    id: generatedId,
    name: name.trim(),
    userId: uid,
    userEmail: email,
    schoolCode: currentSchoolCode,
    createdAt: Date.now()
  };

  saveOrUpdateLocalItem(TEACHERS_COLL, newTeacherObj);
  postToServerSync("/api/sync/teachers", { record: newTeacherObj });

  const docRef = doc(db, TEACHERS_COLL, generatedId);
  await safeFirestoreWrite(setDoc(docRef, newTeacherObj), 5000);

  return generatedId;
}

// Add Multiple Teachers in a Batch
export async function addTeachersBatch(names: string[]): Promise<Teacher[]> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = eff.email;
  const currentSchoolCode = getSchoolCode();

  const toCreate: Teacher[] = [];
  names.forEach(name => {
    const generatedId = generateLocalId("tch");
    const item: Teacher = { id: generatedId, name: name.trim() };
    toCreate.push(item);
    saveOrUpdateLocalItem(TEACHERS_COLL, {
      id: generatedId,
      name: item.name,
      userId: uid,
      userEmail: email,
      schoolCode: currentSchoolCode,
      createdAt: Date.now()
    });
  });

  if (toCreate.length > 0) {
    const fullCreated = toCreate.map(item => ({
      id: item.id,
      name: item.name,
      userId: uid,
      userEmail: email,
      schoolCode: currentSchoolCode,
      createdAt: Date.now()
    }));
    postToServerSync("/api/sync/teachers", { records: fullCreated });

    const chunkSize = 400;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      const now = Date.now();
      chunk.forEach((t, idx) => {
        const docRef = doc(db, TEACHERS_COLL, t.id);
        batch.set(docRef, { 
          id: t.id,
          name: t.name, 
          userId: uid,
          userEmail: email,
          schoolCode: currentSchoolCode,
          createdAt: now + i + idx
        });
      });
      await safeFirestoreWrite(batch.commit(), 5000);
    }
  }

  return toCreate;
}

// Delete Teacher (Instant 0ms local purge + real-time Firestore delete)
export async function deleteTeacher(id: string): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  removeLocalItemsBy(TEACHERS_COLL, (t) => t.id === id || t._docId === id || t._origId === id, eff.uid);
  postToServerSync("/api/sync/teachers", { deletedIds: [id] });
  await safeFirestoreWrite(deleteDoc(doc(db, TEACHERS_COLL, id)), 5000);
}

// Delete Multiple Teachers in a Batch (Instant 0ms local purge + real-time Firestore delete)
export async function deleteTeachersBatch(ids: string[]): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  const idSet = new Set(ids);
  removeLocalItemsBy(TEACHERS_COLL, (t) => idSet.has(t.id) || (t._docId && idSet.has(t._docId)) || (t._origId && idSet.has(t._origId)), eff.uid);
  postToServerSync("/api/sync/teachers", { deletedIds: ids });
  const batch = writeBatch(db);
  ids.forEach(id => {
    batch.delete(doc(db, TEACHERS_COLL, id));
  });
  await safeFirestoreWrite(batch.commit(), 5000);
}

// Add Student (Deduplicates automatically by classId and normalized student name)
export async function addStudent(name: string, gradeId: string, classId: string): Promise<string> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = eff.email;
  const currentSchoolCode = getSchoolCode();
  const trimmedName = name.trim();

  // Normalize for robust duplicate checking
  const normName = trimmedName
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ");

  const localStudents = getLocalCollection<Student>(STUDENTS_COLL);
  const existing = localStudents.find(s => {
    if (s.classId !== classId) return false;
    const sNorm = (s.name || "")
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\s+/g, " ");
    return sNorm === normName;
  });

  if (existing) {
    return existing.id;
  }

  const generatedId = generateLocalId("stu");
  unmarkDeletedId("students", generatedId);

  const newStudentObj = {
    id: generatedId,
    name: trimmedName,
    gradeId,
    classId,
    userId: uid,
    userEmail: email,
    schoolCode: currentSchoolCode,
    createdAt: Date.now()
  };

  saveOrUpdateLocalItem(STUDENTS_COLL, newStudentObj);
  postToServerSync("/api/sync/students", { record: newStudentObj });

  const docRef = doc(db, STUDENTS_COLL, generatedId);
  await safeFirestoreWrite(setDoc(docRef, newStudentObj), 5000);

  return generatedId;
}

// Add Multiple Students in a Batch (Ignores duplicates, adds non-duplicates)
export async function addStudentsBatch(studentsList: { name: string, gradeId: string, classId: string }[]): Promise<Student[]> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = eff.email;
  const currentSchoolCode = getSchoolCode();

  const localStudents = getLocalCollection<Student>(STUDENTS_COLL);
  const seenClassAndNames = new Set<string>();

  localStudents.forEach(s => {
    const sNorm = (s.name || "")
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\s+/g, " ");
    seenClassAndNames.add(`${s.classId}:::${sNorm}`);
  });

  const toCreate: Student[] = [];
  studentsList.forEach(s => {
    const trimmed = s.name.trim();
    if (!trimmed) return;

    const norm = trimmed
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\s+/g, " ");

    const key = `${s.classId}:::${norm}`;
    if (seenClassAndNames.has(key)) {
      // Ignore duplicate
      return;
    }

    seenClassAndNames.add(key);
    const generatedId = generateLocalId("stu");
    const item: Student = { id: generatedId, name: trimmed, gradeId: s.gradeId, classId: s.classId };
    toCreate.push(item);
    saveOrUpdateLocalItem(STUDENTS_COLL, {
      id: generatedId,
      name: item.name,
      gradeId: item.gradeId,
      classId: item.classId,
      userId: uid,
      userEmail: email,
      schoolCode: currentSchoolCode,
      createdAt: Date.now()
    });
  });

  if (toCreate.length > 0) {
    toCreate.forEach(item => unmarkDeletedId("students", item.id));
    const fullCreated = toCreate.map(item => ({
      id: item.id,
      name: item.name,
      gradeId: item.gradeId,
      classId: item.classId,
      userId: uid,
      userEmail: email,
      schoolCode: currentSchoolCode,
      createdAt: Date.now()
    }));
    postToServerSync("/api/sync/students", { records: fullCreated });

    const chunkSize = 400;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      const now = Date.now();
      chunk.forEach((s, idx) => {
        const docRef = doc(db, STUDENTS_COLL, s.id);
        batch.set(docRef, { 
          id: s.id,
          name: s.name, 
          gradeId: s.gradeId, 
          classId: s.classId, 
          userId: uid,
          userEmail: email,
          schoolCode: currentSchoolCode,
          createdAt: now + i + idx
        });
      });
      await safeFirestoreWrite(batch.commit(), 5000);
    }
  }

  return toCreate;
}

// Delete Student (Instant 0ms local purge + real-time Firestore delete)
export async function deleteStudent(id: string): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  recordDeletedId("students", id);
  removeLocalItemsBy(STUDENTS_COLL, (s) => s.id === id || s._docId === id || s._origId === id, eff.uid);
  postToServerSync("/api/sync/students", { deletedIds: [id] });
  await safeFirestoreWrite(deleteDoc(doc(db, STUDENTS_COLL, id)), 5000);
}

// Delete Multiple Students in a Batch (Instant 0ms local purge + real-time Firestore delete)
export async function deleteStudentsBatch(ids: string[]): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  recordDeletedIds("students", ids);
  const idSet = new Set(ids);
  removeLocalItemsBy(STUDENTS_COLL, (s) => idSet.has(s.id) || (s._docId && idSet.has(s._docId)) || (s._origId && idSet.has(s._origId)), eff.uid);
  postToServerSync("/api/sync/students", { deletedIds: ids });
  const batch = writeBatch(db);
  ids.forEach(id => {
    batch.delete(doc(db, STUDENTS_COLL, id));
  });
  await safeFirestoreWrite(batch.commit(), 5000);
}

// Fetch all attendance for statistics
export async function getAllAttendanceRecords(force: boolean = false): Promise<AttendanceRecord[]> {
  return fetchAndFilterCollection(ATTENDANCE_COLL, force) as Promise<AttendanceRecord[]>;
}

// Subscribe to all attendance for real-time statistics
export function subscribeToAllAttendanceRecords(callback: (records: AttendanceRecord[]) => void, onError?: (error: any) => void) {
  return subscribeToCollection(ATTENDANCE_COLL, (data) => {
    callback(Array.isArray(data) ? data : []);
  }, onError);
}

// Fetch all behavior records for statistics
export async function getAllBehaviorRecords(force: boolean = false): Promise<BehaviorRecord[]> {
  const list = await fetchAndFilterCollection(BEHAVIORS_COLL, force);
  return Array.isArray(list) ? (list as BehaviorRecord[]) : [];
}

// Subscribe to all behavior records for real-time statistics
export function subscribeToAllBehaviorRecords(callback: (records: BehaviorRecord[]) => void, onError?: (error: any) => void) {
  return subscribeToCollection(BEHAVIORS_COLL, (data) => {
    callback(Array.isArray(data) ? data : []);
  }, onError);
}

// --- DATABASE AUTO-SEEDING ---
export async function seedDatabaseIfEmpty(): Promise<boolean> {
  return false;
}

// --- SCHOOL SETTINGS ---
export async function getSchoolName(force: boolean = false): Promise<string> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = (eff.email || "").toLowerCase().trim();
  if (!uid && !email) {
    return "";
  }
  
  if (!force && typeof window !== "undefined") {
    if (email) {
      const emailName = localStorage.getItem(`school_name_${email}`);
      if (emailName) return emailName;
    }
    if (uid) {
      const localName = localStorage.getItem(`school_name_${uid}`);
      if (localName) return localName;
    }
    const cachedName = localStorage.getItem("school_name_cache");
    if (cachedName) return cachedName;
  }

  // 0. Instant server sync check
  try {
    const sCode = getSchoolCode();
    const sq = new URLSearchParams();
    if (sCode) sq.set("schoolCode", sCode);
    if (email) sq.set("email", email);
    if (uid) sq.set("uid", uid);
    const sRes = await fetch(`/api/sync/school?${sq.toString()}`);
    if (sRes.ok) {
      const sJson = await sRes.json();
      if (sJson.success && sJson.schoolName) {
        if (typeof window !== "undefined") {
          if (email) localStorage.setItem(`school_name_${email}`, sJson.schoolName);
          if (uid) localStorage.setItem(`school_name_${uid}`, sJson.schoolName);
          localStorage.setItem("school_name_cache", sJson.schoolName);
          localStorage.setItem("school_name_cached", sJson.schoolName);
        }
        return sJson.schoolName;
      }
    }
  } catch (_) {}

  try {
    // 1. Direct document lookup for instant speed (settings_<schoolCode>, settings_<email> or settings_<uid>)
    const sCode = getSchoolCode();
    if (sCode) {
      try {
        const codeDocKey = `settings_${sCode.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const codeSnap = await getDoc(doc(db, SETTINGS_COLL, codeDocKey));
        if (codeSnap.exists() && codeSnap.data()?.schoolName) {
          const val = codeSnap.data().schoolName;
          if (typeof window !== "undefined") {
            if (email) localStorage.setItem(`school_name_${email}`, val);
            if (uid) localStorage.setItem(`school_name_${uid}`, val);
            localStorage.setItem(`school_name_${sCode}`, val);
            localStorage.setItem("school_name_cache", val);
          }
          return val;
        }
      } catch (_) {}
    }

    if (email) {
      try {
        const emailDocKey = `settings_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const emailSnap = await getDoc(doc(db, SETTINGS_COLL, emailDocKey));
        if (emailSnap.exists() && emailSnap.data()?.schoolName) {
          const val = emailSnap.data().schoolName;
          if (typeof window !== "undefined") {
            localStorage.setItem(`school_name_${email}`, val);
            if (uid) localStorage.setItem(`school_name_${uid}`, val);
            localStorage.setItem("school_name_cache", val);
          }
          return val;
        }
      } catch (_) {}
    }

    if (uid) {
      try {
        const uidSnap = await getDoc(doc(db, SETTINGS_COLL, `settings_${uid}`));
        if (uidSnap.exists() && uidSnap.data()?.schoolName) {
          const val = uidSnap.data().schoolName;
          if (typeof window !== "undefined") {
            if (email) localStorage.setItem(`school_name_${email}`, val);
            localStorage.setItem(`school_name_${uid}`, val);
            localStorage.setItem("school_name_cache", val);
          }
          return val;
        }
      } catch (_) {}

      try {
        const userSnap = await getDoc(doc(db, USERS_COLL, uid));
        if (userSnap.exists() && userSnap.data()?.schoolName) {
          const val = userSnap.data().schoolName;
          if (typeof window !== "undefined") {
            if (email) localStorage.setItem(`school_name_${email}`, val);
            localStorage.setItem(`school_name_${uid}`, val);
            localStorage.setItem("school_name_cache", val);
          }
          return val;
        }
      } catch (_) {}
    }

    // 2. Fallback scan of settings collection
    const querySnapshot = await getDocs(collection(db, SETTINGS_COLL));
    let schoolNameVal = "";
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.schoolName && isDocBelongingToUser(data, uid, email)) {
        schoolNameVal = data.schoolName;
      }
    });
    if (schoolNameVal && typeof window !== "undefined") {
      if (email) localStorage.setItem(`school_name_${email}`, schoolNameVal);
      if (uid) localStorage.setItem(`school_name_${uid}`, schoolNameVal);
      localStorage.setItem("school_name_cache", schoolNameVal);
    }
    return schoolNameVal;
  } catch (err: any) {
    handleFirestoreError(err);
    if (typeof window !== "undefined") {
      if (email) return localStorage.getItem(`school_name_${email}`) || "";
      if (uid) return localStorage.getItem(`school_name_${uid}`) || "";
      return localStorage.getItem("school_name_cache") || "";
    }
  }
  return "";
}

export async function saveSchoolName(schoolName: string): Promise<void> {
  const eff = getEffectiveUidAndEmail();
  const uid = eff.uid;
  const email = (eff.email || "").toLowerCase().trim();
  if (!uid && !email) return;

  const trimmed = schoolName.trim();
  const schoolCode = getSchoolCode();

  if (typeof window !== "undefined") {
    if (email) localStorage.setItem(`school_name_${email}`, trimmed);
    if (uid) localStorage.setItem(`school_name_${uid}`, trimmed);
    localStorage.setItem("school_name_cache", trimmed);
    localStorage.setItem("school_name_cached", trimmed);
    try {
      window.dispatchEvent(new CustomEvent("school_name_updated", { detail: trimmed }));
    } catch (_) {}
  }

  // 1. Instant local-first cache update & broadcast across tabs (0ms)
  saveOrUpdateLocalItem(SETTINGS_COLL, { schoolName: trimmed, userId: uid, userEmail: email, schoolCode, updatedAt: Date.now() }, uid);

  if (realTimeSyncChannel) {
    try {
      realTimeSyncChannel.postMessage({
        type: "school_name_updated",
        schoolName: trimmed,
        schoolCode: schoolCode || email || uid,
        ownerEmail: email,
        ownerUid: uid,
        timestamp: Date.now()
      });
    } catch (_) {}
  }

  // 2. Server synchronization (0ms cross-device real-time sync)
  postToServerSync("/api/sync/school", {
    schoolName: trimmed,
    schoolCode: schoolCode || email || uid,
    userEmail: email,
    userId: uid
  });

  // 3. Persist to Firestore
  const docKey = email ? `settings_${email.replace(/[^a-zA-Z0-9]/g, '_')}` : `settings_${uid}`;
  const docRef = doc(db, SETTINGS_COLL, docKey);
  await safeFirestoreWrite(setDoc(docRef, { schoolName: trimmed, userId: uid, userEmail: email, schoolCode, updatedAt: Date.now() }, { merge: true }), 5000);

  if (schoolCode) {
    const codeDocKey = `settings_${schoolCode.replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (codeDocKey !== docKey) {
      const codeDocRef = doc(db, SETTINGS_COLL, codeDocKey);
      await safeFirestoreWrite(setDoc(codeDocRef, { schoolName: trimmed, userId: uid, userEmail: email, schoolCode, updatedAt: Date.now() }, { merge: true }), 5000);
    }
  }

  if (uid && docKey !== `settings_${uid}`) {
    const uidDocRef = doc(db, SETTINGS_COLL, `settings_${uid}`);
    await safeFirestoreWrite(setDoc(uidDocRef, { schoolName: trimmed, userId: uid, userEmail: email, schoolCode, updatedAt: Date.now() }, { merge: true }), 5000);
  }

  if (uid) {
    try {
      const userRef = doc(db, USERS_COLL, uid);
      await setDoc(userRef, { schoolName: trimmed, schoolCode, lastLogin: Date.now() }, { merge: true });
    } catch (_) {}
  }
}

// Generic live subscription helper using collection multiplexing hub
function subscribeToCollection(colName: string, callback: (data: any[]) => void, onError?: (error: any) => void) {
  const eff = getEffectiveUidAndEmail();
  const currentUid = eff.uid || "";
  const currentEmail = (eff.email || "").toLowerCase().trim();

  if (!currentUid && !currentEmail) {
    callback([]);
    return () => {};
  }

  const hub = getCollectionHub(colName);
  const currentOwnerKey = currentEmail || currentUid;

  // If the hub was running under a different user/email, terminate the stale listener
  if (hub.ownerKey && hub.ownerKey !== currentOwnerKey) {
    if (hub.unsub) {
      try { hub.unsub(); } catch (_) {}
      hub.unsub = null;
    }
    hub.latestData = [];
  }
  hub.ownerKey = currentOwnerKey;

  // If there's a pending teardown timer, cancel it
  if (hub.cleanupTimer) {
    clearTimeout(hub.cleanupTimer);
    hub.cleanupTimer = null;
  }

  // Register callback
  hub.callbacks.add(callback);

  // 1. Immediately provide current cached state without waiting for network
  const rawLocal = getLocalItems(colName, currentUid);
  const safeLocal = Array.isArray(rawLocal) 
    ? rawLocal
        .filter(item => isDocBelongingToUser(item, currentUid, currentEmail) && !isRecordTombstoned(colName, item))
        .map(item => colName === ATTENDANCE_COLL ? sanitizeAttendanceRecord(item) : item)
    : [];
  const localList = Array.isArray(hub.latestData) && hub.latestData.length > 0 
    ? hub.latestData
        .filter(item => isDocBelongingToUser(item, currentUid, currentEmail) && !isRecordTombstoned(colName, item))
        .map(item => colName === ATTENDANCE_COLL ? sanitizeAttendanceRecord(item) : item)
    : safeLocal;
  
  if (!Array.isArray(hub.latestData) || hub.latestData.length === 0) {
    hub.latestData = localList;
  }
  try {
    callback(Array.isArray(localList) ? localList : []);
  } catch (_) {}

  // 2. Connect to Firestore singleton onSnapshot listener if not already connected
  if (!hub.unsub) {
    try {
      const q = collection(db, colName);
      hub.unsub = onSnapshot(q, (snapshot) => {
        setCloudSyncStatus("connected", "المزامنة السحابية اللحظية متصلة ونشطة");
        const activeEff = getEffectiveUidAndEmail();
        const activeUid = activeEff.uid || "";
        const activeEmail = (activeEff.email || "").toLowerCase().trim();

        if (!activeUid && !activeEmail) {
          hub.callbacks.forEach(cb => {
            try { cb([]); } catch (_) {}
          });
          return;
        }

        const results: any[] = [];
        const seenIds = new Set<string>();
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (isDocBelongingToUser(data, activeUid, activeEmail) && !seenIds.has(docSnap.id)) {
            const rawItem = { ...data, id: docSnap.id, _docId: docSnap.id, _origId: (data as any)?.id };
            if (!isRecordTombstoned(colName, rawItem)) {
              seenIds.add(docSnap.id);
              const sanitized = colName === ATTENDANCE_COLL ? sanitizeAttendanceRecord(rawItem) : rawItem;
              results.push(sanitized);
            }
          }
        });

        // Update local storage cache with authoritative snapshot
        const serialized = JSON.stringify(results);
        if (hub.latestSerialized === serialized && hub.callbacks.size > 0 && hub.lastUpdated > 0) {
          return;
        }
        hub.latestSerialized = serialized;
        hub.latestData = results;
        hub.lastUpdated = Date.now();

        setLocalItems(colName, results, activeUid);

        // Broadcast to all active subscribers of this collection
        hub.callbacks.forEach(cb => {
          try { cb(results); } catch (_) {}
        });

        // Broadcast to other tabs/windows in real time (0ms)
        if (realTimeSyncChannel) {
          try {
            realTimeSyncChannel.postMessage({
              colName,
              items: results,
              ownerEmail: activeEmail,
              ownerUid: activeUid,
              schoolCode: getSchoolCode(),
              timestamp: Date.now()
            });
          } catch (_) {}
        }
      }, (error: any) => {
        const msg = (error?.message || "").toLowerCase();
        const code = error?.code || "";
        if (code === "permission-denied" || msg.includes("permission-denied") || msg.includes("missing or insufficient permissions")) {
          setCloudSyncStatus("permission-denied", "تم رفض الإذن (Permission Denied) في Firestore. قواعد الأمان تمنع المزامنة اللحظية مع موقع كلاودفلير.");
        } else if (code === "not-found" || msg.includes("does not exist") || msg.includes("not_found")) {
          const currentId = getActiveFirestoreDatabaseId();
          const altId = currentId === "apsent-02" ? "(default)" : "apsent-02";
          console.warn(`Firestore database '${currentId}' not found in onSnapshot. Auto-switching to '${altId}'...`);
          updateActiveDb(altId);
          hub.unsub = null;
          setTimeout(() => {
            subscribeToCollection(colName, callback, onError);
          }, 300);
          return;
        }

        const eff = getEffectiveUidAndEmail();
        const activeUid = eff.uid;
        const activeEmail = eff.email;
        const fallbackRaw = getLocalItems(colName, activeUid);
        const fallbackList = Array.isArray(fallbackRaw) ? fallbackRaw.filter(item => isDocBelongingToUser(item, activeUid, activeEmail)) : [];
        hub.latestData = fallbackList;
        hub.callbacks.forEach(cb => {
          try { cb(fallbackList); } catch (_) {}
        });
        if (onError) {
          try { onError(error); } catch (_) {}
        }
      });
    } catch (err: any) {
      console.warn("Firestore subscription notice:", err);
    }
  }

  return () => {
    hub.callbacks.delete(callback);
    if (hub.callbacks.size === 0) {
      // Cooldown timer to prevent rapid connect/disconnect churning
      hub.cleanupTimer = setTimeout(() => {
        if (hub.callbacks.size === 0 && hub.unsub) {
          try { hub.unsub(); } catch (_) {}
          hub.unsub = null;
        }
      }, 30000);
    }
  };
}

// Subscribe All Grades in real-time
export function subscribeToGrades(callback: (grades: Grade[]) => void, onError?: (error: any) => void) {
  return subscribeToCollection(GRADES_COLL, (rawGrades) => {
    const safeGrades = Array.isArray(rawGrades) ? rawGrades : [];
    const result: Grade[] = [];
    const seen = new Set<string>();
    for (const g of safeGrades) {
      if (!g || !g.id || isIdDeleted("grades", g.id)) continue;
      const key = (g.name || "").replace(/[أإآ]/g, "ا").trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(g);
      }
    }
    callback(result);
  }, onError);
}

// Subscribe All Classes in real-time
export function subscribeToClasses(callback: (classes: Class[]) => void, onError?: (error: any) => void) {
  return subscribeToCollection(CLASSES_COLL, (rawClasses) => {
    const safeClasses = Array.isArray(rawClasses) ? rawClasses : [];
    const result: Class[] = [];
    const seen = new Set<string>();

    for (const c of safeClasses) {
      if (!c || !c.id || isIdDeleted("classes", c.id)) continue;
      const gradeId = CANONICAL_GRADE_MAP[c.gradeId] || c.gradeId;
      const key = `${gradeId}_${(c.name || "").trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ ...c, gradeId });
      }
    }
    callback(result);
  }, onError);
}

// Subscribe All Teachers in real-time
export function subscribeToTeachers(callback: (teachers: Teacher[]) => void, onError?: (error: any) => void) {
  return subscribeToCollection(TEACHERS_COLL, (data) => {
    const safeList = Array.isArray(data) ? data : [];
    const seen = new Set<string>();
    const uniqueTeachers: Teacher[] = [];
    for (const t of safeList) {
      if (!t || !t.id || isIdDeleted("teachers", t.id)) continue;
      const key = (t.name || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniqueTeachers.push(t);
    }
    callback(uniqueTeachers);
  }, onError);
}

// Subscribe All Students in real-time
export function subscribeToStudents(callback: (students: Student[]) => void, onError?: (error: any) => void) {
  return subscribeToCollection(STUDENTS_COLL, (data) => {
    const list = Array.isArray(data) ? data : [];
    const normalized = list.map(normalizeStudentData);
    const seenNames = new Set<string>();
    const uniqueStudents: Student[] = [];
    for (const s of normalized) {
      if (!s || !s.id || isIdDeleted("students", s.id)) continue;
      const nameKey = (s.name || "").trim().toLowerCase();
      if (!nameKey || seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);
      uniqueStudents.push(s);
    }
    callback(uniqueStudents);
  }, onError);
}

// Subscribe School Name in real-time
export function subscribeToSchoolName(callback: (schoolName: string) => void, onError?: (error: any) => void) {
  const eff = getEffectiveUidAndEmail();
  const currentUid = eff.uid;
  const currentEmail = (eff.email || "").toLowerCase().trim();
  const sCode = getSchoolCode();

  if (!currentUid && !currentEmail && !sCode) {
    callback("");
    return () => {};
  }

  let lastKnownName = "";
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const hashPart = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
    const hashParams = new URLSearchParams(hashPart);
    const urlSchool = urlParams.get("school") || hashParams.get("school") || "";

    lastKnownName = urlSchool ||
      (sCode ? localStorage.getItem(`school_name_${sCode}`) : null) ||
      (currentEmail ? localStorage.getItem(`school_name_${currentEmail}`) : null) ||
      (currentUid ? localStorage.getItem(`school_name_${currentUid}`) : null) ||
      localStorage.getItem("school_name_cached") ||
      localStorage.getItem("school_name_cache") || "";
    if (lastKnownName) callback(lastKnownName);
  }

  // Also query registered_users and settings directly for instant authoritative name
  getSchoolName().then(name => {
    if (name) {
      lastKnownName = name;
      callback(name);
    }
  }).catch(() => {});

  return subscribeToCollection(SETTINGS_COLL, (records) => {
    let schoolNameVal = "";
    records.forEach(data => {
      if (data.schoolName && isDocBelongingToUser(data, currentUid, currentEmail)) {
        schoolNameVal = data.schoolName;
      }
    });
    if (schoolNameVal) {
      lastKnownName = schoolNameVal;
      if (typeof window !== "undefined") {
        if (currentEmail) localStorage.setItem(`school_name_${currentEmail}`, schoolNameVal);
        if (currentUid) localStorage.setItem(`school_name_${currentUid}`, schoolNameVal);
        localStorage.setItem("school_name_cached", schoolNameVal);
      }
      callback(schoolNameVal);
    } else if (lastKnownName) {
      // Preserve last known valid school name, do not wipe it with empty string
      callback(lastKnownName);
    }
  }, onError);
}

// --- REGISTERED USERS SYSTEM ---

/**
 * Registers or updates a user profile when they login or state checking occurs.
 */
export async function registerUserInDb(
  user: { uid: string; email: string; displayName?: string; photoURL?: string },
  currentSchoolName: string = ""
): Promise<void> {
  if (!user || !user.uid) return;
  const email = user.email?.toLowerCase() || "";
  if (!email || user.displayName === "زائر عام") {
    // Skip registering anonymous guest user
    return;
  }

  try {
    const payload: Partial<RegisteredUser> = {
      uid: user.uid,
      email: email,
      displayName: user.displayName || email.split("@")[0],
      photoURL: user.photoURL || "",
      lastLogin: Date.now(),
      status: "نشط"
    };

    if (currentSchoolName && currentSchoolName.trim().length > 0) {
      payload.schoolName = currentSchoolName.trim();
    }

    saveOrUpdateLocalItem(USERS_COLL, {
      id: user.uid,
      ...payload
    });

    const docRef = doc(db, USERS_COLL, user.uid);
    const docSnap = await getDoc(docRef);
    
    let existingData: any = null;
    if (docSnap.exists()) {
      existingData = docSnap.data();
    }

    if (existingData?.schoolName && !payload.schoolName) {
      payload.schoolName = existingData.schoolName;
    }
    if (existingData?.status) {
      payload.status = existingData.status;
    }
    if (existingData?.createdAt) {
      payload.createdAt = existingData.createdAt;
    } else {
      payload.createdAt = Date.now();
    }

    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    // Handled safely without noisy console errors
  }
}

/**
 * Loads all registered users from Firestore and retrieves statistics/counts of their database items
 */
export async function getRegisteredUsers(): Promise<RegisteredUser[]> {
  try {
    const users: RegisteredUser[] = [];
    const seenUids = new Set<string>();

    if (isQuotaExhausted()) {
      const cachedUsers = getLocalItems(USERS_COLL);
      cachedUsers.forEach(u => {
        if (u && u.uid && !seenUids.has(u.uid)) {
          seenUids.add(u.uid);
          users.push(u);
        }
      });
      if (users.length === 0) {
        const eff = getEffectiveUidAndEmail();
        if (eff && eff.uid) {
          const userSchoolName = (typeof window !== "undefined" 
            ? ((eff.email ? localStorage.getItem(`school_name_${eff.email}`) : null) || localStorage.getItem(`school_name_${eff.uid}`)) 
            : "") || "";
          users.push({
            id: eff.uid,
            uid: eff.uid,
            email: eff.email || "",
            displayName: activeUserProxy?.displayName || "مدير المدرسة الحالي",
            photoURL: "",
            lastLogin: Date.now(),
            createdAt: Date.now(),
            schoolName: userSchoolName,
            status: "نشط"
          });
        }
      }
      return users;
    }

    try {
      const querySnapshot = await getDocs(collection(db, USERS_COLL));
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const uid = data.uid || docSnap.id;
        if (uid && !seenUids.has(uid)) {
          seenUids.add(uid);
          users.push({
            id: docSnap.id,
            uid: uid,
            email: data.email || "",
            displayName: data.displayName || "مستخدم مسجل",
            photoURL: data.photoURL || "",
            lastLogin: data.lastLogin || Date.now(),
            createdAt: data.createdAt || Date.now(),
            schoolName: data.schoolName || "",
            status: data.status || "نشط"
          });
        }
      });
    } catch (permErr: any) {
      handleFirestoreError(permErr);
      // If Firestore security rules restrict reading USERS_COLL or quota is exhausted, read from local cache
      const cachedUsers = getLocalItems(USERS_COLL);
      cachedUsers.forEach(u => {
        if (u && u.uid && !seenUids.has(u.uid)) {
          seenUids.add(u.uid);
          users.push(u);
        }
      });
    }

    // If still empty, add current active user if available
    if (users.length === 0) {
      const eff = getEffectiveUidAndEmail();
      if (eff && eff.uid) {
        const userSchoolName = (typeof window !== "undefined" 
          ? ((eff.email ? localStorage.getItem(`school_name_${eff.email}`) : null) || localStorage.getItem(`school_name_${eff.uid}`)) 
          : "") || "";
        users.push({
          id: eff.uid,
          uid: eff.uid,
          email: eff.email || "",
          displayName: activeUserProxy?.displayName || "مدير المدرسة الحالي",
          photoURL: "",
          lastLogin: Date.now(),
          createdAt: Date.now(),
          schoolName: userSchoolName,
          status: "نشط"
        });
      }
    }

    // Count statistics safely
    const userStatsMap: Record<string, { grades: number; classes: number; teachers: number; students: number }> = {};
    const incrementStat = (userId: string, email: string, statType: "grades" | "classes" | "teachers" | "students") => {
      const key = userId || email?.toLowerCase();
      if (!key) return;
      if (!userStatsMap[key]) {
        userStatsMap[key] = { grades: 0, classes: 0, teachers: 0, students: 0 };
      }
      userStatsMap[key][statType]++;
    };

    try {
      const [allGrades, allClasses, allTeachers, allStudents] = await Promise.all([
        getDocs(collection(db, GRADES_COLL)).catch(() => null),
        getDocs(collection(db, CLASSES_COLL)).catch(() => null),
        getDocs(collection(db, TEACHERS_COLL)).catch(() => null),
        getDocs(collection(db, STUDENTS_COLL)).catch(() => null)
      ]);

      if (allGrades) {
        allGrades.forEach(d => {
          const data = d.data();
          incrementStat(data.userId, data.userEmail, "grades");
        });
      }
      if (allClasses) {
        allClasses.forEach(d => {
          const data = d.data();
          incrementStat(data.userId, data.userEmail, "classes");
        });
      }
      if (allTeachers) {
        allTeachers.forEach(d => {
          const data = d.data();
          incrementStat(data.userId, data.userEmail, "teachers");
        });
      }
      if (allStudents) {
        allStudents.forEach(d => {
          const data = d.data();
          incrementStat(data.userId, data.userEmail, "students");
        });
      }
    } catch {
      // Safe fallback if collections cannot be enumerated
    }

    // Map counts back to each user
    users.forEach(u => {
      const statsByUid = userStatsMap[u.uid];
      const statsByEmail = userStatsMap[u.email?.toLowerCase()];
      const combinedStats = statsByUid || statsByEmail || { grades: 0, classes: 0, teachers: 0, students: 0 };
      
      u.gradesCount = combinedStats.grades;
      u.classesCount = combinedStats.classes;
      u.teachersCount = combinedStats.teachers;
      u.studentsCount = combinedStats.students;
    });

    // Sort by registration date descending (newest first)
    return users.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    return [];
  }
}

/**
 * Updates a user's account status (e.g. Suspend or Activate)
 */
export async function updateUserStatus(uid: string, status: "نشط" | "موقوف"): Promise<void> {
  try {
    const docRef = doc(db, USERS_COLL, uid);
    await setDoc(docRef, { status }, { merge: true });
  } catch (err) {
    console.error("Error updating user status:", err);
    throw err;
  }
}

/**
 * Deletes a registered user from the directory, and optionally wipes all their school data entirely.
 */
export async function deleteRegisteredUser(uid: string, email: string, wipeSchoolData: boolean = false): Promise<void> {
  try {
    // 1. Delete user registration document
    await deleteDoc(doc(db, USERS_COLL, uid));

    // 2. If wipe is requested, find and delete all associated records across ALL collections
    if (wipeSchoolData) {
      const batch = writeBatch(db);
      const emailLower = email?.toLowerCase() || "";

      const collectionsToClear = [
        GRADES_COLL,
        CLASSES_COLL,
        TEACHERS_COLL,
        STUDENTS_COLL,
        ATTENDANCE_COLL,
        BEHAVIORS_COLL,
        MORNING_DELAYS_COLL,
        SETTINGS_COLL
      ];

      for (const colName of collectionsToClear) {
        const snap = await getDocs(collection(db, colName));
        snap.forEach(docSnap => {
          const data = docSnap.data();
          let belongs = false;

          if (data.userId === uid) belongs = true;
          else if (data.userEmail && data.userEmail.toLowerCase() === emailLower) belongs = true;

          if (belongs) {
            batch.delete(docSnap.ref);
          }
        });
      }

      await batch.commit();
    }
  } catch (err) {
    console.error("Error deleting registered user and wiping data:", err);
    throw err;
  }
}

/**
 * Completely and permanently purges ALL server data, disk cache files, Firestore documents,
 * and temporary local caches across ALL collections and storage layers.
 */
export async function purgeAllServerAndTemporaryData(preserveSuperAdmin: boolean = true): Promise<{ deletedCount: number }> {
  let deletedCount = 0;
  const collectionsToClear = [
    GRADES_COLL,
    CLASSES_COLL,
    TEACHERS_COLL,
    STUDENTS_COLL,
    ATTENDANCE_COLL,
    BEHAVIORS_COLL,
    MORNING_DELAYS_COLL,
    SETTINGS_COLL,
    "student_passwords"
  ];

  if (!preserveSuperAdmin) {
    collectionsToClear.push(USERS_COLL);
  }

  // 1. Permanently wipe Node.js Express server memory caches and disk JSON files
  try {
    const sCode = getSchoolCode();
    const eff = getEffectiveUidAndEmail();
    await fetch("/api/sync/purge-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolCode: sCode,
        userEmail: eff.email,
        userId: eff.uid,
        purgeAllGlobally: true
      })
    });

    const clearPayload = { clearAll: true, schoolCode: sCode, userEmail: eff.email, userId: eff.uid };
    await Promise.allSettled([
      fetch("/api/sync/grades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clearPayload) }),
      fetch("/api/sync/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clearPayload) }),
      fetch("/api/sync/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clearPayload) }),
      fetch("/api/sync/teachers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clearPayload) }),
      fetch("/api/sync/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clearPayload) }),
      fetch("/api/sync/delays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clearPayload) }),
      fetch("/api/sync/behaviors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clearPayload) }),
      fetch("/api/sync/school", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clearPayload) })
    ]);
  } catch (e) {
    console.warn("Error calling server sync purge endpoints:", e);
  }

  // 2. Permanently delete all documents from Firestore (both active DB and (default) database if different)
  const dbsToClean: any[] = [db];
  try {
    const activeDbId = getActiveFirestoreDatabaseId();
    if (activeDbId && activeDbId !== "(default)") {
      const defaultDb = getDbForDatabaseId("(default)");
      if (defaultDb) dbsToClean.push(defaultDb);
    }
  } catch (_) {}

  for (const targetDb of dbsToClean) {
    for (const colName of collectionsToClear) {
      try {
        const snap = await getDocs(collection(targetDb, colName));
        if (!snap.empty) {
          const docs = snap.docs;
          const chunkSize = 400;
          for (let i = 0; i < docs.length; i += chunkSize) {
            const chunk = docs.slice(i, i + chunkSize);
            const batch = writeBatch(targetDb);
            chunk.forEach(d => {
              batch.delete(d.ref);
              deletedCount++;
            });
            await safeFirestoreWrite(batch.commit(), 5000);
          }
        }
      } catch (e) {
        console.warn(`Error purging collection ${colName} from Firestore:`, e);
      }
    }
  }

  // 3. Clear all local browser storage caches & cached identifiers
  if (typeof window !== "undefined") {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith("school_") ||
          key.startsWith("user_alias_") ||
          key.startsWith("own_school_") ||
          key.startsWith("last_active_") ||
          key.startsWith("firestore_quota_") ||
          key === "registered_school_code" ||
          key === "school_name_cached" ||
          key === "school_name_cache" ||
          key === "linked_school_owner_id" ||
          key === "school_unique_code" ||
          key === DELETED_ENTITIES_KEY
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }

  // 4. Reset in-memory collection hubs and notify all subscribers with empty array
  collectionsToClear.forEach(colName => {
    setLocalItems(colName, []);
  });
  collectionHubs.forEach((hub, colName) => {
    hub.latestData = [];
    hub.lastUpdated = Date.now();
    hub.callbacks.forEach(cb => {
      try { cb([]); } catch (_) {}
    });
  });

  // 5. Broadcast instant clear to all other tabs and windows
  if (realTimeSyncChannel) {
    try {
      collectionsToClear.forEach(colName => {
        realTimeSyncChannel?.postMessage({
          colName,
          items: [],
          timestamp: Date.now()
        });
      });
      realTimeSyncChannel.postMessage({
        type: "purge_all",
        timestamp: Date.now()
      });
    } catch (_) {}
  }

  // 6. Trigger stats refresh event across the window
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("school_refresh_stats"));
    }
  } catch (_) {}

  return { deletedCount };
}

/**
 * Scans for and removes any orphaned temporary/deleted records (attendance/behaviors/delays referring to deleted students or classes)
 */
export async function purgeDeletedAndOrphanedData(): Promise<{ purgedCount: number }> {
  let purgedCount = 0;
  try {
    const [gradesSnap, classesSnap, studentsSnap, teachersSnap, attSnap, behSnap, delaySnap] = await Promise.all([
      getDocs(collection(db, GRADES_COLL)),
      getDocs(collection(db, CLASSES_COLL)),
      getDocs(collection(db, STUDENTS_COLL)),
      getDocs(collection(db, TEACHERS_COLL)),
      getDocs(collection(db, ATTENDANCE_COLL)),
      getDocs(collection(db, BEHAVIORS_COLL)),
      getDocs(collection(db, MORNING_DELAYS_COLL))
    ]);

    const validGradeIds = new Set(gradesSnap.docs.map(d => d.id));
    const validClassIds = new Set(classesSnap.docs.map(d => d.id));
    const validStudentIds = new Set(studentsSnap.docs.map(d => d.id));

    const batch = writeBatch(db);
    let batchOperations = 0;

    // Check attendance records
    attSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if ((data.gradeId && !validGradeIds.has(data.gradeId)) || (data.classId && !validClassIds.has(data.classId))) {
        batch.delete(docSnap.ref);
        purgedCount++;
        batchOperations++;
      }
    });

    // Check behavior records
    behSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.studentId && !validStudentIds.has(data.studentId)) {
        batch.delete(docSnap.ref);
        purgedCount++;
        batchOperations++;
      }
    });

    // Check morning delays
    delaySnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.studentId && !validStudentIds.has(data.studentId)) {
        batch.delete(docSnap.ref);
        purgedCount++;
        batchOperations++;
      }
    });

    if (batchOperations > 0) {
      await batch.commit();
    }
  } catch (e) {
    console.warn("Error purging orphaned data:", e);
  }
  return { purgedCount };
}



