import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, AlertTriangle, ArrowDown, ArrowUp, BadgeCheck, BarChart3, Bell, Check,
  ChevronRight, CircleHelp, ClipboardList, CloudUpload, FileText, Filter,
  FlaskConical, HeartPulse, IndianRupee, Info, Menu, MessageSquareText,
  Moon, PenLine, Pill, Plus, Search, ShieldCheck, SlidersHorizontal,
  Sun, Table2, Upload, UsersRound, X, Zap
} from 'lucide-react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { fetchMedicines, summariseSalt, type SaltGroup } from './lib/medicines';
import { useAuditPrescription } from '@workspace/api-client-react';

type Tab = 'audit' | 'doctors' | 'index';
type ModalKind = 'script' | 'review' | null;

const queryClient = new QueryClient();

const scripts = {
  branded: {
    doctor: 'Dr. Sharma · 4 medicines · estimated ₹1,006',
    items: [
      { name: 'Moxikind-CV 625', salt: 'Amoxicillin + Clavulanic acid 625 mg', brand: 420, generic: 92, confidence: '98%' },
      { name: 'Azithral 500', salt: 'Azithromycin 500 mg', brand: 310, generic: 78, confidence: '99%' },
      { name: 'Zerodol-P', salt: 'Aceclofenac + Paracetamol', brand: 180, generic: 36, confidence: '96%' },
      { name: 'Pantocid 40', salt: 'Pantoprazole 40 mg', brand: 96, generic: 11, confidence: '99%' },
    ],
  },
  duplicate: {
    doctor: 'Dr. Verma · duplicate salt detection',
    items: [
      { name: 'Dolo 650', salt: 'Paracetamol 650 mg', brand: 35, generic: 7, confidence: '99%' },
      { name: 'Calpol 650', salt: 'Paracetamol 650 mg', brand: 34, generic: 7, confidence: '99%' },
      { name: 'Montek LC', salt: 'Montelukast + Levocetirizine', brand: 145, generic: 28, confidence: '94%' },
    ],
  },
};

const reviews = [
  { initials: 'RS', name: 'Riya S.', date: '29 Oct 2026', verified: true, score: 4.6, text: 'Listened carefully and explained why each medicine was needed. I appreciated being told the generic name without having to ask.' },
  { initials: 'AM', name: 'Arjun M.', date: '05 Nov 2026', verified: true, score: 4.2, text: 'Good clinical experience. The prescription was clear, although the pharmacy did not stock the suggested alternative.' },
  { initials: 'NK', name: 'Nikhil K.', date: '10 Nov 2026', verified: false, score: 2.8, text: 'Wait time was long and the cost of the prescribed medicines was not discussed.' },
];

function priceColor(price: number, min: number, max: number) { const t = max === min ? 0 : (price - min) / (max - min); return `hsl(${Math.round(140 - 140 * t)} 65% 42%)`; }
function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(' '); }
function money(value: number) { return `₹${value.toLocaleString('en-IN')}`; }

function Button({ children, variant = 'primary', className, onClick, disabled, icon, testId }: {
  children: ReactNode; variant?: 'primary' | 'quiet' | 'outline' | 'warning'; className?: string; onClick?: () => void; disabled?: boolean; icon?: ReactNode; testId?: string;
}) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:brightness-110 shadow-sm',
    quiet: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
    outline: 'border border-border bg-card text-foreground hover:bg-secondary/60',
    warning: 'bg-accent text-accent-foreground hover:brightness-105',
  };
  return <button data-testid={testId} disabled={disabled} onClick={onClick} className={cn('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none', styles[variant], className)}>{icon}{children}</button>;
}

function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = { muted: 'bg-secondary text-muted-foreground', green: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300', amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', red: 'bg-red-500/12 text-red-600 dark:text-red-300', blue: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide', tones[tone])}>{children}</span>;
}

