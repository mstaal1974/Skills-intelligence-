
export type ProficiencyLevel = 'Novice' | 'Beginner' | 'Competent' | 'Proficient' | 'Expert';

export interface Skill {
  id: number;
  name: string;
  category: string;
}

export interface RichSkill {
  skillId: number;
  type: string;
  description: string;
  relatedOccupations: string[];
  certifications: string[];
}

export interface OccupationSkill {
  id: number;
  name: string;
}

export interface Occupation {
  id: number;
  title: string;
  description: string;
  skills: OccupationSkill[];
}

export interface PersonSkill {
  id: number;
  level: number; // 1-5 mapping to ProficiencyLevel
  proficiency: ProficiencyLevel;
  verified: boolean;
  lastAssessed?: string; // ISO Date
  assessedBy?: 'Self' | 'Manager' | 'Peer';
}

export interface Person {
  id: number;
  name: string;
  email: string;
  job: string;
  department: string;
  managerId?: number; // For hierarchy
  skills: PersonSkill[];
}

export interface LearningPathSkill {
  skillId: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
  courseId?: number;
  courseName?: string;
  enrolledDate?: string;
  completedDate?: string;
}

export interface LearningPath {
  skills: LearningPathSkill[];
}

export interface LearningPaths {
  [personId: number]: LearningPath;
}

export interface ToastState {
  message: string;
  visible: boolean;
}

export type HeatmapMode = 'jobs' | 'departments';

export type Tab = 'dashboard' | 'people' | 'occupations' | 'projects' | 'development' | 'analysis' | 'reports' | 'manager' | 'audit';

export interface GeminiSkillCategory {
  category: string;
  skills: string[];
}

export interface Course {
  id: number;
  title: string;
  provider: string;
  skillIds: number[];
  url: string;
  cost: number;
}

export interface ProjectSkillRequirement {
  skill: string;
  requiredFTEs: number;
}

export interface ProjectAnalysisResult {
  skill: string;
  requiredFTEs: number;
  availableFTEs: number;
  gap: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string | number;
  details: string;
  changes?: { field: string; oldValue: any; newValue: any }[];
}

export interface BudgetStats {
  department: string;
  allocated: number;
  spent: number;
  committed: number; // In Progress courses
  remaining: number;
}
