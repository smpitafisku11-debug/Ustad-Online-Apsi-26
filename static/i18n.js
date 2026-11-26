(function () {
    'use strict';

    const languageStorageKey = 'ustadOnline.interface.language.v1';
    const catalog = {
        'settings.kicker': {
            id: 'PREFERENSI GLOBAL', en: 'GLOBAL PREFERENCES', ar: 'التفضيلات العامة'
        },
        'settings.title': {
            id: 'Pengaturan Belajar', en: 'Learning Settings', ar: 'إعدادات التعلّم'
        },
        'settings.close': {
            id: 'Tutup pengaturan', en: 'Close settings', ar: 'إغلاق الإعدادات'
        },
        'settings.open': {
            id: 'Pengaturan belajar', en: 'Learning settings', ar: 'إعدادات التعلّم'
        },
        'settings.language': {
            id: 'Bahasa antarmuka', en: 'Interface language', ar: 'لغة الواجهة'
        },
        'settings.languageSelect': {
            id: 'Pilih bahasa antarmuka', en: 'Choose interface language', ar: 'اختر لغة الواجهة'
        },
        'settings.languageNote': {
            id: 'Bahasa pilihan diterapkan pada teks antarmuka yang tersedia dan tersimpan di perangkat ini.',
            en: 'Your language applies to available interface text and is saved on this device.',
            ar: 'تُطبّق اللغة المختارة على نصوص الواجهة المتاحة وتُحفظ على هذا الجهاز.'
        },
        'settings.sizeAria': {
            id: 'Ukuran teks Arab dan konten', en: 'Arabic text and content size', ar: 'حجم النص العربي والمحتوى'
        },
        'settings.arabicSize': {
            id: "Ukuran teks Arab & konten Al-Qur'an",
            en: 'Arabic text and Qur’an content size',
            ar: 'حجم النص العربي ومحتوى القرآن'
        },
        'settings.normal': { id: 'Normal', en: 'Regular', ar: 'عادي' },
        'settings.large': { id: 'Besar', en: 'Large', ar: 'كبير' },
        'settings.xlarge': { id: 'Ekstra Besar', en: 'Extra large', ar: 'كبير جدًا' },
        'settings.effectsAndSound': { id: 'Efek dan suara', en: 'Effects and sound', ar: 'المؤثرات والصوت' },
        'settings.sound': { id: 'Efek suara interaktif', en: 'Interactive sound effects', ar: 'المؤثرات الصوتية التفاعلية' },
        'settings.soundDescription': {
            id: 'Bunyi singkat untuk buzzer Quran Battle.',
            en: 'A short sound for the Quran Battle buzzer.',
            ar: 'صوت قصير لجرس مسابقة القرآن.'
        },
        'settings.animations': { id: 'Animasi transisi', en: 'Transition animations', ar: 'حركات الانتقال' },
        'settings.animationsDescription': {
            id: 'Transisi halus di seluruh halaman dan arena.',
            en: 'Smooth transitions across pages and arenas.',
            ar: 'انتقالات سلسة بين الصفحات وساحات اللعب.'
        },
        'settings.reset': { id: 'Pulihkan default', en: 'Restore defaults', ar: 'استعادة الإعدادات الافتراضية' },
        'settings.savedOnDevice': {
            id: 'Tersimpan otomatis di perangkat ini',
            en: 'Saved automatically on this device',
            ar: 'يُحفظ تلقائيًا على هذا الجهاز'
        },
        'status.saved': {
            id: 'Preferensi berhasil disimpan di perangkat ini.',
            en: 'Preferences saved on this device.',
            ar: 'تم حفظ التفضيلات على هذا الجهاز.'
        },
        'status.storageError': {
            id: 'Preferensi tersimpan tidak dapat dibaca. Default digunakan untuk sesi ini.',
            en: 'Saved preferences could not be read. Defaults are being used for this session.',
            ar: 'تعذّرت قراءة التفضيلات المحفوظة. ستُستخدم الإعدادات الافتراضية لهذه الجلسة.'
        },
        'status.saveError': {
            id: 'Pengaturan aktif untuk sesi ini, tetapi tidak dapat disimpan di perangkat.',
            en: 'Settings are active for this session but could not be saved on this device.',
            ar: 'الإعدادات مفعّلة لهذه الجلسة، لكن تعذّر حفظها على هذا الجهاز.'
        },
        'app.brand': { id: 'Ustad Online', en: 'Ustad Online', ar: 'أستاذ أونلاين' },
        'app.home': { id: '← Beranda', en: '← Home', ar: 'الرئيسية ←' },
        'app.backHome': { id: '← Kembali ke beranda', en: '← Back to home', ar: 'العودة إلى الرئيسية ←' },
        'app.searchTeacher': { id: 'Cari pengajar', en: 'Find a teacher', ar: 'ابحث عن معلّم' },
        'app.teacherConnect': { id: 'Ustad Connect', en: 'Teacher Connect', ar: 'تواصل مع المعلّم' },
        'app.teacherPanel': { id: 'Panel Ustad', en: 'Teacher dashboard', ar: 'لوحة المعلّم' },
        'app.adminPanel': { id: 'Panel Admin', en: 'Admin dashboard', ar: 'لوحة الإدارة' },
        'app.admin': { id: 'FAMDI Admin', en: 'FAMDI Admin', ar: 'إدارة FAMDI' },
        'admin.registeredAccounts': { id: 'AKUN TERDAFTAR', en: 'REGISTERED ACCOUNTS', ar: 'الحسابات المسجّلة' },
        'admin.navigation': { id: 'Navigasi admin', en: 'Admin navigation', ar: 'قائمة الإدارة' },
        'admin.studentMode': { id: 'Mode Siswa', en: 'Student mode', ar: 'وضع الطالب' },
        'admin.teacherMode': { id: 'Mode Ustad', en: 'Teacher mode', ar: 'وضع المعلّم' },
        'admin.dashboardNavigation': { id: 'Dashboard', en: 'Dashboard', ar: 'لوحة الإدارة' },
        'admin.homeLink': { id: '← Beranda Ustad Online', en: '← Ustad Online home', ar: 'العودة إلى أستاذ أونلاين ←' },
        'admin.logout': { id: 'Keluar dari akun admin', en: 'Sign out of admin account', ar: 'تسجيل الخروج من حساب الإدارة' },
        'admin.manageApplicationsShortcut': { id: 'Kelola pengajuan', en: 'Manage applications', ar: 'إدارة الطلبات' },
        'admin.pendingApplications': { id: 'pengajuan pending', en: 'pending applications', ar: 'طلبات قيد الانتظار' },
        'admin.statsAria': {
            id: 'Statistik akun dan pengajuan',
            en: 'Account and application statistics',
            ar: 'إحصاءات الحسابات والطلبات'
        },
        'admin.accountReview': {
            id: 'Tinjau identitas dan status akun. Role hanya berubah melalui persetujuan pengajuan.',
            en: 'Review account identities and status. Roles change only after an application is approved.',
            ar: 'راجع هويات الحسابات وحالتها. لا تتغير الأدوار إلا بعد الموافقة على الطلب.'
        },
        'admin.registered': { id: 'Terdaftar', en: 'Registered', ar: 'مسجّل' },
        'admin.profileContact': { id: 'Profil & kontak', en: 'Profile & contact', ar: 'الملف الشخصي وبيانات التواصل' },
        'admin.processed': { id: 'Sudah diproses', en: 'Processed', ar: 'تمت المعالجة' },
        'admin.dashboardIntro': {
            id: 'Ringkasan komunitas dan jalur cepat untuk pemeriksaan aplikasi.',
            en: 'Community overview and quick links for reviewing applications.',
            ar: 'ملخص المجتمع وروابط سريعة لمراجعة الطلبات.'
        },
        'admin.modesTitle': { id: 'Mode Ustad Online', en: 'Ustad Online modes', ar: 'أوضاع أستاذ أونلاين' },
        'admin.previewExplanation': {
            id: 'Buka tampilan siswa atau ustad untuk review UI. Pratinjau tidak memakai akun pengguna dan tidak mengubah role atau data akun.',
            en: 'Open the student or teacher view to review the interface. Preview uses no user account and does not change roles or account data.',
            ar: 'افتح واجهة الطالب أو المعلّم لمراجعة التصميم. لا يستخدم العرض التجريبي حساب مستخدم ولا يغيّر الأدوار أو بيانات الحساب.'
        },
        'admin.studentPreview': {
            id: 'Pratinjau halaman dan fitur belajar · hanya tampilan',
            en: 'Preview learning pages and features · view only',
            ar: 'معاينة صفحات التعلّم وميزاتها · عرض فقط'
        },
        'admin.teacherPreview': {
            id: 'Pratinjau dashboard ustad tanpa akses data pengguna',
            en: 'Preview the teacher dashboard without access to user data',
            ar: 'معاينة لوحة المعلّم دون الوصول إلى بيانات المستخدمين'
        },
        'admin.applicationsShortcut': {
            id: 'Lihat status dan proses calon ustad/ustadzah',
            en: 'Review teacher applicants and their status',
            ar: 'راجع طلبات المعلّمين وحالتها'
        },
        'admin.needsReview': { id: 'Perlu ditinjau', en: 'Needs review', ar: 'بحاجة إلى مراجعة' },
        'admin.pendingExplanation': {
            id: 'Pengajuan yang masih menunggu persetujuan admin.',
            en: 'Applications awaiting admin approval.',
            ar: 'طلبات بانتظار موافقة الإدارة.'
        },
        'admin.applicantProfiles': {
            id: 'Buka daftar lengkap beserta profil pemohon',
            en: 'Open the full list and applicant profiles',
            ar: 'افتح القائمة الكاملة وملفات مقدّمي الطلبات'
        },
        'admin.registeredUserShortcut': {
            id: 'Lihat akun siswa dan pengajar terdaftar',
            en: 'View registered student and teacher accounts',
            ar: 'اعرض حسابات الطلاب والمعلّمين المسجّلة'
        },
        'teacher.adminPreviewNotice': {
            id: 'Mode pratinjau Admin. Data akun Ustad dan tindakan pengelolaan dinonaktifkan.',
            en: 'Admin preview mode. Teacher account data and management actions are disabled.',
            ar: 'وضع معاينة الإدارة. بيانات حساب المعلّم وإجراءات الإدارة معطّلة.'
        },
        'teacher.previewEyebrow': { id: 'PRATINJAU MODE USTAD', en: 'TEACHER MODE PREVIEW', ar: 'معاينة وضع المعلّم' },
        'teacher.greeting': { id: "Assalamu'alaikum,", en: 'Peace be upon you,', ar: 'السلام عليكم،' },
        'teacher.previewIntro': {
            id: 'Periksa tampilan panel pengajar tanpa membuka data siswa atau mengubah pengaturan.',
            en: 'Review the teacher dashboard without exposing student data or changing settings.',
            ar: 'راجع لوحة المعلّم دون الاطلاع على بيانات الطلاب أو تغيير الإعدادات.'
        },
        'teacher.statsAria': { id: 'Ringkasan pengajaran', en: 'Teaching summary', ar: 'ملخص التدريس' },
        'teacher.navAria': { id: 'Menu panel Ustad', en: 'Teacher dashboard navigation', ar: 'قائمة لوحة المعلّم' },
        'teacher.previewOnly': { id: 'Pratinjau saja', en: 'Preview only', ar: 'معاينة فقط' },
        'teacher.signInToManage': {
            id: 'Masuk sebagai akun Ustad untuk mengelola data',
            en: 'Sign in with a teacher account to manage data',
            ar: 'سجّل الدخول بحساب معلّم لإدارة البيانات'
        },
        'teacher.verified': { id: 'Pengajar terverifikasi', en: 'Verified teacher', ar: 'معلّم موثّق' },
        'teacher.verifiedDetails': {
            id: 'Identitas & kompetensi telah diperiksa admin',
            en: 'Identity and qualifications reviewed by an admin',
            ar: 'راجعت الإدارة الهوية والمؤهلات'
        },
        'teacher.verificationPending': {
            id: 'Verifikasi belum selesai',
            en: 'Verification is incomplete',
            ar: 'لم يكتمل التحقق'
        },
        'teacher.bookingDisabled': {
            id: 'Profil belum dapat menerima pemesanan',
            en: 'This profile cannot accept bookings yet',
            ar: 'لا يمكن لهذا الملف الشخصي قبول الحجوزات بعد'
        },
        'teacher.newRequests': { id: 'Permintaan baru', en: 'New requests', ar: 'طلبات جديدة' },
        'teacher.tahfidzReview': { id: 'Setoran hafalan', en: 'Memorisation submissions', ar: 'تسميع الحفظ' },
        'teacher.previewRequests': {
            id: 'Data permintaan hanya tersedia untuk akun Ustad terkait.',
            en: 'Request data is available only to the corresponding teacher account.',
            ar: 'بيانات الطلبات متاحة لحساب المعلّم المعني فقط.'
        },
        'teacher.previewSubmissions': {
            id: 'Data setoran hanya tersedia untuk akun Ustad terkait.',
            en: 'Submission data is available only to the corresponding teacher account.',
            ar: 'بيانات التسميع متاحة لحساب المعلّم المعني فقط.'
        },
        'teacher.previewEvaluations': {
            id: 'Evaluasi hanya tersedia untuk akun Ustad terkait.',
            en: 'Evaluations are available only to the corresponding teacher account.',
            ar: 'التقييمات متاحة لحساب المعلّم المعني فقط.'
        },
        'teacher.awaitingConfirmation': { id: 'Menunggu konfirmasi', en: 'Awaiting confirmation', ar: 'بانتظار التأكيد' },
        'teacher.upcomingSessions': { id: 'Sesi mendatang', en: 'Upcoming sessions', ar: 'الجلسات القادمة' },
        'teacher.confirmed': { id: 'Sudah dikonfirmasi', en: 'Confirmed', ar: 'تم التأكيد' },
        'teacher.completedSessions': { id: 'Sesi selesai', en: 'Completed sessions', ar: 'الجلسات المكتملة' },
        'teacher.evaluationGiven': { id: 'Evaluasi telah diberikan', en: 'Evaluation submitted', ar: 'تم تقديم التقييم' },
        'teacher.availableForStudents': { id: 'Dapat dipilih siswa', en: 'Available to students', ar: 'متاح للطلاب' },
        'teacher.schedule': { id: 'Jadwal mengajar', en: 'Teaching schedule', ar: 'جدول التدريس' },
        'teacher.profile': { id: 'Profil pengajar', en: 'Teacher profile', ar: 'ملف المعلّم' },
        'teacher.sessionManagement': { id: 'MANAJEMEN SESI', en: 'SESSION MANAGEMENT', ar: 'إدارة الجلسات' },
        'teacher.studentGoalReview': { id: 'VALIDASI TARGET SISWA', en: 'STUDENT GOAL REVIEW', ar: 'مراجعة أهداف الطلاب' },
        'teacher.sharedSchedule': { id: 'JADWAL BERSAMA SISWA', en: 'SCHEDULE WITH STUDENTS', ar: 'جدول المواعيد مع الطلاب' },
        'teacher.manageSchedule': { id: 'Kelola jadwal mengajar', en: 'Manage teaching schedule', ar: 'إدارة جدول التدريس' },
        'teacher.previewSchedule': {
            id: 'Jadwal hanya tersedia untuk akun Ustad terkait.',
            en: 'Schedules are available only to the corresponding teacher account.',
            ar: 'الجداول متاحة لحساب المعلّم المعني فقط.'
        },
        'teacher.publicProfile': { id: 'PROFIL PUBLIK PENGAJAR', en: 'PUBLIC TEACHER PROFILE', ar: 'الملف العام للمعلّم' },
        'teacher.manageConnectProfile': {
            id: 'Kelola profil Ustad Connect',
            en: 'Manage Teacher Connect profile',
            ar: 'إدارة ملف تواصل المعلّم'
        },
        'teacher.previewProfileDisabled': {
            id: 'Pengaturan profil tidak dapat diubah dari pratinjau Admin.',
            en: 'Profile settings cannot be changed in Admin preview.',
            ar: 'لا يمكن تغيير إعدادات الملف الشخصي في معاينة الإدارة.'
        },
        'teacher.learningNotes': { id: 'CATATAN PEMBELAJARAN', en: 'LEARNING NOTES', ar: 'ملاحظات التعلّم' },
        'teacher.completeSession': { id: 'Selesaikan sesi', en: 'Complete session', ar: 'إنهاء الجلسة' },
        'teacher.evaluationLabel': {
            id: 'Catatan materi & rekomendasi latihan (10–1000 karakter)',
            en: 'Lesson notes and practice recommendations (10–1,000 characters)',
            ar: 'ملاحظات الدرس وتوصيات التدريب (١٠–١٠٠٠ حرف)'
        },
        'teacher.saveEvaluation': { id: 'Simpan evaluasi', en: 'Save evaluation', ar: 'حفظ التقييم' },
        'app.userManagement': { id: 'Manajemen pengguna', en: 'User management', ar: 'إدارة المستخدمين' },
        'app.applications': { id: 'Pengajuan Ustad', en: 'Teacher applications', ar: 'طلبات المعلّمين' },
        'app.users': { id: 'Pengguna', en: 'User', ar: 'مستخدم' },
        'app.applicant': { id: 'Pemohon', en: 'Applicant', ar: 'مقدّم الطلب' },
        'app.status': { id: 'Status', en: 'Status', ar: 'الحالة' },
        'app.role': { id: 'Role', en: 'Role', ar: 'الدور' },
        'admin.recentAccounts': { id: 'akun terbaru', en: 'most recent accounts', ar: 'أحدث الحسابات' },
        'admin.profileUsernameMissing': {
            id: 'Tanpa username profil',
            en: 'No profile username',
            ar: 'لا يوجد اسم مستخدم للملف الشخصي'
        },
        'admin.teacherRole': { id: 'Ustad', en: 'Teacher', ar: 'معلّم' },
        'admin.studentRole': { id: 'Siswa', en: 'Student', ar: 'طالب' },
        'app.email': { id: 'Email', en: 'Email', ar: 'البريد الإلكتروني' },
        'app.passwordPlaceholder': { id: 'Kata sandi akun', en: 'Account password', ar: 'كلمة مرور الحساب' },
        'app.noProgress': { id: 'Belum ada', en: 'No progress yet', ar: 'لا يوجد تقدّم بعد' },
        'app.xpDevice': { id: 'EXP tersimpan di perangkat', en: 'XP saved on this device', ar: 'نقاط الخبرة محفوظة على هذا الجهاز' },
        'app.prayer': { id: 'Dzikir & Doa', en: 'Dhikr & Du’a', ar: 'الأذكار والأدعية' },
        'app.features': { id: 'Fitur Tambahan', en: 'More features', ar: 'مزايا إضافية' },
        'app.tahfidz': { id: 'Tahfidz & Murajaah', en: 'Qur’an memorisation & review', ar: 'تحفيظ القرآن ومراجعته' },
        'app.battle': { id: 'Quran Battle', en: 'Qur’an Challenge', ar: 'تحدّي القرآن' },
        'app.mushaf': { id: 'MUSHAF DIGITAL', en: 'DIGITAL MUSHAF', ar: 'المصحف الرقمي' },
        'app.academy': { id: 'AKADEMI TILAWAH', en: 'QUR’AN RECITATION ACADEMY', ar: 'أكاديمية التلاوة' },
        'app.learningSettings': { id: 'Pengaturan Belajar', en: 'Learning settings', ar: 'إعدادات التعلّم' },
        'app.login': { id: 'Masuk', en: 'Sign in', ar: 'تسجيل الدخول' },
        'app.register': { id: 'Daftar', en: 'Create account', ar: 'إنشاء حساب' },
        'app.password': { id: 'Kata sandi', en: 'Password', ar: 'كلمة المرور' },
        'app.adminUsername': { id: 'Username admin', en: 'Admin username', ar: 'اسم مستخدم الإدارة' },
        'app.fullName': { id: 'Nama lengkap', en: 'Full name', ar: 'الاسم الكامل' },
        'app.experience': { id: 'Pengalaman mengajar', en: 'Teaching experience', ar: 'الخبرة في التدريس' },
        'app.whatsapp': { id: 'WhatsApp', en: 'WhatsApp', ar: 'واتساب' },
        'app.saveProfile': { id: 'Simpan profil', en: 'Save profile', ar: 'حفظ الملف الشخصي' },
        'app.save': { id: 'Simpan', en: 'Save', ar: 'حفظ' },
        'app.cancel': { id: 'Batal', en: 'Cancel', ar: 'إلغاء' },
        'app.close': { id: 'Tutup', en: 'Close', ar: 'إغلاق' },
        'app.stop': { id: 'Hentikan', en: 'Stop', ar: 'إيقاف' },
        'app.pending': { id: 'pending', en: 'Pending', ar: 'قيد الانتظار' },
        'app.approved': { id: 'approved', en: 'Approved', ar: 'مقبول' },
        'app.rejected': { id: 'rejected', en: 'Rejected', ar: 'مرفوض' },
        'app.approve': { id: 'Terima pengajuan', en: 'Approve application', ar: 'قبول الطلب' },
        'app.reject': { id: 'Tolak pengajuan', en: 'Reject application', ar: 'رفض الطلب' },
        'app.identityCheck': { id: 'Identitas sudah diperiksa', en: 'Identity verified', ar: 'تم التحقق من الهوية' },
        'app.competenceCheck': { id: 'Kompetensi sudah diperiksa', en: 'Qualifications reviewed', ar: 'تمت مراجعة المؤهلات' },
        'app.reason': { id: 'Alasan dan dokumen', en: 'Reason and documents', ar: 'السبب والمستندات' },
        'app.submittedAt': { id: 'Diajukan', en: 'Submitted', ar: 'تاريخ التقديم' },
        'app.reviewAction': { id: 'Tindakan', en: 'Action', ar: 'الإجراء' },
        'app.lifetime': { id: 'Sepanjang waktu', en: 'All time', ar: 'الإجمالي' },
        'app.learnGreeting': {
            id: 'Siap bertumbuh bersama Al-Qur’an hari ini?',
            en: 'Ready to grow with the Qur’an today?',
            ar: 'هل أنت مستعد للنمو مع القرآن اليوم؟'
        },
        'app.learningStats': { id: 'Statistik belajar', en: 'Learning overview', ar: 'ملخص التعلّم' },
        'app.studyNext': { id: 'Lanjutkan Belajar', en: 'Continue learning', ar: 'تابع التعلّم' },
        'app.recommendation': { id: 'Rekomendasi belajar', en: 'Learning recommendation', ar: 'توصية للتعلّم' },
        'app.lessonBasics': { id: "Dasar Al-Qur'an", en: 'Qur’an foundations', ar: 'أساسيات القرآن' },
        'app.recentlyOpened': { id: 'Terakhir dibuka hari ini', en: 'Last opened today', ar: 'آخر ما فُتح اليوم' },
        'page.homeTitle': { id: 'Beranda | Ustad Online', en: 'Home | Ustad Online', ar: 'الرئيسية | أستاذ أونلاين' },
        'page.quranTitle': { id: "Baca Al-Qur'an | Ustad Online", en: 'Read the Qur’an | Ustad Online', ar: 'قراءة القرآن | أستاذ أونلاين' },
        'page.teacherDashboardTitle': { id: 'Panel Ustad | Ustad Online', en: 'Teacher Dashboard | Ustad Online', ar: 'لوحة المعلّم | أستاذ أونلاين' },
        'page.teacherConnectTitle': { id: 'Ustad Connect | Ustad Online', en: 'Teacher Connect | Ustad Online', ar: 'التواصل مع المعلّم | أستاذ أونلاين' },
        'page.teacherReviewTitle': { id: 'Verifikasi Ustad | Ustad Online', en: 'Teacher Verification | Ustad Online', ar: 'التحقق من المعلّم | أستاذ أونلاين' },
        'page.tahfidzTitle': { id: 'Tahfidz & Murajaah | Ustad Online', en: 'Memorisation & Review | Ustad Online', ar: 'الحفظ والمراجعة | أستاذ أونلاين' },
        'tahfidz.kicker': { id: 'JAGA HAFALAN', en: 'KEEP YOUR MEMORISATION STRONG', ar: 'حافظ على حفظك' },
        'tahfidz.intro': {
            id: 'Buat rutinitas hafalan yang teratur. Tandai target hari ini setelah selesai dan ulangi secara konsisten.',
            en: 'Build a steady memorisation routine. Mark today’s goals as complete and review them consistently.',
            ar: 'أنشئ روتينًا منتظمًا للحفظ. علّم أهداف اليوم بعد إتمامها، وداوم على المراجعة.'
        },
        'tahfidz.dailyGoals': { id: 'Target belajar hari ini', en: 'Today’s learning goals', ar: 'أهداف التعلّم اليوم' },
        'tahfidz.progressAria': { id: 'Progres target hafalan hari ini', en: 'Today’s memorisation goal progress', ar: 'تقدّم أهداف الحفظ اليوم' },
        'tahfidz.progressCount': { id: '0 dari 3 target selesai', en: '0 of 3 goals complete', ar: '٠ من ٣ أهداف مكتملة' },
        'tahfidz.progressCountTemplate': {
            id: '{completed} dari {total} target selesai',
            en: '{completed} of {total} goals complete',
            ar: '{completed} من {total} أهداف مكتملة'
        },
        'tahfidz.newMemorisation': { id: 'Hafalan baru', en: 'New memorisation', ar: 'حفظ جديد' },
        'tahfidz.newMemorisationDescription': {
            id: 'Hafalkan beberapa ayat dengan tartil dan pahami maknanya.',
            en: 'Memorise a few verses with care and reflect on their meaning.',
            ar: 'احفظ بضع آيات بترتيل وتدبّر معانيها.'
        },
        'tahfidz.recentReviewDescription': {
            id: 'Ulangi hafalan terakhir tanpa melihat mushaf, lalu cek kembali.',
            en: 'Review your most recent memorisation without looking at the mushaf, then check your accuracy.',
            ar: 'راجع آخر ما حفظت دون النظر في المصحف، ثم تحقّق من إتقانك.'
        },
        'tahfidz.olderReview': { id: 'Murajaah hafalan lama', en: 'Review earlier memorisation', ar: 'مراجعة الحفظ السابق' },
        'tahfidz.olderReviewDescription': {
            id: 'Jaga hafalan sebelumnya dengan pengulangan yang terjadwal.',
            en: 'Maintain earlier memorisation with a regular review schedule.',
            ar: 'ثبّت حفظك السابق بالمراجعة المنتظمة.'
        },
        'tahfidz.quranLink': { id: "Buka Al-Qur'an", en: 'Open the Qur’an', ar: 'افتح القرآن' },
        'tahfidz.communityLink': { id: 'Diskusi di Komunitas', en: 'Discuss in the community', ar: 'ناقش في المجتمع' },
        'tahfidz.resetGoals': { id: 'Atur Ulang Target Hari Ini', en: 'Reset today’s goals', ar: 'أعد ضبط أهداف اليوم' },
        'tahfidz.submissionTitle': { id: 'Bukti setoran hafalan', en: 'Memorisation submission', ar: 'إثبات التسميع' },
        'tahfidz.submissionIntro': {
            id: 'Kirim rekaman target hafalan untuk ditinjau pengajar. Target disetujui hanya setelah status',
            en: 'Submit a recording of your memorisation for teacher review. A goal is counted only when its status is',
            ar: 'أرسل تسجيلًا لتسميع هدف الحفظ لمراجعته من المعلّم. لا يُحتسب الهدف إلا إذا كانت حالته'
        },
        'tahfidz.approved': { id: 'Disetujui', en: 'Approved', ar: 'مقبول' },
        'tahfidz.goalType': { id: 'Jenis target', en: 'Goal type', ar: 'نوع الهدف' },
        'tahfidz.goalToProve': { id: 'Target yang dibuktikan', en: 'Goal being submitted', ar: 'الهدف المراد إثباته' },
        'tahfidz.chooseGoal': { id: 'Pilih target', en: 'Choose a goal', ar: 'اختر هدفًا' },
        'tahfidz.submittedPassage': { id: 'Ayat atau surah yang disetorkan', en: 'Verses or surah submitted', ar: 'الآيات أو السورة المُسمَّعة' },
        'tahfidz.passageExample': { id: 'Contoh: Al-Mulk ayat 1–10', en: 'Example: Al-Mulk, verses 1–10', ar: 'مثال: سورة الملك، الآيات ١–١٠' },
        'tahfidz.titleExample': { id: 'Contoh: Hafalan baru Surah Al-Mulk', en: 'Example: Memorise Surah Al-Mulk', ar: 'مثال: حفظ سورة الملك' },
        'tahfidz.startRecording': { id: 'Mulai Rekam Setoran', en: 'Start recording', ar: 'ابدأ التسجيل' },
        'tahfidz.stopRecording': { id: 'Hentikan Rekaman', en: 'Stop recording', ar: 'أوقف التسجيل' },
        'tahfidz.sendForReview': { id: 'Kirim untuk Ditinjau', en: 'Submit for review', ar: 'أرسل للمراجعة' },
        'tahfidz.signInRequired': {
            id: 'Silakan masuk dengan akun aktif untuk mengirim setoran.',
            en: 'Sign in with an active account to submit a recitation.',
            ar: 'سجّل الدخول بحساب فعّال لإرسال التسميع.'
        },
        'tahfidz.initialStatus': {
            id: 'Masuk dengan akun aktif dan izinkan mikrofon untuk setoran.',
            en: 'Sign in with an active account and allow microphone access to submit a recitation.',
            ar: 'سجّل الدخول بحساب فعّال واسمح باستخدام الميكروفون لإرسال التسميع.'
        },
        'tahfidz.notApproved': {
            id: 'Target ini membutuhkan rekaman setoran yang telah disetujui pengajar.',
            en: 'This goal requires a recitation recording approved by a teacher.',
            ar: 'يتطلب هذا الهدف تسجيل تسميع وافق عليه المعلّم.'
        },
        'tahfidz.noSubmissions': { id: 'Belum ada setoran hafalan.', en: 'No memorisation submissions yet.', ar: 'لا توجد تسجيلات تسميع بعد.' },
        'tahfidz.recordingUnsupported': {
            id: 'Perekaman tidak didukung. Gunakan browser baru melalui HTTPS.',
            en: 'Recording is not supported. Use an up-to-date browser over HTTPS.',
            ar: 'التسجيل غير مدعوم. استخدم متصفحًا حديثًا عبر HTTPS.'
        },
        'tahfidz.mediaRecorderUnsupported': {
            id: 'Browser ini tidak mendukung MediaRecorder.',
            en: 'This browser does not support MediaRecorder.',
            ar: 'هذا المتصفح لا يدعم MediaRecorder.'
        },
        'tahfidz.emptyRecording': { id: 'Rekaman kosong. Coba rekam kembali.', en: 'The recording is empty. Please record again.', ar: 'التسجيل فارغ. أعد التسجيل من فضلك.' },
        'tahfidz.recordingReady': {
            id: 'Rekaman siap dikirim untuk ditinjau pengajar.',
            en: 'Your recording is ready to submit for teacher review.',
            ar: 'التسجيل جاهز للإرسال لمراجعة المعلّم.'
        },
        'tahfidz.recordingInProgress': {
            id: 'Sedang merekam setoran hafalan. Bacalah dengan tartil.',
            en: 'Recording your memorisation. Recite carefully.',
            ar: 'جارٍ تسجيل التسميع. اقرأ بترتيل.'
        },
        'tahfidz.recordFirst': { id: 'Rekam setoran terlebih dahulu.', en: 'Record your recitation first.', ar: 'سجّل التسميع أولًا.' },
        'tahfidz.completeSubmission': {
            id: 'Lengkapi jenis target dan ayat atau surah yang disetorkan.',
            en: 'Complete the goal type and the verses or surah being submitted.',
            ar: 'أكمل نوع الهدف والآيات أو السورة المُسمَّعة.'
        },
        'tahfidz.fileTooLarge': {
            id: 'Rekaman melebihi batas 3 MB. Rekam ulang dengan durasi lebih singkat.',
            en: 'The recording exceeds the 3 MB limit. Record a shorter clip.',
            ar: 'يتجاوز التسجيل حد ٣ ميغابايت. أعد التسجيل بمدة أقصر.'
        },
        'tahfidz.readError': {
            id: 'Target tersimpan tidak dapat dibaca; perubahan hanya berlaku selama halaman terbuka.',
            en: 'Saved goals could not be read; changes only apply while this page remains open.',
            ar: 'تعذّرت قراءة الأهداف المحفوظة؛ وتُطبّق التغييرات ما دامت هذه الصفحة مفتوحة.'
        },
        'tahfidz.savedStatus': { id: 'Progres target tersimpan di browser ini.', en: 'Goal progress is saved in this browser.', ar: 'حُفظ تقدّم الأهداف في هذا المتصفح.' },
        'tahfidz.saveError': {
            id: 'Penyimpanan browser tidak tersedia; perubahan hanya berlaku selama halaman terbuka.',
            en: 'Browser storage is unavailable; changes only apply while this page remains open.',
            ar: 'مساحة التخزين في المتصفح غير متاحة؛ وتُطبّق التغييرات ما دامت هذه الصفحة مفتوحة.'
        },
        'prayer.backHome': { id: 'Kembali ke Beranda', en: 'Back to home', ar: 'العودة إلى الرئيسية' },
        'prayer.heroKicker': { id: 'JEDA SEJENAK, INGAT ALLAH', en: 'PAUSE AND REMEMBER ALLAH', ar: 'توقّف قليلًا واذكر الله' },
        'prayer.intro': {
            id: 'Kumpulan dzikir pilihan pagi-petang, setelah salat, dan doa sehari-hari. Baca dengan tenang, pahami maknanya, dan ikuti jumlah pengulangan yang tertera.',
            en: 'A selection of morning and evening remembrances, post-prayer dhikr, and daily supplications. Recite calmly, reflect on the meaning, and follow the stated repetitions.',
            ar: 'مجموعة مختارة من أذكار الصباح والمساء وما بعد الصلاة والأدعية اليومية. اقرأ بهدوء، وتدبّر المعنى، والتزم بعدد التكرار المحدد.'
        },
        'prayer.savedNote': { id: 'Progres bacaan tersimpan di perangkat ini.', en: 'Your recitation progress is saved on this device.', ar: 'يُحفظ تقدّم القراءة على هذا الجهاز.' },
        'prayer.progressAria': { id: 'Progres bacaan hari ini', en: 'Today’s recitation progress', ar: 'تقدّم القراءة اليوم' },
        'prayer.progressToday': { id: 'PROGRES HARI INI', en: 'TODAY’S PROGRESS', ar: 'تقدّم اليوم' },
        'prayer.progressCountTemplate': {
            id: '{completed} dari {total} dzikir/doa selesai',
            en: '{completed} of {total} remembrances/supplications completed',
            ar: 'اكتمل {completed} من أصل {total} من الأذكار والأدعية'
        },
        'prayer.reset': { id: 'Atur ulang', en: 'Reset', ar: 'إعادة الضبط' },
        'prayer.choosePractice': { id: 'PILIH AMALAN', en: 'CHOOSE A PRACTICE', ar: 'اختر وردًا' },
        'prayer.guide': { id: 'Panduan dzikir dan doa', en: 'Dhikr and supplication guide', ar: 'دليل الأذكار والأدعية' },
        'prayer.searchLabel': { id: 'Cari dzikir atau doa', en: 'Search remembrances or supplications', ar: 'ابحث عن ذكر أو دعاء' },
        'prayer.searchPlaceholder': {
            id: 'Contoh: doa orang tua, setelah salat...',
            en: 'For example: a prayer for parents, after prayer...',
            ar: 'مثال: دعاء الوالدين، بعد الصلاة...'
        },
        'prayer.filterAria': { id: 'Filter kategori dzikir dan doa', en: 'Filter dhikr and supplication categories', ar: 'تصفية فئات الأذكار والأدعية' },
        'prayer.filterAll': { id: 'Semua', en: 'All', ar: 'الكل' },
        'prayer.filterMorning': { id: 'Al-Ma’tsurat · Pagi/Petang', en: 'Al-Ma’thurat · Morning/Evening', ar: 'المأثورات · الصباح والمساء' },
        'prayer.filterAfterPrayer': { id: 'Setelah salat', en: 'After prayer', ar: 'بعد الصلاة' },
        'prayer.filterDaily': { id: 'Doa harian', en: 'Daily supplications', ar: 'أدعية يومية' },
        'prayer.categoryMorning': { id: 'Pagi & petang · pilihan Al-Ma’tsurat', en: 'Morning & evening · selected Al-Ma’thurat', ar: 'الصباح والمساء · مختارات المأثورات' },
        'prayer.categoryAfterPrayer': { id: 'Dzikir setelah salat', en: 'After-prayer dhikr', ar: 'أذكار ما بعد الصلاة' },
        'prayer.categoryDaily': { id: 'Doa sehari-hari', en: 'Daily supplications', ar: 'أدعية يومية' },
        'prayer.selectionNote': {
            id: 'Bagian Al-Ma’tsurat di sini adalah pilihan dzikir pagi-petang, bukan keseluruhan susunan wirid Al-Ma’tsurat.',
            en: 'The Al-Ma’thurat section here is a selection of morning and evening remembrances, not the complete Al-Ma’thurat litany.',
            ar: 'قسم المأثورات هنا مختارات من أذكار الصباح والمساء، وليس كامل ترتيب ورد المأثورات.'
        },
        'prayer.notFound': {
            id: 'Tidak ditemukan. Coba kata kunci atau kategori lain.',
            en: 'No results found. Try another search term or category.',
            ar: 'لم تُعثر على نتائج. جرّب كلمة بحث أو فئة أخرى.'
        },
        'prayer.sourceNote': {
            id: 'Rujukan dicantumkan per bacaan. Untuk hafalan dan ketepatan pelafalan, cocokkan dengan mushaf atau guru. Terjemahan disajikan sebagai makna ringkas.',
            en: 'References are listed for each recitation. For memorisation and accurate pronunciation, consult a mushaf or teacher. Translations are concise renderings of meaning.',
            ar: 'تُذكر المراجع مع كل قراءة. راجع المصحف أو معلّمًا لضبط الحفظ والنطق. وتُعرض الترجمات بإيجاز للمعنى.'
        },
        'prayer.increment': { id: '+1 bacaan', en: '+1 recitation', ar: '+١ تلاوة' },
        'prayer.markComplete': { id: 'Tandai selesai', en: 'Mark complete', ar: 'علّم كمكتمل' },
        'prayer.completed': { id: 'Selesai', en: 'Completed', ar: 'مكتمل' },
        'prayer.counterAriaTemplate': {
            id: '{count} dari {total} bacaan',
            en: '{count} of {total} recitations',
            ar: '{count} من {total} تلاوات'
        },
        'prayer.title.morning-name-protection': { id: 'Perlindungan dengan nama Allah', en: 'Seeking protection through Allah’s name', ar: 'التحصّن باسم الله' },
        'prayer.title.morning-contentment': { id: 'Ridha kepada Allah, Islam, dan Nabi', en: 'Contentment with Allah, Islam, and the Prophet', ar: 'الرضا بالله ربًا وبالإسلام دينًا وبمحمد نبيًا' },
        'prayer.title.morning-day-cycle': { id: 'Dzikir pagi', en: 'Morning remembrance', ar: 'ذكر الصباح' },
        'prayer.title.morning-ikhlas': { id: 'Surah Al-Ikhlas', en: 'Surah Al-Ikhlas', ar: 'سورة الإخلاص' },
        'prayer.title.morning-falaq': { id: 'Surah Al-Falaq', en: 'Surah Al-Falaq', ar: 'سورة الفلق' },
        'prayer.title.morning-nas': { id: 'Surah An-Nas', en: 'Surah An-Nas', ar: 'سورة الناس' },
        'prayer.title.after-prayer-istighfar': { id: 'Memohon ampun setelah salam', en: 'Seeking forgiveness after salām', ar: 'الاستغفار بعد السلام' },
        'prayer.title.after-prayer-peace': { id: 'Doa setelah istighfar', en: 'Supplication after seeking forgiveness', ar: 'دعاء بعد الاستغفار' },
        'prayer.title.after-prayer-tasbih': { id: 'Tasbih', en: 'Tasbīḥ', ar: 'التسبيح' },
        'prayer.title.after-prayer-tahmid': { id: 'Tahmid', en: 'Taḥmīd', ar: 'التحميد' },
        'prayer.title.after-prayer-takbir': { id: 'Takbir', en: 'Takbīr', ar: 'التكبير' },
        'prayer.title.after-prayer-tahlil': { id: 'Penutup dzikir setelah salat', en: 'Closing remembrance after prayer', ar: 'خاتمة أذكار الصلاة' },
        'prayer.title.daily-parents': { id: 'Doa untuk kedua orang tua', en: 'Supplication for both parents', ar: 'دعاء للوالدين' },
        'prayer.title.daily-knowledge': { id: 'Memohon tambahan ilmu', en: 'Asking for an increase in knowledge', ar: 'دعاء لزيادة العلم' },
        'prayer.title.daily-eating': { id: 'Sebelum makan', en: 'Before eating', ar: 'قبل الطعام' },
        'prayer.title.daily-after-eating': { id: 'Setelah makan', en: 'After eating', ar: 'بعد الطعام' },
        'prayer.title.daily-sleep': { id: 'Sebelum tidur', en: 'Before sleep', ar: 'قبل النوم' },
        'prayer.title.daily-home': { id: 'Keluar rumah', en: 'Leaving home', ar: 'الخروج من المنزل' },
        'page.battleTitle': { id: 'Quran Battle Arena | Ustad Online', en: 'Qur’an Challenge Arena | Ustad Online', ar: 'ساحة تحدّي القرآن | أستاذ أونلاين' },
        'page.extraTitle': { id: 'Fitur Tambahan | Ustad Online', en: 'More Features | Ustad Online', ar: 'ميزات إضافية | أستاذ أونلاين' },
        'page.academyTitle': { id: 'Akademi Tilawah | Ustad Online', en: 'Recitation Academy | Ustad Online', ar: 'أكاديمية التلاوة | أستاذ أونلاين' },
        'academy.backHome': { id: 'Kembali ke Ustad Online', en: 'Back to Ustad Online', ar: 'العودة إلى أستاذ أونلاين' },
        'academy.breadcrumb': { id: 'Beranda', en: 'Home', ar: 'الرئيسية' },
        'academy.eyebrow': { id: 'AKADEMI TILAWAH', en: 'QUR’AN RECITATION ACADEMY', ar: 'أكاديمية التلاوة' },
        'academy.heroTitleOne': { id: 'Baca dengan yakin.', en: 'Read with confidence.', ar: 'اقرأ بثقة.' },
        'academy.heroTitleTwo': { id: 'Belajar setahap demi setahap.', en: 'Learn one step at a time.', ar: 'تعلّم خطوةً بعد خطوة.' },
        'academy.heroDescription': {
            id: 'Dari mengenal huruf hingga memahami tajwid. Pilih tingkatmu, dengarkan contoh, lalu berlatih dengan ritmemu sendiri.',
            en: 'From recognising letters to understanding tajwid. Choose your level, listen to examples, and practise at your own pace.',
            ar: 'من التعرّف على الحروف إلى فهم التجويد. اختر مستواك، واستمع إلى الأمثلة، ثم تدرّب وفق وتيرتك.'
        },
        'academy.viewPath': { id: 'Lihat jalur belajarku', en: 'View my learning path', ar: 'اعرض مساري التعليمي' },
        'academy.artCaption': { id: 'ILMU YANG DIBACA,', en: 'KNOWLEDGE TO RECITE,', ar: 'عِلْمٌ يُتْلَى،' },
        'academy.artCaptionSecond': { id: 'HATI YANG BERTUMBUH', en: 'A HEART THAT GROWS', ar: 'وَقَلْبٌ يَنْمُو' },
        'academy.progressLabel': { id: 'Progres belajar', en: 'Learning progress', ar: 'تقدّم التعلّم' },
        'academy.progressBarAria': { id: 'Progres Akademi Tilawah', en: 'Recitation academy progress', ar: 'تقدّم أكاديمية التلاوة' },
        'academy.journey': { id: 'PERJALANANMU', en: 'YOUR JOURNEY', ar: 'رحلتك التعليمية' },
        'academy.progressTitle': { id: 'Pelan-pelan, yang penting berlanjut.', en: 'Take it slowly; keep going.', ar: 'تمهّل، المهم أن تواصل.' },
        'academy.progressCount': { id: '0 dari 7 bagian', en: '0 of 7 sections', ar: '٠ من ٧ أقسام' },
        'academy.progressNote': {
            id: 'Mulai dari materi yang paling dasar. Progres tersimpan di perangkat ini.',
            en: 'Start with the fundamentals. Your progress is saved on this device.',
            ar: 'ابدأ بالأساسيات. يُحفظ تقدّمك على هذا الجهاز.'
        },
        'academy.chooseLevel': { id: 'Pilih tingkat belajar', en: 'Choose a learning level', ar: 'اختر مستوى التعلّم' },
        'academy.learningPath': { id: 'JALUR BELAJAR', en: 'LEARNING PATH', ar: 'مسار التعلّم' },
        'academy.chooseStart': { id: 'Kamu ingin mulai dari mana?', en: 'Where would you like to begin?', ar: 'من أين تودّ أن تبدأ؟' },
        'academy.chooseLevelHelp': {
            id: 'Pilih tingkat yang paling nyaman. Kamu tetap bisa membuka semua materi.',
            en: 'Choose the level that feels right. You can still access every lesson.',
            ar: 'اختر المستوى الأنسب لك، ويمكنك الوصول إلى جميع الدروس.'
        },
        'academy.beginner': { id: 'Pemula', en: 'Beginner', ar: 'مبتدئ' },
        'academy.beginnerHelp': { id: 'Mulai dari huruf dan bunyi', en: 'Start with letters and sounds', ar: 'ابدأ بالحروف والأصوات' },
        'academy.intermediate': { id: 'Menengah', en: 'Intermediate', ar: 'متوسط' },
        'academy.intermediateHelp': { id: 'Perkuat bacaan dan tajwid', en: 'Strengthen recitation and tajwid', ar: 'عزّز التلاوة والتجويد' },
        'academy.advanced': { id: 'Lanjutan', en: 'Advanced', ar: 'متقدّم' },
        'academy.advancedHelp': { id: 'Latihan lebih teliti dan terarah', en: 'Practise with greater precision and structure', ar: 'تدرّب بمزيد من الدقة والتنظيم' },
        'academy.beginnerPath': { id: 'Jalur Pemula', en: 'Beginner path', ar: 'مسار المبتدئين' },
        'academy.beginnerDescription': {
            id: 'Kenali bentuk dan bunyi, lalu bangun fondasi bacaanmu dengan tenang.',
            en: 'Learn the letter forms and sounds, then build your reading foundation steadily.',
            ar: 'تعرّف على أشكال الحروف وأصواتها، ثم ابنِ أساس القراءة بهدوء.'
        },
        'academy.curriculum': { id: 'KURIKULUM', en: 'CURRICULUM', ar: 'المنهج' },
        'academy.lessonCount': { id: '7 langkah menuju tilawah', en: '7 steps to better recitation', ar: '٧ خطوات نحو تلاوة أفضل' },
        'academy.studyAtYourPace': { id: 'Belajar sesuai waktumu', en: 'Learn at your own pace', ar: 'تعلّم وفق وقتك' },
        'academy.lessonStart': { id: 'Mulai', en: 'Start', ar: 'ابدأ' },
        'academy.hijaiyah': { id: 'Huruf Hijaiyah', en: 'Arabic letters', ar: 'الحروف الهجائية' },
        'academy.hijaiyahDescription': { id: 'Bentuk, nama, bunyi, dan contoh pelafalan.', en: 'Letter forms, names, sounds, and pronunciation examples.', ar: 'أشكال الحروف وأسماؤها وأصواتها وأمثلة على نطقها.' },
        'academy.harakat': { id: 'Harakat & Tanda Baca', en: 'Vowel marks & signs', ar: 'الحركات وعلامات الضبط' },
        'academy.harakatDescription': { id: 'Fathah, kasrah, dammah, sukun, dan lainnya.', en: 'Fathah, kasrah, dammah, sukun, and more.', ar: 'الفتحة والكسرة والضمة والسكون وغيرها.' },
        'academy.makharij': { id: 'Makharijul Huruf', en: 'Articulation points', ar: 'مخارج الحروف' },
        'academy.makharijDescription': { id: 'Tempat keluarnya huruf: rongga, tenggorokan, lidah, dan bibir.', en: 'Where letters are articulated: the oral cavity, throat, tongue, and lips.', ar: 'مواضع خروج الحروف: الجوف والحلق واللسان والشفتان.' },
        'academy.sifat': { id: 'Sifat Huruf', en: 'Letter characteristics', ar: 'صفات الحروف' },
        'academy.sifatDescription': { id: 'Karakter bunyi yang membedakan satu huruf dari lainnya.', en: 'Sound qualities that distinguish one letter from another.', ar: 'الصفات الصوتية التي تميّز حرفًا عن آخر.' },
        'academy.tajwid': { id: 'Hukum Tajwid', en: 'Tajwid rules', ar: 'أحكام التجويد' },
        'academy.tajwidDescription': { id: 'Nun sukun, mim sukun, mad, qalqalah, dan lainnya.', en: 'Rules for nūn sākinah, mīm sākinah, madd, qalqalah, and more.', ar: 'أحكام النون الساكنة والميم الساكنة والمدّ والقلقلة وغيرها.' },
        'academy.waqaf': { id: 'Waqaf & Ibtida', en: 'Stopping & resuming', ar: 'الوقف والابتداء' },
        'academy.waqafDescription': { id: 'Memahami kapan berhenti dan memulai kembali bacaan.', en: 'Learn when to pause and resume your recitation.', ar: 'تعلّم مواضع الوقف واستئناف التلاوة.' },
        'academy.practiceTitle': { id: 'Latihan Pelafalan Dasar', en: 'Basic pronunciation practice', ar: 'تدريب أساسي على النطق' },
        'academy.practiceDescription': { id: 'Rekam bacaan dan bandingkan kata dengan teks mushaf.', en: 'Record your recitation and compare the words with the mushaf text.', ar: 'سجّل تلاوتك وقارن الكلمات بنص المصحف.' },
        'academy.openPractice': { id: 'Buka latihan', en: 'Open practice', ar: 'افتح التدريب' },
        'academy.assessment': { id: 'Evaluasi Pemahaman', en: 'Knowledge check', ar: 'تقييم الفهم' },
        'academy.assessmentDescription': { id: 'Ukur pemahaman dan dapatkan saran materi berikutnya.', en: 'Check your understanding and get a suggestion for what to learn next.', ar: 'قيّم فهمك واحصل على اقتراح للدرس التالي.' },
        'academy.evaluate': { id: 'Evaluasi', en: 'Assess', ar: 'قيّم' },
        'academy.studyNote': { id: 'CATATAN BELAJAR', en: 'LEARNING NOTE', ar: 'ملاحظة تعليمية' },
        'academy.takeYourTime': { id: 'Tak perlu terburu-buru.', en: 'There is no need to rush.', ar: 'لا داعي للعجلة.' },
        'academy.studyNoteBody': {
            id: 'Dengarkan contoh, tirukan perlahan, lalu tandai materi setelah selesai. Mengulang adalah bagian dari belajar.',
            en: 'Listen to an example, repeat it slowly, then mark the lesson complete. Repetition is part of learning.',
            ar: 'استمع إلى المثال وكرّره ببطء، ثم علّم الدرس بعد إتمامه. فالتكرار جزء من التعلّم.'
        },
        'academy.audioNote': {
            id: 'Contoh audio memakai bacaan Mushaf oleh Misyari Rasyid Al-Afasi; koreksi makhraj tetap perlu bimbingan guru.',
            en: 'Audio examples use Mushaf recitation by Mishary Rashid Alafasy; a teacher is still needed for makhraj correction.',
            ar: 'تستخدم الأمثلة الصوتية تلاوة مشاري راشد العفاسي؛ ويظل تصحيح المخارج بحاجة إلى توجيه معلّم.'
        },
        'academy.footer': {
            id: "Belajar Al-Qur'an, setahap demi setahap.",
            en: 'Learn the Qur’an, one step at a time.',
            ar: 'تعلّم القرآن خطوةً بعد خطوة.'
        },
        'page.dhikrTitle': { id: 'Dzikir & Doa | Ustad Online', en: 'Dhikr & Du’a | Ustad Online', ar: 'الأذكار والأدعية | أستاذ أونلاين' },
        'page.practiceTitle': { id: 'Latihan Pelafalan | Akademi Tilawah', en: 'Pronunciation Practice | Recitation Academy', ar: 'تدريب النطق | أكاديمية التلاوة' },
        'page.communityTitle': { id: 'Komunitas Grup | Ustad Online', en: 'Community Groups | Ustad Online', ar: 'مجموعات المجتمع | أستاذ أونلاين' },
        'home.reminders': { id: 'Notifikasi pengingat', en: 'Reminder notifications', ar: 'إشعارات التذكير' },
        'home.reminderActive': { id: 'Pengingat aktif', en: 'Reminder active', ar: 'التذكير مفعّل' },
        'home.qibla': { id: 'Kompas arah kiblat', en: 'Qibla compass', ar: 'بوصلة القبلة' },
        'home.profileAria': { id: 'Profil pengguna', en: 'User profile', ar: 'الملف الشخصي للمستخدم' },
        'home.learningStats': { id: 'Statistik belajar', en: 'Learning statistics', ar: 'إحصاءات التعلّم' },
        'home.mobileNav': { id: 'Navigasi mobile', en: 'Mobile navigation', ar: 'التنقّل على الهاتف' },
        'home.homeLink': { id: 'Ustad Online, beranda', en: 'Ustad Online, home', ar: 'أستاذ أونلاين، الرئيسية' },
        'home.loginOrProfile': { id: 'Login atau profil pengguna', en: 'Sign in or user profile', ar: 'تسجيل الدخول أو الملف الشخصي' },
        'profile.chooseAccount': { id: 'Pilih jenis akun', en: 'Choose an account type', ar: 'اختر نوع الحساب' },
        'profile.chooseProcess': { id: 'Pilih proses akun', en: 'Choose an account action', ar: 'اختر الإجراء المطلوب للحساب' },
        'profile.brandTitle': { id: "Dekat dengan Qur'an, tumbuh setiap hari.", en: 'Grow closer to the Qur’an, one day at a time.', ar: 'اقترب من القرآن وانمُ كل يوم.' },
        'profile.brandDescription': {
            id: 'Ruang kecilmu untuk membaca, menghafal, dan memperbaiki tilawah—dimulai dari sini.',
            en: 'A personal space to read, memorise, and improve your recitation—start here.',
            ar: 'مساحتك الخاصة للقراءة والحفظ وتحسين التلاوة—ابدأ من هنا.'
        },
        'profile.brandTag': { id: 'Belajar dengan hati', en: 'Learn with heart', ar: 'تعلّم بقلب حاضر' },
        'profile.stepLabel': { id: 'LANGKAH 01', en: 'STEP 01', ar: 'الخطوة ٠١' },
        'profile.stepSection': { id: 'PROFIL BELAJAR', en: 'LEARNING PROFILE', ar: 'الملف التعليمي' },
        'profile.accountSignInIntro': {
            id: 'Masuk dengan akun Siswa yang sudah terdaftar.',
            en: 'Sign in with your registered student account.',
            ar: 'سجّل الدخول بحساب الطالب المسجّل لديك.'
        },
        'profile.studentGrowth': { id: 'Belajar & berkembang', en: 'Learn & grow', ar: 'تعلّم وتطوّر' },
        'profile.teacherApplication': { id: 'Ajukan sebagai pengajar', en: 'Apply to teach', ar: 'قدّم طلبًا للتدريس' },
        'profile.adminReview': { id: 'Review & pratinjau', en: 'Review & preview', ar: 'المراجعة والمعاينة' },
        'profile.signIn': { id: 'Masuk', en: 'Sign in', ar: 'تسجيل الدخول' },
        'profile.register': { id: 'Daftar', en: 'Register', ar: 'إنشاء حساب' },
        'profile.fullName': { id: 'Nama lengkap', en: 'Full name', ar: 'الاسم الكامل' },
        'profile.adminUsername': { id: 'Username admin', en: 'Admin username', ar: 'اسم مستخدم الإدارة' },
        'profile.whatsapp': { id: 'Nomor WhatsApp aktif', en: 'Active WhatsApp number', ar: 'رقم واتساب فعّال' },
        'profile.teachingExperience': { id: 'Pengalaman mengajar', en: 'Teaching experience', ar: 'الخبرة في التدريس' },
        'profile.experiencePlaceholder': {
            id: 'Ceritakan pengalaman dan bidang yang diajarkan',
            en: 'Describe your experience and teaching subjects',
            ar: 'اذكر خبرتك والمواد التي تدرّسها'
        },
        'profile.passwordPlaceholder': { id: 'Minimal 8 karakter', en: 'At least 8 characters', ar: '٨ أحرف على الأقل' },
        'profile.teacherReviewNote': {
            id: 'Pengajuan ustad akan ditinjau admin melalui email dan WhatsApp. Akun belum bisa digunakan sebagai ustad sebelum disetujui.',
            en: 'Teacher applications are reviewed by an admin through email and WhatsApp. The teacher account cannot be used until it is approved.',
            ar: 'يراجع المسؤول طلبات المعلّمين عبر البريد الإلكتروني وواتساب. لا يمكن استخدام الحساب بصفة معلّم حتى تتم الموافقة عليه.'
        },
        'profile.studentActiveNote': {
            id: 'Siswa langsung aktif. Akun ustad perlu verifikasi admin.',
            en: 'Student accounts are active immediately. Teacher accounts require admin approval.',
            ar: 'يُفعّل حساب الطالب فورًا، بينما يحتاج حساب المعلّم إلى موافقة الإدارة.'
        },
        'profile.submitStudent': { id: 'Masuk sebagai Siswa', en: 'Sign in as a student', ar: 'الدخول بصفة طالب' },
        'profile.submitTeacher': { id: 'Masuk sebagai Ustad', en: 'Sign in as a teacher', ar: 'الدخول بصفة معلّم' },
        'profile.submitAdmin': { id: 'Masuk sebagai Admin', en: 'Sign in as an admin', ar: 'الدخول بصفة مسؤول' },
        'profile.registerStudent': { id: 'Buat akun Siswa', en: 'Create a student account', ar: 'أنشئ حساب طالب' },
        'profile.submitTeacherApplication': { id: 'Kirim pengajuan Ustad', en: 'Submit teacher application', ar: 'أرسل طلب الانضمام معلّمًا' },
        'status.checkingAccount': { id: 'Memeriksa data akun...', en: 'Checking account details...', ar: 'جارٍ التحقق من بيانات الحساب...' },
        'status.serverUnavailable': {
            id: 'Tidak dapat terhubung ke server. Pastikan aplikasi masih berjalan lalu muat ulang halaman.',
            en: 'Could not connect to the server. Make sure the app is running, then reload the page.',
            ar: 'تعذّر الاتصال بالخادم. تأكد من أن التطبيق يعمل ثم أعد تحميل الصفحة.'
        },
        'app.startLearning': { id: 'Mulai Belajar', en: 'Start learning', ar: 'ابدأ التعلّم' },
        'app.homeGreeting': { id: 'Assalamualaikum,', en: 'Peace be upon you,', ar: 'السلام عليكم،' },
        'app.homePrompt': {
            id: 'Siap bertumbuh bersama Al-Qur’an hari ini?',
            en: 'Ready to grow with the Qur’an today?',
            ar: 'هل أنت مستعد للنمو مع القرآن اليوم؟'
        },
        'app.homePromptAscii': {
            id: "Siap bertumbuh bersama Al-Qur'an hari ini?",
            en: 'Ready to grow with the Qur’an today?',
            ar: 'هل أنت مستعد للنمو مع القرآن اليوم؟'
        },
        'app.learningSpace': { id: 'RUANG BELAJAR AL-QUR’AN', en: 'QUR’AN LEARNING SPACE', ar: 'مساحة تعلّم القرآن' },
        'app.learningSpaceAscii': { id: "RUANG BELAJAR AL-QUR'AN", en: 'QUR’AN LEARNING SPACE', ar: 'مساحة تعلّم القرآن' },
        'app.level': { id: 'LEVEL', en: 'LEVEL', ar: 'المستوى' },
        'app.totalExp': { id: 'TOTAL EXP', en: 'TOTAL XP', ar: 'إجمالي النقاط' },
        'app.streak': { id: 'STREAK', en: 'STREAK', ar: 'سلسلة التعلّم' },
        'app.days': { id: 'hari', en: 'days', ar: 'أيام' },
        'app.activeLearningDays': { id: 'Hari aktif belajar', en: 'Active learning days', ar: 'أيام التعلّم النشط' },
        'app.featuresAvailable': { id: 'fitur tersedia', en: 'features available', ar: 'ميزات متاحة' },
        'app.readQuranCard': { id: "Baca Al-Qur'an", en: 'Read the Qur’an', ar: 'اقرأ القرآن' },
        'app.readQuranDescription': { id: 'Membaca & mendengarkan audio', en: 'Read and listen to recitation', ar: 'القراءة والاستماع إلى التلاوة' },
        'app.academyDescription': { id: 'Belajar dasar & tajwid', en: 'Learn the fundamentals of tajwid', ar: 'تعلّم أساسيات التجويد' },
        'app.connect': { id: 'Ustad Connect', en: 'Teacher Connect', ar: 'التواصل مع المعلّم' },
        'app.teacherGuidance': { id: 'Bimbingan dengan ustaz/ustazah', en: 'Guidance from a qualified teacher', ar: 'إرشاد من معلّم مؤهل' },
        'app.teacherPanelDescription': { id: 'Jadwal, permintaan, dan evaluasi siswa', en: 'Schedules, requests, and student assessments', ar: 'المواعيد والطلبات وتقييمات الطلاب' },
        'app.adminPanelDescription': { id: 'Review pengajuan dan moderasi', en: 'Review applications and moderate content', ar: 'مراجعة الطلبات والإشراف' },
        'app.tahfidzDescription': { id: 'Target hafalan & murajaah', en: 'Memorisation and review goals', ar: 'أهداف الحفظ والمراجعة' },
        'app.dzikir': { id: 'Dzikir & Doa', en: 'Dhikr & Du’a', ar: 'الأذكار والأدعية' },
        'app.dzikirDescription': { id: 'Al-Ma’tsurat, dzikir salat, dan doa harian', en: 'Al-Ma’thurat, prayer remembrances, and daily supplications', ar: 'المأثورات وأذكار الصلاة والأدعية اليومية' },
        'app.battleDescription': { id: 'Latihan bersama yang mengutamakan ketepatan bacaan.', en: 'A shared practice focused on accurate recitation.', ar: 'تدريب جماعي يركّز على دقة التلاوة.' },
        'app.communityDescription': { id: 'Diskusi & kelas digital terarah', en: 'Focused discussions and online classes', ar: 'نقاشات ودروس رقمية هادفة' },
        'app.extraFeatures': { id: 'Fitur Tambahan', en: 'More features', ar: 'ميزات إضافية' },
        'app.extraFeaturesDescription': { id: 'Pengingat, offline, planner & aksesibilitas', en: 'Reminders, offline access, planner, and accessibility', ar: 'التذكيرات والعمل دون اتصال والتخطيط وإمكانية الوصول' },
        'app.recentProgress': { id: 'PROGRES TERAKHIR', en: 'RECENT PROGRESS', ar: 'أحدث التقدّم' },
        'app.continueLearning': { id: 'Lanjutkan Belajar', en: 'Continue learning', ar: 'تابع التعلّم' },
        'app.lastOpenedToday': { id: 'Terakhir dibuka hari ini', en: 'Last opened today', ar: 'آخر ما فُتح اليوم' },
        'app.currentlyLearning': { id: 'Sedang dipelajari', en: 'In progress', ar: 'قيد التعلّم' },
        'app.tajwidBasics': { id: 'Belajar Tajwid Dasar', en: 'Tajwid Fundamentals', ar: 'أساسيات التجويد' },
        'app.tajwidDescription': { id: 'Kenali hukum bacaan untuk tilawah yang lebih tepat.', en: 'Learn the recitation rules for more accurate tilawah.', ar: 'تعرّف على أحكام التلاوة لتحسين دقتها.' },
        'app.beginLearning': { id: 'Mulai Belajar', en: 'Start learning', ar: 'ابدأ التعلّم' },
        'app.footerMotto': { id: "Belajar Al-Qur'an, selangkah demi selangkah.", en: 'Learn the Qur’an, one step at a time.', ar: 'تعلّم القرآن خطوةً بعد خطوة.' },
        'app.studyTogether': { id: 'Belajar Al-Qur’an, selangkah demi selangkah.', en: 'Learn the Qur’an, one step at a time.', ar: 'تعلّم القرآن خطوةً بعد خطوة.' },
        'app.school': { id: 'Menu Utama', en: 'Main menu', ar: 'القائمة الرئيسية' },
        'app.explore': { id: 'JELAJAHI', en: 'EXPLORE', ar: 'استكشف' },
        'app.dailyTarget': { id: 'TARGET HARIAN', en: 'DAILY GOAL', ar: 'الهدف اليومي' },
        'app.hafalan': { id: 'Target Hafalan & Murajaah', en: 'Memorisation & review goals', ar: 'أهداف الحفظ والمراجعة' },
        'app.dailyMissions': { id: 'Misi hari ini', en: 'Today’s goals', ar: 'أهداف اليوم' },
        'app.profile': { id: 'Profil & Dashboard Perkembangan', en: 'Profile & learning progress', ar: 'الملف الشخصي وتقدّم التعلّم' },
        'app.updateProfile': { id: 'Perbarui profilmu', en: 'Update your profile', ar: 'حدّث ملفك الشخصي' },
        'app.profileSettings': { id: 'PENGATURAN AKUN', en: 'ACCOUNT SETTINGS', ar: 'إعدادات الحساب' },
        'app.personalRoom': { id: 'RUANG BELAJAR PERSONAL', en: 'YOUR PERSONAL LEARNING SPACE', ar: 'مساحتك التعليمية الخاصة' },
        'app.welcome': { id: 'Selamat datang.', en: 'Welcome.', ar: 'مرحبًا بك.' },
        'app.signIn': { id: 'Masuk atau buat akun untuk mulai belajar.', en: 'Sign in or create an account to begin learning.', ar: 'سجّل الدخول أو أنشئ حسابًا لبدء التعلّم.' },
        'app.submitTeacherApplication': { id: 'Kirim pengajuan Ustad', en: 'Submit teacher application', ar: 'أرسل طلب الانضمام معلّمًا' },
        'app.createStudentAccount': { id: 'Buat akun Siswa', en: 'Create student account', ar: 'أنشئ حساب طالب' },
        'app.signInStudent': { id: 'Masuk sebagai Siswa', en: 'Sign in as a student', ar: 'الدخول بصفة طالب' },
        'app.signInTeacher': { id: 'Masuk sebagai Ustad', en: 'Sign in as a teacher', ar: 'الدخول بصفة معلّم' },
        'app.signInAdmin': { id: 'Masuk sebagai Admin', en: 'Sign in as an admin', ar: 'الدخول بصفة مسؤول' },
        'app.student': { id: 'Siswa', en: 'Student', ar: 'طالب' },
        'app.teacher': { id: 'Ustad', en: 'Teacher', ar: 'معلّم' },
        'app.adminRole': { id: 'Admin', en: 'Admin', ar: 'مسؤول' },
        'app.profilePhoto': { id: 'Ganti foto profil', en: 'Change profile photo', ar: 'غيّر الصورة الشخصية' },
        'app.aboutMe': { id: 'Tentang saya', en: 'About me', ar: 'نبذة عنّي' },
        'app.learningHistory': { id: 'Riwayat belajarmu', en: 'Your learning history', ar: 'سجل تعلّمك' },
        'app.materialAndAssessment': { id: 'Materi & evaluasi', en: 'Lessons & assessments', ar: 'الدروس والتقييمات' },
        'app.weeklyRhythm': { id: '7 hari terakhir', en: 'Last 7 days', ar: 'آخر ٧ أيام' },
        'app.privacy': { id: 'Privasi', en: 'Privacy', ar: 'الخصوصية' },
        'app.sevenDayActivity': { id: 'RITME BELAJAR', en: 'LEARNING RHYTHM', ar: 'وتيرة التعلّم' },
        'app.saveNote': { id: 'Simpan catatan', en: 'Save note', ar: 'احفظ الملاحظة' },
        'app.addSchedule': { id: 'Tambah jadwal', en: 'Add availability', ar: 'أضف موعدًا متاحًا' },
        'app.openQibla': { id: 'Kompas Kiblat', en: 'Qibla compass', ar: 'بوصلة القبلة' },
        'app.updateLocation': { id: 'Perbarui lokasi', en: 'Refresh location', ar: 'حدّث الموقع' },
        'app.readQuran': { id: 'Baca Al-Qur’an', en: 'Read the Qur’an', ar: 'اقرأ القرآن' },
        'app.academyMenu': { id: 'Akademi Tilawah', en: 'Recitation academy', ar: 'أكاديمية التلاوة' },
        'app.tahsinPractice': { id: 'Latihan Pelafalan', en: 'Recitation practice', ar: 'تدريب التلاوة' },
        'app.selectRecitation': { id: 'Pilih bacaan', en: 'Choose a passage', ar: 'اختر مقطعًا للتلاوة' },
        'app.practiceSurah': { id: 'Surah latihan', en: 'Practice surah', ar: 'سورة للتدريب' },
        'app.record': { id: 'Rekam', en: 'Record', ar: 'تسجيل' },
        'app.playRecording': { id: 'Putar rekaman', en: 'Play recording', ar: 'تشغيل التسجيل' },
        'app.reviewResult': { id: 'Hasil pemeriksaan', en: 'Review results', ar: 'نتائج المراجعة' },
        'app.qiblaTitle': { id: 'Penunjuk Arah', en: 'Direction finder', ar: 'محدّد الاتجاه' },
        'app.qiblaWaiting': { id: 'Menunggu lokasi', en: 'Waiting for location', ar: 'بانتظار الموقع' },
        'app.community': { id: 'Komunitas', en: 'Community', ar: 'المجتمع' },
        'app.settings': { id: 'Pengaturan', en: 'Settings', ar: 'الإعدادات' },
        'app.helpCenter': { id: 'Pusat Bantuan', en: 'Help centre', ar: 'مركز المساعدة' },
        'app.backAcademy': { id: '← Kembali ke Akademi', en: '← Back to the academy', ar: 'العودة إلى الأكاديمية ←' },
        'app.quranExercise': { id: '1. Pilih bacaan', en: '1. Choose a passage', ar: '١. اختر مقطعًا للتلاوة' },
        'app.practiceRecording': {
            id: 'Pilih bacaan, rekam, lalu jalankan pemeriksaan dasar untuk melihat apakah kata-kata terbaca sesuai teks. Hasilnya bahan murajaah dan saran pengulangan, bukan koreksi makhraj atau pengganti ustad.',
            en: 'Choose a passage, record it, then run a basic check to see whether the words match the text. Use the result for review and practice ideas; it is not makhraj feedback or a substitute for a qualified teacher.',
            ar: 'اختر مقطعًا وسجّله، ثم أجرِ فحصًا أوليًا لمعرفة مدى توافق الكلمات مع النص. النتيجة للمراجعة واقتراح التدريب، وليست تصحيحًا للمخارج ولا بديلًا عن المعلّم.'
        },
        'admin.workspace': { id: 'Workspace', en: 'Workspace', ar: 'مساحة العمل' },
        'admin.previewMode': { id: 'Pratinjau mode', en: 'Mode preview', ar: 'معاينة الأوضاع' },
        'admin.managementTitle': { id: 'Manajemen pengguna', en: 'User management', ar: 'إدارة المستخدمين' },
        'admin.applicationReview': { id: 'TINJAUAN PENGAJAR', en: 'TEACHER APPLICATION REVIEW', ar: 'مراجعة طلبات المعلّمين' },
        'admin.manageApplications': { id: 'Seluruh pengajuan', en: 'All applications', ar: 'جميع الطلبات' },
        'admin.reviewProfile': { id: 'Periksa profil dan alasan pemohon sebelum mengambil keputusan.', en: 'Review each applicant’s profile and reason before making a decision.', ar: 'راجع الملف الشخصي وسبب التقديم قبل اتخاذ القرار.' },
        'admin.roleExplanation': {
            id: 'Keputusan berlaku pada akun pemohon; penolakan mengembalikan role akun menjadi siswa.',
            en: 'Decisions apply to the applicant’s account; a declined application leaves the account as a student.',
            ar: 'يُطبّق القرار على حساب مقدّم الطلب؛ وعند الرفض يبقى الحساب بصفة طالب.'
        },
        'admin.allTime': { id: 'Sepanjang waktu', en: 'All time', ar: 'الإجمالي' },
        'admin.studentsActive': { id: 'Pengguna aktif', en: 'Active users', ar: 'مستخدمون نشطون' },
        'admin.teachersActive': { id: 'Pengajar aktif', en: 'Active teachers', ar: 'معلّمون نشطون' },
        'admin.needsAction': { id: 'Perlu ditindaklanjuti', en: 'Requires follow-up', ar: 'يتطلب المتابعة' },
        'admin.userLimit': { id: 'Akun terbaru', en: 'Most recent accounts', ar: 'أحدث الحسابات' },
        'admin.userLimitNote': {
            id: 'Data dibatasi hingga 500 akun terakhir. Kata sandi dan data autentikasi tidak ditampilkan.',
            en: 'Showing up to the 500 most recent accounts. Passwords and authentication data are never displayed.',
            ar: 'يُعرض أحدث ٥٠٠ حساب كحد أقصى. لا تُعرض كلمات المرور أو بيانات المصادقة.'
        },
        'admin.showOnly': { id: 'tampilan saja', en: 'display only', ar: 'للعرض فقط' },
        'admin.noAccounts': { id: 'Belum ada pengguna terdaftar.', en: 'No users have registered yet.', ar: 'لم يسجّل أي مستخدم بعد.' },
        'admin.setupTitle': { id: 'PENYIAPAN SERVER', en: 'SERVER SETUP', ar: 'إعداد الخادم' },
        'admin.notActive': { id: 'Akun admin belum aktif', en: 'Admin account is not active', ar: 'حساب الإدارة غير مفعّل' },
        'admin.loginIntro': {
            id: 'Gunakan akun admin yang disiapkan otomatis dari konfigurasi server.',
            en: 'Sign in with the admin account provisioned from the server configuration.',
            ar: 'سجّل الدخول بحساب الإدارة الذي أُعدّ تلقائيًا من إعدادات الخادم.'
        },
        'admin.setupInstructions': {
            id: 'Tambahkan USTAD_ADMIN_PASSWORD sebagai environment variable di konfigurasi Web app PythonAnywhere, lalu tekan Reload. Saat aplikasi mulai, akun admin dibuat otomatis dan password disimpan sebagai hash di database.',
            en: 'Add USTAD_ADMIN_PASSWORD as an environment variable in your PythonAnywhere web app configuration, then click Reload. On startup, the admin account is created automatically and its password is stored as a hash in the database.',
            ar: 'أضف USTAD_ADMIN_PASSWORD كمتغير بيئة في إعدادات تطبيق الويب على PythonAnywhere، ثم اضغط Reload. عند بدء التطبيق، يُنشأ حساب الإدارة تلقائيًا وتُحفظ كلمة المرور بصيغة تجزئة في قاعدة البيانات.'
        },
        'admin.signIn': { id: 'Masuk sebagai Admin', en: 'Sign in as an admin', ar: 'الدخول بصفة مسؤول' },
        'admin.username': { id: 'Username', en: 'Username', ar: 'اسم المستخدم' },
        'admin.signInDashboard': { id: 'Masuk ke Dashboard Admin', en: 'Sign in to the admin dashboard', ar: 'الدخول إلى لوحة الإدارة' },
        'admin.credentialsNote': {
            id: 'Akun admin tidak didaftarkan secara publik. Kredensial dikelola melalui konfigurasi rahasia server.',
            en: 'Admin accounts are not publicly registered. Credentials are managed in the server’s private configuration.',
            ar: 'لا يمكن التسجيل كمسؤول للعامة. تُدار بيانات الدخول عبر إعدادات الخادم السرية.'
        },
        'page.adminTitle': { id: 'Dashboard Admin | Ustad Online', en: 'Admin Dashboard | Ustad Online', ar: 'لوحة الإدارة | أستاذ أونلاين' },
        'page.applicationTitle': { id: 'Pengajuan Ustad | Ustad Online', en: 'Teacher Applications | Ustad Online', ar: 'طلبات المعلّمين | أستاذ أونلاين' },
        'page.usersTitle': { id: 'Manajemen Pengguna | Ustad Online', en: 'User Management | Ustad Online', ar: 'إدارة المستخدمين | أستاذ أونلاين' },
        'page.loginTitle': { id: 'Masuk Admin | Ustad Online', en: 'Admin Sign In | Ustad Online', ar: 'دخول الإدارة | أستاذ أونلاين' },
        'app.learnBegin': { id: 'Hafalan baru', en: 'New memorisation', ar: 'حفظ جديد' },
        'app.murajaahRecent': { id: 'Murajaah hafalan terbaru', en: 'Review recent memorisation', ar: 'مراجعة الحفظ الأخير' },
        'app.murajaahOlder': { id: 'Murajaah hafalan lama', en: 'Review earlier memorisation', ar: 'مراجعة الحفظ السابق' },
        'app.30minutes': { id: '30 menit', en: '30 minutes', ar: '٣٠ دقيقة' },
        'app.45minutes': { id: '45 menit', en: '45 minutes', ar: '٤٥ دقيقة' },
        'app.60minutes': { id: '60 menit', en: '60 minutes', ar: '٦٠ دقيقة' },
        'app.findTeacher': { id: 'Cari pengajar', en: 'Find a teacher', ar: 'ابحث عن معلّم' },
        'app.sessionMethod': { id: 'Metode sesi', en: 'Session format', ar: 'طريقة الجلسة' },
        'app.primarySubject': { id: 'Bidang utama', en: 'Primary subject', ar: 'المجال الأساسي' },
        'app.relevantExperience': { id: 'Keahlian & pengalaman relevan', en: 'Relevant skills and experience', ar: 'المهارات والخبرات ذات الصلة' },
        'app.pricePerSession': { id: 'Biaya per sesi (Rp)', en: 'Fee per session (IDR)', ar: 'رسوم الجلسة (روبية)' },
        'app.addAvailability': { id: 'Tambahkan jadwal tersedia', en: 'Add available hours', ar: 'أضف موعدًا متاحًا' },
        'app.startSession': { id: 'Mulai sesi', en: 'Start session', ar: 'بدء الجلسة' },
        'app.availableSchedule': { id: 'Jadwal tersedia', en: 'Available schedule', ar: 'المواعيد المتاحة' },
        'app.studentRequests': { id: 'Permintaan siswa', en: 'Student requests', ar: 'طلبات الطلاب' },
        'app.completedEvaluations': { id: 'Evaluasi selesai', en: 'Completed evaluations', ar: 'التقييمات المكتملة' },
        'app.noApplications': { id: 'Belum ada pengajuan ustad/ustadzah.', en: 'There are no teacher applications yet.', ar: 'لا توجد طلبات معلّمين حتى الآن.' },
        'app.noUsers': { id: 'Belum ada pengguna terdaftar.', en: 'No users have registered yet.', ar: 'لم يسجّل أي مستخدم بعد.' },
        'admin.kicker': { id: 'RUANG KENDALI FAMDI', en: 'FAMDI ADMIN WORKSPACE', ar: 'مساحة إدارة FAMDI' },
        'admin.dashboard': { id: 'Dashboard Admin', en: 'Admin dashboard', ar: 'لوحة الإدارة' },
        'admin.pendingReview': { id: 'Menunggu tinjauan', en: 'Awaiting review', ar: 'بانتظار المراجعة' },
        'admin.accepted': { id: 'Pengajuan diterima', en: 'Applications approved', ar: 'الطلبات المقبولة' },
        'admin.declined': { id: 'Pengajuan ditolak', en: 'Applications declined', ar: 'الطلبات المرفوضة' },
        'admin.studentAccounts': { id: 'Akun siswa', en: 'Student accounts', ar: 'حسابات الطلاب' },
        'admin.teacherAccounts': { id: 'Akun ustad/ustadzah', en: 'Teacher accounts', ar: 'حسابات المعلّمين' },
        'admin.openStudentMode': { id: 'Masuk ke Mode Siswa', en: 'Preview student mode', ar: 'معاينة وضع الطالب' },
        'admin.openTeacherMode': { id: 'Masuk ke Mode Ustad', en: 'Preview teacher mode', ar: 'معاينة وضع المعلّم' },
        'admin.previewBanner': {
            id: 'Mode Siswa pratinjau Admin · tampilan saja, akun dan data pengguna tidak diubah.',
            en: 'Admin preview of student mode · display only; user accounts and data are unchanged.',
            ar: 'معاينة الإدارة لوضع الطالب · للعرض فقط، ولن تتغير الحسابات أو بيانات المستخدمين.'
        },
        'admin.noApplications': { id: 'Belum ada pengajuan ustad/ustadzah.', en: 'There are no teacher applications yet.', ar: 'لا توجد طلبات معلّمين حتى الآن.' },
        'language.label': { id: 'Bahasa', en: 'Language', ar: 'اللغة' },
        'language.aria': { id: 'Pilih bahasa antarmuka', en: 'Choose interface language', ar: 'اختر لغة الواجهة' },
        'language.indonesian': { id: 'Bahasa Indonesia', en: 'Bahasa Indonesia', ar: 'الإندونيسية' },
        'language.english': { id: 'English', en: 'English', ar: 'الإنجليزية' },
        'language.arabic': { id: 'العربية', en: 'العربية', ar: 'العربية' },
        'status.audioUnsupported': {
            id: 'Browser ini tidak mendukung efek suara; buzzer tetap berfungsi.',
            en: 'This browser does not support sound effects; the buzzer still works.',
            ar: 'لا يدعم هذا المتصفح المؤثرات الصوتية، لكن الجرس ما زال يعمل.'
        },
        'status.audioFailed': {
            id: 'Efek suara gagal diputar; buzzer tetap berfungsi.',
            en: 'The sound effect could not play; the buzzer still works.',
            ar: 'تعذّر تشغيل المؤثر الصوتي، لكن الجرس ما زال يعمل.'
        },
        'status.adminLoginFailed': {
            id: 'Username atau kata sandi admin tidak cocok.',
            en: 'The admin username or password is incorrect.',
            ar: 'اسم المستخدم أو كلمة مرور الإدارة غير صحيحة.'
        },
        'status.loginFailed': {
            id: 'Email atau kata sandi tidak sesuai.',
            en: 'The email or password is incorrect.',
            ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
        },
        'status.accountTypeMismatch': {
            id: 'Jenis akun tidak sesuai. Pilih tab Siswa atau Ustad yang benar.',
            en: 'That account type does not match. Choose the correct Student or Teacher tab.',
            ar: 'نوع الحساب غير مطابق. اختر علامة تبويب الطالب أو المعلّم المناسبة.'
        }
    };

    const phraseCatalog = new Map();
    Object.keys(catalog).forEach((key) => phraseCatalog.set(catalog[key].id, key));
    const translatedText = new WeakMap();
    const root = document.documentElement;
    const originalTitleKey = phraseCatalog.get(normalise(document.title));
    let language = 'id';
    let observer;

    function normalise(value) {
        return value.replace(/\s+/g, ' ').trim();
    }

    function translation(key, selectedLanguage) {
        const entry = catalog[key];
        return entry ? entry[selectedLanguage] || entry.id : null;
    }

    function translateTextNode(node) {
        const source = translatedText.has(node) ? translatedText.get(node) : node.nodeValue;
        if (!translatedText.has(node)) translatedText.set(node, source);
        const key = phraseCatalog.get(normalise(source));
        if (!key) return;
        const translated = translation(key, language);
        const leading = source.match(/^\s*/)[0];
        const trailing = source.match(/\s*$/)[0];
        const result = `${leading}${translated}${trailing}`;
        if (node.nodeValue !== result) node.nodeValue = result;
    }

    function translateAttributes(scope) {
        const nodes = [];
        if (scope.nodeType === Node.ELEMENT_NODE && scope.matches('[data-language-key], [data-language-aria], [placeholder], [title]')) {
            nodes.push(scope);
        }
        if (scope.querySelectorAll) {
            nodes.push(...scope.querySelectorAll('[data-language-key], [data-language-aria], [placeholder], [title]'));
        }
        nodes.forEach((element) => {
            const text = translation(element.dataset.languageKey, language);
            if (text && element.textContent !== text) element.textContent = text;
            const aria = translation(element.dataset.languageAria, language);
            if (aria && element.getAttribute('aria-label') !== aria) element.setAttribute('aria-label', aria);
            ['placeholder', 'title'].forEach((attribute) => {
                if (!element.hasAttribute(attribute)) return;
                if (!element.dataset[`i18n${attribute}`]) {
                    element.dataset[`i18n${attribute}`] = element.getAttribute(attribute);
                }
                const key = phraseCatalog.get(normalise(element.dataset[`i18n${attribute}`]));
                const translated = key && translation(key, language);
                if (translated && element.getAttribute(attribute) !== translated) element.setAttribute(attribute, translated);
            });
        });
    }

    function translateSubtree(scope) {
        if (!scope) return;
        translateAttributes(scope);
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent || parent.closest('script, style, noscript, textarea, [data-i18n-skip], .uo-language-switcher')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let node;
        while ((node = walker.nextNode())) translateTextNode(node);
    }

    function syncControls() {
        document.querySelectorAll('[data-language-key]').forEach((element) => {
            const value = translation(element.dataset.languageKey, language);
            if (value && element.textContent !== value) element.textContent = value;
        });
        document.querySelectorAll('[data-language-aria]').forEach((element) => {
            const value = translation(element.dataset.languageAria, language);
            if (value && element.getAttribute('aria-label') !== value) element.setAttribute('aria-label', value);
        });
        const settingsSelect = document.getElementById('ui-language-select');
        if (settingsSelect) settingsSelect.value = language;
        const current = document.querySelector('.uo-language-current');
        if (current) current.textContent = language.toUpperCase();
        const dialog = document.getElementById('ui-customization-dialog');
        if (dialog) {
            dialog.lang = language;
            dialog.dir = language === 'ar' ? 'rtl' : 'ltr';
        }
    }

    function applyLanguage(selectedLanguage, persist) {
        if (!['id', 'en', 'ar'].includes(selectedLanguage)) return;
        const changed = selectedLanguage !== language;
        language = selectedLanguage;
        root.lang = language;
        root.dir = language === 'ar' ? 'rtl' : 'ltr';
        root.dataset.language = language;
        if (originalTitleKey) document.title = translation(originalTitleKey, language);
        if (document.body) {
            document.body.dataset.language = language;
            document.body.dir = root.dir;
        }
        translateSubtree(document.body);
        syncControls();
        if (persist) {
            try {
                if (window.localStorage.getItem(languageStorageKey) !== language) {
                    window.localStorage.setItem(languageStorageKey, language);
                }
            } catch (error) {
                console.error('Preferensi bahasa tidak dapat disimpan:', error);
            }
        }
        if (changed) window.dispatchEvent(new CustomEvent('ustadonline:languagechange', { detail: { language } }));
    }

    function placeLanguageControl() {
        const control = document.querySelector('.uo-language-switcher');
        if (!control || !document.body) return;
        const openDialog = document.querySelector('dialog[open]');
        const destination = openDialog || document.body;
        if (control.parentElement !== destination) destination.append(control);
    }

    function addLanguageControl() {
        let control = document.querySelector('.uo-language-switcher');
        if (!control) {
            control = document.createElement('details');
            control.className = 'uo-language-switcher';
            control.dataset.i18nSkip = 'true';
            control.innerHTML = `
                <summary data-language-aria="language.aria"><span aria-hidden="true">文</span><span class="uo-language-current"></span></summary>
                <div class="uo-language-options" role="group" data-language-aria="language.aria">
                    <button type="button" data-set-language="id" data-language-key="language.indonesian"></button>
                    <button type="button" data-set-language="en" data-language-key="language.english"></button>
                    <button type="button" data-set-language="ar" lang="ar" data-language-key="language.arabic"></button>
                </div>`;
            document.body.append(control);
            control.addEventListener('click', (event) => {
                const button = event.target.closest('[data-set-language]');
                if (!button) return;
                event.preventDefault();
                applyLanguage(button.dataset.setLanguage, true);
                control.open = false;
            });
        }
        placeLanguageControl();
        syncControls();
    }

    function readSavedLanguage() {
        try {
            const value = window.localStorage.getItem(languageStorageKey);
            return ['id', 'en', 'ar'].includes(value) ? value : 'id';
        } catch (error) {
            console.error('Preferensi bahasa tidak dapat dibaca:', error);
            return 'id';
        }
    }

    const sharedI18n = window.UstadOnlineI18n;
    if (sharedI18n && sharedI18n.catalog && typeof sharedI18n.apply === 'function') {
        Object.entries(catalog).forEach(([key, values]) => {
            sharedI18n.catalog[key] = [values.id, values.en, values.ar];
        });

        const setSharedLanguage = sharedI18n.setLanguage.bind(sharedI18n);
        const applySharedTranslations = sharedI18n.apply.bind(sharedI18n);
        language = sharedI18n.getLanguage();
        sharedI18n.apply = function (scope) {
            applySharedTranslations(scope);
            translateSubtree(scope || document.body);
        };
        sharedI18n.hasSavedLanguage = function () {
            try {
                return ['id', 'en', 'ar'].includes(window.localStorage.getItem(languageStorageKey))
                    || ['id', 'en', 'ar'].includes(window.localStorage.getItem('ustadOnline.language.v1'));
            } catch (error) {
                return false;
            }
        };
        sharedI18n.translateKey = function (key) {
            return sharedI18n.translate(key, sharedI18n.getLanguage());
        };
        sharedI18n.translateText = function (value) {
            const key = phraseCatalog.get(normalise(value));
            return key ? sharedI18n.translate(key, sharedI18n.getLanguage()) : value;
        };
        sharedI18n.setLanguage = function (value) {
            language = normalise(value);
            try {
                window.localStorage.setItem(languageStorageKey, language);
                window.localStorage.setItem('ustadOnline.language.v1', language);
            } catch (error) {
                console.error('Preferensi bahasa tidak dapat disimpan:', error);
            }
            setSharedLanguage(language);
            translateSubtree(document.body);
            syncControls();
            window.dispatchEvent(new CustomEvent('ustadonline:languagechange', {
                detail: { language }
            }));
        };
        sharedI18n.apply(document.documentElement);
        observer = new MutationObserver((records) => {
            records.forEach((record) => {
                if (record.type === 'characterData') translateTextNode(record.target);
                else if (record.type === 'attributes') translateAttributes(record.target);
                else record.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) translateSubtree(node);
                });
            });
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['aria-label', 'placeholder', 'title'],
            childList: true,
            characterData: true,
            subtree: true
        });
        return;
    }

    window.UstadOnlineI18n = {
        catalog,
        getLanguage() { return language; },
        hasSavedLanguage() {
            try { return ['id', 'en', 'ar'].includes(window.localStorage.getItem(languageStorageKey)); }
            catch (error) { return false; }
        },
        setLanguage(value) { applyLanguage(value, true); },
        translateKey(key) { return translation(key, language); },
        translateText(value) {
            const key = phraseCatalog.get(normalise(value));
            return key ? translation(key, language) : value;
        }
    };

    language = readSavedLanguage();
    applyLanguage(language, false);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addLanguageControl, { once: true });
    } else {
        addLanguageControl();
    }

    observer = new MutationObserver((records) => {
        records.forEach((record) => {
            if (record.type === 'attributes') {
                if (record.attributeName === 'open') placeLanguageControl();
                else translateAttributes(record.target);
                return;
            }
            if (record.type === 'characterData') translateTextNode(record.target);
            record.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) translateSubtree(node);
            });
        });
    });
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['aria-label', 'placeholder', 'title', 'open'],
        childList: true,
        characterData: true,
        subtree: true
    });
    document.addEventListener('close', placeLanguageControl, true);
    window.addEventListener('storage', (event) => {
        if (event.key === languageStorageKey) applyLanguage(readSavedLanguage(), false);
    });
}());
