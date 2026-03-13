import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";

const getApiKey = () => {
  // Try to get from window (injected by server) or from the baked-in process.env
  const key = (window as any).process?.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  return key === 'undefined' ? undefined : key;
};

export const getAI = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
};

export interface Message {
  role: 'user' | 'model';
  content: string;
}

export interface TaskAnalysis {
  summary: string;
  keyTerms: string[];
}

export const analyzeTask = async (taskText: string, fileData?: { data: string; mimeType: string }): Promise<TaskAnalysis> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: `Analyze the following task or assessment criteria. 
          1. Identify the key knowledge and understanding the student needs to demonstrate. Summarize the expectations clearly.
          2. Extract 5-10 essential key terms or concepts that the student should use in their explanation.
          
          Task Content:
          ${taskText}` },
          ...(fileData ? [{ inlineData: fileData }] : [])
        ]
      }
    ],
    config: {
      systemInstruction: "You are an expert educational analyst. Your goal is to extract learning objectives, assessment criteria, and key vocabulary from provided documents or text.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          keyTerms: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["summary", "keyTerms"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse task analysis JSON:", e);
    return {
      summary: response.text,
      keyTerms: []
    };
  }
};

export const generateFeedback = async (messages: Message[], taskSummary: string) => {
  const ai = getAI();
  const transcript = messages.map(m => `${m.role === 'model' ? 'Mentor' : 'Student'}: ${m.content}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: `Based on the following Socratic dialogue and the initial task expectations, provide a supportive feedback summary for the student. 
          Highlight the specific knowledge and understanding they demonstrated. 
          Be encouraging and specific about what they proved they know.
          
          Task Expectations:
          ${taskSummary}
          
          Dialogue Transcript:
          ${transcript}` }
        ]
      }
    ],
    config: {
      systemInstruction: "You are an encouraging educational mentor. Your goal is to summarize a student's demonstrated knowledge after a learning session."
    }
  });

  return response.text;
};

export const SYSTEM_INSTRUCTION = `You are a Socratic Mentor. Your goal is to help students demonstrate their understanding of a specific topic based on provided assessment criteria.

RULES:
1. DO NOT provide answers.
2. Ask one question at a time.
3. Start with low-level (recall/comprehension) questions and gradually move to high-level (analysis/evaluation/creation) questions.
4. Use a supportive, encouraging tone.
5. If a student is struggling, provide a scaffolded hint or a simpler related question, but still do not give the answer.
6. Your goal is to draw out their knowledge so they can prove they meet the assessment criteria.
7. Keep responses concise.

Context: You will be provided with the "Task Expectations" which you should use to guide your questioning strategy.`;
