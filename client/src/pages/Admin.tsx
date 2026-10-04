import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Eye, LogOut, Pencil, Plus, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

type Word = { id: number; english: string; meaning: string; position: number };
type Unit = { id: number; unitNumber: number; name: string; words: Word[] };
type Grade = { id: number; grade: number; name: string; units: Unit[]; wordCount: number };
type AdType = "placeholder" | "adsense" | "text" | "video";
type Ad = { slotKey: string; title: string; type: AdType; content: string; adsenseClient: string; adsenseSlot: string; videoUrl: string };

export default function Admin() {
  const adminMe = trpc.admin.me.useQuery();
  const isAuthed = Boolean(adminMe.data?.authenticated);
  const dashboard = trpc.admin.dashboard.useQuery(undefined, { enabled: isAuthed });
  const login = trpc.admin.login.useMutation({ onSuccess: () => void adminMe.refetch() });
  const logout = trpc.admin.logout.useMutation({ onSuccess: () => void adminMe.refetch() });
  const updateClassMutation = trpc.admin.updateClass.useMutation();
  const createUnit = trpc.admin.createUnit.useMutation();
  const updateUnit = trpc.admin.updateUnit.useMutation();
  const deleteUnit = trpc.admin.deleteUnit.useMutation();
  const createWord = trpc.admin.createWord.useMutation();
  const updateWord = trpc.admin.updateWord.useMutation();
  const deleteWord = trpc.admin.deleteWord.useMutation();
  const updateAd = trpc.admin.updateAd.useMutation();

  const [tab, setTab] = useState<"content" | "ads">("content");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginMessage, setLoginMessage] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [unitDraft, setUnitDraft] = useState("");
  const [newUnit, setNewUnit] = useState({ grade: "2", name: "" });
  const [newWord, setNewWord] = useState({ english: "", meaning: "" });
  const [editingWord, setEditingWord] = useState<number | null>(null);
  const [wordDraft, setWordDraft] = useState({ english: "", meaning: "" });

  const catalog = (dashboard.data?.catalog ?? []) as Grade[];
  const ads = (dashboard.data?.ads ?? []) as Ad[];
  const activeGrade = catalog.find(item => item.grade === selectedGrade) ?? catalog[0];
  const activeUnit = activeGrade?.units.find(item => item.id === selectedUnitId) ?? activeGrade?.units[0];
  const totalWords = useMemo(() => catalog.reduce((sum, item) => sum + item.wordCount, 0), [catalog]);

  useEffect(() => {
    if (!selectedGrade && catalog[0]) setSelectedGrade(catalog[0].grade);
  }, [catalog, selectedGrade]);

  const refresh = () => void dashboard.refetch();
  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    setLoginMessage("");
    login.mutate(loginForm, { onSuccess: result => { if (!result.success) setLoginMessage(result.message); } });
  };
  const addUnit = (event: FormEvent) => {
    event.preventDefault();
    if (!newUnit.name.trim()) return;
    createUnit.mutate({ grade: Number(newUnit.grade), name: newUnit.name.trim() }, { onSuccess: () => { setNewUnit({ ...newUnit, name: "" }); refresh(); } });
  };
  const addWord = (event: FormEvent) => {
    event.preventDefault();
    if (!activeUnit || !newWord.english.trim()) return;
    createWord.mutate({ unitId: activeUnit.id, english: newWord.english.trim(), meaning: newWord.meaning.trim() }, { onSuccess: () => { setNewWord({ english: "", meaning: "" }); refresh(); } });
  };

  if (!isAuthed) {
    return <div className="admin-gate"><div className="admin-login-card"><Link href="/" className="back-button"><ArrowLeft size={15} /> Siteye dön</Link><div className="login-lock"><ShieldCheck size={25} /></div><span className="section-kicker">VOCABULARYLAB / PRIVATE</span><h1>Admin paneli</h1><p>İçerik, reklam alanları ve ziyaretçi istatistikleri yalnızca site yöneticisine açıktır.</p><form onSubmit={submitLogin}><label>Kullanıcı adı<input autoComplete="username" value={loginForm.username} onChange={event => setLoginForm({ ...loginForm, username: event.target.value })} placeholder="ereng_admin" /></label><label>Şifre<input type="password" autoComplete="current-password" value={loginForm.password} onChange={event => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="••••••••" /></label>{loginMessage && <div className="form-error">{loginMessage}</div>}<button className="primary-button full-width" disabled={login.isPending}><ShieldCheck size={17} /> {login.isPending ? "Kontrol ediliyor" : "Güvenli giriş"}</button></form><small className="login-hint">Bu panel sadece VocabularyLab yöneticisi içindir.</small></div></div>;
  }

  return <div className="admin-shell"><header className="admin-header container"><Link href="/" className="brand-mark"><span className="brand-icon"><i /><i /><i /></span><span>VocabularyLab</span></Link><div className="admin-header-right"><span className="admin-status"><span /> ereng_admin</span><Link href="/" className="text-link"><Eye size={15} /> Siteyi gör</Link><button className="ghost-button" onClick={() => logout.mutate()}><LogOut size={16} /> Çıkış</button></div></header><main className="admin-main container"><div className="admin-title-row"><div><span className="section-kicker">CONTROL ROOM / 01</span><h1>Admin paneli</h1><p>VocabularyLab içeriğini tek yerden güncelle.</p></div><div className="admin-tabs"><button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>İçerik yönetimi</button><button className={tab === "ads" ? "active" : ""} onClick={() => setTab("ads")}>Reklam alanları</button></div></div><div className="metric-grid"><div className="metric-card"><span>BUGÜNÜN ZİYARETÇİSİ</span><strong>{dashboard.data?.stats.today ?? 0}</strong><small>Tekil tarayıcı oturumu</small></div><div className="metric-card"><span>BU AY</span><strong>{dashboard.data?.stats.month ?? 0}</strong><small>Aylık toplam ziyaret</small></div><div className="metric-card"><span>AKTİF KELİMELER</span><strong>{totalWords.toLocaleString("tr-TR")}</strong><small>2–12. sınıf toplamı</small></div><div className="metric-card metric-card-accent"><span>GÜVENLİ ERİŞİM</span><strong><Check size={24} /></strong><small>Admin oturumu aktif</small></div></div>{tab === "content" ? <ContentManager catalog={catalog} activeGrade={activeGrade} activeUnit={activeUnit} selectedGrade={selectedGrade} setSelectedGrade={grade => { setSelectedGrade(grade); setSelectedUnitId(null); }} selectedUnitId={selectedUnitId} setSelectedUnitId={setSelectedUnitId} unitDraft={unitDraft} setUnitDraft={setUnitDraft} newUnit={newUnit} setNewUnit={setNewUnit} addUnit={addUnit} newWord={newWord} setNewWord={setNewWord} addWord={addWord} editingWord={editingWord} setEditingWord={setEditingWord} wordDraft={wordDraft} setWordDraft={setWordDraft} updateUnit={updateUnit} deleteUnit={deleteUnit} createWord={createWord} updateWord={updateWord} deleteWord={deleteWord} updateClass={updateClassMutation} refresh={refresh} /> : <div className="ads-manager"><div className="workspace-heading"><div><span className="section-kicker">MONETIZATION SETUP</span><h2>Reklam alanları</h2><p>Boş alanları AdSense, metin veya video ile özelleştir.</p></div></div>{ads.map(ad => <AdEditor key={ad.slotKey} ad={ad} onSave={payload => updateAd.mutate(payload, { onSuccess: refresh })} saving={updateAd.isPending} />)}</div>}</main></div>;
}

