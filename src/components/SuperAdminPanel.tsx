import React, { useState, useEffect } from "react";
import { RegisteredUser } from "../types";
import { 
  getRegisteredUsers, 
  updateUserStatus, 
  deleteRegisteredUser,
  purgeAllServerAndTemporaryData,
  purgeDeletedAndOrphanedData
} from "../dbService";
import { 
  Search, 
  RefreshCw, 
  Users, 
  ShieldCheck, 
  UserX, 
  Calendar, 
  School, 
  Trash2, 
  Sliders, 
  Power, 
  Loader2, 
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  Mail,
  GraduationCap,
  Layers,
  BookOpen,
  UserCheck
} from "lucide-react";

interface SuperAdminPanelProps {
  currentUser: any;
  onRefreshData?: () => Promise<void>;
  globalProgress?: { active: boolean; type: "save" | "load" | "delete" | "import" | null; label: string };
  setGlobalProgress?: React.Dispatch<React.SetStateAction<{ active: boolean; type: "save" | "load" | "delete" | "import" | null; label: string }>>;
}

export default function SuperAdminPanel({ 
  currentUser,
  onRefreshData,
  globalProgress,
  setGlobalProgress
}: SuperAdminPanelProps) {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal deletion target
  const [deleteTarget, setDeleteTarget] = useState<RegisteredUser | null>(null);
  const [wipeDataChecked, setWipeDataChecked] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load registered users on mount
  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getRegisteredUsers();
      setUsers(data);
    } catch {
      // Graceful fallback to avoid alert toasts
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Toggle status (Active / Suspended)
  const handleToggleStatus = async (user: RegisteredUser) => {
    const newStatus = user.status === "نشط" ? "موقوف" : "نشط";
    const label = newStatus === "موقوف" ? "حظر" : "تنشيط";
    
    if (setGlobalProgress) {
      setGlobalProgress({ active: true, type: "save", label: `جاري ${label} حساب المستخدم...` });
    }

    try {
      await updateUserStatus(user.uid, newStatus);
      showMessage(`تم تغيير حالة حساب ${user.displayName} إلى (${newStatus}) بنجاح.`);
      // Update local state instantly
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, status: newStatus } : u));
    } catch (err) {
      console.error("Failed to update status:", err);
      showMessage("حدث خطأ أثناء تحديث حالة الحساب.", "error");
    } finally {
      if (setGlobalProgress) {
        setGlobalProgress({ active: false, type: null, label: "" });
      }
    }
  };

  // Perform full/partial delete
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const modeText = wipeDataChecked ? "وحذف كامل بياناته المدرسية" : "فقط";
    
    if (setGlobalProgress) {
      setGlobalProgress({ active: true, type: "delete", label: `جاري حذف حساب المستخدم ${modeText}...` });
    }

    try {
      await deleteRegisteredUser(deleteTarget.uid, deleteTarget.email, wipeDataChecked);
      showMessage(`تم حذف المستخدم (${deleteTarget.displayName}) ${modeText} بنجاح.`);
      setUsers(prev => prev.filter(u => u.uid !== deleteTarget.uid));
      setDeleteTarget(null);
      setWipeDataChecked(false);
      if (onRefreshData) {
        onRefreshData().catch(console.error);
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      showMessage("حدث خطأ أثناء محاولة حذف المستخدم.", "error");
    } finally {
      setIsDeleting(false);
      if (setGlobalProgress) {
        setGlobalProgress({ active: false, type: null, label: "" });
      }
    }
  };

  // Filter logic
  const filteredUsers = users.filter(u => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = 
      u.email.toLowerCase().includes(query) ||
      u.displayName.toLowerCase().includes(query) ||
      u.schoolName.toLowerCase().includes(query);

    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "active" && u.status === "نشط") ||
      (statusFilter === "suspended" && u.status === "موقوف");

    return matchesSearch && matchesStatus;
  });

  const totalUsers = users.length;
  const activeCount = users.filter(u => u.status === "نشط").length;
  const suspendedCount = users.filter(u => u.status === "موقوف").length;

  return (
    <div className="space-y-6 text-right animate-fadeIn" dir="rtl">
      {/* Decorative top header card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full -mr-12 -mt-12 blur-xl"></div>
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-indigo-500/10 rounded-full -ml-12 -mb-12 blur-xl"></div>
        
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="space-y-2 text-center md:text-right">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="bg-gradient-to-tr from-amber-500 to-yellow-400 p-2 rounded-xl text-slate-950 font-black text-sm shadow-md animate-pulse">
                👑
              </span>
              <h1 className="text-xl md:text-2xl font-black text-amber-300">لوحة الإدارة الفائقة والتحكم بالمسجلين</h1>
            </div>
            <p className="text-xs text-slate-300 font-bold max-w-xl leading-relaxed">
              مرحباً بك أستاذ ماجد. تتيح لك هذه اللوحة مراقبة وإدارة كافة الحسابات والمدارس المسجلة في هذا البرنامج، مع إمكانية تجميد الحسابات أو حذفها نهائياً مع تصفير بياناتها لتنظيف الخادم.
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap justify-center md:justify-end">
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm("هل تريد بالتأكيد تنظيف ومسح كافة السجلات المحذوفة والمؤقتة العالقة في السيرفر؟")) return;
                if (setGlobalProgress) {
                  setGlobalProgress({ active: true, type: "delete", label: "جاري تنظيف السجلات المحذوفة والمؤقتة في السيرفر..." });
                }
                try {
                  const res = await purgeDeletedAndOrphanedData();
                  showMessage(`تم تنظيف ${res.purgedCount} سجل مؤقت/محذوف من السيرفر بنجاح.`);
                  loadUsers();
                  if (onRefreshData) onRefreshData().catch(console.error);
                } catch (e) {
                  showMessage("حدث خطأ أثناء تنظيف السيرفر.", "error");
                } finally {
                  if (setGlobalProgress) {
                    setGlobalProgress({ active: false, type: null, label: "" });
                  }
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-2xl text-xs font-black transition active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تنظيف السجلات المحذوفة</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!window.confirm("تحذير: هل تريد مسح وتصفير كافة بيانات السيرفر والتخزين المؤقت بالكامل (الصفوف، الفصول، الطلاب، المعلمين، الغياب، السلوك)؟")) return;
                if (setGlobalProgress) {
                  setGlobalProgress({ active: true, type: "delete", label: "جاري مسح وتصفير كافة بيانات السيرفر والمؤقتة..." });
                }
                try {
                  const res = await purgeAllServerAndTemporaryData(true);
                  showMessage(`تم تصفير ومسح كافة بيانات السيرفر والتخزين المؤقت بنجاح (${res.deletedCount} مستند).`);
                  loadUsers();
                  if (onRefreshData) onRefreshData().catch(console.error);
                } catch (e) {
                  showMessage("حدث خطأ أثناء تصفير بيانات السيرفر.", "error");
                } finally {
                  if (setGlobalProgress) {
                    setGlobalProgress({ active: false, type: null, label: "" });
                  }
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-2xl text-xs font-black transition active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>مسح شامل لبيانات السيرفر</span>
            </button>

            <button
              type="button"
              onClick={loadUsers}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-2xl text-xs font-black transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
              <span>تحديث البيانات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Notifications */}
      {actionMessage && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 border shadow-md animate-bounce text-xs font-bold ${
          actionMessage.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
            : "bg-rose-50 text-rose-800 border-rose-100"
        }`}>
          {actionMessage.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-3xs flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-16 h-16 bg-blue-500/5 rounded-full -ml-4 -mt-4"></div>
          <div className="space-y-1">
            <p className="text-3xs font-black text-slate-400 uppercase tracking-wider">إجمالي المشتركين</p>
            <h3 className="text-2xl font-black text-slate-800">{totalUsers} مستخدم</h3>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-3xs flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-16 h-16 bg-emerald-500/5 rounded-full -ml-4 -mt-4"></div>
          <div className="space-y-1">
            <p className="text-3xs font-black text-slate-400 uppercase tracking-wider">الحسابات النشطة</p>
            <h3 className="text-2xl font-black text-emerald-600">{activeCount} حساب</h3>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-3xs flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-16 h-16 bg-rose-500/5 rounded-full -ml-4 -mt-4"></div>
          <div className="space-y-1">
            <p className="text-3xs font-black text-slate-400 uppercase tracking-wider">الحسابات الموقوفة</p>
            <h3 className="text-2xl font-black text-rose-600">{suspendedCount} حساب</h3>
          </div>
          <div className="bg-rose-50 p-3 rounded-xl text-rose-600">
            <UserX className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and search control bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-3xs">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالبريد الإلكتروني، اسم المستخدم، أو اسم المدرسة..."
            className="w-full text-xs font-bold pl-4 pr-10 py-3 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl outline-none transition text-right bg-slate-50 focus:bg-white"
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1.5 self-end md:self-auto bg-slate-100 p-1.5 rounded-xl border border-slate-200/30">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              statusFilter === "all" ? "bg-white text-slate-800 shadow-3xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            الكل ({totalUsers})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              statusFilter === "active" ? "bg-white text-emerald-600 shadow-3xs" : "text-slate-500 hover:text-emerald-500"
            }`}
          >
            نشط ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("suspended")}
            className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              statusFilter === "suspended" ? "bg-white text-rose-600 shadow-3xs" : "text-slate-500 hover:text-rose-500"
            }`}
          >
            موقوف ({suspendedCount})
          </button>
        </div>
      </div>

      {/* Main List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-3xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-xs font-bold text-slate-500">جاري تحميل سجلات المشتركين ومزامنة الإحصائيات من السحابة...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <div className="text-4xl">🔍</div>
            <h3 className="text-sm font-black text-slate-700">لا يوجد مستخدمين يطابقون خيارات البحث</h3>
            <p className="text-3xs text-slate-400 font-bold">يرجى التأكد من كتابة البريد الإلكتروني أو تصفية الحسابات بشكل صحيح.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-3xs font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">تفاصيل المشترك والحساب</th>
                  <th className="py-4 px-4">المدرسة وتوزيع الهيكل</th>
                  <th className="py-4 px-4">تاريخ التسجيل</th>
                  <th className="py-4 px-4">آخر تسجيل دخول</th>
                  <th className="py-4 px-4 text-center">حالة الحساب</th>
                  <th className="py-4 px-6 text-center">خيارات التحكم والتحجيم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user, idx) => {
                  const regDate = new Date(user.createdAt).toLocaleDateString("ar-SA", { year: 'numeric', month: 'short', day: 'numeric' });
                  const loginDate = new Date(user.lastLogin).toLocaleDateString("ar-SA", { year: 'numeric', month: 'short', day: 'numeric' });
                  const loginTime = new Date(user.lastLogin).toLocaleTimeString("ar-SA", { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr key={`user-${user.uid}-${idx}`} className="hover:bg-slate-50/40 transition-colors text-xs font-semibold text-slate-700">
                      {/* Column 1: Profile & Email */}
                      <td className="py-4.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50/50 flex items-center justify-center text-blue-600 font-extrabold text-sm flex-shrink-0 shadow-3xs overflow-hidden">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              user.displayName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-black text-slate-800">{user.displayName}</h4>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold" dir="ltr">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: School name & Counts */}
                      <td className="py-4.5 px-4 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-black text-slate-800">
                          <School className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                          <span>{user.schoolName || "لم يسجل مدرسة بعد"}</span>
                        </div>
                        
                        {/* Dynamic DB counts tags */}
                        <div className="flex flex-wrap gap-1">
                          <span className="inline-flex items-center gap-0.5 bg-slate-50 border border-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-extrabold">
                            <Layers className="w-2.5 h-2.5 text-slate-400" />
                            <span>صفوف: {user.gradesCount || 0}</span>
                          </span>
                          <span className="inline-flex items-center gap-0.5 bg-slate-50 border border-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-extrabold">
                            <BookOpen className="w-2.5 h-2.5 text-slate-400" />
                            <span>فصول: {user.classesCount || 0}</span>
                          </span>
                          <span className="inline-flex items-center gap-0.5 bg-slate-50 border border-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-extrabold">
                            <UserCheck className="w-2.5 h-2.5 text-slate-400" />
                            <span>معلمون: {user.teachersCount || 0}</span>
                          </span>
                          <span className="inline-flex items-center gap-0.5 bg-blue-50 border border-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-extrabold">
                            <GraduationCap className="w-2.5 h-2.5 text-blue-400" />
                            <span>طلاب: {user.studentsCount || 0}</span>
                          </span>
                        </div>
                      </td>

                      {/* Column 3: Created At */}
                      <td className="py-4.5 px-4 text-slate-500 font-bold">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{regDate}</span>
                        </div>
                      </td>

                      {/* Column 4: Last login */}
                      <td className="py-4.5 px-4 text-slate-500 font-bold space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{loginDate}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mr-5" dir="ltr">{loginTime}</p>
                      </td>

                      {/* Column 5: Status */}
                      <td className="py-4.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-3xs font-extrabold border ${
                          user.status === "نشط"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === "نشط" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                          <span>{user.status === "نشط" ? "نشط ومصرح" : "موقوف مؤقتاً"}</span>
                        </span>
                      </td>

                      {/* Column 6: Controls */}
                      <td className="py-4.5 px-6">
                        <div className="flex items-center justify-center gap-2">
                          {/* Toggle active / suspended */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user)}
                            className={`p-2 border rounded-xl flex items-center gap-1 text-2xs font-extrabold transition cursor-pointer ${
                              user.status === "نشط"
                                ? "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800"
                                : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800"
                            }`}
                            title={user.status === "نشط" ? "تجميد الحساب" : "تنشيط الحساب"}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{user.status === "نشط" ? "تجميد" : "تنشيط"}</span>
                          </button>

                          {/* Delete completely */}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(user);
                              setWipeDataChecked(false);
                            }}
                            className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-1 text-2xs font-extrabold transition cursor-pointer"
                            title="حذف الحساب والبيانات"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DYNAMIC CONFIRM DELETE MODAL WITH COMPLETE DATABASE WIPING SELECTOR */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 text-right shadow-2xl relative overflow-hidden space-y-5">
            {/* Warning color stripe */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-rose-500"></div>
            
            <div className="space-y-4">
              <div className="mx-auto bg-rose-50 p-3.5 rounded-2xl text-rose-600 w-fit">
                <AlertTriangle className="w-8 h-8" />
              </div>
              
              <div className="space-y-2 text-center">
                <h3 className="text-base font-black text-slate-800">تأكيد حذف الحساب المشترك ⚠️</h3>
                <p className="text-3xs text-slate-500 font-bold leading-relaxed px-1">
                  أنت على وشك حذف حساب المشترك <strong className="text-slate-800 font-black">({deleteTarget.displayName})</strong> ذو البريد الإلكتروني <span className="font-mono text-[10px] text-blue-600 font-bold" dir="ltr">{deleteTarget.email}</span>. يرجى تأكيد كيفية رغبتك في مسح هذا الحساب.
                </p>
              </div>

              {/* Advanced option: Wiping database school records completely */}
              <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wipeDataChecked}
                    onChange={(e) => setWipeDataChecked(e.target.checked)}
                    className="w-4 h-4 mt-1 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                  />
                  <div className="space-y-0.5">
                    <p className="text-2xs font-black text-rose-950">تطهير وتصفير قاعدة البيانات المدرسية بالكامل للعميل</p>
                    <p className="text-[10px] text-rose-700/80 font-bold leading-relaxed">
                      عند تحديد هذا الخيار، سيتم حذف جميع الفصول، الصفوف، المعلمين، الطلاب، سجلات الغياب، ومخالفات السلوك المسجلة تحت هذا الحساب تلقائياً من الخادم لحفظ مساحة التخزين.
                    </p>
                  </div>
                </label>
              </div>

              {/* Warning label */}
              <div className="flex items-start gap-2 text-3xs text-slate-400 font-bold leading-normal bg-slate-50 p-2.5 rounded-xl">
                <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <span>إجراء الحذف نهائي ولا يمكن التراجع عنه بأي حال من الأحوال بعد المزامنة.</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/10 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>تأكيد الحذف النهائي</span>
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
