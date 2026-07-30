import { GoogleGenAI, Type } from '@google/genai';
import { GeminiSkillCategory, ProjectSkillRequirement } from '../types';

// Lazily initialize the AI client to ensure process.env is available when called
const getAi = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
};

export const extractSkillsFromText = async (text: string): Promise<GeminiSkillCategory[]> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following job description text and extract the key skills required. Group the skills into relevant categories like "Technical Skills", "Soft Skills", "Management Skills", etc. Only return the JSON object. Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: 'The category of the skills (e.g., "Technical", "Soft Skills").',
              },
              skills: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: 'A list of skills within this category.',
              },
            },
            required: ["category", "skills"],
          },
        },
      },
    });
    
    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);

    // Basic validation to ensure it matches the expected structure
    if (Array.isArray(parsedJson) && parsedJson.every(item => 'category' in item && 'skills' in item)) {
        return parsedJson as GeminiSkillCategory[];
    } else {
        console.error("Parsed JSON does not match GeminiSkillCategory[] structure:", parsedJson);
        return [];
    }

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return [];
  }
};

export const generateLearningPlan = async (
  personName: string,
  currentRole: string,
  targetRole: string,
  skillGaps: string[]
): Promise<string> => {
  const prompt = `You are a professional development coach. An employee named ${personName}, who is currently a '${currentRole}', wants to become a '${targetRole}'. Her skill gaps are: ${skillGaps.join(', ')}. Please generate a concise, 3-step learning plan for her, suggesting a logical order and types of courses she should take. Keep the tone encouraging and professional. Structure the response with clear headings for each step.`;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API for learning plan:", error);
    return "Sorry, I was unable to generate a learning plan at this time. Please try again later.";
  }
};

export const analyzeProjectRequirements = async (text: string): Promise<ProjectSkillRequirement[]> => {
  const prompt = `Analyze the following project brief. Identify all the technical and soft skills required to complete the project. For each skill, estimate the number of Full-Time Equivalents (FTEs) needed as a number. An FTE represents one person working full-time on that skill for the project's duration. Return the result as a JSON array of objects, each with 'skill' and 'requiredFTEs' properties.

Project Brief:
${text}`;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              skill: {
                type: Type.STRING,
                description: 'The name of the skill required for the project.',
              },
              requiredFTEs: {
                type: Type.NUMBER,
                description: 'The estimated number of Full-Time Equivalents (FTEs) needed for this skill.',
              },
            },
            required: ["skill", "requiredFTEs"],
          },
        },
      },
    });

    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);

    // Basic validation
    if (Array.isArray(parsedJson) && parsedJson.every(item => 'skill' in item && typeof item.requiredFTEs === 'number')) {
      return parsedJson as ProjectSkillRequirement[];
    } else {
      console.error("Parsed JSON does not match ProjectSkillRequirement[] structure:", parsedJson);
      return [];
    }

  } catch (error) {
    console.error("Error calling Gemini API for project analysis:", error);
    return [];
  }
};