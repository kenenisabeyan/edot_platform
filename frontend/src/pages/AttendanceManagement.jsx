import React, { useState, useEffect } from 'react';
import useThemeMode from '../hooks/useThemeMode';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, Save, UserCheck, ShieldAlert, GraduationCap, CheckCircle2, XCircle, Clock, Download, FileText, History, Send, QrCode, MonitorPlay } from 'lucide-react';
import CustomDropdown from '../components/CustomDropdown';
import AttendanceAnalytics from '../components/AttendanceAnalytics';
import QRScannerModal from '../components/QRScannerModal';
import SessionQRModal from '../components/SessionQRModal';
import { useQuery } from '@tanstack/react-query';

export default function AttendanceManagement() {
  const isDarkMode = useThemeMode();
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  
  const [date, setDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [studentsList, setStudentsList] = useState([]);
  const [instructorsList, setInstructorsList] = useState([]);
  const [adminStudentEditMode, setAdminStudentEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('daily');
  const [historyRecords, setHistoryRecords] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showSessionQR, setShowSessionQR] = useState(false);

  const { data: globalReports = [], isLoading: loadingGlobalReports } = useQuery({
    queryKey: ['globalAttendanceReports'],
    queryFn: async () => {
       const res = await api.get('/attendance/reports').catch(() => ({ data: { data: [] } }));
       return res.data?.data || [];
    }
  });

  const { data: globalDailyAttendances = [], isLoading: loadingGlobalDaily } = useQuery({
    queryKey: ['globalDailyAttendances'],
    queryFn: async () => {
       const res = await api.get('/attendance/all').catch(() => ({ data: { data: [] } }));
       return res.data?.data || [];
    }
  });

  useEffect(() => {
    if (activeTab === 'history' && selectedSection) {
       const fetchHistory = async () => {
          setLoadingHistory(true);
          try {
             const targetSection = sections.find(s => s.id === selectedSection);
             const { data } = await api.get(`/attendance/section/${targetSection.id}`);
             setHistoryRecords(data.data || []);
          } catch(err) {
             console.error('Failed to fetch history', err);
          } finally {
             setLoadingHistory(false);
          }
       };
       fetchHistory();
    }
  }, [activeTab, selectedSection, sections, refreshKey]);

  const exportHistoryCSV = () => {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Date,Course,Section,Name,Role,Status\n";
      const targetCourseObj = courses.find(c => c.id === selectedCourse);
      const courseName = targetCourseObj ? targetCourseObj.title : 'Course';
      const targetSectionObj = sections.find(s => s.id === selectedSection);
      const sectionName = targetSectionObj ? targetSectionObj.name : 'Section';

      historyRecords.forEach(att => {
          const dateStr = new Date(att.date).toLocaleDateString();
          const recs = att.records || [];
          recs.forEach(r => {
             const userName = r.user?.name || 'Unknown';
             const role = r.role || 'Unknown';
             const status = r.status || 'Unknown';
             csvContent += `"${dateStr}","${courseName}","${sectionName}","${userName}","${role}","${status}"\n`;
          });
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Attendance_${courseName}_${sectionName}.csv`.replace(/\s+/g, '_'));
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const endpoint = user?.role === 'admin' ? '/admin/courses' : '/instructor/courses';
        const { data } = await api.get(endpoint);
        setCourses(data.data || []);
      } catch (err) {
        console.error('Failed to fetch courses', err);
      }
    };
    if (user) fetchCourses();
  }, [user]);

  useEffect(() => {
    setSelectedSection('');
    setSections([]);
    if (!selectedCourse) return;
    const fetchSections = async () => {
      try {
        const { data } = await api.get(`/sections?courseId=${selectedCourse}`);
        setSections(data.data || []);
      } catch (err) {
        console.error('Failed to fetch sections', err);
      }
    };
    fetchSections();
  }, [selectedCourse]);

  useEffect(() => {
    if (!selectedCourse || !selectedSection || !date) {
       setAttendanceRecords([]);
       setStudentsList([]);
       setInstructorsList([]);
       return;
    }
    
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const targetSection = sections.find(s => s.id === selectedSection);
        if (!targetSection) {
            setLoading(false);
            return;
        }

        const sectionName = targetSection.name;
        const [usersRes, attendanceRes] = await Promise.all([
          api.get(`/attendance/users?courseId=${selectedCourse}&section=${sectionName}`),
          api.get(`/attendance?courseId=${selectedCourse}&section=${sectionName}&date=${date}`)
        ]);

        const fetchedStudents = usersRes.data?.students || [];
        const fetchedInstructors = usersRes.data?.instructors || [];
        
        setStudentsList(fetchedStudents);
        setInstructorsList(fetchedInstructors);

        const existingDoc = attendanceRes.data?.data;
        
        let initialRecords = [];
        
        if (existingDoc && existingDoc.records && existingDoc.records.length > 0) {
            initialRecords = existingDoc.records.map(r => ({
               userId: r.user?.id || r.user,
               name: r.user?.name || 'Unknown',
               role: r.role,
               status: r.status // 'present', 'absent', 'late'
            }));
        } else {
            initialRecords = [
               ...fetchedInstructors.map(i => ({ userId: i.userId, name: i.name, role: i.role, status: 'present' })),
               ...fetchedStudents.map(s => ({ userId: s.userId, name: s.name, role: s.role, status: 'present' }))
            ];
        }
        
        setAttendanceRecords(initialRecords);

      } catch (err) {
        console.error('Failed to resolve dynamic attendance payload', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [selectedCourse, selectedSection, date, sections, refreshKey]);

  const handleStatusChange = (userId, newStatus) => {
    setAttendanceRecords(prev => prev.map(record => 
       record.userId === userId ? { ...record, status: newStatus } : record
    ));
  };

  const handleScanSuccess = async (scannedData) => {
    if (scannedData.type === 'session_attendance') {
        try {
            await api.post('/attendance/self', { 
               courseId: scannedData.courseId, 
               section: scannedData.section 
            });
            alert("Check-in successful! You are marked as present for this class session.");
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to check-in.');
        }
    } else {
        const userId = typeof scannedData === 'string' ? scannedData : scannedData.userId;
        const userExists = attendanceRecords.some(r => r.userId === userId);
        if (userExists) {
          handleStatusChange(userId, 'present');
          setMessage(`Student successfully scanned and marked present!`);
          setTimeout(() => setMessage(''), 3000);
        } else {
          setMessage(`Error: Scanned ID not found in this class section.`);
          setTimeout(() => setMessage(''), 3000);
        }
    }
  };

  const handleSave = async () => {
    if (!selectedCourse || !selectedSection || !date || attendanceRecords.length === 0) return;
    setSaving(true);
    setMessage('');
    
    try {
      const targetSection = sections.find(s => s.id === selectedSection);
      
      await api.post('/attendance', {
         courseId: selectedCourse,
         section: targetSection.name,
         date: new Date(date),
         records: attendanceRecords
      });

      setMessage('Attendance successfully synced to the system!');
      setRefreshKey(prev => prev + 1);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to commit attendance records.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const sendReportToAdmin = async () => {
    if (!selectedCourse || historyRecords.length === 0) return;
    setSaving(true);
    setMessage('');
    try {
      const studentStats = {};
      historyRecords.forEach(att => {
          (att.records || []).forEach(r => {
             if (r.role === 'student' && r.user?.id) {
                 const sid = r.user.id;
                 if (!studentStats[sid]) studentStats[sid] = { present: 0, total: 0 };
                 studentStats[sid].total++;
                 if (r.status === 'present' || r.status === 'late') {
                     studentStats[sid].present++;
                 }
             }
          });
      });
      
      const studentRecords = Object.keys(studentStats).map(sid => {
         const stats = studentStats[sid];
         return {
            studentId: sid,
            attendancePercentage: Math.round((stats.present / stats.total) * 100),
            finalGrade: 'Pending',
            remarks: 'Auto-generated from Attendance Logs'
         };
      });
      
      const targetSection = sections.find(s => s.id === selectedSection);
      
      await api.post('/attendance/report', {
         courseId: selectedCourse,
         section: targetSection?.name || 'Main Section',
         term: 'Current Term',
         studentRecords
      });
      
      setMessage('Attendance report sent to Admin successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to send report to admin.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const renderUserCards = (usersArray, listRole, isReadOnly = false) => {
     if (!usersArray || usersArray.length === 0) {
         return <div className={`py-4 px-2 italic text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>No {listRole}s found for this course section.</div>
     }
     
     return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
           {usersArray.map(userItem => {
              const currentRecord = attendanceRecords.find(r => r.userId === userItem.userId);
              const currentStatus = currentRecord ? currentRecord.status : 'present';

              return (
                 <div key={userItem.userId} className={`group flex flex-col border p-5 rounded-[2rem] backdrop-blur-xl transition-all duration-500 ease-out hover:-translate-y-2 hover:shadow-2xl ${isDarkMode ? 'bg-gradient-to-br from-[#0B1120]/60 to-[#0f172a]/60 border-white/5' : 'bg-gradient-to-br from-white to-slate-50 border-slate-200'} ${
                    currentStatus === 'present' ? 'border-b-4 border-b-[#00D4FF] shadow-[0_10px_30px_rgba(0,212,255,0.08)] hover:shadow-[0_15px_40px_rgba(0,212,255,0.15)]' : 
                    currentStatus === 'late' ? 'border-b-4 border-b-[#F97316] shadow-[0_10px_30px_rgba(249,115,22,0.08)] hover:shadow-[0_15px_40px_rgba(249,115,22,0.15)]' : 
                    'border-b-4 border-b-[#E30A17] shadow-[0_10px_30px_rgba(227,10,23,0.08)] hover:shadow-[0_15px_40px_rgba(227,10,23,0.15)]'
                 }`}>
                    <div className="flex items-center gap-4 mb-5">
                       <div className={`relative w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shadow-inner
                          ${listRole === 'Instructor' ? 'bg-gradient-to-tr from-[#00D4FF]/20 to-[#2563EB]/20 text-[#00D4FF] border border-[#00D4FF]/40' : 'bg-gradient-to-tr from-[#0B1120]/10 to-[#1e293b]/10 text-slate-400 border border-slate-400/20'}
                       `}>
                          {userItem.name.charAt(0).toUpperCase()}
                          {/* Animated status dot on avatar */}
                          <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 ${isDarkMode ? 'border-[#0B1120]' : 'border-white'} ${
                             currentStatus === 'present' ? 'bg-[#00D4FF] shadow-[0_0_8px_rgba(0,212,255,0.8)]' :
                             currentStatus === 'late' ? 'bg-[#F97316] shadow-[0_0_8px_rgba(249,115,22,0.8)]' :
                             'bg-[#E30A17] shadow-[0_0_8px_rgba(227,10,23,0.8)]'
                          }`}></span>
                       </div>
                       <div className="flex-1 overflow-hidden">
                          <p className={`font-extrabold truncate text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{userItem.name}</p>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{userItem.role}</p>
                       </div>
                    </div>
                    
                    <div className={`flex rounded-2xl p-1.5 gap-1.5 w-full mt-auto border transition-colors ${isDarkMode ? 'bg-black/50 border-white/5' : 'bg-slate-100/80 border-slate-200'} ${isReadOnly ? 'opacity-60 pointer-events-none' : ''}`}>
                        <label className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl cursor-pointer transition-all duration-300 ${
                           currentStatus === 'present' ? 'bg-[#00D4FF]/20 text-[#00D4FF] shadow-[0_0_15px_rgba(0,212,255,0.2)]' : (isDarkMode ? 'text-slate-400 hover:bg-white/5 hover:text-slate-300' : 'text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-800')
                        }`}>
                           <input 
                              type="radio" 
                              name={`status-${userItem.userId}`} 
                              value="present" 
                              className="hidden"
                              checked={currentStatus === 'present'} 
                              onChange={() => handleStatusChange(userItem.userId, 'present')} 
                           />
                           <CheckCircle2 className="w-4 h-4" />
                           <span className="text-[11px] font-black uppercase tracking-wider">Present</span>
                        </label>

                        <label className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl cursor-pointer transition-all duration-300 ${
                           currentStatus === 'late' ? 'bg-[#F97316]/20 text-[#F97316] shadow-[0_0_15px_rgba(249,115,22,0.2)]' : (isDarkMode ? 'text-slate-400 hover:bg-white/5 hover:text-slate-300' : 'text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-800')
                        }`}>
                           <input 
                              type="radio" 
                              name={`status-${userItem.userId}`} 
                              value="late" 
                              className="hidden"
                              checked={currentStatus === 'late'} 
                              onChange={() => handleStatusChange(userItem.userId, 'late')} 
                           />
                           <Clock className="w-4 h-4" />
                           <span className="text-[11px] font-black uppercase tracking-wider">Late</span>
                        </label>

                        <label className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl cursor-pointer transition-all duration-300 ${
                           currentStatus === 'absent' ? 'bg-[#E30A17]/20 text-[#E30A17] shadow-[0_0_15px_rgba(227,10,23,0.2)]' : (isDarkMode ? 'text-slate-400 hover:bg-white/5 hover:text-slate-300' : 'text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-800')
                        }`}>
                           <input 
                              type="radio" 
                              name={`status-${userItem.userId}`} 
                              value="absent" 
                              className="hidden"
                              checked={currentStatus === 'absent'} 
                              onChange={() => handleStatusChange(userItem.userId, 'absent')} 
                           />
                           <XCircle className="w-4 h-4" />
                           <span className="text-[11px] font-black uppercase tracking-wider">Absent</span>
                        </label>
                    </div>
                 </div>
              );
           })}
        </div>
     );
  };

  if (user?.role === 'student') {
    return (
      <div className="animate-in fade-in flex flex-col space-y-8 min-h-screen p-6 md:p-10 max-w-none w-full font-sans">
        <div className={`mb-8 border-b pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
           <div>
               <h1 className={`text-4xl font-black flex items-center gap-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <History className="w-8 h-8 text-[#00D4FF]" />
                  Official Attendance Records
               </h1>
               <p className={`text-sm mt-2 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Review your final term attendance records as released by your instructors.
               </p>
           </div>
           <button 
             onClick={() => setShowScanner(true)}
             className={`shrink-0 px-6 py-3 rounded-full font-bold text-sm transition-all flex items-center gap-2 shadow-lg hover:scale-105 ${isDarkMode ? 'bg-gradient-to-r from-[#00D4FF] to-[#2563EB] text-white border border-white/20' : 'bg-gradient-to-r from-[#00D4FF] to-[#2563EB] text-white'}`}
           >
             <QrCode className="w-4 h-4" /> Scan Class QR
           </button>
        </div>
        
        {loadingGlobalReports ? (
            <div className="flex justify-center p-10">
                <div className="w-8 h-8 border-4 border-[#00D4FF] border-t-transparent rounded-full animate-spin"></div>
            </div>
        ) : globalReports.length === 0 ? (
            <div className={`text-center p-12 rounded-[2rem] border ${isDarkMode ? 'bg-[#0B1120] border-white/10 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>
               <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
               <p className="font-bold text-lg">No official attendance reports released yet.</p>
               <p className="text-sm mt-2">Your term attendance will appear here once submitted by your instructor.</p>
            </div>
        ) : (
            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-[#0B1120] border-white/10' : 'bg-white border-slate-200'} shadow-sm`}>
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                     <thead>
                        <tr className={`border-b text-[11px] font-black uppercase tracking-wider ${isDarkMode ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                           <th className="p-4 md:px-6">Course</th>
                           <th className="p-4 md:px-6">Instructor</th>
                           <th className="p-4 md:px-6">Status</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y dark:divide-white/10 divide-slate-200">
                        {globalReports.map((report) => {
                           const studentRecord = report.studentRecords?.find(r => r.studentId === user.id) || {};
                           const attendancePercentage = studentRecord.attendancePercentage || 0;
                           const totalClasses = 15;
                           const present = Math.round((attendancePercentage / 100) * totalClasses);
                           const absent = totalClasses - present;
                           
                           return (
                             <tr key={report.id} className={`transition-colors ${isDarkMode ? 'hover:bg-white/5 bg-[#0B1120]' : 'hover:bg-slate-50 bg-white'}`}>
                                <td className={`p-4 md:px-6 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                   {report.course?.title || 'Unknown Course'}
                                </td>
                                <td className={`p-4 md:px-6 text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                   {report.instructor?.name || 'Unassigned'}
                                </td>
                                <td className={`p-4 md:px-6 text-sm font-bold leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                   <div className="flex items-center gap-2">
                                     <span className="w-20 inline-block">Absent:</span> 
                                     <span className={isDarkMode ? 'text-rose-400' : 'text-rose-600'}>{absent}</span>
                                   </div>
                                   <div className="flex items-center gap-2">
                                     <span className="w-20 inline-block">Present:</span> 
                                     <span className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}>{present}</span>
                                   </div>
                                   <div className="flex items-center gap-2 mt-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                                     <span className="w-20 inline-block font-black text-[11px] uppercase tracking-widest">Percentage:</span> 
                                     <span className={`font-black ${isDarkMode ? 'text-[#00D4FF]' : 'text-blue-600'}`}>{attendancePercentage.toFixed(2)}%</span>
                                   </div>
                                </td>
                             </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in fade-in flex flex-col space-y-8 min-h-screen p-6 md:p-10 max-w-none w-full">
      
      {/* Analytics Dashboard */}
      {user && (user.role === 'admin' || user.role === 'instructor') && (
        <AttendanceAnalytics />
      )}

      <div className={`flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 mt-4 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
        <div>
          <h1 className={`text-4xl font-display font-black flex items-center gap-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
             <div className="p-3 bg-gradient-to-br from-[#00D4FF]/20 to-[#2563EB]/20 rounded-[1.25rem] border border-[#00D4FF]/30 shadow-[0_0_20px_rgba(0,212,255,0.2)]">
               <UserCheck className="w-8 h-8 text-[#00D4FF] drop-shadow-md"/>
             </div>
             Roster Status
          </h1>
          <p className={`text-sm mt-4 font-bold flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
             <span className="relative flex h-2.5 w-2.5">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4FF] opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00D4FF]"></span>
             </span>
             Dynamically register course attendance for students & instructors.
          </p>
        </div>
        
        {message && (
          <div className="px-6 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-[#00D4FF]/10 to-[#2563EB]/10 border border-[#00D4FF]/30 text-[#00D4FF] shadow-[0_0_20px_rgba(0,212,255,0.15)] animate-in slide-in-from-right flex items-center gap-2">
             <CheckCircle2 className="w-5 h-5" />
             {message}
          </div>
        )}
      </div>

      <div className={`p-8 md:p-10 !rounded-[2.5rem] border shadow-2xl flex flex-col md:flex-row gap-8 relative overflow-hidden transition-all duration-500 ${isDarkMode ? 'bg-[#0B1120]/90 border-white/10 backdrop-blur-3xl hover:border-[#00D4FF]/30 hover:shadow-[0_0_40px_rgba(0,212,255,0.05)]' : 'bg-white/95 border-slate-200 backdrop-blur-3xl hover:border-[#2563EB]/30 hover:shadow-xl'}`}>
         {/* Background ambient glows */}
         <div className="absolute -top-32 -right-32 w-[30rem] h-[30rem] bg-gradient-to-bl from-[#00D4FF]/20 to-transparent blur-[100px] rounded-full pointer-events-none"></div>
         <div className="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] bg-gradient-to-tr from-[#2563EB]/20 to-transparent blur-[100px] rounded-full pointer-events-none"></div>
         
         <div className="w-full md:w-2/5 relative z-10">
            <label className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
               <ShieldAlert className="w-4 h-4 text-[#00D4FF]" /> Target Course
            </label>
            <div className="relative group">
               <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00D4FF] to-[#2563EB] rounded-2xl opacity-0 group-hover:opacity-20 transition duration-500 blur pointer-events-none"></div>
               <div className={`relative rounded-2xl ${isDarkMode ? 'bg-black/40' : 'bg-slate-50/50'} backdrop-blur-sm border border-transparent transition-colors`}>
                  <CustomDropdown
                     value={selectedCourse}
                     onChange={setSelectedCourse}
                     options={courses.map(c => ({ 
                       label: c.title, 
                       value: c.id,
                       render: (
                          <div className="flex items-center gap-3 w-full py-1">
                             <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{c.title}</span>
                          </div>
                       )
                     }))}
                     placeholder="-- Select a Scope --"
                     searchable={true}
                  />
               </div>
            </div>
         </div>
         
         <div className="w-full md:w-[30%] relative z-10">
            <label className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
               <GraduationCap className="w-4 h-4 text-[#00D4FF]" /> Designated Section
            </label>
            <div className="relative group">
               <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00D4FF] to-[#2563EB] rounded-2xl opacity-0 group-hover:opacity-20 transition duration-500 blur pointer-events-none"></div>
               <div className={`relative rounded-2xl ${isDarkMode ? 'bg-black/40' : 'bg-slate-50/50'} backdrop-blur-sm border border-transparent transition-colors`}>
                  <CustomDropdown
                     value={selectedSection}
                     onChange={setSelectedSection}
                     options={sections.map(s => ({
                       label: s.name,
                       value: s.id,
                       render: (
                          <div className="py-1">
                             <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{s.name}</span>
                          </div>
                       )
                     }))}
                     placeholder="-- Cohort Group --"
                     searchable={false}
                     disabled={!selectedCourse || sections.length === 0}
                  />
               </div>
            </div>
         </div>

         <div className="w-full md:w-[30%] relative z-10">
            <label className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
               <Calendar className="w-4 h-4 text-[#00D4FF]" /> Roll Call Date
            </label>
            <div className="relative group">
               <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00D4FF] to-[#2563EB] rounded-full opacity-0 group-hover:opacity-20 transition duration-500 blur pointer-events-none"></div>
               <div className="relative">
                 <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={activeTab === 'history'}
                    className={`w-full !pl-14 pr-4 py-3.5 border !rounded-full text-sm font-bold focus:outline-none focus:border-[#00D4FF] focus:ring-2 focus:ring-[#00D4FF]/20 transition-all shadow-sm ${activeTab === 'history' ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'bg-black/40 border-white/5 text-white hover:bg-black/60' : 'bg-slate-50/50 border-slate-200 text-slate-900 hover:bg-white'}`}
                 />
                 <Calendar className={`absolute left-5 top-4 w-4 h-4 ${activeTab === 'history' ? 'text-slate-500' : 'text-[#2563EB]'}`} />
               </div>
            </div>
         </div>
      </div>

      {/* Tabs */}
      {selectedCourse && selectedSection && (
        <div className="flex justify-center -mt-6 mb-8 relative z-20">
          <div className={`flex p-2 rounded-full border shadow-lg backdrop-blur-xl transition-all duration-300 ${isDarkMode ? 'bg-[#0f172a]/90 border-white/10' : 'bg-white/90 border-slate-200 hover:shadow-xl'}`}>
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-2 px-8 py-3 rounded-full font-black text-[13px] uppercase tracking-wider transition-all duration-500 ${activeTab === 'daily' ? 'bg-gradient-to-r from-[#00D4FF] to-[#2563EB] text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-105' : isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              <FileText className={`w-4 h-4 ${activeTab === 'daily' ? 'animate-bounce' : ''}`} /> Daily Roster
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-8 py-3 rounded-full font-black text-[13px] uppercase tracking-wider transition-all duration-500 ${activeTab === 'history' ? 'bg-gradient-to-r from-[#00D4FF] to-[#2563EB] text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-105' : isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              <History className={`w-4 h-4 ${activeTab === 'history' ? 'animate-spin-slow' : ''}`} /> Attendance History
            </button>
          </div>
        </div>
      )}

      {!selectedCourse || !selectedSection ? (
         <div className="animate-in fade-in duration-700 w-full space-y-6">
            <div className="flex justify-between items-center mb-4">
               <h2 className={`text-2xl font-display font-black flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <History className="w-6 h-6 text-[#00D4FF]" /> Global Attendance Reports
               </h2>
            </div>
            {loadingGlobalReports ? (
               <div className="flex justify-center py-20">
                  <div className={`w-12 h-12 border-4 border-t-[#00D4FF] rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}></div>
               </div>
            ) : globalReports.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center py-28 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-[#00D4FF]/10 to-[#2563EB]/10 blur-[80px] rounded-full pointer-events-none"></div>
                  <div className="relative z-10 w-28 h-28 mb-8 flex items-center justify-center rounded-[2rem] bg-gradient-to-tr from-[#00D4FF]/10 to-[#2563EB]/10 border border-[#00D4FF]/20 shadow-[0_0_50px_rgba(0,212,255,0.15)] animate-pulse">
                     <FileText className={`w-12 h-12 drop-shadow-lg ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#2563EB]'}`} />
                  </div>
                  <h3 className={`text-3xl font-black font-display tracking-tight mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No Reports Found</h3>
                  <p className={`text-center max-w-md font-medium text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Select a course and section above to manage daily rosters, or wait for instructors to submit term reports.</p>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {globalReports.map(report => (
                     <div key={report.id} className={`p-6 rounded-[2rem] border shadow-lg relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${isDarkMode ? 'bg-gradient-to-br from-[#0B1120] to-[#0f172a] border-white/10' : 'bg-gradient-to-br from-white to-slate-50 border-slate-200'}`}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D4FF]/5 rounded-full blur-[40px] pointer-events-none"></div>
                        <div className="relative z-10">
                           <div className="flex justify-between items-start mb-4">
                              <div className="flex flex-col gap-1 pr-4">
                                 <h3 className={`text-lg font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{report.course?.title || 'Unknown Course'}</h3>
                                 <span className={`text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#2563EB]'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-[#00D4FF]' : 'bg-[#2563EB]'}`}></div>
                                    Section: {report.section || 'Main Section'}
                                 </span>
                              </div>
                              <span className={`px-3 py-1 rounded-full shrink-0 text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20' : 'bg-blue-50 text-[#2563EB] border border-blue-200'}`}>
                                 {report.term}
                              </span>
                           </div>
                           <p className={`text-xs font-bold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              <UserCheck className="w-4 h-4" /> Instructor: {report.instructor?.name || 'Admin'}
                           </p>
                           
                           <div className="space-y-3">
                              {(report.studentRecords || []).slice(0, 3).map((rec, idx) => (
                                 <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100'}`}>
                                    <span className={`text-sm font-bold truncate pr-4 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{rec.student?.name || 'Unknown'}</span>
                                    <span className={`px-2 py-1 rounded-md text-xs font-black shrink-0 ${rec.attendancePercentage >= 75 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                       {rec.attendancePercentage}%
                                    </span>
                                 </div>
                              ))}
                              {(report.studentRecords || []).length > 3 && (
                                 <div className={`text-center pt-2 text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    + {(report.studentRecords || []).length - 3} more students
                                 </div>
                              )}
                           </div>
                           
                           <div className={`mt-5 pt-4 border-t flex justify-between items-center text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                              <span>Submitted</span>
                              <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            )}

            <div className={`mt-12 pt-8 border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
               <div className="flex justify-between items-center mb-6">
                  <h2 className={`text-xl font-display font-black flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                     <Calendar className="w-5 h-5 text-[#2563EB]" /> Recent Daily Attendances
                  </h2>
               </div>
               {loadingGlobalDaily ? (
                  <div className="flex justify-center py-10">
                     <div className={`w-8 h-8 border-4 border-t-[#2563EB] rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}></div>
                  </div>
               ) : globalDailyAttendances.length === 0 ? (
                  <div className={`p-8 text-center font-bold italic rounded-3xl border ${isDarkMode ? 'bg-[#0B1120]/40 text-slate-400 border-white/5' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                     No recent daily attendance logs found.
                  </div>
               ) : (
                  <div className="space-y-4">
                     {globalDailyAttendances.slice(0, 5).map(record => (
                        <div key={record.id} className={`p-5 rounded-[1.5rem] border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${isDarkMode ? 'bg-gradient-to-r from-white/5 to-transparent border-white/10' : 'bg-white border-slate-200'}`}>
                           <div>
                              <div className="flex items-center gap-2 mb-1">
                                 <h3 className={`font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{record.course?.title || 'Course Activity'}</h3>
                                 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'bg-[#2563EB]/20 text-[#00D4FF]' : 'bg-blue-100 text-blue-600'}`}>{record.section || 'Main Section'}</span>
                              </div>
                              <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                 {new Date(record.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </p>
                           </div>
                           <div className="flex items-center gap-4">
                              <div className="flex -space-x-2">
                                 {(record.records || []).slice(0, 5).map((r, i) => (
                                    <div key={i} title={r.user?.name || 'User'} className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${isDarkMode ? 'border-[#0B1120] bg-white/10 text-white' : 'border-white bg-slate-100 text-slate-700'}`}>
                                       {r.user?.name ? r.user.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                 ))}
                                 {(record.records || []).length > 5 && (
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${isDarkMode ? 'border-[#0B1120] bg-slate-800 text-slate-400' : 'border-white bg-slate-50 text-slate-500'}`}>
                                       +{(record.records || []).length - 5}
                                    </div>
                                 )}
                              </div>
                              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                 {(record.records || []).length} Students
                              </span>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </div>
         </div>
      ) : activeTab === 'history' ? (
         <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-4">
               <h2 className={`text-2xl font-display font-black flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <History className="w-6 h-6 text-[#00D4FF]" /> Log History
               </h2>
               <div className="flex flex-wrap gap-4 mt-4 sm:mt-0">
                  <button 
                     onClick={exportHistoryCSV}
                     disabled={historyRecords.length === 0}
                     className={`group flex items-center gap-2 px-6 py-3 rounded-full font-black text-[13px] uppercase tracking-wider transition-all duration-300 disabled:opacity-50 border shadow-md hover:shadow-xl hover:-translate-y-1 ${isDarkMode ? 'bg-[#0f172a] text-white border-white/10 hover:border-[#00D4FF]/50' : 'bg-white text-slate-700 border-slate-200 hover:border-[#2563EB]/50'}`}
                  >
                     <Download className={`w-4 h-4 ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#2563EB]'} group-hover:scale-110 transition-transform`} /> Export CSV
                  </button>
                  <button 
                     onClick={sendReportToAdmin}
                     disabled={historyRecords.length === 0 || saving}
                     className="group relative flex items-center gap-2 px-6 py-3 rounded-full font-black text-[13px] uppercase tracking-wider transition-all duration-300 disabled:opacity-50 border shadow-[0_10px_20px_rgba(37,99,235,0.2)] hover:shadow-[0_15px_30px_rgba(0,212,255,0.3)] bg-gradient-to-r from-[#00D4FF] to-[#2563EB] text-white border-white/20 hover:-translate-y-1 hover:scale-[1.02] overflow-hidden"
                  >
                     <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                     <Send className="w-4 h-4 relative z-10 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" /> 
                     <span className="relative z-10">Send to Admin</span>
                  </button>
               </div>
            </div>
            {loadingHistory ? (
               <div className="flex justify-center py-20">
                  <div className={`w-12 h-12 border-4 border-t-[#00D4FF] rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}></div>
               </div>
            ) : historyRecords.length === 0 ? (
               <div className={`p-12 text-center font-bold italic rounded-3xl border ${isDarkMode ? 'bg-[#0B1120]/40 text-slate-400 border-white/5' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                  No historical attendance logs found for this section.
               </div>
            ) : (
               <div className="space-y-6">
                  {historyRecords.map(record => (
                     <div key={record.id} className={`p-8 rounded-[2rem] border shadow-lg relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${isDarkMode ? 'bg-gradient-to-br from-[#0B1120] to-[#0f172a] border-white/10' : 'bg-gradient-to-br from-white to-slate-50 border-slate-200'}`}>
                        {/* Ambient glow for the card */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D4FF]/5 rounded-full blur-[40px] pointer-events-none"></div>
                        <h3 className={`text-lg font-black mb-5 flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                           <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#00D4FF]/10 to-[#2563EB]/10 border border-[#00D4FF]/20 shadow-[0_0_15px_rgba(0,212,255,0.15)]">
                              <Calendar className="w-5 h-5 text-[#2563EB] dark:text-[#00D4FF]" /> 
                           </div>
                           {new Date(record.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                           {(record.records || []).map((userRec, idx) => {
                              const isPresent = userRec.status === 'present';
                              const isLate = userRec.status === 'late';
                              const isAbsent = userRec.status === 'absent';
                              return (
                              <div key={idx} className={`group flex items-center gap-4 p-4 rounded-[1.5rem] border backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] ${isDarkMode ? 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10' : 'bg-white/60 border-slate-200 hover:border-slate-300 hover:bg-white hover:shadow-md'}`}>
                                 <div className={`relative flex items-center justify-center w-11 h-11 rounded-full font-black text-sm shadow-inner ${isDarkMode ? 'bg-[#0B1120] text-slate-300 border border-white/5' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                    {userRec.user?.name ? userRec.user.name.charAt(0).toUpperCase() : 'U'}
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${isDarkMode ? 'border-[#0f172a]' : 'border-white'} ${isPresent ? 'bg-[#00D4FF] shadow-[0_0_8px_rgba(0,212,255,0.8)]' : isLate ? 'bg-[#F97316] shadow-[0_0_8px_rgba(249,115,22,0.8)]' : 'bg-[#E30A17] shadow-[0_0_8px_rgba(227,10,23,0.8)]'}`}></div>
                                 </div>
                                 <div className="flex-1 overflow-hidden">
                                    <p className={`font-bold text-[13px] truncate ${isDarkMode ? 'text-white group-hover:text-[#00D4FF]' : 'text-slate-900 group-hover:text-[#2563EB]'} transition-colors`}>{userRec.user?.name || 'Unknown User'}</p>
                                    <p className={`text-[10px] mt-0.5 uppercase font-black tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{userRec.status}</p>
                                 </div>
                              </div>
                           )})}
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>
      ) : loading ? (
         <div className="flex-1 flex justify-center items-center py-20">
            <div className={`w-12 h-12 border-4 border-t-[#00D4FF] rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}></div>
         </div>
      ) : attendanceRecords.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center py-28 relative animate-in fade-in duration-700">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-[#E30A17]/10 to-[#F97316]/10 blur-[80px] rounded-full pointer-events-none"></div>
            <div className="relative z-10 w-28 h-28 mb-8 flex items-center justify-center rounded-[2rem] bg-gradient-to-tr from-[#E30A17]/10 to-[#F97316]/10 border border-[#E30A17]/20 shadow-[0_0_50px_rgba(227,10,23,0.15)] animate-pulse">
               <UserCheck className={`w-12 h-12 drop-shadow-lg ${isDarkMode ? 'text-[#E30A17]' : 'text-[#E30A17]'}`} />
            </div>
            <h3 className={`text-4xl font-black font-display tracking-tight mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Empty Roster</h3>
            <p className={`text-center max-w-md font-medium text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>There are currently no users enrolled in this section for the selected date.</p>
         </div>
      ) : (
         <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-700 pb-32">
            
            {/* Instructors Row */}
            {user?.role === 'admin' && (
               <div>
                  <h2 className={`text-xl font-display font-black mb-6 flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                     <ShieldAlert className="w-5 h-5 text-[#00D4FF]" />
                     Instructors Roster
                     <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${isDarkMode ? 'bg-[#0B1120]/20 text-white' : 'bg-slate-100 text-slate-900'}`}>{instructorsList.length}</span>
                  </h2>
                  {renderUserCards(instructorsList, 'Instructor', false)}
               </div>
            )}

            {/* Students Row */}
            <div>
               <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-xl font-display font-black flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                     <GraduationCap className="w-5 h-5 text-[#00D4FF]" />
                     Students Roster
                     <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-[#0B1120]/20 text-white' : 'bg-slate-100 text-slate-900'}`}>{studentsList.length}</span>
                  </h2>
                  {user?.role === 'admin' && (
                     <button 
                        onClick={() => setAdminStudentEditMode(!adminStudentEditMode)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${adminStudentEditMode ? 'bg-gradient-to-r from-[#00D4FF]/20 to-[#2563EB]/20 text-[#00D4FF] border-[#00D4FF]/30 shadow-[0_0_15px_rgba(0,212,255,0.15)]' : (isDarkMode ? 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900')}`}
                     >
                        {adminStudentEditMode ? 'Lock Student Roster' : 'Unlock for Editing'}
                     </button>
                  )}
               </div>
               {renderUserCards(studentsList, 'Student', user?.role === 'admin' && !adminStudentEditMode)}
            </div>

            {/* Action Bar */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10">
               <div className={`p-2 rounded-full border shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl flex items-center gap-2 md:gap-4 ${isDarkMode ? 'bg-[#0B1120]/90 border-white/20' : 'bg-white/90 border-slate-300'}`}>
                  <button 
                     onClick={() => setShowScanner(true)}
                     className={`px-4 py-2 rounded-full font-bold text-xs transition-colors whitespace-nowrap flex items-center gap-1.5 ${isDarkMode ? 'text-[#00D4FF] hover:bg-[#00D4FF]/10' : 'text-[#2563EB] hover:bg-blue-50'}`}
                  >
                     <QrCode className="w-4 h-4" /> Scan ID
                  </button>
                  <button 
                     onClick={() => setShowSessionQR(true)}
                     className={`px-4 py-2 rounded-full font-bold text-xs transition-colors whitespace-nowrap flex items-center gap-1.5 ${isDarkMode ? 'text-purple-400 hover:bg-purple-400/10' : 'text-purple-600 hover:bg-purple-50'}`}
                  >
                     <MonitorPlay className="w-4 h-4" /> Project QR
                  </button>
                  <button 
                     onClick={() => setAttendanceRecords(prev => prev.map(r => ({...r, status: 'present'})))}
                     className={`px-4 py-2 rounded-full font-bold text-xs transition-colors whitespace-nowrap ${isDarkMode ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                     Mark All Present
                  </button>
                  <div className={`w-px h-6 opacity-30 hidden md:block ${isDarkMode ? 'bg-white' : 'bg-black'}`}></div>
                  <div className={`px-2 font-bold text-sm hidden md:block whitespace-nowrap ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                     Ready to sync {attendanceRecords.length} records
                  </div>
                  <button 
                     onClick={handleSave}
                     disabled={saving}
                     className={`group relative overflow-hidden px-8 py-3.5 rounded-full font-black tracking-wide transition-all disabled:opacity-50 flex items-center gap-3 bg-gradient-to-r from-[#00D4FF] to-[#2563EB] text-white shadow-lg border border-white/20 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,212,255,0.4)]`}
                  >
                     <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                     {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin relative z-10"></div> : <Save className="w-5 h-5 relative z-10 drop-shadow-md" />}
                     <span className="relative z-10 drop-shadow-md">{saving ? 'Syncing...' : (user?.role === 'admin' ? 'Commit Instructors Log' : 'Commit Daily Log')}</span>
                  </button>
               </div>
            </div>
         </div>
      )}
      <QRScannerModal 
        isOpen={showScanner} 
        onClose={() => setShowScanner(false)} 
        onScanSuccess={handleScanSuccess} 
      />
      {selectedCourse && selectedSection && (
        <SessionQRModal 
          isOpen={showSessionQR}
          onClose={() => setShowSessionQR(false)}
          courseId={selectedCourse}
          section={sections.find(s => s.id === selectedSection)?.name || 'Main Section'}
        />
      )}
    </div>
  );
}
