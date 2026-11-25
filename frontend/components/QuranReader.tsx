"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import "./ustad-online.css";

const QURAN_API = "https://api.quran.com/api/v4";
const TOTAL_PAGES = 604;

export interface QuranSurah {
  number: number;
  name: string;
  arabicName: string;
  translation: string;
  ayahCount: number;
  startPage: number;
}

export interface QuranVerse {
  verse_key: string;
  text_uthmani: string;
  translations: Array<{ text: string }>;
}

export interface QuranPageData {
  verses: QuranVerse[];
}

interface QuranReaderProps {
  surahs: QuranSurah[];
  initialPage: number;
  initialPages?: Record<number, QuranPageData>;
}

interface QuranApiChapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  translated_name?: { name?: string };
  verses_count: number;
  pages: number[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Layanan Al-Qur'an merespons dengan status ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export async function fetchQuranSurahs(): Promise<QuranSurah[]> {
  const payload = await fetchJson<{ chapters: QuranApiChapter[] }>(
    `${QURAN_API}/chapters?language=id`,
  );
  if (!Array.isArray(payload.chapters) || payload.chapters.length !== 114) {
    throw new Error("Data daftar surah tidak lengkap.");
  }

  return payload.chapters
    .map((chapter) => ({
      number: chapter.id,
      name: chapter.name_simple,
      arabicName: chapter.name_arabic,
      translation: chapter.translated_name?.name ?? "",
      ayahCount: chapter.verses_count,
      startPage: chapter.pages?.[0] ?? 0,
    }))
    .sort((a, b) => a.number - b.number);
}

export async function fetchQuranPage(page: number): Promise<QuranPageData> {
  if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) {
    throw new RangeError(`Nomor halaman harus antara 1 dan ${TOTAL_PAGES}.`);
  }
  const query = new URLSearchParams({
    fields: "text_uthmani",
    translations: "33",
    per_page: "50",
  });
  const payload = await fetchJson<QuranPageData>(
    `${QURAN_API}/verses/by_page/${page}?${query.toString()}`,
  );
  if (!Array.isArray(payload.verses) || payload.verses.length === 0 ||
      payload.verses.some((verse) => !verse.verse_key || !verse.text_uthmani)) {
    throw new Error(`Data halaman ${page} tidak lengkap.`);
  }
  return payload;
}

function plainText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function PageVerses({
  verses,
  language,
}: {
  verses: QuranVerse[];
  language: "ar" | "id";
}) {
  return (
    <div className={`uo-verses ${language === "ar" ? "is-arabic" : ""}`}>
      {verses.map((verse) => (
        <article className="uo-verse" key={verse.verse_key}>
          <span className="uo-verse-number">{verse.verse_key.split(":")[1]}</span>
          {language === "ar" ? (
            <p lang="ar" dir="rtl">{verse.text_uthmani}</p>
          ) : (
            <p>{plainText(verse.translations?.[0]?.text ?? "Terjemahan belum tersedia.")}</p>
          )}
        </article>
      ))}
    </div>
  );
}

const MemoPageVerses = memo(PageVerses);

