
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Skill, RichSkill, Occupation, Person, LearningPaths, ToastState, Tab, HeatmapMode, GeminiSkillCategory, OccupationSkill, Course, PersonSkill, LearningPathSkill, LearningPath, ProjectSkillRequirement, ProjectAnalysisResult, BudgetStats, ProficiencyLevel } from './types';
import { getMockData, generateMockPeople } from './services/mockDataService';
import { extractSkillsFromText, generateLearningPlan, analyzeProjectRequirements } from './services/geminiService';
import { getCourses, findCoursesBySkillId, getCourseById } from './services/courseDataService';
import { auditService } from './services/auditService';

// --- Helper Components ---

const Loader: React.FC = () => (
    <div className="loading-overlay">
        <div className="loader"></div>
    </div>
);

const ProficiencyBadge: React.FC<{ level: ProficiencyLevel }> = ({ level }) => {
    const config = {
        'Novice': { color: 'bg-gray-100 text-gray-800', icon: '🌱' },
        'Beginner': { color: 'bg-blue-100 text-blue-800', icon: '📚' },
        'Competent': { color: 'bg-green-100 text-green-800', icon: '💪' },
        'Proficient': { color: 'bg-purple-100 text-purple-800', icon: '⭐' },
        'Expert': { color: 'bg-yellow-100 text-yellow-800', icon: '🏆' },
    };
    const { color, icon } = config[level] || config['Novice'];
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
            <span className="mr-1">{icon}</span> {level}
        </span>
    );
};

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, maxWidth = 'max-w-4xl' }) => {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [isOpen, onClose]);

    if (!isOpen || typeof document === 'undefined') return null;

    // Portal to <body> so the fixed overlay is never trapped by an ancestor's
    // transform / backdrop-filter / overflow (e.g. a parent modal's content).
    return createPortal(
        <div className={`modal-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
            <div className={`modal-content ${maxWidth}`} onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>,
        document.body
    );
};

// ============================================================================
// Glassmorphic shell: icons, nav metadata, theme/chart helpers, shared pieces
// ============================================================================
type IconProps = { className?: string };
const Icon: React.FC<{ path: React.ReactNode } & IconProps> = ({ path, className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);

const TabIcons: Record<Tab, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    people: <><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></>,
    occupations: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
    projects: <><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0Z"/><path d="M12 15 9 12a11 11 0 0 1 8-9c2 0 3 1 3 3a11 11 0 0 1-9 8Z"/><path d="M15 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></>,
    development: <><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5"/></>,
    analysis: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    manager: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    reports: <><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7" rx="1"/><rect x="12" y="6" width="3" height="11" rx="1"/><rect x="17" y="13" width="3" height="4" rx="1"/></>,
    audit: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/></>,
};

const TAB_META: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'people', label: 'People' },
    { id: 'occupations', label: 'Occupations' },
    { id: 'projects', label: 'Projects' },
    { id: 'development', label: 'Development' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'manager', label: 'Manager' },
    { id: 'reports', label: 'Reports' },
    { id: 'audit', label: 'Audit' },
];

const useDarkMode = (): [boolean, () => void] => {
    const [dark, setDark] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        const stored = window.localStorage.getItem('bsi-theme');
        if (stored) return stored === 'dark';
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    });
    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
        window.localStorage.setItem('bsi-theme', dark ? 'dark' : 'light');
    }, [dark]);
    return [dark, () => setDark(d => !d)];
};

const cssVar = (name: string, fallback: string): string => {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
};
const isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

const useThemeTick = (): number => {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const obs = new MutationObserver(() => setTick(t => t + 1));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);
    return tick;
};

const useCountUp = (target: number, duration = 900): number => {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (typeof window === 'undefined') { setVal(target); return; }
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setVal(target); return; }
        let raf = 0; const start = performance.now();
        const step = (now: number) => {
            const p = Math.min(1, (now - start) / duration);
            setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return val;
};

const glassTooltip = (dark: boolean) => ({
    backgroundColor: dark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)',
    titleColor: dark ? '#f1f5f9' : '#0f172a',
    bodyColor: dark ? '#cbd5e1' : '#334155',
    borderColor: dark ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.35)',
    borderWidth: 1, padding: 12, cornerRadius: 12, displayColors: false,
    titleFont: { family: "'Inter', sans-serif", weight: '600', size: 13 },
    bodyFont: { family: "'Inter', sans-serif", weight: '500', size: 12 },
});

const vGradient = (ctx: CanvasRenderingContext2D, area: any, from: string, to: string) => {
    if (!area) return from;
    const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, from); g.addColorStop(1, to);
    return g;
};

const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart: any) {
        const opts = chart.config?.options?.plugins?.centerText;
        if (!opts || opts.text == null) return;
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const cx = (chartArea.left + chartArea.right) / 2;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = opts.color || '#0f172a';
        ctx.font = `800 ${opts.size || 30}px 'Inter', sans-serif`;
        ctx.fillText(String(opts.text), cx, cy - 7);
        if (opts.sub) { ctx.font = `600 12px 'Inter', sans-serif`; ctx.fillStyle = opts.subColor || '#64748b'; ctx.fillText(opts.sub, cx, cy + 15); }
        ctx.restore();
    },
};

// --- Formatted report renderer (light Markdown -> styled JSX) ---
const renderInline = (text: string, keyBase: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
    let last = 0; let m: RegExpExecArray | null; let k = 0;
    while ((m = regex.exec(text)) !== null) {
        if (m.index > last) nodes.push(text.slice(last, m.index));
        const tok = m[0];
        if (tok.startsWith('**')) nodes.push(<strong key={`${keyBase}-${k++}`} className="font-semibold text-gray-900">{tok.slice(2, -2)}</strong>);
        else if (tok.startsWith('`')) nodes.push(<code key={`${keyBase}-${k++}`} className="px-1.5 py-0.5 rounded bg-black/5 text-[0.85em] font-mono">{tok.slice(1, -1)}</code>);
        else nodes.push(<em key={`${keyBase}-${k++}`}>{tok.slice(1, -1)}</em>);
        last = m.index + tok.length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
};

const FormattedReport: React.FC<{ text: string }> = ({ text }) => {
    const lines = text.replace(/\r/g, '').split('\n');
    const blocks: React.ReactNode[] = [];
    const isHr = (t: string) => /^(-{3,}|\*{3,}|_{3,})$/.test(t);
    const isBullet = (t: string) => /^[*-]\s+/.test(t);
    const isNum = (t: string) => /^\d+[.)]\s+/.test(t);
    const isHeading = (t: string) => /^#{1,6}\s+/.test(t);
    let i = 0; let key = 0;
    while (i < lines.length) {
        const t = lines[i].trim();
        if (t === '') { i++; continue; }
        if (isHr(t)) { blocks.push(<hr key={key++} className="my-4 border-t border-black/10" />); i++; continue; }
        const h = /^(#{1,6})\s+(.*)$/.exec(t);
        if (h) {
            const lvl = h[1].length;
            const cls = lvl <= 1 ? 'text-xl font-bold text-gray-900 mt-2' : lvl === 2 ? 'text-lg font-bold text-gray-900 mt-2' : 'text-base font-semibold text-gray-900 mt-1';
            blocks.push(<h4 key={key++} className={cls}>{renderInline(h[2], `h${key}`)}</h4>); i++; continue;
        }
        if (isBullet(t)) {
            const items: string[] = [];
            while (i < lines.length && isBullet(lines[i].trim())) { items.push(lines[i].trim().replace(/^[*-]\s+/, '')); i++; }
            blocks.push(<ul key={key++} className="list-disc pl-5 space-y-1.5 marker:text-gray-400">{items.map((it, j) => <li key={j} className="pl-1">{renderInline(it, `b${key}-${j}`)}</li>)}</ul>);
            continue;
        }
        if (isNum(t)) {
            const items: string[] = [];
            while (i < lines.length && isNum(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+[.)]\s+/, '')); i++; }
            blocks.push(<ol key={key++} className="list-decimal pl-5 space-y-1.5 marker:text-gray-400 marker:font-semibold">{items.map((it, j) => <li key={j} className="pl-1">{renderInline(it, `o${key}-${j}`)}</li>)}</ol>);
            continue;
        }
        const para: string[] = [];
        while (i < lines.length) {
            const lt = lines[i].trim();
            if (lt === '' || isHr(lt) || isBullet(lt) || isNum(lt) || isHeading(lt)) break;
            para.push(lt); i++;
        }
        blocks.push(<p key={key++} className="text-gray-700 leading-relaxed">{renderInline(para.join(' '), `p${key}`)}</p>);
    }
    return <div className="report-body space-y-3 text-sm sm:text-[15px]">{blocks}</div>;
};

// --- KPI card ---
interface KpiCardProps { label: string; value: number | string; accent: string; icon: React.ReactNode; }
const KpiCard: React.FC<KpiCardProps> = ({ label, value, accent, icon }) => {
    const numeric = typeof value === 'number';
    const counted = useCountUp(numeric ? value : 0);
    return (
        <div className="kpi-card glass-card p-6 flex items-start justify-between gap-3 overflow-hidden relative">
            <span className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-40 pointer-events-none" style={{ background: accent }} aria-hidden="true"></span>
            <div className="relative">
                <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wide">{label}</h3>
                <p className="text-3xl font-extrabold mt-2 text-gray-900 tabular-nums">{numeric ? counted : value}</p>
            </div>
            <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 relative" style={{ background: `${accent}1f`, color: accent }}>
                <Icon path={icon} className="w-5 h-5" />
            </span>
        </div>
    );
};