function ContentManager(props: { catalog: Grade[]; activeGrade?: Grade; activeUnit?: Unit; selectedGrade: number | null; setSelectedGrade: (grade: number) => void; selectedUnitId: number | null; setSelectedUnitId: (id: number | null) => void; unitDraft: string; setUnitDraft: (value: string) => void; newUnit: { grade: string; name: string }; setNewUnit: (value: { grade: string; name: string }) => void; addUnit: (event: FormEvent) => void; newWord: { english: string; meaning: string }; setNewWord: (value: { english: string; meaning: string }) => void; addWord: (event: FormEvent) => void; editingWord: number | null; setEditingWord: (id: number | null) => void; wordDraft: { english: string; meaning: string }; setWordDraft: (value: { english: string; meaning: string }) => void; updateUnit: ReturnType<typeof trpc.admin.updateUnit.useMutation>; deleteUnit: ReturnType<typeof trpc.admin.deleteUnit.useMutation>; createWord: ReturnType<typeof trpc.admin.createWord.useMutation>; updateWord: ReturnType<typeof trpc.admin.updateWord.useMutation>; deleteWord: ReturnType<typeof trpc.admin.deleteWord.useMutation>; updateClass: ReturnType<typeof trpc.admin.updateClass.useMutation>; refresh: () => void }) {
  const { catalog, activeGrade, activeUnit } = props;
  return <div className="admin-content-layout"><aside className="admin-sidebar"><span className="sidebar-label">SINIFLAR</span>{catalog.map(grade => <button key={grade.id} className={activeGrade?.grade === grade.grade ? "active" : ""} onClick={() => props.setSelectedGrade(grade.grade)}><span>{grade.grade}</span><small>{grade.wordCount} kelime</small></button>)}<form className="add-unit-form" onSubmit={props.addUnit}><span className="sidebar-label">YENİ ÜNİTE</span><select value={props.newUnit.grade} onChange={event => props.setNewUnit({ ...props.newUnit, grade: event.target.value })}>{Array.from({ length: 11 }, (_, index) => index + 2).map(grade => <option key={grade} value={grade}>{grade}. sınıf</option>)}</select><input value={props.newUnit.name} onChange={event => props.setNewUnit({ ...props.newUnit, name: event.target.value })} placeholder="Ünite adı" /><button className="small-button" disabled={props.updateUnit.isPending}><Plus size={14} /> Ekle</button></form></aside><section className="admin-workspace"><div className="workspace-heading"><div><span className="section-kicker">CONTENT TREE</span><h2>{activeGrade?.name ?? "Sınıf seç"}</h2></div><span className="workspace-count">{activeGrade?.units.length ?? 0} ünite</span></div>{activeGrade?.units.map(unit => <div className={`manage-unit ${activeUnit?.id === unit.id ? "is-selected" : ""}`} key={unit.id}><div className="manage-unit-header" onClick={() => props.setSelectedUnitId(unit.id)}><span className="unit-number">UNIT {String(unit.unitNumber).padStart(2, "0")}</span>{activeUnit?.id === unit.id && props.unitDraft !== "" ? <input autoFocus value={props.unitDraft} onChange={event => props.setUnitDraft(event.target.value)} onClick={event => event.stopPropagation()} /> : <strong>{unit.name}</strong>}<span className="manage-actions">{activeUnit?.id === unit.id && props.unitDraft !== "" ? <><button className="icon-button" onClick={event => { event.stopPropagation(); props.updateUnit.mutate({ id: unit.id, name: props.unitDraft }, { onSuccess: () => { props.setUnitDraft(""); props.refresh(); } }); }}><Save size={15} /></button><button className="icon-button" onClick={event => { event.stopPropagation(); props.setUnitDraft(""); }}><X size={15} /></button></> : <button className="icon-button" onClick={event => { event.stopPropagation(); props.setSelectedUnitId(unit.id); props.setUnitDraft(unit.name); }}><Pencil size={15} /></button>}<button className="icon-button danger" onClick={event => { event.stopPropagation(); if (window.confirm("Bu ünite ve kelimeleri silinsin mi?")) props.deleteUnit.mutate({ id: unit.id }, { onSuccess: () => { props.setSelectedUnitId(null); props.refresh(); } }); }}><Trash2 size={15} /></button><ChevronDown size={17} className={activeUnit?.id === unit.id ? "rotate" : ""} /></span></div>{activeUnit?.id === unit.id && <div className="word-manager"><div className="word-manager-title"><span>{unit.words.length} kelime</span><span>İngilizce / Türkçe karşılık</span></div>{unit.words.map(word => <div className="word-row-admin" key={word.id}>{props.editingWord === word.id ? <><input value={props.wordDraft.english} onChange={event => props.setWordDraft({ ...props.wordDraft, english: event.target.value })} /><input value={props.wordDraft.meaning} onChange={event => props.setWordDraft({ ...props.wordDraft, meaning: event.target.value })} /><button className="icon-button" onClick={() => props.updateWord.mutate({ id: word.id, ...props.wordDraft }, { onSuccess: () => { props.setEditingWord(null); props.refresh(); } })}><Save size={15} /></button><button className="icon-button" onClick={() => props.setEditingWord(null)}><X size={15} /></button></> : <><span>{word.english}</span><span>{word.meaning || <em>anlam eklenebilir</em>}</span><button className="icon-button" onClick={() => { props.setEditingWord(word.id); props.setWordDraft({ english: word.english, meaning: word.meaning }); }}><Pencil size={14} /></button><button className="icon-button danger" onClick={() => { if (window.confirm("Bu kelime silinsin mi?")) props.deleteWord.mutate({ id: word.id }, { onSuccess: props.refresh }); }}><Trash2 size={14} /></button></>}</div>)}<form className="new-word-row" onSubmit={props.addWord}><input value={props.newWord.english} onChange={event => props.setNewWord({ ...props.newWord, english: event.target.value })} placeholder="Yeni İngilizce kelime" /><input value={props.newWord.meaning} onChange={event => props.setNewWord({ ...props.newWord, meaning: event.target.value })} placeholder="Türkçe karşılık" /><button className="small-button" disabled={props.createWord.isPending}><Plus size={14} /> Kelime ekle</button></form></div>}</div>)}</section></div>;
}