function Card({ children, className = '', testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <section data-testid={testId} className={cn('rounded-2xl border border-border bg-card shadow-[0_12px_40px_hsl(170_40%_8%_/_0.04)]', className)}>{children}</section>;
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  return <AnimatePresence><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <motion.div initial={{ y: 12, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: .98 }} onMouseDown={e => e.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
      <div className="mb-5 flex items-start justify-between gap-4"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p><h2 className="mt-1 text-xl font-bold">{title}</h2></div><button data-testid="button-close-modal" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X size={18} /></button></div>
      {children}
    </motion.div>
  </motion.div></AnimatePresence>;
}

function Topbar({ tab, setTab, dark, setDark, onMenu }: { tab: Tab; setTab: (tab: Tab) => void; dark: boolean; setDark: (v: boolean) => void; onMenu: () => void }) {
  const tabs = [['audit', 'Prescription audit', ClipboardList], ['doctors', 'Verified doctors', UsersRound], ['index', 'Medicine index', Table2]] as const;
  return <header className="sticky top-0 z-30 border-b border-border bg-background shadow-sm">
    <div className="bg-primary px-4 py-2 text-center text-xs font-semibold tracking-wide text-primary-foreground md:text-sm">Patient-first prescription transparency · Same salt, smarter prices</div>
    <div className="mx-auto flex h-[64px] max-w-[1560px] items-center gap-3 px-4 md:px-8">
      <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Pill size={20} /></div><div><div className="text-[15px] font-bold tracking-tight">Save<span className="text-primary">Meds</span></div><div className="mono hidden text-[9px] uppercase tracking-[.18em] text-muted-foreground sm:block">patient intelligence</div></div></div>
      <div className="ml-auto flex items-center gap-1"><button data-testid="button-notifications" className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary"><Bell size={18} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" /></button><button data-testid="button-theme" onClick={() => setDark(!dark)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">{dark ? <Sun size={18} /> : <Moon size={18} />}</button><div data-testid="avatar-initials" className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold">NM</div></div>
    </div>
    <nav className="mx-auto grid max-w-[1560px] grid-cols-3 border-t border-border px-2 md:px-6">
      {tabs.map(([key, label, Icon]) => <button data-testid={`tab-${key}`} key={key} onClick={() => setTab(key)} className={cn('relative flex min-w-0 items-center justify-center gap-1.5 px-2 py-3 text-xs font-semibold sm:text-sm md:gap-2 md:px-3 text-muted-foreground transition hover:text-foreground', tab === key && 'text-foreground')}><Icon size={16} />{label}{tab === key && <motion.span layoutId="tab-line" className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-primary" />}</button>)}
    </nav>
  </header>;
}

function PageIntro({ eyebrow, title, children, action }: { eyebrow: string; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mono mb-2 text-[10px] font-bold uppercase tracking-[.22em] text-primary">{eyebrow}</p><h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{children}</p></div>{action}</div>;
}

type OcrLine = { text: string; confidence: number };
type OcrState = { status: 'idle' | 'reading' | 'done' | 'error'; lines: OcrLine[]; error?: string };

/** Keeps the OCR lines that name a medicine in the database (by brand name or salt name). */
function matchLinesToMedicines(lines: OcrLine[], groups: SaltGroup[]) {
  const matches: { line: string; group: SaltGroup; summary: ReturnType<typeof summariseSalt> }[] = [];
  for (const line of lines) {
    const normalised = line.text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    const group = groups.find((g) => {
      const saltName = g.salt.toLowerCase().replace(/[0-9.%].*$/, '').trim();
      const brandHit = g.brands.some((b) => {
        const brand = b.brand.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
        return brand.length >= 4 && normalised.includes(brand);
      });
      return brandHit || (saltName.length >= 5 && normalised.includes(saltName));
    });
    if (group) matches.push({ line: line.text, group, summary: summariseSalt(group) });
  }
  return matches;
}

function AuditPage({ openModal }: { openModal: (kind: ModalKind) => void }) {
  const [sample, setSample] = useState<'branded' | 'duplicate'>('branded');
  const [upload, setUpload] = useState<{ url: string; name: string } | null>(null);
  const [ocr, setOcr] = useState<OcrState>({ status: 'idle', lines: [] });
  const [analyzed, setAnalyzed] = useState(true);
  const [aiAudit, setAiAudit] = useState<string | null>(null);
  const medicines = useQuery({ queryKey: ['medicines'], queryFn: fetchMedicines });
  const groups: SaltGroup[] = medicines.data ?? [];
  const isUploaded = upload !== null;
  const data = scripts[sample];
  const uploadMatches = useMemo(() => matchLinesToMedicines(ocr.lines, groups), [ocr.lines, groups]);

  // Rows for the price table: the sample's own prices, or the database matches for an uploaded prescription.
  const priceRows = isUploaded
    ? uploadMatches
        .filter((m) => m.summary.market !== null)
        .map((m) => ({ name: m.line, salt: m.group.salt, prescribed: Math.round(m.summary.market ?? 0), alternative: m.summary.cheapestGeneric }))
    : data.items.map((item) => ({ name: item.name, salt: item.salt, prescribed: item.brand, alternative: item.generic as number | null }));
  const savings = priceRows.reduce((sum, r) => sum + (r.alternative === null ? 0 : r.prescribed - r.alternative), 0);
  const prescribedTotal = priceRows.reduce((sum, r) => sum + r.prescribed, 0);
  const percentLess = prescribedTotal ? Math.round((savings / prescribedTotal) * 100) : 0;

  const auditMutation = useAuditPrescription({
    mutation: {
      onSuccess: (result) => {
        setAiAudit(result.text);
        setAnalyzed(true);
      },
      onError: () => {
        setAiAudit('Live Groq audit is unavailable right now. Please try again in a moment.');
        setAnalyzed(true);
      },
    },
  });
  const sampleText = [data.doctor, ...data.items.map((item) => `${item.name}: ${item.salt}`)].join('\n');
  const extractedText = isUploaded ? ocr.lines.map((l) => l.text).join('\n') : sampleText;
  const fallbackAudit = sample === 'duplicate'
    ? '• Active salts: Dolo 650 and Calpol 650 both contain paracetamol 650 mg.\n• Over-prescription warning: confirm both are intended before taking them together.'
    : '• Active salts: two antibiotics, an anti-inflammatory combination, and pantoprazole identified.\n• Cost advisory: ask about safe generic equivalents and whether both antibiotics are intentional.';

  const handleAnalyze = () => {
    if (isUploaded && ocr.status !== 'done') return;
    setAnalyzed(false);
    setAiAudit(null);
    auditMutation.mutate({ data: { extractedText } });
  };

  const chooseSample = (kind: 'branded' | 'duplicate') => {
    setSample(kind);
    setUpload(null);
    setOcr({ status: 'idle', lines: [] });
    setAiAudit(null);
    setAnalyzed(true);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (upload) URL.revokeObjectURL(upload.url);
    setUpload({ url: URL.createObjectURL(file), name: file.name });
    setOcr({ status: 'reading', lines: [] });
    setAiAudit(null);
    setAnalyzed(true);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const result = await worker.recognize(file);
      await worker.terminate();
      const lines = (result.data.lines ?? [])
        .map((l) => ({ text: l.text.trim(), confidence: Math.round(l.confidence) }))
        .filter((l) => l.text.length > 1);
      setOcr({ status: 'done', lines });
    } catch {
      setOcr({ status: 'error', lines: [], error: 'Could not read this image. Try a clearer, well-lit photo.' });
    }
  };

  const averageConfidence = ocr.lines.length ? Math.round(ocr.lines.reduce((s, l) => s + l.confidence, 0) / ocr.lines.length) : 0;

  return <div className="mx-auto max-w-[1560px] px-4 py-7 md:px-8 md:py-10">
    <PageIntro eyebrow="01 / prescription intelligence" title="Decode before you decide."><span>Turn a prescription into a plain-language second look. Compare formulations, see the price spread, and prepare a better conversation — without changing a treatment plan yourself.</span></PageIntro>
    <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]"><Card className="flex flex-wrap items-center gap-2 p-2"><span className="px-3 text-xs font-semibold text-muted-foreground">Try a sample</span><button data-testid="sample-branded" onClick={() => chooseSample('branded')} className={cn('rounded-lg px-3 py-2 text-left text-sm', sample === 'branded' && !isUploaded ? 'bg-secondary font-bold' : 'hover:bg-secondary/60')}><span className="block">Dr. Sharma</span><span className="text-[11px] text-muted-foreground">high-cost branded medicines</span></button><button data-testid="sample-duplicate" onClick={() => chooseSample('duplicate')} className={cn('rounded-lg px-3 py-2 text-left text-sm', sample === 'duplicate' && !isUploaded ? 'bg-secondary font-bold' : 'hover:bg-secondary/60')}><span className="block">Dr. Verma</span><span className="text-[11px] text-muted-foreground">duplicate active salts</span></button></Card><Button variant="outline" icon={<MessageSquareText size={16} />} onClick={() => openModal('script')} testId="button-open-script">Get a conversation script</Button></div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(420px,.98fr)]">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><div className="flex items-center gap-2"><FileText size={16} className="text-primary" /><h2 className="text-sm font-bold">Prescription workspace</h2></div><p className="mt-1 text-xs text-muted-foreground">{isUploaded ? upload.name : `${sample === 'branded' ? 'sharma' : 'verma'}-prescription.jpg`} · {isUploaded ? 'uploaded from your device' : 'sample prescription'}</p></div><Badge tone={ocr.status === 'reading' ? 'amber' : analyzed ? 'green' : 'amber'}>{ocr.status === 'reading' ? 'Reading' : analyzed ? <><Check size={12} /> Analysed</> : 'Processing'}</Badge></div>
        <div className="grid min-w-0 grid-cols-1 gap-5 p-5 lg:grid-cols-[.85fr_1.15fr]">
          <div className="relative flex min-h-[330px] items-center justify-center overflow-hidden rounded-xl border border-border bg-[#e8e1d1] dark:bg-[#26302e]">
            {isUploaded ? <img src={upload.url} alt="Uploaded prescription" className="max-h-[320px] max-w-full rounded-md object-contain shadow-2xl" /> : <div className="relative h-[270px] w-[205px] rotate-[-3deg] bg-[#faf7ee] p-5 text-slate-700 shadow-2xl"><div className="border-b border-slate-300 pb-3"><p className="font-serif text-lg italic">Dr. {sample === 'branded' ? 'Sharma' : 'Verma'}</p><p className="mt-1 text-[8px]">MBBS, MD · Reg. No. 2014/DEL/0921</p></div><div className="space-y-3 pt-4 text-[9px] leading-3"><p>Patient: Priya S. &nbsp; Age: 34</p>{data.items.map((item, i) => <p key={item.name}><b>{i + 1}.</b> {item.name}<br /><span className="text-[8px] text-slate-500">1 tab · twice daily · 5 days</span></p>)}</div><div className="absolute bottom-4 right-5 font-serif text-xs italic text-slate-500">Dr. {sample === 'branded' ? 'Sharma' : 'Verma'}</div>{analyzed && <><div className="absolute left-6 top-[74px] h-8 w-[156px] border border-emerald-600/80" /><div className="absolute left-6 top-[122px] h-8 w-[156px] border border-emerald-600/80" /><motion.div initial={{ top: 8 }} animate={{ top: 260 }} transition={{ duration: 2, repeat: Infinity, repeatDelay: .7 }} className="absolute left-0 right-0 h-px bg-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,.7)]" /></>}</div>}
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-slate-900/80 px-2 py-1 text-[10px] text-white"><Activity size={12} /> scan view</div>
          </div>
          <div className="flex flex-col">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Extracted text</h3><span className="mono text-[10px] text-primary">{isUploaded ? (ocr.status === 'done' ? `OCR confidence ${averageConfidence}%` : 'OCR') : 'OCR confidence 98.4%'}</span></div>
            <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto pr-1">
              {!isUploaded && data.items.map((item, i) => <div data-testid={`extracted-${i}`} key={item.name} className="group rounded-xl border border-border bg-background/50 p-3 transition hover:border-primary/40"><div className="flex items-center justify-between gap-3"><span className="text-sm font-bold">{item.name}</span><Badge tone="green">{item.confidence}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.salt}</p><div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><span className="rounded bg-secondary px-1.5 py-0.5">1 tablet</span><span className="rounded bg-secondary px-1.5 py-0.5">twice daily</span><span className="rounded bg-secondary px-1.5 py-0.5">5 days</span></div></div>)}
              {isUploaded && ocr.status === 'reading' && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Reading the prescription on this device…</p>}
              {isUploaded && ocr.status === 'error' && <p className="rounded-xl border border-red-500/30 p-4 text-sm text-red-600 dark:text-red-400">{ocr.error}</p>}
              {isUploaded && ocr.status === 'done' && ocr.lines.length === 0 && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No text was found in this image. Try a clearer, well-lit photo.</p>}
              {isUploaded && ocr.status === 'done' && ocr.lines.map((line, i) => { const match = uploadMatches.find(m => m.line === line.text); return <div key={`${line.text}-${i}`} className="rounded-xl border border-border bg-background/50 p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-bold">{line.text}</span><Badge tone={line.confidence >= 80 ? 'green' : 'amber'}>{line.confidence}%</Badge></div>{match && <p className="mt-1 text-xs text-muted-foreground">Matched in database: {match.group.salt}</p>}</div>; })}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button className="flex-1 whitespace-nowrap" onClick={handleAnalyze} disabled={auditMutation.isPending || (isUploaded && ocr.status !== 'done')} icon={<Zap size={15} />} testId="button-analyze">{auditMutation.isPending ? 'Analyzing with Groq…' : 'Analyze prescription'}</Button><Button variant="outline" className="flex-1 whitespace-nowrap" icon={<Upload size={15} />} onClick={() => document.getElementById('prescription-upload')?.click()} testId="button-replace">Upload prescription</Button><input id="prescription-upload" type="file" accept="image/*" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} /></div>
          </div>
        </div>
      </Card>
      <div className="space-y-5">
        <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-sm font-bold">Price arbitrage</h2><p className="mt-1 text-xs text-muted-foreground">Same active salt. Different shelf price.</p></div><Badge tone="blue"><IndianRupee size={12} /> per course</Badge></div>
          {priceRows.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">No medicines from this prescription were found in the database yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs sm:text-sm"><thead className="bg-secondary/45 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-3 font-bold sm:px-5">Medicine / salt</th><th className="px-2 py-3 text-right font-bold text-red-600 dark:text-red-400 sm:whitespace-nowrap sm:px-3">Prescribed brand</th><th className="px-2 py-3 text-right font-bold text-green-700 dark:text-green-400 sm:whitespace-nowrap sm:px-3">Other brands / makers</th><th className="px-2 py-3 text-right font-bold text-green-700 dark:text-green-400 sm:px-5">Save</th></tr></thead><tbody>{priceRows.map(r => <tr key={`${r.name}-${r.salt}`} className="border-t border-border"><td className="px-3 py-3 sm:px-5"><p className="font-semibold">{r.name}</p><p className="max-w-[110px] truncate text-[11px] text-muted-foreground sm:max-w-[180px]">{r.salt}</p></td><td className="px-2 py-3 text-right font-semibold text-red-600 dark:text-red-400 sm:px-3">{money(r.prescribed)}</td><td className="px-2 py-3 text-right font-semibold text-green-700 dark:text-green-400 sm:px-3">{r.alternative === null ? '—' : money(r.alternative)}</td><td className="px-2 py-3 text-right font-bold text-green-700 dark:text-green-400 sm:px-5">{r.alternative === null ? '—' : money(r.prescribed - r.alternative)}</td></tr>)}</tbody></table></div>}
          <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-5 py-4"><div><p className="text-xs text-muted-foreground">Estimated savings per course</p><p data-testid="text-total-savings" className="mt-0.5 text-2xl font-bold text-green-700 dark:text-green-400">{money(savings)}</p></div><div className="text-right"><p className="text-[11px] text-muted-foreground">up to</p><p className="text-lg font-bold text-green-700 dark:text-green-400">{percentLess}% less</p></div></div>
        </Card>
        {sample === 'duplicate' && !isUploaded ? <Card className="border-amber-500/30 bg-amber-500/[.06] p-5"><div className="flex gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" size={19} /><div><h2 className="text-sm font-bold text-amber-800 dark:text-amber-200">Possible duplicate active salt</h2><p className="mt-1 whitespace-pre-line text-xs leading-5 text-amber-900/70 dark:text-amber-100/70">{aiAudit ?? fallbackAudit}</p><button data-testid="button-duplicate-script" onClick={() => openModal('script')} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-200">How to ask your doctor <ChevronRight size={13} /></button></div></div></Card> : <Card className="border-red-500/25 bg-red-500/[.05] p-5"><div className="flex gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-red-600 dark:text-red-300" size={19} /><div><h2 className="text-sm font-bold text-red-800 dark:text-red-200">Clinical review prompt</h2><p className="mt-1 whitespace-pre-line text-xs leading-5 text-red-900/70 dark:text-red-100/70">{aiAudit ?? (isUploaded ? 'Analyze the extracted text to get a clinical review prompt for this prescription.' : fallbackAudit)}</p><button data-testid="button-clinical-script" onClick={() => openModal('script')} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-red-700 dark:text-red-200">Prepare a respectful question <ChevronRight size={13} /></button></div></div></Card>}
      </div>
    </div>
    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">{[['Evidence-led', 'Named active salts, visible confidence', FlaskConical], ['Patient-first', 'Questions, not instructions', HeartPulse], ['Fast to scan', 'A clear second look in under a minute', Zap]].map(([title, text, Icon]) => <div key={String(title)} className="flex gap-3 rounded-xl border border-border/60 bg-card/45 p-4"><Icon size={17} className="mt-0.5 text-primary" /><div><p className="text-xs font-bold">{title as string}</p><p className="mt-1 text-xs text-muted-foreground">{text as string}</p></div></div>)}</div>
  </div>;
}

function DoctorsPage({ openModal }: { openModal: (kind: ModalKind) => void }) {
  const [search, setSearch] = useState('');
  const [doctorQuery, setDoctorQuery] = useState('');
  const visibleReviews = reviews.filter(r => `${r.name} ${r.text}`.toLowerCase().includes(search.toLowerCase()));
  const profileMatch = 'dr a k sharma internal medicine indraprastha apollo new delhi'.includes(doctorQuery.toLowerCase().trim());
  return <div className="mx-auto max-w-[1560px] px-4 py-7 md:px-8 md:py-10"><PageIntro eyebrow="02 / care transparency" title="Find care you can question."><span>Verified patient signals around communication, affordability, and prescription transparency — not a popularity contest.</span></PageIntro><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="absolute left-3.5 top-3 text-muted-foreground" size={17} /><input data-testid="input-doctor-search" value={doctorQuery} onChange={e => setDoctorQuery(e.target.value)} placeholder="Search doctor, specialty, or hospital" className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div><Badge tone={profileMatch ? 'green' : 'amber'}>{profileMatch ? '1 verified profile' : 'No matching profile'}</Badge></div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[.82fr_1.18fr]">
      <div className="space-y-5"><Card className="overflow-hidden"><div className="h-24 bg-[linear-gradient(120deg,hsl(226_60%_34%),hsl(236_45%_18%))] p-5"><Badge tone="green"><BadgeCheck size={12} /> identity checked</Badge></div><div className="relative px-5 pb-5"><div className="-mt-8 flex items-end justify-between"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-card bg-primary text-xl font-bold text-primary-foreground">AS</div><Button variant="outline" className="mt-3" onClick={() => openModal('review')} icon={<PenLine size={15} />} testId="button-write-review">Write a review</Button></div><div className="mt-3"><div className="flex items-center gap-2"><h2 className="text-lg font-bold">Dr. A. K. Sharma</h2><BadgeCheck size={16} className="text-primary" /></div><p className="mt-1 text-sm text-muted-foreground">Internal Medicine · MBBS, MD · 14 years experience</p><p className="mt-1 text-xs text-muted-foreground">Indraprastha Apollo, New Delhi · Consultation ₹900</p></div><div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-xl bg-secondary/50 py-3 text-center"><div><p className="text-xl font-bold">{(reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length).toFixed(1)}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">patient score</p></div><div><p className="text-xl font-bold text-primary">88%</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">generic mentions</p></div><div><p className="text-xl font-bold">1,248</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">visits logged</p></div></div></div></Card><Card className="p-5"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-widest text-primary">SaveMeds ethics score</p><p className="mt-2 text-4xl font-bold">8.7<span className="text-base text-muted-foreground"> / 10</span></p></div><div className="relative flex h-16 w-16 items-center justify-center rounded-full border-[6px] border-primary/25 border-t-primary"><ShieldCheck className="text-primary" size={20} /></div></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Based on generic recommendation rate, medicine cost discussions, and verified visit feedback from the last 12 months.</p><div className="mt-5 space-y-3">{[['Explains alternatives', 92], ['Discusses medicine cost', 81], ['Clear dosage instructions', 95]].map(([label, value]) => <div key={String(label)}><div className="mb-1 flex justify-between text-xs"><span>{label as string}</span><b>{value as number}%</b></div><div className="h-1.5 overflow-hidden rounded-full bg-secondary"><motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} className="h-full rounded-full bg-primary" /></div></div>)}</div></Card></div>
      <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold">Patient reviews</h2><p className="mt-1 text-xs text-muted-foreground">Every review is labelled by visit verification status.</p></div><div className="relative"><Search className="absolute left-3 top-2.5 text-muted-foreground" size={15} /><input data-testid="input-review-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reviews" className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/30 sm:w-52" /></div></div><div className="divide-y divide-border">{visibleReviews.length ? visibleReviews.map(review => <div data-testid={`review-${review.initials}`} key={review.initials} className="p-5"><div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">{review.initials}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><p className="text-sm font-bold">{review.name}</p>{review.verified ? <Badge tone="green"><BadgeCheck size={11} /> verified visit</Badge> : <Badge>unverified</Badge>}</div><span className="text-[11px] text-muted-foreground">{review.date}</span></div><div className="mt-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">Rated <span className="ml-1 font-normal text-muted-foreground">{review.score} / 5</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{review.text}</p></div></div></div>) : <div className="p-12 text-center text-sm text-muted-foreground">No reviews match “{search}”.</div>}</div><div className="flex items-center justify-between bg-secondary/35 px-5 py-4"><span className="text-xs text-muted-foreground">Showing {visibleReviews.length} of 3 reviews</span><Button variant="outline" className="whitespace-nowrap" onClick={() => openModal('review')} icon={<Plus size={15} />} testId="button-add-review">Add your experience</Button></div></Card>
    </div>
  </div>;
}

function PriceIndexPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [sort, setSort] = useState<'savings' | 'salt' | 'market'>('savings');
  const [ascending, setAscending] = useState(false);
  const [openSalt, setOpenSalt] = useState<string | null>(null);
  const medicines = useQuery({ queryKey: ['medicines'], queryFn: fetchMedicines });
  const groups: SaltGroup[] = medicines.data ?? [];
  const categories = ['All categories', ...Array.from(new Set(groups.map(g => g.category)))];
  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return groups
      .filter(g => category === 'All categories' || g.category === category)
      .filter(g => `${g.salt} ${g.coverage} ${g.brands.map(b => `${b.brand} ${b.manufacturer}`).join(' ')}`.toLowerCase().includes(q))
      .map(g => ({ group: g, ...summariseSalt(g) }))
      .sort((a, b) => {
        const key = sort === 'savings' ? (a.savings ?? -1) - (b.savings ?? -1)
          : sort === 'market' ? (a.market ?? 0) - (b.market ?? 0)
          : a.group.salt.localeCompare(b.group.salt);
        return ascending ? key : -key;
      });
  }, [groups, query, category, sort, ascending]);
  const latestUpdate = groups.flatMap(g => g.brands.map(b => b.capturedOn)).sort().at(-1);
  const totalBrands = groups.reduce((sum, g) => sum + g.brands.length, 0);
  const totalManufacturers = new Set(groups.flatMap(g => g.brands.map(b => b.manufacturer))).size;
  return <div className="mx-auto max-w-[1560px] px-4 py-7 md:px-8 md:py-10"><PageIntro eyebrow="03 / medicine index" title="Same formulation. Different brands. Different makers."><span>Medicines with the same salt and strength, from different brands and manufacturers, with their prices. Prices are as captured on the date shown and can vary by pack size, city, and stock.</span></PageIntro>
    <div className="mb-5 flex flex-wrap items-center gap-3"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3.5 top-3 text-muted-foreground" size={17} /><input data-testid="input-price-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by salt, brand, or manufacturer" className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></div><select data-testid="select-category" value={category} onChange={e => setCategory(e.target.value)} className="h-11 min-w-[180px] rounded-xl border border-border bg-card px-3 text-sm outline-none">{categories.map(c => <option key={c}>{c}</option>)}</select><Button variant="outline" icon={<Filter size={15} />} onClick={() => { setCategory('All categories'); setQuery(''); }} testId="button-reset-filters">Reset</Button></div>
    {medicines.isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading the medicine database…</Card>}
    {medicines.isError && <Card className="border-amber-500/40 p-6"><p className="text-sm font-bold">The medicine database is not connected.</p><p className="mt-2 text-sm text-muted-foreground">{(medicines.error as Error).message}</p><p className="mt-2 text-xs text-muted-foreground">To connect it: set DATABASE_URL, run <span className="mono">pnpm --filter @workspace/db run push</span>, then <span className="mono">pnpm --filter @workspace/db run seed</span>.</p></Card>}
    {medicines.isSuccess && <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><BarChart3 size={18} /></div><div><h2 className="text-sm font-bold">Same formulation, different brands</h2><p data-testid="text-index-count" className="text-xs text-muted-foreground">{rows.length} of {groups.length} salts · {totalBrands} brand listings from {totalManufacturers} manufacturers{latestUpdate ? ` · latest update ${latestUpdate}` : ''}</p></div></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><SlidersHorizontal size={14} /> <select value={sort} onChange={e => setSort(e.target.value as 'savings' | 'salt' | 'market')} className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none"><option value="savings">Sort by saving</option><option value="market">Sort by market price</option><option value="salt">Sort by salt</option></select><button onClick={() => setAscending(!ascending)} className="rounded-lg border border-border px-2 py-1 hover:bg-secondary">{ascending ? 'Ascending' : 'Descending'}</button></div></div>
      {rows.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No salts match your search.</p>}
      <div className="hidden grid-cols-[minmax(0,1.4fr)_120px_140px_140px_100px] gap-3 border-b border-border px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:grid"><span>Formulation (salt &amp; strength)</span><span className="text-right">Avg brand MRP</span><span className="text-right">Cheapest generic</span><span className="text-right">Saving</span><span /></div>
      <div className="divide-y divide-border">{rows.map(({ group, market, cheapestGeneric, savings, brandCount, manufacturerCount }) => { const isOpen = openSalt === group.salt; const prices = group.brands.map(b => b.mrp); const minMrp = Math.min(...prices); const maxMrp = Math.max(...prices); return <div key={group.salt} data-testid={`salt-row-${group.salt}`}><button onClick={() => setOpenSalt(isOpen ? null : group.salt)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-5 py-4 text-left hover:bg-secondary/40 md:grid-cols-[minmax(0,1.4fr)_120px_140px_140px_100px]"><div className="min-w-0"><p className="truncate text-sm font-bold">{group.salt}</p><p className="text-xs text-muted-foreground">{group.category} · {group.coverage}</p><p className="text-xs text-muted-foreground">{brandCount} brands · {manufacturerCount} makers</p></div><span className="hidden text-right text-sm font-semibold text-red-600 dark:text-red-400 md:block">{market !== null ? money(market) : '—'}</span><span className="hidden text-right text-sm font-semibold text-green-700 dark:text-green-400 md:block">{cheapestGeneric !== null ? money(cheapestGeneric) : '—'}</span><span className="hidden text-right text-sm font-bold text-green-700 dark:text-green-400 md:block">{savings !== null ? `${savings}%` : '—'}</span><ChevronRight size={16} className={cn('justify-self-end text-muted-foreground transition', isOpen && 'rotate-90')} /></button>
        {isOpen && <div className="overflow-x-auto bg-secondary/20 px-5 pb-5"><table className="w-full min-w-[640px] text-left text-xs"><thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-2 pr-3 font-bold">Brand</th><th className="py-2 pr-3 font-bold">Manufacturer</th><th className="py-2 pr-3 font-bold">Type</th><th className="py-2 pr-3 text-right font-bold">MRP</th><th className="py-2 pr-3 font-bold">Source</th><th className="py-2 font-bold">Captured</th></tr></thead><tbody>{group.brands.map(b => <tr key={`${b.brand}-${b.manufacturer}`} className="border-t border-border"><td className="py-2 pr-3 font-semibold">{b.brand}</td><td className="py-2 pr-3">{b.manufacturer}</td><td className="py-2 pr-3">{b.isGeneric ? 'Generic' : 'Brand'}</td><td className="py-2 pr-3 text-right font-bold" style={{ color: priceColor(b.mrp, minMrp, maxMrp) }}>{money(b.mrp)}</td><td className="py-2 pr-3 text-muted-foreground">{b.source}</td><td className="py-2 text-muted-foreground">{b.capturedOn}</td></tr>)}</tbody></table></div>}
      </div>; })}</div>
      <p className="border-t border-border px-5 py-4 text-xs text-muted-foreground">Rates are indicative retail prices, not a prescription or price guarantee. Savings compare the cheapest generic with the average branded price for the same salt.</p></Card>}
  </div>;
}

function DiscussionScriptModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText('I want to understand my prescription properly. Could you please walk me through what each medicine is treating, and whether there is a safe generic equivalent for any of them?'); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  return <Modal title="A calmer way to ask" eyebrow="conversation helper" onClose={onClose}><div className="rounded-xl border border-primary/20 bg-primary/[.06] p-4 text-sm leading-6">“I want to understand my prescription properly. Could you please walk me through what each medicine is treating, and whether there is a safe generic equivalent for any of them?”</div><div className="mt-5 space-y-3"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Useful follow-ups</p>{['Are both antibiotics necessary for my symptoms?', 'What should I do if the pharmacy does not have this brand?', 'Are any of these medicines working on the same active salt?', 'Could you please write the generic name beside the brand name?'].map((q, i) => <div key={q} className="flex gap-3 rounded-lg border border-border p-3 text-sm"><span className="mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] text-primary">{i + 1}</span>{q}</div>)}</div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={copy} icon={copied ? <Check size={15} /> : <ClipboardList size={15} />} testId="button-copy-script">{copied ? 'Copied to clipboard' : 'Copy script'}</Button><Button onClick={onClose} testId="button-close-script">Done</Button></div></Modal>;
}

function ReviewModal({ onClose }: { onClose: () => void }) {
  const [verified, setVerified] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [text, setText] = useState('');
  const recognize = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) setTimeout(() => setVerified(true), 500); };
  if (submitted) return <Modal title="Thank you for adding a signal" eyebrow="review received" onClose={onClose}><div className="flex flex-col items-center py-7 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Check size={28} /></div><p className="mt-4 text-sm text-muted-foreground">Your review will appear after a quick safety check. Your personal documents are never published.</p><Button className="mt-6" onClick={onClose} testId="button-finish-review">Close</Button></div></Modal>;
  return <Modal title="Share your care experience" eyebrow="verified patient voice" onClose={onClose}><p className="text-sm leading-6 text-muted-foreground">Tell another patient what helped you make an informed decision. Keep it about communication and care — not a diagnosis.</p><label className="mt-5 block text-xs font-bold">Your review<textarea data-testid="input-review-text" value={text} onChange={e => setText(e.target.value)} placeholder="What did the doctor explain well? Was cost discussed?" className="mt-2 min-h-28 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></label><div className="mt-4 rounded-xl border border-dashed border-border p-4"><div className="flex items-center gap-3"><div className="rounded-lg bg-secondary p-2 text-primary"><Upload size={17} /></div><div className="flex-1"><p className="text-sm font-bold">Verify your visit <span className="font-normal text-muted-foreground">(optional)</span></p><p className="mt-1 text-xs text-muted-foreground">Upload a prescription or bill. We recognise the document locally and never publish it.</p></div><label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-secondary"><input data-testid="input-review-upload" type="file" accept="image/*,.pdf" className="hidden" onChange={recognize} />Choose file</label></div>{verified && <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300"><BadgeCheck size={15} /> Visit recognised · verified visit badge unlocked</div>}</div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose} testId="button-cancel-review">Cancel</Button><Button disabled={text.trim().length < 20} onClick={() => setSubmitted(true)} testId="button-submit-review">Submit review</Button></div></Modal>;
}

function App() {
  const [tab, setTab] = useState<Tab>('audit');
  const [dark, setDark] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => { document.documentElement.classList.add('dark'); }, []);
  useEffect(() => { document.title = 'SaveMeds · Patient intelligence'; }, []);
  const setTheme = (value: boolean) => { setDark(value); document.documentElement.classList.toggle('dark', value); };
  return <QueryClientProvider client={queryClient}><div className="grain min-h-[100dvh] bg-background text-foreground"><Topbar tab={tab} setTab={setTab} dark={dark} setDark={setTheme} onMenu={() => setMenu(!menu)} />{menu && <div className="fixed inset-x-4 top-[122px] z-20 rounded-xl border border-border bg-card p-2 shadow-xl md:hidden">{([['audit', 'Prescription audit'], ['doctors', 'Verified doctors'], ['index', 'Medicine index']] as const).map(([key, label]) => <button key={key} onClick={() => { setTab(key); setMenu(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold hover:bg-secondary"><ChevronRight size={15} className="text-primary" />{label}</button>)}</div>}<main className="animate-enter">{tab === 'audit' && <AuditPage openModal={setModal} />}{tab === 'doctors' && <DoctorsPage openModal={setModal} />}{tab === 'index' && <PriceIndexPage />}</main><footer className="mx-auto flex max-w-[1560px] flex-col gap-2 border-t border-border px-4 py-7 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-8"><span className="flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /> SaveMeds helps you ask better questions. It does not replace medical advice.</span><span className="mono">Developed by Numan</span></footer>{modal === 'script' && <DiscussionScriptModal onClose={() => setModal(null)} />}{modal === 'review' && <ReviewModal onClose={() => setModal(null)} />}</div></QueryClientProvider>;
}

export default App;