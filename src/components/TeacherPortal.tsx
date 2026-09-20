import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Grade, Class, Teacher, Student, AttendanceRecord, BehaviorRecord } from "../types";
import { 
  getStudentsByClass, 
  getAttendanceRecord, 
  saveAttendanceRecord, 
  getBehaviorRecords, 
  saveBehaviorRecord,
  getAllBehaviorRecords,
  subscribeToAttendanceRecord,
  subscribeToBehaviorRecords
} from "../dbService";
import { 
  Users, 
  UserX, 
  CheckCircle, 
  XCircle, 
  ClipboardCheck, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  User, 
  Plus, 
  Save, 
  ChevronRight, 
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  X
} from "lucide-react";

interface TeacherPortalProps {
  grades: Grade[];
  classes: Class[];
  teachers: Teacher[];
  students?: Student[];
  onRefreshStats?: () => void;
  activeTab?: "attendance" | "behavior";
  setActiveTab?: (tab: "attendance" | "behavior") => void;
  navigateTo?: (mode: "teacher" | "admin") => void;
  schoolName?: string;
  isDirectTeacherLink?: boolean;
  globalProgress?: { active: boolean; type: "save" | "load" | "delete" | "import" | null; label: string };
  setGlobalProgress?: React.Dispatch<React.SetStateAction<{ active: boolean; type: "save" | "load" | "delete" | "import" | null; label: string }>>;
  isGoogleAuthenticated?: boolean;
  onRequireGoogleLogin?: () => void;
}

const PERIODS = [
  "حصة 1",
  "حصة 2",
  "حصة 3",
  "حصة 4",
  "حصة 5",
  "حصة 6",
  "حصة 7"
];

