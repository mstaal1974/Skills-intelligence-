
import { Skill, RichSkill, Occupation, Person, ProficiencyLevel } from '../types';

export const getMockData = (): { skills: Skill[], richSkills: RichSkill[], occupationsData: any[] } => {
    const skills: Skill[] = [
        { id: 1, name: 'JavaScript', category: 'Technical' },
        { id: 2, name: 'Python', category: 'Technical' },
        { id: 3, name: 'Data Analysis', category: 'Analytical' },
        { id: 4, name: 'Project Management', category: 'Management' },
        { id: 5, name: 'Communication', category: 'Soft Skills' },
        { id: 6, name: 'Team Leadership', category: 'Management' },
        { id: 7, name: 'UI/UX Design', category: 'Technical' },
        { id: 8, name: 'SQL', category: 'Technical' },
        { id: 9, name: 'Machine Learning', category: 'Technical' },
        { id: 10, name: 'Cloud Computing (AWS)', category: 'Technical'},
        { id: 11, name: 'Agile Methodologies', category: 'Management' },
        { id: 12, name: 'Problem Solving', category: 'Soft Skills' }
    ];

    const richSkills: RichSkill[] = [
        { skillId: 1, type: 'Skill/Knowledge', description: 'JavaScript is a scripting or programming language that allows you to implement complex features on web pages... an interpreted, just-in-time compiled, and high-level language with first-class functions.', relatedOccupations: ['Web Developer', 'Software Engineer'], certifications: ['Certified JavaScript Developer', 'AWS Certified Developer'] },
        { skillId: 2, type: 'Skill/Knowledge', description: 'Python is an interpreted, high-level and general-purpose programming language. Python\'s design philosophy emphasizes code readability with its notable use of significant indentation.', relatedOccupations: ['Data Scientist', 'Software Engineer'], certifications: ['PCEP', 'PCAP'] },
        { skillId: 4, type: 'Competency', description: 'Project management is the process of leading the work of a team to achieve all project goals within the given constraints. This information is usually described in project documentation, created at the beginning of the development process.', relatedOccupations: ['Project Manager', 'Product Owner'], certifications: ['PMP', 'PRINCE2'] },
    ];

    const occupationsData = [
        { id: 1, title: 'Senior Developer', description: 'Responsible for creating user-facing features.', skills: ['JavaScript', 'UI/UX Design', 'Agile Methodologies', 'Problem Solving', 'Communication'] },
        { id: 2, title: 'Data Scientist', description: 'Leads data science projects and initiatives.', skills: ['Python', 'Data Analysis', 'Machine Learning', 'SQL', 'Team Leadership', 'Communication'] },
        { id: 3, title: 'Project Manager', description: 'Manages technical projects from conception to completion.', skills: ['Project Management', 'Team Leadership', 'Agile Methodologies', 'Communication', 'Problem Solving'] },
    ];

    return { skills, richSkills, occupationsData };
};

const getProficiency = (level: number): ProficiencyLevel => {
    switch(level) {
        case 1: return 'Novice';
        case 2: return 'Beginner';
        case 3: return 'Competent';
        case 4: return 'Proficient';
        case 5: return 'Expert';
        default: return 'Novice';
    }
};

const getRandomDate = (daysBack: number) => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
    return date.toISOString().split('T')[0];
};

export const generateMockPeople = (skills: Skill[], departments: string[]): Person[] => {
    const mockJobs = ["Senior Developer", "Data Scientist", "Project Manager", "UI/UX Designer", "Junior Developer", "Product Owner", "DevOps Engineer", "QA Tester"];
    const mockNames = [ "Alice Johnson", "Bob Williams", "Charlie Brown", "Diana Prince", "Ethan Hunt", "Fiona Glenanne", "George Costanza", "Helen Troy" ];
    
    return mockNames.map((name, index) => {
        const personSkills = [];
        const numSkills = Math.floor(Math.random() * 5) + 3;
        
        for (let i = 0; i < numSkills; i++) {
            const randomSkill = skills[Math.floor(Math.random() * skills.length)];
            if (randomSkill && !personSkills.some(s => s.id === randomSkill.id)) {
                 const level = Math.floor(Math.random() * 5) + 1;
                 // 70% chance of being verified
                 const verified = Math.random() > 0.3;
                 
                 personSkills.push({ 
                     id: randomSkill.id, 
                     level: level,
                     proficiency: getProficiency(level),
                     verified: verified,
                     lastAssessed: getRandomDate(90),
                     assessedBy: verified ? 'Manager' : 'Self' as 'Manager' | 'Self'
                 });
            }
        }
        
        // Assign a random manager from the top half of the list (simulating hierarchy)
        // Ensure they don't manage themselves
        let managerId = undefined;
        if (index > 2) {
            managerId = (Math.floor(Math.random() * 3) + 1);
        }

        return {
            id: index + 1,
            name: name,
            email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
            job: mockJobs[index % mockJobs.length],
            department: departments[index % departments.length],
            managerId: managerId,
            skills: personSkills
        };
    });
};
