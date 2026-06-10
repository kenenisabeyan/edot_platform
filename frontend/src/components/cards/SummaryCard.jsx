import React from 'react';
import useThemeMode from '../../hooks/useThemeMode';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function SummaryCard({ title, value, percentage, isPositive, icon: Icon, colorTheme = 'blue', onClick }) {
  const isDarkMode = useThemeMode();
  const colorClasses = {
    blue: 'from-blue-500 to-indigo-600 text-blue-400 bg-blue-500/100/10',
    green: 'from-[#00D4FF] to-[#0099CC] text-[#00D4FF] bg-[#00D4FF]/10',
    gold: 'from-[#00D4FF] to-orange-600 text-[#00D4FF] bg-[#00D4FF]/10',
    purple: 'from-purple-500 to-fuchsia-600 text-purple-400 bg-purple-500/100/10',
    orange: 'from-orange-500 to-amber-600 text-orange-400 bg-[#00D4FF]/10',
  };
  const theme = colorClasses[colorTheme] || colorClasses.blue;
  const gradient = theme.split(' text-')[0];
  const textBg = 'text-' + theme.split(' text-')[1];

  return (
    <div 
      onClick={onClick}
      className={`/90 backdrop-blur-xl rounded-3xl p-6 border transition-all duration-300 flex flex-col items-center text-center gap-4 group relative overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)] ${onClick ? 'cursor-pointer hover:border-white/20 hover:shadow-[0_16px_48px_rgba(0,212,255,0.2)] hover:-translate-y-1' : 'shadow-[0_8px_32px_rgba(0,0,0,0.3)]'} ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200'}`}
    >
      <div className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${gradient} rounded-full opacity-10 group-hover:opacity-30 blur-2xl transition-opacity`}></div>
      
      {/* Icon (centered top) */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${textBg} transition-transform group-hover:scale-110 duration-300 border ${isDarkMode ? 'border-white/5' : 'border-slate-100'} relative z-10`}>
        {Icon && <Icon className="w-6 h-6" />}
      </div>

      {/* Content (centered) */}
      <div className="flex flex-col items-center relative z-10 w-full">
        <h3 className={`font-semibold text-sm mb-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>{title}</h3>
        <h2 className={`text-4xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</h2>
        {percentage && (
           <div className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-md shadow-sm mt-3 w-fit ${isPositive ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'bg-[#E30A17]/20 text-[#E30A17]'}`}>
             {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
             {percentage}%
           </div>
        )}
      </div>
    </div>
  );
}
