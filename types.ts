
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
  level: number;
}

export interface Person {
  id: number;
  name: string;
  email: string;
  job: string;
  department: string;
  skills: PersonSkill[];
}

export interface LearningPathSkill {
  skillId: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
  courseId?: number;
  courseName?: string;
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

export type Tab = 'dashboard' | 'people' | 'occupations' | 'projects' | 'development' | 'analysis' | 'reports';

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
