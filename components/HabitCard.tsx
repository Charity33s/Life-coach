
import React from 'react';
import { Habit } from '../types';

interface HabitCardProps {
  habit: Habit;
  onToggle: (id: string) => void;
}

const HabitCard: React.FC<HabitCardProps> = ({ habit, onToggle }) => {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'health': return 'bg-emerald-100 text-emerald-700';
      case 'productivity': return 'bg-blue-100 text-blue-700';
      case 'mindfulness': return 'bg-purple-100 text-purple-700';
      case 'social': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className={`p-4 rounded-2xl transition-all duration-300 ${habit.completedToday ? 'bg-white shadow-sm' : 'bg-slate-50 border border-dashed border-slate-200'} flex items-center justify-between group`}>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => onToggle(habit.id)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${habit.completedToday ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-400'}`}
        >
          {habit.completedToday && (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div>
          <h3 className={`font-semibold ${habit.completedToday ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{habit.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getCategoryColor(habit.category)}`}>
              {habit.category}
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1014 0c0-1.187-.249-2.315-.699-3.334a1 1 0 00-1.873.311c.232.76.339 1.482.339 2.023 0 .123-.007.244-.02.363-.107.575-.513 1.052-1.14 1.207a4.477 4.477 0 01-.307.067 1.053 1.053 0 00-.515.275 3.225 3.225 0 01-4.242 0 1.053 1.053 0 00-.515-.275 4.498 4.498 0 01-.306-.067c-.627-.155-1.033-.632-1.14-1.207a3.508 3.508 0 01-.02-.363c0-.54.107-1.263.34-2.023.23-.746.54-1.48.913-2.13a17.47 17.47 0 011.69-2.52c.24-.31.472-.58.68-.81a1 1 0 00-.472-1.635z" clipRule="evenodd" /></svg>
              {habit.streak} day streak
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HabitCard;
