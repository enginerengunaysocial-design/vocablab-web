import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Moon, Play, RotateCcw, Sparkles, Sun, Volume2, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";

type Word = { id: number; english: string; meaning: string; position: number };
type Unit = { id: number; unitNumber: number; name: string; words: Word[] };
type Grade = { id: number; grade: number; name: string; units: Unit[]; wordCount: number };
type Ad = { slotKey: string; title: string; type: string; content: string; adsenseClient: string; adsenseSlot: string; videoUrl: string };
type Option = { id: string; label: string; correct: boolean };

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function playTone(correct: boolean) {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = correct ? 680 : 190;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {
    // Ses motoru kapalıysa quiz akışı çalışmaya devam eder.
  }
}

function speakWord(word: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-GB";
  utterance.rate = 0.82;
  const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith("en-gb"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function AdSlot({ ad, compact = false }: { ad?: Ad; compact?: boolean }) {
  if (!ad || ad.type === "placeholder") {
    return <div className={`ad-slot ${compact ? "ad-slot-compact" : ""}`}><span>REKLAM ALANI</span><small>AdSense / video için hazır alan</small></div>;
  }
  if (ad.type === "video" && ad.videoUrl) {
    return <div className="ad-slot ad-slot-media"><span>{ad.title}</span><video controls src={ad.videoUrl} /></div>;
  }
  if (ad.type === "adsense") {
    return <div className="ad-slot ad-slot-adsense"><span>{ad.title}</span><small>AdSense slot: {ad.adsenseSlot || "henüz girilmedi"}</small></div>;
  }
  return <div className="ad-slot ad-slot-copy"><span>{ad.title}</span><p>{ad.content || "Reklam içeriği admin panelinden eklenecek."}</p></div>;
}

function BrandMark() {
  return <Link href="/" className="brand-mark" aria-label="VocabularyLab ana sayfa"><span className="brand-icon"><i /><i /><i /></span><span>VocabularyLab</span></Link>;
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const catalogQuery = trpc.content.catalog.useQuery(undefined, { staleTime: 60_000 });
  const adsQuery = trpc.content.ads.useQuery(undefined, { staleTime: 60_000 });
  const trackVisit = trpc.analytics.trackVisit.useMutation();
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [quizItems, setQuizItems] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const catalog = (catalogQuery.data ?? []) as Grade[];
  const selectedGradeData = catalog.find(item => item.grade === selectedGrade);
  const selectedUnit = selectedGradeData?.units.find(item => item.id === selectedUnitId);
  const currentWord = quizItems[currentIndex];
  const totalWords = catalog.reduce((sum, grade) => sum + grade.wordCount, 0);
  const ads = (adsQuery.data ?? []) as Ad[];
  const heroAd = ads.find(ad => ad.slotKey === "hero");
  const quizAd = ads.find(ad => ad.slotKey === "quiz");

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const key = `vocablab-visit-${today}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      trackVisit.mutate();
    }
  }, []);

  const options = useMemo<Option[]>(() => {
    if (!currentWord) return [];
    const allWords = selectedGradeData?.units.flatMap(unit => unit.words) ?? [];
    const correctLabel = currentWord.meaning || currentWord.english;
    const distractors = shuffle(allWords.filter(word => word.id !== currentWord.id && (word.meaning || word.english) !== correctLabel))
      .slice(0, 3)
      .map(word => word.meaning || word.english);
    return shuffle([{ id: `correct-${currentWord.id}`, label: correctLabel, correct: true }, ...distractors.map((label, index) => ({ id: `wrong-${currentWord.id}-${index}`, label, correct: false }))]);
  }, [currentWord, selectedGradeData]);

  const chooseGrade = (grade: number) => {
    setSelectedGrade(grade);
    setSelectedUnitId(null);
    setQuizItems([]);
    setCompleted(false);
  };

  const chooseUnit = (unit: Unit) => {
    setSelectedUnitId(unit.id);
    setQuizItems(shuffle(unit.words));
    setCurrentIndex(0);
    setAnswerId(null);
    setCompleted(false);
  };

  const answer = (option: Option) => {
    if (answerId || !currentWord) return;
    setAnswerId(option.id);
    playTone(option.correct);
    window.setTimeout(() => {
      if (currentIndex >= quizItems.length - 1) {
        setCompleted(true);
        return;
      }
      setCurrentIndex(index => index + 1);
      setAnswerId(null);
    }, 1200);
  };

  const resetQuiz = () => {
    if (!selectedUnit) return;
    setQuizItems(shuffle(selectedUnit.words));
    setCurrentIndex(0);
    setAnswerId(null);
    setCompleted(false);
  };

  return (
    <div className="site-shell">
      <header className="site-header container">
        <BrandMark />
        <div className="header-actions">
          <Link href="/admin" className="text-link">Admin paneli <ArrowRight size={15} /></Link>
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Koyu modu değiştir">
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}<span>{theme === "dark" ? "Açık" : "Koyu"}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero container">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> ENGLISH WORD LAB</span>
            <h1>Kelimeleri <em>öğren.</em><br />Cümleye taşı.</h1>
            <p className="hero-lead">Sınıfını seç, üniteyi aç ve her gün birkaç kelimeyi kalıcı hale getir. Kısa quizler, İngiliz aksanlı telaffuz ve anında geri bildirim.</p>
            <div className="hero-note"><span>LAB NOTE</span><strong>Bugün kaç kelimeyi cebine koyacaksın?</strong></div>
          </div>
          <div className="hero-aside">
            <div className="stat-card"><span>GÜNCEL KELİME SAYISI</span><strong>{catalogQuery.isLoading ? "—" : totalWords.toLocaleString("tr-TR")}</strong><small>2–12. sınıf toplamı</small></div>
            <AdSlot ad={heroAd} />
          </div>
        </section>

        <section className="grade-section container">
          <div className="section-heading"><div><span className="section-kicker">01 / LEVEL SELECT</span><h2>Sınıfını seç</h2></div><p>Her seviyede kendi hızında ilerle.</p></div>
          <div className="grade-rail">
            {Array.from({ length: 11 }, (_, index) => index + 2).map(grade => {
              const item = catalog.find(entry => entry.grade === grade);
              return <button key={grade} className={`grade-tile ${selectedGrade === grade ? "is-active" : ""}`} onClick={() => chooseGrade(grade)}><span>{grade}</span><small>{item?.wordCount ?? "—"} kelime</small></button>;
            })}
          </div>
        </section>

        {selectedGradeData && !selectedUnit && (
          <section className="unit-section container" id="units">
            <div className="section-heading"><div><span className="section-kicker">02 / UNIT MAP</span><h2>{selectedGradeData.name} üniteleri</h2></div><button className="text-link" onClick={() => setSelectedGrade(null)}>Seviyeyi değiştir <X size={15} /></button></div>
            <div className="unit-grid">
              {selectedGradeData.units.map(unit => <button key={unit.id} className="unit-card" onClick={() => chooseUnit(unit)}><span className="unit-number">UNIT {String(unit.unitNumber).padStart(2, "0")}</span><strong>{unit.name}</strong><span className="unit-meta">{unit.words.length} kelime <ArrowRight size={15} /></span></button>)}
            </div>
          </section>
        )}

        {selectedUnit && (
          <section className="quiz-section container" id="quiz">
            <div className="quiz-topline"><button className="back-button" onClick={() => { setSelectedUnitId(null); setQuizItems([]); }}><ArrowLeft size={15} /> Ünite listesine dön</button><span>{selectedGradeData?.name} / {selectedUnit.name}</span></div>
            <div className="quiz-layout">
              <div className="quiz-card">
                <div className="quiz-progress"><span>{completed ? quizItems.length : currentIndex + 1} / {quizItems.length}</span><div><i style={{ width: `${completed ? 100 : ((currentIndex + 1) / Math.max(quizItems.length, 1)) * 100}%` }} /></div></div>
                {completed ? (
                  <div className="quiz-complete"><span className="complete-mark"><Check size={30} /></span><span className="section-kicker">SESSION COMPLETE</span><h2>Ünite tamamlandı.</h2><p>{selectedUnit.name} içindeki {quizItems.length} kelimenin hepsini gördün. Bir tur daha oynayarak tekrar edebilirsin.</p><button className="primary-button" onClick={resetQuiz}><RotateCcw size={17} /> Tekrar başlat</button></div>
                ) : (
                  <>
                    <span className="section-kicker">QUESTION {String(currentIndex + 1).padStart(2, "0")}</span>
                    <div className="word-row"><h2>{currentWord?.english}</h2><button className="sound-button" onClick={() => currentWord && speakWord(currentWord.english)} aria-label={`${currentWord?.english} kelimesini seslendir`}><Volume2 size={22} /><span>UK</span></button></div>
                    <p className="question-prompt">Bu kelimenin Türkçe karşılığı hangisi?</p>
                    <div className="options-grid">{options.map(option => <button key={option.id} disabled={Boolean(answerId)} className={`option-button ${answerId === option.id ? (option.correct ? "is-correct" : "is-wrong") : ""} ${answerId && option.correct ? "show-correct" : ""}`} onClick={() => answer(option)}><span className="option-letter">{String.fromCharCode(65 + options.indexOf(option))}</span><span>{option.label}</span>{answerId === option.id && option.correct && <Check size={17} />}{answerId === option.id && !option.correct && <X size={17} />}</button>)}</div>
                    <p className="quiz-tip"><Play size={13} fill="currentColor" /> Bir şık seçtiğinde sonraki kelime otomatik açılır.</p>
                  </>
                )}
              </div>
              <aside className="quiz-aside"><div className="side-note"><span className="section-kicker">STUDY MODE</span><strong>Karışık sırada<br />kalıcı tekrar.</strong><p>Çeldiriciler her soruda değişir. Kelimeyi duymak için ses düğmesine dokun.</p></div><AdSlot ad={quizAd} compact /></aside>
            </div>
          </section>
        )}

        {!selectedGrade && <section className="empty-state container"><div className="empty-line" /><span className="section-kicker">START HERE</span><h2>Bir sınıf seçerek<br /><em>çalışma masanı aç.</em></h2></section>}

        <section className="contact-section container"><div><span className="section-kicker">KEEP IN TOUCH</span><h2>Bir sorunuz mu var?</h2><p>Önerilerinizi ve içerik taleplerinizi bize iletin.</p></div><a className="contact-email" href="mailto:enginerengunaysocial@gmail.com">enginerengunaysocial@gmail.com <ArrowRight size={18} /></a></section>
      </main>
      <footer className="site-footer container"><BrandMark /><span>VocabularyLab · English, one word at a time.</span><span>© {new Date().getFullYear()}</span></footer>
    </div>
  );
}
