import { prisma } from '../lib/prisma.js';
import { normalizeAttendanceDate } from '../lib/modelHelpers.js';
import { publishLearningEvent } from '../src/intelligence/events/learningEventService.js';

export const getCourseAttendance = async (req, res) => {
  try {
    const { sectionId } = req.params;
    
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    
    const userId = req.user.id;
    if (req.user.role !== 'admin' && section.instructorId !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this sections attendance' });
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: { section: section.name, courseId: section.courseId },
      orderBy: { date: 'desc' }
    });

    
    const allUserIds = new Set();
    attendanceRecords.forEach(att => {
        const recs = att.records ? (Array.isArray(att.records) ? att.records : [att.records]) : [];
        recs.forEach(r => { if (r.user) allUserIds.add(r.user); });
    });
    
    const users = await prisma.user.findMany({
        where: { id: { in: Array.from(allUserIds) } },
        select: { id: true, name: true, email: true, avatar: true, role: true }
    });
    
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    const enrichedAttendance = attendanceRecords.map(att => {
        const attObj = { ...att };
        const recs = attObj.records ? (Array.isArray(attObj.records) ? attObj.records : [attObj.records]) : [];
        
        attObj.records = recs.map(r => ({
            ...r,
            user: userMap[r.user] || r.user 
        }));
        return attObj;
    });

    res.status(200).json({ success: true, count: enrichedAttendance.length, data: enrichedAttendance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAllAttendances = async (req, res) => {
  try {
    const userId = req.user.id;
    let whereCondition = {};
    
    // Check if user is instructor, limit to their courses if needed.
    // However, Course relation might be tricky. Let's do it simply.
    if (req.user.role === 'instructor') {
       // Instructor might only see their own sections, but let's fetch based on course's instructor
       const courses = await prisma.course.findMany({ where: { instructorId: userId }, select: { id: true }});
       const courseIds = courses.map(c => c.id);
       whereCondition = { courseId: { in: courseIds } };
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: whereCondition,
      orderBy: { date: 'desc' },
      take: 20
    });

    const allUserIds = new Set();
    attendanceRecords.forEach(att => {
        const recs = att.records ? (Array.isArray(att.records) ? att.records : [att.records]) : [];
        recs.forEach(r => { if (r.user) allUserIds.add(r.user); });
    });
    
    const users = await prisma.user.findMany({
        where: { id: { in: Array.from(allUserIds) } },
        select: { id: true, name: true, email: true, avatar: true, role: true }
    });
    
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    const enrichedAttendance = attendanceRecords.map(att => {
        const attObj = { ...att };
        const recs = attObj.records ? (Array.isArray(attObj.records) ? attObj.records : [attObj.records]) : [];
        
        attObj.records = recs.map(r => ({
            ...r,
            user: userMap[r.user] || r.user 
        }));
        return attObj;
    });

    res.status(200).json({ success: true, count: enrichedAttendance.length, data: enrichedAttendance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAttendanceByQuery = async (req, res) => {
  try {
    const { courseId, section, date } = req.query;
    
    if (!courseId || !section || !date) {
      return res.status(400).json({ success: false, message: 'courseId, section, and date are required parameters' });
    }

    const queryDate = new Date(date);
    const startOfDay = new Date(Date.UTC(queryDate.getUTCFullYear(), queryDate.getUTCMonth(), queryDate.getUTCDate()));

    const attendance = await prisma.attendance.findUnique({
      where: {
          courseId_section_date: {
             courseId,
             section,
             date: startOfDay
          }
      }
    });

    if (!attendance) {
      return res.status(200).json({ success: true, data: null });
    }

    const recs = attendance.records ? (Array.isArray(attendance.records) ? attendance.records : [attendance.records]) : [];
    const userIds = recs.map(r => r.user).filter(Boolean);
    
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, avatar: true, role: true }
    });
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    attendance.records = recs.map(r => ({ ...r, user: userMap[r.user] || r.user }));

    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const submitAttendance = async (req, res) => {
  try {
    const { courseId, section, date, records } = req.body;
    
    if (!courseId || !section || !date || !records) {
      return res.status(400).json({ success: false, message: 'Please provide courseId, section, date, and records' });
    }

    const courseObj = await prisma.course.findUnique({ where: { id: courseId } });
    if (!courseObj) return res.status(404).json({ success: false, message: 'Course not found' });

    const formattedRecords = records.map(r => ({
      user: r.userId,
      role: r.role,
      status: r.status.toLowerCase()
    }));

    const queryDate = new Date(date);
    const startOfDay = new Date(Date.UTC(queryDate.getUTCFullYear(), queryDate.getUTCMonth(), queryDate.getUTCDate()));

    const attendance = await prisma.attendance.upsert({
      where: {
          courseId_section_date: {
             courseId,
             section,
             date: startOfDay
          }
      },
      update: {
          records: formattedRecords
      },
      create: {
          courseId,
          section,
          date: startOfDay,
          records: formattedRecords
      }
    });

    // Fire-and-forget: publish ATTENDANCE_MARKED events asynchronously
    formattedRecords.forEach(r => {
      if (r.user) {
        publishLearningEvent({
          userId: r.user,
          eventType: 'ATTENDANCE_MARKED',
          courseId,
          metadata: { status: r.status, section, date: startOfDay }
        }).catch(() => {});
      }
    });

    res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const submitSelfAttendance = async (req, res) => {
  try {
    const { courseId } = req.body;
    let { section } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (!courseId) {
      return res.status(400).json({ success: false, message: 'Please provide courseId' });
    }

    if (!section) {
       const sectionDoc = await prisma.section.findFirst({
           where: {
               courseId: courseId,
               students: { some: { id: userId } }
           }
       });
       if (sectionDoc) {
           section = sectionDoc.name;
       } else {
           section = "Main Section";
       }
    }

    const queryDate = new Date();
    const startOfDay = new Date(Date.UTC(queryDate.getUTCFullYear(), queryDate.getUTCMonth(), queryDate.getUTCDate()));

    let attendance = await prisma.attendance.findUnique({
      where: {
          courseId_section_date: {
             courseId,
             section,
             date: startOfDay
          }
      }
    });

    let records = [];
    if (attendance && attendance.records) {
       records = Array.isArray(attendance.records) ? attendance.records : [attendance.records];
    }

    const existingIndex = records.findIndex(r => r.user === userId);
    
    if (existingIndex !== -1) {
       return res.status(200).json({ success: true, message: 'Attendance already marked for today', data: attendance });
    }

    records.push({
       user: userId,
       role: role,
       status: 'present'
    });

    attendance = await prisma.attendance.upsert({
      where: {
          courseId_section_date: {
             courseId,
             section,
             date: startOfDay
          }
      },
      update: {
          records: records
      },
      create: {
          courseId,
          section,
          date: startOfDay,
          records: records
      }
    });

    // Fire-and-forget: emit ATTENDANCE_MARKED to learning event pipeline
    publishLearningEvent({
      userId,
      eventType: 'ATTENDANCE_MARKED',
      courseId,
      metadata: { section, status: 'present' }
    }).catch(() => {});

    res.status(200).json({ success: true, message: 'Attendance marked successfully', data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getEnrolledUsers = async (req, res) => {
  try {
    const { courseId, section } = req.query;

    if (!courseId || !section) {
      return res.status(400).json({ success: false, message: 'courseId and section are required parameters' });
    }

    const sectionDocs = await prisma.section.findMany({
        where: { courseId, name: section },
        include: {
            instructor: { select: { id: true, name: true, email: true, avatar: true, role: true } },
            students: { select: { id: true, name: true, email: true, avatar: true, role: true } }
        }
    });
    
    const sectionDoc = sectionDocs.length > 0 ? sectionDocs[0] : null;

    if (!sectionDoc) {
      return res.status(404).json({ success: false, message: 'Section not found for this course' });
    }

    const students = [];
    const instructors = [];

    if (sectionDoc.instructor) {
      instructors.push({
        userId: sectionDoc.instructor.id,
        name: sectionDoc.instructor.name,
        role: 'instructor'
      });
    }

    if (sectionDoc.students && sectionDoc.students.length > 0) {
      sectionDoc.students.forEach(student => {
        students.push({
          userId: student.id,
          name: student.name,
          role: 'student'
        });
      });
    }

    res.status(200).json({
      students,
      instructors
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDashboardAggregate = async (req, res) => {
  try {
    const userId = req.user.id;
    let whereCondition = {};
    
    if (req.user.role === 'instructor') {
       whereCondition = { course: { instructorId: userId } };
    }

    const attendances = await prisma.attendance.findMany({
        where: whereCondition,
        select: { records: true, date: true, section: true }
    });

    let present = 0;
    let absent = 0;
    let late = 0;
    const monthlyTrends = {};
    const weeklyTrends = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 };
    const lowAttendanceAlerts = [];

    const studentStats = {};

    attendances.forEach(att => {
        const month = att.date.toISOString().substring(0, 7); // YYYY-MM
        if (!monthlyTrends[month]) monthlyTrends[month] = { present: 0, absent: 0, late: 0 };
        
        const day = att.date.getDay(); // 0 = Sun, 1 = Mon, etc
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = days[day];

        const recs = att.records ? (Array.isArray(att.records) ? att.records : [att.records]) : [];
        recs.forEach(r => {
            if (!r || !r.status) return;
            const s = r.status.toLowerCase();
            const studentId = r.user;

            if (!studentStats[studentId]) studentStats[studentId] = { present: 0, total: 0, role: r.role };
            if (r.role === 'student') studentStats[studentId].total++;

            if (s === 'present') {
              present++;
              monthlyTrends[month].present++;
              if (day >= 1 && day <= 5) weeklyTrends[dayName]++;
              if (r.role === 'student') studentStats[studentId].present++;
            }
            else if (s === 'absent') {
              absent++;
              monthlyTrends[month].absent++;
            }
            else if (s === 'late') {
              late++;
              monthlyTrends[month].late++;
              if (day >= 1 && day <= 5) weeklyTrends[dayName]++;
              if (r.role === 'student') studentStats[studentId].present++; // Count late as present for %
            }
        });
    });

    // Calculate low attendance warnings
    for (const [studentId, stats] of Object.entries(studentStats)) {
      if (stats.role === 'student' && stats.total >= 3) {
        const percentage = (stats.present / stats.total) * 100;
        if (percentage < 75) {
          lowAttendanceAlerts.push({ studentId, percentage: Math.round(percentage) });
        }
      }
    }

    const total = present + absent + late;
    
    if (total === 0) {
      return res.status(200).json({ 
        success: true, 
        data: [
          { name: 'Present', value: 80, color: '#00D4FF' },
          { name: 'Absent', value: 20, color: '#E30A17' }
        ],
        raw: { present: 0, late: 0, absent: 0, total: 0 },
        analytics: {
          monthlyTrends: {},
          weeklyTrends: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 },
          lowAttendanceAlerts: []
        }
      });
    }

    res.status(200).json({
      success: true,
      data: [
         { name: 'Present', value: present, color: '#00D4FF' },
         { name: 'Late', value: late, color: '#F97316' },
         { name: 'Absent', value: absent, color: '#E30A17' }
      ],
      raw: { present, late, absent, total },
      analytics: {
        monthlyTrends,
        weeklyTrends,
        lowAttendanceAlerts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const submitFinalReport = async (req, res) => {
  try {
    const { courseId, term, section, studentRecords } = req.body;
    const userId = req.user.id;
    
    const courseObj = await prisma.course.findUnique({ where: { id: courseId } });
    if (!courseObj) return res.status(404).json({ success: false, message: 'Course not found' });

    if (req.user.role !== 'admin' && courseObj.instructorId !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to submit report for this course' });
    }

    const instructorIdToUse = req.user.role === 'admin' ? courseObj.instructorId : userId;
    const reportTerm = term || 'Fall Term';
    const reportSection = section || 'Main Section';
    
    const recordsPayload = {
      create: studentRecords.map(r => ({
        studentId: r.student || r.studentId,
        attendancePercentage: r.attendancePercentage || 0,
        finalGrade: r.finalGrade || 'Pending',
        remarks: r.remarks || ''
      }))
    };

    const existingReport = await prisma.courseReport.findFirst({
        where: {
            courseId,
            instructorId: instructorIdToUse,
            term: reportTerm,
            section: reportSection
        }
    });

    let report;
    if (existingReport) {
        await prisma.courseReportRecord.deleteMany({ where: { courseReportId: existingReport.id } });
        report = await prisma.courseReport.update({
            where: { id: existingReport.id },
            data: {
                status: 'submitted',
                records: recordsPayload
            },
            include: { records: true }
        });
    } else {
        report = await prisma.courseReport.create({
            data: {
                courseId,
                instructorId: instructorIdToUse,
                term: reportTerm,
                section: reportSection,
                status: 'submitted',
                records: recordsPayload
            },
            include: { records: true }
        });
    }

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getFinalReports = async (req, res) => {
  try {
    const userId = req.user.id;
    let whereCondition = {};
    if (req.user.role === 'instructor') {
       whereCondition = { instructorId: userId };
    } else if (req.user.role === 'student') {
       whereCondition = { records: { some: { studentId: userId } } };
    }
    
    const reports = await prisma.courseReport.findMany({
      where: whereCondition,
      include: {
        course: { select: { title: true, mainCategory: true } },
        instructor: { select: { name: true, email: true } },
        records: {
            include: { student: { select: { name: true, email: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const mappedReports = reports.map(rep => ({
        ...rep,
        studentRecords: rep.records.map(rec => ({
            ...rec,
            student: rec.student
        }))
    }));

    res.status(200).json({ success: true, count: mappedReports.length, data: mappedReports });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