// --- Glass sidebar + top bar ---
const Sidebar: React.FC<{ activeTab: Tab; onSwitchTab: (t: Tab) => void }> = ({ activeTab, onSwitchTab }) => (
    <aside className="hidden md:flex flex-col items-center gap-1.5 w-[84px] shrink-0 glass-sidebar sticky top-0 h-screen py-5 px-2 z-40">
        <div className="w-11 h-11 mb-3 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shrink-0"
             style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)', boxShadow: '0 10px 22px -8px rgba(74,144,226,0.8)' }}>B</div>
        <nav className="flex flex-col gap-1.5 w-full overflow-y-auto scrollbar-hide">
            {TAB_META.map(tab => (
                <button key={tab.id} onClick={() => onSwitchTab(tab.id)} aria-current={activeTab === tab.id}
                        className={`side-link ${activeTab === tab.id ? 'active' : ''}`} title={tab.label}>
                    <Icon path={TabIcons[tab.id]} className="w-[22px] h-[22px]" />
                    <span>{tab.label}</span>
                </button>
            ))}
        </nav>
    </aside>
);

const TopBar: React.FC<{ activeLabel: string; activeTab: Tab; onSwitchTab: (t: Tab) => void }> = ({ activeLabel, activeTab, onSwitchTab }) => {
    const [dark, toggleDark] = useDarkMode();
    return (
        <header className="glass-topbar sticky top-0 z-30">
            <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center gap-3 py-3.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shrink-0" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)' }}>B</span>
                        <div className="flex items-baseline gap-2 min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold text-gray-800 truncate">Skills Intelligence</h1>
                            <span className="hidden sm:inline text-gray-400">/</span>
                            <span className="hidden sm:inline text-sm font-semibold text-gray-500 truncate">{activeLabel}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <span className="glass-chip hidden sm:inline-flex"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }}></span>AI Ready</span>
                        <button onClick={toggleDark} className="icon-btn" aria-label="Toggle dark mode" title="Toggle theme">
                            {dark
                                ? <Icon path={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>} className="w-5 h-5" />
                                : <Icon path={<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>} className="w-5 h-5" />}
                        </button>
                        <button className="icon-btn" aria-label="Notifications" title="Notifications">
                            <Icon path={<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>} className="w-5 h-5" />
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                        </button>
                        <div className="flex items-center gap-2 pl-1">
                            <span className="hidden lg:inline text-sm text-gray-500">HR Manager</span>
                            <img src="https://placehold.co/40x40/4A90E2/FFFFFF?text=HR" alt="User Avatar" className="w-9 h-9 rounded-full ring-2 ring-white/60" />
                        </div>
                    </div>
                </div>
                <nav className="md:hidden flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-hide">
                    {TAB_META.map(tab => (
                        <button key={tab.id} onClick={() => onSwitchTab(tab.id)} className={`pill-link ${activeTab === tab.id ? 'active' : ''}`}>{tab.label}</button>
                    ))}
                </nav>
            </div>
        </header>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
    // --- State Management ---
    const [skills, setSkills] = useState<Skill[]>([]);
    const [richSkills, setRichSkills] = useState<RichSkill[]>([]);
    const [occupations, setOccupations] = useState<Occupation[]>([]);
    const [people, setPeople] = useState<Person[]>([]);
    const [departments] = useState<string[]>(['Engineering', 'Data Science', 'Management', 'Design', 'Product']);
    const [learningPaths, setLearningPaths] = useState<LearningPaths>({});
    const [courses] = useState<Course[]>(getCourses());
    
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [toast, setToast] = useState<ToastState>({ message: '', visible: false });
    const [projectAnalysis, setProjectAnalysis] = useState<ProjectAnalysisResult[] | null>(null);
    
    // Force re-render for audit logs
    const [auditVersion, setAuditVersion] = useState(0);

    // --- Data Initialization ---
    useEffect(() => {
        const initializeApp = () => {
            const { skills: mockSkills, richSkills: mockRichSkills, occupationsData } = getMockData();
            
            const formattedOccupations = occupationsData.map(o => ({
                ...o,
                skills: o.skills.map((skillName: string) => {
                    const skillObj = mockSkills.find(s => s.name === skillName);
                    return skillObj ? { id: skillObj.id, name: skillObj.name } : { id: -1, name: skillName };
                })
            }));

            setSkills(mockSkills);
            setRichSkills(mockRichSkills);
            setOccupations(formattedOccupations);
            setPeople(generateMockPeople(mockSkills, departments));
            setIsLoading(false);
            auditService.log('create', 'System', 'Init', 'Application data loaded successfully');
        };
        initializeApp();
    }, [departments]);
    
    // --- Handlers & Callbacks ---
    const showToast = useCallback((message: string) => {
        setToast({ message, visible: true });
        setTimeout(() => {
            setToast({ message: '', visible: false });
        }, 3000);
    }, []);

    const handleSwitchTab = (tab: Tab) => {
        setActiveTab(tab);
        window.scrollTo(0, 0);
    };

    const handleAssignCourse = (personId: number, personName: string, skillId: number, course: Course) => {
        setLearningPaths(prevPaths => {
            const currentPath = prevPaths[personId];
            const currentSkills = currentPath ? currentPath.skills : [];
            
            if (currentSkills.some(s => s.skillId === skillId)) {
                showToast('A course for this skill is already in the learning path.');
                return prevPaths;
            }

            const newSkill: LearningPathSkill = { 
                skillId, 
                status: 'Not Started',
                courseId: course.id,
                courseName: course.title,
                enrolledDate: new Date().toISOString()
            };
            
            const updatedPath = {
                skills: [...currentSkills, newSkill]
            };
            
            auditService.log('create', 'LearningPath', personId, `Assigned course '${course.title}' to ${personName}`);
            showToast(`Course '${course.title}' assigned to ${personName}.`);
            
            return { ...prevPaths, [personId]: updatedPath };
        });
    };

    const handleBulkAssign = (personId: number, skillIds: number[]) => {
        setLearningPaths(prev => {
            const currentPath = prev[personId] || { skills: [] };
            const existingSkillIds = new Set(currentPath.skills.map(s => s.skillId));
            
            const skillsToAdd = skillIds.filter(id => !existingSkillIds.has(id));
            
            if (skillsToAdd.length === 0) {
                showToast('All selected skills are already in the learning path.');
                return prev;
            }

            const newEntries = skillsToAdd.map(id => {
                const courses = findCoursesBySkillId(id);
                // Assign the first available course, or mark as Self-Directed
                const course = courses.length > 0 ? courses[0] : null;
                return {
                    skillId: id,
                    status: 'Not Started' as const,
                    courseId: course?.id,
                    courseName: course?.title || 'Self-Directed Study',
                    enrolledDate: new Date().toISOString()
                };
            });
            
            auditService.log('create', 'LearningPath', personId, `Bulk assigned ${newEntries.length} skills/courses`);
            setTimeout(() => showToast(`Successfully added ${newEntries.length} skills to the Development Plan.`), 0);

            return {
                ...prev,
                [personId]: {
                    ...currentPath,
                    skills: [...currentPath.skills, ...newEntries]
                }
            };
        });
    };
    
    const handlePersonSkillUpdate = (personId: number, skillId: number) => {
        setPeople(prevPeople => {
            return prevPeople.map(p => {
                if(p.id === personId) {
                    const hasSkill = p.skills.some(s => s.id === skillId);
                    if(!hasSkill) {
                        // Default to Beginner (Level 2) after course completion
                        const newSkills: PersonSkill[] = [...p.skills, { 
                            id: skillId, 
                            level: 2,
                            proficiency: 'Beginner',
                            verified: true, // Course completion verifies the skill
                            lastAssessed: new Date().toISOString().split('T')[0],
                            assessedBy: 'Manager' 
                        }]; 
                        return { ...p, skills: newSkills };
                    }
                }
                return p;
            });
        });
        showToast("Employee's skill profile has been updated automatically!");
    };

    const addNewOccupation = (newOccupation: Occupation) => {
        setOccupations(prev => [...prev, newOccupation]);
        auditService.log('create', 'Occupation', newOccupation.id, `Created new role: ${newOccupation.title}`);
    };

    const addNewSkills = (newSkills: Skill[]) => {
        setSkills(prev => {
            const existingSkillNames = new Set(prev.map(s => s.name.toLowerCase()));
            const uniqueNewSkills = newSkills.filter(s => !existingSkillNames.has(s.name.toLowerCase()));
            if (uniqueNewSkills.length > 0) {
                 auditService.log('create', 'Skill', 'Batch', `Added ${uniqueNewSkills.length} new AI-sourced skills`);
            }
            return [...prev, ...uniqueNewSkills];
        });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="glass-card p-10 flex flex-col items-center gap-4">
                    <div className="loader"></div>
                    <p className="text-sm text-gray-500">Loading your skills intelligence…</p>
                </div>
            </div>
        );
    }

    const activeLabel = TAB_META.find(t => t.id === activeTab)?.label ?? 'Dashboard';

    return (
        <div id="app" className="min-h-screen md:flex">
            <Sidebar activeTab={activeTab} onSwitchTab={handleSwitchTab} />

            <div className="flex-1 min-w-0 flex flex-col">
                <TopBar activeLabel={activeLabel} activeTab={activeTab} onSwitchTab={handleSwitchTab} />

                <main className="flex-grow w-full max-w-[1500px] mx-auto p-4 sm:p-6 lg:px-8">
                    <div key={activeTab} className="fade-in">
                        {activeTab === 'dashboard' && <DashboardSection people={people} skills={skills} occupations={occupations} learningPaths={learningPaths} courses={courses} onSwitchTab={handleSwitchTab} />}
                        {activeTab === 'people' && <PeopleSection people={people} skills={skills} occupations={occupations} courses={courses} onBulkAssign={handleBulkAssign} />}
                        {activeTab === 'occupations' && <OccupationsSection occupations={occupations} skills={skills} onAddOccupation={addNewOccupation} onAddNewSkills={addNewSkills} showToast={showToast} people={people} courses={courses} />}
                        {activeTab === 'projects' && <ProjectsSection people={people} skills={skills} showToast={showToast} setProjectAnalysis={setProjectAnalysis} />}
                        {activeTab === 'development' && <DevelopmentSection learningPaths={learningPaths} people={people} skills={skills} setLearningPaths={setLearningPaths} onSkillUpdate={handlePersonSkillUpdate} setAuditVersion={setAuditVersion} />}
                        {activeTab === 'analysis' && <AnalysisSection people={people} occupations={occupations} skills={skills} onAssignCourse={handleAssignCourse} onBulkAssign={handleBulkAssign} />}
                        {activeTab === 'manager' && <ManagerSection people={people} learningPaths={learningPaths} courses={courses} skills={skills} />}
                        {activeTab === 'reports' && <ReportsSection people={people} departments={departments} showToast={showToast} />}
                        {activeTab === 'audit' && <AuditSection auditVersion={auditVersion} />}
                    </div>
                </main>
            </div>

            {projectAnalysis && <ProjectAnalysisResultModal result={projectAnalysis} onClose={() => setProjectAnalysis(null)} />}

            <div id="toast" className={`fixed bottom-5 right-5 z-[60] glass-strong text-gray-800 py-3 px-5 rounded-2xl shadow-lg transition-all duration-300 ${toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                <p id="toast-message" className="text-sm font-medium">{toast.message}</p>
            </div>
        </div>
    );
};

// --- Section Components ---

interface DashboardSectionProps {
    people: Person[];
    skills: Skill[];
    occupations: Occupation[];
    learningPaths: LearningPaths;
    courses: Course[];
    onSwitchTab: (tab: Tab) => void;
}
const DashboardSection: React.FC<DashboardSectionProps> = ({ people, skills, occupations, learningPaths, courses, onSwitchTab }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);
    const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('jobs');
    const [isLoadingChart, setIsLoadingChart] = useState(false);
    const themeTick = useThemeTick();

    const getSkillById = (id: number) => skills.find(s => s.id === id);

    const updateHeatmap = useCallback(() => {
        setIsLoadingChart(true);
        if (!chartRef.current || people.length === 0 || skills.length === 0) {
            setIsLoadingChart(false);
            return;
        }

        const Chart = (window as any).Chart;
        if (!Chart) {
             console.warn("Chart.js not loaded");
             setIsLoadingChart(false);
             return;
        }

        const skillCounts: { [key: number]: number } = {};
        people.forEach(person => {
            person.skills.forEach(skill => {
                skillCounts[skill.id] = (skillCounts[skill.id] || 0) + 1;
            });
        });

        const topSkillIds = Object.entries(skillCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 15)
            .map(([id]) => parseInt(id));

        const yLabels = topSkillIds.map(id => getSkillById(id)?.name).filter(Boolean);
        const xLabels = heatmapMode === 'jobs' 
            ? [...new Set(people.map(p => p.job))] 
            : [...new Set(people.map(p => p.department))];

        const dataMap = new Map<string, number>();
        people.forEach(person => {
            const xValue = heatmapMode === 'jobs' ? person.job : person.department;
            person.skills.forEach(skill => {
                if (topSkillIds.includes(skill.id)) {
                    const skillInfo = getSkillById(skill.id);
                    if (skillInfo) {
                        const key = `${xValue}|${skillInfo.name}`;
                        dataMap.set(key, (dataMap.get(key) || 0) + 1);
                    }
                }
            });
        });

        const chartData: { x: string; y: string; v: number }[] = [];
        let maxCount = 1;
        dataMap.forEach((count, key) => {
            const [x, y] = key.split('|');
            if (count > maxCount) maxCount = count;
            chartData.push({ x, y, v: count });
        });
        
        const ctx = chartRef.current.getContext('2d');
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        const dark = isDarkTheme();
        const tickColor = cssVar('--text-muted', '#64748b');
        const emptyCell = dark ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.12)';
        const ramp: [number, number, number][] = [[191, 219, 254], [96, 165, 250], [79, 70, 229]];
        const heatColor = (ratio: number) => {
            const r = Math.max(0, Math.min(1, ratio));
            const seg = r <= 0.5 ? 0 : 1;
            const t = r <= 0.5 ? r / 0.5 : (r - 0.5) / 0.5;
            const a = ramp[seg], b = ramp[seg + 1];
            const mix = (k: number) => Math.round(a[k] + (b[k] - a[k]) * t);
            return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
        };
        if (Chart.defaults) Chart.defaults.font.family = "'Inter', sans-serif";

        if (ctx) {
            chartInstanceRef.current = new Chart(ctx, {
                type: 'matrix',
                data: {
                    datasets: [{
                        label: 'Skill Count',
                        data: chartData,
                        backgroundColor: (c: any) => {
                            const value = c.dataset.data[c.dataIndex]?.v;
                            if (value === undefined) return emptyCell;
                            return heatColor(value / maxCount);
                        },
                        hoverBackgroundColor: (c: any) => {
                            const value = c.dataset.data[c.dataIndex]?.v;
                            if (value === undefined) return emptyCell;
                            return heatColor(Math.min(1, value / maxCount + 0.25));
                        },
                        borderColor: dark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.75)',
                        borderWidth: 2,
                        borderRadius: 6,
                        hoverBorderColor: cssVar('--accent', '#4A90E2'),
                        width: ({chart}: any) => (chart.chartArea || {}).width / xLabels.length - 5,
                        height: ({chart}: any) => (chart.chartArea || {}).height / yLabels.length - 5,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 700, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        tooltip: { ...glassTooltip(dark), callbacks: { title: () => '', label: (c: any) => { const item = c.dataset.data[c.dataIndex]; return [`Skill: ${item.y}`, `${heatmapMode === 'jobs' ? 'Job' : 'Department'}: ${item.x}`, `Count: ${item.v}`]; } } }
                    },
                    scales: {
                        x: { type: 'category', labels: xLabels, offset: true, grid: { display: false }, border: { display: false }, ticks: { color: tickColor, autoSkip: false, maxRotation: 90, minRotation: 45 } },
                        y: { type: 'category', labels: yLabels, offset: true, grid: { display: false }, border: { display: false }, ticks: { color: tickColor } }
                    }
                }
            });
        }
        setIsLoadingChart(false);
    }, [heatmapMode, people, skills, themeTick]);

    useEffect(() => {
        const timer = setTimeout(() => updateHeatmap(), 100);
        return () => clearTimeout(timer);
    }, [updateHeatmap]);

    const RecommendedCourse = () => {
        const personWithGap = people.find(p => {
            const job = occupations.find(o => o.title === p.job);
            if (!job) return false;
            const personSkillIds = new Set(p.skills.map(s => s.id));
            return job.skills.some(s => !personSkillIds.has(s.id));
        });

        if (!personWithGap) return <p className="text-sm text-gray-500">Everyone is perfectly skilled for their role!</p>;

        const job = occupations.find(o => o.title === personWithGap.job)!;
        const gapSkill = job.skills.find(s => !personWithGap.skills.some(ps => ps.id === s.id));
        if (!gapSkill) return null;

        const recommendedCourse = courses.find(c => c.skillIds.includes(gapSkill.id));
        if (!recommendedCourse) return <p className="text-sm text-gray-500">No courses found for an identified skill gap.</p>;

        return (
             <div className="w-full text-left p-4 rounded-lg bg-yellow-50 hover:bg-yellow-100 transition">
                <h4 className="font-semibold text-yellow-800">🚀 Recommended for You</h4>
                <p className="text-sm text-yellow-700 mt-2">
                    Help <strong className="font-semibold">{personWithGap.name}</strong> close a skill gap in <strong className="font-semibold">{gapSkill.name}</strong> for their role.
                </p>
                 <a href={recommendedCourse.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-yellow-900 hover:underline mt-1 block">
                    Suggest: {recommendedCourse.title}
                </a>
            </div>
        )
    };

    return (
        <section>
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Company Dashboard</h2>
                <p className="mt-1 text-gray-600">This section provides a high-level overview of your organization's skills landscape and quick access to key functions.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard label="Total Employees" value={people.length} accent="#3b82f6" icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></>} />
                <KpiCard label="Total Skills Identified" value={skills.length} accent="#22c55e" icon={<><path d="m12 3 2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5L12 3Z"/></>} />
                <KpiCard label="Occupations Loaded" value={occupations.length} accent="#eab308" icon={<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>} />
                <KpiCard label="Active Learning Paths" value={Object.keys(learningPaths).length} accent="#a855f7" icon={<><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5"/></>} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-card p-6 relative">
                    {isLoadingChart && <Loader />}
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
                        <div><h3 className="text-xl font-semibold">Skills Heat Map</h3><p className="text-sm text-gray-600">Visualize skill density across jobs or departments.</p></div>
                        <div className="flex items-center bg-gray-200 rounded-lg p-1 mt-2 sm:mt-0">
                            <button onClick={() => setHeatmapMode('jobs')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${heatmapMode === 'jobs' ? 'heatmap-btn-active' : 'heatmap-btn-inactive'}`}>By Job</button>
                            <button onClick={() => setHeatmapMode('departments')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${heatmapMode === 'departments' ? 'heatmap-btn-active' : 'heatmap-btn-inactive'}`}>By Department</button>
                        </div>
                    </div>
                    <div className="chart-container h-[450px]"><canvas ref={chartRef}></canvas></div>
                </div>
                <div className="glass-card p-6">
                    <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
                    <div className="space-y-4">
                        <button onClick={() => onSwitchTab('occupations')} className="hover-slide w-full text-left p-4 rounded-xl bg-blue-50 hover:bg-blue-100"><h4 className="font-semibold text-blue-800">📄 View Occupations</h4><p className="text-sm text-blue-700">Explore official occupation profiles.</p></button>
                        <button onClick={() => onSwitchTab('analysis')} className="hover-slide w-full text-left p-4 rounded-xl bg-green-50 hover:bg-green-100"><h4 className="font-semibold text-green-800">🔍 Run a Skill Gap Analysis</h4><p className="text-sm text-green-700">Compare an employee to an occupation.</p></button>
                        <button onClick={() => onSwitchTab('manager')} className="hover-slide w-full text-left p-4 rounded-xl bg-purple-50 hover:bg-purple-100"><h4 className="font-semibold text-purple-800">👥 Manager Dashboard</h4><p className="text-sm text-purple-700">Manage team skills and budget.</p></button>
                        <RecommendedCourse />
                    </div>
                </div>
            </div>
        </section>
    );
};

interface PeopleSectionProps {
    people: Person[];
    skills: Skill[];
    occupations: Occupation[];
    courses: Course[];
    onBulkAssign: (personId: number, skillIds: number[]) => void;
}
const PeopleSection: React.FC<PeopleSectionProps> = ({ people, skills, occupations, courses, onBulkAssign }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [jobFilter, setJobFilter] = useState('');
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

    const allJobs = [...new Set(people.map(p => p.job))];
    const allDepartments = [...new Set(people.map(p => p.department))];

    const filteredPeople = people.filter(p => 
        (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (!departmentFilter || p.department === departmentFilter) &&
        (!jobFilter || p.job === jobFilter)
    );

    return (
        <section>
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-900">People</h2>
                <p className="mt-1 text-gray-600">Explore employee profiles, view their skills, and plan their career development paths.</p>
            </div>
            <div className="glass-card p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by name or email..." className="w-full sm:w-1/2 pl-4 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <div className="flex w-full sm:w-auto gap-4">
                        <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">All Departments</option>{allDepartments.map(d => <option key={d} value={d}>{d}</option>)}</select>
                        <select value={jobFilter} onChange={e => setJobFilter(e.target.value)} className="border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">All Jobs</option>{allJobs.map(j => <option key={j} value={j}>{j}</option>)}</select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Skill Match</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredPeople.map(person => {
                                const occupation = occupations.find(o => o.title === person.job);
                                let matchPercentage = 0;
                                if (occupation && occupation.skills.length > 0) {
                                    const personSkillIds = new Set(person.skills.map(s => s.id));
                                    const matchingCount = occupation.skills.filter(s => personSkillIds.has(s.id)).length;
                                    matchPercentage = (matchingCount / occupation.skills.length) * 100;
                                }
                                return (
                                    <tr key={person.id} onClick={() => setSelectedPerson(person)} className="hover:bg-gray-50 cursor-pointer">
                                        <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="flex-shrink-0 h-10 w-10"><img className="h-10 w-10 rounded-full" src={`https://placehold.co/40x40/E8E8E8/000000?text=${person.name.charAt(0)}`} alt=""/></div><div className="ml-4"><div className="text-sm font-medium text-gray-900">{person.name}</div><div className="text-sm text-gray-500">{person.email}</div></div></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.job}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.department}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="progress-track w-full h-3 mr-2"><div className="progress-fill" style={{width: `${matchPercentage}%`}}></div></div>
                                                <span className="text-sm text-gray-600 w-10 text-right">{Math.round(matchPercentage)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {selectedPerson && <PersonDetailModal person={selectedPerson} onClose={() => setSelectedPerson(null)} skills={skills} occupations={occupations} courses={courses} onBulkAssign={onBulkAssign} />}
        </section>
    );
};

interface PersonDetailModalProps {
    person: Person;
    onClose: () => void;
    skills: Skill[];
    occupations: Occupation[];
    courses: Course[];
    onBulkAssign: (personId: number, skillIds: number[]) => void;
}
const PersonDetailModal: React.FC<PersonDetailModalProps> = ({ person, onClose, skills, occupations, courses, onBulkAssign }) => {
    const [isCareerPathOpen, setIsCareerPathOpen] = useState(false);
    const getSkillById = (id: number) => skills.find(s => s.id === id);
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="flex justify-between items-start">
                <div><h2 className="text-2xl font-bold">{person.name}</h2><p className="text-gray-500">{person.job} - {person.department}</p></div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            <div className="mt-6">
                <h3 className="font-semibold text-lg">Current Skills</h3>
                <div className="mt-2 space-y-3">
                    {person.skills.map(s => {
                        const skillInfo = getSkillById(s.id);
                        return skillInfo ? (
                        <div key={s.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 hover:bg-gray-50 rounded">
                            <div className="mb-2 sm:mb-0">
                                <span className="font-medium text-gray-900 block">{skillInfo.name}</span>
                                <span className="text-xs text-gray-500">
                                    Last assessed: {s.lastAssessed || 'N/A'} by {s.assessedBy || 'System'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                {s.verified ? <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200" title="Validated by Manager">✓ Validated</span> : <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-200" title="Self-reported">⚠ Unvalidated</span>}
                                <ProficiencyBadge level={s.proficiency} />
                            </div>
                        </div>
                        ) : null;
                    })}
                </div>
            </div>
            <div className="mt-6 border-t pt-4">
                 <button onClick={() => setIsCareerPathOpen(true)} className="btn-primary font-semibold px-6 py-2 rounded-lg">Plan Career Move</button>
            </div>
            {isCareerPathOpen && <CareerPathModal person={person} occupations={occupations} skills={skills} courses={courses} onClose={() => setIsCareerPathOpen(false)} onBulkAssign={onBulkAssign} />}
        </Modal>
    );
}

interface CareerPathModalProps {
    person: Person;
    onClose: () => void;
    occupations: Occupation[];
    skills: Skill[];
    courses: Course[];
    onBulkAssign: (personId: number, skillIds: number[]) => void;
}
const CareerPathModal: React.FC<CareerPathModalProps> = ({ person, onClose, occupations, skills, courses, onBulkAssign }) => {
    const [targetOccupationId, setTargetOccupationId] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [learningPlan, setLearningPlan] = useState<string | null>(null);

    const targetOccupation = occupations.find(o => o.id === parseInt(targetOccupationId));
    
    let gapSkills: OccupationSkill[] = [];
    if (targetOccupation) {
        const personSkillIds = new Set(person.skills.map(s => s.id));
        gapSkills = targetOccupation.skills.filter(s => !personSkillIds.has(s.id));
    }

    useEffect(() => {
        setLearningPlan(null);
    }, [targetOccupationId]);

    const handleGeneratePlan = async () => {
        if (!targetOccupation || gapSkills.length === 0) return;
        setIsGenerating(true);
        const gapSkillNames = gapSkills.map(s => s.name);
        const plan = await generateLearningPlan(person.name, person.job, targetOccupation.title, gapSkillNames);
        setLearningPlan(plan);
        setIsGenerating(false);
        auditService.log('create', 'CareerPlan', person.id, `Generated AI career plan to become ${targetOccupation.title}`);
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-3xl">
            <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold">AI-Powered Career Path</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            <p className="text-gray-600 mt-2">Plan a career move for <strong className="font-semibold">{person.name}</strong> from '{person.job}' to a new role.</p>
            <div className="mt-4">
                <label htmlFor="target-occupation" className="block text-sm font-medium text-gray-700">Select Target Role</label>
                <select id="target-occupation" value={targetOccupationId} onChange={e => setTargetOccupationId(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                    <option value="">Select a role...</option>
                    {occupations.filter(o => o.title !== person.job).map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                </select>
            </div>

            {targetOccupation && (
                <div className="mt-6">
                    <h3 className="font-semibold text-lg">Development Plan to become a {targetOccupation.title}</h3>
                    {gapSkills.length > 0 ? (
                        <div className="mt-4">
                            <p className="text-sm text-gray-600">Identified skill gaps: {gapSkills.map(s => s.name).join(', ')}.</p>
                            <div className="mt-4 flex gap-4">
                                <button onClick={handleGeneratePlan} disabled={isGenerating} className="btn-primary font-semibold px-6 py-2 rounded-lg disabled:bg-gray-400">
                                    {isGenerating ? 'Generating...' : 'Generate AI Learning Plan'}
                                </button>
                                <button 
                                    onClick={() => onBulkAssign(person.id, gapSkills.map(s => s.id))} 
                                    className="btn-secondary font-semibold px-6 py-2 rounded-lg"
                                >
                                    Auto-Assign Recommended Courses
                                </button>
                            </div>
                            {isGenerating && (
                                <div className="mt-4 flex justify-center">
                                    <div className="loader" style={{borderTopColor: '#4A90E2', height: '30px', width: '30px'}}></div>
                                </div>
                            )}
                            {learningPlan && (
                                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h4 className="font-semibold text-lg text-blue-800 mb-2">Your Personalized Pathway</h4>
                                    <FormattedReport text={learningPlan} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="mt-4 p-4 bg-green-100 text-green-800 rounded-lg">Excellent news! {person.name} already possesses all the required skills for the {targetOccupation.title} role.</p>
                    )}
                </div>
            )}
        </Modal>
    );
}

interface OccupationsSectionProps {
    occupations: Occupation[];
    skills: Skill[];
    people: Person[];
    courses: Course[];
    onAddOccupation: (occupation: Occupation) => void;
    onAddNewSkills: (skills: Skill[]) => void;
    showToast: (message: string) => void;
}
const OccupationsSection: React.FC<OccupationsSectionProps> = ({ occupations, skills, people, courses, onAddOccupation, onAddNewSkills, showToast }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [analysisResult, setAnalysisResult] = useState<{title: string, categories: GeminiSkillCategory[]} | null>(null);
    const [strategyOccupation, setStrategyOccupation] = useState<Occupation | null>(null);

    const extractTextFromPdf = async (file: File): Promise<string> => {
        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) throw new Error("PDF.js library not loaded");

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
        const fileReader = new FileReader();
        return new Promise((resolve, reject) => {
            fileReader.onload = async function() {
                try {
                    const typedarray = new Uint8Array(this.result as ArrayBuffer);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let fullText = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map((item: any) => item.str).join(' ');
                    }
                    resolve(fullText);
                } catch (error) {
                    reject(error);
                }
            };
            fileReader.onerror = reject;
            fileReader.readAsArrayBuffer(file);
        });
    };
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setIsUploading(true);
            setUploadStatus(`Analyzing ${file.name}...`);
            try {
                const text = await extractTextFromPdf(file);
                setUploadStatus('Extracting skills with Gemini...');
                const extracted = await extractSkillsFromText(text);
                const jobTitle = file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ');
                setAnalysisResult({ title: jobTitle, categories: extracted });
            } catch (error) {
                showToast('Failed to process PDF.');
                console.error(error);
            } finally {
                setIsUploading(false);
                setUploadStatus('');
            }
        }
    };

    const handleConfirmSkills = (selectedSkills: OccupationSkill[]) => {
        if (!analysisResult) return;
        const newOccupation: Occupation = {
            id: occupations.length + 1,
            title: analysisResult.title,
            description: `Custom role for ${analysisResult.title} created from PDF analysis.`,
            skills: selectedSkills,
        };

        const allSkillsInSystem = new Set(skills.map(s => s.name.toLowerCase()));
        const newSkillsToAdd: Skill[] = selectedSkills
            .filter(s => !allSkillsInSystem.has(s.name.toLowerCase()))
            .map((s, index) => ({ id: skills.length + 1 + index, name: s.name, category: 'AI Sourced' }));

        if(newSkillsToAdd.length > 0) {
            onAddNewSkills(newSkillsToAdd);
        }

        onAddOccupation(newOccupation);
        showToast(`Successfully added role: ${analysisResult.title} with ${selectedSkills.length} skills.`);
        setAnalysisResult(null);
    };

    const filteredOccupations = occupations.filter(occ => occ.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <section>
            <div className="mb-6"><h2 className="text-3xl font-bold text-gray-900">Occupations & Job Descriptions</h2><p className="mt-1 text-gray-600">Manage company roles, analyze job descriptions with AI, and run strategic "Build vs. Buy" talent analysis.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-8">
                    <div className="glass-card p-6">
                        <h3 className="text-xl font-semibold mb-4">Upload Job Description</h3>
                        {!isUploading ? (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <span className="text-5xl">📄</span>
                            <p className="mt-2 text-sm text-gray-600">Drag & drop a PDF here, or</p>
                            <input type="file" id="job-pdf-upload" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                            <label htmlFor="job-pdf-upload" className="mt-4 cursor-pointer btn-primary px-4 py-2 rounded-lg font-semibold text-sm">Browse Files</label>
                        </div>
                        ) : (
                        <div>
                             <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                                <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{width: '100%'}}></div>
                            </div>
                            <p className="mt-2 text-sm text-gray-600 text-center">{uploadStatus}</p>
                        </div>
                        )}
                    </div>
                </div>
                <div className="md:col-span-2 glass-card p-6 relative">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold">Current Roles</h3>
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search roles..." className="w-1/2 pl-4 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {filteredOccupations.map(occ => (
                            <div key={occ.id} className="border p-4 rounded-lg">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-semibold text-gray-800">{occ.title}</h4>
                                        <p className="text-sm text-gray-600 mt-1">{occ.description.substring(0, 150)}...</p>
                                        <p className="text-xs text-gray-500 mt-2"><strong>Skills:</strong> {occ.skills.slice(0, 5).map(s => s.name).join(', ')}...</p>
                                    </div>
                                    <button onClick={() => setStrategyOccupation(occ)} className="btn-secondary text-xs font-semibold px-3 py-1 rounded-md whitespace-nowrap">Talent Strategy</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {analysisResult && <GeminiAnalysisModal result={analysisResult} onClose={() => setAnalysisResult(null)} onConfirm={handleConfirmSkills} allSkills={skills} />}
            {strategyOccupation && <TalentStrategyModal occupation={strategyOccupation} people={people} courses={courses} onClose={() => setStrategyOccupation(null)} />}
        </section>
    );
};

interface AnalysisSectionProps {
    people: Person[];
    occupations: Occupation[];
    skills: Skill[];
    onAssignCourse: (personId: number, personName: string, skillId: number, course: Course) => void;
    onBulkAssign: (personId: number, skillIds: number[]) => void;
}

const AnalysisSection: React.FC<AnalysisSectionProps> = ({ people, occupations, skills, onAssignCourse, onBulkAssign }) => {
    const [selectedPersonId, setSelectedPersonId] = useState<string>('');
    const [selectedOccupationId, setSelectedOccupationId] = useState<string>('');
    const [analysisResult, setAnalysisResult] = useState<{ matchingSkills: number[], gapSkills: number[], person: Person, occupation: Occupation } | null>(null);
    const [learningPlan, setLearningPlan] = useState<string | null>(null);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
    const [courseFinderState, setCourseFinderState] = useState<{open: boolean, skillId: number | null}>({open: false, skillId: null});

    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);
    const themeTick = useThemeTick();

    const getSkillById = (id: number) => skills.find(s => s.id === id);

    useEffect(() => {
        const runGapAnalysis = () => {
            setLearningPlan(null);
            if (!selectedPersonId || !selectedOccupationId) {
                setAnalysisResult(null);
                return;
            }
            const person = people.find(p => p.id === parseInt(selectedPersonId));
            const occupation = occupations.find(o => o.id === parseInt(selectedOccupationId));
            if (!person || !occupation) return;
            const personSkillIds = new Set(person.skills.map(s => s.id));
            const matchingSkills = occupation.skills.map(s => s.id).filter(id => personSkillIds.has(id));
            const gapSkills = occupation.skills.filter(s => !personSkillIds.has(s.id)).map(s => s.id);
            setAnalysisResult({ matchingSkills, gapSkills, person, occupation });
        };
        runGapAnalysis();
    }, [selectedPersonId, selectedOccupationId, people, occupations, skills]);

    useEffect(() => {
        if (analysisResult && chartRef.current) {
            const Chart = (window as any).Chart;
            if(!Chart) return;

            const ctx = chartRef.current.getContext('2d');
            if (chartInstanceRef.current) chartInstanceRef.current.destroy();
            if (ctx) {
                const dark = isDarkTheme();
                const total = analysisResult.occupation.skills.length;
                const matches = analysisResult.matchingSkills.length;
                const gaps = analysisResult.gapSkills.length;
                const pct = total > 0 ? Math.round((matches / total) * 100) : 100;
                if (Chart.defaults) Chart.defaults.font.family = "'Inter', sans-serif";
                chartInstanceRef.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Matching Skills', 'Skill Gaps'],
                        datasets: [{
                            data: [matches, gaps],
                            backgroundColor: (c: any) => {
                                const { chart, dataIndex } = c;
                                const { ctx: cx, chartArea } = chart;
                                if (!chartArea) return dataIndex === 0 ? '#10b981' : '#f43f5e';
                                return dataIndex === 0
                                    ? vGradient(cx, chartArea, '#34d399', '#059669')
                                    : vGradient(cx, chartArea, '#fb7185', '#e11d48');
                            },
                            borderColor: 'transparent', borderWidth: 0, borderRadius: 8,
                            spacing: matches > 0 && gaps > 0 ? 3 : 0, hoverOffset: 10,
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, cutout: '72%',
                        animation: { animateRotate: true, animateScale: true, duration: 900, easing: 'easeOutQuart' },
                        plugins: {
                            legend: { display: false },
                            tooltip: glassTooltip(dark),
                            centerText: { text: `${pct}%`, sub: 'match', color: cssVar('--text-strong', dark ? '#f1f5f9' : '#0f172a'), subColor: cssVar('--text-muted', '#64748b'), size: 30 },
                        } as any
                    },
                    plugins: [centerTextPlugin]
                });
            }
        }
    }, [analysisResult, themeTick]);

    const handleGeneratePlan = async () => {
        if (!analysisResult) return;
        setIsGeneratingPlan(true);
        setLearningPlan(null);
        const { person, occupation, gapSkills } = analysisResult;
        const gapSkillNames = gapSkills.map(id => getSkillById(id)?.name).filter((name): name is string => !!name);
        if (gapSkillNames.length > 0) {
            const plan = await generateLearningPlan(person.name, person.job, occupation.title, gapSkillNames);
            setLearningPlan(plan);
        }
        setIsGeneratingPlan(false);
    };

    const matchPercentage = analysisResult && analysisResult.occupation.skills.length > 0
        ? Math.round((analysisResult.matchingSkills.length / analysisResult.occupation.skills.length) * 100)
        : analysisResult ? 100 : 0;

    return (
        <section>
            <div className="mb-6"><h2 className="text-3xl font-bold text-gray-900">Skills Analysis</h2><p className="mt-1 text-gray-600">Perform a detailed skills gap analysis, generate an AI learning plan, and find microcredentials to close gaps.</p></div>
            <div className="glass-card p-6 relative">
                <h3 className="text-xl font-semibold mb-4">Skills Gap Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label htmlFor="gap-analysis-person" className="block text-sm font-medium text-gray-700">Select Person</label>
                        <select id="gap-analysis-person" value={selectedPersonId} onChange={e => setSelectedPersonId(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                            <option value="">Select a person</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    </div>
                    <div>
                        <label htmlFor="gap-analysis-occupation" className="block text-sm font-medium text-gray-700">Select Occupation</label>
                        <select id="gap-analysis-occupation" value={selectedOccupationId} onChange={e => setSelectedOccupationId(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                            <option value="">Select an occupation</option>{occupations.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}</select>
                    </div>
                </div>

                {analysisResult && (
                    <div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1 flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg"><h4 className="font-semibold text-lg mb-2">Skill Match</h4><div className="chart-container" style={{ height: '200px', maxWidth: '200px' }}><canvas ref={chartRef}></canvas></div><p className="text-center text-sm mt-2 text-gray-600">{analysisResult.person.name} has {matchPercentage}% of the skills for a {analysisResult.occupation.title}.</p></div>
                            <div className="p-4 bg-green-50 rounded-lg"><h4 className="font-semibold text-lg text-green-800 mb-2">Matching Skills</h4><ul className="space-y-2 text-sm text-green-700">{analysisResult.matchingSkills.length > 0 ? analysisResult.matchingSkills.map(id => <li key={id}>{getSkillById(id)?.name}</li>) : <li>No matching skills.</li>}</ul></div>
                            <div className="p-4 bg-red-50 rounded-lg flex flex-col">
                                <h4 className="font-semibold text-lg text-red-800 mb-2">Skill Gaps</h4>
                                <ul className="space-y-2 text-sm text-red-700 flex-grow mb-4">
                                    {analysisResult.gapSkills.length > 0 ? analysisResult.gapSkills.map(id => {
                                        const skill = getSkillById(id); 
                                        return skill ? (
                                            <li key={id} className="flex justify-between items-center">
                                                <span>{skill.name}</span>
                                                <button onClick={() => setCourseFinderState({open: true, skillId: skill.id})} className="text-purple-600 hover:underline text-xs font-semibold">Find a Course</button>
                                            </li>
                                        ) : null;
                                    }) : <li>No skill gaps! Perfect fit.</li>}
                                </ul>
                                {analysisResult.gapSkills.length > 0 && (
                                    <button 
                                        onClick={() => onBulkAssign(analysisResult.person.id, analysisResult.gapSkills)} 
                                        className="btn-primary w-full py-2 text-sm font-semibold rounded"
                                    >
                                        Auto-Assign Recommended Courses
                                    </button>
                                )}
                            </div>
                        </div>

                        {analysisResult.gapSkills.length > 0 && (<div className="mt-6 border-t pt-6"><button onClick={handleGeneratePlan} disabled={isGeneratingPlan} className="btn-primary font-semibold px-6 py-2 rounded-lg disabled:bg-gray-400">{isGeneratingPlan ? 'Generating Plan...' : 'Generate AI Learning Plan'}</button>{isGeneratingPlan && (<div className="mt-4 flex justify-center"><div className="loader" style={{borderTopColor: '#4A90E2', height: '30px', width: '30px'}}></div></div>)}{learningPlan && (<div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"><h4 className="font-semibold text-lg text-blue-800 mb-2">Personalized Learning Plan</h4><FormattedReport text={learningPlan} /></div>)}</div>)}
                    </div>
                )}
            </div>
             {courseFinderState.open && courseFinderState.skillId && analysisResult && <CourseFinderModal skill={getSkillById(courseFinderState.skillId)!} person={analysisResult.person} onClose={() => setCourseFinderState({open: false, skillId: null})} onAssignCourse={onAssignCourse} />}
        </section>
    );
};

const ProjectsSection: React.FC<any> = ({ people, skills, showToast, setProjectAnalysis }) => {
    const [projectBrief, setProjectBrief] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalyze = async () => {
        if (!projectBrief.trim()) {
            showToast('Please enter a project brief.');
            return;
        }
        setIsAnalyzing(true);
        const requirements = await analyzeProjectRequirements(projectBrief);
        
        const analysisResults: ProjectAnalysisResult[] = requirements.map(req => {
            const skillObj = skills.find((s: Skill) => s.name.toLowerCase() === req.skill.toLowerCase());
            let availableFTEs = 0;
            if (skillObj) {
                availableFTEs = people.filter((p: Person) => p.skills.some(s => s.id === skillObj.id)).length;
            }
            return {
                skill: req.skill,
                requiredFTEs: req.requiredFTEs,
                availableFTEs: availableFTEs,
                gap: Math.max(0, req.requiredFTEs - availableFTEs)
            };
        });

        setProjectAnalysis(analysisResults);
        setIsAnalyzing(false);
    };

    return (
        <section>
            <div className="mb-6"><h2 className="text-3xl font-bold text-gray-900">Project Planning</h2><p className="mt-1 text-gray-600">Analyze project requirements and identify skill gaps instantly using AI.</p></div>
            <div className="glass-card p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Brief / RFP Text</label>
                <textarea 
                    className="w-full h-48 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="Paste your project description here..."
                    value={projectBrief}
                    onChange={(e) => setProjectBrief(e.target.value)}
                ></textarea>
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={handleAnalyze} 
                        disabled={isAnalyzing}
                        className="btn-primary px-6 py-2 rounded-lg font-semibold flex items-center"
                    >
                        {isAnalyzing ? <span className="loader mr-2 w-4 h-4 border-2"></span> : '✨'} 
                        {isAnalyzing ? 'Analyzing...' : 'Analyze Requirements'}
                    </button>
                </div>
            </div>
        </section>
    );
};

const ProjectAnalysisResultModal: React.FC<{ result: ProjectAnalysisResult[], onClose: () => void }> = ({ result, onClose }) => {
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Project Skills Analysis</h2>
                <button onClick={onClose} className="text-3xl text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Skill</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required FTEs</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available Internal</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gap</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {result.map((row, idx) => (
                            <tr key={idx}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.skill}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.requiredFTEs}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.availableFTEs}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.gap}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {row.gap > 0 ? 
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Critical Gap</span> : 
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Covered</span>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
};

const DevelopmentSection: React.FC<any> = ({ learningPaths, people, skills, setLearningPaths, onSkillUpdate, setAuditVersion }) => {
    const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

    // Filter people who actually have learning paths
    const activePeople = people.filter((p: Person) => learningPaths[p.id]?.skills.length > 0);

    // Auto-select the first person if none selected
    useEffect(() => {
        if (!selectedPersonId && activePeople.length > 0) {
            setSelectedPersonId(activePeople[0].id);
        }
    }, [activePeople, selectedPersonId]);

    const selectedPerson = people.find((p: Person) => p.id === selectedPersonId);
    const selectedPath = selectedPerson ? learningPaths[selectedPerson.id] : null;

    // Helper to calc progress
    const calculateProgress = (pid: number) => {
       const path = learningPaths[pid];
       if(!path || path.skills.length === 0) return 0;
       const completed = path.skills.filter((s: LearningPathSkill) => s.status === 'Completed').length;
       return Math.round((completed / path.skills.length) * 100);
    }

    const handleMarkComplete = (skillId: number) => {
        if (!selectedPersonId) return;
        
        // 1. Update State (Pure)
        setLearningPaths((prev: LearningPaths) => {
            const personPath = prev[selectedPersonId];
            if (!personPath) return prev;

            const skillIndex = personPath.skills.findIndex((s: LearningPathSkill) => s.skillId === skillId);
            if (skillIndex === -1) return prev;
            
            const updatedSkills = [...personPath.skills];
            // Only update if not already completed
            if (updatedSkills[skillIndex].status === 'Completed') return prev;

            updatedSkills[skillIndex] = { 
                ...updatedSkills[skillIndex], 
                status: 'Completed', 
                completedDate: new Date().toISOString() 
            };
            
            return { ...prev, [selectedPersonId]: { ...personPath, skills: updatedSkills } };
        });

        // 2. Perform Side Effects outside the setter
        auditService.log(
            'update', 
            'LearningPath', 
            selectedPersonId, 
            `Marked skill as completed`,
            [{ field: `Skill ID ${skillId} Status`, oldValue: 'In Progress', newValue: 'Completed' }]
        );
        
        setAuditVersion((v: number) => v + 1);
        onSkillUpdate(selectedPersonId, skillId);
    };

    if (activePeople.length === 0) {
        return (
            <div className="p-10 text-center glass-card">
                <p className="text-gray-500">No active learning paths. Assign courses from the Analysis tab to begin.</p>
            </div>
        );
    }

    const selectedProgress = selectedPerson ? calculateProgress(selectedPerson.id) : 0;

    return (
        <section className="flex flex-col lg:flex-row h-[calc(100vh-140px)] glass-card overflow-hidden font-sans">
            {/* Left Sidebar - Team List */}
            <aside className="w-full lg:w-96 glass-soft border-r overflow-y-auto custom-scrollbar">
                <div className="p-6">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Team Progress</h2>
                    <div className="space-y-4">
                        {activePeople.map((p: Person) => {
                            const progress = calculateProgress(p.id);
                            const isSelected = selectedPersonId === p.id;
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedPersonId(p.id)}
                                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-[#4A90E2] glass-strong ring-2 ring-[#4A90E2]/30 shadow-md' : 'border-transparent hover:bg-slate-50 border-slate-100'}`}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <img 
                                            alt={p.name} 
                                            className="w-10 h-10 rounded-full object-cover bg-slate-200" 
                                            src={`https://placehold.co/40x40/303F9F/FFFFFF?text=${p.name.charAt(0)}`}
                                        />
                                        <div>
                                            <h3 className="font-bold text-sm text-slate-800">{p.name}</h3>
                                            <p className="text-[10px] text-slate-500">{p.job}</p>
                                        </div>
                                        <div className="ml-auto text-right">
                                            <p className={`text-sm font-black ${isSelected ? 'text-[#2f6fd0]' : 'text-slate-400'}`}>{progress}%</p>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${isSelected ? 'bg-[#2f6fd0]' : 'bg-slate-300'}`} 
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </aside>

            {/* Main Content - Detail View */}
            <main className="flex-1 bg-transparent overflow-y-auto p-8 relative">
                {selectedPerson && selectedPath && (
                    <div className="max-w-5xl mx-auto">
                        {/* Header */}
                        <div className="flex items-end justify-between mb-8 border-b border-slate-200 pb-6">
                            <div>
                                <span className="px-2 py-1 bg-[#2f6fd0]/10 text-[#2f6fd0] text-[10px] font-bold rounded mb-2 inline-block uppercase tracking-wider">Selected Employee</span>
                                <h2 className="text-3xl font-bold text-slate-800">{selectedPerson.name}</h2>
                                <p className="text-sm text-slate-500 font-medium mt-1">{selectedPerson.job} Pathway • Enrolled {new Date(selectedPath.skills[0]?.enrolledDate || Date.now()).toLocaleDateString('en-US', {month: 'short', year: 'numeric'})}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-4xl font-black text-[#2f6fd0]">{selectedProgress}%</p>
                                <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400">Total Pathway Progress</p>
                            </div>
                        </div>

                        {/* Horizontal Scroll Cards (Milestones) */}
                        <div className="mb-12 relative group">
                             <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide snap-x">
                                {selectedPath.skills.map((item: LearningPathSkill, idx: number) => {
                                    const skillName = skills.find(s => s.id === item.skillId)?.name || 'Skill';
                                    const isCompleted = item.status === 'Completed';
                                    const isInProgress = item.status === 'In Progress' || item.status === 'Not Started'; // Treating Not Started as In Progress visually for the card if it's the next one, but simplifiying logic here.
                                    
                                    // Visual logic: Completed -> Green, In Progress -> Blue/Primary, Not Started -> Gray
                                    if (item.status === 'Completed') {
                                        return (
                                            <div key={idx} className="flex-shrink-0 w-80 glass-card p-5 snap-center">
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="material-symbols-outlined text-green-600 bg-green-100 rounded-full p-1 text-lg font-bold">check</span>
                                                    <span className="text-[11px] font-bold text-green-600 uppercase tracking-tight">Completed</span>
                                                </div>
                                                <div className="w-full h-32 bg-green-50 rounded-xl mb-4 flex items-center justify-center">
                                                    <span className="text-4xl">🏆</span>
                                                </div>
                                                <h3 className="font-bold text-base mb-2 text-slate-800 line-clamp-1" title={skillName}>{skillName}</h3>
                                                <div className="w-full bg-slate-100 h-2 rounded-full mb-4">
                                                    <div className="bg-green-500 h-full w-full rounded-full"></div>
                                                </div>
                                                <button className="w-full py-2.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors">View Certificate</button>
                                            </div>
                                        );
                                    } else {
                                        // Current / Upcoming
                                        const isCurrent = item.status === 'In Progress' || item.status === 'Not Started'; // Simplified for demo
                                        return (
                                            <div key={idx} className="flex-shrink-0 w-80 glass-card p-5 ring-2 ring-[#4A90E2]/30 snap-center">
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="material-symbols-outlined text-[#2f6fd0] bg-blue-100 rounded-full p-1 text-lg">pending</span>
                                                    <span className="text-[11px] font-bold text-[#2f6fd0] uppercase tracking-tight">Current Focus</span>
                                                </div>
                                                <div className="w-full h-32 bg-blue-50 rounded-xl mb-4 flex items-center justify-center">
                                                    <span className="text-4xl">📚</span>
                                                </div>
                                                <h3 className="font-bold text-base mb-2 text-slate-800 line-clamp-1" title={skillName}>{skillName}</h3>
                                                <div className="w-full bg-slate-100 h-2 rounded-full mb-4">
                                                    <div className="bg-[#2f6fd0] h-full w-[45%] rounded-full"></div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <a href="#" className="block w-full py-3 bg-[#2f6fd0] text-white text-center text-xs font-bold rounded-xl shadow-lg shadow-[#2f6fd0]/20 hover:bg-[#255aa8] transition-colors">
                                                        Start Learning
                                                    </a>
                                                    <button 
                                                        onClick={() => handleMarkComplete(item.skillId)}
                                                        className="w-full py-2 border border-slate-200 text-slate-400 text-[10px] font-bold rounded-lg uppercase hover:bg-slate-50 hover:text-slate-600 transition-colors"
                                                    >
                                                        Mark as Completed
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        </div>

                        {/* Detailed List View */}
                        <div className="relative space-y-8 pl-4">
                            <div className="absolute left-[2rem] top-4 bottom-4 w-0.5 bg-slate-200"></div>
                            
                            {selectedPath.skills.map((item: LearningPathSkill, idx: number) => {
                                const skillName = skills.find(s => s.id === item.skillId)?.name || 'Skill';
                                const isCompleted = item.status === 'Completed';
                                
                                return (
                                    <div key={idx} className="relative pl-12">
                                        <div className={`absolute left-0 top-2 w-10 h-10 rounded-full border-4 border-white flex items-center justify-center z-10 shadow-sm ${isCompleted ? 'bg-green-500 text-white' : 'bg-[#2f6fd0] text-white'}`}>
                                            <span className="material-symbols-outlined text-xl">{isCompleted ? 'check' : 'play_arrow'}</span>
                                        </div>
                                        <div className="glass-card p-6 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow">
                                            <div className={`w-32 h-20 rounded-xl flex-shrink-0 flex items-center justify-center text-3xl ${isCompleted ? 'bg-green-50' : 'bg-blue-50'}`}>
                                                {isCompleted ? '🎓' : '📖'}
                                            </div>
                                            <div className="flex-grow">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-base text-slate-800">{skillName}</h4>
                                                        <p className="text-xs text-slate-500">{item.courseName || 'Self-Directed Learning'}</p>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${isCompleted ? 'text-green-600 bg-green-50' : 'text-[#2f6fd0] bg-blue-50'}`}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                                                    <div className={`h-full w-full ${isCompleted ? 'bg-green-500' : 'bg-[#2f6fd0] w-1/3'}`}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </section>
    );
};

const ManagerSection: React.FC<any> = ({ people, learningPaths, courses, skills }) => {
    // Calculate simple budget stats
    const totalBudget = 50000;
    let committed = 0;
    
    Object.values(learningPaths).forEach((path: any) => {
        path.skills.forEach((s: any) => {
            if (s.courseId) {
                const c = courses.find((course: Course) => course.id === s.courseId);
                if (c) committed += c.cost;
            }
        });
    });

    const spent = committed * 0.4; // Simulate 40% actually spent
    const remaining = totalBudget - committed;

    return (
        <section>
            <div className="mb-6"><h2 className="text-3xl font-bold text-gray-900">Manager Hub</h2><p className="mt-1 text-gray-600">Oversee team development budgets and approvals.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-card kpi-card p-6 border-l-4 border-blue-500">
                    <h3 className="text-gray-500 text-sm font-medium">Total L&D Budget</h3>
                    <p className="text-3xl font-bold mt-2">${totalBudget.toLocaleString()}</p>
                </div>
                <div className="glass-card kpi-card p-6 border-l-4 border-yellow-500">
                    <h3 className="text-gray-500 text-sm font-medium">Committed</h3>
                    <p className="text-3xl font-bold mt-2">${committed.toLocaleString()}</p>
                </div>
                 <div className="glass-card kpi-card p-6 border-l-4 border-green-500">
                    <h3 className="text-gray-500 text-sm font-medium">Remaining</h3>
                    <p className="text-3xl font-bold mt-2">${remaining.toLocaleString()}</p>
                </div>
            </div>
            
            <div className="glass-card p-6">
                <h3 className="text-xl font-semibold mb-4">Team Skill Verification Requests</h3>
                <div className="space-y-4">
                     <p className="text-gray-500 text-sm">No pending verification requests.</p>
                </div>
            </div>
        </section>
    );
};

const ReportsSection: React.FC<any> = ({ people, departments }) => {
    return (
        <section>
             <div className="mb-6"><h2 className="text-3xl font-bold text-gray-900">Reports</h2><p className="mt-1 text-gray-600">Strategic insights into organization capabilities.</p></div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                    <h3 className="font-semibold mb-4">Skill Distribution by Department</h3>
                    <div className="h-64 flex items-end justify-around space-x-2 px-4 border-b">
                        {departments.map((dept: string, i: number) => {
                             const count = people.filter((p: Person) => p.department === dept).length;
                             const height = Math.max(10, count * 20); // Scale roughly
                             return (
                                 <div key={i} className="flex flex-col items-center w-full">
                                     <div className="w-full bg-blue-500 rounded-t" style={{height: `${height}px`}}></div>
                                     <span className="text-xs mt-2 text-gray-600 truncate w-full text-center">{dept}</span>
                                 </div>
                             )
                        })}
                    </div>
                </div>
                <div className="glass-card p-6">
                    <h3 className="font-semibold mb-4">Proficiency Levels</h3>
                    <div className="space-y-3">
                        {['Novice', 'Beginner', 'Competent', 'Proficient', 'Expert'].map((level) => {
                            const count = people.reduce((acc: number, p: Person) => acc + p.skills.filter(s => s.proficiency === level).length, 0);
                            const totalSkills = people.reduce((acc: number, p: Person) => acc + p.skills.length, 0);
                            const pct = totalSkills ? (count / totalSkills) * 100 : 0;
                            return (
                                <div key={level}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>{level}</span>
                                        <span>{count}</span>
                                    </div>
                                    <div className="progress-track w-full h-2">
                                        <div className="progress-fill" style={{width: `${pct}%`}}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
             </div>
        </section>
    );
};

const AuditSection: React.FC<{ auditVersion: number }> = ({ auditVersion }) => {
    const [logs, setLogs] = useState(auditService.getLogs());

    useEffect(() => {
        setLogs(auditService.getLogs());
    }, [auditVersion]);

    return (
        <section>
            <div className="mb-6 flex justify-between items-center">
                <div><h2 className="text-3xl font-bold text-gray-900">Audit Logs</h2><p className="mt-1 text-gray-600">Track all changes and system activities.</p></div>
                <button onClick={() => auditService.exportLogs()} className="btn-secondary px-4 py-2 rounded">Export CSV</button>
            </div>
            <div className="glass-card overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.user}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><span className={`uppercase text-xs font-bold ${log.action === 'create' ? 'text-green-600' : 'text-blue-600'}`}>{log.action}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.entityType} #{log.entityId}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{log.details}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

const CourseFinderModal: React.FC<any> = ({ skill, person, onClose, onAssignCourse }) => {
    const skillCourses = findCoursesBySkillId(skill.id);
    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Courses for {skill.name}</h2>
                <button onClick={onClose} className="text-3xl text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="space-y-4">
                {skillCourses.length > 0 ? skillCourses.map(course => (
                    <div key={course.id} className="border p-4 rounded-lg flex justify-between items-center">
                        <div>
                            <h4 className="font-bold text-gray-800">{course.title}</h4>
                            <p className="text-sm text-gray-600">{course.provider} • ${course.cost}</p>
                            <a href={course.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">View Course Details</a>
                        </div>
                        <button onClick={() => { onAssignCourse(person.id, person.name, skill.id, course); onClose(); }} className="btn-primary px-4 py-2 rounded text-sm">Assign</button>
                    </div>
                )) : (
                    <p className="text-gray-500">No specific courses found for this skill in the catalog. Consider adding a custom self-directed learning task.</p>
                )}
            </div>
        </Modal>
    );
};

const GeminiAnalysisModal: React.FC<any> = ({ result, onClose, onConfirm, allSkills }) => {
    const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());

    useEffect(() => {
        const initial = new Set<string>();
        result.categories.forEach((cat: GeminiSkillCategory) => {
            cat.skills.forEach(s => initial.add(s));
        });
        setSelectedSkills(initial);
    }, [result]);

    const toggleSkill = (skill: string) => {
        const next = new Set(selectedSkills);
        if (next.has(skill)) next.delete(skill);
        else next.add(skill);
        setSelectedSkills(next);
    };

    const handleConfirm = () => {
        const skillsList: OccupationSkill[] = Array.from(selectedSkills).map((s, idx) => {
             const existing = allSkills.find((as: Skill) => as.name.toLowerCase() === s.toLowerCase());
             return {
                 id: existing ? existing.id : -1, 
                 name: s
             };
        });
        onConfirm(skillsList);
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">AI Job Analysis Result</h2>
                <button onClick={onClose} className="text-3xl text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <p className="mb-4 text-gray-600">Extracted skills for <strong>{result.title}</strong>. Uncheck any irrelevant skills before importing.</p>
            <div className="max-h-[60vh] overflow-y-auto space-y-4">
                {result.categories.map((cat: GeminiSkillCategory, i: number) => (
                    <div key={i} className="border-b pb-4">
                        <h4 className="font-semibold text-lg text-gray-800 mb-2">{cat.category}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {cat.skills.map((skill: string) => (
                                <label key={skill} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedSkills.has(skill)} 
                                        onChange={() => toggleSkill(skill)}
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{skill}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
                <button onClick={onClose} className="btn-secondary px-4 py-2 rounded">Cancel</button>
                <button onClick={handleConfirm} className="btn-primary px-4 py-2 rounded">Import {selectedSkills.size} Skills</button>
            </div>
        </Modal>
    );
};

const TalentStrategyModal: React.FC<any> = ({ occupation, people, courses, onClose }) => {
    const avgSalary = 120000;
    const recruitingCost = avgSalary * 0.20;
    const onboardingCost = 15000;
    const buyCost = recruitingCost + onboardingCost;

    const avgCourseCost = 1000;
    const trainingHours = 40;
    const hourlyRate = 60;
    const trainingCost = avgCourseCost + (trainingHours * hourlyRate); 
    const buildCost = trainingCost;

    const savings = buyCost - buildCost;

    return (
        <Modal isOpen={true} onClose={onClose}>
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Talent Strategy: {occupation.title}</h2>
                <button onClick={onClose} className="text-3xl text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                    <h3 className="text-xl font-bold text-green-900 mb-2">Build (Upskill)</h3>
                    <p className="text-green-800 mb-4">Train internal employees.</p>
                    <ul className="space-y-2 text-sm text-green-700 mb-4">
                        <li className="flex justify-between"><span>Training Costs:</span> <span>${avgCourseCost}</span></li>
                        <li className="flex justify-between"><span>Time Investment:</span> <span>${(trainingHours * hourlyRate).toLocaleString()}</span></li>
                        <li className="flex justify-between font-bold border-t border-green-300 pt-2"><span>Total Est. Cost:</span> <span>${buildCost.toLocaleString()}</span></li>
                    </ul>
                    <div className="text-center glass-soft p-2 text-green-800 text-sm">
                        <strong>Pros:</strong> Retains domain knowledge, higher morale.
                    </div>
                </div>
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                     <h3 className="text-xl font-bold text-blue-900 mb-2">Buy (Hire)</h3>
                     <p className="text-blue-800 mb-4">Recruit from market.</p>
                     <ul className="space-y-2 text-sm text-blue-700 mb-4">
                        <li className="flex justify-between"><span>Recruiting Fees:</span> <span>${recruitingCost.toLocaleString()}</span></li>
                        <li className="flex justify-between"><span>Onboarding:</span> <span>${onboardingCost.toLocaleString()}</span></li>
                        <li className="flex justify-between font-bold border-t border-blue-300 pt-2"><span>Total Est. Cost:</span> <span>${buyCost.toLocaleString()}</span></li>
                    </ul>
                    <div className="text-center glass-soft p-2 text-blue-800 text-sm">
                        <strong>Pros:</strong> Immediate proficiency, fresh perspective.
                    </div>
                </div>
            </div>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-lg">
                    Recommendation: <strong className="text-green-600">BUILD</strong>
                </p>
                <p className="text-gray-600">
                    Upskilling an internal candidate could save approximately <strong>${savings.toLocaleString()}</strong> per role compared to external hiring.
                </p>
            </div>
        </Modal>
    );
};

export default App;
