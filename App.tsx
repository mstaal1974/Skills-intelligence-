
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Skill, RichSkill, Occupation, Person, LearningPaths, ToastState, Tab, HeatmapMode, GeminiSkillCategory, OccupationSkill, Course, PersonSkill, LearningPathSkill, LearningPath, ProjectSkillRequirement, ProjectAnalysisResult } from './types';
import { getMockData, generateMockPeople } from './services/mockDataService';
import { extractSkillsFromText, generateLearningPlan, analyzeProjectRequirements } from './services/geminiService';
import { getCourses, findCoursesBySkillId, getCourseById } from './services/courseDataService';


// Forward declaration for Chart.js and pdf.js from CDN
declare const Chart: any;
declare const pdfjsLib: any;

// --- Helper Components ---

const Loader: React.FC = () => (
    <div className="loading-overlay">
        <div className="loader"></div>
    </div>
);

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, maxWidth = 'max-w-4xl' }) => {
    if (!isOpen) return null;

    return (
        <div className={`modal-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
            <div className={`modal-content w-full ${maxWidth}`} onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
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
            const personPaths = prevPaths[personId] ? { ...prevPaths[personId] } : { skills: [] };
            if (!personPaths.skills.some(s => s.skillId === skillId)) {
                personPaths.skills.push({ 
                    skillId, 
                    status: 'Not Started',
                    courseId: course.id,
                    courseName: course.title,
                });
                showToast(`Course '${course.title}' assigned to ${personName}.`);
                return { ...prevPaths, [personId]: personPaths };
            } else {
                showToast('A course for this skill is already in the learning path.');
                return prevPaths;
            }
        });
    };
    
    const handlePersonSkillUpdate = (personId: number, skillId: number) => {
        setPeople(prevPeople => {
            return prevPeople.map(p => {
                if(p.id === personId) {
                    const hasSkill = p.skills.some(s => s.id === skillId);
                    if(!hasSkill) {
                        const newSkills: PersonSkill[] = [...p.skills, { id: skillId, level: 1 }]; // Start at level 1
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
    };

    const addNewSkills = (newSkills: Skill[]) => {
        setSkills(prev => {
            const existingSkillNames = new Set(prev.map(s => s.name.toLowerCase()));
            const uniqueNewSkills = newSkills.filter(s => !existingSkillNames.has(s.name.toLowerCase()));
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
                        {activeTab === 'people' && <PeopleSection people={people} skills={skills} occupations={occupations} courses={courses} />}
                        {activeTab === 'occupations' && <OccupationsSection occupations={occupations} skills={skills} onAddOccupation={addNewOccupation} onAddNewSkills={addNewSkills} showToast={showToast} people={people} courses={courses} />}
                        {activeTab === 'projects' && <ProjectsSection people={people} skills={skills} showToast={showToast} setProjectAnalysis={setProjectAnalysis} />}
                        {activeTab === 'development' && <DevelopmentSection learningPaths={learningPaths} people={people} skills={skills} setLearningPaths={setLearningPaths} onSkillUpdate={handlePersonSkillUpdate} />}
                        {activeTab === 'analysis' && <AnalysisSection people={people} occupations={occupations} skills={skills} onAssignCourse={handleAssignCourse} />}
                        {activeTab === 'reports' && <ReportsSection people={people} departments={departments} showToast={showToast} />}
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

// --- Navigation metadata & icons ---
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
    reports: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></>,
};

const TAB_META: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'people', label: 'People' },
    { id: 'occupations', label: 'Occupations' },
    { id: 'projects', label: 'Projects' },
    { id: 'development', label: 'Development' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'reports', label: 'Reports' },
];

// --- Dark mode hook ---
const useDarkMode = (): [boolean, () => void] => {
    const [dark, setDark] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        const stored = window.localStorage.getItem('bsi-theme');
        if (stored) return stored === 'dark';
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    });
    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', dark);
        window.localStorage.setItem('bsi-theme', dark ? 'dark' : 'light');
    }, [dark]);
    return [dark, () => setDark(d => !d)];
};

// --- Sidebar ---
interface SidebarProps {
    activeTab: Tab;
    onSwitchTab: (tab: Tab) => void;
}
const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSwitchTab }) => (
    <aside className="hidden md:flex flex-col items-center gap-2 w-[84px] shrink-0 glass-sidebar sticky top-0 h-screen py-5 px-2 z-40">
        <div className="w-11 h-11 mb-3 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shrink-0"
             style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)', boxShadow: '0 10px 22px -8px rgba(74,144,226,0.8)' }}>
            B
        </div>
        <nav className="flex flex-col gap-1.5 w-full overflow-y-auto">
            {TAB_META.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onSwitchTab(tab.id)}
                    aria-current={activeTab === tab.id}
                    className={`side-link ${activeTab === tab.id ? 'active' : ''}`}
                    title={tab.label}
                >
                    <Icon path={TabIcons[tab.id]} className="w-[22px] h-[22px]" />
                    <span>{tab.label}</span>
                </button>
            ))}
        </nav>
    </aside>
);

// --- Top bar ---
interface TopBarProps {
    activeLabel: string;
    activeTab: Tab;
    onSwitchTab: (tab: Tab) => void;
}
const TopBar: React.FC<TopBarProps> = ({ activeLabel, activeTab, onSwitchTab }) => {
    const [dark, toggleDark] = useDarkMode();
    return (
        <header className="glass-topbar sticky top-0 z-30">
            <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center gap-3 py-3.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shrink-0"
                              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)' }}>B</span>
                        <div className="flex items-baseline gap-2 min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold text-gray-800 truncate">Skills Intelligence</h1>
                            <span className="hidden sm:inline text-gray-400">/</span>
                            <span className="hidden sm:inline text-sm font-semibold text-gray-500 truncate">{activeLabel}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <span className="glass-chip hidden sm:inline-flex">
                            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }}></span>
                            AI Ready
                        </span>
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
                {/* Mobile pill navigation */}
                <nav className="md:hidden flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
                    {TAB_META.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onSwitchTab(tab.id)}
                            className={`pill-link ${activeTab === tab.id ? 'active' : ''}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
        </header>
    );
};

// --- Section Components ---

// --- KPI card ---
interface KpiCardProps {
    label: string;
    value: number | string;
    accent: string;
    icon: React.ReactNode;
}
const KpiCard: React.FC<KpiCardProps> = ({ label, value, accent, icon }) => (
    <div className="kpi-card glass-card p-6 flex items-start justify-between gap-3">
        <div>
            <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wide">{label}</h3>
            <p className="text-3xl font-extrabold mt-2 text-gray-900">{value}</p>
        </div>
        <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${accent}1f`, color: accent }}>
            <Icon path={icon} className="w-5 h-5" />
        </span>
    </div>
);

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

    const getSkillById = (id: number) => skills.find(s => s.id === id);

    const updateHeatmap = useCallback(() => {
        setIsLoadingChart(true);
        if (!chartRef.current || people.length === 0 || skills.length === 0) {
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
        
        if (ctx) {
            chartInstanceRef.current = new Chart(ctx, {
                type: 'matrix',
                data: {
                    datasets: [{
                        label: 'Skill Count',
                        data: chartData,
                        backgroundColor: (c: any) => {
                            const value = c.dataset.data[c.dataIndex]?.v;
                            if (value === undefined) return 'rgba(243, 244, 246, 1)';
                            const alpha = value / maxCount;
                            return `rgba(74, 144, 226, ${alpha * 0.8 + 0.2})`;
                        },
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                        borderWidth: 1,
                        width: ({chart}: any) => (chart.chartArea || {}).width / xLabels.length - 1,
                        height: ({chart}: any) => (chart.chartArea || {}).height / yLabels.length - 1,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { title: () => '', label: (c: any) => { const item = c.dataset.data[c.dataIndex]; return [`Skill: ${item.y}`, `${heatmapMode === 'jobs' ? 'Job' : 'Department'}: ${item.x}`, `Count: ${item.v}`]; } } } },
                    scales: { x: { type: 'category', labels: xLabels, ticks: { autoSkip: false, maxRotation: 90, minRotation: 45 } }, y: { type: 'category', labels: yLabels, offset: true } }
                }
            });
        }
        setIsLoadingChart(false);
    }, [heatmapMode, people, skills]);

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
                        <button onClick={() => onSwitchTab('occupations')} className="w-full text-left p-4 rounded-lg bg-blue-50 hover:bg-blue-100 transition"><h4 className="font-semibold text-blue-800">📄 View Occupations</h4><p className="text-sm text-blue-700">Explore official occupation profiles.</p></button>
                        <button onClick={() => onSwitchTab('analysis')} className="w-full text-left p-4 rounded-lg bg-green-50 hover:bg-green-100 transition"><h4 className="font-semibold text-green-800">🔍 Run a Skill Gap Analysis</h4><p className="text-sm text-green-700">Compare an employee to an occupation.</p></button>
                        <button onClick={() => onSwitchTab('development')} className="w-full text-left p-4 rounded-lg bg-purple-50 hover:bg-purple-100 transition"><h4 className="font-semibold text-purple-800">🎓 View Learning Paths</h4><p className="text-sm text-purple-700">Track employee development plans.</p></button>
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
}
const PeopleSection: React.FC<PeopleSectionProps> = ({ people, skills, occupations, courses }) => {
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
                                                <div className="w-full bg-gray-200 rounded-full h-4 mr-2"><div className="bg-blue-500 h-4 rounded-full" style={{width: `${matchPercentage}%`}}></div></div>
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
            {selectedPerson && <PersonDetailModal person={selectedPerson} onClose={() => setSelectedPerson(null)} skills={skills} occupations={occupations} courses={courses} />}
        </section>
    );
};

interface PersonDetailModalProps {
    person: Person;
    onClose: () => void;
    skills: Skill[];
    occupations: Occupation[];
    courses: Course[];
}
const PersonDetailModal: React.FC<PersonDetailModalProps> = ({ person, onClose, skills, occupations, courses }) => {
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
                <ul className="mt-2 space-y-2">
                    {person.skills.map(s => {
                        const skillInfo = getSkillById(s.id);
                        return skillInfo ? <li key={s.id} className="flex justify-between items-center text-sm"><span>{skillInfo.name}</span><div className="flex items-center"><div className="w-24 bg-gray-200 rounded-full h-2.5 mr-2"><div className="bg-blue-500 h-2.5 rounded-full" style={{width: `${s.level * 20}%`}}></div></div><span className="font-mono text-xs">{s.level}/5</span></div></li> : null;
                    })}
                </ul>
            </div>
            <div className="mt-6 border-t pt-4">
                 <button onClick={() => setIsCareerPathOpen(true)} className="btn-primary font-semibold px-6 py-2 rounded-lg">Plan Career Move</button>
            </div>
            {isCareerPathOpen && <CareerPathModal person={person} occupations={occupations} skills={skills} courses={courses} onClose={() => setIsCareerPathOpen(false)} />}
        </Modal>
    );
}

interface CareerPathModalProps {
    person: Person;
    onClose: () => void;
    occupations: Occupation[];
    skills: Skill[];
    courses: Course[];
}
const CareerPathModal: React.FC<CareerPathModalProps> = ({ person, onClose, occupations, skills, courses }) => {
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
                            <div className="mt-4">
                                <button onClick={handleGeneratePlan} disabled={isGenerating} className="btn-primary font-semibold px-6 py-2 rounded-lg disabled:bg-gray-400">
                                    {isGenerating ? 'Generating...' : 'Generate AI Learning Plan'}
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
                                    <div className="whitespace-pre-wrap text-gray-700 font-sans">{learningPlan}</div>
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
                            <div key={occ.id} className="glass-soft p-4">
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

interface TalentStrategyModalProps {
    occupation: Occupation;
    people: Person[];
    courses: Course[];
    onClose: () => void;
}
const TalentStrategyModal: React.FC<TalentStrategyModalProps> = ({ occupation, people, courses, onClose }) => {
    const [headcount, setHeadcount] = useState<number>(3);

    const candidates = people
        .map(p => {
            const personSkillIds = new Set(p.skills.map(s => s.id));
            const matchingCount = occupation.skills.filter(s => personSkillIds.has(s.id)).length;
            const missingSkills = occupation.skills.filter(s => !personSkillIds.has(s.id));
            return {
                person: p,
                match: occupation.skills.length > 0 ? (matchingCount / occupation.skills.length) * 100 : 100,
                missingSkills
            };
        })
        .sort((a, b) => b.match - a.match)
        .slice(0, headcount);

    const totalMissingSkills = candidates.flatMap(c => c.missingSkills);
    const uniqueMissingSkillIds = [...new Set(totalMissingSkills.map(s => s.id))];
    let totalTrainingCost = 0;
    uniqueMissingSkillIds.forEach(skillId => {
        const course = courses.find(c => c.skillIds.includes(skillId));
        if (course) {
            totalTrainingCost += course.cost;
        }
    });

    const estimatedHiringCost = 50000; // Benchmark cost

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-3xl">
             <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Build vs. Buy Analysis: {occupation.title}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            <div className="mb-4">
                <label htmlFor="headcount" className="block text-sm font-medium text-gray-700">Number of people needed:</label>
                {/* FIX: Ensure parseInt has a radix and handles NaN for empty inputs. */}
                <input type="number" id="headcount" value={headcount} onChange={e => setHeadcount(parseInt(e.target.value, 10) || 0)} min="1" className="mt-1 block w-24 border-gray-300 rounded-md shadow-sm p-2" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-lg text-blue-800">BUILD: Upskill Internally</h3>
                    <p className="text-sm text-blue-700 mt-2">Estimated Training Cost for {headcount} people:</p>
                    <p className="text-3xl font-bold text-blue-900">${(totalTrainingCost * headcount).toLocaleString()}</p>
                    <p className="text-xs text-blue-600">(Based on top recommended courses)</p>
                    <h4 className="font-semibold text-md mt-4 mb-2">Top Internal Candidates:</h4>
                    <ul className="space-y-2 text-sm">
                        {candidates.map(c => (
                            <li key={c.person.id}><strong>{c.person.name}</strong> ({c.person.job}) - {Math.round(c.match)}% Match</li>
                        ))}
                    </ul>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                    <h3 className="font-semibold text-lg text-green-800">BUY: Hire Externally</h3>
                    <p className="text-sm text-green-700 mt-2">Estimated Hiring Cost for {headcount} people:</p>
                    <p className="text-3xl font-bold text-green-900">${(estimatedHiringCost * headcount).toLocaleString()}</p>
                     <p className="text-xs text-green-600">(Based on industry benchmark recruitment fees)</p>
                     <p className="text-sm mt-4 text-green-700">Hiring externally provides immediate access to required skills but incurs higher initial costs and potential cultural integration challenges.</p>
                </div>
            </div>
        </Modal>
    );
}

interface GeminiAnalysisModalProps {
    result: { title: string, categories: GeminiSkillCategory[] };
    onClose: () => void;
    onConfirm: (selectedSkills: OccupationSkill[]) => void;
    allSkills: Skill[];
}

const GeminiAnalysisModal: React.FC<GeminiAnalysisModalProps> = ({ result, onClose, onConfirm, allSkills }) => {
    const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set(result.categories.flatMap(c => c.skills)));

    const handleToggleSkill = (skillName: string) => {
        setSelectedSkills(prev => {
            const newSet = new Set(prev);
            if (newSet.has(skillName)) {
                newSet.delete(skillName);
            } else {
                newSet.add(skillName);
            }
            return newSet;
        });
    };
    
    const handleConfirm = () => {
        const skillsWithIds: OccupationSkill[] = [...selectedSkills].map(name => {
            const existingSkill = allSkills.find(s => s.name.toLowerCase() === name.toLowerCase());
            return existingSkill ? { id: existingSkill.id, name: existingSkill.name } : { id: -1, name };
        });
        onConfirm(skillsWithIds);
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-4xl">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Gemini Analysis Results</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            <p className="mb-4 text-gray-600">Skills extracted for: <strong>{result.title}</strong>. Select the skills to add to this new role.</p>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {result.categories.map((cat, index) => (
                    <div key={index} className="glass-soft p-4">
                        <h3 className="text-lg font-semibold text-blue-800 mb-2">{cat.category}</h3>
                        <ul className="space-y-1">
                            {cat.skills.map(skill => (
                                <li key={skill} className="flex items-center">
                                    <input type="checkbox" checked={selectedSkills.has(skill)} onChange={() => handleToggleSkill(skill)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-3" />
                                    <span>{skill}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div className="mt-6 text-right">
                <button onClick={handleConfirm} className="btn-primary font-semibold px-6 py-2 rounded-lg">Add Selected Skills to Role</button>
            </div>
        </Modal>
    );
};

interface ProjectsSectionProps {
    people: Person[];
    skills: Skill[];
    showToast: (message: string) => void;
    setProjectAnalysis: (result: ProjectAnalysisResult[] | null) => void;
}
const ProjectsSection: React.FC<ProjectsSectionProps> = ({ people, skills, showToast, setProjectAnalysis }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');

    const extractTextFromPdf = async (file: File): Promise<string> => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = async () => {
                try {
                    const typedarray = new Uint8Array(fileReader.result as ArrayBuffer);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let fullText = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map((item: any) => item.str).join(' ');
                    }
                    resolve(fullText);
                } catch (error) { reject(error); }
            };
            fileReader.onerror = reject;
            fileReader.readAsArrayBuffer(file);
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setIsUploading(true);
            setUploadStatus(`Analyzing project brief: ${file.name}...`);
            try {
                const text = await extractTextFromPdf(file);
                setUploadStatus('Identifying skill requirements with Gemini...');
                const requirements = await analyzeProjectRequirements(text);
                
                if (requirements.length === 0) {
                    showToast('AI could not identify any skill requirements from the document.');
                    setIsUploading(false);
                    return;
                }
                
                setUploadStatus('Calculating current capacity...');

                const skillMap = new Map(skills.map(s => [s.name.toLowerCase(), s.id]));
                const peopleWithSkills = new Map<number, number>();
                people.forEach(p => {
                    p.skills.forEach(s => {
                        peopleWithSkills.set(s.id, (peopleWithSkills.get(s.id) || 0) + 1);
                    });
                });
                
                const analysis: ProjectAnalysisResult[] = requirements.map(req => {
                    const skillId = skillMap.get(req.skill.toLowerCase());
                    const availableFTEs = skillId ? (peopleWithSkills.get(skillId) || 0) : 0;
                    return {
                        skill: req.skill,
                        requiredFTEs: req.requiredFTEs,
                        availableFTEs,
                        gap: availableFTEs - req.requiredFTEs
                    };
                });

                setProjectAnalysis(analysis);

            } catch (error) {
                showToast('Failed to analyze project brief.');
                console.error(error);
            } finally {
                setIsUploading(false);
                setUploadStatus('');
            }
        }
    };

    return (
        <section>
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Project Resource Planning</h2>
                <p className="mt-1 text-gray-600">Upload a project brief to let AI analyze its skill requirements, measure them against your current workforce, and identify hiring gaps.</p>
            </div>
            <div className="glass-card p-6">
                <h3 className="text-xl font-semibold mb-4">Analyze New Project</h3>
                {!isUploading ? (
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-10 text-center">
                        <span className="text-6xl">🚀</span>
                        <p className="mt-4 text-gray-600">Upload a project scope, statement of work, or brief (PDF).</p>
                        <input type="file" id="project-pdf-upload" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                        <label htmlFor="project-pdf-upload" className="mt-6 cursor-pointer btn-primary px-6 py-3 rounded-lg font-semibold text-base">Browse Files</label>
                    </div>
                ) : (
                    <div className="text-center p-10">
                        <div className="flex justify-center mb-4">
                           <div className="loader"></div>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{uploadStatus}</p>
                    </div>
                )}
            </div>
        </section>
    );
};


interface ProjectAnalysisResultModalProps {
  result: ProjectAnalysisResult[];
  onClose: () => void;
}
const ProjectAnalysisResultModal: React.FC<ProjectAnalysisResultModalProps> = ({ result, onClose }) => {
    const hiringNeeded = result.filter(r => r.gap < 0);

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-3xl">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Project Resource Analysis</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            <p className="mb-4 text-gray-600">AI has analyzed the project brief and compared its requirements against your current team's capacity.</p>
            
            <div className="overflow-x-auto max-h-[50vh]">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skill</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required FTEs</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available FTEs</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gap / Surplus</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {result.map(res => (
                            <tr key={res.skill}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{res.skill}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{res.requiredFTEs.toFixed(1)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{res.availableFTEs}</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${res.gap < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {res.gap > 0 ? `+${res.gap.toFixed(1)}` : res.gap.toFixed(1)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold text-lg">Hiring Recommendation</h3>
                {hiringNeeded.length > 0 ? (
                    <>
                        <p className="text-sm text-gray-600 mt-2">To successfully staff this project, you have a resource shortfall in the following areas:</p>
                        <ul className="list-disc list-inside mt-2 text-red-700">
                            {hiringNeeded.map(res => (
                                <li key={res.skill}>
                                    <strong>{res.skill}:</strong> {-res.gap.toFixed(1)} FTEs needed.
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <p className="mt-2 p-4 bg-green-100 text-green-800 rounded-lg font-semibold">Great news! You have enough internal capacity to staff this project without new hires.</p>
                )}
            </div>
        </Modal>
    );
};

interface AnalysisSectionProps {
    people: Person[];
    occupations: Occupation[];
    skills: Skill[];
    onAssignCourse: (personId: number, personName: string, skillId: number, course: Course) => void;
}

const AnalysisSection: React.FC<AnalysisSectionProps> = ({ people, occupations, skills, onAssignCourse }) => {
    const [selectedPersonId, setSelectedPersonId] = useState<string>('');
    const [selectedOccupationId, setSelectedOccupationId] = useState<string>('');
    const [analysisResult, setAnalysisResult] = useState<{ matchingSkills: number[], gapSkills: number[], person: Person, occupation: Occupation } | null>(null);
    const [learningPlan, setLearningPlan] = useState<string | null>(null);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
    const [courseFinderState, setCourseFinderState] = useState<{open: boolean, skillId: number | null}>({open: false, skillId: null});

    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<any>(null);

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
            const ctx = chartRef.current.getContext('2d');
            if (chartInstanceRef.current) chartInstanceRef.current.destroy();
            if (ctx) {
                chartInstanceRef.current = new Chart(ctx, {
                    type: 'doughnut',
                    data: { labels: ['Matching Skills', 'Skill Gaps'], datasets: [{ data: [analysisResult.matchingSkills.length, analysisResult.gapSkills.length], backgroundColor: ['#22c55e', '#ef4444'], borderColor: '#ffffff', borderWidth: 2 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }
                });
            }
        }
    }, [analysisResult]);

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
                            <div className="p-4 bg-red-50 rounded-lg"><h4 className="font-semibold text-lg text-red-800 mb-2">Skill Gaps</h4><ul className="space-y-2 text-sm text-red-700">{analysisResult.gapSkills.length > 0 ? analysisResult.gapSkills.map(id => {const skill = getSkillById(id); return skill ? (<li key={id} className="flex justify-between items-center"><span>{skill.name}</span><button onClick={() => setCourseFinderState({open: true, skillId: skill.id})} className="text-purple-600 hover:underline text-xs font-semibold">Find a Course</button></li>) : null;}) : <li>No skill gaps! Perfect fit.</li>}</ul></div>
                        </div>

                        {analysisResult.gapSkills.length > 0 && (<div className="mt-6 border-t pt-6"><button onClick={handleGeneratePlan} disabled={isGeneratingPlan} className="btn-primary font-semibold px-6 py-2 rounded-lg disabled:bg-gray-400">{isGeneratingPlan ? 'Generating Plan...' : 'Generate AI Learning Plan'}</button>{isGeneratingPlan && (<div className="mt-4 flex justify-center"><div className="loader" style={{borderTopColor: '#4A90E2', height: '30px', width: '30px'}}></div></div>)}{learningPlan && (<div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"><h4 className="font-semibold text-lg text-blue-800 mb-2">Personalized Learning Plan</h4><div className="whitespace-pre-wrap text-gray-700 font-sans">{learningPlan}</div></div>)}</div>)}
                    </div>
                )}
            </div>
             {courseFinderState.open && courseFinderState.skillId && analysisResult && <CourseFinderModal skill={getSkillById(courseFinderState.skillId)!} person={analysisResult.person} onClose={() => setCourseFinderState({open: false, skillId: null})} onAssignCourse={onAssignCourse} />}
        </section>
    );
};

interface CourseFinderModalProps {
    skill: Skill;
    person: Person;
    onClose: () => void;
    onAssignCourse: (personId: number, personName: string, skillId: number, course: Course) => void;
}
const CourseFinderModal: React.FC<CourseFinderModalProps> = ({ skill, person, onClose, onAssignCourse }) => {
    const relevantCourses = findCoursesBySkillId(skill.id);
    
    const handleAssign = (course: Course) => {
        onAssignCourse(person.id, person.name, skill.id, course);
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-2xl">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Find a Course</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            <p className="mb-4 text-gray-600">Top courses from the marketplace for the skill: <strong>{skill.name}</strong></p>
            <div className="space-y-3">
                {relevantCourses.length > 0 ? relevantCourses.map(course => (
                    <div key={course.id} className="glass-soft p-4 flex justify-between items-center">
                        <div>
                            <a href={course.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 hover:underline">{course.title}</a>
                            <p className="text-sm text-gray-500">{course.provider} - ${course.cost}</p>
                        </div>
                        <button onClick={() => handleAssign(course)} className="btn-primary font-semibold px-4 py-2 rounded-lg text-sm">Assign</button>
                    </div>
                )) : (
                    <p className="text-gray-500">No courses found for this skill in the marketplace.</p>
                )}
            </div>
        </Modal>
    );
}

interface DevelopmentSectionProps {
    learningPaths: LearningPaths;
    people: Person[];
    skills: Skill[];
    setLearningPaths: React.Dispatch<React.SetStateAction<LearningPaths>>;
    onSkillUpdate: (personId: number, skillId: number) => void;
}
const DevelopmentSection: React.FC<DevelopmentSectionProps> = ({ learningPaths, people, skills, setLearningPaths, onSkillUpdate }) => {
    
    const handleStatusChange = (personId: number, skillId: number, status: LearningPathSkill['status']) => {
        setLearningPaths(prev => {
            const personPath = prev[personId];
            if (!personPath) return prev;

            const skillIndex = personPath.skills.findIndex(s => s.skillId === skillId);
            if (skillIndex === -1) return prev;
            
            // Create a new array for the skills to ensure immutability
            const updatedSkills = [...personPath.skills];
            const originalSkill = updatedSkills[skillIndex];
            
            // Only update if the status is different to avoid unnecessary re-renders
            if (originalSkill.status === status) return prev;
            
            // Create a new skill object for the update
            updatedSkills[skillIndex] = { ...originalSkill, status };

            if (status === 'Completed') {
                onSkillUpdate(personId, skillId);
            }
            
            // Return a new state object
            return {
                ...prev,
                [personId]: {
                    ...personPath,
                    skills: updatedSkills
                }
            };
        });
    };
    
    const getSkillName = (id: number) => skills.find(s => s.id === id)?.name || 'Unknown Skill';

    return (
        <section>
            <div className="mb-6"><h2 className="text-3xl font-bold text-gray-900">Learning & Development</h2><p className="mt-1 text-gray-600">Track employee development plans and assigned microcredentials. Completed courses automatically update employee skill profiles.</p></div>
            <div className="glass-card p-6">
                {Object.keys(learningPaths).length > 0 ? (
                    <div className="space-y-6">
                        {Object.keys(learningPaths).map(personIdStr => {
                            const personId = parseInt(personIdStr, 10);
                            const person = people.find(p => p.id === personId);
                            const path = learningPaths[personId];

                            if (!person || !path) return null;

                            return (
                                <div key={personId}>
                                    <h3 className="font-semibold text-xl">{person.name}'s Learning Path</h3>
                                    <ul className="mt-2 space-y-2">
                                        {path.skills.map(s => (
                                            <li key={s.skillId} className="glass-soft p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                                <div>
                                                    <p className="font-semibold">{getSkillName(s.skillId)}</p>
                                                    <a href="#" className="text-sm text-blue-600 hover:underline">{s.courseName || 'Course details not available'}</a>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.status === 'Completed' ? 'bg-green-100 text-green-800' : s.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{s.status}</span>
                                                    {s.status !== 'Completed' && <button onClick={() => handleStatusChange(person.id, s.skillId, 'Completed')} className="text-xs btn-secondary px-2 py-1 rounded-md">Mark Complete</button>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10"><p className="text-gray-500">No active learning paths. Assign them from the Skills Gap Analysis tool.</p></div>
                )}
            </div>
        </section>
    );
};

interface ReportsSectionProps {
    people: Person[];
    departments: string[];
    showToast: (message: string) => void;
}
const ReportsSection: React.FC<ReportsSectionProps> = ({ people, departments, showToast }) => {
     const [exportType, setExportType] = useState('Individual Employee');
     const [selection, setSelection] = useState('');
     
     useEffect(() => {
        if (exportType === 'Individual Employee') setSelection(people[0]?.id.toString() || '');
        else if (exportType === 'Team / Department') setSelection(departments[0] || '');
        else setSelection('company');
     }, [exportType, people, departments]);
     
     const getOptions = () => {
         if (exportType === 'Individual Employee') return people.map(p => <option key={p.id} value={p.id}>{p.name}</option>);
         if (exportType === 'Team / Department') return departments.map(d => <option key={d} value={d}>{d}</option>);
         return <option value="company">Company Wide</option>;
     };
     
    return (
        <section>
             <div className="mb-6"><h2 className="text-3xl font-bold text-gray-900">Reports & Exports</h2><p className="mt-1 text-gray-600">Generate and export skills data for compliance, reporting, or integration with other systems in 1EdTech LER format.</p></div>
            <div className="glass-card p-6">
                 <h3 className="text-xl font-semibold mb-4">Export Skills & Competency Map</h3>
                 <div className="space-y-4 max-w-lg">
                    <div>
                        <label htmlFor="export-type" className="block text-sm font-medium text-gray-700">Export Type</label>
                        <select id="export-type" value={exportType} onChange={e => setExportType(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                            <option>Individual Employee</option><option>Team / Department</option><option>Entire Company</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="export-selection" className="block text-sm font-medium text-gray-700">Selection</label>
                        <select id="export-selection" value={selection} onChange={e => setSelection(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">{getOptions()}</select>
                    </div>
                    <div><button onClick={() => showToast('Exporting data in 1EdTech LER format...')} className="btn-primary font-semibold px-6 py-2 rounded-lg">Export as 1EdTech LER</button></div>
                 </div>
            </div>
        </section>
    );
};

export default App;