export function QuranReader({
  surahs,
  initialPage,
  initialPages = {},
}: QuranReaderProps) {
  const sortedSurahs = useMemo(
    () => [...surahs].sort((a, b) => a.number - b.number),
    [surahs],
  );
  const initialPageNumber = Number.isInteger(initialPage)
    ? Math.min(TOTAL_PAGES, Math.max(1, initialPage))
    : 1;
  const hasCompleteSurahList = sortedSurahs.length === 114 &&
    sortedSurahs.every((surah, index) => surah.number === index + 1);
  const [currentPage, setCurrentPage] = useState(initialPageNumber);
  const [pageInput, setPageInput] = useState(String(initialPageNumber));
  const [pages, setPages] = useState(initialPages);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const pagePromises = useRef(new Map<number, Promise<QuranPageData>>());
  const navigationVersion = useRef(0);

  const loadPage = useCallback((page: number) => {
    if (pages[page]) return Promise.resolve(pages[page]);
    const existingRequest = pagePromises.current.get(page);
    if (existingRequest) return existingRequest;

    const request = fetchQuranPage(page)
      .then((data) => {
        setPages((current) => current[page] ? current : { ...current, [page]: data });
        return data;
      })
      .finally(() => pagePromises.current.delete(page));
    pagePromises.current.set(page, request);
    return request;
  }, [pages]);

  const showPage = useCallback(async (page: number) => {
    const target = Math.min(TOTAL_PAGES, Math.max(1, Math.trunc(page)));
    if (!Number.isFinite(target)) return;

    const requestVersion = ++navigationVersion.current;
    setCurrentPage(target);
    setPageInput(String(target));
    setErrorMessage("");
    setLoadingPage(null);
    if (pages[target]) return;

    setLoadingPage(target);
    try {
      await loadPage(target);
    } catch (error) {
      console.error("Halaman mushaf tidak dapat dimuat:", error);
      if (navigationVersion.current === requestVersion) {
        setErrorMessage("Halaman belum dapat dimuat. Periksa koneksi, lalu coba lagi.");
      }
    } finally {
      if (navigationVersion.current === requestVersion) {
        setLoadingPage(null);
      }
    }
  }, [loadPage, pages]);

  const currentData = pages[currentPage];
  const firstVerse = currentData?.verses[0];
  const currentSurahNumber = firstVerse
    ? Number(firstVerse.verse_key.split(":")[0])
    : null;
  const currentSurah = sortedSurahs.find(
    (surah) => surah.number === currentSurahNumber,
  );
  const filteredSurahs = sortedSurahs.filter((surah) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
    return !normalizedQuery ||
      `${surah.number} ${surah.name} ${surah.translation}`
        .toLocaleLowerCase("id-ID")
        .includes(normalizedQuery);
  });

  useEffect(() => {
    if (!currentData) return;
    try {
      window.localStorage.setItem("ustadOnline.lastReadPage", String(currentPage));
    } catch (error) {
      console.error("Posisi mushaf tidak dapat disimpan:", error);
    }
  }, [currentData, currentPage]);

  useEffect(() => {
    const adjacentPages = [currentPage - 1, currentPage + 1]
      .filter((page) => page >= 1 && page <= TOTAL_PAGES && !pages[page]);
    adjacentPages.forEach((page) => {
      void loadPage(page).catch((error: unknown) => {
        console.warn(`Halaman ${page} tidak berhasil disiapkan lebih awal:`, error);
      });
    });
  }, [currentPage, loadPage, pages]);

  function handlePageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedPage = Number(pageInput);
    if (Number.isInteger(requestedPage) && requestedPage >= 1 &&
        requestedPage <= TOTAL_PAGES) {
      void showPage(requestedPage);
    } else {
      setPageInput(String(currentPage));
    }
  }

  function handleSurahChange(value: string) {
    const surah = sortedSurahs.find((item) => item.number === Number(value));
    if (surah?.startPage) void showPage(surah.startPage);
  }

  if (!hasCompleteSurahList) {
    return <p role="alert">Daftar surah harus berisi lengkap 114 surah.</p>;
  }

  return (
    <section className="uo-quran" aria-label="Mushaf digital">
      <header className="uo-reader-toolbar">
        <label>
          Daftar surah
          <select
            value={currentSurahNumber ?? ""}
            onChange={(event) => handleSurahChange(event.target.value)}
          >
            <option value="" disabled>Pilih surah</option>
            {sortedSurahs.map((surah) => (
              <option key={surah.number} value={surah.number}>
                {surah.number}. {surah.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cari
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nama atau nomor surah"
          />
        </label>
        <details className="uo-surah-details">
          <summary>Jelajahi daftar surah lengkap (114)</summary>
          <div className="uo-surah-list" role="listbox" aria-label="Surah 1 sampai 114">
          {filteredSurahs.map((surah) => (
            <button
              key={surah.number}
              type="button"
              role="option"
              aria-selected={currentSurahNumber === surah.number}
              onClick={() => handleSurahChange(String(surah.number))}
            >
              <span>{surah.number}</span>
              <span>{surah.name}</span>
              <span lang="ar" dir="rtl">{surah.arabicName}</span>
            </button>
          ))}
          </div>
        </details>
      </header>

      <div className="uo-open-book" aria-busy={loadingPage === currentPage}>
        <article className="uo-book-page uo-translation-page">
          <header className="uo-page-heading">
            <strong>{currentSurah?.name ?? "Mushaf"}</strong>
            <span>{currentSurah?.translation ?? "Terjemahan Bahasa Indonesia"}</span>
          </header>
          {currentData && (
            <MemoPageVerses verses={currentData.verses} language="id" />
          )}
          <footer>Halaman {currentPage}</footer>
        </article>

        <article className="uo-book-page uo-arabic-page">
          <header className="uo-page-heading">
            <strong lang="ar" dir="rtl">
              {currentSurah?.arabicName ?? "الْقُرْآنُ الْكَرِيمُ"}
            </strong>
            <span>النص العثماني</span>
          </header>
          {currentData && (
            <MemoPageVerses verses={currentData.verses} language="ar" />
          )}
          <footer lang="ar" dir="rtl">الصفحة {currentPage}</footer>
        </article>
      </div>

      <p className="uo-reader-status" role="status" aria-live="polite">
        {errorMessage || (loadingPage === currentPage
          ? `Memuat halaman ${currentPage}...`
          : currentData
            ? `${currentData.verses.length} ayat · ${currentSurah?.name ?? "Al-Qur'an"}`
            : "Menyiapkan halaman mushaf...")}
      </p>

      <form className="uo-page-controls" onSubmit={handlePageSubmit}>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => void showPage(currentPage - 1)}
        >
          Sebelumnya
        </button>
        <span>Halaman {currentPage} dari {TOTAL_PAGES}</span>
        <button
          type="button"
          disabled={currentPage >= TOTAL_PAGES}
          onClick={() => void showPage(currentPage + 1)}
        >
          Selanjutnya
        </button>
        <label>
          Buka halaman
          <input
            type="number"
            min="1"
            max={TOTAL_PAGES}
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
          />
        </label>
        <button type="submit">Buka</button>
      </form>
    </section>
  );
}
