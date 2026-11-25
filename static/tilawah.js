(function () {
    'use strict';

    const storageKey = 'ustadOnline.tilawah.progress.v1';
    const levels = {
        pemula: {
            label: 'Pemula',
            intro: 'Kenali bentuk dan bunyi, lalu bangun fondasi bacaanmu dengan tenang.',
            guidance: 'Fokus jalur pemula: kenali bentuk, nama, dan bunyi sebelum mempercepat bacaan.'
        },
        menengah: {
            label: 'Menengah',
            intro: 'Perkuat makhraj, sifat huruf, dan penerapan hukum tajwid dalam contoh bacaan.',
            guidance: 'Fokus jalur menengah: hubungkan kaidah dengan contoh kata dan potongan bacaan.'
        },
        lanjutan: {
            label: 'Lanjutan',
            intro: 'Latih ketelitian menerapkan tajwid, waqaf, dan ibtida pada bacaan yang lebih utuh.',
            guidance: 'Fokus jalur lanjutan: perhatikan hubungan antarkaidah dan alasan memilih waqaf.'
        }
    };

    const letters = [
        ['ا', 'Alif', 'أَسَدٌ', 'asadun · singa', 'أَلِفٌ'],
        ['ب', 'Ba', 'بَيْتٌ', 'baytun · rumah', 'بَاءٌ'],
        ['ت', 'Ta', 'تَمْرٌ', 'tamrun · kurma', 'تَاءٌ'],
        ['ث', 'Tsa', 'ثَوْبٌ', 'thawbun · pakaian', 'ثَاءٌ'],
        ['ج', 'Jim', 'جَمَلٌ', 'jamalun · unta', 'جِيمٌ'],
        ['ح', 'Ha', 'حِصَانٌ', 'hishānun · kuda', 'حَاءٌ'],
        ['خ', 'Kha', 'خُبْزٌ', 'khubzun · roti', 'خَاءٌ'],
        ['د', 'Dal', 'دَرْسٌ', 'darsun · pelajaran', 'دَالٌ'],
        ['ذ', 'Dzal', 'ذَهَبٌ', 'dzahabun · emas', 'ذَالٌ'],
        ['ر', 'Ra', 'رَجُلٌ', 'rajulun · laki-laki', 'رَاءٌ'],
        ['ز', 'Zai', 'زَهْرَةٌ', 'zahratun · bunga', 'زَايٌ'],
        ['س', 'Sin', 'سَمَكٌ', 'samakun · ikan', 'سِينٌ'],
        ['ش', 'Syin', 'شَمْسٌ', 'syamsun · matahari', 'شِينٌ'],
        ['ص', 'Shad', 'صَبْرٌ', 'shabrun · sabar', 'صَادٌ'],
        ['ض', 'Dhad', 'ضَوْءٌ', 'daw’un · cahaya', 'ضَادٌ'],
        ['ط', 'Tha', 'طَالِبٌ', 'thālibun · pelajar', 'طَاءٌ'],
        ['ظ', 'Zha', 'ظِلٌّ', 'zhillun · naungan', 'ظَاءٌ'],
        ['ع', 'Ain', 'عِلْمٌ', '‘ilmun · ilmu', 'عَيْنٌ'],
        ['غ', 'Ghain', 'غُرَابٌ', 'ghurābun · gagak', 'غَيْنٌ'],
        ['ف', 'Fa', 'فَمٌ', 'famun · mulut', 'فَاءٌ'],
        ['ق', 'Qaf', 'قَلَمٌ', 'qalamun · pena', 'قَافٌ'],
        ['ك', 'Kaf', 'كِتَابٌ', 'kitābun · buku', 'كَافٌ'],
        ['ل', 'Lam', 'لَبَنٌ', 'labanun · susu', 'لَامٌ'],
        ['م', 'Mim', 'مَاءٌ', 'mā’un · air', 'مِيمٌ'],
        ['ن', 'Nun', 'نُورٌ', 'nūrun · cahaya', 'نُونٌ'],
        ['ه', 'Ha', 'هِلَالٌ', 'hilālun · bulan sabit', 'هَاءٌ'],
        ['و', 'Wau', 'وَرْدٌ', 'wardun · mawar', 'وَاوٌ'],
        ['ي', 'Ya', 'يَدٌ', 'yadun · tangan', 'يَاءٌ']
    ];

    const lessons = [
        {
            id: 'hijaiyah',
            number: '01',
            title: 'Huruf Hijaiyah',
            summary: 'Kenali 28 huruf Hijaiyah melalui bentuk, nama, dan contoh kata. Dengarkan satu per satu, lalu tirukan dengan perlahan.',
            tips: {
                pemula: 'Mulai dengan membedakan bentuk dan nama huruf. Perhatikan titik karena titik dapat mengubah huruf.',
                menengah: 'Latih huruf yang bentuknya mirip dan bandingkan bunyi huruf tebal dengan tipis.',
                lanjutan: 'Uji pengenalan huruf dalam kata bersambung dan jaga ketepatan bunyi setiap huruf.'
            },
            sections: [
                {
                    title: 'Bentuk, nama, dan bunyi',
                    text: 'Huruf di bawah ini ditampilkan dalam bentuk tunggal. Bentuk huruf dapat berubah ketika berada di awal, tengah, atau akhir kata.',
                    letters: true
                },
                {
                    title: 'Catatan pelafalan',
                    text: 'Huruf seperti ح، ه، ع، ء، خ، غ berasal dari tenggorokan dengan tempat keluar yang berbeda. Dengarkan contoh dan minta koreksi guru untuk memastikan makhraj.'
                }
            ]
        },
        {
            id: 'harakat',
            number: '02',
            title: 'Harakat & Tanda Baca',
            summary: 'Harakat membantu pembaca mengetahui vokal pendek, bunyi mati, dengung, dan penekanan huruf.',
            tips: {
                pemula: 'Bunyikan satu huruf dengan harakatnya terlebih dahulu. Jangan menambah vokal pada huruf sukun.',
                menengah: 'Bandingkan perubahan bunyi ketika harakat berpindah dan saat tanwin bertemu huruf berikutnya.',
                lanjutan: 'Perhatikan tanda ketika waqaf, tasydid, dan harakat bertemu dalam satu rangkaian bacaan.'
            },
            sections: [
                {
                    title: 'Tiga vokal pendek dan sukun',
                    text: 'Fathah berbunyi pendek “a”, kasrah “i”, dan dammah “u”. Sukun menandakan huruf tidak memiliki vokal pendek sendiri.',
                    examples: [
                        { arabic: 'بَ', label: 'Fathah', detail: 'ba · bunyi a pendek', audio: 'ba' },
                        { arabic: 'بِ', label: 'Kasrah', detail: 'bi · bunyi i pendek', audio: 'bi' },
                        { arabic: 'بُ', label: 'Dammah', detail: 'bu · bunyi u pendek', audio: 'bu' },
                        { arabic: 'بْ', label: 'Sukun', detail: 'b mati · disambung dengan bunyi sebelumnya', audio: 'ab' }
                    ]
                },
                {
                    title: 'Tanwin dan tasydid',
                    text: 'Tanwin berbunyi “an”, “in”, atau “un” di akhir kata. Tasydid menunjukkan huruf dibaca rangkap dengan penahanan sesuai kaidah.',
                    examples: [
                        { arabic: 'بًا', label: 'Fathatain', detail: 'ban · tanwin fathah', audio: 'ban' },
                        { arabic: 'بٍ', label: 'Kasratain', detail: 'bin · tanwin kasrah', audio: 'bin' },
                        { arabic: 'بٌ', label: 'Dammatain', detail: 'bun · tanwin dammah', audio: 'bun' },
                        { arabic: 'رَبَّ', label: 'Tasydid', detail: 'rabba · huruf ب dibaca rangkap', audio: 'رَبَّ' }
                    ]
                }
            ]
        },
        {
            id: 'makharij',
            number: '03',
            title: 'Makharijul Huruf',
            summary: 'Makhraj adalah tempat keluarnya huruf. Mengenal kelompok makhraj membantu membedakan huruf yang terdengar mirip.',
            tips: {
                pemula: 'Ingat lima kelompok besar: rongga mulut, tenggorokan, lidah, dua bibir, dan rongga hidung.',
                menengah: 'Bandingkan huruf bertetangga, seperti س dan ص atau ت dan ط, dengan menjaga tempat keluarnya.',
                lanjutan: 'Perhatikan pergeseran titik artikulasi kecil di lidah dan tenggorokan saat menyambung bacaan.'
            },
            sections: [
                {
                    title: 'Lima kelompok makhraj',
                    text: 'Keterangan ini adalah pengantar umum. Setiap kelompok memiliki rincian tempat keluar yang lebih spesifik.',
                    examples: [
                        { arabic: 'ا و ي', label: 'Al-Jauf · rongga mulut', detail: 'Huruf mad ketika memenuhi syarat mad.', audio: 'قَالَ، يَقُولُ، قِيلَ' },
                        { arabic: 'ء ه ع ح غ خ', label: 'Al-Halq · tenggorokan', detail: 'Enam huruf yang keluar dari bagian tenggorokan.', audio: 'أَهْلٌ، عِلْمٌ، خَيْرٌ' },
                        { arabic: 'ق ك ج ش ي', label: 'Al-Lisan · lidah', detail: 'Kelompok lidah memiliki beberapa titik artikulasi.', audio: 'قَلْبٌ، كِتَابٌ، شَمْسٌ' },
                        { arabic: 'ف ب م و', label: 'Asy-Syafatain · dua bibir', detail: 'Huruf yang melibatkan bibir dengan cara berbeda.', audio: 'فَمٌ، بَيْتٌ، مَاءٌ' },
                        { arabic: 'م ن', label: 'Al-Khaisyum · rongga hidung', detail: 'Tempat keluarnya suara dengung (ghunnah).', audio: 'إِنَّ، ثُمَّ' }
                    ]
                },
                {
                    title: 'Latihan sederhana',
                    text: 'Ucapkan س lalu ص secara bergantian. Rasakan perbedaan bentuk lidah dan kualitas suara. Jangan mengganti makhraj untuk membuat bunyi lebih keras.'
                }
            ]
        },
        {
            id: 'sifat',
            number: '04',
            title: 'Sifat Huruf',
            summary: 'Sifat huruf menjelaskan karakter bunyi yang menyertai huruf, seperti aliran napas, tekanan, dan ketebalan.',
            tips: {
                pemula: 'Mulai dari pasangan yang mudah didengar: tipis dan tebal, atau napas mengalir dan tertahan.',
                menengah: 'Latih sifat berlawanan: hams-jahr, syiddah-rikhwah, serta isti‘la-istifal.',
                lanjutan: 'Gabungkan sifat dasar dan sifat khusus tanpa mengubah makhraj atau menambah tekanan.'
            },
            sections: [
                {
                    title: 'Sifat yang berlawanan',
                    text: 'Sifat membantu menjaga identitas bunyi huruf. Hams membuat napas mengalir; jahr menahan aliran napas. Syiddah menahan suara, sedangkan rikhwah membiarkannya mengalir.',
                    examples: [
                        { arabic: 'فَتَحَ', label: 'Hams', detail: 'Napas terasa mengalir pada huruf tertentu.', audio: 'فَتَحَ' },
                        { arabic: 'أَجْرٌ', label: 'Syiddah', detail: 'Suara tertahan pada huruf yang bersifat syiddah.', audio: 'أَجْرٌ' },
                        { arabic: 'قَ', label: 'Isti‘la', detail: 'Huruf isti‘la dibaca tebal sesuai kaidah.', audio: 'قَ' },
                        { arabic: 'كَ', label: 'Istifal', detail: 'Huruf istifal pada asalnya dibaca tipis.', audio: 'كَ' }
                    ]
                },
                {
                    title: 'Sifat khusus yang sering dilatih',
                    text: 'Qalqalah muncul pada ق ط ب ج د yang sukun. Sifat lain seperti safir, lin, dan ghunnah dipelajari dengan talaqqi agar kualitasnya tepat.',
                    examples: [
                        { arabic: 'أَحَدْ', label: 'Qalqalah', detail: 'Pantulan ringan pada دْ ketika berhenti.', audio: 'أَحَدْ' },
                        { arabic: 'إِنَّ', label: 'Ghunnah', detail: 'Dengung pada نّ dengan kadar sesuai kaidah.', audio: 'إِنَّ' }
                    ]
                }
            ]
        },
        {
            id: 'tajwid',
            number: '05',
            title: 'Hukum Tajwid',
            summary: 'Tajwid membantu setiap huruf mendapat hak makhraj, sifat, dan panjang bacaan yang benar.',
            tips: {
                pemula: 'Pahami nama hukum dan tanda pemicunya. Mulai dari satu contoh, jangan menghafal semua sekaligus.',
                menengah: 'Identifikasi huruf pemicu hukum nun sukun, tanwin, dan mim sukun pada potongan bacaan.',
                lanjutan: 'Terapkan hukum yang berurutan sambil menjaga panjang mad, ghunnah, dan kualitas huruf.'
            },
            sections: [
                {
                    title: 'Nun sukun dan tanwin',
                    text: 'Izhar (ء ه ع ح غ خ), idgham (ي ر م ل و ن), iqlab (ب), dan ikhfa (15 huruf lainnya). Idgham terbagi menjadi bighunnah dan bilaghunnah.',
                    examples: [
                        { arabic: 'مِنْ هَادٍ', label: 'Izhar', detail: 'نْ bertemu ه · dibaca jelas.', audio: 'مِنْ هَادٍ' },
                        { arabic: 'مَنْ يَقُولُ', label: 'Idgham bighunnah', detail: 'نْ bertemu ي · masuk dengan dengung.', audio: 'مَنْ يَقُولُ' },
                        { arabic: 'مِنْ رَبِّهِمْ', label: 'Idgham bilaghunnah', detail: 'نْ bertemu ر · masuk tanpa dengung.', audio: 'مِنْ رَبِّهِمْ' },
                        { arabic: 'مِنْ بَعْدِ', label: 'Iqlab', detail: 'نْ bertemu ب · bunyi berubah menjadi mim samar dengan dengung.', audio: 'مِنْ بَعْدِ' },
                        { arabic: 'مِنْ شَرِّ', label: 'Ikhfa', detail: 'نْ bertemu ش · dibaca samar dengan dengung.', audio: 'مِنْ شَرِّ' }
                    ]
                },
                {
                    title: 'Mim sukun, mad, dan qalqalah',
                    text: 'Mim sukun memiliki ikhfa syafawi sebelum ب, idgham mimi sebelum م, dan izhar syafawi sebelum huruf lain. Mad asli umumnya dua harakat. Qalqalah berlaku pada ق ط ب ج د yang sukun.',
                    examples: [
                        { arabic: 'تَرْمِيهِمْ بِحِجَارَةٍ', label: 'Ikhfa syafawi', detail: 'مْ bertemu ب.', audio: 'تَرْمِيهِمْ بِحِجَارَةٍ' },
                        { arabic: 'لَكُمْ مَا', label: 'Idgham mimi', detail: 'مْ bertemu م.', audio: 'لَكُمْ مَا' },
                        { arabic: 'قَالُوا', label: 'Mad asli', detail: 'Panjang dua harakat.', audio: 'قَالُوا' },
                        { arabic: 'أَحَدْ', label: 'Qalqalah', detail: 'Pantulan pada دْ saat berhenti.', audio: 'أَحَدْ' }
                    ]
                },
                {
                    title: 'Ghunnah dan lam jalalah',
                    text: 'Nun atau mim yang bertasydid dibaca dengung (ghunnah). Lam pada lafaz jalalah dibaca tebal setelah fathah atau dammah, dan tipis setelah kasrah.',
                    examples: [
                        { arabic: 'إِنَّ', label: 'Ghunnah', detail: 'Nun rangkap dibaca dengung.', audio: 'إِنَّ' },
                        { arabic: 'مِنَّ', label: 'Ghunnah', detail: 'Mim rangkap dibaca dengung.', audio: 'مِنَّ' },
                        { arabic: 'اللَّهُ', label: 'Lam tebal', detail: 'Dibaca tafkhim setelah fathah atau dammah sesuai kaidah.', audio: 'اللَّهُ' },
                        { arabic: 'بِاللَّهِ', label: 'Lam tipis', detail: 'Lam jalalah dibaca tarqiq setelah kasrah.', audio: 'بِاللَّهِ' }
                    ]
                },
                {
                    title: 'Pembagian mad',
                    text: 'Mad asli atau mad thabi‘i biasanya dua harakat. Mad far‘i meliputi mad wajib muttasil, jaiz munfasil, silah, aridh lis-sukun, lazim, dan lainnya. Panjang tepatnya perlu dipelajari sesuai riwayat dan mushaf yang digunakan.',
                    examples: [
                        { arabic: 'قَالَ', label: 'Mad thabi‘i', detail: 'Alif tanpa hamzah setelah fathah.', audio: 'قَالَ' },
                        { arabic: 'جَآءَ', label: 'Mad wajib muttasil', detail: 'Mad bertemu hamzah dalam satu kata.', audio: 'جَآءَ' },
                        { arabic: 'إِنَّآ أَنْزَلْنَا', label: 'Mad jaiz munfasil', detail: 'Mad bertemu hamzah di kata berikutnya.', audio: 'إِنَّآ أَنْزَلْنَا' },
                        { arabic: 'الْعَالَمِينَ', label: 'Mad aridh lis-sukun', detail: 'Mad di akhir kata ketika diwaqafkan.', audio: 'الْعَالَمِينَ' }
                    ]
                },
                {
                    title: 'Ra dan lam',
                    text: 'Ra dibaca tebal atau tipis tergantung harakat, posisi sukun, dan huruf sebelum atau sesudahnya. Lafaz Allah mengikuti kaidah tafkhim atau tarqiq sesuai konteks.',
                    examples: [
                        { arabic: 'رَحْمَةٌ', label: 'Ra tebal', detail: 'Contoh ra berfathah.', audio: 'رَحْمَةٌ' },
                        { arabic: 'رِزْقٌ', label: 'Ra tipis', detail: 'Contoh ra berkasrah.', audio: 'رِزْقٌ' },
                        { arabic: 'أَنْعَمْتَ', label: 'Peringatan', detail: 'Mad, ghunnah, dan sifat huruf dapat berubah saat disambung atau diwaqafkan.', audio: 'أَنْعَمْتَ' }
                    ]
                },
                {
                    title: 'Penggunaan yang aman',
                    text: 'Materi ini memberi fondasi, bukan keputusan akhir atas bacaan seseorang. Perbedaan riwayat, waqaf, makhraj, dan kadar ghunnah perlu dikonfirmasi kepada ustaz atau ustazah.'
                }
            ]
        },
        {
            id: 'waqaf',
            number: '06',
            title: 'Waqaf & Ibtida',
            summary: 'Waqaf adalah berhenti pada bacaan; ibtida adalah memulai kembali. Keduanya membantu menjaga makna dan alur ayat.',
            tips: {
                pemula: 'Kenali tanda yang umum terlebih dahulu. Jangan berhenti pada tempat yang membuat makna terputus.',
                menengah: 'Perhatikan hubungan kata sebelum berhenti dan tentukan tempat memulai kembali dengan tepat.',
                lanjutan: 'Pelajari konteks makna ayat bersama guru; simbol dapat mengikuti mushaf dan riwayat yang digunakan.'
            },
            sections: [
                {
                    title: 'Tanda waqaf yang umum',
                    text: 'Simbol dapat berbeda penyajiannya pada mushaf. Ikuti mushaf yang dipakai dalam pembelajaran dan tanyakan kepada guru bila ragu.',
                    examples: [
                        { arabic: 'مـ', label: 'Waqaf lazim', detail: 'Umumnya menunjukkan tempat berhenti.', audio: 'قُلْ هُوَ اللَّهُ أَحَدٌ' },
                        { arabic: 'لا', label: 'Jangan berhenti', detail: 'Hindari berhenti kecuali ada kebutuhan.', audio: 'اللَّهُ الصَّمَدُ' },
                        { arabic: 'ج', label: 'Jaiz', detail: 'Boleh berhenti atau melanjutkan.', audio: 'لَمْ يَلِدْ وَلَمْ يُولَدْ' },
                        { arabic: 'صلى', label: 'Washal lebih utama', detail: 'Melanjutkan bacaan lebih utama.', audio: 'وَهُوَ الْغَفُورُ الْوَدُودُ' },
                        { arabic: 'قلى', label: 'Waqaf lebih utama', detail: 'Berhenti lebih utama.', audio: 'وَاللَّهُ عَلِيمٌ حَكِيمٌ' }
                    ]
                },
                {
                    title: 'Sebelum berhenti atau memulai',
                    text: 'Dengarkan contoh, lihat tanda pada mushaf, dan pertimbangkan hubungan makna. Untuk penentuan waqaf yang tepat, rujuk guru atau penjelasan mushaf.'
                }
            ]
        }
    ];

    const quizzes = {
        pemula: [
            { lesson: 'harakat', question: 'Pada contoh بَ, tanda baca apakah yang dipakai?', options: ['Fathah', 'Kasrah', 'Dammah'], answer: 0 },
            { lesson: 'makharij', question: 'Secara umum, huruf ف melibatkan bagian mana?', options: ['Gigi atas dan bibir bawah', 'Pangkal tenggorokan', 'Ujung lidah dan gigi bawah'], answer: 0 },
            { lesson: 'tajwid', question: 'Nun sukun bertemu ب dibaca dengan hukum apa?', options: ['Izhar', 'Iqlab', 'Idgham bilaghunnah'], answer: 1 },
            { lesson: 'sifat', question: 'Huruf qalqalah terkumpul dalam rangkaian apa?', options: ['يَرْمَلُونَ', 'قُطْبُ جَدٍّ', 'حَيُّ طَهُرَ'], answer: 1 },
            { lesson: 'waqaf', question: 'Apa yang umumnya ditunjukkan tanda waqaf مـ?', options: ['Berhenti', 'Wajib menyambung', 'Memanjangkan dua harakat'], answer: 0 }
        ],
        menengah: [
            { lesson: 'tajwid', question: 'Nun sukun bertemu ش, hukum bacaannya adalah…', options: ['Ikhfa', 'Iqlab', 'Izhar'], answer: 0 },
            { lesson: 'tajwid', question: 'Mim sukun bertemu ب dibaca dengan…', options: ['Ikhfa syafawi', 'Idgham mimi', 'Izhar halqi'], answer: 0 },
            { lesson: 'tajwid', question: 'Panjang mad asli umumnya…', options: ['Satu harakat', 'Dua harakat', 'Enam harakat'], answer: 1 },
            { lesson: 'makharij', question: 'Huruf ق secara umum keluar dari…', options: ['Pangkal lidah', 'Dua bibir', 'Ujung lidah'], answer: 0 },
            { lesson: 'waqaf', question: 'Tanda ج pada umumnya menunjukkan…', options: ['Boleh berhenti atau melanjutkan', 'Tidak boleh berhenti sama sekali', 'Wajib memulai ulang'], answer: 0 }
        ],
        lanjutan: [
            { lesson: 'tajwid', question: 'Nun sukun bertemu ر termasuk…', options: ['Idgham bilaghunnah', 'Ikhfa haqiqi', 'Iqlab'], answer: 0 },
            { lesson: 'tajwid', question: 'Mim sukun bertemu م dibaca dengan…', options: ['Idgham mimi', 'Ikhfa syafawi', 'Izhar halqi'], answer: 0 },
            { lesson: 'tajwid', question: 'Mad wajib muttasil terjadi ketika huruf mad bertemu hamzah…', options: ['Dalam satu kata', 'Di awal kata berikutnya', 'Hanya saat waqaf'], answer: 0 },
            { lesson: 'sifat', question: 'Qalqalah kubra umumnya terdengar ketika huruf qalqalah…', options: ['Berharakat kasrah', 'Berada di akhir bacaan dan diwaqafkan', 'Bertemu huruf mad'], answer: 1 },
            { lesson: 'waqaf', question: 'Apa yang paling penting dipertimbangkan saat menentukan tempat ibtida?', options: ['Hubungan makna dan bimbingan mushaf/guru', 'Selalu memulai dari huruf paling panjang', 'Mengabaikan tanda waqaf'], answer: 0 }
        ]
    };

    const lessonById = Object.fromEntries(lessons.map((lesson) => [lesson.id, lesson]));
    const levelIds = Object.keys(levels);
    const defaultState = () => ({
        level: 'pemula',
        byLevel: {
            pemula: { completed: [], quiz: null },
            menengah: { completed: [], quiz: null },
            lanjutan: { completed: [], quiz: null }
        }
    });

    const lessonDialog = document.getElementById('lesson-dialog');
    const quizDialog = document.getElementById('quiz-dialog');
    const lessonSections = document.getElementById('lesson-sections');
    const quizQuestions = document.getElementById('quiz-questions');
    const quizForm = document.getElementById('quiz-form');
    let activeLesson = null;
    let verifiedAudioCache = null;
    let recommendationTarget = null;
    let state = loadState();

    function loadState() {
        try {
            const stored = window.UstadOnlineStorage.getItem(storageKey);
            if (!stored) return defaultState();
            const parsed = JSON.parse(stored);
            if (!parsed || typeof parsed !== 'object') throw new Error('Format progres tidak valid.');
            const next = defaultState();
            if (levelIds.includes(parsed.level)) next.level = parsed.level;
            levelIds.forEach((level) => {
                const progress = parsed.byLevel && parsed.byLevel[level];
                if (!progress || typeof progress !== 'object') return;
                next.byLevel[level].completed = Array.isArray(progress.completed)
                    ? progress.completed.filter((id) => lessonById[id])
                    : [];
                if (progress.quiz && typeof progress.quiz.score === 'number') {
                    next.byLevel[level].quiz = {
                        score: Math.max(0, Math.min(100, progress.quiz.score)),
                        missed: Array.isArray(progress.quiz.missed) ? progress.quiz.missed.filter((id) => lessonById[id]) : []
                    };
                }
            });
            return next;
        } catch (error) {
            console.error('Progres Akademi Tilawah tidak dapat dibaca:', error);
            const note = document.querySelector('[data-progress-note]');
            if (note) note.textContent = 'Progres tersimpan tidak dapat dibaca. Perjalanan baru dimulai dari perangkat ini.';
            return defaultState();
        }
    }

    function saveState() {
        try {
            window.UstadOnlineStorage.setItem(storageKey, JSON.stringify(state));
            return true;
        } catch (error) {
            console.error('Progres Akademi Tilawah tidak dapat disimpan:', error);
            const note = document.querySelector('[data-progress-note]');
            if (note) note.textContent = 'Progres aktif untuk sesi ini, tetapi browser tidak dapat menyimpannya.';
            return false;
        }
    }

    function currentProgress() {
        return state.byLevel[state.level];
    }

    function updateProgress() {
        const progress = currentProgress();
        const completedCount = progress.completed.length + (progress.quiz ? 1 : 0);
        const percent = Math.round((completedCount / 7) * 100);
        document.querySelector('[data-progress-percent]').textContent = `${percent}%`;
        document.querySelector('[data-progress-count]').textContent = `${completedCount} dari 7 bagian`;
        document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(percent));
        document.querySelector('[data-progress-fill]').style.width = `${percent}%`;
        document.querySelectorAll('[data-lesson-id]').forEach((button) => {
            const id = button.dataset.lessonId;
            const complete = id === 'evaluasi' ? Boolean(progress.quiz) : progress.completed.includes(id);
            button.classList.toggle('is-complete', complete);
            const status = button.querySelector(`[data-lesson-state="${id}"]`);
            if (status) status.innerHTML = complete ? 'Selesai <b>✓</b>' : 'Mulai <b>↗</b>';
        });
        const note = document.querySelector('[data-progress-note]');
        if (note && !note.textContent.includes('tersimpan tidak dapat dibaca') && !note.textContent.includes('tidak dapat menyimpannya')) {
            note.textContent = progress.quiz
                ? `Evaluasi terakhir jalur ${levels[state.level].label}: ${progress.quiz.score}%. Kamu bisa mengulang kapan saja.`
                : 'Mulai dari materi yang paling dasar. Progres tersimpan di perangkat ini.';
        }
    }

    function selectLevel(level) {
        if (!levels[level]) return;
        state.level = level;
        document.querySelectorAll('[data-learning-level]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.learningLevel === level));
        });
        document.querySelector('[data-level-heading]').textContent = `Jalur ${levels[level].label}`;
        document.querySelector('[data-level-description]').textContent = levels[level].intro;
        saveState();
        updateProgress();
    }

    function create(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function makeAudioButton(text) {
        const button = create('button', 'audio-button', '♫ Dengarkan');
        button.type = 'button';
        button.dataset.speak = text;
        button.setAttribute('aria-label', `Dengarkan contoh Mushaf untuk ${text}`);
        return button;
    }

    function renderMakhrajMap(container) {
        const points = [
            { key: 'jauf', label: 'Rongga mulut · Al-Jauf', detail: 'Rongga mulut dan tenggorokan menjadi aliran huruf mad: alif mad, waw sukun setelah dammah, dan ya sukun setelah kasrah.', x: 190, y: 174 },
            { key: 'halq', label: 'Tenggorokan · Al-Halq', detail: 'Enam huruf tenggorokan: ء ه di bagian terdalam, ع ح di tengah, dan غ خ di bagian yang lebih dekat ke mulut.', x: 235, y: 224 },
            { key: 'lisan', label: 'Lidah · Al-Lisan', detail: 'Banyak huruf menggunakan bagian lidah yang berbeda—pangkal, tengah, sisi, atau ujung. Titik setiap huruf perlu dipelajari satu per satu.', x: 198, y: 192 },
            { key: 'syafatain', label: 'Dua bibir · Asy-Syafatain', detail: 'ف melibatkan bibir bawah dan ujung gigi atas; ب dan م menggunakan pertemuan dua bibir, sedangkan و melibatkan pembulatan bibir.', x: 148, y: 174 },
            { key: 'khaisyum', label: 'Rongga hidung · Al-Khaisyum', detail: 'Jalur dengung (ghunnah) pada ن dan م, terutama saat bertasydid. Ilustrasi ini menunjukkan wilayahnya secara sederhana.', x: 178, y: 127 }
        ];
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const svgNode = (tag, attributes) => {
            const element = document.createElementNS(svgNamespace, tag);
            Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
            return element;
        };
        const figure = create('figure', 'makharij-figure');
        const illustration = svgNode('svg', {
            class: 'makharij-illustration',
            viewBox: '0 0 480 300',
            role: 'img',
            'aria-labelledby': 'makharij-illustration-title makharij-illustration-description'
        });
        const title = svgNode('title', { id: 'makharij-illustration-title' });
        title.textContent = 'Ilustrasi tampak samping kepala dan tempat keluarnya huruf';
        const description = svgNode('desc', { id: 'makharij-illustration-description' });
        description.textContent = 'Gambar sederhana rongga hidung, mulut, lidah, bibir, dan tenggorokan dengan titik bernomor yang sesuai dengan pilihan di bawah.';
        illustration.append(title, description);
        illustration.append(
            svgNode('path', {
                class: 'makharij-head',
                d: 'M254 26 C196 26 157 66 151 115 L143 143 L124 157 L142 164 L133 174 L151 181 C151 205 164 227 187 241 L186 278 L304 278 L304 245 C339 222 357 184 357 131 C357 70 313 26 254 26 Z'
            }),
            svgNode('path', {
                class: 'makharij-airway',
                d: 'M151 127 C171 116 194 117 210 128 C199 139 179 143 154 141 M153 164 C177 158 207 162 230 179 C218 190 194 196 161 187 M230 177 C236 193 239 217 238 249'
            }),
            svgNode('path', {
                class: 'makharij-tongue',
                d: 'M158 189 C174 188 193 187 216 181 C211 194 194 201 171 199'
            }),
            svgNode('path', {
                class: 'makharij-detail-line',
                d: 'M285 112 C299 124 299 145 284 155 M157 165 C164 163 170 163 176 164 M155 180 C161 181 166 182 171 183'
            }),
            svgNode('circle', { class: 'makharij-eye', cx: '222', cy: '89', r: '4' }),
            svgNode('path', { class: 'makharij-ear', d: 'M310 128 C322 121 328 130 324 143 C321 153 312 153 311 143 M314 136 C319 133 321 138 317 142' }),
            svgNode('path', { class: 'makharij-teeth', d: 'M151 165 L160 165 L159 172 L151 171 M151 177 L158 178 L157 183 L151 181' })
        );

        points.forEach((point, index) => {
            const marker = svgNode('g', {
                class: `makharij-marker${index === 0 ? ' is-active' : ''}`,
                'data-makhraj-point': point.key,
                'aria-hidden': 'true'
            });
            marker.append(
                svgNode('circle', { class: 'makharij-marker-halo', cx: point.x, cy: point.y, r: '14' }),
                svgNode('circle', { class: 'makharij-marker-dot', cx: point.x, cy: point.y, r: '10' })
            );
            const number = svgNode('text', { class: 'makharij-marker-number', x: point.x, y: point.y + 3.5 });
            number.textContent = String(index + 1);
            marker.appendChild(number);
            illustration.appendChild(marker);
        });

        const caption = create('figcaption', 'makharij-figure-caption', 'Tampak samping sederhana · pilih nomor untuk melihat keterangannya.');
        figure.append(illustration, caption);
        const map = create('div', 'makharij-map');
        const detail = create('div', 'makharij-detail');
        detail.setAttribute('role', 'status');
        detail.setAttribute('aria-live', 'polite');
        const detailTitle = create('strong', 'makharij-detail-title', points[0].label);
        const detailText = create('span', 'makharij-detail-text', points[0].detail);
        detail.append(detailTitle, detailText);
        points.forEach((point, index) => {
            const button = create('button', 'makharij-hotspot');
            button.type = 'button';
            button.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
            const number = create('span', 'makharij-number', String(index + 1));
            number.setAttribute('aria-hidden', 'true');
            button.append(number, create('strong', '', point.label));
            button.addEventListener('click', () => {
                map.querySelectorAll('.makharij-hotspot').forEach((item) => item.setAttribute('aria-pressed', 'false'));
                button.setAttribute('aria-pressed', 'true');
                illustration.querySelectorAll('.makharij-marker').forEach((marker) => {
                    marker.classList.toggle('is-active', marker.dataset.makhrajPoint === point.key);
                });
                detailTitle.textContent = point.label;
                detailText.textContent = point.detail;
            });
            map.appendChild(button);
        });
        container.append(figure, map, detail);
    }

    function renderExamples(container, examples, isHijaiyah) {
        const grid = create('div', isHijaiyah ? 'hijaiyah-grid' : 'lesson-examples');
        examples.forEach((example) => {
            const card = create('div', isHijaiyah ? 'hijaiyah-card' : 'lesson-example');
            card.appendChild(create('span', 'lesson-example-arabic', example.arabic));
            card.appendChild(create('span', 'lesson-example-label', example.label));
            if (!isHijaiyah) card.appendChild(create('span', 'lesson-example-detail', example.detail));
            card.appendChild(makeAudioButton(example.audio));
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    function renderLesson(lesson) {
        activeLesson = lesson;
        document.querySelector('[data-lesson-kicker]').textContent = `LANGKAH ${lesson.number} · ${levels[state.level].label.toUpperCase()}`;
        document.getElementById('lesson-title').textContent = lesson.title;
        document.getElementById('lesson-summary').textContent = lesson.summary;
        document.querySelector('[data-lesson-tip]').textContent = levels[state.level].guidance + ' ' + lesson.tips[state.level];
        document.getElementById('audio-status').textContent = '';
        document.getElementById('audio-status').className = 'lesson-audio-status';
        lessonSections.replaceChildren();

        lesson.sections.forEach((section) => {
            const wrapper = create('section', 'lesson-section');
            wrapper.appendChild(create('h3', '', section.title));
            wrapper.appendChild(create('p', '', section.text));
            if (lesson.id === 'makharij' && section.title === 'Lima kelompok makhraj') {
                renderMakhrajMap(wrapper);
            }
            if (section.letters) {
                renderExamples(wrapper, letters.map((letter) => ({
                    arabic: letter[0],
                    label: letter[1],
                    detail: letter[2],
                    audio: `${letter[4]} ${letter[2]}`
                })), true);
            }
            if (section.examples) renderExamples(wrapper, section.examples, false);
            if (section.note) wrapper.appendChild(create('div', 'lesson-note', section.note));
            lessonSections.appendChild(wrapper);
        });
        if (currentProgress().completed.includes(lesson.id)) {
            document.getElementById('lesson-complete').textContent = 'Materi sudah selesai ✓';
        } else {
            document.getElementById('lesson-complete').textContent = 'Tandai selesai ✓';
        }
        if (!lessonDialog.open) lessonDialog.showModal();
    }

    function openQuiz() {
        const questions = quizzes[state.level];
        quizForm.reset();
        document.getElementById('quiz-result').hidden = true;
        document.getElementById('quiz-status').textContent = '';
        document.querySelector('[data-quiz-intro]').textContent = `Lima pertanyaan jalur ${levels[state.level].label}. Jawabanmu akan membantu menentukan materi yang sebaiknya diulang.`;
        quizQuestions.replaceChildren();

        questions.forEach((question, index) => {
            const fieldset = create('fieldset', 'quiz-question');
            const legend = create('legend', '', `${index + 1}. ${question.question}`);
            fieldset.appendChild(legend);
            const options = create('div', 'quiz-options');
            question.options.forEach((option, optionIndex) => {
                const label = create('label', 'quiz-option');
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = `question-${index}`;
                input.value = String(optionIndex);
                input.required = optionIndex === 0;
                label.appendChild(input);
                label.appendChild(create('span', '', option));
                options.appendChild(label);
            });
            fieldset.appendChild(options);
            quizQuestions.appendChild(fieldset);
        });
        if (!quizDialog.open) quizDialog.showModal();
    }

    function showQuizResult(answers) {
        const questions = quizzes[state.level];
        let correct = 0;
        const missed = [];
        questions.forEach((question, index) => {
            if (Number(answers.get(`question-${index}`)) === question.answer) correct += 1;
            else if (!missed.includes(question.lesson)) missed.push(question.lesson);
        });
        const score = Math.round((correct / questions.length) * 100);
        const progress = currentProgress();
        progress.quiz = { score, missed };
        saveState();
        updateProgress();

        const result = document.getElementById('quiz-result');
        result.hidden = false;
        document.querySelector('[data-quiz-score]').textContent = `${score}%`;
        document.querySelector('[data-quiz-score-copy]').textContent = `${correct} dari ${questions.length} jawaban benar`;
        const title = document.querySelector('[data-quiz-recommendation-title]');
        const message = document.querySelector('[data-quiz-recommendation]');
        const action = document.getElementById('quiz-recommendation-action');
        const levelIndex = levelIds.indexOf(state.level);
        if (missed.length) {
            recommendationTarget = { type: 'lesson', id: missed[0] };
            const lesson = lessonById[missed[0]];
            title.textContent = 'Ulangi satu langkah ini';
            message.textContent = `Kamu bisa memperkuat pemahaman pada materi ${lesson.title}. Buka kembali contohnya, lalu coba evaluasi sekali lagi.`;
            action.textContent = `Buka ${lesson.title}`;
        } else if (levelIndex < levelIds.length - 1) {
            const nextLevel = levelIds[levelIndex + 1];
            recommendationTarget = { type: 'level', id: nextLevel };
            title.textContent = 'Siap naik jalur';
            message.textContent = `Bagus! Semua jawaban tepat. Jalur ${levels[nextLevel].label} akan memberi latihan yang lebih menantang.`;
            action.textContent = `Lihat jalur ${levels[nextLevel].label}`;
        } else {
            recommendationTarget = { type: 'lesson', id: 'waqaf' };
            title.textContent = 'Pertahankan ketelitian';
            message.textContent = 'Bagus! Ulangi materi Waqaf & Ibtida sambil berlatih membaca bersama guru untuk mendapat koreksi langsung.';
            action.textContent = 'Buka Waqaf & Ibtida';
        }
    }

    function speak(text) {
        const status = document.getElementById('audio-status');
        status.textContent = `Contoh tertulis: ${text}. Gunakan pemutar Mushaf terverifikasi untuk mendengar bacaan qari kredibel.`;
        status.className = 'lesson-audio-status';
    }

    async function playVerifiedExample() {
        const status = document.getElementById('audio-status');
        const player = document.getElementById('verified-audio-player');
        status.textContent = 'Memuat contoh bacaan Mushaf dari Equran.id...';
        status.className = 'lesson-audio-status';
        try {
            if (!verifiedAudioCache) {
                const response = await fetch('https://equran.id/api/v2/surat/1');
                if (!response.ok) throw new Error('Layanan audio merespons dengan status yang tidak valid.');
                const payload = await response.json();
                if (payload.code !== 200 || !payload.data || !payload.data.ayat || !payload.data.ayat.length) {
                    throw new Error('Data audio Mushaf tidak lengkap.');
                }
                verifiedAudioCache = payload.data.ayat
                    .map((ayah) => ayah.audio && ayah.audio['05'])
                    .filter(Boolean);
            }
            if (!verifiedAudioCache.length) throw new Error('Audio Misyari Rasyid Al-Afasi tidak tersedia.');
            player.src = verifiedAudioCache[0];
            player.load();
            await player.play();
            status.textContent = 'Memutar Al-Fatihah ayat 1 oleh Misyari Rasyid Al-Afasi.';
            status.className = 'lesson-audio-status';
        } catch (error) {
            console.error('Gagal memuat audio Mushaf:', error);
            status.textContent = 'Contoh Mushaf gagal dimuat. Periksa koneksi internet atau coba kembali.';
            status.className = 'lesson-audio-status error';
        }
    }

    document.querySelectorAll('[data-learning-level]').forEach((button) => {
        button.addEventListener('click', () => selectLevel(button.dataset.learningLevel));
    });
    document.querySelectorAll('[data-lesson-id]').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.lessonId === 'evaluasi') openQuiz();
            else if (lessonById[button.dataset.lessonId]) renderLesson(lessonById[button.dataset.lessonId]);
        });
    });
    document.querySelectorAll('[data-close-lesson]').forEach((button) => {
        button.addEventListener('click', () => lessonDialog.close());
    });
    document.querySelectorAll('[data-close-quiz]').forEach((button) => {
        button.addEventListener('click', () => quizDialog.close());
    });
    [lessonDialog, quizDialog].forEach((dialog) => {
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.close();
        });
    });
    lessonSections.addEventListener('click', (event) => {
        const button = event.target.closest('[data-speak]');
        if (button) speak(button.dataset.speak);
    });
    document.getElementById('play-verified-example').addEventListener('click', playVerifiedExample);
    document.getElementById('lesson-complete').addEventListener('click', () => {
        if (!activeLesson) return;
        const completed = currentProgress().completed;
        if (!completed.includes(activeLesson.id)) completed.push(activeLesson.id);
        saveState();
        updateProgress();
        lessonDialog.close();
    });
    quizForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!quizForm.reportValidity()) {
            document.getElementById('quiz-status').textContent = 'Pilih satu jawaban pada setiap pertanyaan.';
            return;
        }
        document.getElementById('quiz-status').textContent = '';
        showQuizResult(new FormData(quizForm));
    });
    document.getElementById('quiz-recommendation-action').addEventListener('click', () => {
        if (!recommendationTarget) return;
        quizDialog.close();
        if (recommendationTarget.type === 'lesson') {
            renderLesson(lessonById[recommendationTarget.id]);
        } else {
            selectLevel(recommendationTarget.id);
            document.getElementById('pilih-materi').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
    window.addEventListener('beforeunload', () => {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    });

    selectLevel(state.level);
    updateProgress();
}());
