import React, { useState, useEffect, useCallback } from "react";
import { 
  getGrades, 
  getClasses, 
  getTeachers, 
  getStudents, 
  getLocalCollection,
  seedDatabaseIfEmpty,
  getSchoolName,
  saveSchoolName,
  getEffectiveUidAndEmail,
  subscribeToGrades,
  subscribeToClasses,
  subscribeToTeachers,
  subscribeToStudents,
  subscribeToSchoolName,
  subscribeToAllAttendanceRecords,
  subscribeToAllMorningDelayRecords,
  subscribeToAllBehaviorRecords,
  registerUserInDb,
  setActiveUser,
  clearUserSessionState,
  syncAllLocalDataToFirestore,
  migrateGuestDataToUser,
  resolveOwnerProfileFromDb,
  getOrCreateOwnSchoolAdminId,
  setLinkedSchoolOwnerId,
  downloadSchoolBackupFile,
  importSchoolBackupData,
  testCloudFirestoreConnection,
  getSchoolCode,
  setSchoolCode,
  initServerSyncEngine,
  refreshServerSyncConnection,
  bootstrapSchoolToServer,
  ensureRegisteredSchoolLoaded,
  isIdDeleted,
  getLocalItems,
  MORNING_DELAYS_COLL
} from "./dbService";
import { Grade, Class, Teacher, Student } from "./types";
import TeacherPortal from "./components/TeacherPortal";
import MorningDelayPortal from "./components/MorningDelayPortal";
import AdminPanel from "./components/AdminPanel";
import SuperAdminPanel from "./components/SuperAdminPanel";
import MobileTopHeader from "./components/MobileTopHeader";
import MobileBottomNav from "./components/MobileBottomNav";
import MobileDrawer from "./components/MobileDrawer";
import DesktopHeader from "./components/DesktopHeader";
import ShareLinksModal from "./components/ShareLinksModal";
import { FirebaseDiagnosticModal } from "./components/FirebaseDiagnosticModal";
import { useDevice } from "./hooks/useDevice";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { 
  ClipboardCheck, 
  AlertTriangle, 
  BarChart3, 
  GraduationCap, 
  Briefcase, 
  Users, 
  Menu, 
  X, 
  Loader2, 
  Calendar, 
  Clock, 
  ShieldCheck,
  Pin,
  PinOff,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  ExternalLink,
  LogOut,
  Edit2,
  SunMedium,
  Cloud,
  CloudOff,
  RefreshCw,
  Key,
  Link2,
  Share2,
  Sparkles,
  HelpCircle,
  Download,
  Upload,
  School
} from "lucide-react";

function getInitialMode(): "teacher" | "admin" | "stats-only" | "super-admin" | "morning-delay" {
  const searchParams = new URLSearchParams(window.location.search);
  const hashIdx = window.location.hash.indexOf("?");
  const hashSearch = hashIdx !== -1 ? new URLSearchParams(window.location.hash.substring(hashIdx)) : null;

  const page = (searchParams.get("page") || hashSearch?.get("page") || "").toLowerCase();
  
  if (page === "super-admin") return "super-admin";
  if (page === "morning-delay") return "morning-delay";
  if (page === "stats-only" || page === "stats") return "stats-only";
  if (page === "teacher") return "teacher";
  if (page === "admin" || page === "index") return "admin";

  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (path.includes("super-admin") || hash.includes("super-admin")) {
    return "super-admin";
  }
  if (path.includes("morning-delay") || hash.includes("morning-delay")) {
    return "morning-delay";
  }
  if (path.includes("stats-only") || hash.includes("stats-only")) {
    return "stats-only";
  }
  if (path.includes("/teacher") || hash.includes("#/teacher")) {
    return "teacher";
  }
  if (path.includes("/admin") || hash.includes("#/admin") || path.includes("/index") || hash.includes("#/index")) {
    return "admin";
  }

  // If no explicit route in URL, default to admin mode
  return "admin";
}

function getInitialTeacherTab(): "attendance" | "behavior" {
  const searchParams = new URLSearchParams(window.location.search);
  const tab = searchParams.get("tab");
  if (tab === "attendance" || tab === "behavior") {
    return tab;
  }
  return "attendance";
}

function getInitialAdminTab(): "stats" | "grades" | "teachers" | "students" {
  const searchParams = new URLSearchParams(window.location.search);
  const tab = searchParams.get("tab");
  if (tab === "stats" || tab === "grades" || tab === "teachers" || tab === "students") {
    return tab as any;
  }
  return "stats";
}

function getInitialCachedUser(): any {
  if (typeof window === "undefined") return null;
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const hashIndex = window.location.hash.indexOf("?");
    const hashParams = hashIndex !== -1 ? new URLSearchParams(window.location.hash.substring(hashIndex)) : null;
    const rawSchoolCode = (searchParams.get("schoolCode") || searchParams.get("code") || searchParams.get("schoolId") || hashParams?.get("schoolCode") || hashParams?.get("code") || hashParams?.get("schoolId") || "").trim();
    let urlUid = (searchParams.get("owner") || searchParams.get("ownerId") || searchParams.get("uid") || hashParams?.get("owner") || hashParams?.get("ownerId") || hashParams?.get("uid") || rawSchoolCode).trim();
    let urlEmail = (searchParams.get("email") || searchParams.get("ownerEmail") || searchParams.get("userEmail") || hashParams?.get("email") || hashParams?.get("ownerEmail") || hashParams?.get("userEmail") || (rawSchoolCode.includes("@") ? rawSchoolCode : "")).trim().toLowerCase();
    try { urlUid = decodeURIComponent(urlUid); } catch (_) {}
    try { urlEmail = decodeURIComponent(urlEmail); } catch (_) {}
    const urlSchool = searchParams.get("school") || searchParams.get("schoolName") || hashParams?.get("school") || hashParams?.get("schoolName");
    if (urlUid || urlEmail) {
      return {
        uid: urlUid || "direct_user",
        email: urlEmail || "",
        displayName: urlSchool ? decodeURIComponent(urlSchool) : "المعلم / المشرف",
        isGuest: false
      };
    }

    if (auth?.currentUser) return auth.currentUser;
    if (localStorage.getItem("admin_direct_access") === "true") {
      return {
        uid: "njxly7aWt3TxLYAIjUvkabjroVr1",
        email: "majedsoft@gmail.com",
        displayName: "مدير المدرسة (ام الحمام الثانوية)",
        isGuest: false
      };
    }
    const raw = localStorage.getItem("last_active_school_owner");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.uid || parsed.email)) {
        return {
          uid: parsed.uid || "",
          email: parsed.email || "",
          displayName: parsed.displayName || "المعلم / المشرف",
          isGuest: false
        };
      }
    }
  } catch (_) {}
  // Default instant offline/active user so the application is immediately responsive and NEVER hangs
  return {
    uid: "guest_school_admin",
    email: "admin@school.local",
    displayName: "مدير النظام",
    isGuest: true
  };
}

function getInitialSchoolName(): string {
  if (typeof window === "undefined") return "ام الحمام الثانوية";
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const hashIndex = window.location.hash.indexOf("?");
    const hashParams = hashIndex !== -1 ? new URLSearchParams(window.location.hash.substring(hashIndex)) : null;
    const schoolParam = searchParams.get("school") || searchParams.get("schoolName") || hashParams?.get("school") || hashParams?.get("schoolName");
    if (schoolParam) return decodeURIComponent(schoolParam);
    const cached = localStorage.getItem("school_name_cached") || localStorage.getItem("school_name_cache");
    if (cached) return cached;
    const ownerRaw = localStorage.getItem("last_active_school_owner");
    if (ownerRaw) {
      const parsed = JSON.parse(ownerRaw);
      if (parsed?.email) {
        const byEmail = localStorage.getItem(`school_name_${parsed.email.toLowerCase().trim()}`);
        if (byEmail) return byEmail;
      }
    }
  } catch (_) {}
  return "ام الحمام الثانوية";
}

