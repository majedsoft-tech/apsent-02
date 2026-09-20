export interface Grade {
  id: string;
  name: string;
  createdAt?: any;
  schoolCode?: string;
}

export interface Class {
  id: string;
  name: string;
  gradeId: string;
  schoolCode?: string;
}

export interface Teacher {
  id: string;
  name: string;
  schoolCode?: string;
}

export interface Student {
  id: string;
  name: string;
  gradeId: string;
  classId: string;
  schoolCode?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  period: string; // e.g., "حصة 1", "حصة 2", ...
  gradeId: string;
  classId: string;
  teacherId: string;
  teacherName?: string;
  present: string[]; // List of Student IDs
  absent: string[];  // List of Student IDs
  late?: string[];   // List of Student IDs
  excused?: string[]; // List of excused absent Student IDs
  excuseReasons?: Record<string, string>; // mapping studentId to excuse reason
  studentNames?: Record<string, string>; // mapping studentId to studentName
  isNoAbsence: boolean;
  timestamp: any;
  userId?: string;
  userEmail?: string;
  schoolCode?: string;
}

export interface BehaviorRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  period: string;
  teacherId: string;
  teacherName: string;
  violation: string;
  timestamp: any;
  updatedAt?: any;
  userId?: string;
  userEmail?: string;
  schoolCode?: string;
}

export interface MorningDelayRecord {
  id: string;
  studentId: string;
  studentName?: string;
  gradeId: string;
  gradeName?: string;
  classId: string;
  className?: string;
  date: string; // YYYY-MM-DD
  arrivalTime: string; // e.g. "07:15 ص" or "07:30"
  delayMinutes?: number;
  reason: string; // e.g. "عذر مقبول", "بدون عذر", "أزمة مواصلات", "نوم", "ظروف أسرية"
  recordedBy: string; // اسم المناوب / المشرف
  notes?: string;
  timestamp: any;
  updatedAt?: any;
  userId?: string;
  userEmail?: string;
  schoolCode?: string;
}

export interface RegisteredUser {
  id: string; // corresponds to uid
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  lastLogin: number;
  createdAt: number;
  schoolName: string;
  schoolCode?: string;
  status: "نشط" | "موقوف";
  // Counters for display
  gradesCount?: number;
  classesCount?: number;
  teachersCount?: number;
  studentsCount?: number;
}