function AdEditor({ ad, onSave, saving }: { ad: Ad; onSave: (ad: Ad) => void; saving: boolean }) {
  const [draft, setDraft] = useState(ad);
  useEffect(() => setDraft(ad), [ad]);
  return <div className="ad-editor"><div className="ad-editor-heading"><div><span className="unit-number">{ad.slotKey.toUpperCase()}</span><h3>{draft.title}</h3></div><span className={`type-pill type-${draft.type}`}>{draft.type}</span></div><div className="ad-form-grid"><label>Alan adı<input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label><label>Reklam tipi<select value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value as AdType })}><option value="placeholder">Boş placeholder</option><option value="adsense">Google AdSense</option><option value="text">Metin içeriği</option><option value="video">Video URL</option></select></label><label>AdSense client<input value={draft.adsenseClient} onChange={event => setDraft({ ...draft, adsenseClient: event.target.value })} placeholder="ca-pub-..." /></label><label>AdSense slot<input value={draft.adsenseSlot} onChange={event => setDraft({ ...draft, adsenseSlot: event.target.value })} placeholder="1234567890" /></label><label className="wide-field">Metin / embed içeriği<textarea rows={3} value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} placeholder="Kısa reklam metni veya içerik notu" /></label><label className="wide-field">Video URL<input value={draft.videoUrl} onChange={event => setDraft({ ...draft, videoUrl: event.target.value })} placeholder="https://..." /></label></div><button className="small-button" onClick={() => onSave(draft)} disabled={saving}><Save size={14} /> {saving ? "Kaydediliyor" : "Alanı kaydet"}</button></div>;
}