export default function App() {
  // Authentication States - Hydrate synchronously from cache for 0ms instant startup
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const cached = getInitialCachedUser();
    if (cached) {
      try {
        setActiveUser(cached);
      } catch (_) {}
    }
    return cached;
  });
  const [authChecking, setAuthChecking] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const initialMode = getInitialMode();
    // Portal links and cached users never need to wait for auth check
    if (initialMode === "teacher" || initialMode === "morning-delay" || initialMode === "stats-only") {
      return false;
    }
    if (getInitialCachedUser()) {
      return false;
    }
    return true;
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [domainCopied, setDomainCopied] = useState<boolean>(false);

  // School Name States - Hydrate instantly
  const [schoolName, setSchoolName] = useState<string>(() => getInitialSchoolName());
  const [isSavingSchoolName, setIsSavingSchoolName] = useState<boolean>(false);

  // Cloud Sync & Cross-Domain Link States
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [syncCodeInput, setSyncCodeInput] = useState<string>("");
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);
  const [adminSyncCopied, setAdminSyncCopied] = useState<boolean>(false);
  const [schoolCodeCopied, setSchoolCodeCopied] = useState<boolean>(false);
  const [isLinkingLoading, setIsLinkingLoading] = useState<boolean>(false);
  const [firestoreNeedsCreation, setFirestoreNeedsCreation] = useState<boolean>(false);
  const [backupFeedbackModal, setBackupFeedbackModal] = useState<{
    title: string;
    message: string;
    type?: "success" | "error" | "warning";
  } | null>(null);

  // Global Operation Progress State (Saves/Loads/Deletes across the app)
  const [globalProgress, setGlobalProgress] = useState<{
    active: boolean;
    type: "save" | "load" | "delete" | "import" | null;
    label: string;
  }>({ active: false, type: null, label: "" });

  // Failsafe auto-dismiss timer for globalProgress to guarantee the modal NEVER gets stuck
  useEffect(() => {
    if (globalProgress.active) {
      const timer = setTimeout(() => {
        setGlobalProgress({ active: false, type: null, label: "" });
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [globalProgress.active]);

  // Sidebar Inline School Name Edit States
  const [isEditingSidebarSchool, setIsEditingSidebarSchool] = useState<boolean>(false);
  const [sidebarSchoolInput, setSidebarSchoolInput] = useState<string>("");

  // Database States - Hydrate synchronously from cache for 0ms instant display
  const [grades, setGrades] = useState<Grade[]>(() => {
    if (typeof window === "undefined") return [];
    try { return getLocalCollection<Grade>("grades") || []; } catch (_) { return []; }
  });
  const [classes, setClasses] = useState<Class[]>(() => {
    if (typeof window === "undefined") return [];
    try { return getLocalCollection<Class>("classes") || []; } catch (_) { return []; }
  });
  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    if (typeof window === "undefined") return [];
    try { return getLocalCollection<Teacher>("teachers") || []; } catch (_) { return []; }
  });
  const [students, setStudents] = useState<Student[]>(() => {
    if (typeof window === "undefined") return [];
    try { return getLocalCollection<Student>("students") || []; } catch (_) { return []; }
  });
  const [loading, setLoading] = useState<boolean>(false);

  // Responsive Navigation States
  const [appMode, setAppMode] = useState<"teacher" | "admin" | "stats-only" | "super-admin" | "morning-delay">(getInitialMode());
  const [isDirectTeacherLink, setIsDirectTeacherLink] = useState<boolean>(() => {
    return getInitialMode() === "teacher";
  });
  const [isDirectMorningDelayLink, setIsDirectMorningDelayLink] = useState<boolean>(() => {
    return getInitialMode() === "morning-delay";
  });

  // If the user manually navigates to admin or other sections, reset direct link status
  useEffect(() => {
    if (appMode !== "teacher") {
      setIsDirectTeacherLink(false);
    }
    if (appMode !== "morning-delay") {
      setIsDirectMorningDelayLink(false);
    }
  }, [appMode]);

  const isDirectKiosk = isDirectTeacherLink || isDirectMorningDelayLink;
  const showSidebar = !isDirectKiosk && (appMode === "admin" || appMode === "super-admin" || appMode === "teacher" || appMode === "morning-delay");
  const showHeader = !isDirectKiosk;
  const showMobileHeader = !isDirectKiosk;
  const showMobileBottomNav = !isDirectKiosk;

  // Ref for header height measurement
  const headerRef = React.useRef<HTMLElement>(null);

  // Monitor header height dynamically and set CSS custom property
  useEffect(() => {
    const updateHeaderHeight = () => {
      const height = showHeader && headerRef.current ? headerRef.current.offsetHeight : 0;
      document.documentElement.style.setProperty('--header-height', `${height}px`);
    };

    updateHeaderHeight();

    let observer: ResizeObserver | null = null;
    if (headerRef.current) {
      observer = new ResizeObserver(updateHeaderHeight);
      observer.observe(headerRef.current);
    }

    window.addEventListener("resize", updateHeaderHeight);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, [showHeader, appMode]);

  const device = useDevice();
  const [copied, setCopied] = useState<boolean>(false);
  const [teacherCopied, setTeacherCopied] = useState<boolean>(false);
  const [morningDelayCopied, setMorningDelayCopied] = useState<boolean>(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [syncCloudSuccess, setSyncCloudSuccess] = useState<boolean>(false);
  const [isFirebaseDiagModalOpen, setIsFirebaseDiagModalOpen] = useState<boolean>(false);
  const [teacherTab, setTeacherTab] = useState<"attendance" | "behavior">(getInitialTeacherTab());
  const [adminTab, setAdminTab] = useState<"stats" | "grades" | "teachers" | "students">(getInitialAdminTab());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState<boolean>(false);
  const [schoolModalInput, setSchoolModalInput] = useState<string>("");
  const [isRefreshingData, setIsRefreshingData] = useState<boolean>(false);
  const [todayCounts, setTodayCounts] = useState<{ absentCount: number; delayCount: number; behaviorCount: number }>({ absentCount: 0, delayCount: 0, behaviorCount: 0 });

  const handleTodayStatsChange = useCallback((newStats: { absentCount: number; delayCount?: number; behaviorCount: number }) => {
    setTodayCounts(prev => {
      const delayCount = newStats.delayCount ?? prev.delayCount ?? 0;
      if (prev.absentCount === newStats.absentCount && prev.delayCount === delayCount && prev.behaviorCount === newStats.behaviorCount) {
        return prev;
      }
      return {
        absentCount: newStats.absentCount,
        delayCount,
        behaviorCount: newStats.behaviorCount
      };
    });
  }, []);

  // Desktop sidebar control states - Sidebar is permanently pinned and open
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  useEffect(() => {
    localStorage.setItem("sidebar_open", String(isSidebarOpen));
  }, [isSidebarOpen]);

  // Time formatting for header
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const appModeRef = React.useRef(appMode);
  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  // Setup real-time subscribers for grades, classes, teachers, and students to keep data synced instantly
  useEffect(() => {
    // Start real-time server synchronization engine
    initServerSyncEngine();

    const searchParams = new URLSearchParams(window.location.search);
    const hashIndex = window.location.hash.indexOf("?");
    const hashParams = hashIndex !== -1 ? new URLSearchParams(window.location.hash.substring(hashIndex)) : null;

    const pageParam = searchParams.get("page") || hashParams?.get("page") || "";
    const schoolCodeParam = searchParams.get("schoolCode") || searchParams.get("code") || searchParams.get("schoolId") || hashParams?.get("schoolCode") || hashParams?.get("code") || hashParams?.get("schoolId") || "";
    const ownerParam = searchParams.get("owner") || searchParams.get("ownerId") || searchParams.get("uid") || hashParams?.get("owner") || hashParams?.get("ownerId") || hashParams?.get("uid") || "";
    const emailParam = searchParams.get("email") || searchParams.get("ownerEmail") || searchParams.get("userEmail") || hashParams?.get("email") || hashParams?.get("ownerEmail") || hashParams?.get("userEmail") || "";
    const schoolParam = searchParams.get("school") || searchParams.get("schoolName") || hashParams?.get("school") || hashParams?.get("schoolName") || "";

    const effectiveCode = (schoolCodeParam || ownerParam || emailParam || "").trim();

    if (schoolParam) {
      const decodedSchool = decodeURIComponent(schoolParam);
      setSchoolName(decodedSchool);
    }

    if (effectiveCode) {
      setSchoolCode(effectiveCode);
      setLinkedSchoolOwnerId(effectiveCode);
      resolveOwnerProfileFromDb(effectiveCode).then((resolved) => {
        if (resolved) {
          const directUser = {
            uid: resolved.uid,
            email: resolved.email,
            displayName: resolved.schoolName || "المعلم / المشرف",
            isGuest: false
          };
          setActiveUser(directUser);
          setCurrentUser(directUser);
          refreshServerSyncConnection();
          if (resolved.schoolName) {
            setSchoolName(resolved.schoolName);
          }
          handleRefreshData().catch(() => {});
        }
      }).catch(() => {});
    }

    // Safety timeout: Guarantee authChecking and loading NEVER block the user longer than 600ms
    const authTimeout = setTimeout(() => {
      setAuthChecking(false);
      setLoading(false);
    }, 600);

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (user) => {
        clearTimeout(authTimeout);
        const currentMode = appModeRef.current;
        const isPortalPage = currentMode === "teacher" || currentMode === "morning-delay" || currentMode === "stats-only";
        
        try {
          if (user) {
            // If accessed via an independent school link on a portal page, preserve the linked school identity
            if (effectiveCode && isPortalPage) {
              console.log("Preserving independent link school context:", effectiveCode);
              setAuthChecking(false);
              return;
            }

            setCurrentUser(user);
            setActiveUser(user);
            refreshServerSyncConnection();
            try {
              localStorage.setItem("last_active_school_owner", JSON.stringify({ uid: user.uid, email: user.email || "" }));
              if (user.email) {
                localStorage.setItem("own_school_admin_email", user.email);
                setSchoolCode(user.email);
              }
              if (user.uid) {
                localStorage.setItem("own_school_admin_id", user.uid);
              }
            } catch (_) {}
            // Proactively refresh authoritative cloud data for this user on second device or reload
            handleRefreshData().catch(() => {});
          } else {
            // If accessed via direct link with code/owner/email params, initialize proxy user for direct viewing
            if (effectiveCode) {
              const directUser = {
                uid: ownerParam || effectiveCode,
                email: emailParam || (effectiveCode.includes("@") ? effectiveCode : `owner_${effectiveCode}@school.com`),
                displayName: "المعلم / المشرف",
                isGuest: false
              };
              setActiveUser(directUser);
              setCurrentUser(directUser);
              try {
                localStorage.setItem("last_active_school_owner", JSON.stringify({ uid: directUser.uid, email: directUser.email }));
              } catch (_) {}
            } else {
              let restoredUser: any = null;
              try {
                if (localStorage.getItem("admin_direct_access") === "true") {
                  restoredUser = {
                    uid: "njxly7aWt3TxLYAIjUvkabjroVr1",
                    email: "majedsoft@gmail.com",
                    displayName: "مدير المدرسة (ام الحمام الثانوية)",
                    isGuest: false
                  };
                } else {
                  const raw = localStorage.getItem("last_active_school_owner");
                  if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && (parsed.uid || parsed.email)) {
                      restoredUser = {
                        uid: parsed.uid || "",
                        email: parsed.email || "",
                        displayName: parsed.displayName || "المعلم / المشرف",
                        isGuest: false
                      };
                    }
                  }
                }
              } catch (_) {}

              if (restoredUser) {
                setActiveUser(restoredUser);
                setCurrentUser(restoredUser);
              } else {
                // Keep unauthenticated state clean - do not load school data if not logged in
                const fallback = {
                  uid: "guest_school_admin",
                  email: "admin@school.local",
                  displayName: "مدير النظام",
                  isGuest: true
                };
                setActiveUser(fallback);
                setCurrentUser(fallback);
              }
            }
          }
        } catch (authErr) {
          console.warn("Auth processing warning:", authErr);
        } finally {
          setAuthChecking(false);
          setLoading(false);
        }
      },
      (error) => {
        console.warn("onAuthStateChanged error:", error);
        clearTimeout(authTimeout);
        setAuthChecking(false);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(authTimeout);
      unsubscribeAuth();
    };
  }, []);

  // Listen for real-time school name broadcast events
  useEffect(() => {
    const handleSchoolNameEvent = (e: any) => {
      const updated = e?.detail;
      if (typeof updated === "string" && updated.trim().length > 0) {
        setSchoolName(updated.trim());
      }
    };
    window.addEventListener("school_name_updated", handleSchoolNameEvent);
    return () => {
      window.removeEventListener("school_name_updated", handleSchoolNameEvent);
    };
  }, []);

  // Synchronize registered user profile in Firestore
  useEffect(() => {
    if (currentUser && !currentUser.isGuest) {
      registerUserInDb({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
      }, schoolName).catch((err) => {
        console.error("Error updating registration: ", err);
      });
    }
  }, [currentUser, schoolName]);

  const getNumberFromName = (name: string): number => {
    const match = name.match(/\d+/);
    return match ? parseInt(match[0], 10) : 999999;
  };

  const deduplicateById = <T extends { id: string }>(arr: T[]): T[] => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set<string>();
    return arr.filter(item => {
      if (!item || !item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  const deduplicateStudents = (arr: Student[]): Student[] => {
    if (!Array.isArray(arr)) return [];
    const seenIds = new Set<string>();
    return arr.filter(student => {
      if (!student || !student.id) return false;
      if (seenIds.has(student.id)) return false;
      seenIds.add(student.id);
      return true;
    });
  };

  const deduplicateClasses = (arr: Class[]): Class[] => {
    if (!Array.isArray(arr)) return [];
    const seenIds = new Set<string>();
    const seenGradeName = new Set<string>();
    return arr.filter(c => {
      if (!c || !c.id || seenIds.has(c.id)) return false;
      const key = `${c.gradeId}_${c.name?.trim()}`;
      if (seenGradeName.has(key)) return false;
      seenIds.add(c.id);
      seenGradeName.add(key);
      return true;
    });
  };

  useEffect(() => {
    // Pre-populate with local cached items for 0ms instant display while live sync connects
    const localGrades = getLocalCollection<Grade>("grades");
    const localClasses = getLocalCollection<Class>("classes");
    const localTeachers = getLocalCollection<Teacher>("teachers");
    const localStudents = getLocalCollection<Student>("students");
    if (localGrades.length > 0) setGrades(localGrades);
    if (localClasses.length > 0) setClasses(localClasses);
    if (localTeachers.length > 0) setTeachers(localTeachers);
    if (localStudents.length > 0) setStudents(localStudents);

    // Check cached school name strictly scoped to current user email/uid or fallback
    const userEmail = currentUser?.email?.toLowerCase().trim();
    const userUid = currentUser?.uid;
    const cachedName = (userEmail ? localStorage.getItem(`school_name_${userEmail}`) : null) || 
      (userUid ? localStorage.getItem(`school_name_${userUid}`) : null) ||
      localStorage.getItem("school_name_cached") ||
      localStorage.getItem("school_name_cache");
    if (cachedName) setSchoolName(cachedName);

    // Only activate loading if there is zero cached data
    if (localGrades.length === 0 && localClasses.length === 0 && !cachedName) {
      setLoading(true);
    } else {
      setLoading(false);
    }

    const safetyLoadTimer = setTimeout(() => {
      setLoading(false);
    }, 400);

    let unsubSchool: (() => void) | null = null;
    let unsubGrades: (() => void) | null = null;
    let unsubClasses: (() => void) | null = null;
    let unsubTeachers: (() => void) | null = null;
    let unsubStudents: (() => void) | null = null;

    try {
      // 1. Subscribe to School Name
      unsubSchool = subscribeToSchoolName((newName) => {
        if (newName && newName.trim().length > 0) {
          setSchoolName(newName.trim());
          if (currentUser?.email) {
            localStorage.setItem(`school_name_${currentUser.email.toLowerCase().trim()}`, newName.trim());
          }
          if (currentUser?.uid) {
            localStorage.setItem(`school_name_${currentUser.uid}`, newName.trim());
          }
          if (typeof window !== "undefined") {
            localStorage.setItem("school_name_cached", newName.trim());
          }
        }
      });

      // 2. Subscribe to Grades
      unsubGrades = subscribeToGrades((newGrades) => {
        const safeList = Array.isArray(newGrades) ? newGrades : [];
        const seenNames = new Set<string>();
        const uniqueGrades: Grade[] = [];
        for (const g of safeList) {
          if (!g || !g.id) continue;
          const key = (g.name || "").trim();
          if (!seenNames.has(key)) {
            seenNames.add(key);
            uniqueGrades.push(g);
          }
        }
        const sorted = uniqueGrades.sort((a, b) => {
          const timeA = (a as any).createdAt || 0;
          const timeB = (b as any).createdAt || 0;
          if (timeA !== timeB) return timeA - timeB;
          return (a.name || "").localeCompare(b.name || "", "ar");
        });
        setGrades(sorted);
        setLoading(false);
      });

      // 3. Subscribe to Classes
      unsubClasses = subscribeToClasses((newClasses) => {
        const safeList = Array.isArray(newClasses) ? newClasses : [];
        const sorted = deduplicateClasses([...safeList]).sort((a, b) => {
          const numA = getNumberFromName(a.name);
          const numB = getNumberFromName(b.name);
          if (numA !== numB) return numA - numB;
          return (a.name || "").localeCompare(b.name || "", "ar");
        });
        setClasses(sorted);
      });

      // 4. Subscribe to Teachers
      unsubTeachers = subscribeToTeachers((newTeachers) => {
        const safeList = Array.isArray(newTeachers) ? newTeachers : [];
        const seenNames = new Set<string>();
        const uniqueTeachers: Teacher[] = [];
        for (const t of safeList) {
          if (!t || !t.id) continue;
          const key = (t.name || "").trim();
          if (!seenNames.has(key)) {
            seenNames.add(key);
            uniqueTeachers.push(t);
          }
        }
        const sorted = uniqueTeachers.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        setTeachers(sorted);
      });

      // 5. Subscribe to Students
      unsubStudents = subscribeToStudents((newStudents) => {
        const safeList = Array.isArray(newStudents) ? newStudents : [];
        setStudents(deduplicateStudents(safeList));
      });

      // 6. Real-time live subscriptions for Attendance, Delays, and Behaviors to keep counts and stats updated instantly across all tabs
      let latestAttendance: any[] = [];
      let latestDelays: any[] = [];
      let latestBehaviors: any[] = [];

      const computeLiveTodayCounts = () => {
        const todayStr = new Date().toISOString().split("T")[0];
        const absentStudentIds = new Set<string>();
        const delayStudentIds = new Set<string>();

        latestAttendance.forEach((rec: any) => {
          if (rec && rec.date === todayStr) {
            if (Array.isArray(rec.absent)) {
              rec.absent.forEach((sId: string) => {
                if (sId && sId !== "no-absence") absentStudentIds.add(sId);
              });
            }
            if (Array.isArray(rec.late)) {
              rec.late.forEach((sId: string) => {
                if (sId) {
                  delayStudentIds.add(sId);
                  // Student is late, NOT absent
                  absentStudentIds.delete(sId);
                }
              });
            }
          }
        });

        // Morning delays: students arrived at school late. They are LATE, NOT ABSENT!
        latestDelays.forEach((del: any) => {
          if (del && del.date === todayStr && del.studentId) {
            delayStudentIds.add(del.studentId);
            // If mistakenly marked absent earlier, remove them because they arrived late
            absentStudentIds.delete(del.studentId);
          }
        });

        const behaviorCount = latestBehaviors.filter((b: any) => b && b.date === todayStr).length;

        setTodayCounts(prev => {
          if (prev.absentCount === absentStudentIds.size && prev.delayCount === delayStudentIds.size && prev.behaviorCount === behaviorCount) {
            return prev;
          }
          return {
            absentCount: absentStudentIds.size,
            delayCount: delayStudentIds.size,
            behaviorCount
          };
        });
      };

      const unsubAttendance = subscribeToAllAttendanceRecords((records) => {
        if (latestAttendance.length > 0 && Array.isArray(records) && records.length === 0) {
          const hasExistingNotDeleted = latestAttendance.some(r => !isIdDeleted("attendance", r.id));
          if (hasExistingNotDeleted) return;
        }
        latestAttendance = Array.isArray(records) ? records : [];
        computeLiveTodayCounts();
      });

      const unsubDelays = subscribeToAllMorningDelayRecords((records) => {
        latestDelays = Array.isArray(records) ? records : [];
        computeLiveTodayCounts();
      });

      const handleAppDelayRefresh = (e: any) => {
        const detail = e?.detail;
        if (detail?.type === "delay_deleted") {
          const delId = detail.deletedId;
          const delIds = Array.isArray(detail.deletedIds) ? detail.deletedIds : [delId].filter(Boolean);
          const sId = detail.studentId;
          const dDate = detail.date;
          latestDelays = latestDelays.filter(d => {
            if (delIds.length > 0 && delIds.includes(d.id)) return false;
            if (sId && dDate && d.studentId === sId && d.date === dDate) return false;
            return true;
          });
        } else if ((detail?.type === "delay_recorded" || detail?.type === "delays_batch_recorded") && (detail.record || detail.records)) {
          const incoming = detail.records ? detail.records : [detail.record];
          incoming.forEach((rec: any) => {
            if (rec && rec.id) {
              latestDelays = latestDelays.filter(d => !(d.id === rec.id || (d.studentId === rec.studentId && d.date === rec.date)));
              latestDelays.unshift(rec);
            }
          });
        } else {
          const local = getLocalItems(MORNING_DELAYS_COLL);
          if (Array.isArray(local) && local.length > 0) {
            latestDelays = local;
          }
        }
        computeLiveTodayCounts();
      };
      window.addEventListener("school_refresh_delays", handleAppDelayRefresh);
      window.addEventListener("school_data_synced", handleAppDelayRefresh);

      const unsubBehaviors = subscribeToAllBehaviorRecords((records) => {
        if (latestBehaviors.length > 0 && Array.isArray(records) && records.length === 0) {
          const hasExistingNotDeleted = latestBehaviors.some(b => !isIdDeleted("behaviors", b.id));
          if (hasExistingNotDeleted) return;
        }
        latestBehaviors = Array.isArray(records) ? records : [];
        computeLiveTodayCounts();
      });

      // Turn off loading spinner quickly
      setTimeout(() => setLoading(false), 250);

      // Auto-bootstrap local school data to server sync store
      setTimeout(async () => {
        try {
          const currentGrades = await getGrades();
          const currentClasses = await getClasses();
          const currentTeachers = await getTeachers();
          const currentStudents = await getStudents();
          const currentSchoolName = await getSchoolName();
          if (currentGrades.length > 0 || currentClasses.length > 0 || currentTeachers.length > 0 || currentStudents.length > 0 || currentSchoolName) {
            bootstrapSchoolToServer(
              currentSchoolName,
              currentGrades,
              currentClasses,
              currentTeachers,
              currentStudents,
              true
            );
          }
        } catch (_) {}
      }, 1500);

      return () => {
        clearTimeout(safetyLoadTimer);
        if (unsubSchool) (unsubSchool as () => void)();
        if (unsubGrades) (unsubGrades as () => void)();
        if (unsubClasses) (unsubClasses as () => void)();
        if (unsubTeachers) (unsubTeachers as () => void)();
        if (unsubStudents) (unsubStudents as () => void)();
        if (unsubAttendance) (unsubAttendance as () => void)();
        if (unsubDelays) (unsubDelays as () => void)();
        if (unsubBehaviors) (unsubBehaviors as () => void)();
        window.removeEventListener("school_refresh_delays", handleAppDelayRefresh);
        window.removeEventListener("school_data_synced", handleAppDelayRefresh);
      };
    } catch (err) {
      console.error("Error doing database subscriptions:", err);
      setLoading(false);
    }
  }, [currentUser]);

  const handleRefreshData = async () => {
    setIsRefreshingData(true);
    try {
      // 1. Force fetch authoritative state directly from Firestore (in parallel)
      const [g, c, t, s, sn] = await Promise.all([
        getGrades(true),
        getClasses(true),
        getTeachers(true),
        getStudents(true),
        getSchoolName(true)
      ]);
      if (sn && sn.trim().length > 0) {
        setSchoolName(sn.trim());
      }
      const seenGradeNames = new Set<string>();
      const uniqueGrades: Grade[] = [];
      for (const grade of g) {
        if (!grade || !grade.id) continue;
        const key = (grade.name || "").trim();
        if (!seenGradeNames.has(key)) {
          seenGradeNames.add(key);
          uniqueGrades.push(grade);
        }
      }
      const sortedGrades = uniqueGrades.sort((a, b) => {
        const timeA = (a as any).createdAt || 0;
        const timeB = (b as any).createdAt || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.name.localeCompare(b.name, "ar");
      });
      setGrades(sortedGrades);

      const sortedClasses = deduplicateClasses([...c]).sort((a, b) => {
        const numA = getNumberFromName(a.name);
        const numB = getNumberFromName(b.name);
        if (numA !== numB) return numA - numB;
        return a.name.localeCompare(b.name, "ar");
      });
      setClasses(sortedClasses);

      const seenTeacherNames = new Set<string>();
      const uniqueTeachers: Teacher[] = [];
      for (const teacher of t) {
        if (!teacher || !teacher.id) continue;
        const key = (teacher.name || "").trim();
        if (!seenTeacherNames.has(key)) {
          seenTeacherNames.add(key);
          uniqueTeachers.push(teacher);
        }
      }
      const sortedTeachers = uniqueTeachers.sort((a, b) => a.name.localeCompare(b.name, "ar"));
      setTeachers(sortedTeachers);

      const finalStudents = deduplicateStudents(s);
      setStudents(finalStudents);

      // Synchronize all latest data to server sync store (exact match)
      bootstrapSchoolToServer(
        sn || schoolName,
        sortedGrades,
        sortedClasses,
        sortedTeachers,
        finalStudents,
        true
      );

      try {
        window.dispatchEvent(new CustomEvent("school_refresh_stats"));
      } catch (_) {}
    } catch (err) {
      console.error("Error refreshing data:", err);
    } finally {
      setIsRefreshingData(false);
      setLoading(false);
    }
  };

  const buildSharedUrl = (pageValue: string, extraParams: string = "") => {
    const schoolCode = getSchoolCode();
    const ownerId = currentUser?.uid || auth.currentUser?.uid || localStorage.getItem("own_school_admin_id") || getOrCreateOwnSchoolAdminId();
    const ownerEmail = currentUser?.email || auth.currentUser?.email || localStorage.getItem("own_school_admin_email") || "";
    
    const cleanSchoolCode = schoolCode || ownerEmail || ownerId;

    let query = `page=${pageValue}`;
    if (extraParams) query += `&${extraParams}`;
    if (cleanSchoolCode) query += `&schoolCode=${encodeURIComponent(cleanSchoolCode)}&code=${encodeURIComponent(cleanSchoolCode)}`;
    if (ownerId) query += `&owner=${encodeURIComponent(ownerId)}&uid=${encodeURIComponent(ownerId)}`;
    if (ownerEmail && !ownerEmail.endsWith("@school.com")) query += `&email=${encodeURIComponent(ownerEmail)}`;
    if (schoolName) query += `&school=${encodeURIComponent(schoolName)}`;

    const targetPath = pageValue === "admin" ? "/" 
      : pageValue === "super-admin" ? "/super-admin" 
      : pageValue === "morning-delay" ? "/morning-delay" 
      : pageValue === "teacher" ? "/teacher" 
      : "/";

    return `${window.location.origin}${targetPath}?${query}#/${pageValue}?${query}`;
  };

  // Robust clipboard copy function with textarea fallback for iframes and permissions
  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      console.warn("navigator.clipboard failed, attempting fallback:", e);
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      textArea.style.opacity = "0";
      textArea.setAttribute("readonly", "");
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error("Fallback execCommand failed:", err);
      return false;
    }
  };

  const handleCopyStatsLink = () => {
    const statsLink = buildSharedUrl("stats-only", "tab=stats");
    copyTextToClipboard(statsLink).then((ok) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
  };

  const handleCopyTeacherLink = () => {
    const teacherLink = buildSharedUrl("teacher", "tab=attendance");
    copyTextToClipboard(teacherLink).then((ok) => {
      if (ok) {
        setTeacherCopied(true);
        setTimeout(() => setTeacherCopied(false), 2000);
      }
    });
  };

  const handleCopyMorningDelayLink = () => {
    const delayLink = buildSharedUrl("morning-delay");
    copyTextToClipboard(delayLink).then((ok) => {
      if (ok) {
        setMorningDelayCopied(true);
        setTimeout(() => setMorningDelayCopied(false), 2000);
      }
    });
  };

  const handleCopyAdminSyncLink = () => {
    const adminLink = buildSharedUrl("admin", "page=admin&tab=stats");
    copyTextToClipboard(adminLink).then((ok) => {
      if (ok) {
        setAdminSyncCopied(true);
        setTimeout(() => setAdminSyncCopied(false), 2500);
      }
    });
  };

  const handleSyncCloudData = async () => {
    setIsSyncingCloud(true);
    setSyncCloudSuccess(false);
    try {
      const res = await syncAllLocalDataToFirestore();
      if (res.success) {
        await handleRefreshData();
        setSyncCloudSuccess(true);
        setTimeout(() => setSyncCloudSuccess(false), 4000);
      } else {
        if (res.code === "DATABASE_NOT_FOUND" || res.code === "PERMISSION_DENIED") {
          setIsFirebaseDiagModalOpen(true);
        } else {
          setBackupFeedbackModal({
            title: "تنبيه المزامنة السحابية ⚠️",
            message: res.message,
            type: "warning"
          });
        }
      }
    } catch (err: any) {
      console.error("Error syncing data with cloud:", err);
      setBackupFeedbackModal({
        title: "خطأ في الاتصال ❌",
        message: err?.message || "حدث خطأ أثناء المزامنة السحابية",
        type: "error"
      });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleUploadBackup = async (file: File) => {
    try {
      setGlobalProgress({ active: true, type: "import", label: "جاري استيراد وتثبيت النسخة الاحتياطية..." });
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await importSchoolBackupData(json);
      if (res.success) {
        await handleRefreshData();
        setBackupFeedbackModal({
          title: "تم استيراد النسخة الاحتياطية بنجاح ✅",
          message: `تمت استعادة كافة بيانات المدرسة بنجاح!\n• الصفوف: ${res.counts.grades || 0}\n• الفصول: ${res.counts.classes || 0}\n• الطلاب: ${res.counts.students || 0}\n• المعلمين: ${res.counts.teachers || 0}\n• سجلات الغياب: ${res.counts.attendance || 0}`,
          type: "success"
        });
      } else {
        setBackupFeedbackModal({
          title: "فشل استيراد النسخة الاحتياطية ❌",
          message: res.message,
          type: "error"
        });
      }
    } catch (e: any) {
      setBackupFeedbackModal({
        title: "خطأ في قراءة ملف النسخة الاحتياطية ⚠️",
        message: "الملف المرفق غير صالح أو ليس بتنسيق JSON صحيح: " + (e?.message || e),
        type: "error"
      });
    } finally {
      setGlobalProgress({ active: false, type: null, label: "" });
    }
  };

  const handleCopySchoolCode = (code: string) => {
    copyTextToClipboard(code).then((ok) => {
      if (ok) {
        setSchoolCodeCopied(true);
        setTimeout(() => setSchoolCodeCopied(false), 2500);
      }
    });
  };

  const handleGoogleLogin = async () => {
    setLoginError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const user = res.user;
      if (user) {
        setCurrentUser(user);
        setActiveUser(user);
        refreshServerSyncConnection();
        try {
          localStorage.setItem("last_active_school_owner", JSON.stringify({ uid: user.uid, email: user.email || "" }));
          if (user.email) {
            localStorage.setItem("own_school_admin_email", user.email);
          }
          if (user.uid) {
            localStorage.setItem("own_school_admin_id", user.uid);
          }
        } catch (_) {}
        setLoading(true);
        // Force refresh authoritative data from Firestore
        await handleRefreshData();
        // Background sync: non-blocking, safe against write quota exhaustion
        syncAllLocalDataToFirestore().catch(() => {});
      }
      setAppMode("admin");
      setAdminTab("stats");
      localStorage.removeItem("last_admin_tab");
      window.history.replaceState({ mode: "admin" }, "", "/admin?page=admin&tab=stats#/admin");
      setIsSyncModalOpen(false);
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      if (err?.code === "auth/unauthorized-domain" || err?.message?.includes("unauthorized-domain")) {
        setLoginError("auth/unauthorized-domain");
      } else {
        setLoginError(err?.message || "حدث خطأ أثناء تسجيل الدخول");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDirectAdminLogin = () => {
    const directUser = {
      uid: "njxly7aWt3TxLYAIjUvkabjroVr1",
      email: "majedsoft@gmail.com",
      displayName: "مدير المدرسة (ام الحمام الثانوية)",
      isGuest: false
    };
    try {
      localStorage.setItem("admin_direct_access", "true");
      localStorage.setItem("last_active_school_owner", JSON.stringify({ uid: directUser.uid, email: directUser.email }));
      localStorage.setItem("linked_school_owner_id", "majedsoft@gmail.com");
      localStorage.setItem("registered_school_code", "majedsoft@gmail.com");
      localStorage.setItem("own_school_admin_email", "majedsoft@gmail.com");
    } catch (_) {}
    setCurrentUser(directUser);
    setActiveUser(directUser);
    setLoginError(null);
    setLoading(true);
    handleRefreshData().finally(() => setLoading(false));
  };

  const handleLinkSchoolCode = async (rawInput: string) => {
    if (!rawInput || !rawInput.trim()) {
      setSyncErrorMsg("الرجاء إدخال كود المزامنة أو الرابط المباشر");
      return;
    }

    setSyncErrorMsg(null);
    setSyncSuccessMsg(null);
    setIsLinkingLoading(true);

    try {
      let targetCode = rawInput.trim();
      // If a full URL was pasted, extract schoolCode, owner, or email parameter
      if (targetCode.includes("?") || targetCode.includes("#")) {
        try {
          const urlObj = new URL(targetCode.startsWith("http") ? targetCode : `https://${targetCode}`);
          const pCode = urlObj.searchParams.get("schoolCode") || urlObj.searchParams.get("code") || urlObj.searchParams.get("schoolId");
          const pOwner = urlObj.searchParams.get("owner") || urlObj.searchParams.get("ownerId") || urlObj.searchParams.get("uid");
          const pEmail = urlObj.searchParams.get("email") || urlObj.searchParams.get("ownerEmail");
          if (pCode) targetCode = decodeURIComponent(pCode);
          else if (pOwner) targetCode = decodeURIComponent(pOwner);
          else if (pEmail) targetCode = decodeURIComponent(pEmail);
          else if (urlObj.hash.includes("?")) {
            const hashIdx = urlObj.hash.indexOf("?");
            const hashParams = new URLSearchParams(urlObj.hash.substring(hashIdx));
            const hCode = hashParams.get("schoolCode") || hashParams.get("code") || hashParams.get("schoolId");
            const hOwner = hashParams.get("owner") || hashParams.get("ownerId") || hashParams.get("uid");
            const hEmail = hashParams.get("email") || hashParams.get("ownerEmail");
            if (hCode) targetCode = decodeURIComponent(hCode);
            else if (hOwner) targetCode = decodeURIComponent(hOwner);
            else if (hEmail) targetCode = decodeURIComponent(hEmail);
          }
        } catch (e) {}
      }

      setSchoolCode(targetCode);
      setLinkedSchoolOwnerId(targetCode);

      // Attempt to resolve profile from DB or use clean ID
      const resolved = await resolveOwnerProfileFromDb(targetCode);
      const updatedUser = {
        uid: resolved?.uid || targetCode,
        email: resolved?.email || (targetCode.includes("@") ? targetCode : `owner_${targetCode}@school.com`),
        displayName: resolved?.schoolName || "مدرسة متزامنة سحابياً",
        isGuest: false
      };

      setCurrentUser(updatedUser);
      setActiveUser(updatedUser);

      // Refresh data
      await handleRefreshData();

      setSyncSuccessMsg("تم ربط ومزامنة بيانات المدرسة بنجاح! تم تحميل الهيكل والصفوف وكافة البيانات.");
      setSyncCodeInput("");
    } catch (err: any) {
      console.error("Link error:", err);
      setSyncErrorMsg("حدث خطأ أثناء محاولة الربط: " + (err?.message || ""));
    } finally {
      setIsLinkingLoading(false);
    }
  };

  const handleSchoolNameChange = async (newName: string) => {
    // 1. Optimistic Update (Instant 0ms feedback on the UI and cache)
    setSchoolName(newName);
    const eff = getEffectiveUidAndEmail();
    if (eff.uid) {
      localStorage.setItem(`school_name_${eff.uid}`, newName);
    }
    if (eff.email) {
      localStorage.setItem(`school_name_${eff.email.toLowerCase()}`, newName);
    }
    localStorage.setItem("school_name_cache", newName);
    
    // 2. Background async save (0ms perceived latency)
    saveSchoolName(newName).catch(err => console.error("Error saving school name:", err));
  };

  // Synchronize app mode with URL routing
  useEffect(() => {
    const handleUrlChange = () => {
      setAppMode(getInitialMode());
    };
    
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("hashchange", handleUrlChange);
    };
  }, []);

  // Direct to Admin Stats Dashboard (بوابة متابعة الغياب والسلوك) on initial login if no explicit page param
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (!searchParams.has("page")) {
      setAppMode("admin");
      setAdminTab("stats");
    }
  }, []);

  // Persist current mode and tabs to localStorage & keep URL state in perfect sync
  useEffect(() => {
    if (authChecking || !currentUser) return; // Only sync and persist when successfully logged in!

    if (appMode) {
      localStorage.setItem("last_app_mode", appMode);
    }
    if (teacherTab) {
      localStorage.setItem("last_teacher_tab", teacherTab);
    }
    if (adminTab) {
      localStorage.setItem("last_admin_tab", adminTab);
    }

    const currentSearch = new URLSearchParams(window.location.search);
    const hashIdx = window.location.hash.indexOf("?");
    const hashSearch = hashIdx !== -1 ? new URLSearchParams(window.location.hash.substring(hashIdx)) : null;

    const currentPage = currentSearch.get("page") || hashSearch?.get("page");
    const currentTab = currentSearch.get("tab") || hashSearch?.get("tab");
    const currentOwner = currentSearch.get("owner") || hashSearch?.get("owner");

    let expectedPage = "admin";
    if (appMode === "super-admin") expectedPage = "super-admin";
    else if (appMode === "stats-only") expectedPage = "stats-only";
    else if (appMode === "teacher") expectedPage = "teacher";
    else if (appMode === "morning-delay") expectedPage = "morning-delay";

    const expectedTab = appMode === "teacher" ? teacherTab : adminTab;

    if (currentPage !== expectedPage || (appMode !== "morning-delay" && currentTab !== expectedTab)) {
      const newPath = appMode === "admin" ? "/" : appMode === "super-admin" ? "/super-admin" : appMode === "morning-delay" ? "/morning-delay" : appMode === "stats-only" ? "/stats" : "/";
      const ownerPart = currentOwner ? `&owner=${currentOwner}` : "";
      const tabPart = appMode === "morning-delay" ? "" : `&tab=${expectedTab}`;
      const newSearch = `?page=${expectedPage}${tabPart}${ownerPart}`;
      const newHash = appMode === "admin" ? "#/index" : appMode === "super-admin" ? "#/super-admin" : appMode === "morning-delay" ? "#/morning-delay" : appMode === "stats-only" ? "#/stats" : "#/";
      
      window.history.replaceState({ mode: appMode }, "", `${newPath}${newSearch}${newHash}`);
    }
  }, [appMode, adminTab, teacherTab, authChecking, currentUser]);

  // Update browser tab title and dynamic favicon icon based on active mode/tab
  useEffect(() => {
    let title = schoolName ? `بوابة ${schoolName}` : "البوابة الرقمية للرصد والمتابعة";
    let emoji = "🏫";
    
    if (appMode === "morning-delay") {
      title = schoolName ? `رصد التأخر الصباحي | ${schoolName}` : "رصد التأخر الصباحي | البوابة الرقمية";
      emoji = "⏰";
    } else if (appMode === "stats-only") {
      title = schoolName ? `متابعة الغياب والسلوك | ${schoolName}` : "متابعة الغياب والسلوك | البوابة الرقمية";
      emoji = "📊";
    } else if (appMode === "teacher") {
      if (teacherTab === "attendance") {
        title = `رصد الحضور والغياب | ${schoolName || "البوابة الرقمية"}`;
        emoji = "📋";
      } else if (teacherTab === "behavior") {
        title = `الرصد السلوكي للطلاب | ${schoolName || "البوابة الرقمية"}`;
        emoji = "⚠️";
      }
    } else if (appMode === "admin") {
      if (adminTab === "stats") {
        title = "متابعة الغياب والسلوك | لوحة التحكم";
        emoji = "📊";
      } else if (adminTab === "students") {
        title = "إضافة الطلاب والفصول | لوحة التحكم";
        emoji = "👥";
      } else if (adminTab === "teachers") {
        title = "إضافة المعلمين | لوحة التحكم";
        emoji = "💼";
      }
    }
    document.title = title;

    // Dynamically update browser tab icon using SVG text with matching emoji
    try {
      // Remove any existing favicon links to prevent duplicate favicon tags
      const existingLinks = document.querySelectorAll("link[rel*='icon']");
      existingLinks.forEach(el => el.parentNode?.removeChild(el));

      const link = document.createElement('link');
      link.type = 'image/svg+xml';
      link.rel = 'icon';
      link.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>${emoji}</text></svg>`;
      document.getElementsByTagName('head')[0].appendChild(link);
    } catch (e) {
      console.error("Error setting favicon:", e);
    }
  }, [appMode, teacherTab, adminTab, schoolName]);

  const navigateTo = (mode: "teacher" | "admin" | "stats-only" | "super-admin" | "morning-delay") => {
    const currentSearch = new URLSearchParams(window.location.search);
    const hashIdx = window.location.hash.indexOf("?");
    const hashSearch = hashIdx !== -1 ? new URLSearchParams(window.location.hash.substring(hashIdx)) : null;
    const currentOwner = currentSearch.get("owner") || hashSearch?.get("owner");
    const ownerPart = currentOwner ? `&owner=${currentOwner}` : "";

    const newPath = mode === "admin" ? "/admin" : mode === "super-admin" ? "/super-admin" : mode === "morning-delay" ? "/morning-delay" : mode === "stats-only" ? "/" : "/";
    const newSearch = mode === "admin" ? `?page=admin${ownerPart}` : mode === "super-admin" ? `?page=super-admin${ownerPart}` : mode === "morning-delay" ? `?page=morning-delay${ownerPart}` : mode === "stats-only" ? `?page=stats-only${ownerPart}` : `?page=teacher${ownerPart}`;
    const newHash = mode === "admin" ? "#/admin" : mode === "super-admin" ? "#/super-admin" : mode === "morning-delay" ? "#/morning-delay" : mode === "stats-only" ? "#/stats-only" : "#/";
    
    // Push state to browser history
    window.history.pushState({ mode }, "", `${newPath}${newSearch}${newHash}`);
    setAppMode(mode);

    // Keep right sidebar open when opening/switching links inside the control panel
    if (mode === "admin" || mode === "super-admin" || mode === "teacher" || mode === "morning-delay") {
      setIsSidebarOpen(true);
    }
  };

  // Only show blocking loader if truly verifying auth for an unauthenticated user on admin routes
  const isPortalMode = isDirectTeacherLink || isDirectMorningDelayLink || appMode === "teacher" || appMode === "morning-delay" || appMode === "stats-only";
  const shouldShowLoader = !isPortalMode && !currentUser && authChecking;

  if (shouldShowLoader) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100" dir="rtl">
        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-8 space-y-5 shadow-2xl relative overflow-hidden animate-fadeIn backdrop-blur-md">
          {/* Decorative ambient glowing backdrops */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full -mr-12 -mt-12 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-indigo-500/10 rounded-full -ml-12 -mb-12 blur-2xl"></div>
          
          <div className="relative flex flex-col items-center">
            <div className="mx-auto bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-4 rounded-2xl text-white font-extrabold text-3xl shadow-lg shadow-indigo-950/50 w-fit mb-3 animate-bounce">
              🏫
            </div>
            
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
            
            {/* Welcome Badge */}
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold mb-3 shadow-inner">
              <span>✨</span>
              <span>مرحباً وأهلاً وسهلاً بك</span>
            </div>

            {/* School Name Title */}
            <h3 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-200 to-purple-300">
              {schoolName ? `بوابة ${schoolName}` : "البوابة الرقمية للرصد والمتابعة"}
            </h3>

            {/* School Name subtitle highlight if schoolName exists */}
            {schoolName && (
              <p className="text-xs font-bold text-indigo-400 mt-1">
                منصة {schoolName} لرصد ومتابعة الغياب والسلوك
              </p>
            )}
            
            <div className="mt-4 p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl w-full text-slate-300">
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                {schoolName 
                  ? `أهلاً بك مجدداً! جاري تهيئة بوابة ${schoolName}...`
                  : "جاري التحقق من حالة تسجيل الدخول وتحميل البيانات..."
                }
              </p>
            </div>

            {/* Emergency Bypass Controls: Guaranteed instant exit if network or auth takes longer */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 w-full flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthChecking(false);
                  setLoading(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                تخطي الانتظار والدخول المباشر
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthChecking(false);
                  setLoading(false);
                  setCurrentUser(null);
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
              >
                تسجيل الدخول بحساب Google
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standalone login screen removed: The application directly opens the main view with full menus, sidebars, and Google sign-in options

  // Sidebar Menu Items Definition
  const menuGroups = [
    {
      title: "تسجيل الغياب للمعلمين",
      icon: <ClipboardCheck className="w-4 h-4 text-blue-400" />,
      items: [
        {
          id: "attendance",
          label: "رصد الحضور والغياب",
          icon: <Calendar className="w-4 h-4" />,
          mode: "teacher" as const,
          tab: "attendance" as const
        }
      ]
    },
    {
      title: "",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      items: [
        {
          id: "stats",
          label: "بوابة متابعة الغياب والنسب",
          icon: <BarChart3 className="w-4 h-4" />,
          mode: "admin" as const,
          tab: "stats" as const
        }
      ]
    },
    {
      title: "",
      icon: <Users className="w-4 h-4 text-indigo-500" />,
      isGroupFrame: true,
      items: [
        {
          id: "students",
          label: "إضافة الطلاب والفصول",
          icon: <Users className="w-4 h-4" />,
          mode: "admin" as const,
          tab: "students" as const
        },
        {
          id: "teachers",
          label: "إضافة المعلمين",
          icon: <Briefcase className="w-4 h-4" />,
          mode: "admin" as const,
          tab: "teachers" as const
        },
        ...(currentUser?.email?.toLowerCase() === "majedsoft@gmail.com" ? [
          {
            id: "super-admin",
            label: "إدارة المشتركين والمسجلين 👑",
            icon: <Users className="w-4 h-4" />,
            mode: "super-admin" as const,
            tab: "users" as const
          }
        ] : [])
      ]
    }
  ];

  const handleMenuItemClick = (mode: "teacher" | "admin" | "super-admin", tab: any) => {
    setAppMode(mode);
    if (mode === "teacher") {
      setTeacherTab(tab);
    } else if (mode === "admin") {
      setAdminTab(tab);
    }
    setIsMobileMenuOpen(false); // Close mobile drawer if open
  };

  // Helper to check if a menu item is currently active
  const isItemActive = (mode: "teacher" | "admin" | "super-admin", tab: any) => {
    if (appMode !== mode) return false;
    if (mode === "super-admin") return true;
    return mode === "teacher" ? teacherTab === tab : adminTab === tab;
  };

  // Reusable Sidebar Content JSX
  const renderSidebarContent = (keyPrefix = "desktop") => {
    // Dynamic Onboarding Step Calculation for Sidebar Highlighting
    const hasGradesAndClasses = grades.length > 0 && classes.length > 0;
    const hasTeachers = teachers.length > 0;

    return (
      <div className="flex flex-col h-full justify-between p-5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
      <div className="space-y-6">
        {/* School Logo & Dynamic Name Card in Sidebar */}
        <div className="border-b border-slate-200/80 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <div id="sidebar-school-logo" className="bg-gradient-to-tr from-blue-600 to-indigo-700 p-2.5 rounded-xl text-white font-extrabold text-lg shadow-md shadow-blue-500/20 flex-shrink-0">
              🏫
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-black text-slate-800 tracking-wide">SmartSchool</h1>
              <span className="text-[10px] text-blue-600 font-bold block">بوابة الإدارة الرقمية</span>
            </div>
          </div>

          {/* School Name Badge / Inline Edit Card */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-2.5 space-y-1.5 shadow-3xs">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <span>🏫</span>
                <span>اسم المدرسة:</span>
              </span>
              {!isEditingSidebarSchool && !isSavingSchoolName && (
                <button
                  type="button"
                  id="btn-edit-school"
                  onClick={() => {
                    if (!currentUser || currentUser.isGuest) {
                      handleGoogleLogin();
                      return;
                    }
                    setSidebarSchoolInput(schoolName || "");
                    setIsEditingSidebarSchool(true);
                  }}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline cursor-pointer bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-3xs"
                  title="تعديل اسم المدرسة"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>تعديل</span>
                </button>
              )}
            </div>

            {isEditingSidebarSchool ? (
              <div className="space-y-2 mt-1">
                <input
                  type="text"
                  value={sidebarSchoolInput}
                  onChange={(e) => setSidebarSchoolInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      const trimmed = sidebarSchoolInput.trim();
                      if (trimmed) {
                        await handleSchoolNameChange(trimmed);
                      }
                      setIsEditingSidebarSchool(false);
                    } else if (e.key === "Escape") {
                      setIsEditingSidebarSchool(false);
                    }
                  }}
                  className="w-full text-xs font-bold px-2.5 py-1.5 bg-white border border-blue-400 focus:border-indigo-600 focus:ring-2 focus:ring-blue-100 rounded-lg text-right text-slate-800 outline-none placeholder:text-slate-300"
                  placeholder="أدخل اسم المدرسة..."
                  autoFocus
                />
                <div className="flex items-center gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      const trimmed = sidebarSchoolInput.trim();
                      if (trimmed) {
                        await handleSchoolNameChange(trimmed);
                      }
                      setIsEditingSidebarSchool(false);
                    }}
                    className="flex-1 py-1 px-2 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-3xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>حفظ الاسم</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingSidebarSchool(false)}
                    className="py-1 px-2 text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-md transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>إلغاء</span>
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => {
                  if (!currentUser || currentUser.isGuest) {
                    handleGoogleLogin();
                    return;
                  }
                  setSidebarSchoolInput(schoolName || "");
                  setIsEditingSidebarSchool(true);
                }}
                className="group flex items-center justify-between gap-2 p-1.5 bg-white rounded-lg border border-slate-200 hover:border-blue-300 cursor-pointer transition"
                title="اضغط للتعديل"
              >
                <span className={`text-xs font-extrabold truncate ${schoolName ? "text-slate-800" : "text-slate-400 italic"}`}>
                  {(!currentUser || currentUser?.isGuest) ? "سجّل الدخول لعرض المدرسة" : (schoolName || "انقر هنا لكتابة اسم مدرستك...")}
                </span>
                {isSavingSchoolName ? (
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
                ) : (
                  <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-blue-600 flex-shrink-0 transition" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Groups & Items */}
        <div className="space-y-5">
          {menuGroups
            .filter((group) => {
              if (isDirectTeacherLink) {
                return group.items.some(item => item.mode === "teacher");
              } else {
                return group.items.some(item => item.mode === "admin" || item.mode === "super-admin");
              }
            })
            .map((group, gIdx) => (
              <div 
                key={`${keyPrefix}-g-${gIdx}`} 
                className={group.isGroupFrame ? "bg-slate-50/90 border border-slate-200/90 rounded-xl p-2.5 space-y-2 shadow-3xs" : "space-y-2"}
              >
                {Boolean(group.title) && (
                  <div className="flex items-center gap-1.5 text-3xs font-extrabold text-slate-500 uppercase tracking-widest px-1">
                    {group.icon}
                    <span>{group.title}</span>
                  </div>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isItemActive(item.mode, item.tab);
                    const isStats = item.id === "stats";
                    return (
                      <React.Fragment key={`${keyPrefix}-i-${item.id}`}>
                        <div 
                          className={isStats ? "bg-blue-50/50 rounded-xl p-2 border-2 border-blue-500/40 shadow-3xs space-y-2 relative overflow-hidden" : "space-y-1"}
                        >
                          {isStats && (
                            <div className="absolute top-0 right-0 h-full w-1 bg-blue-500/80"></div>
                          )}
                          <button
                            onClick={() => handleMenuItemClick(item.mode, item.tab)}
                            id={`sidebar-${item.id}`}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-black transition-all duration-200 transform hover:translate-x-[-3px] cursor-pointer ${
                              active
                                ? "bg-[#5046e5] text-white shadow-md shadow-indigo-500/20"
                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={active ? "text-white" : "text-slate-500"}>{item.icon}</span>
                              <span className={isStats ? "text-[11px]" : ""}>{item.label}</span>
                              {item.id === "students" && !hasGradesAndClasses && (
                                <span className="bg-amber-400 text-slate-900 text-[8px] px-1.5 py-0.5 rounded-md font-black animate-bounce">
                                  البدء هنا 👈
                                </span>
                              )}
                              {item.id === "teachers" && hasGradesAndClasses && !hasTeachers && (
                                <span className="bg-amber-400 text-slate-900 text-[8px] px-1.5 py-0.5 rounded-md font-black animate-bounce">
                                  اضغط هنا 👈
                                </span>
                              )}
                            </div>
                            
                            {active && (
                              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            )}
                          </button>
                          
                          {isStats && (
                            <div className="px-1">
                              <button
                                type="button"
                                id="btn-copy-stats-link"
                                onClick={() => {
                                  handleCopyStatsLink();
                                }}
                                className="w-full flex items-center justify-between gap-1 text-[10px] text-blue-700 hover:text-blue-800 font-extrabold bg-white hover:bg-blue-50 border border-blue-200/80 rounded-md px-2.5 py-1.5 transition-all duration-200 transform hover:translate-x-[-3px] cursor-pointer shadow-3xs"
                                title="نسخ رابط صفحة متابعة الغياب والسلوك لمشاركتها مباشرة"
                              >
                                <div className="flex items-center gap-1.5">
                                  <Copy className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                                  <span>نسخ الرابط للمسؤول</span>
                                </div>
                                {copied ? (
                                  <span className="text-emerald-600 flex items-center gap-0.5 text-[9px] font-black">
                                    <Check className="w-3 h-3 animate-bounce" /> تم النسخ
                                  </span>
                                ) : (
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {isStats && (
                          <>
                            <div 
                              id="sidebar-teacher-portal-container"
                              className="bg-purple-50/50 rounded-xl p-2 border-2 border-purple-500/40 shadow-3xs space-y-2 relative overflow-hidden mt-2"
                            >
                              <div className="absolute top-0 right-0 h-full w-1 bg-purple-500/80"></div>
                              <button
                                onClick={() => {
                                  navigateTo("teacher");
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-black transition-all duration-200 transform hover:translate-x-[-3px] cursor-pointer ${
                                  appMode === "teacher"
                                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                                    : "text-slate-700 hover:bg-purple-100/60 hover:text-purple-900"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={appMode === "teacher" ? "text-white" : "text-purple-600"}><ClipboardCheck className="w-4 h-4" /></span>
                                  <span>بوابة تسجيل الغياب والسلوك</span>
                                </div>
                                {appMode === "teacher" && (
                                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                )}
                              </button>
                              
                              <div className="px-1">
                                <button
                                  type="button"
                                  id="btn-copy-teacher-link"
                                  onClick={() => {
                                    handleCopyTeacherLink();
                                  }}
                                  className="w-full flex items-center justify-between gap-1 text-[10px] text-purple-700 hover:text-purple-800 font-extrabold bg-white hover:bg-purple-50 border border-purple-200/80 rounded-md px-2.5 py-1.5 transition-all duration-200 transform hover:translate-x-[-3px] cursor-pointer shadow-3xs"
                                  title="نسخ رابط تسجيل الغياب للمعلمين لمشاركته مباشرة"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <Copy className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                                    <span>نسخ الرابط للمعلمين</span>
                                  </div>
                                  {teacherCopied ? (
                                    <span className="text-emerald-600 flex items-center gap-0.5 text-[9px] font-black">
                                      <Check className="w-3 h-3 animate-bounce" /> تم النسخ
                                    </span>
                                  ) : (
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Morning Delay Registration Portal Card (بوابة تسجيل التأخر الصباحي - معطلة حالياً قريباً) */}
                            <div 
                              id="sidebar-morning-delay-portal-container"
                              className="bg-amber-50/40 rounded-xl p-2 border-2 border-amber-300/50 shadow-3xs space-y-2 relative overflow-hidden mt-2 opacity-85"
                            >
                              <div className="absolute top-0 right-0 h-full w-1 bg-amber-400"></div>
                              <button
                                type="button"
                                disabled={true}
                                title="قسم تسجيل التأخر الصباحي معطل حالياً - قريباً"
                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-black text-slate-500 bg-amber-100/40 cursor-not-allowed select-none"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-amber-600/70"><Clock className="w-4 h-4" /></span>
                                  <span>بوابة تسجيل التأخر الصباحي</span>
                                </div>
                                <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-200 text-amber-900 rounded-md border border-amber-300/80 shadow-3xs">
                                  قريباً
                                </span>
                              </button>
                              
                              <div className="px-1">
                                <button
                                  type="button"
                                  id="btn-copy-morning-delay-link"
                                  disabled={true}
                                  title="رابط تسجيل التأخر الصباحي معطل حالياً - قريباً"
                                  className="w-full flex items-center justify-between gap-1 text-[10px] text-slate-500 font-extrabold bg-white/80 border border-amber-200/60 rounded-md px-2.5 py-1.5 cursor-not-allowed select-none opacity-80"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-amber-500/70" />
                                    <span>رابط مشرف التأخر</span>
                                  </div>
                                  <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-100 text-amber-800 rounded border border-amber-200/80">
                                    قريباً
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* Line divider with vertical margin to separate Student/Class/Teacher admin from Stats/Registration */}
                            <div className="my-5 border-t border-slate-200/80"></div>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Sidebar Footer Info */}
      <div className="border-t border-slate-200/80 pt-4 mt-auto space-y-3 px-1">
        {/* Cloud Sync & Account Status Container */}
        <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3 space-y-3 shadow-3xs">
          {/* User Profile Info / Status */}
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full border ${(!currentUser || currentUser?.isGuest) ? 'border-amber-500 bg-amber-500 text-amber-950' : 'border-indigo-500 bg-indigo-600 text-white'} flex items-center justify-center font-extrabold text-sm flex-shrink-0 shadow-3xs`}>
              {(!currentUser || currentUser?.isGuest) ? <CloudOff className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
            </div>

            {/* Text details */}
            <div className="flex-1 min-w-0 text-right pr-0.5">
              <p className="text-xs font-black text-slate-800 tracking-tight truncate">
                {(!currentUser || currentUser?.isGuest) ? "غير مسجل" : (currentUser?.displayName || "مدير المدرسة")}
              </p>
              <p className="text-[10px] text-slate-500 font-bold truncate mt-0.5" dir="ltr">
                {(!currentUser || currentUser?.isGuest) ? "التسجيل شرط لعرض البيانات" : (currentUser?.email || "")}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-1.5 pt-1">
            {(!currentUser || currentUser?.isGuest) ? (
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl font-extrabold text-[11px] transition-all duration-200 cursor-pointer shadow-3xs"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.258-3.133C18.29 1.41 15.538 0 12.24 0c-6.63 0-12 5.37-12 12s5.37 12 12 12c6.93 0 11.52-4.875 11.52-11.72 0-.788-.08-1.39-.18-1.995H12.24z"
                  />
                </svg>
                <span>تسجيل الدخول بـ Google</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  clearUserSessionState();
                  localStorage.removeItem("guest_user_session");
                  localStorage.removeItem("last_admin_tab");
                  localStorage.removeItem("admin_direct_access");
                  try {
                    await signOut(auth);
                  } catch (err) {
                    console.error("Logout Error:", err);
                  }
                  setCurrentUser(null);
                  setActiveUser(null);
                  setGrades([]);
                  setClasses([]);
                  setTeachers([]);
                  setStudents([]);
                  setSchoolName("");
                  setTodayCounts({ absentCount: 0, delayCount: 0, behaviorCount: 0 });
                  setAppMode("admin");
                  setAdminTab("stats");
                  window.history.replaceState({ mode: "admin" }, "", "/?page=admin&tab=stats#/index");
                }}
                className="w-full flex items-center justify-start gap-2.5 px-3 py-2 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 text-rose-600 hover:text-rose-700 rounded-xl transition-all duration-200 cursor-pointer"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span className="font-extrabold text-[11px]">تسجيل الخروج</span>
              </button>
            )}
          </div>
        </div>


        
        {/* Footer info: SmartSchool & Copyright */}
        <div className="text-center space-y-1 pt-1.5 border-t border-slate-100">
          <p className="text-[11px] font-black text-indigo-900 tracking-wide">
            منصة <span className="font-extrabold text-blue-600">SmartSchool</span>
          </p>
          <p className="text-[9px] text-slate-500 font-bold">
            {schoolName ? `بوابة ${schoolName} الرقمية` : "البوابة الرقمية للرصد والمتابعة"}
          </p>
          <p className="text-[8px] text-slate-400 font-semibold">
            جميع الحقوق محفوظة © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
  };

  const onTriggerRefresh = async () => {
    setIsRefreshingData(true);
    try {
      await handleRefreshData();
    } finally {
      setTimeout(() => setIsRefreshingData(false), 600);
    }
  };

  const hasGradesAndClasses = grades.length > 0 && classes.length > 0;
  const hasTeachers = teachers.length > 0;

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full max-w-full overflow-x-clip bg-gradient-to-br from-slate-100 via-blue-50/10 to-slate-200/40 font-sans text-slate-800" dir="rtl">
      
      {/* 1. PERMANENT FIXED RIGHT SIDEBAR FOR DESKTOP & TABLETS (≥768px) */}
      {showSidebar && (
        <aside className="hidden md:block fixed right-0 top-0 bottom-0 w-72 bg-white text-slate-800 border-l border-slate-200/90 z-40 shadow-xl overflow-hidden">
          {renderSidebarContent("desktop")}
        </aside>
      )}

      {/* 2. MAIN APP SECTION */}
      <div className={`flex-1 min-h-screen flex flex-col w-full max-w-full min-w-0 bg-gradient-to-b from-blue-50/40 via-slate-50 to-slate-100/60 ${showSidebar ? "md:mr-72" : ""}`}>
        
        {/* Measured Header Container */}
        {showHeader && (
          <div ref={headerRef as any} id="app-sticky-header-wrapper" className="sticky top-0 z-30 w-full">
            {/* Top Header for Mobile (< 768px) */}
            {showMobileHeader && (
              <MobileTopHeader
                schoolName={schoolName}
                userDisplayName={currentUser?.displayName}
                userEmail={currentUser?.email}
                isGoogleAuthenticated={!!currentUser && !currentUser.isGuest}
                onCopyTeacherLink={handleCopyTeacherLink}
                teacherCopied={teacherCopied}
                showTeacherLink={appMode === "teacher"}
                onOpenShareModal={() => setIsShareModalOpen(true)}
                onRefreshData={onTriggerRefresh}
                isRefreshing={isRefreshingData}
                onTogglePreviewOrMenu={() => setIsMobileDrawerOpen(true)}
                onGoogleLogin={handleGoogleLogin}
              />
            )}

            {/* Top Header for Desktop (≥ 768px) */}
            <DesktopHeader
              schoolName={schoolName}
              onEditSchoolName={() => {
                setSchoolModalInput(schoolName || "");
                setIsSchoolModalOpen(true);
              }}
              isSavingSchoolName={isSavingSchoolName}
              onRefreshData={onTriggerRefresh}
              isRefreshing={isRefreshingData}
              onOpenShareModal={() => setIsShareModalOpen(true)}
              todayAbsentCount={todayCounts.absentCount}
              todayDelayCount={todayCounts.delayCount}
              todayBehaviorCount={todayCounts.behaviorCount}
              currentTime={currentTime}
              currentUser={currentUser}
              onGoogleLogin={handleGoogleLogin}
              isStatsOnly={appMode === "stats-only"}
              onSyncCloudData={handleSyncCloudData}
              isSyncingCloud={isSyncingCloud}
              syncCloudSuccess={syncCloudSuccess}
              onDownloadBackup={downloadSchoolBackupFile}
              onUploadBackup={handleUploadBackup}
            />
          </div>
        )}

        {/* Dynamic Inner Portal Content */}
        <main className="flex-1 w-full max-w-full min-w-0 px-2.5 sm:px-4 md:px-6 py-3 sm:py-4 pb-28 md:pb-8 space-y-3 sm:space-y-4">
          {(!currentUser || currentUser?.isGuest) && !isDirectKiosk ? (
            <div className="w-full max-w-lg mx-auto my-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl text-center space-y-5 animate-in fade-in">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-3xl shadow-inner">
                🏫
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  لوحة التحكم لتسجيل الغياب والتاخر الصباحي
                </h2>
                <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed max-w-sm mx-auto">
                  سجل الدخول بحساب Google للمتابعة والإدارة والمزامنة السحابية:
                </p>
              </div>

              {loginError && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-right text-xs text-amber-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <span>⚠️</span>
                    <span>تنبيه:</span>
                  </div>
                  <p className="leading-relaxed">
                    {loginError}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-1">
                {/* Google Sign In */}
                <button
                  type="button"
                  id="btn-main-google-login"
                  onClick={handleGoogleLogin}
                  className="w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 text-slate-800 rounded-2xl font-black text-xs sm:text-sm shadow-sm transition-all transform hover:scale-[1.01] cursor-pointer"
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
          ) : (
            <div id="active-portal-view" className="w-full max-w-full min-w-0">
            {appMode === "super-admin" ? (
              <SuperAdminPanel
                currentUser={currentUser}
                onRefreshData={handleRefreshData}
                globalProgress={globalProgress}
                setGlobalProgress={setGlobalProgress}
              />
            ) : appMode === "morning-delay" ? (
              <MorningDelayPortal
                grades={grades}
                classes={classes}
                students={students}
                teachers={teachers}
                onRefreshData={handleRefreshData}
                navigateTo={navigateTo}
                schoolName={schoolName}
                isDirectLink={isDirectMorningDelayLink || appMode === "morning-delay"}
                globalProgress={globalProgress}
                setGlobalProgress={setGlobalProgress}
                isGoogleAuthenticated={!!currentUser && !currentUser.isGuest}
                onRequireGoogleLogin={handleGoogleLogin}
              />
            ) : appMode === "teacher" ? (
              <TeacherPortal 
                grades={grades} 
                classes={classes} 
                teachers={teachers} 
                students={students}
                onRefreshStats={handleRefreshData}
                activeTab={teacherTab}
                setActiveTab={setTeacherTab}
                navigateTo={navigateTo}
                schoolName={schoolName}
                isDirectTeacherLink={true}
                globalProgress={globalProgress}
                setGlobalProgress={setGlobalProgress}
                isGoogleAuthenticated={!!currentUser && !currentUser.isGuest}
                onRequireGoogleLogin={handleGoogleLogin}
              />
            ) : (
            <AdminPanel 
              grades={grades} 
              classes={classes} 
              teachers={teachers} 
              students={students} 
              setGrades={setGrades}
              setClasses={setClasses}
              setTeachers={setTeachers}
              setStudents={setStudents}
              onRefreshData={handleRefreshData}
              activeSubTab={appMode === "stats-only" ? "stats" : adminTab}
              setActiveSubTab={setAdminTab}
              isReadOnly={false}
              onTodayStatsChange={handleTodayStatsChange}
              schoolName={schoolName}
              onSchoolNameChange={handleSchoolNameChange}
              isSavingSchoolName={isSavingSchoolName}
              globalProgress={globalProgress}
              setGlobalProgress={setGlobalProgress}
              isGoogleAuthenticated={!!currentUser && !currentUser.isGuest}
              onRequireGoogleLogin={handleGoogleLogin}
            />
          )}
          </div>
        )}
        </main>

        {/* Styled Footer */}
        <footer className="bg-white border-t border-slate-200/80 py-4 px-6 text-center text-slate-500 text-xs mt-auto flex flex-col items-center justify-center gap-1 hidden md:flex">
          <p className="font-black text-slate-800 text-sm flex items-center justify-center gap-1.5">
            <span>🏫</span>
            <span>منصة <strong className="text-blue-600 font-black">SmartSchool</strong> الرقمية</span>
          </p>
          <p className="font-semibold text-slate-500 text-xs">
            {schoolName ? `بوابة ${schoolName}` : "البوابة الرقمية للمدرسة"}
          </p>
          <p className="font-medium text-slate-400 text-[11px] pt-0.5">
            جميع الحقوق محفوظة © {new Date().getFullYear()}
          </p>
        </footer>
      </div>

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      {showMobileBottomNav && (
        <MobileBottomNav
          appMode={appMode}
          adminTab={adminTab}
          teacherTab={teacherTab}
          onNavigate={(mode, tab) => {
            setAppMode(mode);
            if (mode === "teacher") {
              setTeacherTab(tab || "attendance");
            } else if (mode === "admin") {
              setAdminTab(tab || "stats");
            }
          }}
          onOpenMenu={() => setIsMobileDrawerOpen(true)}
          todayAbsentCount={todayCounts.absentCount}
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        appMode={appMode}
        adminTab={adminTab}
        teacherTab={teacherTab}
        onNavigate={(mode, tab) => {
          handleMenuItemClick(mode as any, tab);
        }}
        schoolName={schoolName}
        onSchoolNameChange={handleSchoolNameChange}
        isSavingSchoolName={isSavingSchoolName}
        currentUser={currentUser}
        onGoogleLogin={handleGoogleLogin}
        onLogout={async () => {
          clearUserSessionState();
          localStorage.removeItem("guest_user_session");
          localStorage.removeItem("last_admin_tab");
          localStorage.removeItem("admin_direct_access");
          try {
            await signOut(auth);
          } catch (err) {
            console.error("Logout Error:", err);
          }
          setCurrentUser(null);
          setActiveUser(null);
          setGrades([]);
          setClasses([]);
          setTeachers([]);
          setStudents([]);
          setSchoolName("");
          setTodayCounts({ absentCount: 0, delayCount: 0, behaviorCount: 0 });
          setAppMode("admin");
          setAdminTab("stats");
          window.history.replaceState({ mode: "admin" }, "", "/admin?page=admin&tab=stats#/admin");
        }}
        onCopyTeacherLink={handleCopyTeacherLink}
        teacherCopied={teacherCopied}
        onCopyDelayLink={handleCopyMorningDelayLink}
        delayCopied={morningDelayCopied}
        onCopyStatsLink={handleCopyStatsLink}
        statsCopied={copied}
        onCopyAdminSyncLink={handleCopyAdminSyncLink}
        adminSyncCopied={adminSyncCopied}
        onSyncCloudData={handleSyncCloudData}
        isSyncingCloud={isSyncingCloud}
        syncCloudSuccess={syncCloudSuccess}
        hasGradesAndClasses={hasGradesAndClasses}
        hasTeachers={hasTeachers}
      />

      {/* Quick Share Links & Cloud Sync Modal */}
      <ShareLinksModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        schoolName={schoolName}
        schoolCode={getSchoolCode()}
        onCopyTeacherLink={handleCopyTeacherLink}
        teacherCopied={teacherCopied}
        onCopyDelayLink={handleCopyMorningDelayLink}
        delayCopied={morningDelayCopied}
        onCopyStatsLink={handleCopyStatsLink}
        statsCopied={copied}
        onCopyAdminSyncLink={handleCopyAdminSyncLink}
        adminSyncCopied={adminSyncCopied}
        onSyncCloudData={handleSyncCloudData}
        isSyncingCloud={isSyncingCloud}
        syncCloudSuccess={syncCloudSuccess}
        isGoogleAuthenticated={!!currentUser && !currentUser.isGuest}
        onGoogleLogin={handleGoogleLogin}
        onDownloadBackup={downloadSchoolBackupFile}
        onUploadBackup={handleUploadBackup}
        onOpenCloudDiagnostics={() => setIsFirebaseDiagModalOpen(true)}
      />

      {/* Cloud Diagnostics & Database Properties Modal */}
      <FirebaseDiagnosticModal
        isOpen={isFirebaseDiagModalOpen}
        onClose={() => setIsFirebaseDiagModalOpen(false)}
        onTriggerSync={handleSyncCloudData}
      />

      {/* School Name Edit Modal */}
      {isSchoolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-right space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>🏫</span>
                <span>تعديل اسم المدرسة</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSchoolModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">اسم المدرسة الرسمي:</label>
              <input
                type="text"
                value={schoolModalInput}
                onChange={(e) => setSchoolModalInput(e.target.value)}
                placeholder="مثال: مدرسة الأندلس الابتدائية"
                className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const trimmed = schoolModalInput.trim();
                  if (trimmed) {
                    await handleSchoolNameChange(trimmed);
                  }
                  setIsSchoolModalOpen(false);
                }}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-3xs flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>حفظ الاسم</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSchoolModalOpen(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Elegant Floating Save Progress Indicator */}
      {isSavingSchoolName && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 border border-slate-800/80 text-slate-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce text-xs font-bold" dir="rtl">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          <span className="tracking-wide">جاري مزامنة وحفظ الاسم الجديد سحابياً...</span>
        </div>
      )}

      {/* Global Elegant Circular Progress Overlay */}
      {globalProgress.active && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-8 max-w-xs w-full text-center space-y-6 shadow-2xl relative overflow-hidden">
            {/* Glowing visual backdrop */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${
              globalProgress.type === 'delete' ? 'bg-rose-500/10' : globalProgress.type === 'save' ? 'bg-amber-500/10' : 'bg-blue-500/10'
            } rounded-full -mr-12 -mt-12 blur-xl opacity-60`}></div>
            
            <div className="flex flex-col items-center space-y-4">
              {/* Circular Progress Design */}
              <div className="relative flex items-center justify-center">
                {/* Pulsing ring */}
                <div className={`absolute inset-0 rounded-full animate-ping opacity-10 filter blur-xs ${
                  globalProgress.type === 'delete' ? 'bg-rose-500' : globalProgress.type === 'save' ? 'bg-amber-500' : 'bg-blue-500'
                }`} style={{ margin: '-4px' }}></div>
                
                <svg className="animate-spin h-14 w-14" viewBox="0 0 48 48">
                  {/* Background Track */}
                  <circle className="opacity-10 stroke-slate-400" cx="24" cy="24" r="20" fill="none" strokeWidth="4" />
                  {/* Spinning colored path */}
                  <path 
                    className={`opacity-95 ${
                      globalProgress.type === 'delete' ? 'text-rose-600' : globalProgress.type === 'save' ? 'text-amber-500' : 'text-blue-600'
                    }`}
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                    d="M 24,4 A 20,20 0 0,1 44,24" 
                  />
                </svg>
                
                <span className="absolute text-sm">
                  {globalProgress.type === 'delete' ? '🗑️' : globalProgress.type === 'save' ? '💾' : '🔄'}
                </span>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xs font-black text-slate-800 leading-relaxed">
                  {globalProgress.label || "جاري معالجة طلبك..."}
                </h4>
                <p className="text-[10px] font-bold text-slate-400">
                  يرجى الانتظار حتى اكتمال العملية بنجاح.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authorized Domain Help Modal */}
      {loginError === "auth/unauthorized-domain" && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full text-right space-y-5 shadow-2xl relative">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-3xs flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">تفعيل النطاق في Firebase</h3>
                <p className="text-[11px] text-slate-500 font-bold">مطلوب خطوة واحدة فقط في لوحة تحكم Firebase</p>
              </div>
            </div>

            <div className="text-xs text-slate-700 font-medium space-y-3 leading-relaxed">
              <p>
                لتسجيل الدخول بـ Google على نطاق كلاود فلير الخاص بك، يرجى إضافة هذا النطاق إلى النطاقات المصرح بها في Firebase:
              </p>

              <div className="bg-slate-100 border border-slate-300 rounded-xl p-2.5 flex items-center justify-between">
                <code className="text-indigo-700 font-mono font-bold text-xs" dir="ltr">
                  {typeof window !== "undefined" ? window.location.hostname : "school-attendance.vercel.app"}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    const host = typeof window !== "undefined" ? window.location.hostname : "";
                    copyTextToClipboard(host);
                    setDomainCopied(true);
                    setTimeout(() => setDomainCopied(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 shadow-3xs flex items-center gap-1 cursor-pointer"
                >
                  {domainCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{domainCopied ? "تم النسخ" : "نسخ النطاق"}</span>
                </button>
              </div>

              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pr-1">
                <li>افتح <strong>Firebase Console</strong> ثم اختر مشروعك.</li>
                <li>انتقل إلى <strong>Authentication</strong> ثم تبويب <strong>Settings</strong>.</li>
                <li>انزل إلى <strong>Authorized domains</strong> واضغط <strong>Add domain</strong> وألصق النطاق.</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLoginError(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Firestore Setup Guide Modal */}
      {firestoreNeedsCreation && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-lg w-full text-right space-y-5 shadow-2xl relative">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-3xs flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">تفعيل قاعدة بيانات Cloud Firestore</h3>
                <p className="text-[11px] text-slate-500 font-bold">مطلوب ضغطة واحدة لإنشاء قاعدة البيانات في مشروع Firebase</p>
              </div>
            </div>

            <div className="text-xs text-slate-700 font-medium space-y-3 leading-relaxed">
              <p className="font-bold text-slate-800">
                مشروع Firebase تم ربطه بنجاح (<span className="text-indigo-600 font-mono font-black" dir="ltr">apsent-02</span>)، ولكن قاعدة بيانات Cloud Firestore لم يتم إنشاؤها بعد داخل حسابك في Firebase.
              </p>

              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                <h4 className="font-black text-amber-900 text-xs flex items-center gap-1.5">
                  <span>🛠️ خطوات التفعيل السريع (أقل من دقيقة):</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-amber-950 font-bold pr-1">
                  <li>افتح رابط Firestore في كونسول Google Firebase:</li>
                  <div className="pt-1 pb-1">
                    <a
                      href="https://console.firebase.google.com/project/apsent-02/firestore"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>فتح Firebase Console لمشروع apsent-02</span>
                    </a>
                  </div>
                  <li>اضغط على زر <strong>"Create Database"</strong> (إنشاء قاعدة بيانات).</li>
                  <li>اختر الموقع الجغرافي الافتراضي (مثل <strong>eur3</strong> أو <strong>nam5</strong>).</li>
                  <li>اختر <strong>Start in production mode</strong> ثم اضغط <strong>Create / Enable</strong>.</li>
                </ol>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-1.5 text-emerald-950">
                <div className="flex items-center gap-1.5 font-black text-xs text-emerald-900">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>حل فوري بديل لنقل البيانات الآن (بدون انتظار):</span>
                </div>
                <p className="text-[11px] font-bold text-emerald-900 leading-normal">
                  يمكنك استخدام زر <strong>«💾 تصدير نسخة (JSON)»</strong> لتحميل بياناتك كاملة فوراً، ثم فتح <strong>apsents.vercel.app</strong> والضغط على <strong>«📥 استيراد نسخة»</strong> لتظهر جميع الفصول والصفوف والطلاب والغياب فوراً!
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={downloadSchoolBackupFile}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-3xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تنزيل ملف النسخة الاحتياطية (JSON)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFirestoreNeedsCreation(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup / Restore Feedback Modal */}
      {backupFeedbackModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full text-right space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold shadow-3xs ${
                backupFeedbackModal.type === "success"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : backupFeedbackModal.type === "warning"
                  ? "bg-amber-50 text-amber-600 border border-amber-200"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}>
                {backupFeedbackModal.type === "success" ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <h3 className="text-sm font-black text-slate-900">{backupFeedbackModal.title}</h3>
            </div>

            <p className="text-xs text-slate-700 font-bold whitespace-pre-line leading-relaxed">
              {backupFeedbackModal.message}
            </p>

            <button
              type="button"
              onClick={() => setBackupFeedbackModal(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              حسناً
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