const VIOLATIONS = [
  "النوم أثناء الحصة",
  "التأخر عن الحصة",
  "عدم إحضار الكتاب",
  "عدم حل الواجب الدراسي",
  "استخدام الهاتف الجوال",
  "الكلام والتشويش أثناء الشرح",
  "عدم الانتباه والتركيز مع المعلم"
];

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function TeacherPortal({ grades, classes, teachers, students: propStudents, onRefreshStats, activeTab: propActiveTab, setActiveTab: propSetActiveTab, navigateTo, schoolName, isDirectTeacherLink, globalProgress, setGlobalProgress, isGoogleAuthenticated, onRequireGoogleLogin }: TeacherPortalProps) {
  // Filter Selection States
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("حصة 1");
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // Refs and dynamic offsets for sticky elements to ensure precise and solid pinning
  const firstStickyRef = React.useRef<HTMLDivElement>(null);

  // Filtered lists
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Tab State
  const [localActiveTab, setLocalActiveTab] = useState<"attendance" | "behavior">("attendance");
  const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
  const setActiveTab = propSetActiveTab !== undefined ? propSetActiveTab : setLocalActiveTab;

  // Attendance states
  const [presentStudentIds, setPresentStudentIds] = useState<string[]>([]);
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);
  const [lateStudentIds, setLateStudentIds] = useState<string[]>([]);
  const [savedAbsentIds, setSavedAbsentIds] = useState<string[]>([]);
  const [isAllPresentChecked, setIsAllPresentChecked] = useState<boolean>(false);
  const [isAllAbsentChecked, setIsAllAbsentChecked] = useState<boolean>(false);
  const [isBulkSelected, setIsBulkSelected] = useState<boolean>(false);
  const isNoAbsence = absentStudentIds.length === 0 && lateStudentIds.length === 0;
  const [attendanceLoading, setAttendanceLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [hasRecord, setHasRecord] = useState<boolean>(false);
  const [showSaveAttendanceModal, setShowSaveAttendanceModal] = useState<boolean>(false);

  // Behavior states
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedViolation, setSelectedViolation] = useState<string>("");
  const [customViolationText, setCustomViolationText] = useState<string>("");
  const [studentBehaviors, setStudentBehaviors] = useState<BehaviorRecord[]>([]);
  const [behaviorLoading, setBehaviorLoading] = useState<boolean>(false);
  const [behaviorSaveStatus, setBehaviorSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [allBehaviors, setAllBehaviors] = useState<BehaviorRecord[]>([]);
  const [expandedStudentId, setExpandedStudentId] = useState<string>("");
  const [isAddFormOpen, setIsAddFormOpen] = useState<boolean>(true);
  const [pendingBehaviors, setPendingBehaviors] = useState<{ [studentId: string]: string[] }>({});
  const [activeDropdownStudentId, setActiveDropdownStudentId] = useState<string>("");

  useEffect(() => {
    setPendingBehaviors({});
    setActiveDropdownStudentId("");
  }, [selectedGradeId, selectedClassId, selectedPeriod]);

  const loadAllBehaviorsData = async () => {
    try {
      const records = await getAllBehaviorRecords();
      setAllBehaviors(records);
    } catch (error) {
      console.error("Error loading behaviors:", error);
    }
  };

  useEffect(() => {
    loadAllBehaviorsData();
  }, [selectedGradeId, selectedClassId]);

  // Day Formatting in Arabic
  const [formattedDate, setFormattedDate] = useState<string>("");

  useEffect(() => {
    // Current date formatted nicely in Arabic
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateStr = new Date().toLocaleDateString('ar-SA', options);
    setFormattedDate(dateStr);
  }, []);

  // Monitor the first sticky element's height and compute the top offset for the second sticky element dynamically
  useEffect(() => {
    const updateTopOffset = () => {
      if (firstStickyRef.current) {
        const height = firstStickyRef.current.offsetHeight;
        document.documentElement.style.setProperty('--first-sticky-height', `${height}px`);
      }
    };

    updateTopOffset();

    let observer: ResizeObserver | null = null;
    if (firstStickyRef.current) {
      observer = new ResizeObserver(updateTopOffset);
      observer.observe(firstStickyRef.current);
    }
    window.addEventListener("resize", updateTopOffset);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", updateTopOffset);
    };
  }, [grades, filteredClasses, selectedGradeId]);

  // Initialize dropdowns with first elements when data loaded
  useEffect(() => {
    if (grades.length > 0 && !selectedGradeId) {
      setSelectedGradeId(grades[0].id);
    }
  }, [grades]);

  // Update classes list when grade changes
  useEffect(() => {
    if (selectedGradeId) {
      const filtered = classes.filter(c => c.gradeId === selectedGradeId);
      setFilteredClasses(filtered);
      if (filtered.length > 0) {
        // Keep current selected class if it's still valid under the selected grade
        const isCurrentClassValid = filtered.some(c => c.id === selectedClassId);
        if (!isCurrentClassValid) {
          setSelectedClassId(filtered[0].id);
        }
      } else {
        setSelectedClassId("");
      }
    }
  }, [selectedGradeId, classes]);

  // Fetch Students and existing Attendance record when Class/Period/Date changes (Real-time live-sync!)
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;

    async function loadStudents() {
      if (!selectedGradeId || !selectedClassId) {
        setStudents([]);
        return;
      }

      setAttendanceLoading(true);
      try {
        let studentList: Student[] = [];
        if (propStudents && propStudents.length > 0) {
          studentList = propStudents.filter(s => s.gradeId === selectedGradeId && s.classId === selectedClassId);
        } else {
          studentList = await getStudentsByClass(selectedGradeId, selectedClassId);
        }

        if (!active) return;
        setStudents(studentList);

        if (studentList.length > 0 && !selectedStudentId) {
          setSelectedStudentId(studentList[0].id);
        }

        // Setup real-time listener for attendance record
        unsubscribe = subscribeToAttendanceRecord(
          getTodayDateString(),
          selectedPeriod,
          selectedGradeId,
          selectedClassId,
          (record) => {
            if (!active) return;
            if (record) {
              const absent = record.absent || [];
              const late = record.late || [];
              const present = record.present && record.present.length > 0
                ? record.present
                : studentList.map(s => s.id).filter(id => !absent.includes(id) && !late.includes(id));
              
              setPresentStudentIds(present);
              setAbsentStudentIds(absent);
              setLateStudentIds(late);
              setSavedAbsentIds(absent);
              setHasRecord(true);
              setIsDirty(false);
              setIsAllPresentChecked(false);
              setIsAllAbsentChecked(false);
              setIsBulkSelected(false);
            } else {
              setPresentStudentIds([]);
              setAbsentStudentIds([]);
              setLateStudentIds([]);
              setSavedAbsentIds([]);
              setHasRecord(false);
              setIsDirty(false);
              setIsAllPresentChecked(false);
              setIsAllAbsentChecked(false);
              setIsBulkSelected(false);
            }
            setAttendanceLoading(false);
          },
          (_err) => {
            setAttendanceLoading(false);
          }
        );
      } catch (error) {
        setAttendanceLoading(false);
      }
    }

    loadStudents();

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [selectedGradeId, selectedClassId, selectedPeriod, propStudents]);

  // Fetch behavior records when selected student changes (Real-time live-sync!)
  useEffect(() => {
    if (!selectedStudentId) {
      setStudentBehaviors([]);
      return;
    }
    setBehaviorLoading(true);
    const unsubscribe = subscribeToBehaviorRecords(
      selectedStudentId,
      (records) => {
        setStudentBehaviors(records);
        setBehaviorLoading(false);
      },
      (_error) => {
        setBehaviorLoading(false);
      }
    );
    return () => unsubscribe();
  }, [selectedStudentId]);

  // Handle student attendance toggle
  const toggleAttendance = (studentId: string) => {
    setIsDirty(true);
    setIsAllPresentChecked(false);
    setIsAllAbsentChecked(false);

    const isAbsent = absentStudentIds.includes(studentId);
    const shouldTogglePresentAbsent = hasRecord || isBulkSelected;

    if (!shouldTogglePresentAbsent) {
      // حالة عدم الحفظ المسبق وبدون اختيار حضور/غياب الجميع
      if (isAbsent) {
        // إلغاء تحديد الطالب كغائب (مسح حالة غائب وإبقائه غير محدد بدون إظهار كلمة حاضر)
        setAbsentStudentIds(prev => prev.filter(id => id !== studentId));
        setLateStudentIds(prev => prev.filter(id => id !== studentId));
        setPresentStudentIds(prev => prev.filter(id => id !== studentId));
      } else {
        // تحديد الطالب كغائب
        setPresentStudentIds(prev => prev.filter(id => id !== studentId));
        setLateStudentIds(prev => prev.filter(id => id !== studentId));
        setAbsentStudentIds(prev => {
          if (!prev.includes(studentId)) return [...prev, studentId];
          return prev;
        });
      }
    } else {
      // حالة تم الحفظ المسبق أو تم تحديد حضور/غياب الجميع لهذه الحصة
      if (isAbsent) {
        // التغيير من غائب إلى حاضر
        setAbsentStudentIds(prev => prev.filter(id => id !== studentId));
        setLateStudentIds(prev => prev.filter(id => id !== studentId));
        setPresentStudentIds(prev => {
          if (!prev.includes(studentId)) return [...prev, studentId];
          return prev;
        });
      } else {
        // التغيير من حاضر إلى غائب
        setPresentStudentIds(prev => prev.filter(id => id !== studentId));
        setLateStudentIds(prev => prev.filter(id => id !== studentId));
        setAbsentStudentIds(prev => {
          if (!prev.includes(studentId)) return [...prev, studentId];
          return prev;
        });
      }
    }
  };

  // Helper selectors
  const handleSelectAllPresent = () => {
    setIsDirty(true);
    setAbsentStudentIds([]);
    setLateStudentIds([]);
    setPresentStudentIds(students.map(s => s.id));
    setIsAllPresentChecked(true);
    setIsAllAbsentChecked(false);
    setIsBulkSelected(true);
  };

  const handleSelectAllAbsent = () => {
    setIsDirty(true);
    setAbsentStudentIds(students.map(s => s.id));
    setLateStudentIds([]);
    setPresentStudentIds([]);
    setIsAllPresentChecked(false);
    setIsAllAbsentChecked(true);
    setIsBulkSelected(true);
  };

  // Save attendance (Ultra-fast instant save executed directly with animated status popup)
  const handleSaveAttendance = async () => {
    if (!isGoogleAuthenticated && !isDirectTeacherLink) {
      onRequireGoogleLogin?.();
      return;
    }
    if (!selectedTeacherId || !selectedGradeId || !selectedClassId) {
      setSaveStatus({ type: "error", message: "الرجاء اختيار المعلم والصف والفصل أولاً" });
      return;
    }
    if (students.length === 0) {
      setSaveStatus({ type: "error", message: "لا يوجد طلاب في الفصل المحدد" });
      return;
    }

    setAttendanceLoading(true);
    setSaveStatus(null);
    setShowSaveAttendanceModal(true);

    try {
      const presentIds = students
          .map(s => s.id)
          .filter(id => !absentStudentIds.includes(id) && !lateStudentIds.includes(id));

      const studentNamesMap: Record<string, string> = {};
      students.forEach(s => {
        if (s.id && s.name) {
          studentNamesMap[s.id] = s.name.trim();
        }
      });

      const matchedTeacher = teachers.find(t => t.id === selectedTeacherId);
      const currentTeacherName = matchedTeacher?.name || (selectedTeacherId && !selectedTeacherId.startsWith("tea_") && !selectedTeacherId.startsWith("temp_") ? selectedTeacherId : "") || "معلم الحصة";

      await saveAttendanceRecord({
        date: getTodayDateString(),
        period: selectedPeriod,
        gradeId: selectedGradeId,
        classId: selectedClassId,
        teacherId: selectedTeacherId,
        teacherName: currentTeacherName,
        present: presentIds,
        absent: absentStudentIds,
        late: lateStudentIds,
        studentNames: studentNamesMap,
        isNoAbsence: absentStudentIds.length === 0 && lateStudentIds.length === 0
      });

      setSaveStatus({ type: "success", message: "تم حفظ وتوثيق الغياب بنجاح! 💾" });
      setSavedAbsentIds(absentStudentIds);
      setHasRecord(true);
      setIsDirty(false);
      if (onRefreshStats) onRefreshStats();
      
      // Auto close save popup smoothly after displaying success
      setTimeout(() => {
        setShowSaveAttendanceModal(false);
      }, 1500);

      // Auto clear inline message after 3s
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error("Error saving attendance:", error);
      setSaveStatus({ type: "error", message: "حدث خطأ أثناء الحفظ، يرجى المحاولة لاحقاً" });
      setTimeout(() => {
        setShowSaveAttendanceModal(false);
      }, 2000);
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Save behavior observation
  const handleSaveBehavior = async () => {
    if (!isGoogleAuthenticated && !isDirectTeacherLink) {
      onRequireGoogleLogin?.();
      return;
    }
    if (!selectedStudentId) {
      setBehaviorSaveStatus({ type: "error", message: "الرجاء تحديد طالب أولاً" });
      return;
    }
    
    const finalViolation = selectedViolation === "other" ? customViolationText.trim() : selectedViolation;
    
    if (!finalViolation) {
      setBehaviorSaveStatus({ 
        type: "error", 
        message: selectedViolation === "other" ? "الرجاء كتابة السلوك المخصص" : "الرجاء اختيار المخالفة من القائمة" 
      });
      return;
    }

    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) {
      setBehaviorSaveStatus({ type: "error", message: "لم يتم العثور على المعلم المحدد" });
      return;
    }

    setBehaviorLoading(true);
    setBehaviorSaveStatus(null);
    try {
      await saveBehaviorRecord({
        studentId: selectedStudentId,
        date: getTodayDateString(),
        period: selectedPeriod,
        teacherId: selectedTeacherId,
        teacherName: teacher.name,
        violation: finalViolation
      });

      // Reload behaviors
      const records = await getBehaviorRecords(selectedStudentId);
      setStudentBehaviors(records);
      setSelectedViolation("");
      setCustomViolationText("");

      setBehaviorSaveStatus({ type: "success", message: "تم تسجيل مخالفة السلوك بنجاح! 💾" });
      setIsAddFormOpen(false);
      
      // Reload all behaviors to update list counts
      loadAllBehaviorsData().catch(console.error);
      
      if (onRefreshStats) onRefreshStats();

      setTimeout(() => setBehaviorSaveStatus(null), 3000);
    } catch (error) {
      console.error("Error saving behavior:", error);
      setBehaviorSaveStatus({ type: "error", message: "حدث خطأ أثناء الحفظ" });
    } finally {
      setBehaviorLoading(false);
    }
  };

  const totalPendingBehaviorsCount = Object.keys(pendingBehaviors).reduce((sum, studentId) => {
    const list = pendingBehaviors[studentId] || [];
    return sum + list.length;
  }, 0);
  const isBehaviorDirty = totalPendingBehaviorsCount > 0;

  // Save all pending behaviors at once
  const handleSaveAllBehaviors = async () => {
    if (!isGoogleAuthenticated && !isDirectTeacherLink) {
      onRequireGoogleLogin?.();
      return;
    }
    if (totalPendingBehaviorsCount === 0) return;

    const teacher = teachers.find(t => t.id === selectedTeacherId);
    if (!teacher) {
      setBehaviorSaveStatus({ type: "error", message: "لم يتم العثور على المعلم المحدد" });
      return;
    }

    setBehaviorLoading(true);
    setBehaviorSaveStatus(null);

    try {
      const todayStr = getTodayDateString();
      const savePromises: Promise<any>[] = [];

      Object.keys(pendingBehaviors).forEach(studentId => {
        const violations = pendingBehaviors[studentId] || [];
        violations.forEach(violation => {
          savePromises.push(
            saveBehaviorRecord({
              studentId,
              date: todayStr,
              period: selectedPeriod,
              teacherId: selectedTeacherId,
              teacherName: teacher.name,
              violation
            })
          );
        });
      });

      await Promise.all(savePromises);

      // Clear pending drafts
      setPendingBehaviors({});

      // Show success message
      setBehaviorSaveStatus({ type: "success", message: "تم حفظ جميع السلوكيات بنجاح! 💾" });

      // Reload all behaviors
      loadAllBehaviorsData().catch(console.error);

      if (onRefreshStats) onRefreshStats();

      setTimeout(() => setBehaviorSaveStatus(null), 3000);
    } catch (error) {
      console.error("Error saving all behaviors:", error);
      setBehaviorSaveStatus({ type: "error", message: "حدث خطأ أثناء حفظ السلوكيات، يرجى المحاولة لاحقاً" });
    } finally {
      setBehaviorLoading(false);
    }
  };

  const currentGrade = grades.find(g => g.id === selectedGradeId)?.name || "";
  const currentClass = classes.find(c => c.id === selectedClassId)?.name || "";

  // Dynamic calculations
  const totalStudents = students.length;
  const absentCount = isNoAbsence ? 0 : absentStudentIds.length;
  const lateCount = isNoAbsence ? 0 : lateStudentIds.length;
  const presentCount = totalStudents - absentCount - lateCount;

  return (
    <div className="flex flex-col space-y-4 pb-36">
      {/* Title & Teacher/Period Options Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-0 relative overflow-hidden flex flex-col">
        {/* Title Header Part with elegant background color */}
        <div className="text-center relative bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-950 text-white rounded-t-2xl rounded-b-none p-5 shadow-sm overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-8 -mb-8"></div>
          
          <h1 className="text-xl md:text-2xl font-black text-amber-300 mb-1">{schoolName || "البوابة الرقمية للمدرسة"}</h1>
          <div className="flex items-center justify-center gap-1.5 text-blue-100 font-bold text-xs md:text-sm mb-2.5">
            <span>نظام تسجيل الغياب والسلوك</span>
            <span>📋</span>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-white/10 text-white font-bold px-3.5 py-1.5 rounded-full text-xs border border-white/10 shadow-inner">
            <span>📅</span>
            <span>{formattedDate || "الثلاثاء، ١٤ يوليو"}</span>
          </div>
        </div>

        {/* Teacher and Period Selection */}
        <div className="bg-slate-50/90 p-4 sm:p-5 rounded-b-2xl rounded-t-none grid grid-cols-2 gap-3.5 text-right border-t border-slate-100">
          {/* Teacher Select */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black text-slate-700">المعلم</label>
              {!selectedTeacherId && (
                <span className="text-amber-600 font-extrabold text-2xs animate-pulse">
                  👇 (الرجاء اختيار اسم المعلم)
                </span>
              )}
            </div>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className={`w-full bg-white border-2 rounded-xl px-3 py-2.5 text-xs md:text-sm font-bold transition-all cursor-pointer ${
                !selectedTeacherId
                  ? "border-amber-500 ring-2 ring-amber-400/50 bg-amber-50/60 animate-pulse text-amber-900 shadow-md shadow-amber-500/20"
                  : "border-indigo-400 hover:border-indigo-500 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/30 text-slate-800 shadow-xs"
              }`}
            >
              <option value="" disabled className="text-slate-400 font-bold bg-white">
                👨‍🏫 -- الرجاء اختيار اسم المعلم --
              </option>
              {teachers.map((t, idx) => (
                <option key={`${t.id}-${idx}`} value={t.id} className="text-slate-800 font-bold bg-white">
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Period Select */}
          <div className="col-span-2">
            <label className="block text-xs font-black text-slate-700 mb-1.5">الحصة</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PERIODS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPeriod(p)}
                  className={`text-xs py-2 px-1 rounded-lg font-black border transition cursor-pointer ${
                    selectedPeriod === p
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* STICKY GRADE & CLASS SELECTION PANEL (الصف والفصل مثبت في الأعلى عند السكروول) */}
      <div 
        ref={firstStickyRef}
        style={{ top: "var(--header-height, 0px)" }}
        className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md p-4 rounded-2xl text-right border-2 border-indigo-500/80 shadow-md space-y-3 transition-all"
      >
        {/* Grade Select Row */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black text-slate-700">الصف والفصل</label>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full border border-indigo-200/80">
              📌 مثبت أثناء التمرير
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
            {grades.map((g, idx) => {
              const isSelected = selectedGradeId === g.id;
              const gradeShortName = g.name.replace(/^الصف\s+/, "").replace(/^صف\s+/, "");
              return (
                <button
                  key={`${g.id}-${idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedGradeId(g.id);
                    const gradeClasses = classes.filter(c => c.gradeId === g.id);
                    if (gradeClasses.length > 0 && !gradeClasses.some(c => c.id === selectedClassId)) {
                      setSelectedClassId(gradeClasses[0].id);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black border transition-all cursor-pointer shadow-3xs hover:shadow-md hover:scale-[1.02] active:scale-95 ${
                    isSelected
                      ? "bg-[#5046e5] text-white border-[#5046e5] shadow-sm shadow-indigo-500/20"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>🏫</span>
                  <span>{gradeShortName}</span>
                </button>
              );
            })}
            {grades.length === 0 && (
              <p className="text-2xs text-slate-400 font-bold py-1">لا توجد صفوف دراسية</p>
            )}
          </div>
        </div>

        {/* Class Select Row (Separate Line, No Divider) */}
        {selectedGradeId && (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
              {filteredClasses.map((c, idx) => {
                const isSelected = selectedClassId === c.id;
                const classNum = c.name.replace(/^الفصل\s*/, "").replace(/^فصل\s*/, "").trim();
                return (
                  <button
                    key={`${c.id}-${idx}`}
                    type="button"
                    onClick={() => setSelectedClassId(c.id)}
                    className={`flex items-center justify-center min-w-[38px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black border transition-all duration-150 cursor-pointer shadow-3xs hover:shadow-md hover:scale-[1.03] active:scale-95 ${
                      isSelected
                        ? "bg-[#5046e5] text-white border-[#5046e5] shadow-sm shadow-indigo-500/20"
                        : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50/70"
                    }`}
                  >
                    <span>{classNum || c.name}</span>
                  </button>
                );
              })}
              {filteredClasses.length === 0 && (
                <p className="text-2xs text-slate-400 font-bold py-1">لا توجد فصول تابعة لهذا الصف</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* QUICK STATS & SELECTION SUMMARY CARD (مثبت أثناء التمرير) */}
      <div 
        style={{ top: "calc(var(--header-height, 0px) + var(--first-sticky-height, 120px) + 8px)" }}
        className="sticky z-20 flex flex-col mb-1 transition-all"
      >
        <div className={`bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200/90 p-3 sm:p-3.5 flex flex-col gap-2 sm:gap-2.5 transition-all duration-300 ${
          activeTab === "attendance" ? "border-t-4 border-t-blue-600" : "border-t-4 border-t-amber-500"
        }`}>
          {/* Quick stats (Attendance & Absence side by side) */}
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-800 py-2 px-2.5 rounded-xl border border-emerald-100">
              <span className="text-[11px] font-black text-emerald-600">الحضور:</span>
              <span className="text-sm font-black text-emerald-700">{totalStudents > 0 ? presentCount : 0}</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 bg-rose-50 text-rose-800 py-2 px-2.5 rounded-xl border border-rose-100">
              <span className="text-[11px] font-black text-rose-600">الغياب:</span>
              <span className="text-sm font-black text-rose-700">{totalStudents > 0 ? absentCount : 0}</span>
            </div>
          </div>

          {/* Selected Criteria Info Badge */}
          <div className="bg-slate-50 text-slate-600 border border-slate-150 py-1.5 px-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 w-full">
            <div>
              <span>صف: </span>
              <span className="text-slate-900 font-black">{currentGrade || "---"}</span>
            </div>
            <span className="text-slate-300">|</span>
            <div>
              <span>فصل: </span>
              <span className="text-slate-900 font-black">{currentClass || "---"}</span>
            </div>
            <span className="text-slate-300">|</span>
            <div>
              <span>حصة: </span>
              <span className="text-slate-900 font-black">{selectedPeriod}</span>
            </div>
          </div>
        </div>
      </div>

      {/* UNIFIED STUDENT LIST CARD */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col mb-24 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 p-4 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-sm font-black text-slate-800">رصد الحضور والغياب اليومي</span>
          </div>
          <span className="text-2xs font-extrabold text-blue-700 bg-blue-100/70 px-2.5 py-1 rounded-full border border-blue-200">
            الحصة: {selectedPeriod}
          </span>
        </div>

        {/* TAB CONTENT: ATTENDANCE */}
        <div className="flex flex-col">
          {/* Students Attendance List Sub-Header */}
            <div className="bg-slate-50/50 border-b border-slate-100 px-4 py-3 flex flex-wrap gap-3 justify-between items-center text-right">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-black text-slate-700">قائمة الطلاب ({students.length})</span>
                <span className="text-[10px] font-bold text-slate-400">اضغط على اسم الطالب لتغيير حالته</span>
              </div>
              
              <div className="flex items-center gap-2 flex-1 min-w-[220px] sm:flex-initial w-full">
                <button
                  type="button"
                  onClick={handleSelectAllPresent}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg text-xs md:text-sm font-bold border transition-all duration-200 cursor-pointer shadow-3xs ${
                    isAllPresentChecked
                      ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 font-extrabold"
                      : "bg-emerald-50 hover:bg-emerald-100/90 text-emerald-800 border-emerald-200"
                  }`}
                >
                  <div className={`w-4 h-4 border rounded flex items-center justify-center text-[10px] font-black transition-all ${
                    isAllPresentChecked
                      ? "bg-white border-white text-emerald-600"
                      : "bg-white border-emerald-400 text-transparent"
                  }`}>
                    ✓
                  </div>
                  <span>حضور الجميع</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllAbsent}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg text-xs md:text-sm font-bold border transition-all duration-200 cursor-pointer shadow-3xs ${
                    isAllAbsentChecked
                      ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700 font-extrabold"
                      : "bg-rose-50 hover:bg-rose-100/90 text-rose-800 border-rose-200"
                  }`}
                >
                  <div className={`w-4 h-4 border rounded flex items-center justify-center text-[10px] font-black transition-all ${
                    isAllAbsentChecked
                      ? "bg-white border-white text-rose-600"
                      : "bg-white border-rose-400 text-transparent"
                  }`}>
                    ✓
                  </div>
                  <span>غياب الجميع</span>
                </button>
              </div>
            </div>

            {attendanceLoading ? (
              <div className="p-8 text-center text-slate-500 text-sm">جاري تحميل قائمة الطلاب...</div>
            ) : students.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">لا يوجد طلاب مسجلين في هذا الفصل.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {students.map((student, idx) => {
                  const isPresent = presentStudentIds.includes(student.id);
                  const isAbsent = absentStudentIds.includes(student.id);
                  const isLate = lateStudentIds.includes(student.id);

                  const rowBg = "hover:bg-slate-50 bg-white";

                  return (
                    <div
                      key={`${student.id}-${idx}`}
                      onClick={() => toggleAttendance(student.id)}
                      className={`flex items-center justify-between px-4 py-3.5 sm:py-3.5 min-h-[48px] cursor-pointer transition select-none active:scale-[0.99] active:bg-slate-100/80 ${rowBg}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-700 shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-800">
                          {student.name}
                        </span>
                      </div>

                      <div className="transition-all duration-200">
                        {isAbsent ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-700 bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl shadow-2xs animate-in fade-in zoom-in duration-150">
                            <span>غائب</span>
                            <span>📕</span>
                          </span>
                        ) : isLate ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-xl shadow-2xs animate-in fade-in zoom-in duration-150">
                            <span>متأخر</span>
                            <span>⏳</span>
                          </span>
                        ) : isPresent ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl shadow-2xs animate-in fade-in zoom-in duration-150">
                            <span>حاضر</span>
                            <span>📗</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* FLOATING SAVE BAR CONTAINER */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3.5 max-w-md mx-auto shadow-[0_-8px_24px_rgba(15,23,42,0.08)] flex flex-col gap-2 rounded-t-2xl">
        {/* Unsaved changes alert */}
        {isDirty && students.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 py-1.5 px-3.5 rounded-full animate-pulse mx-auto">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
            <span>⚠️ الرجاء حفظ التغييرات الحالية للغياب</span>
          </div>
        )}

        {/* Save Status Notification */}
        {saveStatus && (
          <div className={`p-2 rounded-xl text-center text-xs font-bold border transition ${
            saveStatus.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}>
            {saveStatus.message}
          </div>
        )}

        <motion.button
          type="button"
          onClick={handleSaveAttendance}
          disabled={attendanceLoading || students.length === 0 || !isDirty}
          className={`w-full font-extrabold text-white py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all ${
            !isDirty || students.length === 0
              ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
              : absentStudentIds.length === 0
              ? "bg-emerald-600 hover:bg-emerald-700 active:scale-98 cursor-pointer ring-4 ring-emerald-500/20" 
              : "bg-blue-600 hover:bg-blue-700 active:scale-98 cursor-pointer ring-4 ring-blue-500/20"
          }`}
          animate={isDirty && students.length > 0 ? {
            scale: [1, 1.03, 0.98, 1.03, 1],
            y: [0, -3, 0],
            boxShadow: absentStudentIds.length === 0 
              ? [
                  "0 4px 6px -1px rgba(16, 185, 129, 0.1), 0 2px 4px -2px rgba(16, 185, 129, 0.1)",
                  "0 12px 20px -3px rgba(16, 185, 129, 0.45), 0 6px 8px -4px rgba(16, 185, 129, 0.45)",
                  "0 4px 6px -1px rgba(16, 185, 129, 0.1), 0 2px 4px -2px rgba(16, 185, 129, 0.1)"
                ]
              : [
                  "0 4px 6px -1px rgba(37, 99, 235, 0.1), 0 2px 4px -2px rgba(37, 99, 235, 0.1)",
                  "0 12px 20px -3px rgba(37, 99, 235, 0.45), 0 6px 8px -4px rgba(37, 99, 235, 0.45)",
                  "0 4px 6px -1px rgba(37, 99, 235, 0.1), 0 2px 4px -2px rgba(37, 99, 235, 0.1)"
                ]
          } : {}}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: "easeInOut"
          }}
        >
          {attendanceLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" id="save-progress-circle">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <Save className={`w-5 h-5 ${isDirty && students.length > 0 ? "animate-bounce" : ""}`} />
          )}
          <span>
            {attendanceLoading 
              ? "جاري حفظ الغياب..." 
              : !isDirty
              ? (hasRecord ? "تم حفظ التغييرات بنجاح ✓" : "بانتظار رصد الحضور والغياب... 📝")
              : absentStudentIds.length === 0 
              ? "حفظ (الجميع حضور) 💾" 
              : `حفظ الغياب (${absentStudentIds.length} غائب) 💾`}
          </span>
        </motion.button>
      </div>

      {/* POPUP MODAL: DIRECT INSTANT SAVING STATUS POPUP (نافذة منبثقة فورية لحفظ الغياب مباشرة) */}
      {showSaveAttendanceModal && (
        <div 
          onClick={() => {
            if (!attendanceLoading) setShowSaveAttendanceModal(false);
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[120] flex items-center justify-center p-4 cursor-pointer"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col items-center text-center p-6 space-y-4 relative cursor-default" 
            dir="rtl"
          >
            <button
              type="button"
              onClick={() => {
                setShowSaveAttendanceModal(false);
                setAttendanceLoading(false);
              }}
              className="absolute top-4 left-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs font-black transition cursor-pointer z-10"
              title="إغلاق"
            >
              ✕
            </button>

            {attendanceLoading ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center relative shadow-inner">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-800">جاري حفظ وتوثيق الغياب...</h3>
                  <p className="text-xs text-slate-500 font-medium">يتم رصد السجلات ومزامنة الحصص لحظياً</p>
                </div>
              </div>
            ) : saveStatus?.type === "error" ? (
              <div className="flex flex-col items-center justify-center py-3 space-y-3 w-full">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner">
                  <X className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-rose-800">تعذر الحفظ</h3>
                  <p className="text-xs text-rose-600 font-medium">{saveStatus.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveAttendanceModal(false)}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-2 space-y-3 w-full">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-emerald-800">تم حفظ الغياب بنجاح! 💾</h3>
                  <p className="text-xs text-slate-600 font-bold">
                    {absentStudentIds.length === 0 
                      ? "جميع الطلاب حضور 100% ✨" 
                      : `تم رصد غياب ${absentStudentIds.length} طالب بنجاح 📋`}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-2xs font-extrabold text-slate-600 w-full">
                  {grades.find(g => g.id === selectedGradeId)?.name} - {classes.find(c => c.id === selectedClassId)?.name} | {selectedPeriod}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveAttendanceModal(false)}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  تم، إغلاق النافذة ✓
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
