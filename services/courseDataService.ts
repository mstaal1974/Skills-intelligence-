import { Course } from '../types';

const mockCourses: Course[] = [
    { id: 101, title: 'Python for Data Science Bootcamp', provider: 'DataCamp', skillIds: [2, 3], url: 'https://app.microcredentials.io/course/python-ds', cost: 1200 },
    { id: 102, title: 'Applied Machine Learning', provider: 'Coursera', skillIds: [9], url: 'https://app.microcredentials.io/course/applied-ml', cost: 1500 },
    { id: 103, title: 'Advanced SQL for Data Analysts', provider: 'Udemy', skillIds: [8], url: 'https://app.microcredentials.io/course/advanced-sql', cost: 950 },
    { id: 104, title: 'JavaScript for Web Developers', provider: 'edX', skillIds: [1], url: 'https://app.microcredentials.io/course/js-web-dev', cost: 1100 },
    { id: 105, title: 'Agile Project Management Fundamentals', provider: 'LinkedIn Learning', skillIds: [4, 11], url: 'https://app.microcredentials.io/course/agile-pm', cost: 800 },
    { id: 106, title: 'Leadership and Communication Masterclass', provider: 'Skillsoft', skillIds: [5, 6], url: 'https://app.microcredentials.io/course/leadership-comm', cost: 1300 },
    { id: 107, title: 'Introduction to Cloud: AWS', provider: 'A Cloud Guru', skillIds: [10], url: 'https://app.microcredentials.io/course/intro-aws', cost: 1800 },
    { id: 108, title: 'UI/UX Design Principles', provider: 'Pluralsight', skillIds: [7], url: 'https://app.microcredentials.io/course/ui-ux-principles', cost: 1000 },
    { id: 109, title: 'Beginner Python Programming', provider: 'DataCamp', skillIds: [2], url: 'https://app.microcredentials.io/course/beginner-python', cost: 850 },
    { id: 110, title: 'SQL for Beginners', provider: 'Udemy', skillIds: [8], url: 'https://app.microcredentials.io/course/sql-beginners', cost: 700 },
];

export const getCourses = (): Course[] => {
    return mockCourses;
};

export const findCoursesBySkillId = (skillId: number): Course[] => {
    return mockCourses.filter(course => course.skillIds.includes(skillId));
};

export const getCourseById = (courseId: number): Course | undefined => {
    return mockCourses.find(c => c.id === courseId);
}
