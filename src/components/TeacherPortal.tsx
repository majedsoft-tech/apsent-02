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
  const [firstStickyHeight, setFirstStickyHeight] = useState<number>(115);

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
  const isDirtyRef = React.useRef<boolean>(false);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);
  const [hasRecord, setHasRecord] = useState<boolean>(false);
  const [showSaveAttendanceModal, setShowSaveAttendanceModal] = useState<boolean>(false);
  const [saveStep, setSaveStep] = useState<number>(1);

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
        if (height > 0) {
          setFirstStickyHeight(height);
          document.documentElement.style.setProperty('--first-sticky-height', `${height}px`);
        }
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

  // Keep students in sync when propStudents or grade/class changes
  useEffect(() => {
    if (!selectedGradeId || !selectedClassId) {
      setStudents([]);
      return;
    }
    if (propStudents && propStudents.length > 0) {
      const studentList = propStudents.filter(s => s.gradeId === selectedGradeId && s.classId === selectedClassId);
      setStudents(studentList);
      if (studentList.length > 0 && !selectedStudentId) {
        setSelectedStudentId(studentList[0].id);
      }
    }
  }, [propStudents, selectedGradeId, selectedClassId]);

  // Fetch Students and existing Attendance record when Class/Period/Date changes (Real-time live-sync!)
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;
    setIsDirty(false);
    isDirtyRef.current = false;

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
            // CRITICAL: If the teacher is actively editing or has unsaved draft, do NOT clobber with background sync!
            if (isDirtyRef.current) {
              setAttendanceLoading(false);
              return;
            }
            if (record) {
              const absent = Array.isArray(record.absent) ? record.absent : [];
              const late = Array.isArray(record.late) ? record.late : [];
              const present = record.present && record.present.length > 0
                ? record.present
                : studentList.map(s => s.id).filter(id => !absent.includes(id) && !late.includes(id));
              
              setPresentStudentIds(present);
              setAbsentStudentIds(absent);
              setLateStudentIds(late);
              setSavedAbsentIds(absent);
              setHasRecord(true);
              setIsDirty(false);
              isDirtyRef.current = false;
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
              isDirtyRef.current = false;
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

    const handleSync = () => {
      loadStudents();
    };
    window.addEventListener("school_data_synced", handleSync);

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
      window.removeEventListener("school_data_synced", handleSync);
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

  // Handle student attendance toggle (Atomic functional update to prevent dropped taps)
  const toggleAttendance = (studentId: string) => {
    setIsDirty(true);
    isDirtyRef.current = true;
    setIsAllPresentChecked(false);
    setIsAllAbsentChecked(false);

    setAbsentStudentIds(prevAbsent => {
      const isAbsent = prevAbsent.includes(studentId);
      const shouldTogglePresentAbsent = hasRecord || isBulkSelected;

      if (!shouldTogglePresentAbsent) {
        // حالة عدم الحفظ المسبق وبدون اختيار حضور/غياب الجميع
        if (isAbsent) {
          // إلغاء تحديد الطالب كغائب (مسح حالة غائب وإبقائه غير محدد بدون إظهار كلمة حاضر)
          setPresentStudentIds(prev => prev.filter(id => id !== studentId));
          setLateStudentIds(prev => prev.filter(id => id !== studentId));
          return prevAbsent.filter(id => id !== studentId);
        } else {
          // تحديد الطالب كغائب
          setPresentStudentIds(prev => prev.filter(id => id !== studentId));
          setLateStudentIds(prev => prev.filter(id => id !== studentId));
          return prevAbsent.includes(studentId) ? prevAbsent : [...prevAbsent, studentId];
        }
      } else {
        // حالة تم الحفظ المسبق أو تم تحديد حضور/غياب الجميع لهذه الحصة
        if (isAbsent) {
          // التغيير من غائب إلى حاضر
          setLateStudentIds(prev => prev.filter(id => id !== studentId));
          setPresentStudentIds(prev => prev.includes(studentId) ? prev : [...prev, studentId]);
          return prevAbsent.filter(id => id !== studentId);
        } else {
          // التغيير من حاضر إلى غائب
          setPresentStudentIds(prev => prev.filter(id => id !== studentId));
          setLateStudentIds(prev => prev.filter(id => id !== studentId));
          return prevAbsent.includes(studentId) ? prevAbsent : [...prevAbsent, studentId];
        }
      }
    });
  };

  // Helper selectors
  const handleSelectAllPresent = () => {
    setIsDirty(true);
    isDirtyRef.current = true;
    setAbsentStudentIds([]);
    setLateStudentIds([]);
    setPresentStudentIds(students.map(s => s.id));
    setIsAllPresentChecked(true);
    setIsAllAbsentChecked(false);
    setIsBulkSelected(true);
  };

  const handleSelectAllAbsent = () => {
    setIsDirty(true);
    isDirtyRef.current = true;
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
    setSaveStep(1);
    setShowSaveAttendanceModal(true);

    try {
      const currentAbsent = [...absentStudentIds];
      const currentLate = [...lateStudentIds];
      const presentIds = students
          .map(s => s.id)
          .filter(id => !currentAbsent.includes(id) && !currentLate.includes(id));

      const studentNamesMap: Record<string, string> = {};
      students.forEach(s => {
        if (s.id && s.name) {
          studentNamesMap[s.id] = s.name.trim();
        }
      });

      const matchedTeacher = teachers.find(t => t.id === selectedTeacherId);
      const currentTeacherName = matchedTeacher?.name || (selectedTeacherId && !selectedTeacherId.startsWith("tea_") && !selectedTeacherId.startsWith("temp_") ? selectedTeacherId : "") || "معلم الحصة";

      // Stage 1 delay for visual perception
      await new Promise(r => setTimeout(r, 320));
      setSaveStep(2);

      await saveAttendanceRecord({
        date: getTodayDateString(),
        period: selectedPeriod,
        gradeId: selectedGradeId,
        classId: selectedClassId,
        teacherId: selectedTeacherId,
        teacherName: currentTeacherName,
        present: presentIds,
        absent: currentAbsent,
        late: currentLate,
        studentNames: studentNamesMap,
        isNoAbsence: currentAbsent.length === 0 && currentLate.length === 0
      });

      // Stage 3: Syncing live stats
      setSaveStep(3);
      if (onRefreshStats) onRefreshStats();
      await new Promise(r => setTimeout(r, 300));

      setSaveStatus({ type: "success", message: "تم حفظ وتوثيق الغياب بنجاح! 💾" });
      setSavedAbsentIds(currentAbsent);
      setHasRecord(true);
      setIsDirty(false);
      isDirtyRef.current = false;
      
      // Stage 4: Completed
      setSaveStep(4);

      // Auto close and disappear smoothly without any manual action or old screen
      setTimeout(() => {
        setShowSaveAttendanceModal(false);
        setAttendanceLoading(false);
      }, 750);

      // Auto clear inline message after 3s
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error("Error saving attendance:", error);
      setSaveStatus({ type: "error", message: "حدث خطأ أثناء الحفظ، يرجى المحاولة لاحقاً" });
      setTimeout(() => {
        setShowSaveAttendanceModal(false);
        setAttendanceLoading(false);
      }, 2000);
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

      {/* GRADE & CLASS SELECTION PANEL */}
      <div 
        className="bg-slate-50/95 p-3 sm:p-4 rounded-2xl text-right border-2 border-indigo-500/80 shadow-md space-y-2.5 sm:space-y-3 transition-all"
      >
        {/* Grade Select Row */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black text-slate-700">الصف والفصل</label>
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
        id="teacher-portal-quick-stats-sticky"
        style={{ 
          top: "var(--header-height, 0px)" 
        }}
        className="sticky top-0 z-20 flex flex-col mb-1 transition-all"
      >
        <div className={`bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200/90 p-3 sm:p-3.5 flex flex-col gap-2 sm:gap-2.5 transition-all duration-300 ${
          activeTab === "attendance" ? "border-t-4 border-t-blue-600" : "border-t-4 border-t-amber-500"
        }`}>
          {/* Quick stats (Attendance & Absence side by side) */}
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-800 py-2 px-2.5 rounded-xl border border-emerald-100 shadow-3xs">
              <span className="text-[11px] font-black text-emerald-600">الحضور:</span>
              <span className="text-sm font-black text-emerald-700">{totalStudents > 0 ? presentCount : 0}</span>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 bg-rose-50 text-rose-800 py-2 px-2.5 rounded-xl border border-rose-100 shadow-3xs">
              <span className="text-[11px] font-black text-rose-600">الغياب:</span>
              <span className="text-sm font-black text-rose-700">{totalStudents > 0 ? absentCount : 0}</span>
            </div>
          </div>

          {/* Selected Criteria Info Badge */}
          <div className="bg-slate-50 text-slate-600 border border-slate-150 py-1.5 px-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 w-full shadow-3xs">
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
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleAttendance(student.id)}
                      className={`flex items-center justify-between px-4 py-3.5 sm:py-3.5 min-h-[48px] cursor-pointer transition select-none active:scale-[0.99] active:bg-slate-100/80 touch-manipulation ${rowBg}`}
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

      {/* POPUP MODAL: HOURGLASS SAVING STAGES (نافذة منبثقة على شكل ساعة رملية لمراحل الحفظ) */}
      {showSaveAttendanceModal && (
        <div 
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[120] flex items-center justify-center p-4 select-none"
          dir="rtl"
        >
          <motion.div 
            initial={{ scale: 0.85, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="bg-slate-900 border border-amber-500/30 shadow-2xl rounded-3xl p-6 sm:p-7 max-w-xs sm:max-w-sm w-full text-center space-y-4 relative overflow-hidden text-white" 
          >
            {/* Ambient Warm Hourglass Glow */}
            <div className="absolute top-0 right-1/2 translate-x-1/2 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>

            {/* Error Fallback */}
            {saveStatus?.type === "error" ? (
              <div className="space-y-4 py-2">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto shadow-inner">
                  <X className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-rose-300">تعذر الحفظ</h3>
                  <p className="text-xs text-rose-200/80 font-medium">{saveStatus.message}</p>
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
              <div className="space-y-4 relative z-10">
                {/* Header Badge & Title */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black tracking-wider uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-3xs">
                    <span>⏳</span>
                    <span>{saveStep === 4 ? "اكتمل الحفظ" : "جاري حفظ الغياب"}</span>
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white pt-0.5">
                    {saveStep === 4 ? "تم توثيق الغياب بنجاح! ✨" : "مراحل حفظ وتوثيق الغياب"}
                  </h3>
                </div>

                {/* Animated Hourglass Graphic */}
                <div className="relative py-2 flex items-center justify-center">
                  <div className="relative">
                    <svg className="w-20 h-24 mx-auto drop-shadow-[0_4px_16px_rgba(245,158,11,0.25)]" viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Top & Bottom Brass Caps */}
                      <rect x="6" y="2" width="52" height="5" rx="2.5" fill="#D97706" stroke="#F59E0B" strokeWidth="1" />
                      <rect x="6" y="73" width="52" height="5" rx="2.5" fill="#D97706" stroke="#F59E0B" strokeWidth="1" />

                      {/* Glass Body */}
                      <path
                        d="M13 7 C13 26 27 36 29 40 C27 44 13 54 13 73 L51 73 C51 54 37 44 35 40 C37 36 51 26 51 7 Z"
                        fill="rgba(255, 255, 255, 0.04)"
                        stroke="rgba(245, 158, 11, 0.5)"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />

                      {/* Top Sand (Depleting as steps advance) */}
                      <path
                        d={
                          saveStep === 1
                            ? "M17 12 C17 24 27 34 31 38 C35 34 45 24 45 12 Z"
                            : saveStep === 2
                            ? "M20 20 C22 26 27 34 31 38 C35 34 40 26 42 20 Z"
                            : saveStep === 3
                            ? "M25 28 C27 32 29 35 31 38 C33 35 35 32 37 28 Z"
                            : "M30 36 C30.5 37 31 38 31 38 C31 38 31.5 37 32 36 Z"
                        }
                        fill="#F59E0B"
                        className="transition-all duration-300 ease-out"
                      />

                      {/* Falling Sand Stream in the Neck */}
                      {saveStep < 4 && (
                        <>
                          <line 
                            x1="31" 
                            y1="38" 
                            x2="31" 
                            y2="66" 
                            stroke="#FBBF24" 
                            strokeWidth="2" 
                            strokeDasharray="4 2" 
                            className="animate-pulse" 
                          />
                          <circle cx="31" cy="48" r="1.5" fill="#FEF08A" className="animate-ping" style={{ animationDuration: "0.8s" }} />
                          <circle cx="31" cy="58" r="1.2" fill="#FEF08A" className="animate-bounce" style={{ animationDuration: "0.6s" }} />
                        </>
                      )}

                      {/* Bottom Sand (Filling up as steps advance) */}
                      <path
                        d={
                          saveStep === 1
                            ? "M23 72 C27 68 35 68 39 72 Z"
                            : saveStep === 2
                            ? "M18 72 C22 62 40 62 44 72 Z"
                            : saveStep === 3
                            ? "M15 72 C19 54 43 54 47 72 Z"
                            : "M15 72 C17 48 45 48 47 72 Z"
                        }
                        fill="#F59E0B"
                        className="transition-all duration-300 ease-out"
                      />

                      {/* Glass Highlight Reflections */}
                      <path
                        d="M17 12 C17 22 23 29 25 33"
                        stroke="rgba(255, 255, 255, 0.45)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M17 68 C17 58 23 51 25 47"
                        stroke="rgba(255, 255, 255, 0.3)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* Step 4: Big glowing checkmark badge over hourglass */}
                    {saveStep === 4 && (
                      <div className="absolute inset-0 flex items-center justify-center animate-in zoom-in-75 duration-300">
                        <div className="w-13 h-13 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/50 border-2 border-white">
                          <CheckCircle className="w-7 h-7" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/80 p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      saveStep === 4 
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400" 
                        : "bg-gradient-to-r from-amber-500 to-amber-300"
                    }`}
                    style={{ 
                      width: saveStep === 1 ? "25%" : saveStep === 2 ? "60%" : saveStep === 3 ? "85%" : "100%" 
                    }}
                  />
                </div>

                {/* Current Stage Description Card */}
                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span className="text-amber-400 font-black">المرحلة {saveStep} من ٤</span>
                    <span className="font-mono text-slate-300 font-extrabold">
                      {saveStep === 1 ? "25%" : saveStep === 2 ? "60%" : saveStep === 3 ? "85%" : "100%"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-extrabold text-white leading-relaxed min-h-[22px]">
                    {saveStep === 1 && "📋 تهيئة وتجهيز سجلات الحضور والغياب..."}
                    {saveStep === 2 && "💾 تشفير وحفظ السجل سحابياً ومحلياً..."}
                    {saveStep === 3 && "⚡ تحديث ومزامنة الإحصائيات الفورية..."}
                    {saveStep === 4 && "✨ اكتمل حفظ وتوثيق الغياب بنجاح!"}
                  </p>
                </div>

                {/* 4 Steps Indicator Dots */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  {[1, 2, 3, 4].map((stepNum) => (
                    <div 
                      key={stepNum}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        saveStep > stepNum
                          ? "w-6 bg-emerald-500"
                          : saveStep === stepNum
                          ? "w-8 bg-amber-400 animate-pulse"
                          : "w-2 bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
