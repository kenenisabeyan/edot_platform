import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { User, Mail, Phone, MapPin, Save, AlertCircle, CircleCheck, Camera, Loader2, Briefcase, Calendar, ShieldCheck, Link as LinkIcon, HeartHandshake, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import CustomDropdown from '../components/CustomDropdown';
import useThemeMode from '../hooks/useThemeMode';
import SkillGraph from '../components/SkillGraph';

export default function ProfileView() {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    bio: '',
    avatar: '',
    coverPhoto: '',
    gender: '',
    dateOfBirth: '',
    address: '',
    emergencyContact: '',
    department: '',
    specialization: '',
    occupation: ''
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const isDarkMode = useThemeMode();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get('/users/profile');
        if (data.success && data.user) {
          setProfileData(data.user);
          setFormData({
            name: data.user.name || '',
            email: data.user.email || '',
            phone: data.user.phone || '',
            bio: data.user.bio || '',
            avatar: data.user.avatar || '',
            coverPhoto: data.user.coverPhoto || '',
            gender: data.user.gender || '',
            dateOfBirth: data.user.dateOfBirth || '',
            address: data.user.address || '',
            emergencyContact: data.user.emergencyContact || '',
            department: data.user.department || '',
            specialization: data.user.specialization || '',
            occupation: data.user.occupation || ''
          });
        }
      } catch (err) {
        console.error('Failed to fetch profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    const imageData = new FormData();
    imageData.append('image', file);

    setUploadingImage(true);
    setError('');
    
    try {
      const { data } = await api.post('/upload', imageData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        setFormData((prev) => ({ ...prev, [field]: data.filePath }));
        setMessage(`${field === 'avatar' ? 'Profile picture' : 'Cover photo'} uploaded successfully! Remember to save.`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setMessage('');
    setError('');

    const phoneRegex = /^(\+251|0)9\d{8}$/;
    if (formData.phone && !phoneRegex.test(formData.phone)) {
       setError('Please enter a valid Ethiopian phone number (e.g., +2519... or 09...)');
       setUpdating(false);
       return;
    }

    try {
      const { data } = await api.put('/users/profile', {
        name: formData.name,
        bio: formData.bio,
        phone: formData.phone,
        avatar: formData.avatar,
        coverPhoto: formData.coverPhoto,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        address: formData.address,
        emergencyContact: formData.emergencyContact,
        department: formData.department,
        specialization: formData.specialization,
        occupation: formData.occupation
      });
      if (data.success) {
        setMessage('Profile updated successfully!');
        if (data.user) {
          updateUser(data.user);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className={`w-10 h-10 border-4 border-t-[#00D4FF] rounded-full animate-spin ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}></div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in max-w-3xl mx-auto space-y-6">
      <div className="flex justify-center items-center text-center pb-2">
        <div>
          <h1 className={`text-3xl font-display font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>My Portfolio</h1>
          <p className="text-[#00D4FF] text-xs font-bold mt-2">Manage your professional identity and platform presence</p>
        </div>
      </div>

      <div className={`backdrop-blur-xl rounded-3xl border shadow-2xl overflow-hidden ${isDarkMode ? 'bg-[#0B1120]/90 border-white/10' : 'bg-white/95 border-slate-200'}`}>
        <div 
          className={`h-48 border-b relative group ${isDarkMode ? 'bg-gradient-to-tr from-[#0B1120] to-[#00D4FF]/20 border-white/10' : 'bg-gradient-to-tr from-slate-100 to-slate-200 border-slate-200'}`}
          style={{ 
            backgroundImage: formData.coverPhoto ? `url(${formData.coverPhoto.startsWith('http') ? formData.coverPhoto : `http://localhost:5000${formData.coverPhoto}`})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <label htmlFor="cover-upload" className={`absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 p-2 rounded-full cursor-pointer transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center backdrop-blur-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <Camera className="w-5 h-5" />
            <input 
              id="cover-upload" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => handleImageUpload(e, 'coverPhoto')}
              disabled={uploadingImage}
            />
          </label>
        </div>
        <div className="px-8 pb-8 relative">
           
           <div className={`absolute -top-20 border-4 rounded-full w-36 h-36 flex items-center justify-center overflow-hidden group shadow-[0_0_20px_rgba(255,215,0,0.2)] ${isDarkMode ? 'border-[#0B1120] bg-[#0B1120]' : 'border-white bg-slate-100'}`}>
              {formData.avatar && formData.avatar !== 'default-avatar.png' ? (
                <img src={formData.avatar.startsWith('http') ? formData.avatar : `http://localhost:5000${formData.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className={`w-16 h-16 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
              )}
              
              <label htmlFor="avatar-upload" className={`absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-all backdrop-blur-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {uploadingImage ? <Loader2 className="w-6 h-6 animate-spin text-[#00D4FF]" /> : <Camera className="w-6 h-6 text-[#00D4FF]" />}
                <input 
                  id="avatar-upload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => handleImageUpload(e, 'avatar')}
                  disabled={uploadingImage}
                />
              </label>
           </div>

           <div className="pt-20">
             {message && <div className="mb-6 p-4 bg-[#00D4FF]/10 text-[#00D4FF] rounded-xl text-sm font-bold border border-[#00D4FF]/20 flex items-center gap-2 shadow-sm"><CircleCheck className="w-4 h-4" /> {message}</div>}
             {error && <div className="mb-6 p-4 bg-[#E30A17]/10 text-[#E30A17] rounded-xl text-sm font-bold border border-[#E30A17]/20 flex items-center gap-2 shadow-sm"><AlertCircle className="w-4 h-4" /> {error}</div>}

             <div className={`mb-8 p-6 rounded-[24px] border shadow-md flex flex-col md:flex-row items-center gap-6 ${isDarkMode ? 'bg-gradient-to-r from-[#0B1120] to-[#00D4FF]/10 border-white/10' : 'bg-gradient-to-r from-slate-50 to-[#00D4FF]/5 border-[#00D4FF]/20'}`}>
               <div className="p-3 bg-white rounded-2xl shadow-sm shrink-0 hover:scale-105 transition-transform duration-300">
                  <QRCodeSVG 
                    value={JSON.stringify({ userId: user?.id, email: user?.email, role: user?.role, type: 'digital_id' })} 
                    size={110}
                    bgColor={"#ffffff"}
                    fgColor={"#0f172a"}
                    level={"Q"}
                  />
               </div>
               <div className="flex-1 text-center md:text-left">
                  <h3 className={`text-xl font-bold flex items-center justify-center md:justify-start gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    <QrCode className="w-5 h-5 text-[#00D4FF]" /> Digital ID Card
                  </h3>
                  <p className={`text-sm mt-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Use this secure QR code for fast attendance scanning, secure campus entry, and identity verification.
                  </p>
                  <p className="text-xs font-mono mt-3 text-[#00D4FF] bg-[#00D4FF]/10 px-3 py-1.5 rounded-full inline-block border border-[#00D4FF]/20 font-bold">ID: {user?.id?.substring(0,8).toUpperCase()}</p>
               </div>
             </div>

             <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-2">
                  <label className={`text-xs font-black ${isDarkMode ? 'text-[#00D4FF]' : 'text-slate-700'}`}>Full Name</label>
                  <div className={`relative border !rounded-full overflow-hidden focus-within:ring-1 transition-all ${isDarkMode ? 'border-white/10 focus-within:border-[#00D4FF]/50 focus-within:ring-[#00D4FF]/50' : 'border-slate-300 focus-within:border-indigo-500 focus-within:ring-indigo-500'}`}>
                    <User className={`absolute left-4 top-3.5 w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                    <input 
                      type="text" 
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`w-full !pl-[3.25rem] !pr-5 !py-3 font-medium outline-none placeholder:text-slate-300 ${isDarkMode ? 'bg-[#0B1120] text-white' : 'bg-white text-slate-900'}`} 
                      required 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={`text-xs font-black ${isDarkMode ? 'text-[#00D4FF]' : 'text-slate-700'}`}>Email Address</label>
                  <div className={`relative border !rounded-full overflow-hidden opacity-50 ${isDarkMode ? 'border-white/5 bg-transparent text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                    <Mail className={`absolute left-4 top-3.5 w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                    <input 
                      type="email" 
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled
                      className="w-full !pl-[3.25rem] !pr-5 !py-3 bg-transparent font-medium cursor-not-allowed outline-none" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={`text-xs font-black ${isDarkMode ? 'text-[#00D4FF]' : 'text-slate-700'}`}>Phone Number</label>
                  <div className={`relative border !rounded-full overflow-hidden focus-within:ring-1 transition-all ${isDarkMode ? 'border-white/10 focus-within:border-[#00D4FF]/50 focus-within:ring-[#00D4FF]/50' : 'border-slate-300 focus-within:border-indigo-500 focus-within:ring-indigo-500'}`}>
                    <Phone className={`absolute left-4 top-3.5 w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                    <input 
                      type="tel" 
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+251 9XX XXX XXX"
                      className={`w-full !pl-[3.25rem] !pr-5 !py-3 font-medium outline-none placeholder:text-slate-300 ${isDarkMode ? 'bg-[#0B1120] text-white' : 'bg-white text-slate-900'}`} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={`text-xs font-black ${isDarkMode ? 'text-[#00D4FF]' : 'text-slate-700'}`}>Gender</label>
                  <div className={`relative border !rounded-full overflow-hidden focus-within:ring-1 transition-all ${isDarkMode ? 'border-white/10 focus-within:border-[#00D4FF]/50 focus-within:ring-[#00D4FF]/50' : 'border-slate-300 focus-within:border-indigo-500 focus-within:ring-indigo-500'}`}>
                    <User className={`absolute left-4 top-3.5 w-5 h-5 z-10 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                    <CustomDropdown 
                      value={formData.gender}
                      onChange={(val) => setFormData({ ...formData, gender: val })}
                      placeholder="Select Gender"
                      options={[
                        { label: 'Male', value: 'Male' },
                        { label: 'Female', value: 'Female' },
                        { label: 'Other', value: 'Other' },
                        { label: 'Prefer not to say', value: 'Prefer not to say' }
                      ]}
                      className={`w-full [&>button]:pl-12 [&>button]:py-3 [&>button]:border-none [&>button]:font-medium ${isDarkMode ? '[&>button]:bg-[#0B1120] [&>button]:text-white' : '[&>button]:bg-white [&>button]:text-slate-900'}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={`text-xs font-black ${isDarkMode ? 'text-[#00D4FF]' : 'text-slate-700'}`}>Date of Birth</label>
                  <div className={`relative border !rounded-full overflow-hidden focus-within:ring-1 transition-all ${isDarkMode ? 'border-white/10 focus-within:border-[#00D4FF]/50 focus-within:ring-[#00D4FF]/50' : 'border-slate-300 focus-within:border-indigo-500 focus-within:ring-indigo-500'}`}>
                    <Calendar className={`absolute left-4 top-3.5 w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                    <input 
                      type="date" 
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      className={`w-full !pl-[3.25rem] !pr-5 !py-3 font-medium outline-none ${isDarkMode ? 'bg-[#0B1120] text-white color-scheme-dark' : 'bg-white text-slate-900'}`} 
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className={`text-xs font-black ${isDarkMode ? 'text-[#00D4FF]' : 'text-slate-700'}`}>Address</label>
                  <div className={`relative border !rounded-full overflow-hidden focus-within:ring-1 transition-all ${isDarkMode ? 'border-white/10 focus-within:border-[#00D4FF]/50 focus-within:ring-[#00D4FF]/50' : 'border-slate-300 focus-within:border-indigo-500 focus-within:ring-indigo-500'}`}>
                    <MapPin className={`absolute left-4 top-3.5 w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                    <input 
                      type="text" 
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="e.g. Bole, Addis Ababa"
                      className={`w-full !pl-[3.25rem] !pr-5 !py-3 font-medium outline-none placeholder:text-slate-300 ${isDarkMode ? 'bg-[#0B1120] text-white' : 'bg-white text-slate-900'}`} 
                    />
                  </div>
                </div>

                {user?.role === 'student' && (
                  <div className="space-y-2 md:col-span-2">
                    <label className={`text-xs font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Emergency Contact</label>
                    <div className={`relative border !rounded-full overflow-hidden focus-within:ring-1 transition-all ${isDarkMode ? 'border-white/10 focus-within:border-emerald-500/50 focus-within:ring-emerald-500/50' : 'border-slate-300 focus-within:border-emerald-500 focus-within:ring-emerald-500'}`}>
                      <Phone className={`absolute left-4 top-3.5 w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                      <input 
                        type="text" 
                        name="emergencyContact"
                        value={formData.emergencyContact}
                        onChange={handleChange}
                        placeholder="Name and Phone number"
                        className={`w-full !pl-[3.25rem] !pr-5 !py-3 font-medium outline-none placeholder:text-slate-300 ${isDarkMode ? 'bg-[#0B1120] text-white' : 'bg-white text-slate-900'}`} 
                      />
                    </div>
                  </div>
                )}

                {(user?.role === 'instructor' || user?.role === 'admin') && (
                  <div className="space-y-2">
                    <label className={`text-xs font-black ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#D35400]'}`}>Department</label>
                    <div className={`relative border !rounded-full overflow-hidden focus-within:ring-1 transition-all ${isDarkMode ? 'border-white/10 focus-within:border-[#00D4FF]/50 focus-within:ring-[#00D4FF]/50' : 'border-slate-300 focus-within:border-[#D35400] focus-within:ring-[#D35400]'}`}>
                      <Briefcase className={`absolute left-4 top-3.5 w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                      <input 
                        type="text" 
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        placeholder="e.g. Computer Science"
                        className={`w-full !pl-[3.25rem] !pr-5 !py-3 font-medium outline-none placeholder:text-slate-300 ${isDarkMode ? 'bg-[#0B1120] text-white' : 'bg-white text-slate-900'}`} 
                      />
                    </div>
                  </div>
                )}

                {user?.role === 'instructor' && (
                  <div className="space-y-2">
                    <label className={`text-xs font-black ${isDarkMode ? 'text-[#00D4FF]' : 'text-[#D35400]'}`}>Specialization</label>
                    <div className={`relative border !rounded-full overflow-hidden focus-within:ring-1 transition-all ${isDarkMode ? 'border-white/10 focus-within:border-[#00D4FF]/50 focus-within:ring-[#00D4FF]/50' : 'border-slate-300 focus-within:border-[#D35400] focus-within:ring-[#D35400]'}`}>
                      <Briefcase className={`absolute left-4 top-3.5 w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                      <input 
                        type="text" 
                        name="specialization"
                        value={formData.specialization}
                        onChange={handleChange}
                        placeholder="e.g. Web Development"
                        className={`w-full !pl-[3.25rem] !pr-5 !py-3 font-medium outline-none placeholder:text-slate-300 ${isDarkMode ? 'bg-[#0B1120] text-white' : 'bg-white text-slate-900'}`} 
                      />
                    </div>
                  </div>
                )}

                {user?.role === 'parent' && (
                  <div className="space-y-2 md:col-span-2">
                    <label className={`text-xs font-black ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>Occupation</label>
                    <div className={`relative border !rounded-full overflow-hidden focus-within:ring-1 transition-all ${isDarkMode ? 'border-white/10 focus-within:border-purple-500/50 focus-within:ring-purple-500/50' : 'border-slate-300 focus-within:border-purple-500 focus-within:ring-purple-500'}`}>
                      <Briefcase className={`absolute left-4 top-3.5 w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                      <input 
                        type="text" 
                        name="occupation"
                        value={formData.occupation}
                        onChange={handleChange}
                        placeholder="e.g. Engineer"
                        className={`w-full !pl-[3.25rem] !pr-5 !py-3 font-medium outline-none placeholder:text-slate-300 ${isDarkMode ? 'bg-[#0B1120] text-white' : 'bg-white text-slate-900'}`} 
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <label className={`text-xs font-black ${isDarkMode ? 'text-[#00D4FF]' : 'text-slate-700'}`}>Bio</label>
                  <textarea 
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows="4" 
                    placeholder="Tell us a little about yourself"
                    className={`w-full !px-6 py-5 border !rounded-[32px] outline-none focus:ring-1 font-medium resize-none placeholder:text-slate-300 transition-all ${isDarkMode ? 'bg-[#0B1120] border-white/10 text-white focus:border-[#00D4FF]/50 focus:ring-[#00D4FF]/50' : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500'}`}
                  ></textarea>
                </div>

                <div className="md:col-span-2 flex justify-end mt-4">
                   <button 
                     type="submit" 
                     disabled={updating}
                     className={`flex items-center gap-2 px-8 py-3.5 font-semibold text-sm rounded-full hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 bg-[#00D4FF] hover:bg-[#00A3CC] shadow-md border border-[#00D4FF] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                   >
                     <Save className="w-4 h-4" />
                     {updating ? 'Committing...' : 'Commit Changes'}
                   </button>
                </div>

             </form>

             {/* Secure Connections Section */}
             {profileData && (user?.role === 'student' || user?.role === 'parent' || user?.role === 'sponsor' || profileData.sponsorships?.length > 0 || profileData.sponsoredStudents?.length > 0 || profileData.parents?.length > 0 || profileData.children?.length > 0) && (
               <div className={`mt-10 pt-8 border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                 <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        <ShieldCheck className="w-5 h-5 text-emerald-500" /> Secure Connections
                      </h3>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Verified relationships and support links</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {/* Student seeing their Parents */}
                   {user?.role === 'student' && profileData.parents && profileData.parents.length > 0 && (
                     <div className={`p-5 rounded-[24px] border shadow-sm ${isDarkMode ? 'bg-[#0B1120] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                       <h4 className={`text-sm font-bold flex items-center gap-2 mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                         <LinkIcon className="w-4 h-4 text-purple-500" /> Linked Guardians
                       </h4>
                       <div className="space-y-3">
                         {profileData.parents.map(parent => (
                           <div key={parent.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white'}`}>
                             <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm shrink-0">
                               {parent.name.charAt(0).toUpperCase()}
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{parent.name}</p>
                               <p className={`text-[11px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{parent.email}</p>
                             </div>
                             <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">Verified</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {/* Parent seeing their Children */}
                   {user?.role === 'parent' && profileData.children && profileData.children.length > 0 && (
                     <div className={`p-5 rounded-[24px] border shadow-sm ${isDarkMode ? 'bg-[#0B1120] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                       <h4 className={`text-sm font-bold flex items-center gap-2 mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                         <LinkIcon className="w-4 h-4 text-purple-500" /> Supported Students
                       </h4>
                       <div className="space-y-3">
                         {profileData.children.map(child => (
                           <div key={child.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white'}`}>
                             <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                               {child.name.charAt(0).toUpperCase()}
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{child.name}</p>
                               <p className={`text-[11px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{child.email}</p>
                             </div>
                             <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">Verified</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {/* Student seeing their Sponsors */}
                   {profileData.sponsorships && profileData.sponsorships.length > 0 && (
                     <div className={`p-5 rounded-[24px] border shadow-sm ${isDarkMode ? 'bg-[#0B1120] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                       <h4 className={`text-sm font-bold flex items-center gap-2 mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                         <HeartHandshake className="w-4 h-4 text-rose-500" /> Active Sponsors
                       </h4>
                       <div className="space-y-3">
                         {profileData.sponsorships.map(sponsorLink => sponsorLink.sponsor && (
                           <div key={sponsorLink.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white'}`}>
                             <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0">
                               {sponsorLink.sponsor.name.charAt(0).toUpperCase()}
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{sponsorLink.sponsor.name}</p>
                               <p className={`text-[11px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{sponsorLink.sponsor.email}</p>
                             </div>
                             <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">Active</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {/* Sponsor seeing their Supported Students */}
                   {profileData.sponsoredStudents && profileData.sponsoredStudents.length > 0 && (
                     <div className={`p-5 rounded-[24px] border shadow-sm ${isDarkMode ? 'bg-[#0B1120] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                       <h4 className={`text-sm font-bold flex items-center gap-2 mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                         <HeartHandshake className="w-4 h-4 text-rose-500" /> Sponsored Students
                       </h4>
                       <div className="space-y-3">
                         {profileData.sponsoredStudents.map(sponsorLink => sponsorLink.targetStudent && (
                           <div key={sponsorLink.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white'}`}>
                             <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center font-bold text-sm shrink-0">
                               {sponsorLink.targetStudent.name.charAt(0).toUpperCase()}
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{sponsorLink.targetStudent.name}</p>
                               <p className={`text-[11px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{sponsorLink.targetStudent.email}</p>
                             </div>
                             <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">Active</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
               </div>
             )}

             {/* AI Intelligence Skill Graph */}
             <div className="mt-8">
               <SkillGraph isDarkMode={isDarkMode} />
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
