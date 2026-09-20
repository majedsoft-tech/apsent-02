import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Grade, Class, Teacher, Student, AttendanceRecord, BehaviorRecord, MorningDelayRecord } from "../types";
import { 
  addGrade, 
  addGradesBatch,
  deleteGrade, 
  addClass, 
  addClassesBatch,
  deleteClass, 
  deleteClassesForGrade,
  deleteAllGradesAndClasses,
  addTeacher, 
  deleteTeacher, 
  deleteTeachersBatch,
  addStudent, 
  deleteStudent,
  deleteStudentsBatch,
  getAllAttendanceRecords,
  deleteAttendanceRecord,
  deleteAttendanceEntry,
  getAllBehaviorRecords,
  deleteBehaviorRecord,
  getAllMorningDelayRecords,
  deleteMorningDelayRecord,
  updateMorningDelayReason,
  updateAttendanceAbsenceExcuse,
  addStudentsBatch,
  addTeachersBatch,
  subscribeToAllAttendanceRecords,
  subscribeToAllBehaviorRecords,
  subscribeToAllMorningDelayRecords,
  purgeAllServerAndTemporaryData,
  purgeDeletedAndOrphanedData,
  getLocalCollection,
  downloadSchoolBackupFile,
  importSchoolBackupData,
  testCloudFirestoreConnection,
  syncAllLocalDataToFirestore
} from "../dbService";
import { FirebaseDiagnosticModal } from "./FirebaseDiagnosticModal";
import { 
  Lock, 
  Unlock, 
  Trash2, 
  Plus, 
  Users, 
  UserPlus, 
  GraduationCap, 
  BarChart3, 
  Calendar, 
  ShieldAlert, 
  Search, 
  Briefcase, 
  RefreshCw,
  UploadCloud,
  FileSpreadsheet,
  X,
  Check,
  Settings,
  Layers,
  AlertCircle,
  Key,
  Loader2,
  Download,
  Upload,
  CloudLightning
} from "lucide-react";

interface AdminPanelProps {
  grades: Grade[];
  classes: Class[];
  teachers: Teacher[];
  students: Student[];
  setGrades: React.Dispatch<React.SetStateAction<Grade[]>>;
  setClasses: React.Dispatch<React.SetStateAction<Class[]>>;
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  onRefreshData: () => Promise<void>;
  activeSubTab?: "stats" | "grades" | "teachers" | "students";
  setActiveSubTab?: (tab: "stats" | "grades" | "teachers" | "students") => void;
  isReadOnly?: boolean;
  onTodayStatsChange?: (stats: { absentCount: number; behaviorCount: number }) => void;
  schoolName?: string;
  onSchoolNameChange?: (name: string) => void;
  isSavingSchoolName?: boolean;
  globalProgress?: { active: boolean; type: "save" | "load" | "delete" | "import" | null; label: string };
  setGlobalProgress?: React.Dispatch<React.SetStateAction<{ active: boolean; type: "save" | "load" | "delete" | "import" | null; label: string }>>;
  isGoogleAuthenticated?: boolean;
  onRequireGoogleLogin?: () => void;
}

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayFormattedArabic = () => {
  const d = new Date();
  const weekday = d.toLocaleDateString('ar-SA', { weekday: 'long' });
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${weekday} ${year}/${month}/${day}`;
};

const getFormattedArabicDate = (dateStr?: string): string => {
  if (!dateStr) return getTodayFormattedArabic();
  try {
    const parts = dateStr.trim().split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const weekday = d.toLocaleDateString('ar-SA', { weekday: 'long' });
        return `${weekday} ${year}/${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
      }
    }
  } catch (_) {}
  return dateStr;
};

const normalizeArabic = (str: string): string => {
  if (!str) return "";
  return str
    .replace(/[أإآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ةه]/g, "ه")
    .trim();
};

const getClassCode = (clsName: string) => {
  if (!clsName) return "ف1";
  // If clsName is a long ID or timestamp (contains > 4 digits or ID prefixes)
  if (typeof clsName === "string" && (clsName.length > 10 || /^\d{4,}$/.test(clsName.trim()) || clsName.startsWith("temp_") || clsName.startsWith("class_"))) {
    return "ف1";
  }
  let name = clsName.replace("الفصل ", "ف").trim();
  const norm = normalizeArabic(name);
  if (norm.includes(normalizeArabic("الأول"))) return "ف1";
  if (norm.includes(normalizeArabic("الثاني"))) return "ف2";
  if (norm.includes(normalizeArabic("الثالث"))) return "ف3";
  if (norm.includes(normalizeArabic("الرابع"))) return "ف4";
  if (norm.includes(normalizeArabic("الخامس"))) return "ف5";
  if (norm.includes(normalizeArabic("السادس"))) return "ف6";
  if (norm.includes(normalizeArabic("السابع"))) return "ف7";
  if (norm.includes(normalizeArabic("الثامن"))) return "ف8";
  if (norm.includes(normalizeArabic("التاسع"))) return "ف9";
  if (norm.includes(normalizeArabic("العاشر"))) return "ف10";
  
  const match = name.match(/\b([1-9]|[1-4][0-9]|50)\b/);
  if (match) return `ف${match[0]}`;
  
  const anyDigits = name.match(/\d+/);
  if (anyDigits && anyDigits[0].length <= 2) {
    return `ف${anyDigits[0]}`;
  }
  return name.length > 5 ? "ف1" : name;
};

const getPeriodNum = (code: string) => {
  if (!code) return "1";
  if (code === "صباحي" || code === "ص" || code === "طابور" || code.includes("صباح")) return "صباحي";
  const match = code.match(/\d+/);
  if (match) return match[0];
  const norm = normalizeArabic(code);
  if (norm.includes("اول") || norm.includes("1")) return "1";
  if (norm.includes("ثاني") || norm.includes("2")) return "2";
  if (norm.includes("ثالث") || norm.includes("3")) return "3";
  if (norm.includes("رابع") || norm.includes("4")) return "4";
  if (norm.includes("خامس") || norm.includes("5")) return "5";
  if (norm.includes("سادس") || norm.includes("6")) return "6";
  if (norm.includes("سابع") || norm.includes("7")) return "7";
  return code;
};

const getPeriodCode = (p: string): string => {
  if (!p) return "ح1";
  const map: Record<string, string> = {
    "الأولى": "ح1",
    "الثانية": "ح2",
    "الثالثة": "ح3",
    "الرابعة": "ح4",
    "الخامسة": "ح5",
    "السادسة": "ح6",
    "السابعة": "ح7",
    "حصة 1": "ح1",
    "حصة 2": "ح2",
    "حصة 3": "ح3",
    "حصة 4": "ح4",
    "حصة 5": "ح5",
    "حصة 6": "ح6",
    "حصة 7": "ح7"
  };
  if (map[p]) return map[p];
  const num = getPeriodNum(p);
  if (num && num !== "صباحي" && !isNaN(parseInt(num, 10))) return `ح${num}`;
  return p.startsWith("ح") ? p : `ح${p}`;
};

const getClassNum = (code: string) => {
  if (!code || code === "-") return "1";
  if (typeof code === "string" && (code.length > 8 || /^\d{4,}$/.test(code.trim()) || code.startsWith("temp_") || code.startsWith("class_"))) {
    return "1";
  }
  const match = code.match(/\b([1-9]|[1-4][0-9]|50)\b/);
  if (match) return match[0];
  const anyDigits = code.match(/\d+/);
  if (anyDigits && anyDigits[0].length <= 2) return anyDigits[0];
  const clean = code.replace(/^ف/, "");
  return clean.length > 4 ? "1" : (clean || "1");
};

const getPeriodBadgeStyles = (num: string) => {
  if (num === "صباحي" || num === "ص" || num === "طابور") {
    return "bg-amber-100 text-amber-900 border-amber-300 font-black";
  }
  switch (num) {
    case "1":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "2":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "3":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "4":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "5":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "6":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "7":
      return "bg-teal-100 text-teal-800 border-teal-200";
    default:
      return "bg-violet-100 text-violet-800 border-violet-200";
  }
};

