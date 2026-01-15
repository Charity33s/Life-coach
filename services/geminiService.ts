
import { GoogleGenAI, Type } from "@google/genai";
import { Habit, Task, DailyLog } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateLifeInsights = async (
  habits: Habit[],
  tasks: Task[],
  logs: DailyLog[]
) => {
  const model = 'gemini-3-flash-preview';
  
  const context = `
    User's Habits: ${JSON.stringify(habits)}
    Today's Tasks: ${JSON.stringify(tasks)}
    Past Logs (Mood/Energy): ${JSON.stringify(logs.slice(-7))}
  `;

  const prompt = `Analyze the user's current daily routine and life functioning. 
  Provide empathetic, professional life-coaching insights. 
  Focus on:
  1. Identifying correlations between habits and mood/energy levels.
  2. Suggesting specific routine adjustments for better efficiency.
  3. Encouraging the user on their strengths.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: context + prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            actionable: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
          },
          required: ["title", "content", "actionable"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return {
      title: "Keep going!",
      content: "I'm having trouble analyzing the data right now, but consistency is key to growth.",
      actionable: ["Keep tracking your habits", "Take a 5-minute breather"]
    };
  }
};

export const chatWithLifeCoach = async (
  message: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[]
) => {
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: "You are Lumina, a world-class life coach and productivity expert. You are empathetic, insightful, and practical. Your goal is to help users function better by optimizing their routines, mindset, and physical health. Use clear, encouraging language."
    }
  });

  // Note: Standard chat uses internal state, but for this demo we'll use history to keep it fresh
  // Note: `chat.sendMessage` is preferred.
  const response = await chat.sendMessage({ message });
  return response.text;
};
