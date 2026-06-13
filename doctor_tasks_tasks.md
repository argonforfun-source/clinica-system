# خطة تنفيذ مفكرة الطبيب الشخصية (Task Manager)

- [ ] تعديل `emr.html`: تحديث قسم `#inbox` ليحتوي على حقل إدخال (Input) وزر "إضافة مهمة".
- [ ] تعديل `emr.html`: تقسيم قسم المهام إلى قسمين: "المهام المعلقة" (Pending) و "المهام المنجزة" (Completed).
- [ ] تعديل `emr-app.js`: إنشاء دالة `addTask(text)` لحفظ المهمة في Firebase تحت مسار `${BASE}/tasks/${loggedInDoctorId}`.
- [ ] تعديل `emr-app.js`: إنشاء دالة لجلب وعرض المهام `renderTasks(tasksData)` بشكل فوري (Real-time listener).
- [ ] تعديل `emr-app.js`: إنشاء دالة `toggleTask(taskId, isDone)` لتغيير حالة المهمة.
- [ ] تعديل `emr-app.js`: إنشاء دالة `deleteTask(taskId)` لحذف المهمة.
