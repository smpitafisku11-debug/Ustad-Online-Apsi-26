(function () {
    'use strict';

    const prayers = [
        {
            id: 'morning-name-protection', category: 'pagi-petang', title: 'Perlindungan dengan nama Allah',
            arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
            transliteration: 'Bismillāhilladzī lā yaḍurru ma‘asmihī syai’un fil-arḍi wa lā fis-samā’i wa huwas-samī‘ul-‘alīm.',
            meaning: 'Dengan nama Allah, yang bersama nama-Nya tidak ada sesuatu pun di bumi dan di langit yang dapat membahayakan. Dia Maha Mendengar, Maha Mengetahui.',
            reference: 'HR. Abu Dawud 5088 dan At-Tirmidzi 3388 · dibaca 3 kali pagi dan petang.',
            repeat: 3
        },
        {
            id: 'morning-contentment', category: 'pagi-petang', title: 'Ridha kepada Allah, Islam, dan Nabi',
            arabic: 'رَضِيتُ بِاللَّهِ رَبًّا وَبِالْإِسْلَامِ دِينًا وَبِمُحَمَّدٍ نَبِيًّا',
            transliteration: 'Raḍītu billāhi rabban, wa bil-islāmi dīnan, wa bi Muḥammadin nabiyyan.',
            meaning: 'Aku ridha Allah sebagai Tuhanku, Islam sebagai agamaku, dan Muhammad sebagai nabiku.',
            reference: 'HR. Abu Dawud 5072 · dibaca 3 kali pagi dan petang.',
            repeat: 3
        },
        {
            id: 'morning-day-cycle', category: 'pagi-petang', title: 'Dzikir pagi',
            arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ',
            transliteration: 'Allāhumma bika aṣbaḥnā wa bika amsainā wa bika naḥyā wa bika namūtu wa ilaikan-nusyūr.',
            meaning: 'Ya Allah, dengan pertolongan-Mu kami memasuki pagi dan petang, dengan-Mu kami hidup dan mati, dan kepada-Mu kami dibangkitkan.',
            reference: 'HR. Abu Dawud 5068 dan At-Tirmidzi 3391 · redaksi pagi.',
            repeat: 1
        },
        {
            id: 'morning-ikhlas', category: 'pagi-petang', title: 'Surah Al-Ikhlas',
            arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ',
            transliteration: 'Qul huwallāhu aḥad. Allāhuṣ-ṣamad. Lam yalid wa lam yūlad. Wa lam yakul-lahū kufuwan aḥad.',
            meaning: 'Katakanlah: Dialah Allah Yang Maha Esa. Allah tempat meminta segala sesuatu. Dia tidak beranak dan tidak pula diperanakkan, dan tidak ada sesuatu yang setara dengan-Nya.',
            reference: 'Al-Qur’an, Surah Al-Ikhlas (112:1–4) · dibaca 3 kali pagi dan petang.',
            repeat: 3
        },
        {
            id: 'morning-falaq', category: 'pagi-petang', title: 'Surah Al-Falaq',
            arabic: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ',
            transliteration: 'Qul a‘ūdzu birabbil-falaq. Min syarri mā khalaq. Wa min syarri ghāsiqin idzā waqab. Wa min syarrin-naffātsāti fil-‘uqad. Wa min syarri ḥāsidin idzā ḥasad.',
            meaning: 'Katakanlah: Aku berlindung kepada Tuhan yang menguasai subuh, dari kejahatan makhluk-Nya, dari kejahatan malam apabila gelap, dari kejahatan para peniup pada buhul-buhul, dan dari kejahatan orang yang dengki apabila ia dengki.',
            reference: 'Al-Qur’an, Surah Al-Falaq (113:1–5) · dibaca 3 kali pagi dan petang.',
            repeat: 3
        },
        {
            id: 'morning-nas', category: 'pagi-petang', title: 'Surah An-Nas',
            arabic: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَٰهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ',
            transliteration: 'Qul a‘ūdzu birabbin-nās. Malikin-nās. Ilāhin-nās. Min syarril-waswāsil-khannās. Alladzī yuwaswisu fī ṣudūrin-nās. Minal-jinnati wan-nās.',
            meaning: 'Katakanlah: Aku berlindung kepada Tuhan manusia, Raja manusia, sembahan manusia, dari kejahatan bisikan setan yang bersembunyi, yang membisikkan kejahatan ke dalam dada manusia, dari golongan jin dan manusia.',
            reference: 'Al-Qur’an, Surah An-Nas (114:1–6) · dibaca 3 kali pagi dan petang.',
            repeat: 3
        },
        {
            id: 'after-prayer-istighfar', category: 'setelah-salat', title: 'Memohon ampun setelah salam',
            arabic: 'أَسْتَغْفِرُ اللَّهَ',
            transliteration: 'Astaghfirullāh.',
            meaning: 'Aku memohon ampun kepada Allah.',
            reference: 'HR. Muslim 591 · dibaca 3 kali setelah salat fardu.',
            repeat: 3
        },
        {
            id: 'after-prayer-peace', category: 'setelah-salat', title: 'Doa setelah istighfar',
            arabic: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ',
            transliteration: 'Allāhumma antas-salām wa minkas-salām, tabārakta yā dzal-jalāli wal-ikrām.',
            meaning: 'Ya Allah, Engkaulah Yang Maha Sejahtera dan dari-Mu kesejahteraan. Maha Berkah Engkau, wahai Pemilik keagungan dan kemuliaan.',
            reference: 'HR. Muslim 591 · dibaca setelah salat fardu.',
            repeat: 1
        },
        {
            id: 'after-prayer-tasbih', category: 'setelah-salat', title: 'Tasbih',
            arabic: 'سُبْحَانَ اللَّهِ',
            transliteration: 'Subḥānallāh.',
            meaning: 'Mahasuci Allah.',
            reference: 'HR. Muslim 597 · dibaca 33 kali setelah salat fardu.',
            repeat: 33
        },
        {
            id: 'after-prayer-tahmid', category: 'setelah-salat', title: 'Tahmid',
            arabic: 'الْحَمْدُ لِلَّهِ',
            transliteration: 'Alḥamdulillāh.',
            meaning: 'Segala puji bagi Allah.',
            reference: 'HR. Muslim 597 · dibaca 33 kali setelah salat fardu.',
            repeat: 33
        },
        {
            id: 'after-prayer-takbir', category: 'setelah-salat', title: 'Takbir',
            arabic: 'اللَّهُ أَكْبَرُ',
            transliteration: 'Allāhu akbar.',
            meaning: 'Allah Maha Besar.',
            reference: 'HR. Muslim 597 · dibaca 33 kali setelah salat fardu.',
            repeat: 33
        },
        {
            id: 'after-prayer-tahlil', category: 'setelah-salat', title: 'Penutup dzikir setelah salat',
            arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
            transliteration: 'Lā ilāha illallāhu waḥdahu lā syarīka lah, lahul-mulku wa lahul-ḥamdu wa huwa ‘alā kulli syai’in qadīr.',
            meaning: 'Tidak ada tuhan selain Allah semata, tidak ada sekutu bagi-Nya. Milik-Nya kerajaan dan segala puji, dan Dia Mahakuasa atas segala sesuatu.',
            reference: 'HR. Muslim 597 · dibaca sekali sebagai penyempurna rangkaian dzikir.',
            repeat: 1
        },
        {
            id: 'daily-parents', category: 'harian', title: 'Doa untuk kedua orang tua',
            arabic: 'رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
            transliteration: 'Rabbirḥamhumā kamā rabbayānī ṣaghīrā.',
            meaning: 'Wahai Tuhanku, sayangilah keduanya sebagaimana mereka berdua telah mendidikku pada waktu kecil.',
            reference: 'Al-Qur’an, Surah Al-Isra’ (17:24).',
            repeat: 1
        },
        {
            id: 'daily-knowledge', category: 'harian', title: 'Memohon tambahan ilmu',
            arabic: 'رَبِّ زِدْنِي عِلْمًا',
            transliteration: 'Rabbi zidnī ‘ilmā.',
            meaning: 'Wahai Tuhanku, tambahkanlah ilmu kepadaku.',
            reference: 'Al-Qur’an, Surah Taha (20:114).',
            repeat: 1
        },
        {
            id: 'daily-eating', category: 'harian', title: 'Sebelum makan',
            arabic: 'بِسْمِ اللَّهِ',
            transliteration: 'Bismillāh.',
            meaning: 'Dengan nama Allah.',
            reference: 'HR. Al-Bukhari 5376 dan Muslim 2022 · membaca basmalah sebelum makan.',
            repeat: 1
        },
        {
            id: 'daily-after-eating', category: 'harian', title: 'Setelah makan',
            arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
            transliteration: 'Alḥamdulillāhilladzī aṭ‘amanī hādzā wa razaqanīhi min ghairi ḥaulim minnī wa lā quwwah.',
            meaning: 'Segala puji bagi Allah yang telah memberiku makanan ini dan menganugerahkannya tanpa daya dan kekuatan dariku.',
            reference: 'HR. Abu Dawud 4023 dan At-Tirmidzi 3458.',
            repeat: 1
        },
        {
            id: 'daily-sleep', category: 'harian', title: 'Sebelum tidur',
            arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
            transliteration: 'Bismika Allāhumma amūtu wa aḥyā.',
            meaning: 'Dengan nama-Mu, ya Allah, aku mati dan aku hidup.',
            reference: 'HR. Al-Bukhari 6324.',
            repeat: 1
        },
        {
            id: 'daily-home', category: 'harian', title: 'Keluar rumah',
            arabic: 'بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
            transliteration: 'Bismillāhi tawakkaltu ‘alallāh, wa lā ḥaula wa lā quwwata illā billāh.',
            meaning: 'Dengan nama Allah, aku bertawakal kepada Allah. Tidak ada daya dan kekuatan kecuali dengan pertolongan Allah.',
            reference: 'HR. Abu Dawud 5095 dan At-Tirmidzi 3426.',
            repeat: 1
        }
    ];

    const categoryLabels = {
        'pagi-petang': 'Pagi & petang · pilihan Al-Ma’tsurat',
        'setelah-salat': 'Dzikir setelah salat',
        harian: 'Doa sehari-hari'
    };
    const date = new Date();
    const dateKey = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    const storageKey = `ustadOnline.dzikirDoa.progress:${dateKey}`;
    const list = document.getElementById('prayer-list');
    const empty = document.getElementById('prayer-empty');
    const progressLabel = document.getElementById('daily-progress');
    const search = document.getElementById('prayer-search');
    let activeCategory = 'all';
    let progress = {};

    function loadProgress() {
        try {
            const stored = localStorage.getItem(storageKey);
            if (!stored) return {};
            const value = JSON.parse(stored);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Format progres dzikir tidak valid.');
            return value;
        } catch (error) {
            console.error('Progres dzikir tidak dapat dibaca:', error);
            return {};
        }
    }

    function saveProgress() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(progress));
        } catch (error) {
            console.error('Progres dzikir tidak dapat disimpan:', error);
        }
    }

    function completedCount() {
        return prayers.filter((prayer) => Number(progress[prayer.id]) >= prayer.repeat).length;
    }

    function createText(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        element.textContent = text;
        return element;
    }

    function render() {
        const query = search.value.trim().toLocaleLowerCase('id-ID');
        const filtered = prayers.filter((prayer) => {
            const matchesCategory = activeCategory === 'all' || prayer.category === activeCategory;
            const searchable = `${prayer.title} ${prayer.arabic} ${prayer.transliteration} ${prayer.meaning} ${prayer.reference}`.toLocaleLowerCase('id-ID');
            return matchesCategory && searchable.includes(query);
        });
        list.replaceChildren();
        empty.hidden = filtered.length !== 0;

        filtered.forEach((prayer) => {
            const count = Math.min(Number(progress[prayer.id]) || 0, prayer.repeat);
            const complete = count >= prayer.repeat;
            const card = document.createElement('article');
            card.className = `prayer-card${complete ? ' is-complete' : ''}`;

            const top = document.createElement('div');
            top.className = 'prayer-card-top';
            const titleGroup = document.createElement('div');
            titleGroup.append(
                createText('h3', '', prayer.title),
                createText('span', 'prayer-category', categoryLabels[prayer.category])
            );
            top.append(titleGroup, createText('span', 'prayer-repeat', `${prayer.repeat}×`));

            const arabic = createText('p', 'prayer-arabic', prayer.arabic);
            arabic.lang = 'ar';
            arabic.dir = 'rtl';
            const cardContent = document.createElement('div');
            cardContent.append(
                top,
                arabic,
                createText('p', 'prayer-transliteration', prayer.transliteration),
                createText('p', 'prayer-meaning', prayer.meaning),
                createText('p', 'prayer-reference', prayer.reference)
            );

            const actions = document.createElement('div');
            actions.className = 'prayer-card-actions';
            const counter = createText('span', 'prayer-counter', `${count}/${prayer.repeat}`);
            counter.setAttribute('aria-label', `${count} dari ${prayer.repeat} bacaan`);
            const increment = createText('button', '', '+1 bacaan');
            increment.type = 'button';
            increment.dataset.action = 'increment';
            increment.disabled = complete;
            increment.addEventListener('click', () => {
                progress[prayer.id] = Math.min(prayer.repeat, count + 1);
                saveProgress();
                render();
            });
            const markComplete = createText('button', '', complete ? 'Selesai ✓' : 'Tandai selesai');
            markComplete.type = 'button';
            markComplete.dataset.action = 'complete';
            markComplete.disabled = complete;
            markComplete.addEventListener('click', () => {
                progress[prayer.id] = prayer.repeat;
                saveProgress();
                render();
            });
            actions.append(counter, increment, markComplete);
            card.append(cardContent, actions);
            list.append(card);
        });

        progressLabel.textContent = `${completedCount()} dari ${prayers.length} dzikir/doa selesai`;
    }

    document.querySelectorAll('[data-prayer-filter]').forEach((button) => {
        button.addEventListener('click', () => {
            activeCategory = button.dataset.prayerFilter;
            document.querySelectorAll('[data-prayer-filter]').forEach((filter) => {
                const isActive = filter === button;
                filter.classList.toggle('is-active', isActive);
                filter.setAttribute('aria-pressed', String(isActive));
            });
            render();
        });
    });

    search.addEventListener('input', render);
    document.getElementById('reset-progress').addEventListener('click', () => {
        progress = {};
        saveProgress();
        render();
    });

    progress = loadProgress();
    render();
})();
