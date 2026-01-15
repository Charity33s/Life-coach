
export interface Habit {
  id: string;
  name: string;
  category: 'health' | 'productivity' | 'mindfulness' | 'social';
  streak: number;
  completedToday: boolean;
  frequency: 'daily' | 'weekly';
}

export interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  timeEstimate?: string;
}

export interface DailyLog {
  date: string;
  mood: number; // 1-5
  energy: number; // 1-5
  notes: string;
  habitsCompleted: string[]; // Habit IDs
}

export interface Insight {
  title: string;
  content: string;
  actionable: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface SessionRecord {
  id: string;
  type: 'live' | 'chat';
  title: string;
  timestamp: number;
  messages: { role: string; text: string }[];
}