const getClassBadgeStyles = (num: string) => {
  const cleanNum = num ? num.replace(/\D/g, '') : "1";
  switch (cleanNum) {
    case "1":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "2":
      return "bg-cyan-100 text-cyan-800 border-cyan-200";
    case "3":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "4":
      return "bg-lime-100 text-lime-800 border-lime-200";
    case "5":
      return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200";
    case "6":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "7":
      return "bg-violet-100 text-violet-800 border-violet-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
};

const normalizeStudentName = (name: string): string => {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ");
};

export default function AdminPanel({ 
  grades, 
  classes, 
  teachers, 
  students, 
  setGrades,
  setClasses,
  setTeachers,
  setStudents,
  onRefreshData,
  activeSubTab: propActiveSubTab,
  setActiveSubTab: propSetActiveSubTab,
  isReadOnly = false,
  onTodayStatsChange,
  schoolName,
  onSchoolNameChange,
  isSavingSchoolName = false,
  globalProgress,
  setGlobalProgress,
  isGoogleAuthenticated = true,
  onRequireGoogleLogin
}: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [pin, setPin] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");

  // Custom Confirmation Dialog State
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const confirmAction = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmState({ title, message, onConfirm });
  };

  // Sub-tabs management
  const [localActiveSubTab, setLocalActiveSubTab] = useState<"stats" | "grades" | "teachers" | "students">("stats");
  const activeSubTab = propActiveSubTab !== undefined ? propActiveSubTab : localActiveSubTab;
  const setActiveSubTab = propSetActiveSubTab !== undefined ? propSetActiveSubTab : setLocalActiveSubTab;

  const [activeStatsTab, setActiveStatsTab] = useState<"attendance" | "morning_delay" | "selected_attendance" | "student_report">("attendance");
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>(getTodayDateString());
  const [attendanceViewMode, setAttendanceViewMode] = useState<"list" | "grid">("list");
  const [hasNewBehavior, setHasNewBehavior] = useState<boolean>(false);
  const [newBehaviorIds, setNewBehaviorIds] = useState<string[]>([]);
  const [behaviorSearchFilter, setBehaviorSearchFilter] = useState<string>("");
  const [behaviorDateFilter, setBehaviorDateFilter] = useState<string>("all");

  // States for "التأخر الصباحي" (Morning Delay Tab)
  const [morningDelaysList, setMorningDelaysList] = useState<MorningDelayRecord[]>([]);
  const [delayDateFilter, setDelayDateFilter] = useState<string>(getTodayDateString());
  const [delaySearchFilter, setDelaySearchFilter] = useState<string>("");
  const [delayGradeFilter, setDelayGradeFilter] = useState<string>("all");
  const [delayClassFilter, setDelayClassFilter] = useState<string>("all");

  const [showFirebaseDiagModal, setShowFirebaseDiagModal] = useState<boolean>(false);

  const getStoredSeenBehaviorIds = (): Set<string> => {
    try {
      const raw = localStorage.getItem("school_seen_behavior_ids");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (e) {
      console.error("Error reading seen_behavior_ids:", e);
    }
    return new Set();
  };

  const saveStoredSeenBehaviorIds = (ids: Set<string>) => {
    try {
      localStorage.setItem("school_seen_behavior_ids", JSON.stringify(Array.from(ids)));
    } catch (e) {
      console.error("Error saving seen_behavior_ids:", e);
    }
  };

  const seenBehaviorIdsRef = useRef<Set<string>>(getStoredSeenBehaviorIds());
  const initialBehaviorsLoadedRef = useRef<boolean>(false);
  const activeStatsTabRef = useRef(activeStatsTab);

  useEffect(() => {
    activeStatsTabRef.current = activeStatsTab;
  }, [activeStatsTab]);

  const [todayStats, setTodayStats] = useState({
    absentCount: 0,
    behaviorCount: 0,
    grade1Entries: [] as any[],
    grade2Entries: [] as any[],
    grade3Entries: [] as any[],
    entriesByGrade: {} as Record<string, any[]>
  });

  // States for student report tab
  const [reportGradeId, setReportGradeId] = useState<string>("");
  const [reportClassId, setReportClassId] = useState<string>("");
  const [reportStudentId, setReportStudentId] = useState<string>("");
  const [studentReportData, setStudentReportData] = useState<{
    attendanceRate: number;
    absentCount: number;
    lateCount: number;
    behaviors: any[];
    history: { date: string; period: string; status: string; teacher: string }[];
  } | null>(null);

  // States for "غياب محدد" (Specific Absence Search)
  const [searchGradeId, setSearchGradeId] = useState<string>("");
  const [searchClassId, setSearchClassId] = useState<string>("");
  const [searchDate, setSearchDate] = useState<string>(getTodayDateString());
  const [searchAttendanceResult, setSearchAttendanceResult] = useState<any[]>([]);

  // Unified Student/Grade/Class selectors
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [showStructureManager, setShowStructureManager] = useState<boolean>(false);
  const [showAddStudentSection, setShowAddStudentSection] = useState<boolean>(false);

  // Student passwords local state (persisted in localStorage)
  const [studentPasswords, setStudentPasswords] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem("student_passwords");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    const saved = localStorage.getItem("onboarding_guide_visible");
    return saved !== "false";
  });

  const [temporaryGlow, setTemporaryGlow] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setTemporaryGlow(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("student_passwords", JSON.stringify(studentPasswords));
  }, [studentPasswords]);

  const handleUpdatePassword = (studentId: string, value: string) => {
    setStudentPasswords(prev => ({
      ...prev,
      [studentId]: value
    }));
  };

  const handleAutoGeneratePasswords = () => {
    const currentClassStudents = students.filter(s => s.classId === selectedClassId);
    if (currentClassStudents.length === 0) {
      showMessage("لا يوجد طلاب في هذا الفصل لتوليد كلمات مرور لهم.", "error");
      return;
    }
    
    setStudentPasswords(prev => {
      const updated = { ...prev };
      currentClassStudents.forEach(st => {
        if (!updated[st.id]) {
          const rand = Math.floor(1000 + Math.random() * 9000).toString();
          updated[st.id] = rand;
        }
      });
      return updated;
    });
    showMessage("تم توليد كلمات مرور تلقائية بنجاح للطلاب الذين لم يمتلكوا واحدة بعد! 🔑");
  };

  const handleClearAllPasswords = () => {
    confirmAction(
      "مسح كلمات المرور",
      "هل أنت متأكد من رغبتك في مسح كافة كلمات المرور لطلاب هذا الفصل؟ لا يمكن التراجع عن هذا الإجراء.",
      () => {
        const currentClassStudents = students.filter(s => s.classId === selectedClassId);
        setStudentPasswords(prev => {
          const updated = { ...prev };
          currentClassStudents.forEach(st => {
            delete updated[st.id];
          });
          return updated;
        });
        showMessage("تم مسح كلمات مرور طلاب هذا الفصل بنجاح.");
      }
    );
  };

  // Sync selected grade
  useEffect(() => {
    if (grades.length > 0) {
      if (!selectedGradeId || !grades.some(g => g.id === selectedGradeId)) {
        setSelectedGradeId(grades[0].id);
      }
    } else {
      setSelectedGradeId("");
    }
  }, [grades, selectedGradeId]);

  // Sync selected class
  useEffect(() => {
    if (selectedGradeId) {
      const gradeClasses = classes.filter(c => c.gradeId === selectedGradeId);
      if (gradeClasses.length > 0) {
        if (!selectedClassId || !gradeClasses.some(c => c.id === selectedClassId)) {
          setSelectedClassId(gradeClasses[0].id);
        }
      } else {
        setSelectedClassId("");
      }
    } else {
      setSelectedClassId("");
    }
  }, [selectedGradeId, classes, selectedClassId]);

  // Manual input states
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);

  // Reset student selection when class changes
  useEffect(() => {
    setSelectedStudentIds([]);
  }, [selectedClassId]);

  // Reset teacher selection when tab changes
  useEffect(() => {
    setSelectedTeacherIds([]);
  }, [activeSubTab]);

  const [newGradeName, setNewGradeName] = useState<string>("");
  const [newClassName, setNewClassName] = useState<string>("");
  const [newClassGradeId, setNewClassGradeId] = useState<string>("");
  const [newTeacherName, setNewTeacherName] = useState<string>("");
  const [newStudentName, setNewStudentName] = useState<string>("");
  const [newStudentGradeId, setNewStudentGradeId] = useState<string>("");
  const [newStudentClassId, setNewStudentClassId] = useState<string>("");
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>("");
  const [teacherSearchQuery, setTeacherSearchQuery] = useState<string>("");

  // Sync manual input targets with active selections for student forms
  useEffect(() => {
    if (selectedGradeId) {
      setNewStudentGradeId(selectedGradeId);
    }
  }, [selectedGradeId]);

  useEffect(() => {
    if (selectedClassId) {
      setNewStudentClassId(selectedClassId);
    }
  }, [selectedClassId]);

  // Visual customizer states for Grades & Classes (screenshot matching)
  const [selectedGradeIdForClasses, setSelectedGradeIdForClasses] = useState<string>("");
  const [selectedClassNumber, setSelectedClassNumber] = useState<number>(1);
  const [selectedClassNumbers, setSelectedClassNumbers] = useState<number[]>([1]);
  const [newGradeClassNumbers, setNewGradeClassNumbers] = useState<number[]>([]);

  // Addition methods / modes (Individual form vs attached file Excel)
  const [studentAddMode, setStudentAddMode] = useState<"individual" | "excel">("individual");
  const [teacherAddMode, setTeacherAddMode] = useState<"individual" | "excel">("excel");
  const [gradesAddMode, setGradesAddMode] = useState<"individual" | "excel">("individual");

  const [hasClickedStudentSwitcher, setHasClickedStudentSwitcher] = useState<boolean>(false);
  const [hasClickedTeacherSwitcher, setHasClickedTeacherSwitcher] = useState<boolean>(false);

  useEffect(() => {
    setHasClickedStudentSwitcher(false);
    setHasClickedTeacherSwitcher(false);
  }, [activeSubTab]);

  useEffect(() => {
    if (!selectedGradeIdForClasses) {
      setSelectedClassNumbers([]);
      return;
    }
    const gradeClasses = classes.filter(c => c.gradeId === selectedGradeIdForClasses);
    if (gradeClasses.length > 0) {
      const numbers = gradeClasses.map(c => {
        const match = c.name.match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
      }).filter((num): num is number => num !== null);
      
      const uniqueNumbers = Array.from(new Set(numbers)).sort((a, b) => a - b);
      setSelectedClassNumbers(uniqueNumbers);
    } else {
      setSelectedClassNumbers([]);
    }
  }, [selectedGradeIdForClasses, classes]);

  // Copy and Paste text state
  const [pastedStudentsText, setPastedStudentsText] = useState<string>("");
  const [pastedTeachersText, setPastedTeachersText] = useState<string>("");

  // Drag and Drop files state
  const [attachedStudentFile, setAttachedStudentFile] = useState<File | null>(null);
  const [parsedStudentNames, setParsedStudentNames] = useState<string[]>([]);
  const [isStudentDragging, setIsStudentDragging] = useState<boolean>(false);

  const [attachedTeacherFile, setAttachedTeacherFile] = useState<File | null>(null);
  const [parsedTeacherNames, setParsedTeacherNames] = useState<string[]>([]);
  const [isTeacherDragging, setIsTeacherDragging] = useState<boolean>(false);

  const [attachedGradesFile, setAttachedGradesFile] = useState<File | null>(null);
  const [parsedGradesStructure, setParsedGradesStructure] = useState<{ gradeName: string; className?: string }[]>([]);
  const [isGradesDragging, setIsGradesDragging] = useState<boolean>(false);

  // Reactive parsing of pasted students list
  useEffect(() => {
    const lines = pastedStudentsText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith("#"));
    setParsedStudentNames(lines);
  }, [pastedStudentsText]);

  // Reactive parsing of pasted teachers list
  useEffect(() => {
    const lines = pastedTeachersText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith("#"));
    setParsedTeacherNames(lines);
  }, [pastedTeachersText]);

  // Statistics state
  const [stats, setStats] = useState({
    totalAbsencesCount: 0,
    totalBehaviorLogs: 0,
    absenteeRankings: [] as { name: string; count: number; className: string }[],
    violationRankings: [] as { name: string; count: number }[],
    recentLogs: [] as { type: "حضور" | "سلوك"; title: string; subtitle: string; date: string; teacherName?: string; id?: string }[],
    allBehaviorsList: [] as { id: string; studentName: string; gradeName: string; className: string; violation: string; teacherName: string; date: string; period?: string; timestamp?: any }[],
    todayBehaviorsList: [] as { id: string; studentName: string; gradeName: string; className: string; violation: string; teacherName: string; date: string; period?: string; timestamp?: any }[]
  });
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  const handleClearNewBehaviorAlerts = () => {
    if (newBehaviorIds.length > 0) {
      newBehaviorIds.forEach(id => seenBehaviorIdsRef.current.add(id));
      saveStoredSeenBehaviorIds(seenBehaviorIdsRef.current);
      setNewBehaviorIds([]);
      setHasNewBehavior(false);
    }
  };

  const handleOpenBehaviorTab = () => {
    setActiveStatsTab("behavior");
    // Keeps newBehaviorIds active so new student names display pulsing alerts in the table
  };

  // Feedback Messages
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Custom Alert Modal State for duplicates
  const [alertState, setAlertState] = useState<{
    title: string;
    message: string;
    type?: "warning" | "info" | "success";
  } | null>(null);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleBackupFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await importSchoolBackupData(parsed);
      if (res.success) {
        await onRefreshData();
        setAlertState({
          title: "تم استيراد النسخة الاحتياطية بنجاح ✅",
          message: `تمت استعادة بيانات المدرسة بنجاح!\n• الصفوف: ${res.counts.grades || 0}\n• الفصول: ${res.counts.classes || 0}\n• الطلاب: ${res.counts.students || 0}\n• المعلمين: ${res.counts.teachers || 0}\n• سجلات الغياب: ${res.counts.attendance || 0}`,
          type: "info"
        });
      } else {
        setAlertState({
          title: "فشل استيراد النسخة الاحتياطية ❌",
          message: res.message,
          type: "warning"
        });
      }
    } catch (err: any) {
      setAlertState({
        title: "خطأ في قراءة ملف النسخة الاحتياطية ⚠️",
        message: "الملف المرفق غير صالح أو ليس بصيغة JSON صحيحة: " + (err?.message || err),
        type: "warning"
      });
    } finally {
      e.target.value = "";
    }
  };

  const handleTestCloudConnection = () => {
    setShowFirebaseDiagModal(true);
  };

  const handlePrintSelectedAttendance = () => {
    const gradeName = grades.find(g => g.id === searchGradeId)?.name || "غير محدد";
    const className = classes.find(c => c.id === searchClassId)?.name || "غير محدد";
    const dateStr = searchDate || getTodayDateString();

    try {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const rowsHtml = searchAttendanceResult.length === 0
          ? `<tr><td colspan="5" style="text-align:center; padding:25px; color:#64748b; font-weight:bold;">لا توجد غيابات مسجلة لهذا الفصل في هذا التاريخ 👍</td></tr>`
          : searchAttendanceResult.map((entry, idx) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
                <td style="padding: 10px; font-weight: 800; color: #0f172a;">${entry.studentName}</td>
                <td style="padding: 10px; text-align: center;">
                  <span style="padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; background-color: ${entry.status === 'غائب' ? '#fef2f2' : '#fffbeb'}; color: ${entry.status === 'غائب' ? '#dc2626' : '#d97706'}; border: 1px solid ${entry.status === 'غائب' ? '#fecaca' : '#fde68a'};">
                    ${entry.status}
                  </span>
                </td>
                <td style="padding: 10px; text-align: center; font-weight: 800; color: #334155;">${entry.period || '-'}</td>
                <td style="padding: 10px; text-align: center; color: #475569;">${entry.teacherName || '-'}</td>
              </tr>
            `).join("");

        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8">
            <title>كشف الغياب المحدد - ${gradeName} (${className})</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
              body { font-family: 'Cairo', system-ui, sans-serif; padding: 25px; direction: rtl; text-align: right; background-color: #fff; color: #1e293b; }
              .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #0284c7; padding-bottom: 15px; }
              .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 800; color: #0f172a; }
              .header p { margin: 0; font-size: 13px; font-weight: 600; color: #64748b; }
              .meta-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; font-size: 13px; font-weight: 700; }
              .meta-item { display: flex; align-items: center; gap: 6px; }
              .meta-label { color: #64748b; }
              .meta-val { color: #0284c7; font-weight: 800; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
              th { background-color: #f1f5f9; color: #334155; padding: 10px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: 800; }
              th:first-child, td:first-child { text-align: center; }
              .footer { margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: left; font-size: 11px; font-weight: 600; color: #94a3b8; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📋 كشف الغياب والتأخر المحدد</h1>
              <p>نظام متابعة الحضور والغياب والملاحظات السلوكية</p>
            </div>
            <div class="meta-box">
              <div class="meta-item"><span class="meta-label">الصف الدراسي:</span> <span class="meta-val">${gradeName}</span></div>
              <div class="meta-item"><span class="meta-label">الفصل:</span> <span class="meta-val">${className}</span></div>
              <div class="meta-item"><span class="meta-label">التاريخ:</span> <span class="meta-val">${dateStr}</span></div>
              <div class="meta-item"><span class="meta-label">إجمالي الحالات:</span> <span class="meta-val">${searchAttendanceResult.length}</span></div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">#</th>
                  <th>اسم الطالب</th>
                  <th style="text-align: center;">الحالة</th>
                  <th style="text-align: center;">الحصة</th>
                  <th style="text-align: center;">المعلم المعتمد</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <div class="footer">
              تم استخراج التقرير آلياً • ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 300);
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        window.print();
      }
    } catch (e) {
      console.error("Print error:", e);
      window.print();
    }
  };

  const handlePrintMorningDelays = (filteredList: MorningDelayRecord[]) => {
    const dateStr = delayDateFilter || getTodayDateString();

    try {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const rowsHtml = filteredList.length === 0
          ? `<tr><td colspan="7" style="text-align:center; padding:25px; color:#64748b; font-weight:bold;">لا يوجد طلاب متأخرين مسجلين لهذا اليوم 👍</td></tr>`
          : filteredList.map((entry, idx) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
                <td style="padding: 10px; font-weight: 800; color: #0f172a;">${entry.studentName || 'طالب'}</td>
                <td style="padding: 10px; text-align: center; color: #334155; font-weight: 700;">${entry.gradeName || '-'}</td>
                <td style="padding: 10px; text-align: center; color: #334155; font-weight: 700;">${entry.className || '-'}</td>
                <td style="padding: 10px; text-align: center; font-weight: 800; color: #b45309; direction: ltr;">${entry.arrivalTime || '-'}</td>
                <td style="padding: 10px; text-align: center;">
                  <span style="padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a;">
                    ${entry.reason || 'بدون عذر'}
                  </span>
                </td>
                <td style="padding: 10px; text-align: center; color: #475569;">${entry.recordedBy || '-'}</td>
              </tr>
            `).join("");

        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8">
            <title>كشف التأخر الصباحي - ${dateStr}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
              body { font-family: 'Cairo', system-ui, sans-serif; padding: 25px; direction: rtl; text-align: right; background-color: #fff; color: #1e293b; }
              .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #f59e0b; padding-bottom: 15px; }
              .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 800; color: #0f172a; }
              .header p { margin: 0; font-size: 13px; font-weight: 600; color: #64748b; }
              .meta-box { background-color: #fefce8; border: 1px solid #fef08a; border-radius: 12px; padding: 12px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; font-size: 13px; font-weight: 700; }
              .meta-item { display: flex; align-items: center; gap: 6px; }
              .meta-label { color: #854d0e; }
              .meta-val { color: #b45309; font-weight: 800; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
              th { background-color: #fef3c7; color: #92400e; padding: 10px 12px; border: 1px solid #fde68a; text-align: right; font-weight: 800; }
              th:first-child, td:first-child { text-align: center; }
              .footer { margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: left; font-size: 11px; font-weight: 600; color: #94a3b8; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>⏰ كشف التأخر الصباحي للطلاب</h1>
              <p>سجل رصد وضبط الطلاب المتأخرين صباحاً</p>
            </div>
            <div class="meta-box">
              <div class="meta-item"><span class="meta-label">التاريخ:</span> <span class="meta-val">${dateStr}</span></div>
              <div class="meta-item"><span class="meta-label">إجمالي الطلاب المتأخرين:</span> <span class="meta-val">${filteredList.length}</span></div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">#</th>
                  <th>اسم الطالب</th>
                  <th style="text-align: center;">الصف الدراسي</th>
                  <th style="text-align: center;">الفصل</th>
                  <th style="text-align: center;">وقت الحضور</th>
                  <th style="text-align: center;">السبب / العذر</th>
                  <th style="text-align: center;">المشرف المسجل</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <div class="footer">
              تم استخراج التقرير آلياً • ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 300);
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        window.print();
      }
    } catch (e) {
      console.error("Print error:", e);
      window.print();
    }
  };

  // Delete Morning Delay Record from table
  const handleDeleteMorningDelay = (delayId: string, studentName: string, studentId?: string, date?: string) => {
    confirmAction(
      "حذف تسجيل التأخر الصباحي",
      `هل أنت متأكد من حذف تسجيل تأخر الطالب (${studentName})؟`,
      async () => {
        try {
          setMorningDelaysList(prev => prev.filter(d => d.id !== delayId && !(studentId && date && d.studentId === studentId && d.date === date)));
          await deleteMorningDelayRecord(delayId, { studentId, date });
          showMessage("تم حذف تسجيل التأخر بنجاح");
        } catch (e) {
          console.error("Error deleting morning delay:", e);
          showMessage("حدث خطأ أثناء حذف التسجيل", "error");
        }
      }
    );
  };

  // Change or toggle Morning Delay Excuse Status (بعذر / بدون عذر)
  const handleChangeDelayReason = async (delayId: string, newReason: string) => {
    try {
      setMorningDelaysList(prev => prev.map(d => d.id === delayId ? { ...d, reason: newReason } : d));
      await updateMorningDelayReason(delayId, newReason);
      showMessage(`تم تحديث حالة العذر إلى (${newReason}) بنجاح ✓`);
    } catch (e) {
      console.error("Error updating delay reason:", e);
      showMessage("حدث خطأ أثناء تعديل حالة العذر", "error");
    }
  };

  // Set default selected grade for customizer
  useEffect(() => {
    if (grades.length > 0 && !selectedGradeIdForClasses) {
      setSelectedGradeIdForClasses(grades[0].id);
    }
  }, [grades, selectedGradeIdForClasses]);

  // Set default student grade & class
  useEffect(() => {
    if (grades.length > 0 && !newStudentGradeId) {
      setNewStudentGradeId(grades[0].id);
    }
  }, [grades, newStudentGradeId]);

  useEffect(() => {
    if (newStudentGradeId) {
      const filtered = classes.filter(c => c.gradeId === newStudentGradeId);
      if (filtered.length > 0) {
        setNewStudentClassId(filtered[0].id);
      } else {
        setNewStudentClassId("");
      }
    }
  }, [newStudentGradeId, classes]);

  // Submit PIN for authorization
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(prev => ({ ...prev, pin: true }));
    setTimeout(() => {
      if (pin === "1234") {
        setIsAuthenticated(true);
        setPinError("");
        loadStatistics();
      } else {
        setPinError("رمز المرور خاطئ! الرجاء المحاولة مرة أخرى.");
        setPin("");
      }
      setSubmitting(prev => ({ ...prev, pin: false }));
    }, 450);
  };

  // Delete specific student absence or delay record (Instant 0ms update + background sync)
  const handleDeleteAbsence = async (recordId: string, studentId: string, isAbsentType: boolean) => {
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    const isNoAbsenceDummy = studentId === "no-absence";
    const isMorningDelay = recordId.startsWith("delay_") || recordId.startsWith("delay-");
    const title = isNoAbsenceDummy ? "حذف التحضير بالكامل" : isMorningDelay ? "حذف التأخر الصباحي" : "حذف تسجيل الغياب";
    const message = isNoAbsenceDummy 
      ? "هل أنت متأكد من رغبتك في حذف سجل التحضير الكامل (حضور الجميع) لهذه الحصة؟"
      : isMorningDelay
      ? "هل أنت متأكد من رغبتك في حذف وإلغاء تسجيل التأخر الصباحي لهذا الطالب؟"
      : "هل أنت متأكد من رغبتك في حذف تسجيل غياب هذا الطالب من هذه الحصة؟";

    confirmAction(
      title,
      message,
      async () => {
        try {
          // 1. Optimistically update local statistics in UI immediately (0ms)
          setTodayStats(prev => {
            if (!prev) return prev;
            const filterEntries = (list: any[]) => {
              if (!Array.isArray(list)) return [];
              return list.filter(item => {
                if (!item) return false;
                if (item.recordId !== recordId && item.id !== recordId) return true;
                if (isNoAbsenceDummy) return false;
                return !(item.studentId === studentId && item.isAbsent === isAbsentType);
              });
            };

            const updatedEntriesByGrade: Record<string, any[]> = {};
            if (prev.entriesByGrade && typeof prev.entriesByGrade === "object") {
              Object.keys(prev.entriesByGrade).forEach(key => {
                updatedEntriesByGrade[key] = filterEntries(prev.entriesByGrade[key]);
              });
            }

            return {
              ...prev,
              absentCount: isAbsentType ? Math.max(0, (prev.absentCount || 0) - 1) : (prev.absentCount || 0),
              grade1Entries: filterEntries(prev.grade1Entries),
              grade2Entries: filterEntries(prev.grade2Entries),
              grade3Entries: filterEntries(prev.grade3Entries),
              entriesByGrade: updatedEntriesByGrade
            };
          });

          // Optimistically update absence search results table if open
          setSearchAttendanceResult(prev => {
            if (!Array.isArray(prev)) return [];
            return prev.filter(item => {
              if (!item) return false;
              if (item.recordId !== recordId && item.id !== recordId) return true;
              if (isNoAbsenceDummy) return false;
              return !(item.studentId === studentId && item.isAbsent === isAbsentType);
            });
          });

          // Update cached refs
          if (isMorningDelay) {
            if (Array.isArray(cachedDelaysRef.current)) {
              cachedDelaysRef.current = cachedDelaysRef.current.filter(r => r && r.id !== recordId && r.studentId !== studentId);
            }
            setMorningDelaysList(prev => prev.filter(r => r.id !== recordId && r.studentId !== studentId));
          } else if (Array.isArray(cachedAttendanceRef.current)) {
            if (isNoAbsenceDummy) {
              cachedAttendanceRef.current = cachedAttendanceRef.current.filter(r => r && r.id !== recordId);
            } else {
              cachedAttendanceRef.current = cachedAttendanceRef.current.map(r => {
                if (!r || r.id !== recordId) return r;
                return {
                  ...r,
                  absent: isAbsentType && Array.isArray(r.absent) ? r.absent.filter(id => id !== studentId) : r.absent,
                  late: !isAbsentType && Array.isArray(r.late) ? r.late.filter(id => id !== studentId) : r.late
                };
              });
            }
          }

          showMessage(isMorningDelay ? "تم حذف تسجيل التأخر الصباحي بنجاح!" : "تم حذف تسجيل الغياب بنجاح!");

          // 2. Perform local-first database update and non-blocking background sync
          if (isMorningDelay) {
            await deleteMorningDelayRecord(recordId, { studentId, date: getTodayDateString() });
          } else if (isNoAbsenceDummy) {
            await deleteAttendanceRecord(recordId);
          } else {
            await deleteAttendanceEntry(recordId, studentId, isAbsentType);
          }
        } catch (e) {
          console.error("Error deleting absence/delay:", e);
          showMessage("حدث خطأ أثناء الحذف", "error");
        }
      }
    );
  };

  const computeStatistics = (
    attendance: AttendanceRecord[], 
    behaviors: BehaviorRecord[], 
    delays: MorningDelayRecord[] = cachedDelaysRef.current,
    isBehaviorsReady: boolean = true,
    targetDateStr?: string
  ) => {
    try {
      const safeAttendance = Array.isArray(attendance) ? attendance : [];
      const safeBehaviors = Array.isArray(behaviors) ? behaviors : [];

      // Fast in-memory lookup maps to eliminate O(N^2) loops and localStorage parsing
      const studentMap = new Map<string, { name: string; classId?: string }>();
      if (Array.isArray(students)) {
        students.forEach(s => {
          if (s && s.id) {
            const entry = { name: s.name || "", classId: s.classId };
            studentMap.set(s.id, entry);
            studentMap.set(s.id.toLowerCase(), entry);
          }
        });
      }

      const classMap = new Map<string, string>();
      if (Array.isArray(classes)) {
        classes.forEach(c => {
          if (c && c.id) classMap.set(c.id, c.name || "");
        });
      }

      const gradeMap = new Map<string, string>();
      if (Array.isArray(grades)) {
        grades.forEach(g => {
          if (g && g.id) gradeMap.set(g.id, g.name || "");
        });
      }

      // Absences analysis
      let totalAbsCount = 0;
      const studentAbsMap: Record<string, number> = {};
      
      safeAttendance.forEach(record => {
        if (record && !record.isNoAbsence && Array.isArray(record.absent)) {
          totalAbsCount += record.absent.length;
          record.absent.forEach(studentId => {
            if (studentId) {
              studentAbsMap[studentId] = (studentAbsMap[studentId] || 0) + 1;
            }
          });
        }
      });

      const absenteeRankings = Object.entries(studentAbsMap)
        .map(([studentId, count]) => {
          const studentEntry = studentMap.get(studentId) || studentMap.get(studentId.toLowerCase());
          const studentClass = (studentEntry?.classId ? classMap.get(studentEntry.classId) : "") || "بدون فصل";
          return {
            name: studentEntry?.name || "طالب غير معروف",
            count,
            className: studentClass
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Behavior violations frequencies
      const violationMap: Record<string, number> = {};
      safeBehaviors.forEach(b => {
        if (b && b.violation) {
          violationMap[b.violation] = (violationMap[b.violation] || 0) + 1;
        }
      });

      const violationRankings = Object.entries(violationMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Recent activities feed
      const recentLogs: typeof stats.recentLogs = [];
      const sortedAttendance = [...safeAttendance]
        .filter(Boolean)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .slice(0, 5);

      sortedAttendance.forEach(rec => {
        const gradeName = (Array.isArray(grades) ? grades.find(g => g && g.id === rec.gradeId)?.name : "") || "";
        const className = (Array.isArray(classes) ? classes.find(c => c && c.id === rec.classId)?.name : "") || "";
        const absentCount = rec.isNoAbsence ? 0 : (Array.isArray(rec.absent) ? rec.absent.length : 0);
        const lateCount = Array.isArray(rec.late) ? rec.late.length : 0;
        
        recentLogs.push({
          type: "حضور",
          title: `تسجيل حضور ${gradeName} - ${className}`,
          subtitle: `غياب: ${absentCount} طلاب، متأخرين: ${lateCount} طلاب • الحصة: ${rec.period}`,
          date: rec.date || ""
        });
      });

      const sortedBehaviors = [...safeBehaviors]
        .filter(Boolean)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      sortedBehaviors.slice(0, 5).forEach(b => {
        const studentName = (Array.isArray(students) ? students.find(s => s && s.id === b.studentId)?.name : "") || "طالب";
        const teacherName = b.teacherName || (Array.isArray(teachers) ? teachers.find(t => t && t.id === b.teacherId)?.name : "") || "معلم الحصة";
        recentLogs.push({
          type: "سلوك",
          title: `سلوك سلبي: ${studentName}`,
          subtitle: `المخالفة: ${b.violation}`,
          date: b.date || "",
          teacherName,
          id: b.id
        });
      });

      // Sort combined logs by date descending
      recentLogs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      // Calculate attendance stats for the selected date only
      const TARGET_DATE = (targetDateStr || selectedAttendanceDate || getTodayDateString()).trim();
      const todayAttendance = safeAttendance.filter(rec => rec && rec.date && rec.date.trim() === TARGET_DATE);

      // Helper to extract numeric timestamp from BehaviorRecord for accurate sorting
      const getBehaviorTime = (b: BehaviorRecord): number => {
        if (b.timestamp) {
          if (typeof b.timestamp.toMillis === "function") return b.timestamp.toMillis();
          if (typeof b.timestamp.seconds === "number") return b.timestamp.seconds * 1000;
          if (typeof b.timestamp === "number") return b.timestamp;
          if (b.timestamp instanceof Date) return b.timestamp.getTime();
        }
        if (b.date) {
          const parsed = Date.parse(b.date);
          if (!isNaN(parsed)) return parsed;
        }
        return 0;
      };

      // Sort ALL behaviors so newest behaviors appear at the top
      const sortedAllBehaviors = [...behaviors].sort((a, b) => {
        const timeA = getBehaviorTime(a);
        const timeB = getBehaviorTime(b);
        if (timeA !== timeB) {
          return timeB - timeA; // Descending (newest first)
        }
        const dateComp = (b.date || "").localeCompare(a.date || "");
        if (dateComp !== 0) return dateComp;
        return (b.id || "").localeCompare(a.id || "");
      });

      const mapBehaviorRecord = (b: BehaviorRecord) => {
        const studentObj = students.find(s => s.id === b.studentId);
        const gradeName = studentObj ? (grades.find(g => g.id === studentObj.gradeId)?.name || "") : "";
        const className = studentObj ? (classes.find(c => c.id === studentObj.classId)?.name || "") : "";
        const teacherName = b.teacherName || teachers.find(t => t.id === b.teacherId)?.name || "معلم الحصة";
        return {
          id: b.id,
          studentName: studentObj?.name || "طالب",
          gradeName,
          className,
          violation: b.violation,
          teacherName,
          date: b.date,
          period: b.period || "",
          timestamp: b.timestamp
        };
      };

      const allBehaviorsList = sortedAllBehaviors.map(mapBehaviorRecord);
      const todayBehaviorsList = sortedAllBehaviors.filter(b => b.date && b.date.trim() === TARGET_DATE).map(mapBehaviorRecord);

      setStats({
        totalAbsencesCount: totalAbsCount,
        totalBehaviorLogs: behaviors.length,
        absenteeRankings,
        violationRankings,
        recentLogs: recentLogs.slice(0, 8),
        allBehaviorsList,
        todayBehaviorsList
      });

      // Absent on selected date (unique student counts by canonical identity)
      const todayAbsentSet = new Set<string>();
      todayAttendance.forEach(rec => {
        if (!rec.isNoAbsence && Array.isArray(rec.absent)) {
          rec.absent.forEach(id => {
            if (!id) return;
            const studentObj = Array.isArray(students) ? students.find(s => s && (s.id === id || s.name === id)) : undefined;
            const canonicalKey = studentObj ? `sid_${studentObj.id}` : `norm_${normalizeArabic(id).replace(/\s+/g, ' ').trim()}`;
            if (canonicalKey) todayAbsentSet.add(canonicalKey);
          });
        }
      });
      const absentCount = todayAbsentSet.size;
      const behaviorCount = todayBehaviorsList.length;

      // Check if new behavior records were added by a teacher (alert only newly added behaviors)
      if (isBehaviorsReady && Array.isArray(behaviors)) {
        const incomingIds = behaviors.map(b => b.id).filter(Boolean) as string[];

        // If local storage was empty on very first load, initialize seenBehaviorIdsRef with current incomingIds
        const rawStorage = localStorage.getItem("school_seen_behavior_ids");
        if (!initialBehaviorsLoadedRef.current) {
          initialBehaviorsLoadedRef.current = true;
          if (!rawStorage) {
            incomingIds.forEach(id => seenBehaviorIdsRef.current.add(id));
            saveStoredSeenBehaviorIds(seenBehaviorIdsRef.current);
          }
        }

        const newlyAdded = incomingIds.filter(id => !seenBehaviorIdsRef.current.has(id));
        if (newlyAdded.length > 0) {
          setNewBehaviorIds(prev => (prev.length === newlyAdded.length && prev.every((v, i) => v === newlyAdded[i])) ? prev : newlyAdded);
          setHasNewBehavior(prev => prev ? prev : true);
        } else {
          setNewBehaviorIds(prev => prev.length === 0 ? prev : []);
          setHasNewBehavior(prev => !prev ? prev : false);
        }
      }

      // Group attendance into columns
      const PERIOD_TIMES: Record<string, string> = {
        "1": "08:00",
        "2": "08:45",
        "3": "09:30",
        "4": "10:30",
        "5": "11:15",
        "6": "12:00",
        "7": "12:45",
        "الأولى": "08:00",
        "الثانية": "08:45",
        "الثالثة": "09:30",
        "الرابعة": "10:30",
        "الخامسة": "11:15",
        "السادسة": "12:00",
        "السابعة": "12:45",
        "حصة 1": "08:00",
        "حصة 2": "08:45",
        "حصة 3": "09:30",
        "حصة 4": "10:30",
        "حصة 5": "11:15",
        "حصة 6": "12:00",
        "حصة 7": "12:45"
      };

      const PERIOD_CODES: Record<string, string> = {
        "الأولى": "ح1",
        "الثانية": "ح2",
        "الثالثة": "ح3",
        "الرابعة": "ح4",
        "الخامسة": "ح5",
        "السادسة": "ح6",
        "السابعة": "ح7",
        "حصة 1": "ح1",
        "حصة 2": "ح2",
        "حصة 3": "ح3",
        "حصة 4": "ح4",
        "حصة 5": "ح5",
        "حصة 6": "ح6",
        "حصة 7": "ح7"
      };

      const getPeriodCode = (p: string) => {
        if (!p) return "ح1";
        if (PERIOD_CODES[p]) return PERIOD_CODES[p];
        const num = getPeriodNum(p);
        if (num && num !== "صباحي" && !isNaN(parseInt(num, 10))) return `ح${num}`;
        return p;
      };

      const getPeriodTime = (p: string) => {
        if (PERIOD_TIMES[p]) return PERIOD_TIMES[p];
        const num = getPeriodNum(p);
        if (PERIOD_TIMES[num]) return PERIOD_TIMES[num];
        return "08:00";
      };

      const g1Entries: any[] = [];
      const g2Entries: any[] = [];
      const g3Entries: any[] = [];
      const entriesByGrade: Record<string, any[]> = {};
      grades.forEach(g => {
        entriesByGrade[g.id] = [];
      });

      todayAttendance.forEach(rec => {
        // Robust grade matching (by ID, by name, by Arabic normalization, through associated class, or through student)
        let grade = grades.find(g => g.id === rec.gradeId || g.name === rec.gradeId);
        if (!grade && rec.gradeId) {
          grade = grades.find(g => normalizeArabic(g.name) === normalizeArabic(rec.gradeId));
        }
        if (!grade && rec.classId) {
          const matchedClass = classes.find(c => c.id === rec.classId || c.name === rec.classId || normalizeArabic(c.name) === normalizeArabic(rec.classId));
          if (matchedClass) {
            grade = grades.find(g => g.id === matchedClass.gradeId || normalizeArabic(g.name) === normalizeArabic(matchedClass.gradeId));
          }
        }
        if (!grade && ((rec.absent && rec.absent.length > 0) || (rec.late && rec.late.length > 0) || (rec.present && rec.present.length > 0))) {
          const sampleStId = (rec.absent && rec.absent[0]) || (rec.late && rec.late[0]) || (rec.present && rec.present[0]);
          const matchedSt = students.find(s => s && (s.id === sampleStId || s.name === sampleStId));
          if (matchedSt) {
            if (matchedSt.gradeId) {
              grade = grades.find(g => g.id === matchedSt.gradeId || normalizeArabic(g.name) === normalizeArabic(matchedSt.gradeId));
            }
            if (!grade && matchedSt.classId) {
              const stClass = classes.find(c => c.id === matchedSt.classId || normalizeArabic(c.name) === normalizeArabic(matchedSt.classId));
              if (stClass) {
                grade = grades.find(g => g.id === stClass.gradeId);
              }
            }
          }
        }
        // Fallback by text matching "اول", "ثاني", "ثالث"
        if (!grade) {
          const recText = `${rec.gradeId || ""} ${(rec as any).gradeName || ""} ${(rec as any).grade || ""}`;
          const normRecText = normalizeArabic(recText);
          if (normRecText.includes("اول") || normRecText.includes("أول")) {
            grade = grades.find(g => normalizeArabic(g.name).includes("اول") || normalizeArabic(g.name).includes("أول"));
          } else if (normRecText.includes("ثان")) {
            grade = grades.find(g => normalizeArabic(g.name).includes("ثان"));
          } else if (normRecText.includes("ثالث")) {
            grade = grades.find(g => normalizeArabic(g.name).includes("ثالث"));
          }
        }
        const fallbackGradeId = grade ? grade.id : (grades[0]?.id || rec.gradeId || "general_grade");
        const gradeName = grade ? grade.name : (rec.gradeId || "الصف الدراسي");

        let cls = classes.find(c => c.id === rec.classId || c.name === rec.classId);
        if (!cls && rec.classId) {
          cls = classes.find(c => normalizeArabic(c.name) === normalizeArabic(rec.classId));
        }
        if (!cls && rec.absent && rec.absent.length > 0) {
          const st = students.find(s => s.id === rec.absent[0] || s.name === rec.absent[0]);
          if (st && st.classId) {
            cls = classes.find(c => c.id === st.classId || c.name === st.classId);
          }
        }
        if (!cls && rec.late && rec.late.length > 0) {
          const st = students.find(s => s.id === rec.late[0] || s.name === rec.late[0]);
          if (st && st.classId) {
            cls = classes.find(c => c.id === st.classId || c.name === st.classId);
          }
        }
        
        let className = cls?.name || "";
        if (!className) {
          if (rec.classId && !rec.classId.startsWith("temp_") && !rec.classId.startsWith("class_") && rec.classId.length <= 8 && !/^\d{4,}$/.test(rec.classId.trim())) {
            className = rec.classId;
          } else {
            className = "الفصل 1";
          }
        }

        let resolvedTeacherName = (rec as any).teacherName || "";
        if (!resolvedTeacherName && rec.teacherId) {
          const matchedTeacher = teachers.find(t => t.id === rec.teacherId || t.name === rec.teacherId);
          if (matchedTeacher && matchedTeacher.name && matchedTeacher.name.trim()) {
            resolvedTeacherName = matchedTeacher.name.trim();
          } else if (!rec.teacherId.startsWith("tea_") && !rec.teacherId.startsWith("temp_") && !/^\d{4,}$/.test(rec.teacherId.trim())) {
            resolvedTeacherName = rec.teacherId;
          }
        }
        if (!resolvedTeacherName) {
          resolvedTeacherName = "معلم الحصة";
        }

        const pCode = getPeriodCode(rec.period);
        const pTime = getPeriodTime(rec.period);
        const defaultCCode = getClassCode(className);

        // Helper to resolve specific student's classroom and code
        const resolveStudentClassInfo = (stId: string) => {
          if (stId && stId !== "no-absence") {
            const stObj = students.find(s => s && (s.id === stId || s.name === stId || s.id?.toLowerCase() === stId.toLowerCase()));
            if (stObj && stObj.classId) {
              let stCls = classes.find(c => c.id === stObj.classId || c.name === stObj.classId);
              if (!stCls) {
                stCls = classes.find(c => normalizeArabic(c.name) === normalizeArabic(stObj.classId));
              }
              if (stCls) {
                return {
                  classId: stCls.id,
                  classCode: getClassCode(stCls.name)
                };
              }
            }
          }
          if (cls) {
            return {
              classId: cls.id,
              classCode: getClassCode(cls.name)
            };
          }
          return {
            classId: rec.classId || "",
            classCode: defaultCCode
          };
        };

        let actualTime = "";
        if (rec.timestamp) {
          try {
            let dateObj: Date | null = null;
            if (typeof rec.timestamp.toDate === "function") {
              dateObj = rec.timestamp.toDate();
            } else if (rec.timestamp.seconds) {
              dateObj = new Date(rec.timestamp.seconds * 1000);
            } else if (typeof rec.timestamp === "object" && rec.timestamp instanceof Date) {
              dateObj = rec.timestamp;
            } else if (typeof rec.timestamp === "number" || typeof rec.timestamp === "string") {
              dateObj = new Date(rec.timestamp);
            }
            if (dateObj && !isNaN(dateObj.getTime())) {
              const h = String(dateObj.getHours()).padStart(2, '0');
              const m = String(dateObj.getMinutes()).padStart(2, '0');
              actualTime = `${h}:${m}`;
            }
          } catch (err) {
            console.error("Error parsing timestamp:", err);
          }
        }

        const displayTime = actualTime || pTime;

        // Robust student name resolver
        const resolveStudentName = (stId: string, recordObj?: any): string => {
          if (!stId) return "";
          if (stId === "no-absence") return "لا يوجد غياب";

          // 1. Direct from record's embedded studentNames mapping
          if (recordObj?.studentNames && typeof recordObj.studentNames === "object" && recordObj.studentNames[stId]) {
            return recordObj.studentNames[stId];
          }

          // 2. Lookup in memoized studentMap O(1)
          const st = studentMap.get(stId) || studentMap.get(stId.toLowerCase());
          if (st && st.name && st.name.trim()) {
            return st.name.trim();
          }

          return stId;
        };

        const pushToEntriesByGrade = (entry: any, targetGradeId: string, targetGradeName: string) => {
          if (!entriesByGrade[targetGradeId]) {
            entriesByGrade[targetGradeId] = [];
          }
          if (!entriesByGrade[targetGradeId].some(e => e.id === entry.id)) {
            entriesByGrade[targetGradeId].push(entry);
          }

          const norm = normalizeArabic(targetGradeName);
          if (norm) {
            if (!entriesByGrade[norm]) entriesByGrade[norm] = [];
            if (!entriesByGrade[norm].some(e => e.id === entry.id)) {
              entriesByGrade[norm].push(entry);
            }
          }

          // Also populate into any grade in the grades array matching this level
          grades.forEach(g => {
            const gn = normalizeArabic(g.name);
            const isMatch = (g.id === targetGradeId) ||
              (gn === norm) ||
              ((gn.includes("اول") || gn.includes("أول")) && (norm.includes("اول") || norm.includes("أول"))) ||
              (gn.includes("ثان") && norm.includes("ثان")) ||
              (gn.includes("ثالث") && norm.includes("ثالث"));

            if (isMatch) {
              if (!entriesByGrade[g.id]) entriesByGrade[g.id] = [];
              if (!entriesByGrade[g.id].some(e => e.id === entry.id)) {
                entriesByGrade[g.id].push(entry);
              }
            }
          });
        };

        // 1. Process absent students
        if (!rec.isNoAbsence && rec.absent && rec.absent.length > 0) {
          rec.absent.forEach(stId => {
            const studentName = resolveStudentName(stId, rec);
            const classInfo = resolveStudentClassInfo(stId);
            const entry = {
              id: `${rec.id}-${stId}-abs`,
              recordId: rec.id,
              studentId: stId,
              studentName: studentName || "طالب غائب",
              status: "غائب",
              periodCode: pCode,
              classCode: classInfo.classCode,
              classId: classInfo.classId,
              gradeId: fallbackGradeId,
              teacherName: resolvedTeacherName,
              time: displayTime,
              isAbsent: true,
              isLate: false
            };

            pushToEntriesByGrade(entry, fallbackGradeId, gradeName);

            const normGrade = normalizeArabic(gradeName);
            if (normGrade.includes(normalizeArabic("الأول"))) {
              if (!g1Entries.some(e => e.id === entry.id)) g1Entries.push(entry);
            } else if (normGrade.includes(normalizeArabic("الثاني"))) {
              if (!g2Entries.some(e => e.id === entry.id)) g2Entries.push(entry);
            } else if (normGrade.includes(normalizeArabic("الثالث"))) {
              if (!g3Entries.some(e => e.id === entry.id)) g3Entries.push(entry);
            }
          });
        }

        // 2. Process late students from classroom attendance (rec.late)
        if (rec.late && Array.isArray(rec.late) && rec.late.length > 0) {
          rec.late.forEach(stId => {
            const studentName = resolveStudentName(stId, rec);
            const classInfo = resolveStudentClassInfo(stId);
            const entry = {
              id: `${rec.id}-${stId}-late`,
              recordId: rec.id,
              studentId: stId,
              studentName: studentName || "طالب متأخر",
              status: "متأخر",
              periodCode: pCode,
              classCode: classInfo.classCode,
              classId: classInfo.classId,
              gradeId: fallbackGradeId,
              teacherName: resolvedTeacherName,
              time: displayTime,
              isAbsent: false,
              isLate: true
            };

            pushToEntriesByGrade(entry, fallbackGradeId, gradeName);

            const normGrade = normalizeArabic(gradeName);
            if (normGrade.includes(normalizeArabic("الأول"))) {
              if (!g1Entries.some(e => e.id === entry.id)) g1Entries.push(entry);
            } else if (normGrade.includes(normalizeArabic("الثاني"))) {
              if (!g2Entries.some(e => e.id === entry.id)) g2Entries.push(entry);
            } else if (normGrade.includes(normalizeArabic("الثالث"))) {
              if (!g3Entries.some(e => e.id === entry.id)) g3Entries.push(entry);
            }
          });
        }

        // 3. Process complete attendance / no absence records
        if (rec.isNoAbsence || ((!rec.absent || rec.absent.length === 0) && (!rec.late || rec.late.length === 0))) {
          const classInfo = resolveStudentClassInfo("no-absence");
          const entry = {
            id: `${rec.id}-noabs`,
            recordId: rec.id,
            studentId: "no-absence",
            studentName: "لا يوجد غياب",
            status: "حضور كامل",
            periodCode: pCode,
            classCode: classInfo.classCode,
            classId: classInfo.classId,
            gradeId: fallbackGradeId,
            teacherName: resolvedTeacherName,
            time: displayTime,
            isAbsent: false,
            isLate: false,
            isNoAbsenceDummy: true
          };

          pushToEntriesByGrade(entry, fallbackGradeId, gradeName);

          const normGrade = normalizeArabic(gradeName);
          if (normGrade.includes(normalizeArabic("الأول"))) {
            if (!g1Entries.some(e => e.id === entry.id)) g1Entries.push(entry);
          } else if (normGrade.includes(normalizeArabic("الثاني"))) {
            if (!g2Entries.some(e => e.id === entry.id)) g2Entries.push(entry);
          } else if (normGrade.includes(normalizeArabic("الثالث"))) {
            if (!g3Entries.some(e => e.id === entry.id)) g3Entries.push(entry);
          }
        }
      });

      // 4. Process Morning Delays for the selected date (التأخر الصباحي)
      const safeDelays = Array.isArray(delays) ? delays : [];
      const todayDelays = safeDelays.filter(d => d && d.date && d.date.trim() === TARGET_DATE);

      todayDelays.forEach(d => {
        const student = students.find(s => s && (s.id === d.studentId || s.name === d.studentId || s.id?.toLowerCase() === d.studentId?.toLowerCase()));
        const studentName = d.studentName || student?.name || "طالب متأخر";
        const studentClassId = student?.classId || "";
        let matchedCls = classes.find(c => c.id === studentClassId || c.name === studentClassId);
        if (!matchedCls && studentClassId) {
          matchedCls = classes.find(c => normalizeArabic(c.name) === normalizeArabic(studentClassId));
        }
        let matchedGrade = grades.find(g => g.id === student?.gradeId);
        if (!matchedGrade && matchedCls) {
          matchedGrade = grades.find(g => g.id === matchedCls.gradeId);
        }
        if (!matchedGrade && d.gradeName) {
          matchedGrade = grades.find(g => normalizeArabic(g.name) === normalizeArabic(d.gradeName));
        }
        if (!matchedGrade) {
          const dText = normalizeArabic(`${d.gradeName || ""} ${d.studentName || ""}`);
          if (dText.includes("اول") || dText.includes("أول")) matchedGrade = grades.find(g => normalizeArabic(g.name).includes("اول") || normalizeArabic(g.name).includes("أول"));
          else if (dText.includes("ثان")) matchedGrade = grades.find(g => normalizeArabic(g.name).includes("ثان"));
          else if (dText.includes("ثالث")) matchedGrade = grades.find(g => normalizeArabic(g.name).includes("ثالث"));
        }

        const studentGradeId = matchedGrade ? matchedGrade.id : (grades[0]?.id || "general_grade");
        const gradeName = matchedGrade?.name || d.gradeName || "الصف الدراسي";

        let actualTime = d.arrivalTime || "";
        if (!actualTime && d.timestamp) {
          try {
            let dateObj: Date | null = null;
            if (typeof d.timestamp.toDate === "function") dateObj = d.timestamp.toDate();
            else if (d.timestamp.seconds) dateObj = new Date(d.timestamp.seconds * 1000);
            else if (d.timestamp instanceof Date) dateObj = d.timestamp;
            else if (typeof d.timestamp === "number" || typeof d.timestamp === "string") dateObj = new Date(d.timestamp);
            if (dateObj && !isNaN(dateObj.getTime())) {
              const h = String(dateObj.getHours()).padStart(2, '0');
              const m = String(dateObj.getMinutes()).padStart(2, '0');
              actualTime = `${h}:${m}`;
            }
          } catch (_) {}
        }
        if (!actualTime) actualTime = "07:30";

        const entry = {
          id: `${d.id}-morning-delay`,
          recordId: d.id,
          studentId: d.studentId,
          studentName,
          status: "تأخر صباحي",
          periodCode: "صباحي",
          classCode: matchedCls ? getClassCode(matchedCls.name) : "ف1",
          classId: matchedCls?.id || studentClassId,
          gradeId: studentGradeId,
          teacherName: d.recordedBy || "المشرف الصباحي",
          time: actualTime,
          isAbsent: false,
          isLate: true,
          isMorningDelay: true
        };

        if (!entriesByGrade[studentGradeId]) {
          entriesByGrade[studentGradeId] = [];
        }
        if (!entriesByGrade[studentGradeId].some(e => e.id === entry.id)) {
          entriesByGrade[studentGradeId].push(entry);
        }

        const normGrade = normalizeArabic(gradeName);
        if (normGrade) {
          if (!entriesByGrade[normGrade]) entriesByGrade[normGrade] = [];
          if (!entriesByGrade[normGrade].some(e => e.id === entry.id)) {
            entriesByGrade[normGrade].push(entry);
          }
        }

        grades.forEach(g => {
          const gn = normalizeArabic(g.name);
          const isMatch = (g.id === studentGradeId) ||
            (gn === normGrade) ||
            ((gn.includes("اول") || gn.includes("أول")) && (normGrade.includes("اول") || normGrade.includes("أول"))) ||
            (gn.includes("ثان") && normGrade.includes("ثان")) ||
            (gn.includes("ثالث") && normGrade.includes("ثالث"));

          if (isMatch) {
            if (!entriesByGrade[g.id]) entriesByGrade[g.id] = [];
            if (!entriesByGrade[g.id].some(e => e.id === entry.id)) {
              entriesByGrade[g.id].push(entry);
            }
          }
        });

        if (normGrade.includes(normalizeArabic("الأول"))) {
          if (!g1Entries.some(e => e.id === entry.id)) g1Entries.push(entry);
        } else if (normGrade.includes(normalizeArabic("الثاني"))) {
          if (!g2Entries.some(e => e.id === entry.id)) g2Entries.push(entry);
        } else if (normGrade.includes(normalizeArabic("الثالث"))) {
          if (!g3Entries.some(e => e.id === entry.id)) g3Entries.push(entry);
        }
      });

      // Sort entries ascending first by Period (حصة) and then by Class (فصل)
      const sortEntriesList = (list: any[]) => {
        list.sort((a, b) => {
          // 1. First priority: Period (الحصة)
          const pNumAStr = getPeriodNum(a.periodCode || a.period || "");
          const pNumBStr = getPeriodNum(b.periodCode || b.period || "");
          let periodA = (pNumAStr === "صباحي" || pNumAStr === "ص" || pNumAStr === "طابور" || a.isMorningDelay) ? 0 : parseInt(pNumAStr, 10);
          let periodB = (pNumBStr === "صباحي" || pNumBStr === "ص" || pNumBStr === "طابور" || b.isMorningDelay) ? 0 : parseInt(pNumBStr, 10);
          if (isNaN(periodA)) periodA = 999;
          if (isNaN(periodB)) periodB = 999;

          if (periodA !== periodB) {
            return periodA - periodB;
          }

          // 2. Second priority: Class (الفصل)
          const numAStr = getClassNum(a.classCode || "");
          const numBStr = getClassNum(b.classCode || "");
          let classA = parseInt(numAStr, 10);
          let classB = parseInt(numBStr, 10);

          if (isNaN(classA)) {
            const idx = classes.findIndex(c => c.id === a.classId);
            classA = idx !== -1 ? idx + 1 : 999;
          }
          if (isNaN(classB)) {
            const idx = classes.findIndex(c => c.id === b.classId);
            classB = idx !== -1 ? idx + 1 : 999;
          }

          if (classA !== classB) {
            return classA - classB;
          }

          // 3. Third priority: Student name (اسم الطالب)
          return (a.studentName || "").localeCompare(b.studentName || "", "ar");
        });
      };

      Object.keys(entriesByGrade).forEach(key => {
        if (entriesByGrade[key]) {
          sortEntriesList(entriesByGrade[key]);
        }
      });
      sortEntriesList(g1Entries);
      sortEntriesList(g2Entries);
      sortEntriesList(g3Entries);

      setTodayStats(prev => {
        if (
          prev.absentCount === absentCount &&
          prev.behaviorCount === behaviorCount &&
          prev.grade1Entries.length === g1Entries.length &&
          prev.grade2Entries.length === g2Entries.length &&
          prev.grade3Entries.length === g3Entries.length
        ) {
          return prev;
        }
        return {
          absentCount,
          behaviorCount,
          grade1Entries: g1Entries,
          grade2Entries: g2Entries,
          grade3Entries: g3Entries,
          entriesByGrade
        };
      });

      if (onTodayStatsChange) {
        onTodayStatsChange({ absentCount, behaviorCount });
      }
    } catch (e) {
      console.error("Error computing stats:", e);
    }
  };

  // Load stats from database
  const loadStatistics = async () => {
    setStatsLoading(true);
    try {
      const [attendance, behaviors, delays] = await Promise.all([
        getAllAttendanceRecords(true),
        getAllBehaviorRecords(true),
        getAllMorningDelayRecords(true)
      ]);
      cachedAttendanceRef.current = attendance;
      cachedBehaviorsRef.current = behaviors;
      cachedDelaysRef.current = delays;
      setMorningDelaysList(delays);
      computeStatistics(attendance, behaviors, delays, true, selectedAttendanceDate);
    } catch (e) {
      console.error("Error loading stats:", e);
    } finally {
      setStatsLoading(false);
    }
  };

  // Load specific student report
  const loadStudentReport = async (stId: string) => {
    if (!stId) {
      setStudentReportData(null);
      return;
    }
    try {
      const student = students.find(s => s.id === stId);
      if (!student) return;

      const attendance = await getAllAttendanceRecords();
      const behaviors = await getAllBehaviorRecords();

      const classRecords = attendance.filter(rec => rec.gradeId === student.gradeId && rec.classId === student.classId);
      const totalLessons = classRecords.length;

      let absentCount = 0;
      let lateCount = 0;
      const history: any[] = [];

      classRecords.forEach(rec => {
        const isStudentAbsent = !rec.isNoAbsence && rec.absent?.includes(stId);
        const isStudentLate = !rec.isNoAbsence && rec.late?.includes(stId);

        if (isStudentAbsent) {
          absentCount++;
          history.push({
            date: rec.date,
            period: rec.period,
            status: "غائب",
            teacher: teachers.find(t => t.id === rec.teacherId)?.name || "غير محدد"
          });
        } else if (isStudentLate) {
          lateCount++;
          history.push({
            date: rec.date,
            period: rec.period,
            status: "متأخر",
            teacher: teachers.find(t => t.id === rec.teacherId)?.name || "غير محدد"
          });
        }
      });

      history.sort((a, b) => b.date.localeCompare(a.date));
      const studentBehaviors = behaviors.filter(b => b.studentId === stId);
      const attendanceRate = totalLessons > 0 
        ? Math.round(((totalLessons - absentCount) / totalLessons) * 100) 
        : 100;

      setStudentReportData({
        attendanceRate,
        absentCount,
        lateCount,
        behaviors: studentBehaviors,
        history
      });
    } catch (e) {
      console.error("Error loading student report:", e);
    }
  };

  // Load specific absence search results (deduplicated by student so no name is repeated)
  const loadSpecificAbsenceSearch = async (gId: string, cId: string, dateStr: string) => {
    if (!gId || !cId) {
      setSearchAttendanceResult([]);
      return;
    }
    try {
      const attendance = await getAllAttendanceRecords();
      const records = attendance.filter(rec => rec.gradeId === gId && rec.classId === cId && rec.date === dateStr);
      
      const studentMap = new Map<string, any>();
      records.forEach(rec => {
        if (!rec.isNoAbsence) {
          const pCode = getPeriodCode(rec.period);
          const teacherName = teachers.find(t => t.id === rec.teacherId)?.name || (rec as any).teacherName || "معلم الحصة";

          (rec.absent || []).forEach(stId => {
            const student = students.find(s => s.id === stId || s.name === stId);
            const studentName = student?.name || (rec.studentNames && rec.studentNames[stId]) || stId;
            const normName = normalizeArabic(studentName || "").replace(/\s+/g, ' ').trim();
            const sKey = student ? `sid_${student.id}` : (normName ? `name_${normName}` : stId);

            if (!studentMap.has(sKey)) {
              studentMap.set(sKey, {
                id: `${rec.id}-${stId}-abs`,
                recordId: rec.id,
                recordIds: [rec.id],
                studentId: stId,
                isAbsent: true,
                isLate: false,
                studentName: studentName || "طالب غائب",
                status: "غائب",
                periods: [pCode],
                period: pCode,
                teacherNames: [teacherName],
                teacherName: teacherName
              });
            } else {
              const existing = studentMap.get(sKey);
              if (!existing.recordIds.includes(rec.id)) existing.recordIds.push(rec.id);
              if (!existing.periods.includes(pCode)) existing.periods.push(pCode);
              if (!existing.teacherNames.includes(teacherName)) existing.teacherNames.push(teacherName);
              existing.period = existing.periods.join("، ");
              existing.teacherName = existing.teacherNames.join("، ");
            }
          });

          (rec.late || []).forEach(stId => {
            const student = students.find(s => s.id === stId || s.name === stId);
            const studentName = student?.name || (rec.studentNames && rec.studentNames[stId]) || stId;
            const normName = normalizeArabic(studentName || "").replace(/\s+/g, ' ').trim();
            const sKey = student ? `sid_${student.id}` : (normName ? `name_${normName}` : stId);

            if (!studentMap.has(sKey)) {
              studentMap.set(sKey, {
                id: `${rec.id}-${stId}-late`,
                recordId: rec.id,
                recordIds: [rec.id],
                studentId: stId,
                isAbsent: false,
                isLate: true,
                studentName: studentName || "طالب متأخر",
                status: "متأخر",
                periods: [pCode],
                period: pCode,
                teacherNames: [teacherName],
                teacherName: teacherName
              });
            } else {
              const existing = studentMap.get(sKey);
              if (!existing.recordIds.includes(rec.id)) existing.recordIds.push(rec.id);
              if (!existing.periods.includes(pCode)) existing.periods.push(pCode);
              if (!existing.teacherNames.includes(teacherName)) existing.teacherNames.push(teacherName);
              existing.period = existing.periods.join("، ");
              existing.teacherName = existing.teacherNames.join("، ");
            }
          });
        }
      });
      setSearchAttendanceResult(Array.from(studentMap.values()));
    } catch (e) {
      console.error("Error loading specific absence search:", e);
    }
  };

  useEffect(() => {
    if (activeSubTab === "stats" && activeStatsTab === "student_report" && reportStudentId) {
      loadStudentReport(reportStudentId);
    }
  }, [reportStudentId, activeStatsTab, activeSubTab, students]);

  useEffect(() => {
    if (activeSubTab === "stats" && activeStatsTab === "selected_attendance" && searchGradeId && searchClassId && searchDate) {
      loadSpecificAbsenceSearch(searchGradeId, searchClassId, searchDate);
    }
  }, [searchGradeId, searchClassId, searchDate, activeStatsTab, activeSubTab, students]);

  useEffect(() => {
    if (grades.length > 0 && !reportGradeId) {
      setReportGradeId(grades[0].id);
    }
    if (grades.length > 0 && !searchGradeId) {
      setSearchGradeId(grades[0].id);
    }
  }, [grades]);

  useEffect(() => {
    if (reportGradeId) {
      const filtered = classes.filter(c => c.gradeId === reportGradeId);
      if (filtered.length > 0) {
        setReportClassId(filtered[0].id);
      } else {
        setReportClassId("");
        setReportStudentId("");
      }
    }
  }, [reportGradeId, classes]);

  useEffect(() => {
    if (reportClassId) {
      const filtered = students.filter(s => s.classId === reportClassId);
      if (filtered.length > 0) {
        setReportStudentId(filtered[0].id);
      } else {
        setReportStudentId("");
      }
    } else {
      setReportStudentId("");
    }
  }, [reportClassId, students]);

  useEffect(() => {
    if (searchGradeId) {
      const filtered = classes.filter(c => c.gradeId === searchGradeId);
      if (filtered.length > 0) {
        setSearchClassId(filtered[0].id);
      } else {
        setSearchClassId("");
      }
    }
  }, [searchGradeId, classes]);

  const cachedAttendanceRef = useRef<AttendanceRecord[]>([]);
  const cachedBehaviorsRef = useRef<BehaviorRecord[]>([]);
  const cachedDelaysRef = useRef<MorningDelayRecord[]>([]);
  const behaviorsReceivedRef = useRef<boolean>(false);
  const computeDebounceTimerRef = useRef<any>(null);

  useEffect(() => {
    if (isAuthenticated || isReadOnly) {
      setStatsLoading(true);
      
      const runCompute = () => {
        if (computeDebounceTimerRef.current) clearTimeout(computeDebounceTimerRef.current);
        computeDebounceTimerRef.current = setTimeout(() => {
          computeStatistics(
            cachedAttendanceRef.current, 
            cachedBehaviorsRef.current, 
            cachedDelaysRef.current, 
            behaviorsReceivedRef.current,
            selectedAttendanceDate
          );
          setStatsLoading(false);
        }, 60);
      };

      // Proactively load authoritative statistics on mount/refresh
      loadStatistics();

      const unsubAttendance = subscribeToAllAttendanceRecords(
        (records) => {
          cachedAttendanceRef.current = records;
          runCompute();
        },
        (_error) => {
          runCompute();
        }
      );

      const unsubBehaviors = subscribeToAllBehaviorRecords(
        (records) => {
          cachedBehaviorsRef.current = records;
          behaviorsReceivedRef.current = true;
          runCompute();
        },
        (_error) => {
          runCompute();
        }
      );

      const unsubDelays = subscribeToAllMorningDelayRecords(
        (records) => {
          cachedDelaysRef.current = records;
          setMorningDelaysList(records);
          runCompute();
        },
        (_error) => {
          runCompute();
        }
      );

      const handleForceRefresh = () => {
        loadStatistics();
      };
      window.addEventListener("school_refresh_stats", handleForceRefresh);

      return () => {
        if (computeDebounceTimerRef.current) clearTimeout(computeDebounceTimerRef.current);
        unsubAttendance();
        unsubBehaviors();
        unsubDelays();
        window.removeEventListener("school_refresh_stats", handleForceRefresh);
      };
    }
  }, [isAuthenticated, isReadOnly, isGoogleAuthenticated, schoolName]);

  // Re-compute stats when students, classes, grades, activeSubTab, or selectedAttendanceDate change
  useEffect(() => {
    if (isAuthenticated || isReadOnly) {
      if (computeDebounceTimerRef.current) clearTimeout(computeDebounceTimerRef.current);
      computeDebounceTimerRef.current = setTimeout(() => {
        computeStatistics(
          cachedAttendanceRef.current, 
          cachedBehaviorsRef.current, 
          cachedDelaysRef.current, 
          behaviorsReceivedRef.current,
          selectedAttendanceDate
        );
      }, 60);
    }
    return () => {
      if (computeDebounceTimerRef.current) clearTimeout(computeDebounceTimerRef.current);
    };
  }, [students, classes, grades, activeSubTab, selectedAttendanceDate]);

  // --- CRUD HANDLERS (Grades & Classes) ---
  const handleAddGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    const gradeLines = newGradeName
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);
    const uniqueGradeNames: string[] = Array.from(new Set(gradeLines));
    if (uniqueGradeNames.length === 0) return;

    // Optimistically update grades right away in state
    const optimisticGradeItems = uniqueGradeNames.map((name, idx) => ({
      id: `opt_grd_${Date.now()}_${idx}`,
      name,
      createdAt: Date.now() + idx
    }));

    setGrades(prev => {
      const existingNames = new Set(prev.map(g => g.name.trim()));
      const toAdd = optimisticGradeItems.filter(g => !existingNames.has(g.name.trim()));
      return [...prev, ...toAdd];
    });

    setNewGradeName("");
    setNewGradeClassNumbers([]);

    setSubmitting(prev => ({ ...prev, addGrade: true }));
    try {
      const addedGrades = await addGradesBatch(uniqueGradeNames);
      const lastGradeId = addedGrades[addedGrades.length - 1]?.id || "";

      // Add selected class numbers for each grade if configured using ultra-fast batch
      if (newGradeClassNumbers.length > 0) {
        const classesToCreate: { name: string; gradeId: string }[] = [];
        for (const g of addedGrades) {
          for (const num of newGradeClassNumbers) {
            classesToCreate.push({ name: `الفصل ${num}`, gradeId: g.id });
          }
        }
        const createdClasses = await addClassesBatch(classesToCreate);
        setClasses(prev => {
          const createdIds = new Set(createdClasses.map(c => c.id));
          const clean = prev.filter(c => !createdIds.has(c.id));
          const updated = [...clean, ...createdClasses];
          const getNumberFromName = (name: string): number => {
            const match = name.match(/\d+/);
            return match ? parseInt(match[0], 10) : 999999;
          };
          return updated.sort((a, b) => {
            const numA = getNumberFromName(a.name);
            const numB = getNumberFromName(b.name);
            if (numA !== numB) return numA - numB;
            return a.name.localeCompare(b.name, "ar");
          });
        });
      }

      // Reconcile real grade IDs
      setGrades(prev => {
        const optimisticIds = new Set(optimisticGradeItems.map(g => g.id));
        const filtered = prev.filter(g => !optimisticIds.has(g.id));
        const existingRealIds = new Set(filtered.map(g => g.id));
        const newReal = addedGrades.filter(g => !existingRealIds.has(g.id)).map((g, idx) => ({ id: g.id, name: g.name, createdAt: Date.now() + idx }));
        return [...filtered, ...newReal];
      });

      if (lastGradeId) {
        setSelectedGradeIdForClasses(lastGradeId);
      }

      const firstAddedGradeId = addedGrades[0]?.id;
      if (firstAddedGradeId) {
        setTimeout(() => {
          const el = document.getElementById(`grade-card-${firstAddedGradeId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-4", "ring-indigo-400", "transition-all");
            setTimeout(() => {
              el.classList.remove("ring-4", "ring-indigo-400");
            }, 2500);
          }
        }, 150);
      }

      if (uniqueGradeNames.length === 1) {
        if (newGradeClassNumbers.length > 0) {
          showMessage(`تم إضافة صف "${uniqueGradeNames[0]}" وفصوله بنجاح!`);
        } else {
          showMessage(`تم إضافة صف "${uniqueGradeNames[0]}" بنجاح!`);
        }
      } else {
        showMessage(`تم إضافة ${uniqueGradeNames.length} صفوف دراسية بنجاح!`);
      }
    } catch (e: any) {
      console.error("Error adding grade:", e);
      showMessage("حدث خطأ أثناء إضافة الصفوف الدراسية", "error");
    } finally {
      setSubmitting(prev => ({ ...prev, addGrade: false }));
    }
  };

  const handleDeleteGrade = (id: string, name: string) => {
    confirmAction(
      "حذف الصف الدراسي",
      `هل أنت متأكد من حذف ${name}؟ سيتم حذف جميع الفصول والطلاب التابعين له تلقائياً ولا يمكن التراجع عن هذا الإجراء.`,
      async () => {
        setSubmitting(prev => ({ ...prev, ['deleteGrade_' + id]: true }));
        try {
          const trimmedName = name.trim();
          setGrades(prev => prev.filter(g => g.id !== id && g.name?.trim() !== trimmedName));
          setClasses(prev => prev.filter(c => c.gradeId !== id && (c.gradeId as any) !== trimmedName && (c as any).gradeName !== trimmedName));
          setStudents(prev => prev.filter(s => s.gradeId !== id && (s.gradeId as any) !== trimmedName && (s as any).gradeName !== trimmedName));
          if (selectedGradeIdForClasses === id) {
            setSelectedGradeIdForClasses("");
          }
          await deleteGrade(id, name);
          showMessage("تم حذف الصف وفصوله بنجاح!");
        } catch (e) {
          showMessage("حدث خطأ أثناء الحذف", "error");
        } finally {
          setSubmitting(prev => ({ ...prev, ['deleteGrade_' + id]: false }));
        }
      }
    );
  };

  // Automated/Sequence Class Adding (matching screenshot functionality)
  const handleAddClassSequence = async () => {
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    if (!selectedGradeIdForClasses) {
      showMessage("الرجاء اختيار صف دراسي أولاً لتثبيت الفصول عليه", "error");
      return;
    }
    if (selectedClassNumbers.length === 0) {
      showMessage("الرجاء تحديد فصل واحد على الأقل لإضافته", "error");
      return;
    }

    setSubmitting(prev => ({ ...prev, addClass: true }));
    try {
      const classesToAdd = selectedClassNumbers.map(num => ({
        name: `الفصل ${num}`,
        gradeId: selectedGradeIdForClasses
      }));

      const added = await addClassesBatch(classesToAdd);

      setClasses(prev => {
        const addedIds = new Set(added.map(a => a.id));
        const clean = prev.filter(c => !addedIds.has(c.id));
        const updated = [...clean, ...added];
        const getNumberFromName = (name: string): number => {
          const match = name.match(/\d+/);
          return match ? parseInt(match[0], 10) : 999999;
        };
        return updated.sort((a, b) => {
          const numA = getNumberFromName(a.name);
          const numB = getNumberFromName(b.name);
          if (numA !== numB) return numA - numB;
          return a.name.localeCompare(b.name, "ar");
        });
      });

      if (added.length > 0) {
        showMessage(`تم إضافة ${added.length} فصل بنجاح!`);
      } else {
        showMessage("جميع الفصول المحددة مسجلة مسبقاً في هذا الصف", "error");
      }
    } catch (e) {
      showMessage("حدث خطأ أثناء إضافة الفصول", "error");
    } finally {
      setSubmitting(prev => ({ ...prev, addClass: false }));
    }
  };

  const handleDeleteClass = (id: string, name: string, gradeId?: string) => {
    confirmAction(
      "تأكيد حذف الفصل نهائياً",
      `هل أنت متأكد من حذف فصل ${name} نهائياً؟ سيتم حذف الفصل وجميع الطلاب المسجلين به نهائياً ولن يتم استرجاعها تلقائياً.`,
      async () => {
        try {
          const trimmedName = name.trim();
          setClasses(prev => prev.filter(c => 
            c.id !== id && 
            !(gradeId && c.gradeId === gradeId && c.name?.trim() === trimmedName)
          ));
          setStudents(prev => prev.filter(s => s.classId !== id));
          showMessage("تم حذف الفصل نهائياً بنجاح!");
          await deleteClass(id, gradeId, name);
        } catch (e) {
          showMessage("حدث خطأ أثناء الحذف", "error");
        }
      }
    );
  };

  // --- CRUD HANDLERS (Teachers) ---
  const handleAddTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    const trimmedName = newTeacherName.trim();
    if (!trimmedName) return;

    // Duplicate check
    const isDuplicate = teachers.some(t => t.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      setAlertState({
        title: "تنبيه: المعلم مكرر ⚠️",
        message: `المعلم "${trimmedName}" مسجل بالفعل في النظام.\n\nتم تجاهل الإضافة لوجود تكرار (عدد التكرار: 1). تم تجاهل هذا الاسم لتفادي التكرار.`,
        type: "warning"
      });
      return;
    }

    setSubmitting(prev => ({ ...prev, addTeacher: true }));
    try {
      const newId = await addTeacher(trimmedName);
      setTeachers(prev => {
        if (prev.some(t => t.id === newId)) return prev;
        const updated = [...prev, { id: newId, name: trimmedName }];
        return updated.sort((a, b) => a.name.localeCompare(b.name, "ar"));
      });
      setNewTeacherName("");
      showMessage("تم إضافة المعلم بنجاح!");
    } catch (e) {
      showMessage("حدث خطأ أثناء إضافة المعلم", "error");
    } finally {
      setSubmitting(prev => ({ ...prev, addTeacher: false }));
    }
  };

  const handleDeleteTeacher = (id: string, name: string) => {
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    confirmAction(
      "حذف المعلم",
      `هل أنت متأكد من حذف المعلم ${name}؟ لا يمكن التراجع عن هذا الإجراء.`,
      async () => {
        try {
          setSelectedTeacherIds(prev => prev.filter(tId => tId !== id));
          setTeachers(prev => prev.filter(t => t.id !== id));
          showMessage("تم حذف المعلم بنجاح!");
          await deleteTeacher(id);
        } catch (e) {
          showMessage("حدث خطأ أثناء الحذف", "error");
        }
      }
    );
  };

  // --- CRUD HANDLERS (Students) ---
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    const trimmedName = newStudentName.trim();
    if (!trimmedName || !newStudentGradeId || !newStudentClassId) {
      showMessage("يرجى إدخال اسم الطالب واختيار الصف والفصل", "error");
      return;
    }

    const normNewName = normalizeStudentName(trimmedName);

    // Duplicate check in this class
    const isDuplicate = students.some(
      s => normalizeStudentName(s.name) === normNewName && s.classId === newStudentClassId
    );
    if (isDuplicate) {
      const cls = classes.find(c => c.id === newStudentClassId);
      const className = cls ? cls.name : "الفصل المحدد";
      setAlertState({
        title: "تنبيه: اسم الطالب مكرر ⚠️",
        message: `تم إلغاء الإضافة: الطالب "${trimmedName}" مسجل بالفعل في ${className}.\n\nتم تجاهل هذا الاسم تلقائياً لمنع التكرار في قاعدة البيانات.`,
        type: "warning"
      });
      return;
    }

    setSubmitting(prev => ({ ...prev, addStudent: true }));
    try {
      const newId = await addStudent(trimmedName, newStudentGradeId, newStudentClassId);
      setStudents(prev => {
        if (prev.some(s => s.id === newId)) return prev;
        return [...prev, { id: newId, name: trimmedName, gradeId: newStudentGradeId, classId: newStudentClassId }].sort((a, b) => a.name.localeCompare(b.name, "ar"));
      });
      setNewStudentName("");
      showMessage("تم إضافة الطالب بنجاح!");
    } catch (e) {
      showMessage("حدث خطأ أثناء إضافة الطالب", "error");
    } finally {
      setSubmitting(prev => ({ ...prev, addStudent: false }));
    }
  };

  const handleDeleteStudent = (id: string, name: string) => {
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    confirmAction(
      "تأكيد حذف الطالب نهائياً",
      `هل أنت متأكد من حذف الطالب ${name} نهائياً؟ سيتم حذف بيانات الطالب نهائياً ولن يتم استرجاعها تلقائياً.`,
      async () => {
        try {
          setSelectedStudentIds(prev => prev.filter(sId => sId !== id));
          setStudents(prev => prev.filter(s => s.id !== id));
          showMessage("تم حذف الطالب نهائياً بنجاح!");
          await deleteStudent(id);
        } catch (e) {
          showMessage("حدث خطأ أثناء الحذف", "error");
        }
      }
    );
  };

  const handleDeleteSelectedStudents = () => {
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    if (selectedStudentIds.length === 0) return;
    confirmAction(
      "تأكيد حذف الطلاب المحددين نهائياً",
      `هل أنت متأكد من حذف عدد ${selectedStudentIds.length} طالب نهائياً دفعة واحدة؟ سيتم حذف بياناتهم نهائياً ولن يتم استرجاعها تلقائياً.`,
      async () => {
        try {
          const idsToDelete = [...selectedStudentIds];
          setSelectedStudentIds([]);
          setStudents(prev => prev.filter(s => !idsToDelete.includes(s.id)));
          showMessage("تم حذف الطلاب المحددين نهائياً بنجاح!");
          await deleteStudentsBatch(idsToDelete);
        } catch (e) {
          showMessage("حدث خطأ أثناء حذف الطلاب", "error");
        }
      }
    );
  };

  const handleDeleteSelectedTeachers = () => {
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    if (selectedTeacherIds.length === 0) return;
    confirmAction(
      "حذف المعلمين المحددين",
      `هل أنت متأكد من حذف عدد ${selectedTeacherIds.length} معلم دفعة واحدة؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف بياناتهم بشكل كامل.`,
      async () => {
        try {
          const idsToDelete = [...selectedTeacherIds];
          setSelectedTeacherIds([]);
          setTeachers(prev => prev.filter(t => !idsToDelete.includes(t.id)));
          showMessage("تم حذف المعلمين المحددين بنجاح!");
          await deleteTeachersBatch(idsToDelete);
        } catch (e) {
          showMessage("حدث خطأ أثناء حذف المعلمين", "error");
        }
      }
    );
  };

  // --- DRAG AND DROP FILE PARSING & IMPORTING ---
  
  // Student File processing
  const handleStudentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processStudentFile(file);
  };

  const processStudentFile = (file: File) => {
    setAttachedStudentFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith("#"));
      setParsedStudentNames(lines);
    };
    reader.readAsText(file);
  };

  const handleStudentImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    if (!newStudentGradeId || !newStudentClassId || parsedStudentNames.length === 0) {
      showMessage("يرجى التأكد من اختيار الصف والفصل ولصق أسماء الطلاب", "error");
      return;
    }
    setSubmitting(prev => ({ ...prev, importStudents: true }));
    if (setGlobalProgress) {
      setGlobalProgress({ active: true, type: "import", label: `جاري استيراد ومعالجة عدد ${parsedStudentNames.length} طالب للفصل...` });
    }
    try {
      setStatsLoading(true);
      
      const uniqueNamesInImport: string[] = [];
      const duplicatesInImport: string[] = [];
      const duplicatesWithDb: string[] = [];
      const seenNormalizedInBatch = new Set<string>();

      // Existing students in this class
      const existingClassStudents = students.filter(s => s.classId === newStudentClassId);
      const existingClassNamesSet = new Set(
        existingClassStudents.map(s => normalizeStudentName(s.name))
      );
      
      parsedStudentNames.forEach(name => {
        const trimmed = name.trim();
        if (!trimmed) return;
        
        const norm = normalizeStudentName(trimmed);

        // 1. Check if already exists in this class in database
        if (existingClassNamesSet.has(norm)) {
          if (!duplicatesWithDb.includes(trimmed)) {
            duplicatesWithDb.push(trimmed);
          }
          return;
        }

        // 2. Check if repeated multiple times inside the same pasted text / file
        if (seenNormalizedInBatch.has(norm)) {
          if (!duplicatesInImport.includes(trimmed)) {
            duplicatesInImport.push(trimmed);
          }
          return;
        }

        // Valid non-duplicate!
        seenNormalizedInBatch.add(norm);
        uniqueNamesInImport.push(trimmed);
      });
      
      const totalSkipped = duplicatesWithDb.length + duplicatesInImport.length;
      
      // CASE 1: All entered names are duplicates
      if (uniqueNamesInImport.length === 0) {
        const cls = classes.find(c => c.id === newStudentClassId);
        const className = cls ? cls.name : "الفصل المحدد";
        setAlertState({
          title: "تنبيه: جميع الأسماء المدخلة مكررة ⚠️",
          message: `تم فحص وتدقيق الأسماء المدخلة، وتبين أن جميعها (${totalSkipped} طالب) مكررة ومسجلة بالفعل في ${className} أو مكررة في القائمة المدخلة.\n\nتم تجاهل الإضافة بالكامل لتفادي تكرار الطلاب:\n${duplicatesWithDb.length > 0 ? `• مسجل مسبقاً في الفصل (${duplicatesWithDb.length}): ${duplicatesWithDb.join("، ")}\n` : ""}${duplicatesInImport.length > 0 ? `• مكرر في القائمة المدخلة (${duplicatesInImport.length}): ${duplicatesInImport.join("، ")}` : ""}`,
          type: "warning"
        });
        setPastedStudentsText("");
        setParsedStudentNames([]);
        return;
      }
      
      // CASE 2: Add non-duplicates
      const studentsList = uniqueNamesInImport.map(name => ({
        name: name,
        gradeId: newStudentGradeId,
        classId: newStudentClassId
      }));
      
      const createdStudents = await addStudentsBatch(studentsList);
      if (createdStudents && createdStudents.length > 0) {
        setStudents(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const toAdd = createdStudents.filter(s => !existingIds.has(s.id));
          return [...prev, ...toAdd].sort((a, b) => a.name.localeCompare(b.name, "ar"));
        });
      }
      setPastedStudentsText("");
      setParsedStudentNames([]);
      setShowAddStudentSection(false);
      
      // Close the loading modal immediately
      if (setGlobalProgress) {
        setGlobalProgress({ active: false, type: null, label: "" });
      }
      setSubmitting(prev => ({ ...prev, importStudents: false }));
      setStatsLoading(false);

      // Background refresh without blocking user UI
      onRefreshData().catch(() => {});
      
      // Notify user with clear notice if any duplicates were skipped
      if (totalSkipped > 0) {
        setAlertState({
          title: "تم الاستيراد بنجاح مع تجاهل الأسماء المكررة ✅",
          message: `تم بنجاح إضافة وتسجيل (${uniqueNamesInImport.length}) طالب جديد غير مكرر في الفصل.\n\n⚠️ ملاحظة: تم تجاهل عدد (${totalSkipped}) اسم مكرر تلقائياً لمنع التكرار في النظام:\n${duplicatesWithDb.length > 0 ? `• مسجل مسبقاً في الفصل (${duplicatesWithDb.length}): ${duplicatesWithDb.join("، ")}\n` : ""}${duplicatesInImport.length > 0 ? `• مكرر في القائمة المدخلة (${duplicatesInImport.length}): ${duplicatesInImport.join("، ")}` : ""}`,
          type: "warning"
        });
      } else {
        showMessage(`تم بنجاح استيراد وتسجيل جميع الطلاب (${uniqueNamesInImport.length} طالب) للفصل المحدد!`);
      }
    } catch (err) {
      console.error("Error importing students:", err);
      showMessage("حدث خطأ أثناء استيراد قائمة الطلاب", "error");
    } finally {
      setStatsLoading(false);
      setSubmitting(prev => ({ ...prev, importStudents: false }));
      if (setGlobalProgress) {
        setGlobalProgress({ active: false, type: null, label: "" });
      }
    }
  };

  // Teacher File processing
  const handleTeacherFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processTeacherFile(file);
  };

  const processTeacherFile = (file: File) => {
    setAttachedTeacherFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith("#"));
      setParsedTeacherNames(lines);
    };
    reader.readAsText(file);
  };

  const handleTeacherImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    if (parsedTeacherNames.length === 0) {
      showMessage("يرجى لصق أسماء المعلمين أولاً", "error");
      return;
    }
    setSubmitting(prev => ({ ...prev, importTeachers: true }));
    if (setGlobalProgress) {
      setGlobalProgress({ active: true, type: "import", label: `جاري استيراد ومعالجة عدد ${parsedTeacherNames.length} معلم للمدرسة...` });
    }
    try {
      setStatsLoading(true);
      
      const uniqueNamesInImport: string[] = [];
      const duplicatesInImport: string[] = [];
      const duplicatesWithDb: string[] = [];
      
      parsedTeacherNames.forEach(name => {
        const trimmed = name.trim();
        if (!trimmed) return;
        
        // Check if duplicate in the same import file/pasted list
        const isDupImport = uniqueNamesInImport.some(un => un.toLowerCase() === trimmed.toLowerCase());
        // Check if duplicate with already registered teachers in db
        const isDupDb = teachers.some(t => t.name.trim().toLowerCase() === trimmed.toLowerCase());
        
        if (isDupDb) {
          duplicatesWithDb.push(trimmed);
        } else if (isDupImport) {
          duplicatesInImport.push(trimmed);
        } else {
          uniqueNamesInImport.push(trimmed);
        }
      });
      
      const totalSkipped = duplicatesWithDb.length + duplicatesInImport.length;
      
      if (uniqueNamesInImport.length === 0) {
        if (setGlobalProgress) {
          setGlobalProgress({ active: false, type: null, label: "" });
        }
        setSubmitting(prev => ({ ...prev, importTeachers: false }));
        setStatsLoading(false);
        setAlertState({
          title: "تنبيه: كافة المعلمين مكررين ⚠️",
          message: `جميع الأسماء المدخلة (${totalSkipped} معلم) مكررة ومسجلة بالفعل في المدرسة أو مكررة في القائمة المدخلة. تم تجاهل الإضافة لتفادي التكرار.`,
          type: "warning"
        });
        setPastedTeachersText("");
        setParsedTeacherNames([]);
        return;
      }
      
      const createdTeachers = await addTeachersBatch(uniqueNamesInImport);
      if (createdTeachers && createdTeachers.length > 0) {
        setTeachers(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const toAdd = createdTeachers.filter(t => !existingIds.has(t.id));
          return [...prev, ...toAdd].sort((a, b) => a.name.localeCompare(b.name, "ar"));
        });
      }
      setPastedTeachersText("");
      setParsedTeacherNames([]);
      
      // Close modal immediately
      if (setGlobalProgress) {
        setGlobalProgress({ active: false, type: null, label: "" });
      }
      setSubmitting(prev => ({ ...prev, importTeachers: false }));
      setStatsLoading(false);

      // Background refresh
      onRefreshData().catch(() => {});
      
      if (totalSkipped > 0) {
        setAlertState({
          title: "تم الاستيراد بنجاح مع تجاهل المكررين 📋",
          message: `تم بنجاح استيراد وتثبيت عدد ${uniqueNamesInImport.length} معلم جديد بالمدرسة.\n\nتم تجاهل عدد ${totalSkipped} معلم مكرر ولم يتم إضافتهم منعاً للتكرار في قاعدة البيانات:\n• مكرر مع قاعدة البيانات: ${duplicatesWithDb.length > 0 ? duplicatesWithDb.join("، ") : "لا يوجد"}\n• مكرر في الملف المرفق: ${duplicatesInImport.length > 0 ? duplicatesInImport.join("، ") : "لا يوجد"}`,
          type: "warning"
        });
      } else {
        showMessage(`تم بنجاح استيراد وإضافة ${uniqueNamesInImport.length} معلم في المدرسة!`);
      }
    } catch (err) {
      showMessage("حدث خطأ أثناء استيراد قائمة المعلمين", "error");
    } finally {
      setStatsLoading(false);
      setSubmitting(prev => ({ ...prev, importTeachers: false }));
      if (setGlobalProgress) {
        setGlobalProgress({ active: false, type: null, label: "" });
      }
    }
  };

  // Grades & Classes Structural File processing
  const handleGradesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processGradesFile(file);
  };

  const processGradesFile = (file: File) => {
    setAttachedGradesFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith("#"));
      
      const parsed = lines.map(line => {
        const parts = line.split(",").map(p => p.trim());
        return {
          gradeName: parts[0],
          className: parts[1] || undefined
        };
      }).filter(item => item.gradeName);
      
      setParsedGradesStructure(parsed);
    };
    reader.readAsText(file);
  };

  const handleGradesImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGoogleAuthenticated) {
      onRequireGoogleLogin?.();
      return;
    }
    if (parsedGradesStructure.length === 0) {
      showMessage("يرجى إرفاق ملف الهيكل الأكاديمي المرفق أولاً", "error");
      return;
    }
    setSubmitting(prev => ({ ...prev, importGrades: true }));
    try {
      setStatsLoading(true);
      const gradeMap: Record<string, string> = {};
      grades.forEach(g => {
        gradeMap[g.name] = g.id;
      });

      for (const item of parsedGradesStructure) {
        let gradeId = gradeMap[item.gradeName];
        if (!gradeId) {
          gradeId = await addGrade(item.gradeName);
          gradeMap[item.gradeName] = gradeId;
        }
        if (item.className) {
          const classExists = classes.some(c => c.gradeId === gradeId && c.name === item.className);
          if (!classExists) {
            await addClass(item.className, gradeId);
          }
        }
      }
      setAttachedGradesFile(null);
      setParsedGradesStructure([]);
      await onRefreshData();
      showMessage("تم استيراد هيكل الصفوف والفصول المرفقة بنجاح!");
    } catch (err) {
      showMessage("حدث خطأ أثناء استيراد الهيكل الأكاديمي", "error");
    } finally {
      setStatsLoading(false);
      setSubmitting(prev => ({ ...prev, importGrades: false }));
    }
  };

  // Search filter
  const filteredStudents = students.filter(student => {
    const term = studentSearchQuery.trim().toLowerCase();
    if (!term) return true;
    return student.name.toLowerCase().includes(term);
  });

  // --- UNATHENTICATED PIN SCREEN ---
  if (!isAuthenticated && !isReadOnly) {
    return (
      <div id="admin-pin-screen" className="max-w-md mx-auto bg-white rounded-2xl shadow-md border border-slate-100 p-8 text-center space-y-6 mt-12">
        <div className="mx-auto bg-blue-50 text-blue-600 p-4 rounded-full w-fit">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-800">صلاحيات الإدارة والتحكم</h2>
          <p className="text-xs text-slate-500 mt-2">يرجى إدخال رمز المرور السري للتحكم بإعدادات الفصول والطلاب</p>
        </div>

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <input
            type="password"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="w-full bg-slate-50 border-2 border-slate-100 focus:border-blue-500 rounded-xl py-3 text-center text-lg font-bold text-slate-800 tracking-widest focus:outline-none"
          />
          {pinError && <p className="text-2xs text-rose-500 font-extrabold">{pinError}</p>}
          
          <button
            type="submit"
            disabled={submitting.pin}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition"
          >
            {submitting.pin ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
            <span>{submitting.pin ? "جاري التحقق..." : "تأكيد تسجيل الدخول كمدير"}</span>
          </button>
        </form>

        <p className="text-3xs text-slate-400 font-semibold">رمز المرور الافتراضي للتقييم هو: 1234</p>
      </div>
    );
  }

  // Dynamic Onboarding Step Calculation
  let currentStep = 1;
  if (grades.length === 0 || classes.length === 0) {
    if (activeSubTab !== "students") {
      currentStep = 1;
    } else if (!showStructureManager) {
      currentStep = 2;
    } else if (grades.length === 0) {
      currentStep = 3;
    } else {
      currentStep = 4;
    }
  } else if (students.length === 0) {
    if (activeSubTab !== "students") {
      currentStep = 1;
    } else {
      currentStep = 6;
    }
  } else if (teachers.length === 0) {
    if (activeSubTab !== "teachers") {
      currentStep = 7;
    } else {
      currentStep = 7.5;
    }
  } else {
    currentStep = 8; // Completed all steps!
  }

  // --- MAIN ADMIN SYSTEM DISPLAY (WIDE RESPONSIVE SCREEN) ---
  if (!isGoogleAuthenticated) {
    return (
      <div id="admin-main-panel" className="w-full space-y-6 pb-12">
        <div className="w-full max-w-lg mx-auto my-12 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-lg text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-3xl shadow-inner">
            🔒
          </div>
          <div className="space-y-2">
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              تسجيل الدخول مطلوب
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-sm mx-auto">
              لحماية خصوصية البيانات وسجلات المدرسة والطلاب، يجب تسجيل الدخول بحساب Google لاستعراض بيانات المدرسة.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onRequireGoogleLogin}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md shadow-indigo-600/25 transition-all transform hover:scale-[1.02] cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.258-3.133C18.29 1.41 15.538 0 12.24 0c-6.63 0-12 5.37-12 12s5.37 12 12 12c6.93 0 11.52-4.875 11.52-11.72 0-.788-.08-1.39-.18-1.995H12.24z"
                />
              </svg>
              <span>تسجيل الدخول بحساب Google</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="admin-main-panel" className="w-full space-y-6 pb-12">
      
      {/* Toast Feedback */}
      {actionMessage && (
        <div className={`p-4 rounded-xl text-center text-sm font-bold border fixed top-4 left-4 right-4 z-50 shadow-md md:left-auto md:w-96 transition-all ${
          actionMessage.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-rose-50 text-rose-800 border-rose-200"
        }`}>
          {actionMessage.text}
        </div>
      )}





      {/* SUB-TAB 1: STATISTICS & ANALYTICS */}
      {activeSubTab === "stats" && (
        <div className="space-y-4 animate-fadeIn">
          {/* Main Site Header Title */}
          <div id="main-site-header-title" className="bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-slate-50/60 border border-indigo-100/80 rounded-xl py-2.5 px-4 text-right shadow-3xs flex flex-wrap items-center justify-between gap-2 print:hidden" dir="rtl">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <h2 className="text-sm md:text-base font-black text-indigo-950">
                {schoolName ? `متابعة الغياب والنسب - ${schoolName}` : "متابعة الغياب والنسب"}
              </h2>
            </div>
            <span className="text-xs font-bold text-indigo-600/90 bg-white/80 border border-indigo-100 px-3 py-1 rounded-lg shadow-3xs">
              {schoolName ? `منصة ${schoolName} لرصد ومتابعة الغياب` : "منصة رصد ومتابعة الغياب للطلاب"}
            </span>
          </div>

          {/* Sub-navigation Tabs & Print bar - Sticky Top on Scroll */}
          <div className="sticky top-14 md:top-16 z-20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200/90 shadow-sm print:hidden">
            {/* Condensed Tabs Selector */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg" dir="rtl">
              <button
                type="button"
                onClick={() => setActiveStatsTab("attendance")}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black flex items-center gap-1 transition-all duration-200 cursor-pointer ${
                  activeStatsTab === "attendance"
                    ? "bg-white text-rose-700 shadow-3xs border border-slate-200/50"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span>الغياب</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStatsTab("morning_delay")}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                  activeStatsTab === "morning_delay"
                    ? "bg-white text-amber-700 shadow-3xs border border-slate-200/50"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span>⏰</span>
                <span>التاخر الصباحي</span>
                {morningDelaysList.length > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-amber-200">
                    {morningDelaysList.filter(d => d.date === (delayDateFilter === "all" ? d.date : (delayDateFilter || getTodayDateString()))).length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveStatsTab("selected_attendance")}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black flex items-center gap-1 transition-all duration-200 cursor-pointer ${
                  activeStatsTab === "selected_attendance"
                    ? "bg-white text-blue-700 shadow-3xs border border-slate-200/50"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span>🔍</span>
                <span>غياب محدد</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStatsTab("student_report")}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black flex items-center gap-1 transition-all duration-200 cursor-pointer ${
                  activeStatsTab === "student_report"
                    ? "bg-white text-emerald-700 shadow-3xs border border-slate-200/50"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span>📋</span>
                <span>تقرير الطالب</span>
              </button>
            </div>

            {/* Actions: Print Action */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeStatsTab === "selected_attendance") {
                    handlePrintSelectedAttendance();
                  } else if (activeStatsTab === "morning_delay") {
                    const filtered = morningDelaysList.filter(d => {
                      if (delayDateFilter && d.date !== delayDateFilter) return false;
                      if (delayGradeFilter !== "all" && d.gradeId !== delayGradeFilter) return false;
                      if (delayClassFilter !== "all" && d.classId !== delayClassFilter) return false;
                      if (delaySearchFilter.trim()) {
                        const term = delaySearchFilter.trim().toLowerCase();
                        return (d.studentName || "").toLowerCase().includes(term) || (d.recordedBy || "").toLowerCase().includes(term);
                      }
                      return true;
                    });
                    handlePrintMorningDelays(filtered);
                  } else {
                    window.print();
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-98 transition-all cursor-pointer"
              >
                <span>🖨️</span>
                <span>
                  {activeStatsTab === "selected_attendance" 
                    ? "طباعة الغياب المحدد" 
                    : activeStatsTab === "morning_delay"
                    ? "طباعة كشف المتأخرين"
                    : "طباعة الملخص"}
                </span>
              </button>
            </div>
          </div>

          {/* TAB CONTENT: DAILY ATTENDANCE (DYNAMIC COLUMNS / LIST FOR ALL GRADES) */}
          {activeStatsTab === "attendance" && (
            <div className="space-y-4 animate-fadeIn">
              {/* Date Selector Filter Bar for Daily Attendance (Selected Day) */}
              <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 shadow-3xs flex flex-wrap items-center justify-between gap-3 print:hidden" dir="rtl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <span className="text-base">🗓️</span>
                    <span>تاريخ عرض الغياب:</span>
                  </span>
                  <input
                    type="date"
                    value={selectedAttendanceDate}
                    onChange={(e) => setSelectedAttendanceDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-3xs"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedAttendanceDate(getTodayDateString())}
                    className={`text-[11px] font-black px-3 py-1.5 rounded-xl border transition cursor-pointer shadow-3xs ${
                      selectedAttendanceDate === getTodayDateString()
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                    title="الرجوع إلى تاريخ اليوم الحالي"
                  >
                    {selectedAttendanceDate === getTodayDateString() ? "✓ اليوم الحالي" : "الرجوع لليوم الحالي"}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-slate-500 font-bold">عرض غياب يوم:</span>
                  <span className="bg-blue-50 text-blue-900 border border-blue-200/80 px-2.5 py-1 rounded-lg font-black shadow-3xs">
                    {getFormattedArabicDate(selectedAttendanceDate)}
                  </span>
                  <span className="bg-rose-50 text-rose-700 border border-rose-200/80 px-2.5 py-1 rounded-lg font-black shadow-3xs">
                    {todayStats.absentCount} طالب غائب
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
              {grades.map(grade => {
                const normGName = normalizeArabic(grade.name);
                let allGradeEntries = todayStats.entriesByGrade[grade.id] || [];
                if (allGradeEntries.length === 0) {
                  allGradeEntries = todayStats.entriesByGrade[normGName] || [];
                }
                if (allGradeEntries.length === 0) {
                  if (normGName.includes("اول") || normGName.includes("أول")) allGradeEntries = todayStats.g1Entries || [];
                  else if (normGName.includes("ثان")) allGradeEntries = todayStats.g2Entries || [];
                  else if (normGName.includes("ثالث")) allGradeEntries = todayStats.g3Entries || [];
                }
                // Exclude morning delay entries from the attendance tab (only show classroom absences and class lates)
                const rawGradeEntries = allGradeEntries.filter((e: any) => !e.isMorningDelay);
                
                // Helper to get robust canonical key for a student to prevent duplicate names
                const getCanonicalStudentKey = (entry: any): string => {
                  if (entry.isNoAbsenceDummy) return `no_abs_${entry.id || Math.random()}`;
                  const rawName = (entry.studentName || "").trim();
                  const normName = normalizeArabic(rawName).replace(/\s+/g, ' ');
                  const rawId = (entry.studentId || "").trim();

                  if (rawId) {
                    const matchedById = students.find(s => s && (s.id === rawId || s.name === rawId));
                    if (matchedById) return `sid_${matchedById.id}`;
                  }
                  if (normName) {
                    const matchedByName = students.find(s => s && normalizeArabic(s.name || "").replace(/\s+/g, ' ') === normName);
                    if (matchedByName) return `sid_${matchedByName.id}`;
                  }
                  if (normName) return `name_${normName}`;
                  return rawId ? `raw_${rawId}` : `entry_${entry.id}`;
                };

                // Display all absent and late students across all periods for the selected date
                const seenPair = new Set<string>();
                const displayEntries = rawGradeEntries.filter((e: any) => {
                  if (e.isNoAbsenceDummy) return true;
                  const key = `${getCanonicalStudentKey(e)}_${e.periodCode}`;
                  if (seenPair.has(key)) return false;
                  seenPair.add(key);
                  return true;
                });

                // Sort display entries: First by Period (الحصة), Second by Class (الفصل), Third by Student Name (اسم الطالب)
                displayEntries.sort((a: any, b: any) => {
                  const pNumAStr = getPeriodNum(a.periodCode || a.period || "");
                  const pNumBStr = getPeriodNum(b.periodCode || b.period || "");
                  let periodA = (pNumAStr === "صباحي" || pNumAStr === "ص" || pNumAStr === "طابور" || a.isMorningDelay) ? 0 : parseInt(pNumAStr, 10);
                  let periodB = (pNumBStr === "صباحي" || pNumBStr === "ص" || pNumBStr === "طابور" || b.isMorningDelay) ? 0 : parseInt(pNumBStr, 10);
                  if (isNaN(periodA)) periodA = 999;
                  if (isNaN(periodB)) periodB = 999;

                  if (periodA !== periodB) {
                    return periodA - periodB;
                  }

                  const numAStr = getClassNum(a.classCode || "");
                  const numBStr = getClassNum(b.classCode || "");
                  let classA = parseInt(numAStr, 10);
                  let classB = parseInt(numBStr, 10);

                  if (isNaN(classA)) {
                    const idx = classes.findIndex(c => c.id === a.classId);
                    classA = idx !== -1 ? idx + 1 : 999;
                  }
                  if (isNaN(classB)) {
                    const idx = classes.findIndex(c => c.id === b.classId);
                    classB = idx !== -1 ? idx + 1 : 999;
                  }

                  if (classA !== classB) {
                    return classA - classB;
                  }

                  return (a.studentName || "").localeCompare(b.studentName || "", "ar");
                });

                const gradeClasses = classes.filter(c => c.gradeId === grade.id);
                // Unique students counts or total counts
                const absentEntriesCount = displayEntries.filter((e: any) => !e.isNoAbsenceDummy && e.isAbsent).length;
                const lateEntriesCount = displayEntries.filter((e: any) => e.isLate).length;
                return (
                  <div key={grade.id} className="flex flex-col rounded-2xl shadow-sm bg-white border border-slate-200 hover:shadow-md transition-all duration-200 overflow-hidden">
                    {/* Card Header: Grade Title + Classrooms */}
                    <div className="rounded-t-2xl overflow-hidden">
                      <div className="bg-[#1e40af] text-white px-3.5 py-2 flex items-center justify-between border-b border-blue-900/20 shadow-3xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-black">{grade.name}</span>
                          <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center justify-center shadow-3xs">
                            {absentEntriesCount} غياب
                          </span>
                          {lateEntriesCount > 0 && (
                            <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center justify-center shadow-3xs">
                              {lateEntriesCount} متأخر
                            </span>
                          )}
                        </div>
                        <span className="bg-blue-700/90 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                          {getFormattedArabicDate(selectedAttendanceDate)}
                        </span>
                      </div>

                      {/* All classrooms/sections list bar */}
                      <div className="bg-[#172554] px-3 py-1.5 flex items-center justify-center gap-1.5 border-b border-blue-900/40 flex-wrap">
                        {gradeClasses.length === 0 ? (
                          <span className="text-[9px] text-blue-300/80 font-bold">لا توجد فصول مسجلة</span>
                        ) : (
                          gradeClasses.map(cls => {
                            const cCode = getClassCode(cls.name);
                            const count = displayEntries.filter((entry: any) => entry.classId === cls.id && (entry.isAbsent || entry.isLate)).length;
                            const hasAbsence = count > 0;
                            return (
                              <span
                                key={cls.id}
                                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border flex items-center gap-1 shadow-3xs transition ${
                                hasAbsence
                                    ? "bg-rose-50 text-rose-700 border-rose-200 font-black"
                                    : "bg-slate-50/10 text-slate-300 border-slate-700/50 hover:bg-slate-50/20"
                                }`}
                              >
                                <span>{cCode}:</span>
                                <span>({count})</span>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="bg-white flex-1">
                      {/* DESKTOP VIEW: Full Data Table (Hidden on small mobile screens) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-right text-xs" dir="rtl">
                          <thead className="bg-slate-100 text-slate-700 font-extrabold text-[10px] border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-1 text-center w-6">#</th>
                              <th className="py-2 px-1 text-right font-black w-12">الوقت</th>
                              <th className="py-2 px-1.5 text-right font-black">اسم الطالب</th>
                              <th className="py-2 px-0.5 text-center font-black w-10">الفصل</th>
                              <th className="py-2 px-0.5 text-center font-black">الحصة</th>
                              <th className="py-2 px-1 text-right font-black w-24">المعلم المعتمد</th>
                              {!isReadOnly && <th className="py-2 px-0.5 text-center w-8">⚙️</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {displayEntries.length === 0 ? (
                              <tr>
                                <td colSpan={isReadOnly ? 6 : 7} className="py-10 text-center text-slate-400 font-black">
                                  <span className="underline decoration-dashed underline-offset-4 decoration-slate-300">لا يوجد غياب مسجل لهذا الصف اليوم 👍</span>
                                </td>
                              </tr>
                            ) : (
                              displayEntries.map((entry: any, index: number) => {
                                const periodsToRender: string[] = entry.allPeriodCodes && entry.allPeriodCodes.length > 0 
                                  ? entry.allPeriodCodes 
                                  : [entry.periodCode];

                                return (
                                <tr 
                                  key={entry.id || `${entry.studentId}-${index}`} 
                                  className={`transition ${
                                    entry.isNoAbsenceDummy 
                                      ? "bg-emerald-50/60 hover:bg-emerald-100/80 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30" 
                                      : entry.isLate
                                        ? "bg-amber-50/40 hover:bg-amber-100/60"
                                        : "hover:bg-slate-50/70"
                                  }`}
                                >
                                  <td className="py-1 px-1 text-center font-bold text-slate-400">
                                    <div className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto text-[9px] font-black">
                                      {index + 1}
                                    </div>
                                  </td>
                                  <td className="py-1 px-1 font-medium text-slate-500 text-[9.5px] whitespace-nowrap">{entry.time}</td>
                                  <td className="py-1 px-1.5">
                                    <div className="flex items-center gap-1 min-w-0">
                                      {entry.isNoAbsenceDummy ? (
                                        <span 
                                          className="bg-emerald-600 text-white font-extrabold text-[9.5px] px-1.5 py-0.5 rounded inline-block text-center shadow-3xs whitespace-nowrap"
                                          title={entry.studentName}
                                        >
                                          {entry.studentName}
                                        </span>
                                      ) : entry.isMorningDelay ? (
                                        <div className="flex items-center gap-1 min-w-0">
                                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[8.5px] font-black px-1 py-0.2 rounded shrink-0">
                                            تأخر صباحي
                                          </span>
                                          <span className="font-bold text-slate-900 text-[10px] truncate block" title={entry.studentName}>
                                            {entry.studentName}
                                          </span>
                                        </div>
                                      ) : entry.isLate ? (
                                        <div className="flex items-center gap-1 min-w-0">
                                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[8.5px] font-black px-1 py-0.2 rounded shrink-0">
                                            متأخر
                                          </span>
                                          <span className="font-bold text-slate-900 text-[10px] truncate block" title={entry.studentName}>
                                            {entry.studentName}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 min-w-0">
                                          <span className="font-bold text-slate-900 text-[10px] truncate block" title={entry.studentName}>
                                            {entry.studentName}
                                          </span>
                                          {entry.occurrences > 1 && (
                                            <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-1 py-0.2 rounded shrink-0" title={`مسجل في ${entry.occurrences} حصص`}>
                                              ({entry.occurrences} حصص)
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  {/* Class column before Period column */}
                                  <td className="py-1 px-0.5 text-center">
                                    <span className={`font-extrabold text-[9.5px] w-4.5 h-4.5 rounded flex items-center justify-center border shadow-3xs mx-auto ${getClassBadgeStyles(getClassNum(entry.classCode))}`} title="الفصل">
                                      {getClassNum(entry.classCode)}
                                    </span>
                                  </td>
                                  {/* Period column - visible even when no absence */}
                                  <td className="py-1 px-0.5 text-center">
                                    <div className="flex items-center justify-center gap-0.5 flex-wrap">
                                      {periodsToRender && periodsToRender.length > 0 && periodsToRender.some((p: string) => Boolean(p)) ? (
                                        periodsToRender.filter(Boolean).map((pCode: string, pIdx: number) => (
                                          <span 
                                            key={pIdx} 
                                            className={`font-extrabold text-[9.5px] w-4.5 h-4.5 rounded flex items-center justify-center border shadow-3xs ${getPeriodBadgeStyles(getPeriodNum(pCode))}`} 
                                            title={`حصة ${getPeriodNum(pCode)}`}
                                          >
                                            {getPeriodNum(pCode)}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-slate-400 text-[9.5px]">-</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-1 px-1 text-slate-600 font-medium text-[9.5px] whitespace-nowrap truncate max-w-[100px]" title={entry.allTeachers ? entry.allTeachers.join("، ") : entry.teacherName}>
                                    {entry.allTeachers && entry.allTeachers.length > 1 
                                      ? entry.allTeachers.join("، ") 
                                      : entry.teacherName}
                                  </td>
                                  {!isReadOnly && (
                                    <td className="py-1 px-0.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (entry.recordIds && entry.recordIds.length > 0) {
                                            entry.recordIds.forEach((rId: string) => {
                                              handleDeleteAbsence(rId, entry.studentId, entry.isAbsent);
                                            });
                                          } else {
                                            handleDeleteAbsence(entry.recordId, entry.studentId, entry.isAbsent);
                                          }
                                        }}
                                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-slate-100 transition cursor-pointer"
                                        title="حذف هذا التسجيل"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* MOBILE TOUCH CARDS VIEW (Clean, touch-friendly, optimized for small screens) */}
                      <div className="block md:hidden divide-y divide-slate-100 p-2">
                        {displayEntries.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 font-black text-xs">
                            لا يوجد غياب مسجل لهذا الصف اليوم 👍
                          </div>
                        ) : (
                          displayEntries.map((entry: any, index: number) => {
                            const periodsToRender: string[] = entry.allPeriodCodes && entry.allPeriodCodes.length > 0 
                              ? entry.allPeriodCodes 
                              : [entry.periodCode];

                            return (
                            <div 
                              key={entry.id || `${entry.studentId}-${index}`} 
                              className={`p-3 rounded-xl mb-1.5 transition-all ${
                                entry.isNoAbsenceDummy 
                                  ? "bg-emerald-50/70 border border-emerald-200/80" 
                                  : entry.isLate
                                    ? "bg-amber-50/80 border border-amber-200"
                                    : "bg-slate-50/60 border border-slate-200/60 hover:bg-slate-100/70"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black shrink-0">
                                    {index + 1}
                                  </span>
                                  <div className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                                    {entry.isNoAbsenceDummy ? (
                                      <span className="text-emerald-700">{entry.studentName}</span>
                                    ) : entry.isMorningDelay ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="bg-amber-200/80 text-amber-900 text-[9.5px] font-black px-1.5 py-0.2 rounded">تأخر صباحي</span>
                                        <span>{entry.studentName}</span>
                                      </div>
                                    ) : entry.isLate ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="bg-amber-200/80 text-amber-900 text-[9.5px] font-black px-1.5 py-0.2 rounded">متأخر</span>
                                        <span>{entry.studentName}</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <span>{entry.studentName}</span>
                                        {entry.occurrences > 1 && (
                                          <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-1.5 py-0.2 rounded">
                                            ({entry.occurrences} حصص)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {!isReadOnly && !entry.isNoAbsenceDummy && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (entry.recordIds && entry.recordIds.length > 0) {
                                        entry.recordIds.forEach((rId: string) => {
                                          handleDeleteAbsence(rId, entry.studentId, entry.isAbsent);
                                        });
                                      } else {
                                        handleDeleteAbsence(entry.recordId, entry.studentId, entry.isAbsent);
                                      }
                                    }}
                                    className="text-slate-400 hover:text-rose-600 p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg active:bg-rose-50"
                                    title="حذف هذا التسجيل"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              <div className="mt-2 pt-2 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-black text-[10px] px-2 py-0.5 rounded-md border ${getClassBadgeStyles(getClassNum(entry.classCode))}`}>
                                    فصل {getClassNum(entry.classCode)}
                                  </span>
                                  {periodsToRender.map((pCode: string, pIdx: number) => (
                                    <span key={pIdx} className={`font-black text-[10px] px-2 py-0.5 rounded-md border ${getPeriodBadgeStyles(getPeriodNum(pCode))}`}>
                                      حصة {getPeriodNum(pCode)}
                                    </span>
                                  ))}
                                </div>

                                <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px]">
                                  <span>{entry.allTeachers && entry.allTeachers.length > 1 ? entry.allTeachers.join("، ") : entry.teacherName}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="font-mono text-slate-400">{entry.time}</span>
                                </div>
                              </div>
                            </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* TAB CONTENT: MORNING DELAY (التاخر الصباحي) */}
          {activeStatsTab === "morning_delay" && (() => {
            const filteredDelays = morningDelaysList.filter(d => {
              if (delayDateFilter && delayDateFilter !== "all" && d.date !== delayDateFilter) return false;
              if (delayGradeFilter !== "all" && d.gradeId !== delayGradeFilter) return false;
              if (delayClassFilter !== "all" && d.classId !== delayClassFilter) return false;
              if (delaySearchFilter.trim()) {
                const term = delaySearchFilter.trim().toLowerCase();
                const matchName = (d.studentName || "").toLowerCase().includes(term);
                const matchTeacher = (d.recordedBy || "").toLowerCase().includes(term);
                const matchReason = (d.reason || "").toLowerCase().includes(term);
                return matchName || matchTeacher || matchReason;
              }
              return true;
            });

            const uniqueLateStudentIds = new Set(filteredDelays.map(d => d.studentId));
            const availableClassesForFilter = delayGradeFilter === "all" ? classes : classes.filter(c => c.gradeId === delayGradeFilter);

            return (
              <div className="bg-white rounded-2xl shadow-3xs border border-slate-100 p-5 space-y-5 animate-fadeIn" dir="rtl">
                {/* Header & Quick stats */}
                <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <span className="p-1.5 bg-amber-500 text-white rounded-lg text-xs">⏰</span>
                      <span className="bg-amber-100 text-amber-900 text-xs font-black px-2.5 py-0.5 rounded-full border border-amber-200">
                        {filteredDelays.length} حالة تأخر
                      </span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePrintMorningDelays(filteredDelays)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 transition cursor-pointer shrink-0"
                    >
                      <span>🖨️</span>
                      <span>طباعة الكشف</span>
                    </button>
                  </div>
                </div>

                {/* Filter Controls Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/60">
                  {/* Date Filter */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                      🗓️ تاريخ العرض:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={delayDateFilter === "all" ? "" : delayDateFilter}
                        onChange={(e) => setDelayDateFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setDelayDateFilter(delayDateFilter === "all" ? getTodayDateString() : "all")}
                        className={`text-[10px] font-black px-2 py-1.5 rounded-lg border whitespace-nowrap transition cursor-pointer ${
                          delayDateFilter === "all"
                            ? "bg-amber-500 text-white border-amber-600"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                        title="عرض جميع التواريخ"
                      >
                        {delayDateFilter === "all" ? "اليوم" : "الكل"}
                      </button>
                    </div>
                  </div>

                  {/* Grade Filter */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                      🏫 الصف الدراسي:
                    </label>
                    <select
                      value={delayGradeFilter}
                      onChange={(e) => {
                        setDelayGradeFilter(e.target.value);
                        setDelayClassFilter("all");
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="all">جميع الصفوف</option>
                      {grades.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Class Filter */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                      🚪 الفصل:
                    </label>
                    <select
                      value={delayClassFilter}
                      onChange={(e) => setDelayClassFilter(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="all">جميع الفصول</option>
                      {availableClassesForFilter.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Student/Search filter */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                      🔍 بحث بالاسم:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="ابحث باسم الطالب..."
                        value={delaySearchFilter}
                        onChange={(e) => setDelaySearchFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg pr-3 pl-8 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      {delaySearchFilter && (
                        <button
                          type="button"
                          onClick={() => setDelaySearchFilter("")}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary badges */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="bg-amber-50 text-amber-800 border border-amber-200/80 px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5">
                    <span>👥</span>
                    <span>الطلاب المتأخرين:</span>
                    <span className="bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-md font-black">
                      {uniqueLateStudentIds.size} طالب
                    </span>
                  </div>
                  <div className="bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <span>🗓️</span>
                    <span>تاريخ العرض:</span>
                    <span className="font-extrabold text-slate-900">{delayDateFilter || getTodayDateString()}</span>
                  </div>
                  {delayDateFilter !== getTodayDateString() && (
                    <button
                      type="button"
                      onClick={() => setDelayDateFilter(getTodayDateString())}
                      className="text-amber-700 hover:text-amber-800 text-xs font-black underline cursor-pointer"
                    >
                      الرجوع لتاريخ اليوم 👈
                    </button>
                  )}
                </div>

                {/* Table of Late Students (Desktop) and Cards (Mobile) */}
                <div className="rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden bg-white">
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-amber-500 text-white text-xs font-black">
                          <th className="py-2.5 px-3 text-center w-12">#</th>
                          <th className="py-2.5 px-3">اسم الطالب</th>
                          <th className="py-2.5 px-3 text-center">الصف الدراسي</th>
                          <th className="py-2.5 px-3 text-center">الفصل</th>
                          <th className="py-2.5 px-3 text-center">وقت الحضور</th>
                          <th className="py-2.5 px-3 text-center">السبب / العذر</th>
                          <th className="py-2.5 px-3 text-center">المشرف المسجل</th>
                          {!isReadOnly && <th className="py-2.5 px-3 text-center w-16">إجراء</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredDelays.length === 0 ? (
                          <tr>
                            <td colSpan={isReadOnly ? 7 : 8} className="py-12 text-center text-slate-400 font-bold bg-white">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <span className="text-3xl">⏰✨</span>
                                <span className="text-sm font-black text-slate-600">لا يوجد طلاب متأخرين مسجلين في هذا التاريخ أو الفلتر</span>
                                <p className="text-2xs text-slate-400">
                                  يمكنك رصد التأخر الصباحي مباشرة من بوابة "التأخر الصباحي" في القائمة الرئيسية.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredDelays.map((entry, index) => (
                            <tr key={entry.id || index} className="hover:bg-amber-50/40 transition-colors">
                              <td className="py-2.5 px-3 text-center font-bold text-slate-400">{index + 1}</td>
                              <td className="py-2.5 px-3 font-extrabold text-slate-900 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                  <span>{entry.studentName}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
                                {entry.gradeName || "-"}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
                                {entry.className || "-"}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="font-extrabold text-amber-800 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-md dir-ltr inline-block">
                                  {entry.arrivalTime || "-"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                {!isReadOnly ? (
                                  (() => {
                                    const isCurrentlyExcused = Boolean(entry.reason && entry.reason.includes("عذر") && !entry.reason.includes("بدون"));
                                    return (
                                      <div className={`inline-flex items-center justify-center gap-1.5 p-1 rounded-lg border transition-all ${
                                        isCurrentlyExcused ? "bg-emerald-50/50 border-emerald-200" : "bg-slate-50 border-slate-200"
                                      }`}>
                                        {/* Quick Status Toggle Button */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextReason = isCurrentlyExcused ? "بدون عذر" : "بعذر";
                                            handleChangeDelayReason(entry.id, nextReason);
                                          }}
                                          className={`px-2.5 py-1 rounded-md text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shadow-3xs active:scale-95 ${
                                            isCurrentlyExcused
                                              ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-1 ring-emerald-400"
                                              : "bg-amber-500 hover:bg-amber-600 text-white ring-1 ring-amber-400"
                                          }`}
                                          title={isCurrentlyExcused ? "الحالة الحالية: بعذر (انقر للتحويل إلى بدون عذر وتعطيل القائمة)" : "الحالة الحالية: بدون عذر (انقر للتحويل إلى بعذر وتفعيل القائمة)"}
                                        >
                                          <span>{isCurrentlyExcused ? "✓ بعذر" : "✕ بدون عذر"}</span>
                                        </button>

                                        {/* Quick Selection Dropdown - enabled only when excused */}
                                        <select
                                          value={isCurrentlyExcused ? (entry.reason || "بعذر") : "بدون عذر"}
                                          disabled={!isCurrentlyExcused}
                                          onChange={(e) => handleChangeDelayReason(entry.id, e.target.value)}
                                          className={`text-[10px] font-extrabold rounded px-1.5 py-0.5 outline-none transition-all ${
                                            isCurrentlyExcused
                                              ? "bg-white text-emerald-900 border border-emerald-300 cursor-pointer hover:border-emerald-500 shadow-3xs"
                                              : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                                          }`}
                                          title={isCurrentlyExcused ? "اختيار نوع العذر" : "القائمة معطلة لأن الحالة (بدون عذر) - اضغط على الزر لتفعيلها"}
                                        >
                                          <option value="بعذر">بعذر (عام)</option>
                                          <option value="عذر طبي">عذر طبي</option>
                                          <option value="ظروف أسرية">ظروف أسرية</option>
                                          <option value="أزمة مواصلات">أزمة مواصلات</option>
                                          <option value="استيقاظ متأخر">استيقاظ متأخر</option>
                                        </select>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                                    entry.reason && entry.reason.includes("عذر") && !entry.reason.includes("بدون")
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}>
                                    {entry.reason || "بدون عذر"}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-600 whitespace-nowrap">
                                {entry.recordedBy || "-"}
                              </td>
                              {!isReadOnly && (
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMorningDelay(entry.id, entry.studentName, entry.studentId, entry.date)}
                                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                    title="حذف هذا التسجيل"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Touch Cards View */}
                  <div className="block md:hidden divide-y divide-slate-100 p-2.5">
                    {filteredDelays.length === 0 ? (
                      <div className="py-10 text-center text-slate-400 font-black text-xs">
                        لا يوجد طلاب متأخرين مسجلين في هذا الفلتر
                      </div>
                    ) : (
                      filteredDelays.map((entry, index) => (
                        <div key={entry.id || index} className="p-3 bg-amber-50/40 rounded-xl mb-2 border border-amber-200/60">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                                {index + 1}
                              </span>
                              <div>
                                <span className="font-extrabold text-slate-900 text-xs sm:text-sm block">
                                  {entry.studentName}
                                </span>
                                <span className="text-[10px] text-slate-500 font-bold">
                                  {entry.gradeName} • {entry.className}
                                </span>
                              </div>
                            </div>

                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMorningDelay(entry.id, entry.studentName, entry.studentId, entry.date)}
                                className="text-slate-400 hover:text-rose-600 p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg active:bg-rose-50"
                                title="حذف هذا التسجيل"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-amber-200/50 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="bg-amber-100 text-amber-900 font-black text-[10px] px-2 py-0.5 rounded-md border border-amber-300 dir-ltr">
                                ⏰ {entry.arrivalTime || "-"}
                              </span>
                              {!isReadOnly ? (
                                (() => {
                                  const isCurrentlyExcused = Boolean(entry.reason && entry.reason.includes("عذر") && !entry.reason.includes("بدون"));
                                  return (
                                    <div className={`inline-flex items-center gap-1 p-0.5 rounded-md border transition-all ${
                                      isCurrentlyExcused ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200"
                                    }`}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextReason = isCurrentlyExcused ? "بدون عذر" : "بعذر";
                                          handleChangeDelayReason(entry.id, nextReason);
                                        }}
                                        className={`px-2 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                                          isCurrentlyExcused
                                            ? "bg-emerald-600 text-white"
                                            : "bg-amber-500 text-white"
                                        }`}
                                      >
                                        {isCurrentlyExcused ? "✓ بعذر" : "✕ بدون عذر"}
                                      </button>
                                      <select
                                        value={isCurrentlyExcused ? (entry.reason || "بعذر") : "بدون عذر"}
                                        disabled={!isCurrentlyExcused}
                                        onChange={(e) => handleChangeDelayReason(entry.id, e.target.value)}
                                        className={`text-[9.5px] font-bold border-none outline-none ${
                                          isCurrentlyExcused
                                            ? "bg-transparent text-emerald-950 cursor-pointer"
                                            : "bg-transparent text-slate-400 cursor-not-allowed opacity-50"
                                        }`}
                                      >
                                        <option value="بعذر">بعذر (عام)</option>
                                        <option value="عذر طبي">عذر طبي</option>
                                        <option value="ظروف أسرية">ظروف أسرية</option>
                                        <option value="أزمة مواصلات">أزمة مواصلات</option>
                                        <option value="استيقاظ متأخر">استيقاظ متأخر</option>
                                      </select>
                                    </div>
                                  );
                                })()
                              ) : (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                  entry.reason && entry.reason.includes("عذر") && !entry.reason.includes("بدون")
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-100/80 text-amber-800 border-amber-300"
                                }`}>
                                  {entry.reason || "بدون عذر"}
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-slate-500 font-bold">
                              المشرف: <strong className="text-slate-700">{entry.recordedBy || "-"}</strong>
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB CONTENT: SPECIFIC SEARCH (غياب محدد) */}
          {activeStatsTab === "selected_attendance" && (
            <div className="bg-white rounded-2xl shadow-3xs border border-slate-100 p-5 space-y-5 animate-fadeIn">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span>🔍</span>
                    <span>الاستعلام عن غياب فصل معين</span>
                  </h3>
                  <p className="text-2xs text-slate-400 font-bold mt-0.5">اختر الصف والفصل والتاريخ المحددين لعرض سجل الغياب والتأخر المفصل.</p>
                </div>
                <button
                  type="button"
                  onClick={handlePrintSelectedAttendance}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 transition cursor-pointer shrink-0"
                >
                  <span>🖨️</span>
                  <span>طباعة الغياب المحدد</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 mb-1.5">الصف الدراسي</label>
                  <select
                    value={searchGradeId}
                    onChange={(e) => setSearchGradeId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {grades.map((g, idx) => (
                      <option key={`sg-${g.id}-${idx}`} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 mb-1.5">الفصل الدراسي</label>
                  <select
                    value={searchClassId}
                    onChange={(e) => setSearchClassId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {classes.filter(c => c.gradeId === searchGradeId).map((c, idx) => (
                      <option key={`sc-${c.id}-${idx}`} value={c.id}>{c.name}</option>
                    ))}
                    {classes.filter(c => c.gradeId === searchGradeId).length === 0 && (
                      <option value="">لا يوجد فصول</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 mb-1.5">تاريخ الاستعلام</label>
                  <input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                  />
                </div>
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden mt-4">
                <table className="w-full text-right text-xs" dir="rtl">
                  <thead className="bg-slate-50 text-slate-500 font-extrabold text-[10.5px] border-b border-slate-100">
                    <tr>
                      <th className="py-2 px-3 text-right">رقم</th>
                      <th className="py-2 px-3 text-right">اسم الطالب</th>
                      <th className="py-2 px-2 text-right">الحالة</th>
                      <th className="py-2 px-2 text-right">الحصة</th>
                      <th className="py-2 px-3 text-right">المعلم المعتمد</th>
                      {!isReadOnly && <th className="py-2 px-3 text-center">الاجراءات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {searchAttendanceResult.length === 0 ? (
                      <tr>
                        <td colSpan={isReadOnly ? 5 : 6} className="py-12 text-center text-slate-400 font-extrabold">
                          لا توجد غيابات مسجلة لهذا الفصل في هذا التاريخ 👍
                        </td>
                      </tr>
                    ) : (
                      searchAttendanceResult.map((entry, index) => (
                        <tr key={entry.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-2 px-3 font-bold text-slate-400 text-xs">{index + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-800 text-[11px]">{entry.studentName}</td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-0.5 rounded-full text-3xs font-black ${
                              entry.status === "غائب" ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                            }`}>
                              {entry.status}
                            </span>
                          </td>
                          <td className="py-2 px-2 font-black text-slate-700 text-xs">{entry.period}</td>
                          <td className="py-2 px-3 text-slate-500 font-medium text-[10px]">{entry.teacherName}</td>
                          {!isReadOnly && (
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteAbsence(entry.recordId, entry.studentId, entry.isAbsent)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition cursor-pointer"
                                title="حذف هذا تسجيل الغياب"
                              >
                                <Trash2 className="w-3.5 h-3.5 mx-auto" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB CONTENT: STUDENT DETAILED REPORT (تقرير الطالب) */}
          {activeStatsTab === "student_report" && (
            <div className="bg-white rounded-2xl shadow-3xs border border-slate-100 p-5 space-y-5 animate-fadeIn">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <span>📋</span>
                  <span>تقرير الطالب التفصيلي والطباعة</span>
                </h3>
                <p className="text-2xs text-slate-400 font-bold mt-0.5">اختر الطالب لاستخراج نسب الغياب والتأخر في كافة الحصص بنظام بنتو وبطريقة قابلة للطباعة.</p>
              </div>

              {/* Selection Dropdowns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 mb-1.5">الصف الدراسي</label>
                  <select
                    value={reportGradeId}
                    onChange={(e) => setReportGradeId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {grades.map((g, idx) => (
                      <option key={`rg-${g.id}-${idx}`} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 mb-1.5">الفصل الدراسي</label>
                  <select
                    value={reportClassId}
                    onChange={(e) => setReportClassId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {classes.filter(c => c.gradeId === reportGradeId).map((c, idx) => (
                      <option key={`rc-${c.id}-${idx}`} value={c.id}>{c.name}</option>
                    ))}
                    {classes.filter(c => c.gradeId === reportGradeId).length === 0 && (
                      <option value="">لا يوجد فصول</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 mb-1.5">الطالب</label>
                  <select
                    value={reportStudentId}
                    onChange={(e) => setReportStudentId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {students.filter(s => s.classId === reportClassId).map((s, idx) => (
                      <option key={`rs-${s.id}-${idx}`} value={s.id}>{s.name}</option>
                    ))}
                    {students.filter(s => s.classId === reportClassId).length === 0 && (
                      <option value="">لا يوجد طلاب</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Bento Student Report card */}
              {studentReportData ? (
                <div className="space-y-6 animate-scaleUp pt-2">
                  
                  {/* Student Header */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="bg-blue-600 text-white w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-sm">
                        👨‍🎓
                      </div>
                      <div className="text-right">
                        <h4 className="text-sm font-black text-slate-800">{students.find(s => s.id === reportStudentId)?.name}</h4>
                        <p className="text-2xs text-slate-400 font-extrabold mt-0.5">
                          {grades.find(g => g.id === reportGradeId)?.name} • {classes.find(c => c.id === reportClassId)?.name}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition print:hidden cursor-pointer"
                    >
                      <span>🖨️</span>
                      <span>طباعة بطاقة الطالب</span>
                    </button>
                  </div>

                  {/* Bento Metrics Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Attendance rate card */}
                    <div className="bg-gradient-to-tr from-blue-50/50 to-indigo-50/50 border border-blue-100 rounded-2xl p-4 text-center flex flex-col justify-between">
                      <span className="text-3xs text-blue-600 font-extrabold mb-2 block">نسبة الانضباط والحضور</span>
                      <div className="relative w-18 h-18 mx-auto flex items-center justify-center mb-1">
                        <span className={`text-xl font-black ${
                          studentReportData.attendanceRate >= 90 ? "text-emerald-600" : studentReportData.attendanceRate >= 75 ? "text-amber-500" : "text-rose-600"
                        }`}>{studentReportData.attendanceRate}%</span>
                      </div>
                      <span className="text-3xs text-slate-400 font-semibold block mt-1">من إجمالي الحصص المسجلة</span>
                    </div>

                    {/* Absents Count Card */}
                    <div className="bg-white border border-slate-150 rounded-2xl p-4 text-center flex flex-col justify-between shadow-3xs">
                      <span className="text-3xs text-slate-400 font-extrabold mb-2 block">إجمالي مرات الغياب</span>
                      <span className="text-3xl font-black text-rose-600 my-auto">{studentReportData.absentCount}</span>
                      <span className="text-3xs text-rose-400 font-bold block mt-2 bg-rose-50/50 py-1 rounded-lg">حالة غياب مرصودة</span>
                    </div>

                    {/* Lates Count Card */}
                    <div className="bg-white border border-slate-150 rounded-2xl p-4 text-center flex flex-col justify-between shadow-3xs">
                      <span className="text-3xs text-slate-400 font-extrabold mb-2 block">إجمالي مرات التأخر</span>
                      <span className="text-3xl font-black text-amber-500 my-auto">{studentReportData.lateCount}</span>
                      <span className="text-3xs text-amber-600 font-bold block mt-2 bg-amber-50/50 py-1 rounded-lg">حالة تأخر مرصودة</span>
                    </div>
                  </div>

                  {/* Attendance logs */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3 pt-2">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                      <span>📕</span>
                      <span>سجل الانضباط والحصص التفصيلي</span>
                    </h4>
                    
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {studentReportData.history.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-10 font-bold">السجل نظيف! الطالب حاضر دائماً 👍</p>
                      ) : (
                        studentReportData.history.map((log, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="text-right">
                              <p className="text-[11px] font-extrabold text-slate-800">حصة {log.period}</p>
                              <p className="text-[9px] text-slate-400 font-semibold">بواسطة: {log.teacher}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-3xs text-slate-400 font-bold">{log.date}</span>
                              <span className={`px-2 py-0.5 rounded-lg text-3xs font-black ${
                                log.status === "غائب" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                              }`}>{log.status}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center py-10 text-xs text-slate-400 font-black">يرجى تسجيل أو اختيار طالب لعرض تقريره الأكاديمي المفصل.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: GRADES & CLASSES (SCREENSHOT COMPLIANT CUSTOMIZER) */}
      {activeSubTab === "grades" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Tab Selection Header */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-md font-extrabold text-slate-800">تخصيص وإدارة الخيارات الأكاديمية 🏫</h2>
              <p className="text-2xs text-slate-400 font-bold mt-0.5">أضف، احذف، وعدّل الصفوف والفصول الدراسية لتتناسب مع خطتك الأكاديمية المحددة.</p>
            </div>
          </div>

          {/* School Name Customization Card */}
          <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/60 border border-blue-100 rounded-2xl p-5 text-right space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🏫</span>
              <div>
                <h3 className="text-sm font-black text-slate-800">تخصيص هوية واسم المدرسة الحالي</h3>
                <p className="text-3xs text-slate-500 font-bold mt-1">
                  يمكنك تعديل اسم مدرستك الحالي في أي وقت لتحديث الهوية بالكامل في كافة التقارير واللوحات الجانبية والواجهات المطبوعة.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 max-w-md">
              <input
                type="text"
                defaultValue={schoolName || ""}
                placeholder="أدخل اسم المدرسة الجديد"
                id="school-settings-input"
                className="flex-1 text-xs font-bold px-3.5 py-2.5 bg-white border border-slate-200/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl outline-none transition text-right"
              />
              <button
                type="button"
                disabled={isSavingSchoolName}
                onClick={async () => {
                  const inputEl = document.getElementById("school-settings-input") as HTMLInputElement;
                  if (inputEl) {
                    const trimmed = inputEl.value.trim();
                    if (!trimmed) {
                      alert("يرجى إدخال اسم مدرسة صالح.");
                      return;
                    }
                    if (onSchoolNameChange) {
                      onSchoolNameChange(trimmed);
                    }
                  }
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-55 flex items-center justify-center gap-1.5"
              >
                {isSavingSchoolName ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <span>تحديث الاسم ✨</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Screenshot-perfect Card Grid Layout for Grades & Classes */}
          <div className="space-y-6" dir="rtl">
              {/* Form to Add New Grade */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-3xs p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-700">إضافة صفوف دراسية (كل صف في سطر):</label>
                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                    سطر لكل صف (نسخ ولصق من إكسل 📋)
                  </span>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newGradeName.trim()) return;
                    await handleAddGradeSubmit(e);
                  }}
                  className="flex flex-col gap-2.5"
                >
                  <textarea
                    rows={3}
                    placeholder={"أدخل أسماء الصفوف (كل صف في سطر منفصل)...\nمثال:\nالصف الأول الثانوي\nالصف الثاني الثانوي\nالصف الثالث الثانوي"}
                    value={newGradeName}
                    onChange={(e) => setNewGradeName(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        if (newGradeName.trim()) {
                          handleAddGradeSubmit(e);
                        }
                      }
                    }}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-extrabold text-slate-800 focus:outline-none shadow-3xs text-right min-h-[72px] resize-y"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">
                      ملاحظة: اضغط Ctrl + Enter في المربع للحفظ
                    </span>
                  </div>
                </form>
              </div>

              {/* Available Grades Header */}
              <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4.5 h-4.5 text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-800">
                    الصفوف الدراسية المتاحة ({grades.length})
                  </h3>
                </div>

                {grades.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      confirmAction(
                        "حذف جميع الصفوف والفصول نهائياً",
                        "هل أنت متأكد من حذف جميع الصفوف الدراسية والفصول؟ سيتم حذفها نهائياً من قاعدة البيانات والتخزين المؤقت ولن تعود مجدداً.",
                        async () => {
                          setGrades([]);
                          setClasses([]);
                          setSelectedGradeIdForClasses("");
                          await deleteAllGradesAndClasses();
                          showMessage("تم حذف جميع الصفوف والفصول بنجاح نهائي!");
                        }
                      );
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                    title="حذف جميع الصفوف والفصول بشكل نهائي"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف كل الصفوف والفصول</span>
                  </button>
                )}
              </div>

              {grades.length > 0 && classes.length === 0 && (
                <div className="bg-amber-400 text-slate-900 rounded-xl p-3 flex items-center gap-2 text-xs font-black shadow-2xs animate-pulse">
                  <span>💡 توجيه: تم إضافة الصفوف! يرجى إضافة الفصول الآن بالضغط على أرقام الفصول (1، 2، ...) لكل صف 👈</span>
                </div>
              )}

              {/* Grade Cards List */}
              <div className="space-y-4">
                {grades.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400 font-bold">
                    لا توجد صفوف دراسية مسجلة حالياً. استخدم المربع أعلاه لإضافة أول صف دراسي.
                  </div>
                ) : (
                  grades.map((grade, idx) => {
                    const gradeClasses = classes.filter((c) => c.gradeId === grade.id);
                    const gradeStudentCount = students.filter((s) => s.gradeId === grade.id).length;

                    return (
                      <div
                        key={`grade-card-${grade.id}-${idx}`}
                        id={`grade-card-${grade.id}`}
                        className="bg-white rounded-2xl border border-slate-200/90 shadow-3xs p-4 sm:p-5 space-y-4 transition-all"
                      >
                        {/* Grade Header Row */}
                        <div className="flex items-center justify-between">
                          {/* Grade Name Pill Badge */}
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-2 bg-indigo-50/90 text-indigo-700 font-black border border-indigo-200/80 px-4 py-1.5 rounded-full text-xs sm:text-sm">
                              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                              <span>• {grade.name}</span>
                            </span>
                          </div>

                          {/* Student Count & Delete Grade Button */}
                          <div className="flex items-center gap-2">
                            <span className="bg-rose-50 text-rose-600 border border-rose-200/80 font-extrabold text-2xs px-2.5 py-1 rounded-lg">
                              {gradeStudentCount} طالب
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteGrade(grade.id, grade.name)}
                              disabled={submitting['deleteGrade_' + grade.id]}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="حذف الصف بكامل فصوله"
                            >
                              {submitting['deleteGrade_' + grade.id] ? (
                                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="border-b border-slate-100"></div>

                        {/* Classes Grid */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-2xs font-extrabold text-slate-700">
                                فصول الصف (اضغط على الرقم للإضافة أو الحذف):
                              </p>
                              {/* Quick selection presets */}
                              <div className="flex items-center gap-1 flex-wrap">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const needed = [1, 2, 3, 4, 5, 6];
                                    const toAdd: { name: string; gradeId: string }[] = [];
                                    needed.forEach(num => {
                                      const cName = `الفصل ${num}`;
                                      if (!gradeClasses.some(c => c.name?.trim() === cName || c.name?.trim() === `${num}`)) {
                                        toAdd.push({ name: cName, gradeId: grade.id });
                                      }
                                    });
                                    if (toAdd.length > 0) {
                                      const tempItems = toAdd.map(item => ({
                                        id: `temp_cls_${Date.now()}_${item.name}`,
                                        name: item.name,
                                        gradeId: grade.id
                                      }));
                                      setClasses(prev => [...prev, ...tempItems]);
                                      const res = await addClassesBatch(toAdd);
                                      setClasses(prev => {
                                        const tempIds = new Set(tempItems.map(t => t.id));
                                        const clean = prev.filter(p => !tempIds.has(p.id));
                                        return [...clean, ...res];
                                      });
                                    }
                                  }}
                                  className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-200 transition cursor-pointer"
                                  title="إضافة الفصول من 1 إلى 6 فوراً"
                                >
                                  + إضافة (1-6)
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const needed = [1, 2, 3, 4, 5];
                                    const toAdd: { name: string; gradeId: string }[] = [];
                                    needed.forEach(num => {
                                      const cName = `الفصل ${num}`;
                                      if (!gradeClasses.some(c => c.name?.trim() === cName || c.name?.trim() === `${num}`)) {
                                        toAdd.push({ name: cName, gradeId: grade.id });
                                      }
                                    });
                                    if (toAdd.length > 0) {
                                      const tempItems = toAdd.map(item => ({
                                        id: `temp_cls_${Date.now()}_${item.name}`,
                                        name: item.name,
                                        gradeId: grade.id
                                      }));
                                      setClasses(prev => [...prev, ...tempItems]);
                                      const res = await addClassesBatch(toAdd);
                                      setClasses(prev => {
                                        const tempIds = new Set(tempItems.map(t => t.id));
                                        const clean = prev.filter(p => !tempIds.has(p.id));
                                        return [...clean, ...res];
                                      });
                                    }
                                  }}
                                  className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-200 transition cursor-pointer"
                                  title="إضافة الفصول من 1 إلى 5 فوراً"
                                >
                                  + إضافة (1-5)
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const needed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
                                    const toAdd: { name: string; gradeId: string }[] = [];
                                    needed.forEach(num => {
                                      const cName = `الفصل ${num}`;
                                      if (!gradeClasses.some(c => c.name?.trim() === cName || c.name?.trim() === `${num}`)) {
                                        toAdd.push({ name: cName, gradeId: grade.id });
                                      }
                                    });
                                    if (toAdd.length > 0) {
                                      const tempItems = toAdd.map(item => ({
                                        id: `temp_cls_${Date.now()}_${item.name}`,
                                        name: item.name,
                                        gradeId: grade.id
                                      }));
                                      setClasses(prev => [...prev, ...tempItems]);
                                      const res = await addClassesBatch(toAdd);
                                      setClasses(prev => {
                                        const tempIds = new Set(tempItems.map(t => t.id));
                                        const clean = prev.filter(p => !tempIds.has(p.id));
                                        return [...clean, ...res];
                                      });
                                    }
                                  }}
                                  className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-200 transition cursor-pointer"
                                  title="إضافة الفصول من 1 إلى 10 فوراً"
                                >
                                  + إضافة (1-10)
                                </button>
                                {gradeClasses.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      confirmAction(
                                        "حذف جميع فصول هذا الصف",
                                        `هل أنت متأكد من حذف جميع فصول ${grade.name}؟ لن تعود الفصول مرة أخرى.`,
                                        async () => {
                                          setClasses(prev => prev.filter(c => c.gradeId !== grade.id));
                                          await deleteClassesForGrade(grade.id, grade.name);
                                          showMessage("تم حذف جميع فصول هذا الصف بنجاح!");
                                        }
                                      );
                                    }}
                                    className="text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-md border border-rose-200 transition cursor-pointer flex items-center gap-1"
                                    title="حذف جميع فصول هذا الصف نهائياً"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>مسح فصول الصف</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            {gradeClasses.length === 0 && (
                              <div className="text-[11px] text-slate-400 font-medium px-1 py-0.5">
                                لا توجد فصول مضافة في هذا الصف حالياً
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 sm:gap-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                              const cls = gradeClasses.find((c) => {
                                const trimmed = c.name.trim();
                                return (
                                  trimmed === `الفصل ${num}` ||
                                  trimmed === `${num}` ||
                                  trimmed.endsWith(` ${num}`)
                                );
                              });

                              const exists = Boolean(cls);
                              const clsStudentCount = cls
                                ? students.filter((s) => s.classId === cls.id).length
                                : 0;

                              return (
                                <button
                                  key={`gcard-cls-${num}`}
                                  type="button"
                                  onClick={() => {
                                    if (exists && cls) {
                                      const cName = cls.name?.trim() || `الفصل ${num}`;
                                      confirmAction(
                                        "تأكيد حذف الفصل نهائياً",
                                        `هل أنت متأكد من حذف ${cName} نهائياً؟ سيتم حذف الفصل وجميع الطلاب المسجلين به نهائياً ولن يتم استرجاعها تلقائياً.`,
                                        async () => {
                                          setClasses(prev => prev.filter(c => 
                                            c.id !== cls.id && 
                                            !(c.gradeId === grade.id && (c.name?.trim() === cName || c.name?.trim() === `الفصل ${num}` || c.name?.trim() === `${num}`))
                                          ));
                                          setStudents(prev => prev.filter(s => s.classId !== cls.id));
                                          showMessage(`تم حذف ${cName} بنجاح نهائي!`);
                                          await deleteClass(cls.id, grade.id, cName).catch(() => {});
                                        }
                                      );
                                    } else {
                                      const className = `الفصل ${num}`;
                                      const tempId = `temp_cls_${Date.now()}_${num}`;
                                      // Instant 0ms optimistic addition
                                      setClasses((prev) => {
                                        if (prev.some(c => c.gradeId === grade.id && c.name?.trim() === className)) {
                                          return prev;
                                        }
                                        return [
                                          ...prev,
                                          { id: tempId, name: className, gradeId: grade.id },
                                        ];
                                      });

                                      // Background save
                                      addClass(className, grade.id).then((newId) => {
                                        setClasses((prev) => 
                                          prev.map(c => c.id === tempId ? { ...c, id: newId } : c)
                                        );
                                      }).catch(() => {});
                                    }
                                  }}
                                  className={`flex flex-col rounded-xl sm:rounded-2xl overflow-hidden border transition-all duration-150 cursor-pointer shadow-3xs hover:shadow-md hover:scale-[1.03] active:scale-95 ${
                                    exists
                                      ? "border-indigo-600 ring-1 ring-indigo-600"
                                      : "border-indigo-200 hover:border-indigo-300"
                                  }`}
                                >
                                  {/* Upper Box */}
                                  <div
                                    className={`py-2 px-1 text-center text-sm sm:text-base font-black flex items-center justify-center gap-1 select-none ${
                                      exists
                                        ? "bg-[#5046e5] text-white"
                                        : "bg-white text-indigo-600 hover:bg-indigo-50/70"
                                    }`}
                                  >
                                    <span>{exists ? "✓" : "+"}</span>
                                    <span>{num}</span>
                                  </div>

                                  {/* Lower Box */}
                                  <div className="bg-[#fff1f2] text-rose-600 text-xs sm:text-[12.5px] font-extrabold py-1 border-t border-rose-100/80 text-center whitespace-nowrap select-none">
                                    {clsStudentCount} طالب
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Action Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-6 flex-wrap gap-3" dir="rtl">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      confirmAction(
                        "مسح شامل وتصفير نهائي لكافة بيانات السيرفر والمؤقتة",
                        "هل أنت متأكد من مسح وتصفير كافة البيانات من السيرفر والتخزين المؤقت وقاعدة البيانات نهائياً؟ يشمل ذلك الصفوف، الفصول، الطلاب، المعلمين، وسجلات الغياب والسلوك والتأخر ولن تعود البيانات السابقة نهائياً.",
                        async () => {
                          if (setGlobalProgress) {
                            setGlobalProgress({ active: true, type: "delete", label: "جاري مسح وتنظيف كافة بيانات السيرفر والمؤقتة نهائياً..." });
                          }
                          try {
                            const res = await purgeAllServerAndTemporaryData(true);
                            setGrades([]);
                            setClasses([]);
                            setStudents([]);
                            setTeachers([]);
                            setSelectedStudentIds([]);
                            showMessage(`تم مسح وتصفير كافة بيانات السيرفر والمؤقتة نهائياً بنجاح (${res.deletedCount} مستند)!`);
                            if (onRefreshData) await onRefreshData().catch(console.error);
                          } catch (e) {
                            showMessage("حدث خطأ أثناء عملية المسح الشامل", "error");
                          } finally {
                            if (setGlobalProgress) {
                              setGlobalProgress({ active: false, type: null, label: "" });
                            }
                          }
                        }
                      );
                    }}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>مسح وتصفير كامل بيانات السيرفر والمؤقتة</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (setGlobalProgress) {
                        setGlobalProgress({ active: true, type: "delete", label: "جاري تنظيف السجلات المحذوفة والمؤقتة..." });
                      }
                      try {
                        const res = await purgeDeletedAndOrphanedData();
                        showMessage(`تم تنظيف وحذف ${res.purgedCount} سجل مؤقت/محذوف عالق من السيرفر بنجاح!`);
                        if (onRefreshData) onRefreshData().catch(console.error);
                      } catch (e) {
                        showMessage("حدث خطأ أثناء تنظيف السجلات المؤقتة", "error");
                      } finally {
                        if (setGlobalProgress) {
                          setGlobalProgress({ active: false, type: null, label: "" });
                        }
                      }
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>تنظيف السجلات المحذوفة والمؤقتة العالقة</span>
                  </button>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* SUB-TAB 3: TEACHERS MANAGEMENT */}
      {activeSubTab === "teachers" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Mode Switcher */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-md font-extrabold text-slate-800">إضافة المعلمين والمعلمات 💼</h2>
              <p className="text-2xs text-slate-400 font-bold mt-0.5">تسجيل المعلمين المعتمدين لتخويلهم صلاحيات رصد الحضور والغياب والسلوك للطلاب.</p>
            </div>
            
            {/* Mode Indicator */}
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <div className="px-3.5 py-1.5 rounded-md text-xs font-bold bg-white text-blue-600 shadow-3xs flex items-center gap-1">
                  <span>إضافة المعلمين 📋</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Add Teacher Card (left / top) - 5 columns */}
            <div className="lg:col-span-5 bg-white rounded-2xl shadow-3xs border border-slate-100 p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                <UserPlus className="w-4 h-4 text-blue-500" />
                <span>إضافة المعلمين</span>
              </h3>

              {/* copy and paste card for teachers */}
              <form onSubmit={handleTeacherImportSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-2xs font-extrabold text-slate-500 mb-1.5">اضف معلم أو مجموعة من المعلمين (يمكنك ايضا نسخ ولصق الاسماء من ملف اكسل)</label>
                  <textarea
                    rows={6}
                    placeholder="ألصق الأسماء هنا...
أ/ أحمد المحمد
أ/ خالد الحربي
أ/ علي الغامدي"
                    value={pastedTeachersText}
                    onChange={(e) => setPastedTeachersText(e.target.value)}
                    className={`w-full bg-slate-50 border rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none resize-none font-mono transition-all ${
                      currentStep === 7.5 && hasClickedTeacherSwitcher && pastedTeachersText.trim().length === 0
                        ? "border-amber-400 focus:border-amber-500 ring-4 ring-amber-100 scale-101"
                        : "border-slate-200 focus:border-blue-500"
                    }`}
                  />
                  {currentStep === 7.5 && hasClickedTeacherSwitcher && pastedTeachersText.trim().length === 0 && (
                    <p className="text-[10px] text-amber-700 font-black mt-1 animate-pulse">👈 يرجى لصق قائمة الأسماء هنا في المربع لبدء الاستيراد دفعة واحدة</p>
                  )}
                </div>

                {parsedTeacherNames.length > 0 && (
                  <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-3.5 space-y-2">
                    <p className="text-2xs font-extrabold text-blue-800 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>تم اكتشاف {parsedTeacherNames.length} معلم جاهز للاستيراد:</span>
                    </p>
                    <div className="max-h-24 overflow-y-auto divide-y divide-blue-100/50 text-2xs text-slate-700 font-semibold pr-1">
                      {parsedTeacherNames.slice(0, 5).map((name, i) => (
                        <p key={i} className="py-1">👤 {name}</p>
                      ))}
                      {parsedTeacherNames.length > 5 && (
                        <p className="py-1 text-slate-400 text-center text-3xs">...و {parsedTeacherNames.length - 5} معلمين آخرين</p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={parsedTeacherNames.length === 0 || statsLoading || submitting.importTeachers}
                  className={`w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold py-3 rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-xs transition-all ${
                    currentStep === 7.5 && hasClickedTeacherSwitcher && parsedTeacherNames.length > 0 ? "ring-4 ring-amber-400 border-2 border-white animate-pulse scale-102" : ""
                  }`}
                >
                  {submitting.importTeachers ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>اعتماد واستيراد {parsedTeacherNames.length} معلم دفعة واحدة 📋</span>
                  {currentStep === 7.5 && hasClickedTeacherSwitcher && parsedTeacherNames.length > 0 && (
                    <span className="text-[9px] bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded font-black animate-bounce mr-1">
                      اضغط هنا 👈
                    </span>
                  )}
                </button>
              </form>
            </div>

            {/* Registered Teachers List - 7 columns */}
            <div className="lg:col-span-7 bg-white rounded-2xl shadow-3xs border border-slate-100 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-50 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">
                    المعلمون المسجلون في المدرسة ({teachers.length})
                  </h3>
                  <p className="text-3xs text-slate-400 font-bold mt-0.5">تصفح قائمة الكادر التعليمي والتحكم في حذفهم الفردي أو الجماعي.</p>
                </div>
                <div className="relative w-full sm:w-48">
                  <input
                    type="text"
                    placeholder="ابحث باسم المعلم..."
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl pr-8 pl-3 py-1.5 text-3xs font-semibold text-slate-800 focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {/* Stats header inside the table */}
                <div className="p-3 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-3xs font-extrabold text-slate-600">
                      إجمالي عدد المعلمين: <span className="text-blue-600 font-black">{teachers.length} معلم</span>
                    </span>
                    {selectedTeacherIds.length > 0 && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-3xs font-black border border-blue-100 flex items-center gap-1 animate-pulse">
                        <span>تم تحديد {selectedTeacherIds.length} معلم</span>
                      </span>
                    )}
                  </div>

                  {selectedTeacherIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteSelectedTeachers}
                      disabled={submitting.deleteSelectedTeachers}
                      className="bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 text-white px-3 py-1 rounded-xl text-3xs font-black flex items-center gap-1 transition-all shadow-xs"
                    >
                      {submitting.deleteSelectedTeachers ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>حذف المعلمين المحددين ({selectedTeacherIds.length})</span>
                    </button>
                  )}
                </div>

                {/* Table implementation */}
                {(() => {
                  const filteredTeachers = teachers
                    .filter(t => {
                      const term = teacherSearchQuery.trim().toLowerCase();
                      if (!term) return true;
                      return t.name.toLowerCase().includes(term);
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, "ar"));

                  if (teachers.length === 0) {
                    return (
                      <p className="text-xs text-slate-400 py-12 text-center font-bold">لا يوجد معلمون مسجلون حالياً.</p>
                    );
                  }

                  if (filteredTeachers.length === 0) {
                    return (
                      <p className="text-xs text-slate-400 py-12 text-center font-bold">لا يوجد معلمون يطابقون كلمة البحث.</p>
                    );
                  }

                  const allFilteredSelected = filteredTeachers.length > 0 && filteredTeachers.every(t => selectedTeacherIds.includes(t.id));

                  return (
                    <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-500 font-extrabold border-b border-slate-100">
                            <th className="py-2.5 px-3 w-12 text-center">#</th>
                            <th className="py-2.5 px-3">اسم المعلم</th>
                            <th className="py-2.5 px-3 w-24 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                  checked={allFilteredSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedTeacherIds(filteredTeachers.map(t => t.id));
                                    } else {
                                      setSelectedTeacherIds([]);
                                    }
                                  }}
                                  title="تحديد الكل للحذف"
                                />
                                <span>التحكم</span>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {filteredTeachers.map((t, idx) => {
                            const isSelected = selectedTeacherIds.includes(t.id);

                            return (
                              <tr key={`teacher-row-${t.id}-${idx}`} className={`transition ${isSelected ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'hover:bg-slate-50/40'}`}>
                                <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-extrabold text-slate-900 text-xs">{t.name}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-3">
                                    <input 
                                      type="checkbox" 
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedTeacherIds(prev => [...prev, t.id]);
                                        } else {
                                          setSelectedTeacherIds(prev => prev.filter(id => id !== t.id));
                                        }
                                      }}
                                      title="تحديد المعلم للحذف"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTeacher(t.id, t.name)}
                                      disabled={submitting['deleteTeacher_' + t.id]}
                                      className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition"
                                      title="حذف المعلم"
                                    >
                                      {submitting['deleteTeacher_' + t.id] ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: STUDENTS UNIFIED MANAGEMENT */}
      {activeSubTab === "students" && (
        <div className="space-y-6 animate-fadeIn">
          {/* 1. HORIZONTAL GRADE & CLASS TABS SELECTOR CARD */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-3xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#5046e5]" />
                <h2 className="text-sm font-black text-slate-800">تحديد الصف والفصل الدراسي:</h2>
              </div>
              
              {/* Action Buttons: Grades/Classes Management */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Orange Button to open School Structure Modal (Grades & Classes management) */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGradeIdForClasses(selectedGradeId);
                    setShowStructureManager(true);
                  }}
                  className="bg-[#ff9800] hover:bg-[#f57c00] active:bg-amber-700 text-white font-extrabold px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <span>⚙️ إضافة / تعديل الصفوف والفصول</span>
                </button>
              </div>
            </div>

            {/* Grades Selection Icon Cards */}
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <span>الصفوف الدراسية (اختر الصف لعرض فصوله):</span>
              </p>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-200 flex-wrap">
                {grades.map((grade, idx) => {
                  const isSelected = selectedGradeId === grade.id;
                  const gradeStudentCount = students.filter(s => s.gradeId === grade.id).length;

                  return (
                    <button
                      key={`mgrade-${grade.id}-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelectedGradeId(grade.id);
                        const gradeClasses = classes.filter(c => c.gradeId === grade.id);
                        if (gradeClasses.length > 0 && !gradeClasses.some(c => c.id === selectedClassId)) {
                          setSelectedClassId(gradeClasses[0].id);
                        }
                      }}
                      className={`flex flex-col rounded-xl sm:rounded-2xl overflow-hidden border transition-all duration-150 cursor-pointer shadow-3xs hover:shadow-md hover:scale-[1.03] active:scale-95 min-w-[100px] sm:min-w-[120px] ${
                        isSelected
                          ? "border-indigo-600 shadow-md shadow-indigo-500/20"
                          : "border-indigo-200 hover:border-indigo-300"
                      }`}
                    >
                      {/* Upper Box: Grade Name */}
                      <div
                        className={`py-2 px-3 text-center text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? "bg-[#5046e5] text-white"
                            : "bg-white text-indigo-600 hover:bg-indigo-50/70"
                        }`}
                      >
                        <span>🏫</span>
                        <span>{grade.name}</span>
                      </div>

                      {/* Lower Box: Student Count */}
                      <div className="bg-[#fff1f2] text-rose-600 text-[11px] sm:text-xs font-extrabold py-1 px-2 border-t border-rose-100/80 text-center whitespace-nowrap">
                        {gradeStudentCount} طالب
                      </div>
                    </button>
                  );
                })}
                {grades.length === 0 && (
                  <p className="text-2xs text-slate-400 font-extrabold py-1">لا توجد صفوف دراسية مسجلة حالياً. اضغط على زر "إضافة / تعديل الصفوف والفصول" لإضافة صف.</p>
                )}
              </div>
            </div>

            {/* Classes Icon Cards for Selected Grade */}
            {selectedGradeId && (
              <div className="pt-3 border-t border-slate-100 space-y-2 animate-fadeIn">
                <p className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <span className="text-[#5046e5]">فصول {grades.find(g => g.id === selectedGradeId)?.name}:</span>
                </p>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
                  {classes.filter(c => c.gradeId === selectedGradeId).map((cls, idx) => {
                    const isSelected = selectedClassId === cls.id;
                    const classNum = cls.name.replace("الفصل ", "").replace("فصل ", "");
                    const classStudentCount = students.filter(s => s.classId === cls.id).length;

                    return (
                      <button
                        key={`mcls-${cls.id}-${idx}`}
                        type="button"
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`flex flex-col rounded-xl sm:rounded-2xl overflow-hidden border transition-all duration-150 cursor-pointer shadow-3xs hover:shadow-md hover:scale-[1.03] active:scale-95 min-w-[70px] sm:min-w-[80px] ${
                          isSelected
                            ? "border-indigo-600 shadow-md shadow-indigo-500/20"
                            : "border-indigo-200 hover:border-indigo-300"
                        }`}
                      >
                        {/* Upper Box: Class Number */}
                        <div
                          className={`py-2 px-3 text-center text-xs sm:text-sm font-black flex items-center justify-center gap-1 ${
                            isSelected
                              ? "bg-[#5046e5] text-white"
                              : "bg-white text-indigo-600 hover:bg-indigo-50/70"
                          }`}
                        >
                          <span>{classNum || cls.name}</span>
                        </div>

                        {/* Lower Box: Student Count */}
                        <div className="bg-[#fff1f2] text-rose-600 text-[11px] sm:text-xs font-extrabold py-1 px-1.5 border-t border-rose-100/80 text-center whitespace-nowrap">
                          {classStudentCount} طالب
                        </div>
                      </button>
                    );
                  })}
                  {classes.filter(c => c.gradeId === selectedGradeId).length === 0 && (
                    <p className="text-2xs text-slate-400 font-extrabold py-1">لا توجد فصول تابعة لهذا الصف حالياً. أضف فصلاً عبر زر "إضافة / تعديل الصفوف والفصول".</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. ACTIVE CLASS DETAILS PANEL & STUDENT ACTION PANEL */}
          {selectedGradeId && selectedClassId ? (
            <div className="space-y-6">
              {/* Class Header with Search and Student Add Toggler */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-3xs flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">
                      كشف طلاب: <span className="text-[#3b82f6]">{grades.find(g => g.id === selectedGradeId)?.name}</span> - <span className="text-[#3b82f6]">{classes.find(c => c.id === selectedClassId)?.name}</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">تصفح كشف الطلاب، تفاصيل التحصيل، والتحكم في إضافة الطلاب أو السجلات.</p>
                  </div>
                </div>

                {/* Right/Left actions: Search & Toggler */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ابحث باسم الطالب أو البريد..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="w-full sm:w-64 bg-slate-50/80 border border-slate-200 focus:border-indigo-500 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddStudentSection(!showAddStudentSection)}
                    className="bg-[#5046e5] hover:bg-indigo-700 text-white font-extrabold px-5 py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{showAddStudentSection ? "إخفاء نافذة الإضافة" : "إضافة طالب / طلاب للفصل"}</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Student Insertion Forms */}
              {showAddStudentSection && (
                <div className="bg-white rounded-2xl shadow-3xs border border-slate-200/80 p-5 space-y-4 animate-fadeIn">


                  <form onSubmit={handleStudentImportSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-800 mb-2">
                        أدخل أو انسخ أسماء الطلاب
                      </label>

                      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 mb-3 text-xs text-emerald-900 font-semibold flex items-start gap-2">
                        <span className="text-base leading-none">💡</span>
                        <span>يمكنك نسخ عمود الأسماء من ملف Excel ولصقها هنا مباشرة، أو كتابة الأسماء بمعدل اسم واحد في كل سطر.</span>
                      </div>

                      <textarea
                        rows={5}
                        placeholder={`أدخل الأسماء هنا، اسم في كل سطر:
خالد محمد العتيبي
سلطان عبد الله الشمري
سارة فهد السديري`}
                        value={pastedStudentsText}
                        onChange={(e) => setPastedStudentsText(e.target.value)}
                        className="w-full bg-slate-50/50 border border-emerald-300 focus:border-emerald-500 rounded-xl px-3.5 py-3 text-xs font-semibold text-slate-800 focus:outline-none resize-none placeholder:text-slate-400/80 leading-relaxed font-sans"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={parsedStudentNames.length === 0 || statsLoading || submitting.importStudents}
                        className="bg-[#5046e5] hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {submitting.importStudents && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        <span>حفظ وتسجيل الطلاب</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAddStudentSection(false);
                          setPastedStudentsText("");
                        }}
                        className="text-slate-600 hover:text-slate-900 font-bold text-xs px-3 py-2 transition cursor-pointer"
                      >
                        إلغاء الأمر
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 3. STUDENTS LIST TABLE WITH CONTROLS */}
              <div className="bg-white rounded-2xl shadow-3xs border border-slate-200/80 overflow-hidden">
                {/* Stats & Actions header inside the list */}
                <div className="p-3.5 sm:p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3" dir="rtl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-700">
                      عدد طلاب هذا الفصل: <span className="text-indigo-600 font-black">{students.filter(s => s.classId === selectedClassId).length}</span>
                    </span>
                    {selectedStudentIds.length > 0 && (
                      <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full text-3xs font-black border border-indigo-100 flex items-center gap-1 animate-pulse">
                        <span>تم تحديد {selectedStudentIds.length} طالب</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {selectedStudentIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteSelectedStudents}
                        disabled={submitting.deleteSelectedStudents}
                        className="bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 text-white px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        {submitting.deleteSelectedStudents ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 animate-bounce" />
                        )}
                        <span>حذف الطلاب المحددين ({selectedStudentIds.length})</span>
                      </button>
                    )}

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-3xs hover:border-slate-300 transition">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                        checked={
                          students.filter(s => s.classId === selectedClassId).filter(s => {
                            const term = studentSearchQuery.trim().toLowerCase();
                            return !term || s.name.toLowerCase().includes(term);
                          }).length > 0 &&
                          students.filter(s => s.classId === selectedClassId).filter(s => {
                            const term = studentSearchQuery.trim().toLowerCase();
                            return !term || s.name.toLowerCase().includes(term);
                          }).every(st => selectedStudentIds.includes(st.id))
                        }
                        onChange={(e) => {
                          const classFiltered = students.filter(s => s.classId === selectedClassId).filter(s => {
                            const term = studentSearchQuery.trim().toLowerCase();
                            return !term || s.name.toLowerCase().includes(term);
                          });
                          if (e.target.checked) {
                            setSelectedStudentIds(classFiltered.map(st => st.id));
                          } else {
                            setSelectedStudentIds([]);
                          }
                        }}
                      />
                      <span>تحديد الكل</span>
                    </label>
                  </div>
                </div>

                {/* List implementation */}
                {(() => {
                  const classStudents = students.filter(s => s.classId === selectedClassId);
                  const filteredClassStudents = classStudents.filter(s => {
                    const term = studentSearchQuery.trim().toLowerCase();
                    if (!term) return true;
                    return s.name.toLowerCase().includes(term);
                  }).sort((a, b) => a.name.localeCompare(b.name, "ar"));

                  if (classStudents.length === 0) {
                    return (
                      <div className="text-center py-16 space-y-3" dir="rtl">
                        <p className="text-xs text-slate-400 font-bold">لا يوجد طلاب مسجلين في هذا الفصل حالياً.</p>
                        <button
                          type="button"
                          onClick={() => setShowAddStudentSection(true)}
                          className="text-xs text-indigo-600 font-extrabold hover:underline cursor-pointer"
                        >
                          ابدأ بإضافة أول طالب للفصل الآن ✍️
                        </button>
                      </div>
                    );
                  }

                  if (filteredClassStudents.length === 0) {
                    return (
                      <div className="text-center py-12" dir="rtl">
                        <p className="text-xs text-slate-400 font-bold">لا يوجد طلاب يطابقون كلمة البحث في هذا الفصل.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-slate-100" dir="rtl">
                      {filteredClassStudents.map((st, idx) => {
                        const isSelected = selectedStudentIds.includes(st.id);

                        return (
                          <div 
                            key={`st-row-${st.id}-${idx}`} 
                            className={`py-3.5 px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors ${
                              isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60 bg-white'
                            }`}
                          >
                            {/* Number circle badge on the right + Student Name */}
                            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#f0f4f9] text-[#475569] font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-3xs">
                                {idx + 1}
                              </div>
                              <span className="text-sm sm:text-base font-bold text-[#0f172a] truncate">
                                {st.name}
                              </span>
                            </div>

                            {/* Control icons on the left */}
                            <div className="flex items-center gap-2.5 shrink-0">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudentIds(prev => [...prev, st.id]);
                                  } else {
                                    setSelectedStudentIds(prev => prev.filter(id => id !== st.id));
                                  }
                                }}
                                title="تحديد الطالب للحذف"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteStudent(st.id, st.name)}
                                disabled={submitting['deleteStudent_' + st.id]}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="حذف الطالب"
                              >
                                {submitting['deleteStudent_' + st.id] ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center space-y-4 shadow-3xs">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-full w-fit mx-auto">
                <Users className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h4 className="text-sm font-extrabold text-slate-800">بناء هيكل المدرسة والصفوف الدراسية</h4>
                <p className="text-xs text-slate-400 font-bold leading-relaxed">
                  الرجاء التأكد من تسجيل الصفوف الدراسية والفصول أولاً، ثم اختيار الصف والفصل المطلوب لعرض وإدارة كشوفات الطلاب وتعديل كلمات المرور.
                </p>
                <button
                  type="button"
                  onClick={() => setShowStructureManager(true)}
                  className="mt-3 bg-[#5046e5] hover:bg-indigo-700 text-white font-extrabold px-5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>تهيئة وإدارة الصفوف والفصول الآن</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. OVERLAY MODAL: SCHOOL ACADEMIC STRUCTURE MANAGER (Grades & Classes) */}
      {showStructureManager && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-50 rounded-2xl border border-slate-100 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleUp" dir="rtl">
            {/* Modal Header */}
            <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">إدارة صفوف وفصول المدرسة</h3>
                  <p className="text-3xs text-slate-400 font-bold">إضافة وتعديل وحذف الفصول الأكاديمية والمستويات الدراسية في المدرسة.</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setShowStructureManager(false);
                  onRefreshData().then(() => {
                    // Update selectors to make sure they point to valid data
                    if (grades.length > 0) {
                      if (!selectedGradeId || !grades.some(g => g.id === selectedGradeId)) {
                        setSelectedGradeId(grades[0].id);
                      }
                    }
                  });
                }}
                className="transition-all duration-300 p-2 rounded-xl flex items-center gap-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Card Grid Layout for Manual Structure Management */}
              <div className="space-y-6" dir="rtl">
                {/* Form to Add New Grade */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-3xs p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-slate-700">إضافة صفوف دراسية (كل صف في سطر):</label>
                    <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                      سطر لكل صف (نسخ ولصق من إكسل 📋)
                    </span>
                  </div>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newGradeName.trim()) return;
                      await handleAddGradeSubmit(e);
                    }}
                    className="flex flex-col gap-2.5"
                  >
                    <textarea
                      rows={3}
                      placeholder={"أدخل أسماء الصفوف (كل صف في سطر منفصل)...\nمثال:\nالصف الأول الثانوي\nالصف الثاني الثانوي\nالصف الثالث الثانوي"}
                      value={newGradeName}
                      onChange={(e) => setNewGradeName(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          if (newGradeName.trim()) {
                            handleAddGradeSubmit(e);
                          }
                        }
                      }}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-extrabold text-slate-800 focus:outline-none shadow-3xs text-right min-h-[72px] resize-y"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-medium">
                        ملاحظة: اضغط Ctrl + Enter أو زر الإضافة للحفظ
                      </span>
                      <button
                        type="submit"
                        disabled={submitting.addGrade || !newGradeName.trim()}
                        className="bg-[#5046e5] hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold px-6 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer whitespace-nowrap"
                      >
                        {submitting.addGrade ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        <span>إضافة الصفوف</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Available Grades Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4.5 h-4.5 text-indigo-600" />
                    <h5 className="text-sm font-black text-slate-800">
                      الصفوف الدراسية المتاحة ({grades.length})
                    </h5>
                  </div>
                </div>

                {grades.length > 0 && classes.length === 0 && (
                  <div className="bg-amber-400 text-slate-900 rounded-xl p-3 flex items-center gap-2 text-xs font-black shadow-2xs animate-pulse">
                    <span>💡 توجيه: تم إضافة الصفوف! يرجى إضافة الفصول الآن بالضغط على أرقام الفصول (1، 2، ...) لكل صف 👈</span>
                  </div>
                )}

                {/* Grade Cards List */}
                <div className="space-y-4">
                  {grades.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400 font-bold">
                      لا توجد صفوف دراسية مسجلة حالياً. استخدم المربع أعلاه لإضافة أول صف دراسي.
                    </div>
                  ) : (
                    grades.map((grade, idx) => {
                      const gradeClasses = classes.filter((c) => c.gradeId === grade.id);
                      const gradeStudentCount = students.filter((s) => s.gradeId === grade.id).length;

                      return (
                        <div
                          key={`struct-grade-${grade.id}-${idx}`}
                          id={`grade-card-${grade.id}`}
                          className="bg-white rounded-2xl border border-slate-200/90 shadow-3xs p-4 sm:p-5 space-y-4 transition-all"
                        >
                          {/* Grade Header Row */}
                          <div className="flex items-center justify-between">
                            {/* Grade Name Pill Badge */}
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-2 bg-indigo-50/90 text-indigo-700 font-black border border-indigo-200/80 px-4 py-1.5 rounded-full text-xs sm:text-sm">
                                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                <span>• {grade.name}</span>
                              </span>
                            </div>

                            {/* Student Count & Delete Grade Button */}
                            <div className="flex items-center gap-2">
                              <span className="bg-rose-50 text-rose-600 border border-rose-200/80 font-extrabold text-2xs px-2.5 py-1 rounded-lg">
                                {gradeStudentCount} طالب
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteGrade(grade.id, grade.name)}
                                disabled={submitting['deleteGrade_' + grade.id]}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="حذف الصف بكامل فصوله"
                              >
                                {submitting['deleteGrade_' + grade.id] ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="border-b border-slate-100"></div>

                          {/* Classes Grid */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <p className="text-2xs font-extrabold text-slate-700">
                                فصول الصف (اضغط على الرقم للإضافة أو الحذف):
                              </p>
                              {gradeClasses.length === 0 && (
                                <span className="bg-amber-400 text-slate-900 text-[10px] px-2.5 py-0.5 rounded-md font-black animate-bounce shadow-2xs">
                                  اضغط على رقم الفصل لإضافته للصف 👈
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 sm:gap-2">
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                                const cls = gradeClasses.find((c) => {
                                  const trimmed = c.name.trim();
                                  return (
                                    trimmed === `الفصل ${num}` ||
                                    trimmed === `${num}` ||
                                    trimmed.endsWith(` ${num}`)
                                  );
                                });

                                const exists = Boolean(cls);
                                const clsStudentCount = cls
                                  ? students.filter((s) => s.classId === cls.id).length
                                  : 0;

                                return (
                                  <button
                                    key={`scard-cls-${num}`}
                                    type="button"
                                    onClick={async () => {
                                      if (exists && cls) {
                                        handleDeleteClass(cls.id, cls.name, grade.id);
                                      } else {
                                        try {
                                          const className = `الفصل ${num}`;
                                          const newId = await addClass(className, grade.id);
                                          setClasses((prev) => {
                                            if (prev.some(c => c.id === newId || (c.gradeId === grade.id && c.name?.trim() === className))) {
                                              return prev;
                                            }
                                            return [
                                              ...prev,
                                              { id: newId, name: className, gradeId: grade.id },
                                            ];
                                          });
                                          onRefreshData().catch(console.error);
                                        } catch (err) {
                                          showMessage("حدث خطأ أثناء إضافة الفصل", "error");
                                        }
                                      }
                                    }}
                                    className={`flex flex-col rounded-xl sm:rounded-2xl overflow-hidden border transition-all duration-150 cursor-pointer shadow-3xs hover:shadow-md hover:scale-[1.03] active:scale-95 ${
                                      exists
                                        ? "border-indigo-600"
                                        : "border-indigo-200 hover:border-indigo-300"
                                    }`}
                                  >
                                    {/* Upper Box */}
                                    <div
                                      className={`py-2 px-1 text-center text-sm sm:text-base font-black flex items-center justify-center gap-1 ${
                                        exists
                                          ? "bg-[#5046e5] text-white"
                                          : "bg-white text-indigo-600 hover:bg-indigo-50/70"
                                      }`}
                                    >
                                      <span>{exists ? "✓" : "+"}</span>
                                      <span>{num}</span>
                                    </div>

                                    {/* Lower Box */}
                                    <div className="bg-[#fff1f2] text-rose-600 text-xs sm:text-[12.5px] font-extrabold py-1 border-t border-rose-100/80 text-center whitespace-nowrap">
                                      {clsStudentCount} طالب
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-6 flex-wrap gap-3" dir="rtl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        confirmAction(
                          "مسح شامل وتصفير نهائي لكافة بيانات السيرفر والمؤقتة",
                          "هل أنت متأكد من مسح وتصفير كافة البيانات من السيرفر والتخزين المؤقت وقاعدة البيانات نهائياً؟ يشمل ذلك الصفوف، الفصول، الطلاب، المعلمين، وسجلات الغياب والسلوك والتأخر ولن تعود البيانات السابقة نهائياً.",
                          async () => {
                            if (setGlobalProgress) {
                              setGlobalProgress({ active: true, type: "delete", label: "جاري مسح وتنظيف كافة بيانات السيرفر والمؤقتة نهائياً..." });
                            }
                            try {
                              const res = await purgeAllServerAndTemporaryData(true);
                              setGrades([]);
                              setClasses([]);
                              setStudents([]);
                              setTeachers([]);
                              setSelectedStudentIds([]);
                              showMessage(`تم مسح وتصفير كافة بيانات السيرفر والمؤقتة نهائياً بنجاح (${res.deletedCount} مستند)!`);
                              if (onRefreshData) await onRefreshData().catch(console.error);
                            } catch (e) {
                              showMessage("حدث خطأ أثناء عملية المسح الشامل", "error");
                            } finally {
                              if (setGlobalProgress) {
                                setGlobalProgress({ active: false, type: null, label: "" });
                              }
                            }
                          }
                        );
                      }}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>مسح وتصفير كامل بيانات السيرفر والمؤقتة</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (setGlobalProgress) {
                          setGlobalProgress({ active: true, type: "delete", label: "جاري تنظيف السجلات المحذوفة والمؤقتة..." });
                        }
                        try {
                          const res = await purgeDeletedAndOrphanedData();
                          showMessage(`تم تنظيف وحذف ${res.purgedCount} سجل مؤقت/محذوف عالق من السيرفر بنجاح!`);
                          if (onRefreshData) onRefreshData().catch(console.error);
                        } catch (e) {
                          showMessage("حدث خطأ أثناء تنظيف السجلات المؤقتة", "error");
                        } finally {
                          if (setGlobalProgress) {
                            setGlobalProgress({ active: false, type: null, label: "" });
                          }
                        }
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>تنظيف السجلات المحذوفة والمؤقتة العالقة</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white border-t border-slate-100 px-6 py-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowStructureManager(false);
                  onRefreshData().then(() => {
                    // Update selectors to make sure they point to valid data
                    if (grades.length > 0) {
                      if (!selectedGradeId || !grades.some(g => g.id === selectedGradeId)) {
                        setSelectedGradeId(grades[0].id);
                      }
                    }
                  });
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-xs transition"
              >
                <span>حفظ التغييرات وإغلاق</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Custom Confirmation Modal */}
      {confirmState && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md p-6 space-y-4 text-right animate-scaleUp" dir="rtl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-black">{confirmState.title}</h4>
            </div>
            <p className="text-xs text-slate-500 font-extrabold leading-relaxed">{confirmState.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold px-4.5 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = confirmState.onConfirm;
                  setConfirmState(null);
                  await action();
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-4.5 py-2.5 rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Custom Alert Modal (e.g. for Duplicates) */}
      {alertState && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg p-6 space-y-4 text-right animate-scaleUp animate-fadeIn" dir="rtl">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-2.5 bg-amber-50 rounded-2xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-800">{alertState.title}</h4>
            </div>
            
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 max-h-[250px] overflow-y-auto">
              <p className="text-xs text-slate-600 font-extrabold leading-relaxed whitespace-pre-wrap">{alertState.message}</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setAlertState(null)}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-xl text-xs shadow-xs transition-all cursor-pointer text-center"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Firebase Cloud Diagnostics & Properties Modal */}
      <FirebaseDiagnosticModal
        isOpen={showFirebaseDiagModal}
        onClose={() => setShowFirebaseDiagModal(false)}
        onTriggerSync={() => {
          syncAllLocalDataToFirestore().then(() => {
            if (onRefreshData) onRefreshData();
          });
        }}
      />
    </div>
  );
}
