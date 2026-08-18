import React, { useState, useEffect } from 'react';
import useThemeMode from '../hooks/useThemeMode';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';
import { 
  ArrowLeft, CheckCircle2, ChevronRight, Save, 
  BookOpen, LayoutList, DollarSign, PlusCircle, Banknote,
  PlayCircle, Trash2, Tag, Image as ImageIcon, Send, FileText,
  Sparkles
} from 'lucide-react';
import QuizBuilder from '../components/QuizBuilder';
import ReactPlayer from 'react-player';
import CustomDropdown from '../components/CustomDropdown';
import { useAuth } from '../context/AuthContext';
import { courseDropdownOptions } from '../constants/courseCategories';
import toast from 'react-hot-toast';
import SmartVideoPlayer from '../components/SmartVideoPlayer';
import { useQuery } from '@tanstack/react-query';
import PremiumModal from '../components/PremiumModal';

export default function InstructorCourseBuilder() {
  const isDarkMode = useThemeMode();
  const navigate = useNavigate();
  const { id } = useParams(); // If editing an existing course
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [courseId, setCourseId] = useState(id || null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [dragActive, setDragActive] = useState({});
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Social Science',
    level: 'Beginner',
    duration: 1,
    thumbnail: '',
    videoUrl: '',
    price: 0,
    requirements: [''],
    whatYouWillLearn: [''],
    tags: [''],
    isExamRequired: false,
    finalExam: []
  });

  const [lessons, setLessons] = useState([]);
  const [phases, setPhases] = useState([]); // List of string phase names
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', videoUrl: '', duration: 10, readingMaterials: '', quiz: [], phase: '' });
  const [showLessonFormForPhase, setShowLessonFormForPhase] = useState(null); // Phase name to show form for
  const [newPhaseName, setNewPhaseName] = useState('');
  const [showPhaseInput, setShowPhaseInput] = useState(false);
  const [lastFetchedDurationUrl, setLastFetchedDurationUrl] = useState('');
  
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [loadingLessonContent, setLoadingLessonContent] = useState(false);
  const [suggestions, setSuggestions] = useState({});

  const resolveVideoUrl = (url) => {
    if (!url) return '';
    let cleanUrl = url.trim();
    const iframeMatch = cleanUrl.match(/<iframe.*?src=["'](.*?)["']/i);
    if (iframeMatch) cleanUrl = iframeMatch[1];
    cleanUrl = cleanUrl.replace(/\\/g, '/');

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
       if (cleanUrl.startsWith('www.')) cleanUrl = `https://${cleanUrl}`;
       else if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) cleanUrl = `https://${cleanUrl}`;
       else cleanUrl = `http://localhost:5000${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
    }

    if (cleanUrl.includes('cloudinary.com')) {
      cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');
      cleanUrl = cleanUrl.replace(/\/(image|raw)\/upload\//, '/video/upload/');
      cleanUrl = cleanUrl.replace(/\.(mkv|mov|avi|webm)$/i, '.mp4');
      if (!cleanUrl.match(/\.[a-z0-9]{3,4}$/i)) cleanUrl += '.mp4';
    }
    return cleanUrl;
  };

  const { data: queryData, isLoading: queryLoading } = useQuery({
    queryKey: ['courseBuilderDetails', courseId],
    queryFn: async () => {
      const { data } = await api.get(`/courses/${courseId}/content`);
      return data.course;
    },
    enabled: !!courseId,
    staleTime: 0 // fetch on mount
  });

  useEffect(() => {
    if (queryData) {
      setFormData(prev => ({
        ...prev,
        title: queryData.title || '',
        description: queryData.description || '',
        category: queryData.mainCategory || queryData.category || 'Social Science',
        level: queryData.level || 'Beginner',
        duration: queryData.duration || 1,
        thumbnail: queryData.thumbnail || '',
        videoUrl: queryData.videoUrl || '',
        price: queryData.price || 0,
        requirements: queryData.requirements?.length ? queryData.requirements : [''],
        whatYouWillLearn: queryData.whatYouWillLearn?.length ? queryData.whatYouWillLearn : [''],
        tags: queryData.tags?.length ? queryData.tags : [''],
        isExamRequired: queryData.isExamRequired || false,
        finalExam: queryData.finalExam || []
      }));
      const courseLessons = queryData.lessons || [];
      setLessons(courseLessons);
      
      const uniquePhases = [...new Set(courseLessons.map(l => l.phase).filter(Boolean))];
      if (uniquePhases.length > 0) {
        setPhases(uniquePhases);
      }
    }
  }, [queryData]);

  useEffect(() => {
    setLoading(queryLoading);
  }, [queryLoading]);

  const handleArrayChange = (field, index, value) => {
    const newArray = [...formData[field]];
    newArray[index] = value;
    setFormData({ ...formData, [field]: newArray });
  };

  const addArrayItem = (field) => {
    setFormData({ ...formData, [field]: [...formData[field], ''] });
  };

  const removeArrayItem = (field, index) => {
    const newArray = formData[field].filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: newArray.length ? newArray : [''] });
  };

  const saveCourseData = async () => {
    setSaving(true);
    try {
      const cleanedData = {
        ...formData,
        thumbnail: formData.thumbnail || 'default-course.jpg',
        requirements: formData.requirements.filter(item => item.trim() !== ''),
        whatYouWillLearn: formData.whatYouWillLearn.filter(item => item.trim() !== ''),
        tags: formData.tags.filter(item => item.trim() !== '')
      };

      if (!courseId) {
        const { data } = await api.post('/instructor/courses', cleanedData);
        setCourseId(data.data.id);
        navigate(`/dashboard/builder/${data.data.id}`, { replace: true });
        toast.success('Course created and saved as draft!');
      } else {
        await api.put(`/instructor/courses/${courseId}`, cleanedData);
        toast.success('Course details updated successfully!');
      }
      return true;
    } catch (err) {
      console.error('Failed to save course', err);
      toast.error(err.response?.data?.message || 'Failed to save course details');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const nextStep = async () => {
    if (currentStep === 1 || currentStep === 2) {
      const success = await saveCourseData();
      if (success) setCurrentStep(currentStep + 1);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = async () => {
    await saveCourseData();
    setCurrentStep(currentStep - 1);
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    if (!courseId) return;
    
    setSaving(true);
    try {
      const { data } = await api.post(`/instructor/courses/${courseId}/lessons`, {
        ...lessonForm,
        phase: showLessonFormForPhase
      });
      setLessons([...lessons, data.data]);
      setLessonForm({ title: '', description: '', videoUrl: '', duration: 10, readingMaterials: '', quiz: [], phase: '' });
      setShowLessonFormForPhase(null);
      toast.success('Lesson successfully added!');
    } catch (err) {
      console.error('Failed to add lesson', err);
      toast.error(err.response?.data?.message || 'Failed to add lesson');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhase = () => {
    if (newPhaseName.trim() && !phases.includes(newPhaseName.trim())) {
      setPhases([...phases, newPhaseName.trim()]);
    }
    setNewPhaseName('');
    setShowPhaseInput(false);
  };

  const handleSubmitForReview = async () => {
    const success = await saveCourseData();
    if (success && courseId) {
      setSaving(true);
      try {
        await api.put(`/instructor/courses/${courseId}/submit`);
        toast.success('Course successfully submitted for review!');
        navigate('/dashboard/my-courses'); // Go back to dashboard after submitting
      } catch (err) {
        console.error('Failed to submit course', err);
        toast.error('Failed to submit course');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setSaving(true);
    setUploadProgress(prev => ({ ...prev, [field]: 1 }));
    try {
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(prev => ({ ...prev, [field]: percentCompleted }));
        }
      });
      if (data.success) {
        if (field === 'courseVideoUrl') {
          // Course level videoUrl
          setFormData(prev => ({ 
            ...prev, 
            videoUrl: data.secure_url
          }));
        } else if (field === 'videoUrl') {
          // Lesson form videoUrl
          setLessonForm(prev => ({ 
            ...prev, 
            videoUrl: data.secure_url,
            duration: data.duration ? Math.ceil(data.duration / 60) : prev.duration
          }));
        } else if (field === 'readingMaterials') {
          const docLink = `[Attached Resource: ${file.name}](${data.secure_url})`;
          setLessonForm(prev => ({ 
            ...prev, 
            readingMaterials: prev.readingMaterials 
              ? `${prev.readingMaterials}\n\n${docLink}` 
              : docLink
          }));
        } else if (field === 'thumbnail') {
          setFormData(prev => ({ ...prev, thumbnail: data.secure_url }));
        }
        toast.success(`${field === 'thumbnail' ? 'Image' : 'File'} uploaded successfully!`);
      }
    } catch (err) {
      console.error('Upload failed', err);
      toast.error(err.response?.data?.message || 'Failed to upload file. Please try again.');
    } finally {
      setSaving(false);
      setUploadProgress(prev => ({ ...prev, [field]: 0 }));
      if (e.target && e.target.value !== undefined) {
        e.target.value = ''; // Reset input
      }
    }
  };

  const handleDrag = (e, field) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(prev => ({ ...prev, [field]: true }));
    } else if (e.type === "dragleave") {
      setDragActive(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleDrop = (e, field) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [field]: false }));
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload({ target: { files: e.dataTransfer.files } }, field);
    }
  };

  const steps = [
    { title: 'Information', icon: <BookOpen className="w-5 h-5" /> },
    { title: 'Details', icon: <Tag className="w-5 h-5" /> },
    { title: 'Curriculum', icon: <LayoutList className="w-5 h-5" /> },
    { title: 'Pricing', icon: <Banknote className="w-5 h-5" /> }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="w-12 h-12 border-4 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 course-builder-shell ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
      {/* Top Navbar specifically for the builder */}
      <header className={`border-b sticky top-0 z-30 shadow-sm ${isDarkMode ? 'bg-slate-950/95 border-white/10 backdrop-blur-md' : 'bg-white/95 border-slate-200 backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm font-medium">
            <button 
              onClick={() => navigate('/dashboard/my-courses')}
              className={`flex items-center justify-center min-w-[140px] gap-2 font-bold transition-colors px-8 py-2.5 rounded-full border shadow-md text-white bg-[#1e48bc] hover:bg-[#295ce8] border-transparent`}
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <span className="text-white/20">|</span>
            <span className="text-[#00D4FF]">Create Course</span>
            <span className="text-white/20">/</span>
            <span className={`font-semibold truncate max-w-[150px] sm:max-w-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formData.title || 'Untitled Course'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-xs font-medium flex items-center gap-1.5 hidden sm:flex ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {saving ? 'Saving...' : 'Draft saved'} {!saving && <CheckCircle2 className="w-3.5 h-3.5 text-[#00D4FF]" />}
            </span>
            <button 
              onClick={saveCourseData}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 px-4 py-2 font-semibold rounded-full transition-colors text-sm disabled:opacity-50 bg-[#00D4FF] hover:bg-[#00A3CC] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
            >
               {saving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid gap-8 lg:grid-cols-[1.8fr_1fr]">
          <div className="space-y-10">
            <div>
              {/* Progress Steps */}
              <div className="mb-10 px-2 course-builder-stepper">
              <div className="flex items-center justify-between relative">
              <div className={`course-builder-stepper-line ${isDarkMode ? 'dark' : 'light'} -z-10`}></div>
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-[#00D4FF] via-[#38bdf8] to-[#2563EB] -z-10 transition-all duration-500"
                style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
              ></div>
              
              {steps.map((step, idx) => {
                const stepNum = idx + 1;
                const isActive = stepNum === currentStep;
                const isCompleted = stepNum < currentStep;
                
                return (
                  <div key={idx} className={`course-builder-step ${isDarkMode ? 'dark' : 'light'} ${isActive ? 'course-builder-step-active' : ''}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${isCompleted ? 'course-builder-step-completed' : isActive ? 'bg-gradient-to-r from-[#00D4FF] to-[#2563EB] text-white shadow-lg border-transparent' : `${isDarkMode ? 'bg-slate-900 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-500'}`}`}>
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
                    </div>
                    <span className={`course-builder-step-label ${isDarkMode ? 'dark' : 'light'} hidden sm:block ${isActive ? (isDarkMode ? 'text-[#00D4FF] font-bold' : 'text-[#2563EB] font-bold') : isCompleted ? (isDarkMode ? 'text-[#00D4FF]' : 'text-[#0088CC] font-semibold') : ''}`}>
                      {step.title}
                    </span>
                  </div>
                );
              })}
              </div>
              </div>
            </div>

            {/* Form Area */}
            <div key={currentStep} className={`course-builder-card ${isDarkMode ? 'dark' : 'light'} mb-8 relative animate-in fade-in zoom-in-95 duration-500 flex flex-col min-h-[520px]`}>
            <div className="p-6 md:p-8 relative z-10 overflow-y-auto flex-1 scrollbar-thin">
              
              {/* STEP 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className={`course-builder-heading mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>General Information</h2>
                  
                  <div className={`course-builder-section rounded-[28px] border p-5 ${isDarkMode ? 'border-white/10 bg-slate-950/80' : 'border-slate-200/80 bg-slate-50/60'}`}>
                    <label className={`block text-sm font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Course Title <span className="text-[#E30A17]">*</span></label>
                    <input 
                      type="text" 
                      value={formData.title} 
                      onChange={e => setFormData({...formData, title: e.target.value})} 
                      required 
                      className={`course-builder-input ${isDarkMode ? 'dark' : 'light'} font-semibold`} 
                      placeholder="E.g., Complete Modern JavaScript Bootcamp" 
                    />
                    <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Use a clear title that helps students understand the value of your course.</p>
                  </div>
                  
                  <div className={`course-builder-section rounded-[28px] border p-5 ${isDarkMode ? 'border-white/10 bg-slate-950/80' : 'border-slate-200/80 bg-slate-50/60'}`}>
                    <label className={`block text-sm font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Detailed Description</label>
                    <textarea 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                      className={`course-builder-input ${isDarkMode ? 'dark' : 'light'} resize-y min-h-[140px]`} 
                      rows="4" 
                      placeholder="What will students learn in this course? Detail the curriculum and learning outcomes."
                    ></textarea>
                    <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>The more specific you are, the easier it is for learners to decide.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className={`block text-sm font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Category</label>
                      <CustomDropdown
                        value={formData.category}
                        onChange={(val) => {
                          const isNewSchool = val === 'Social Science' || val === 'Mathematics & Natural Science';
                          const isOldSchool = formData.category === 'Social Science' || formData.category === 'Mathematics & Natural Science';
                          
                          let newLevel = formData.level;
                          if (isNewSchool && !isOldSchool) {
                            newLevel = 'Grade 7';
                          } else if (!isNewSchool && isOldSchool) {
                            newLevel = 'Beginner';
                          }
                          setFormData({...formData, category: val, level: newLevel});
                        }}
                        options={courseDropdownOptions}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Level</label>
                      <CustomDropdown
                        value={formData.level}
                        onChange={(val) => setFormData({...formData, level: val})}
                        options={
                          (formData.category === 'Social Science' || formData.category === 'Mathematics & Natural Science') 
                            ? [
                                { label: 'Grade 7', value: 'Grade 7' },
                                { label: 'Grade 8', value: 'Grade 8' },
                                { label: 'Grade 9', value: 'Grade 9' },
                                { label: 'Grade 10', value: 'Grade 10' },
                                { label: 'Grade 11', value: 'Grade 11' },
                                { label: 'Grade 12', value: 'Grade 12' }
                              ]
                            : [
                                { label: 'Beginner', value: 'Beginner' },
                                { label: 'Intermediate', value: 'Intermediate' },
                                { label: 'Advanced', value: 'Advanced' },
                                { label: 'All Levels', value: 'All Levels' }
                              ]
                        }
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Duration (Hours) <span className="text-[#E30A17]">*</span></label>
                      <input 
                        type="number" 
                        min="1" 
                        value={formData.duration} 
                        onChange={e => setFormData({...formData, duration: Number(e.target.value)})} 
                        required 
                        className={`w-full !px-5 !py-3 !rounded-full border focus:ring-1 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none transition-all font-semibold ${isDarkMode ? 'bg-[#0B1120] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`} 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Media & Details */}
              {currentStep === 2 && (
                <div className="space-y-8">
                  <h2 className={`course-builder-heading mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Media & Additional Details</h2>
                  
                  <div>
                    <label className={`block text-sm font-bold mb-2 flex items-center justify-between ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <span className="flex items-center gap-2"><ImageIcon className="w-4 h-4 text-[#00D4FF]" /> Course Thumbnail URL</span>
                      <label 
                        className={`cursor-pointer text-xs font-bold transition-all px-3 py-1 rounded-md border flex items-center gap-1 ${dragActive.thumbnail ? 'border-[#00D4FF] bg-[#00D4FF]/10 text-[#00D4FF]' : `border-transparent ${isDarkMode ? 'text-[#00D4FF] hover:text-white' : 'text-[#2563EB] hover:text-[#1D4ED8]'}`}`}
                        onDragEnter={(e) => handleDrag(e, 'thumbnail')}
                        onDragLeave={(e) => handleDrag(e, 'thumbnail')}
                        onDragOver={(e) => handleDrag(e, 'thumbnail')}
                        onDrop={(e) => handleDrop(e, 'thumbnail')}
                      >
                        {uploadProgress.thumbnail ? `Uploading... ${uploadProgress.thumbnail}%` : 'Upload Image / Drop Here'}
                        <input 
                          type="file" 
                          accept="image/*"
                          className="hidden" 
                          onChange={(e) => handleFileUpload(e, 'thumbnail')} 
                          disabled={saving}
                        />
                      </label>
                    </label>
                     <input 
                      type="url" 
                      value={formData.thumbnail === 'default-course.jpg' ? '' : formData.thumbnail} 
                      onChange={e => setFormData({...formData, thumbnail: e.target.value})} 
                      className={`w-full !px-5 !py-3 !rounded-full border focus:ring-1 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none transition-all font-medium ${isDarkMode ? 'bg-[#0B1120] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`} 
                      placeholder="https://example.com/beautiful-course-cover.jpg" 
                    />
                    {formData.thumbnail && formData.thumbnail !== 'default-course.jpg' && (
                      <div className={`mt-4 rounded-xl overflow-hidden shadow-sm border max-w-sm h-48 bg-black/50 relative ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                        <img src={formData.thumbnail} alt="Thumbnail Preview" className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80' }} />
                      </div>
                    )}
                  </div>

                  {/* Course Video URL */}
                  <div>
                    <label className={`block text-sm font-bold mb-2 flex items-center justify-between ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <span className="flex items-center gap-2"><PlayCircle className="w-4 h-4 text-[#00D4FF]" /> Course Video URL (Intro)</span>
                      <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Recommended: YouTube, Vimeo, Google Drive</span>
                    </label>
                    <input 
                      type="url" 
                      value={formData.videoUrl} 
                      onChange={e => setFormData({...formData, videoUrl: e.target.value})} 
                      className={`w-full !px-5 !py-3 !rounded-full border focus:ring-1 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none transition-all font-medium ${isDarkMode ? 'bg-[#0B1120] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`} 
                      placeholder="Paste YouTube, Vimeo, or Drive link here for fast loading..." 
                    />
                    {formData.videoUrl && (
                      <div className={`mt-4 rounded-xl overflow-hidden shadow-sm border aspect-video bg-black/50 relative ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                        <SmartVideoPlayer url={formData.videoUrl} controls className="w-full h-full" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* What You'll Learn */}
                    <div>
                      <label className={`block text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>What will students learn?</label>
                      {formData.whatYouWillLearn.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 mb-3">
                          <input 
                            type="text" 
                            value={item}
                            onChange={(e) => handleArrayChange('whatYouWillLearn', index, e.target.value)}
                            className={`flex-1 !px-5 !py-2.5 !rounded-full border focus:ring-1 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none transition-all text-sm ${isDarkMode ? 'bg-[#0B1120] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`}
                            placeholder={`Learning outcome ${index + 1}`}
                          />
                          <button 
                            onClick={() => removeArrayItem('whatYouWillLearn', index)}
                            className={`p-2.5 hover:text-[#E30A17] hover:bg-[#E30A17]/10 rounded-lg transition-colors border border-transparent hover:border-[#E30A17]/20 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => addArrayItem('whatYouWillLearn')}
                        className={`text-sm font-bold flex items-center gap-1.5 transition-colors ${isDarkMode ? 'text-[#00D4FF] hover:text-[#00D4FF]/80' : 'text-[#2563EB] hover:text-[#1D4ED8]'}`}
                      >
                        <PlusCircle className="w-4 h-4" /> Add Outcome
                      </button>
                    </div>

                    {/* Requirements */}
                    <div>
                      <label className={`block text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Prerequisites / Requirements</label>
                      {formData.requirements.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 mb-3">
                          <input 
                            type="text" 
                            value={item}
                            onChange={(e) => handleArrayChange('requirements', index, e.target.value)}
                            className={`flex-1 !px-5 !py-2.5 !rounded-full border focus:ring-1 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none transition-all text-sm ${isDarkMode ? 'bg-[#0B1120] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`}
                            placeholder={`Requirement ${index + 1}`}
                          />
                          <button 
                            onClick={() => removeArrayItem('requirements', index)}
                            className={`p-2.5 hover:text-[#E30A17] hover:bg-[#E30A17]/10 rounded-lg transition-colors border border-transparent hover:border-[#E30A17]/20 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => addArrayItem('requirements')}
                        className={`text-sm font-bold flex items-center gap-1.5 transition-colors ${isDarkMode ? 'text-[#00D4FF] hover:text-[#00D4FF]/80' : 'text-[#2563EB] hover:text-[#1D4ED8]'}`}
                      >
                        <PlusCircle className="w-4 h-4" /> Add Requirement
                      </button>
                    </div>
                  </div>

                </div>
              )}

               {/* STEP 3: Curriculum */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className={`course-builder-heading mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Curriculum Builder</h2>
                  <p className={`mb-6 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Organize your course content into phases and video lessons.</p>
                  
                  {phases.length > 0 ? (
                    <div className="space-y-6 mb-8">
                      {phases.map((phase, pIdx) => {
                        const phaseLessons = lessons.filter(l => l.phase === phase);
                        return (
                          <div key={pIdx} className={`border border-[#00D4FF]/20 rounded-2xl overflow-hidden shadow-sm ${isDarkMode ? 'bg-[#0B1120]/30' : 'bg-white'}`}>
                            <div className={`p-4 border-b border-[#00D4FF]/20 flex items-center justify-between ${isDarkMode ? 'bg-[#0B1120]/80' : 'bg-slate-50'}`}>
                              <h3 className="font-bold text-[#00d4ff] text-lg flex items-center gap-2">
                                <LayoutList className="w-5 h-5" /> {phase}
                              </h3>
                              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${isDarkMode ? 'text-slate-400 bg-[#0B1120] border-white/10' : 'text-slate-500 bg-white border-slate-200'}`}>
                                {phaseLessons.length} {phaseLessons.length === 1 ? 'Lesson' : 'Lessons'}
                              </span>
                            </div>
                            
                            <div className={`p-4 space-y-3 ${isDarkMode ? 'bg-[#0B1120]/40' : 'bg-white'}`}>
                              {phaseLessons.length > 0 ? (
                                phaseLessons.map((lesson, idx) => (
                                  <div key={lesson.id || idx} className={`border hover:border-white/20 p-4 rounded-xl flex items-center gap-4 transition-colors ${isDarkMode ? 'bg-[#0B1120]/50 border-white/5' : 'bg-slate-100 border-slate-100'}`}>
                                    <div className="w-8 h-8 rounded-full bg-[#00D4FF]/10 text-[#00D4FF] flex items-center justify-center shrink-0 font-bold border border-[#00D4FF]/20 text-sm">
                                      {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className={`font-bold truncate text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{lesson.title}</h4>
                                    </div>
                                    <div className={`text-xs flex items-center gap-1.5 font-medium shrink-0 px-2.5 py-1.5 rounded-lg border ${isDarkMode ? 'text-slate-300 bg-[#0B1120] border-white/5' : 'text-slate-500 bg-white border-slate-100'}`}>
                                      <PlayCircle className="w-3.5 h-3.5 text-[#00D4FF]" /> {lesson.duration}m
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className={`text-sm text-center py-4 border border-dashed rounded-xl ${isDarkMode ? 'bg-[#0B1120]/50 text-slate-400 border-white/10' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>No lessons in this phase yet.</p>
                              )}
                              
                              {showLessonFormForPhase !== phase && (
                                <button 
                                  onClick={() => setShowLessonFormForPhase(phase)}
                                  className={`w-full py-3 mt-2 border border-dashed rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${isDarkMode ? 'border-[#00D4FF]/30 text-[#00D4FF] hover:bg-[#00D4FF]/10 bg-[#0B1120]/40' : 'border-[#2563EB]/30 text-[#2563EB] hover:bg-[#2563EB]/5 bg-slate-50'}`}
                                >
                                  <PlusCircle className="w-4 h-4" /> Add Lesson to {phase}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`border border-dashed rounded-2xl p-10 text-center mb-6 ${isDarkMode ? 'border-white/20 bg-[#0B1120]/5' : 'border-slate-200 bg-slate-50'}`}>
                      <LayoutList className="w-12 h-12 text-[#00D4FF] mx-auto mb-3 opacity-50" />
                      <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No curriculum phases yet</h3>
                      <p className={`mb-6 text-sm max-w-sm mx-auto ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Start building your curriculum by adding your first phase (e.g., "Phase 1: Foundations").</p>
                    </div>
                  )}

                  {!showPhaseInput ? (
                    <button 
                      onClick={() => setShowPhaseInput(true)}
                      className={`w-full py-4 border border-dashed rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm mt-4 ${isDarkMode ? 'border-[#00D4FF]/50 text-[#00D4FF] hover:bg-[#00D4FF]/10 bg-[#0B1120]' : 'border-[#2563EB]/40 text-[#2563EB] hover:bg-[#2563EB]/5 bg-white'}`}
                    >
                      <PlusCircle className="w-5 h-5" /> Add New Phase
                    </button>
                  ) : null}
                  {createPortal(
                      <PremiumModal isOpen={showPhaseInput} onClose={() => setShowPhaseInput(false)} maxWidth="max-w-lg">
                        <div className="p-6 md:p-8 flex flex-col h-full w-full">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00D4FF]/10 rounded-full blur-3xl pointer-events-none -z-10" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00D4FF]/10 rounded-full blur-3xl pointer-events-none -z-10" />
                            <div className={`flex justify-between items-center mb-6 border-b pb-4 relative z-10 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                          <h3 className={`font-bold text-xl flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            <PlusCircle className="w-6 h-6 text-[#00D4FF]" /> Create New Phase
                          </h3>
                          <button onClick={() => setShowPhaseInput(false)} className={`hover:text-white text-2xl transition-colors leading-none ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>&times;</button>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Phase Name <span className="text-[#E30A17]">*</span></label>
                            <input 
                              type="text" 
                              autoFocus
                              value={newPhaseName}
                              onChange={e => setNewPhaseName(e.target.value)}
                              onKeyDown={(e) => { if(e.key === 'Enter') handleAddPhase(); }}
                              placeholder='e.g., Phase 1: Foundations'
                              className={`w-full !px-5 !py-3 !rounded-full border focus:ring-1 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none ${isDarkMode ? 'bg-[#0B1120] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`}
                            />
                          </div>
                          <div className="flex gap-3 pt-4 mt-4">
                            <button 
                              onClick={() => setShowPhaseInput(false)}
                              className={`flex-1 py-3 px-4 font-bold rounded-lg border hover:bg-white/5/50 hover:text-white transition-colors ${isDarkMode ? 'bg-[#0B1120] text-slate-300 border-white/10' : 'bg-white text-slate-500 border-slate-200'}`}
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={handleAddPhase}
                              disabled={!newPhaseName.trim()}
                              className={`flex-1 py-3 px-4 font-semibold rounded-full hover:shadow-lg hover:shadow-[#00D4FF]/20 border transition-colors disabled:opacity-50 bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border-[#00D4FF] text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                            >
                              Add Phase
                            </button>
                          </div>
                           </div>
                         </div>
                      </PremiumModal>,
                    document.body
                  )}

                  {createPortal(
                      <PremiumModal isOpen={showLessonFormForPhase} onClose={() => setShowLessonFormForPhase(null)} maxWidth="max-w-2xl">
                        <div className="p-6 md:p-8 flex flex-col h-full w-full">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00D4FF]/10 rounded-full blur-3xl pointer-events-none -z-10" />
                          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00D4FF]/10 rounded-full blur-3xl pointer-events-none -z-10" />
                          <div className={`flex justify-between items-center mb-6 border-b pb-4 shrink-0 relative z-10 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                          <h3 className={`font-bold text-xl flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            <PlayCircle className="w-6 h-6 text-[#00D4FF]" /> New Lesson for <span className="text-[#00D4FF] bg-[#00D4FF]/10 border border-[#00D4FF]/20 px-3 py-1 rounded-lg text-sm">{showLessonFormForPhase}</span>
                          </h3>
                          <button onClick={() => setShowLessonFormForPhase(null)} className={`hover:text-white text-2xl transition-colors leading-none ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>&times;</button>
                        </div>
                      <form onSubmit={handleAddLesson} className="space-y-4 overflow-y-auto pr-2 flex-1">
                        <div>
                          <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Lesson Title <span className="text-[#E30A17]">*</span></label>
                          <input 
                            type="text" 
                            required 
                            value={lessonForm.title}
                            onChange={e => setLessonForm({...lessonForm, title: e.target.value})}
                            className={`w-full !px-5 !py-2.5 !rounded-full border focus:ring-1 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none ${isDarkMode ? 'bg-[#0B1120] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Lesson Overview</label>
                          <textarea 
                            value={lessonForm.description}
                            onChange={e => setLessonForm({...lessonForm, description: e.target.value})}
                            className={`w-full !px-5 !py-2.5 !rounded-[32px] border focus:ring-1 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none resize-y ${isDarkMode ? 'bg-[#0B1120] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`}
                            rows="2"
                          ></textarea>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-1">
                            <label className={`block text-sm font-bold mb-1.5 flex items-center justify-between ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              <span>Video URL <span className="text-[#E30A17]">*</span></span>
                            </label>
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                required 
                                value={lessonForm.videoUrl}
                                onChange={e => {
                                  setLessonForm({...lessonForm, videoUrl: e.target.value});
                                  if (e.target.value === '') setLastFetchedDurationUrl('');
                                }}
                                placeholder="Paste YouTube, Vimeo, or Drive URL here..."
                                className={`flex-1 !px-5 !py-2.5 !rounded-full border focus:ring-1 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none min-w-0 ${isDarkMode ? 'bg-[#0B1120] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`}
                              />
                            </div>
                            
                            {/* Hidden ReactPlayer to extract duration automatically */}
                            {lessonForm.videoUrl && lessonForm.videoUrl !== lastFetchedDurationUrl && (
                              <div className="hidden">
                                <ReactPlayer 
                                  url={resolveVideoUrl(lessonForm.videoUrl)} 
                                  onDuration={(d) => {
                                    setLessonForm(prev => ({ ...prev, duration: Math.ceil(d / 60) }));
                                    setLastFetchedDurationUrl(lessonForm.videoUrl);
                                  }}
                                  onError={(e) => console.log('Player hidden duration error: ', e)}
                                />
                              </div>
                            )}
                          </div>
                          
                          <div className="w-full sm:w-[130px] shrink-0">
                            <label className={`block text-sm font-bold mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Duration (min) <span className="text-[#E30A17]">*</span></label>
                            <input 
                              type="number" 
                              required 
                              min="1"
                              value={lessonForm.duration}
                              onChange={e => setLessonForm({...lessonForm, duration: Number(e.target.value)})}
                              className={`w-full !px-5 !py-2.5 !rounded-full border focus:ring-1 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none ${isDarkMode ? 'bg-[#0B1120] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className={`block text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Reading Materials</label>
                            <label 
                              className={`cursor-pointer text-xs font-bold transition-colors flex items-center gap-1 ${dragActive.readingMaterials ? 'text-[#00D4FF]' : `${isDarkMode ? 'text-[#00D4FF] hover:text-white' : 'text-[#2563EB] hover:text-[#1D4ED8]'}`}`}
                              onDragEnter={(e) => handleDrag(e, 'readingMaterials')}
                              onDragLeave={(e) => handleDrag(e, 'readingMaterials')}
                              onDragOver={(e) => handleDrag(e, 'readingMaterials')}
                              onDrop={(e) => handleDrop(e, 'readingMaterials')}
                            >
                              {uploadProgress.readingMaterials ? `Uploading... ${uploadProgress.readingMaterials}%` : 'Upload Document / Drop Here'}
                              <input 
                                type="file" 
                                accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                                className="hidden" 
                                onChange={(e) => handleFileUpload(e, 'readingMaterials')} 
                                disabled={saving}
                              />
                            </label>
                          </div>
                          <textarea 
                            value={lessonForm.readingMaterials}
                            onChange={e => setLessonForm({...lessonForm, readingMaterials: e.target.value})}
                            className={`w-full !px-5 !py-2.5 !rounded-[32px] border focus:ring-1 focus:ring-[#00D4FF] focus:border-[#00D4FF] outline-none min-h-[100px] ${isDarkMode ? 'bg-[#0B1120] text-white border-white/10' : 'bg-white text-slate-900 border-slate-200'}`}
                            placeholder="Add markdown notes, links, or text for students to read. Uploading a document inserts its link here."
                          ></textarea>
                        </div>
                        
                        <div className="mt-4">
                          <QuizBuilder 
                            quiz={lessonForm.quiz} 
                            setQuiz={(newQuiz) => setLessonForm({...lessonForm, quiz: newQuiz})} 
                            title="End of Lesson Mini-Quiz" 
                          />
                        </div>

                        <div className={`flex gap-3 pt-6 mt-4 shrink-0 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                          <button 
                            type="button" 
                            onClick={() => setShowLessonFormForPhase(null)}
                            className={`flex-1 py-3 px-4 font-bold rounded-lg border hover:bg-white/5/50 hover:text-white transition-colors ${isDarkMode ? 'bg-[#0B1120] text-slate-300 border-white/10' : 'bg-white text-slate-500 border-slate-200'}`}
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            disabled={saving}
                            className={`flex-1 py-3 px-4 font-semibold rounded-full hover:shadow-lg hover:shadow-[#00D4FF]/20 border transition-colors disabled:opacity-50 bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border-[#00D4FF] text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                          >
                            Save Lesson
                          </button>
                        </div>
                      </form>
                        </div>
                      </PremiumModal>,
                    document.body
                  )}
                </div>
              )}

              {/* STEP 4: Pricing & Publish */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <h2 className={`course-builder-heading mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pricing & Publishing</h2>
                  <p className={`mb-8 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Set your course value and {isAdmin ? 'publish it immediately' : 'submit it for administrative review'}.</p>
                  
                  <div className={`border !rounded-[32px] p-6 md:p-8 mb-8 backdrop-blur-md ${isDarkMode ? 'bg-[#0B1120]/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className={`w-20 h-20 rounded-full flex gap-1 items-center justify-center shadow-sm shrink-0 border-4 ${isDarkMode ? 'bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20' : 'bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/20'}`}>
                        <Banknote className="w-10 h-10" />
                      </div>
                      <div className="flex-1 w-full text-center sm:text-left">
                        <label className={`block text-sm font-bold mb-2 ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#2563EB]'}`}>Set Course Price (ETB)</label>
                        <div className="relative max-w-xs mx-auto sm:mx-0">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className={`font-bold ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#2563EB]'}`}>Br</span>
                          </div>
                          <input 
                            type="number" 
                            min="0"
                            step="0.01"
                            value={formData.price}
                            onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                            className={`w-full !pl-[60px] pr-4 py-4 text-2xl font-bold !rounded-[32px] border-2 focus:ring-1 outline-none transition-all shadow-inner ${isDarkMode ? 'bg-[#0B1120] text-white border-[#00D4FF]/30 focus:ring-[#00D4FF] focus:border-[#00D4FF]' : 'bg-white text-slate-900 border-[#2563EB]/30 focus:ring-[#2563EB] focus:border-[#2563EB]'}`}
                          />
                        </div>
                        <p className={`mt-3 text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>Set to 0 to make this course free for all students.</p>
                      </div>
                    </div>
                  </div>

                  <div className={`border !rounded-[32px] p-6 mb-8 backdrop-blur-md ${isDarkMode ? 'bg-[#0B1120]/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <h3 className={`font-bold mb-2 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                       <CheckCircle2 className="w-5 h-5 text-[#00D4FF]" /> Final Course Certification Exam
                    </h3>
                    <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`}>You can require a final exam for students to earn their certificate.</p>
                    <label className="flex items-center gap-3 mb-6 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.isExamRequired}
                        onChange={e => setFormData({...formData, isExamRequired: e.target.checked})}
                        className={`w-5 h-5 text-[#00D4FF] border-white/20 rounded focus:ring-[#00D4FF] focus:ring-offset-[#0B1120] ${isDarkMode ? 'bg-[#0B1120]' : 'bg-white'}`}
                      />
                      <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Require Final Exam for Certification</span>
                    </label>

                    {formData.isExamRequired && (
                      <div className="mt-4">
                        <QuizBuilder 
                          quiz={formData.finalExam} 
                          setQuiz={(newQuiz) => setFormData({...formData, finalExam: newQuiz})} 
                          title="Comprehensive Final Exam Questions" 
                        />
                      </div>
                    )}
                  </div>

                  <div className={`border !rounded-[32px] p-6 backdrop-blur-md ${isDarkMode ? 'bg-[#0B1120]/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <h3 className={`font-bold mb-2 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                       <CheckCircle2 className={`w-5 h-5 ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#2563EB]'}`} /> Pre-flight Checklist
                    </h3>
                    <ul className={`space-y-2 text-sm ml-7 list-disc ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      <li>Course title and detailed description are complete.</li>
                      <li>At least one lesson module has been added to the curriculum.</li>
                      <li>Course thumbnail is assigned (or default will be used).</li>
                    </ul>
                  </div>

                </div>
              )}

            </div>
            
            {/* Form Footer / Navigation */}
            <div className={`course-builder-footer ${isDarkMode ? 'dark' : 'light'}`}>
              <button 
                onClick={prevStep}
                disabled={currentStep === 1 || saving}
                className={`w-full sm:w-auto px-6 py-2.5 font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed border text-sm flex items-center gap-2 ${isDarkMode ? 'bg-transparent hover:bg-white/5 border-white/20 text-slate-300' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'}`}
              >
                <ArrowLeft className="w-4 h-4" /> Previous Step
              </button>
              
              <div className="w-full sm:w-auto flex gap-3">
                {currentStep < 4 ? (
                  <button 
                    onClick={nextStep}
                    disabled={saving || (currentStep === 1 && !formData.title)}
                    className={`course-builder-btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'text-white' : ''}`}
                  >
                    Save & Continue <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button 
                    onClick={handleSubmitForReview}
                    disabled={saving || lessons.length === 0}
                    className={`course-builder-btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'text-white' : ''}`}
                  >
                    <Send className="w-4 h-4" /> {isAdmin ? 'Publish Course' : 'Submit for Review'}
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>

          <aside className="hidden lg:flex flex-col gap-6">
            <div className={`course-builder-card ${isDarkMode ? 'dark' : 'light'} sticky top-28 p-6 space-y-5`}>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.32em] ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#2563EB]'}`}>Course overview</p>
                <h3 className={`mt-3 text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Live course status</h3>
              </div>
              <div className={`rounded-3xl border p-4 ${isDarkMode ? 'border-white/10 bg-slate-950/75' : 'border-slate-200 bg-white'} shadow-sm`}>
                <p className="text-sm text-slate-500 dark:text-slate-400">Current Step</p>
                <p className={`mt-2 font-semibold text-lg ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#2563EB]'}`}>{steps[currentStep - 1].title}</p>
              </div>
              <div className={`rounded-3xl border p-4 ${isDarkMode ? 'border-white/10 bg-slate-950/75' : 'border-slate-200 bg-white'} shadow-sm`}>
                <p className="text-sm text-slate-500 dark:text-slate-400">Course summary</p>
                <dl className="mt-4 grid gap-3">
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Title</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">{formData.title || 'Untitled'}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Category</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">{formData.category}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Level</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">{formData.level}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Duration</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">{formData.duration} hr</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-slate-500 dark:text-slate-400">Lessons</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">{lessons.length}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className={`course-builder-card ${isDarkMode ? 'dark' : 'light'} p-6 space-y-4`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-white">Action guide</p>
                <span className={`text-xs font-bold ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#2563EB]'}`}>Tip</span>
              </div>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300 list-disc list-inside">
                <li>Fill title, description and category first.</li>
                <li>Upload a thumbnail and intro video for higher conversions.</li>
                <li>Add at least one lesson before submitting.</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
