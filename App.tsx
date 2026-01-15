
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Habit, Task, DailyLog, Insight, SessionRecord, ChatMessage } from './types';
import HabitCard from './components/HabitCard';
import LiveSession from './components/LiveSession';
import { generateLifeInsights, chatWithLifeCoach } from './services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const App: React.FC = () => {
  // State management
  const [habits, setHabits] = useState<Habit[]>([
    { id: '1', name: 'Morning Meditation', category: 'mindfulness', streak: 5, completedToday: false, frequency: 'daily' },
    { id: '2', name: 'Drink 2L Water', category: 'health', streak: 12, completedToday: true, frequency: 'daily' },
    { id: '3', name: 'Deep Work Session', category: 'productivity', streak: 3, completedToday: false, frequency: 'daily' },
    { id: '4', name: 'Evening Walk', category: 'health', streak: 0, completedToday: false, frequency: 'daily' },
  ]);

  const [tasks, setTasks] = useState<Task[]>([
    { id: 't1', title: 'Prepare presentation for Monday', priority: 'high', completed: false },
    { id: 't2', title: 'Email tax accountant', priority: 'medium', completed: true },
    { id: 't3', title: 'Book dentist appointment', priority: 'low', completed: false },
  ]);

  const [logs, setLogs] = useState<DailyLog[]>([
    { date: '2023-10-20', mood: 4, energy: 3, notes: 'Good day', habitsCompleted: ['1', '2'] },
    { date: '2023-10-21', mood: 3, energy: 4, notes: 'Productive but tired', habitsCompleted: ['2', '3'] },
    { date: '2023-10-22', mood: 5, energy: 5, notes: 'Amazing flow!', habitsCompleted: ['1', '2', '3'] },
  ]);

  const [insight, setInsight] = useState<Insight | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'coach' | 'live' | 'stats'>('dashboard');
  
  // Persistence state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('lumina_chat');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [savedSessions, setSavedSessions] = useState<SessionRecord[]>(() => {
    const saved = localStorage.getItem('lumina_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedHistorySession, setSelectedHistorySession] = useState<SessionRecord | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('lumina_chat', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('lumina_sessions', JSON.stringify(savedSessions));
  }, [savedSessions]);

  // Load Initial Insights
  useEffect(() => {
    const fetchInsights = async () => {
      setIsInsightLoading(true);
      const data = await generateLifeInsights(habits, tasks, logs);
      setInsight(data);
      setIsInsightLoading(false);
    };
    fetchInsights();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const toggleHabit = (id: string) => {
    setHabits(prev => prev.map(h => 
      h.id === id ? { ...h, completedToday: !h.completedToday, streak: !h.completedToday ? h.streak + 1 : Math.max(0, h.streak - 1) } : h
    ));
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
    setChatInput('');
    setChatMessages(prev => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const responseText = await chatWithLifeCoach(userMsg.text, []);
      const modelMsg: ChatMessage = { role: 'model', text: responseText || "I'm listening.", timestamp: Date.now() };
      setChatMessages(prev => [...prev, modelMsg]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Hiccup! Let's try again.", timestamp: Date.now() }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSaveLiveSession = (messages: { role: string; text: string }[]) => {
    const newSession: SessionRecord = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'live',
      title: `Live Session - ${new Date().toLocaleDateString()}`,
      timestamp: Date.now(),
      messages: messages
    };
    setSavedSessions(prev => [newSession, ...prev]);
  };

  const clearChat = () => {
    if (confirm('Clear entire chat history?')) {
      setChatMessages([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-0">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800">Lumina</h1>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            {['dashboard', 'coach', 'live', 'stats'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`capitalize font-medium text-sm transition-colors ${activeTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <button className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <img src="https://picsum.photos/seed/user/100" className="w-8 h-8 rounded-full ring-2 ring-white" alt="Avatar" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-2 space-y-8">
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    Daily Habits
                    <span className="bg-indigo-100 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest">
                      {habits.filter(h => h.completedToday).length}/{habits.length}
                    </span>
                  </h2>
                  <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">+ Add New</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {habits.map(habit => (
                    <HabitCard key={habit.id} habit={habit} onToggle={toggleHabit} />
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800">Tasks</h2>
                  <button className="text-sm font-semibold text-indigo-600">+ Task</button>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-sm">
                  {tasks.map(task => (
                    <div key={task.id} className="p-4 flex items-center gap-4 group hover:bg-slate-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={task.completed} 
                        onChange={() => toggleTask(task.id)}
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className={`flex-1 font-medium transition-colors ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        {task.title}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        task.priority === 'high' ? 'bg-rose-100 text-rose-600' : 
                        task.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                {isInsightLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-white/20 rounded w-3/4"></div>
                    <div className="h-20 bg-white/20 rounded"></div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      {insight?.title || "Daily Wisdom"}
                    </h2>
                    <p className="text-indigo-100 text-sm leading-relaxed mb-6">
                      {insight?.content}
                    </p>
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Action Plan</p>
                      {insight?.actionable.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 bg-white/10 p-3 rounded-xl border border-white/10">
                          <span className="w-5 h-5 rounded-full bg-white text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                          <span className="text-xs font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4">Weekly Energy</h3>
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={logs}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="energy" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'coach' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-12rem)] animate-in fade-in duration-500">
            {/* Sidebar: History */}
            <div className="md:col-span-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">History</h3>
                <button onClick={clearChat} className="p-1 hover:bg-rose-50 rounded-lg text-rose-400" title="Clear History">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <button 
                  onClick={() => setSelectedHistorySession(null)}
                  className={`w-full p-3 rounded-2xl text-left text-sm font-medium transition-all ${!selectedHistorySession ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    Active Chat
                  </div>
                </button>
                <div className="py-2 px-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Past Sessions</span>
                </div>
                {savedSessions.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-[10px] text-slate-300 italic">No saved sessions yet</p>
                  </div>
                )}
                {savedSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedHistorySession(session)}
                    className={`w-full p-3 rounded-2xl text-left transition-all ${selectedHistorySession?.id === session.id ? 'bg-indigo-100 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <p className="text-xs truncate">{session.title}</p>
                    <p className="text-[10px] opacity-60">{new Date(session.timestamp).toLocaleDateString()}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Area */}
            <div className="md:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
              <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">
                    {selectedHistorySession ? selectedHistorySession.title : 'Lumina Life Coach'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedHistorySession ? 'Session Transcript' : 'World-class AI coach'}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {(selectedHistorySession ? selectedHistorySession.messages : chatMessages).length === 0 && !selectedHistorySession && (
                  <div className="text-center py-12 space-y-4">
                    <p className="text-slate-400 text-sm">No messages yet. Start a conversation!</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {['How can I be more productive?', 'I feel stressed today.', 'Help me plan my morning.'].map(suggestion => (
                        <button key={suggestion} onClick={() => setChatInput(suggestion)} className="text-xs font-medium text-slate-600 bg-slate-100 px-4 py-2 rounded-full hover:bg-slate-200 transition-colors">
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(selectedHistorySession ? selectedHistorySession.messages : chatMessages).map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-100' 
                        : 'bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-1">
                      <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce delay-75"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full animate-bounce delay-150"></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {!selectedHistorySession && (
                <form onSubmit={handleSendMessage} className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Lumina anything..."
                    className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                  />
                  <button 
                    type="submit"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <LiveSession onSave={handleSaveLiveSession} />
        )}

        {activeTab === 'stats' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-bold text-slate-800">Your Progress</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <p className="text-sm font-semibold text-slate-500 mb-1">Total Habits Completed</p>
                <p className="text-3xl font-bold text-indigo-600">342</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <p className="text-sm font-semibold text-slate-500 mb-1">Avg. Mood Score</p>
                <p className="text-3xl font-bold text-emerald-600">4.2</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <p className="text-sm font-semibold text-slate-500 mb-1">Longest Streak</p>
                <p className="text-3xl font-bold text-orange-600">18 Days</p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-[400px]">
              <h3 className="font-bold text-slate-800 mb-6">Mood vs Energy Trends</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={logs}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" hide />
                  <YAxis domain={[0, 5]} hide />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="mood" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981' }} />
                  <Line type="monotone" dataKey="energy" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 h-20 px-6 flex items-center justify-around z-50">
        {[
          { id: 'dashboard', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
          { id: 'coach', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> },
          { id: 'live', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg> },
          { id: 'stats', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}
          >
            {tab.icon}
            <span className="text-[10px] font-bold uppercase tracking-widest">{tab.id}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
