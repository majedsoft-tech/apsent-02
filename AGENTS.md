# دليل وإرشادات حل مشاكل المزامنة والربط السحابي (Firebase & Firestore Sync Playbook)

تم توثيق هذا الدليل بناءً على التجربة العملية لضمان حل أي مشكلة مزامنة سحابية بين بيئة التطوير (AI Studio / Localhost) والاستضافة الخارجية (Vercel / Production) في ثوانٍ وبشكل فوري.

---

## 1. الأسباب الجذرية الشائعة لتعطل المزامنة (Root Causes)

1. **عدم إنشاء قاعدة بيانات Firestore في المشروع الجديد:**
   - عند إنشاء مشروع Firebase جديد، تكون خدمة `Firestore` غير مفعلة افتراضياً حتى يضغط المستخدم على `Create database`.
2. **قواعد الأمان (Firestore Security Rules):**
   - ينشئ Firebase قواعد الأمان الافتراضية بنمط `allow read, write: if false;` أو تنتهي صلاحيتها بعد 30 يوماً في وضع `Test mode`.
   - الحل المعتمد والدائم للمزامنة المدرسية المشتركة:
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /{document=**} {
           allow read, write: if true;
         }
       }
     }
     ```
3. **معرّف قاعدة البيانات (Database ID):**
   - التطبيقات تعتمد تلقائياً على `(default)`. إذا سمى المستخدم قاعدة البيانات باسم المشروع (مثل `apsents1`)، يجب أن يدعم الكود التبديل التلقائي أو اليدوي لـ `Database ID`.
4. **النطاقات المصرح بها (Authorized Domains في Authentication):**
   - عند النشر على Vercel (`*.vercel.app`)، يجب إضافة رابط النطاق إلى قائمة `Authentication > Settings > Authorized domains` لضمان عمل تسجيل الدخول بحساب Google.
5. **توجيه الروابط في Vercel (SPA Routing):**
   - يلزم دائماً وجود ملف `vercel.json` يحتوي على إعادة التوجيه لـ `index.html` لمنع أخطاء `404 Not Found` عند استخدام روابط مباشرة.

---

## 2. الإجراءات البرمجية الدائمة في الكود (Architectural Best Practices)

- **تضمين أداة الفحص والتشخيص التلقائي (`FirebaseDiagnosticModal`):**
  - فحص متزامن لقاعدة `(default)` وقاعدة اسم المشروع وإظهار النتيجة للمستخدم مع زر تفعيل مباشر بضغطة واحدة.
- **توفير خيار النسخ الاحتياطي اليدوي السريع (`JSON Export / Import`):**
  - ضمان وجود أزرار استيراد وتصدير ملفات النسخ الاحتياطي في الواجهة لتمكين نقل البيانات يدوياً بدون أي اعتماد خارجي في الحالات الطارئة.
- **دعم التخزين المحلي الاحتياطي (Offline Cache & Real-time Channel):**
  - حفظ نسخة احتياطية في `localStorage` و `IndexedDB` مع بث التحديثات محلياً عبر `BroadcastChannel` بين التبويبات.
