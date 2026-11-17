import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { exportAllotmentToWord } from '../utils/allotmentWordExport';
import {
  FileSpreadsheet,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  UploadCloud,
  Loader2,
  Users,
  ChevronDown,
  Layers,
  Settings,
  HelpCircle
} from 'lucide-react';

export default function AdminAllotmentManager({ facultyList = [], semestersList = [] }) {
  const { activeDepartment } = useAuth();
  const { addToast } = useToast();

  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessionDetails, setSessionDetails] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [newSessionModalOpen, setNewSessionModalOpen] = useState(false);
  const [newSessionForm, setNewSessionForm] = useState({
    academic_year: '2026-27',
    semester_type: 'ODD',
    title: 'Subject Allotment / Course Preferences',
    instructions: 'Please select your 1st and 2nd choices for Theory & Lab courses.',
    copy_from_existing: true
  });

  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({
    semester_name: 'III Semester',
    course_name: '',
    course_code: '',
    lecture_hours: 3,
    tutorial_hours: 0,
    practical_hours: 0,
    credits: 3,
    is_lab: false
  });

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Fetch all sessions for active department
  const fetchSessions = async (preferSessionId = null) => {
    if (!activeDepartment?.id) return;
    try {
      const data = await api.getAllotmentSessions({ department_id: activeDepartment.id });
      setSessions(data || []);
      if (data && data.length > 0) {
        const targetId = preferSessionId || selectedSessionId || String(data[0].id);
        setSelectedSessionId(String(targetId));
        await fetchSessionDetails(targetId);
      } else {
        setSelectedSessionId('');
        setSessionDetails(null);
        setCourses([]);
      }
    } catch (err) {
      addToast(err.message || 'Failed to load allotment sessions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionDetails = async (sessionId) => {
    if (!sessionId) return;
    try {
      const data = await api.getAllotmentSessionDetails(sessionId);
      setSessionDetails(data.session);
      setCourses(data.courses || []);
    } catch (err) {
      addToast(err.message || 'Failed to load session details', 'error');
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [activeDepartment?.id]);

  const handleSessionChange = (e) => {
    const id = e.target.value;
    setSelectedSessionId(id);
    fetchSessionDetails(id);
  };

  // Create new session
  const handleCreateSession = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const newSession = await api.createAllotmentSession({
        department_id: activeDepartment.id,
        ...newSessionForm
      });
      addToast('Allotment session created successfully!', 'success');
      setNewSessionModalOpen(false);
      await fetchSessions(newSession.id);
    } catch (err) {
      addToast(err.message || 'Failed to create allotment session', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Status transition
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedSessionId) return;
    setActionLoading(true);
    try {
      const updated = await api.updateAllotmentSessionStatus(selectedSessionId, { status: newStatus });
      setSessionDetails(prev => ({ ...prev, status: updated.status }));
      addToast(`Cycle status changed to ${newStatus.toUpperCase()}`, 'success');
      await fetchSessions(selectedSessionId);
    } catch (err) {
      addToast(err.message || 'Failed to update cycle status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Course Add/Edit
  const handleOpenCourseModal = (course = null) => {
    if (course) {
      setEditingCourse(course);
      setCourseForm({
        semester_name: course.semester_name || 'III Semester',
        course_name: course.course_name,
        course_code: course.course_code,
        lecture_hours: course.lecture_hours || 0,
        tutorial_hours: course.tutorial_hours || 0,
        practical_hours: course.practical_hours || 0,
        credits: course.credits || 0,
        is_lab: Boolean(course.is_lab)
      });
    } else {
      setEditingCourse(null);
      setCourseForm({
        semester_name: 'III Semester',
        course_name: '',
        course_code: '',
        lecture_hours: 3,
        tutorial_hours: 0,
        practical_hours: 0,
        credits: 3,
        is_lab: false
      });
    }
    setCourseModalOpen(true);
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    if (!selectedSessionId) return;
    setActionLoading(true);
    try {
      if (editingCourse) {
        await api.updateAllotmentCourse(editingCourse.id, courseForm);
        addToast('Course updated successfully', 'success');
      } else {
        await api.addAllotmentCourse({
          session_id: selectedSessionId,
          ...courseForm
        });
        addToast('Course added to allotment sheet', 'success');
      }
      setCourseModalOpen(false);
      await fetchSessionDetails(selectedSessionId);
    } catch (err) {
      addToast(err.message || 'Failed to save course', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course from the allotment cycle?')) return;
    try {
      await api.deleteAllotmentCourse(courseId);
      addToast('Course removed', 'info');
      await fetchSessionDetails(selectedSessionId);
    } catch (err) {
      addToast(err.message || 'Failed to delete course', 'error');
    }
  };

  // Allot faculty to course
  const handleAllotFaculty = async (courseId, facultyId) => {
    try {
      if (!facultyId || facultyId === 'CLEAR') {
        await api.allotCourseFaculty(courseId, { is_deallot: true });
        addToast('Course allotment cleared', 'info');
      } else {
        await api.allotCourseFaculty(courseId, { faculty_id: parseInt(facultyId, 10) });
        const fac = facultyList.find(f => String(f.id) === String(facultyId));
        addToast(`Course allotted to ${fac ? fac.name : 'Faculty'}`, 'success');
      }
      await fetchSessionDetails(selectedSessionId);
    } catch (err) {
      addToast(err.message || 'Failed to allot faculty', 'error');
    }
  };

  // Sync to Master Data
  const handleSyncToMasterData = async () => {
    if (!selectedSessionId) return;
    setSyncing(true);
    try {
      const res = await api.syncAllotmentToMasterData(selectedSessionId);
      addToast(res.message || 'Successfully synced subjects to Master Data!', 'success');
      setSyncModalOpen(false);
      await fetchSessionDetails(selectedSessionId);
    } catch (err) {
      addToast(err.message || 'Failed to sync to Master Data', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Export to Word
  const handleExportWord = () => {
    if (!sessionDetails || courses.length === 0) {
      addToast('No allotment data to export', 'warning');
      return;
    }
    try {
      exportAllotmentToWord({
        session: sessionDetails,
        courses,
        departmentName: activeDepartment?.name || 'Department of Artificial Intelligence and Machine Learning'
      });
      addToast('Word document generated successfully!', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to export Word document', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
        <p className="text-sm text-slate-500">Loading Allotment Console...</p>
      </div>
    );
  }

  // Group courses by semester
  const semesterGroups = {};
  courses.forEach(c => {
    const sem = c.semester_name || 'General';
    if (!semesterGroups[sem]) semesterGroups[sem] = [];
    semesterGroups[sem].push(c);
  });

  const totalCourses = courses.length;
  const allottedCount = courses.filter(c => c.is_allotted).length;

  return (
    <div className="space-y-6">
      {/* Top Console Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Session Selector & Metadata */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-full sm:w-72">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Allotment Cycle / Academic Session
            </label>
            <select
              value={selectedSessionId}
              onChange={handleSessionChange}
              className="w-full text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.academic_year} · {s.semester_type} ({s.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setNewSessionModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors sm:mt-5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Cycle
          </button>
        </div>

        {/* Status Lifecycle & Main Action Buttons */}
        {sessionDetails && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleUpdateStatus('draft')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  sessionDetails.status === 'draft' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Draft
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus('open')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  sessionDetails.status === 'open' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Open Choices
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus('in_review')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  sessionDetails.status === 'in_review' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                In Review
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus('allotted')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  sessionDetails.status === 'allotted' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Finalized
              </button>
            </div>

            {/* Add Course */}
            <button
              type="button"
              onClick={() => handleOpenCourseModal()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              Add Course
            </button>

            {/* Sync to Master Data Button */}
            <button
              type="button"
              onClick={() => setSyncModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              title="Upsert all allotted subjects into the Subject Master Data"
            >
              <UploadCloud className="w-4 h-4" />
              Sync to Master Data ({allottedCount}/{totalCourses})
            </button>

            {/* Export Word Button */}
            <button
              type="button"
              onClick={handleExportWord}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
              title="Download institutional Word document matching AIML template"
            >
              <Download className="w-3.5 h-3.5" />
              Export Word (.doc)
            </button>
          </div>
        )}
      </div>

      {/* Main Canvas: Institutional Allotment Sheet */}
      {sessionDetails ? (
        <div className="bg-white rounded-xl border border-slate-300 shadow-sm p-6 sm:p-8">
          {/* Institutional Document Header */}
          <div className="text-center pb-6 border-b border-slate-200">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 uppercase">
              YENEPOYA INSTITUTE OF TECHNOLOGY
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-0.5">NH-13, Thodar, Moodbidri - 574225</p>
            <p className="text-sm font-bold text-slate-800 mt-1">
              {activeDepartment?.name || sessionDetails.department_name}
            </p>
            <div className="inline-block border-b-2 border-slate-900 pb-0.5 mt-2">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900">
                SUBJECT ALLOTMENT / COURSE PREFERENCES - {sessionDetails.semester_type} SEMESTER ({sessionDetails.academic_year})
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500 flex items-center justify-center gap-4">
              <span>Total Courses: <strong className="text-slate-800">{totalCourses}</strong></span>
              <span>•</span>
              <span>Allotted: <strong className="text-emerald-700">{allottedCount}</strong></span>
              <span>•</span>
              <span>Pending: <strong className="text-amber-700">{totalCourses - allottedCount}</strong></span>
            </div>
          </div>

          {/* Tables per Semester */}
          <div className="mt-6 space-y-8">
            {Object.entries(semesterGroups).map(([semName, semCourses]) => (
              <div key={semName} className="space-y-2">
                <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 rounded border border-slate-300">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{semName}</span>
                  <span className="text-[11px] font-medium text-slate-500">{semCourses.length} Courses</span>
                </div>

                <div className="overflow-x-auto border border-slate-300 rounded">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-300 text-[11px]">
                        <th className="py-2.5 px-3 border-r border-slate-200 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 w-64">Course Name</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 w-24 text-center font-mono">Code</th>
                        <th className="py-2.5 px-2 border-r border-slate-200 w-8 text-center">L</th>
                        <th className="py-2.5 px-2 border-r border-slate-200 w-8 text-center">T</th>
                        <th className="py-2.5 px-2 border-r border-slate-200 w-8 text-center">P</th>
                        <th className="py-2.5 px-2 border-r border-slate-200 w-10 text-center">C</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 w-48">Choice 1 Applicants</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 w-44">Choice 2 Applicants</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 w-52">FACULTY (Allotted)</th>
                        <th className="py-2.5 px-2 w-16 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {semCourses.map((course, idx) => {
                        const choice1List = course.choice_1 || [];
                        const choice2List = course.choice_2 || [];

                        return (
                          <tr
                            key={course.id}
                            className={`transition-colors ${course.is_allotted ? 'bg-emerald-50/20' : 'hover:bg-slate-50/40'}`}
                          >
                            <td className="py-2 px-3 border-r border-slate-200 text-center font-medium text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 font-medium">
                              <div className="flex items-center gap-1.5">
                                <span>{course.course_name}</span>
                                {course.is_lab && (
                                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                    Lab
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-700">
                              {course.course_code}
                            </td>
                            <td className="py-2 px-2 border-r border-slate-200 text-center">{course.lecture_hours}</td>
                            <td className="py-2 px-2 border-r border-slate-200 text-center">{course.tutorial_hours}</td>
                            <td className="py-2 px-2 border-r border-slate-200 text-center">{course.practical_hours}</td>
                            <td className="py-2 px-2 border-r border-slate-200 text-center font-bold">{course.credits}</td>

                            {/* Choice 1 Applicants */}
                            <td className="py-2 px-3 border-r border-slate-200 align-top">
                              {choice1List.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {choice1List.map(a => (
                                    <span
                                      key={a.faculty_id}
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                        course.allotted_faculty_id === a.faculty_id
                                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                                          : 'bg-orange-50 text-orange-800 border-orange-200'
                                      }`}
                                    >
                                      {a.faculty_name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px] italic">— None —</span>
                              )}
                            </td>

                            {/* Choice 2 Applicants */}
                            <td className="py-2 px-3 border-r border-slate-200 align-top">
                              {choice2List.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {choice2List.map(a => (
                                    <span
                                      key={a.faculty_id}
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                        course.allotted_faculty_id === a.faculty_id
                                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                                          : 'bg-blue-50 text-blue-800 border-blue-200'
                                      }`}
                                    >
                                      {a.faculty_name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px] italic">— None —</span>
                              )}
                            </td>

                            {/* Allotted Faculty Dropdown */}
                            <td className="py-2 px-3 border-r border-slate-200 align-top">
                              <select
                                value={course.allotted_faculty_id || ''}
                                onChange={(e) => handleAllotFaculty(course.id, e.target.value)}
                                className={`w-full text-xs font-semibold rounded px-2 py-1 border transition-colors focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                                  course.is_allotted
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                                    : 'bg-white text-slate-600 border-slate-300'
                                }`}
                              >
                                <option value="">-- Select Faculty --</option>
                                {choice1List.length > 0 && (
                                  <optgroup label="Choice 1 Applicants">
                                    {choice1List.map(a => (
                                      <option key={`c1_${a.faculty_id}`} value={a.faculty_id}>
                                        * {a.faculty_name} (Choice 1)
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {choice2List.length > 0 && (
                                  <optgroup label="Choice 2 Applicants">
                                    {choice2List.map(a => (
                                      <option key={`c2_${a.faculty_id}`} value={a.faculty_id}>
                                        ~ {a.faculty_name} (Choice 2)
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                <optgroup label="All Department Faculty">
                                  {facultyList.map(f => (
                                    <option key={f.id} value={f.id}>
                                      {f.name} [{f.faculty_code}]
                                    </option>
                                  ))}
                                </optgroup>
                                {course.is_allotted && (
                                  <option value="CLEAR" className="text-rose-600">
                                    -- De-allot / Clear --
                                  </option>
                                )}
                              </select>
                            </td>

                            {/* Actions */}
                            <td className="py-2 px-2 text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCourseModal(course)}
                                  className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                                  title="Edit course details"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCourse(course.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                                  title="Delete course"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">No Active Allotment Cycle</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Create an allotment cycle to start accepting faculty course preferences and allotting subjects.
          </p>
          <button
            type="button"
            onClick={() => setNewSessionModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Create Allotment Cycle
          </button>
        </div>
      )}

      {/* Modal: New Allotment Session */}
      <Modal
        isOpen={newSessionModalOpen}
        onClose={() => setNewSessionModalOpen(false)}
        title="Create New Subject Allotment Cycle"
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Academic Year</label>
              <input
                type="text"
                required
                value={newSessionForm.academic_year}
                onChange={(e) => setNewSessionForm({ ...newSessionForm, academic_year: e.target.value })}
                placeholder="2026-27"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Semester Type</label>
              <select
                value={newSessionForm.semester_type}
                onChange={(e) => setNewSessionForm({ ...newSessionForm, semester_type: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:outline-none"
              >
                <option value="ODD">ODD SEMESTER (III, V, VII)</option>
                <option value="EVEN">EVEN SEMESTER (IV, VI, VIII)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Cycle Title</label>
            <input
              type="text"
              required
              value={newSessionForm.title}
              onChange={(e) => setNewSessionForm({ ...newSessionForm, title: e.target.value })}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Instructions for Faculty</label>
            <textarea
              rows={2}
              value={newSessionForm.instructions}
              onChange={(e) => setNewSessionForm({ ...newSessionForm, instructions: e.target.value })}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-orange-950 block">Pre-populate from Master Data</span>
              <span className="text-[11px] text-orange-800">
                Automatically import courses from existing {newSessionForm.semester_type} semesters
              </span>
            </div>
            <input
              type="checkbox"
              checked={newSessionForm.copy_from_existing}
              onChange={(e) => setNewSessionForm({ ...newSessionForm, copy_from_existing: e.target.checked })}
              className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNewSessionModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg"
            >
              {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Cycle
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add/Edit Course */}
      <Modal
        isOpen={courseModalOpen}
        onClose={() => setCourseModalOpen(false)}
        title={editingCourse ? 'Edit Allotment Course' : 'Add Course to Allotment Sheet'}
      >
        <form onSubmit={handleSaveCourse} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Semester Name</label>
              <select
                value={courseForm.semester_name}
                onChange={(e) => setCourseForm({ ...courseForm, semester_name: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:outline-none"
              >
                <option value="I Semester">I Semester</option>
                <option value="II Semester">II Semester</option>
                <option value="III Semester">III Semester</option>
                <option value="IV Semester">IV Semester</option>
                <option value="V Semester">V Semester</option>
                <option value="VI Semester">VI Semester</option>
                <option value="VII Semester">VII Semester</option>
                <option value="VIII Semester">VIII Semester</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Course Code</label>
              <input
                type="text"
                required
                value={courseForm.course_code}
                onChange={(e) => setCourseForm({ ...courseForm, course_code: e.target.value })}
                placeholder="BCS501"
                className="w-full text-xs font-mono uppercase px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Course Name</label>
            <input
              type="text"
              required
              value={courseForm.course_name}
              onChange={(e) => setCourseForm({ ...courseForm, course_name: e.target.value })}
              placeholder="Software Engineering & Project Management"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Lecture (L)</label>
              <input
                type="number"
                min="0"
                value={courseForm.lecture_hours}
                onChange={(e) => setCourseForm({ ...courseForm, lecture_hours: parseInt(e.target.value, 10) || 0 })}
                className="w-full text-xs text-center px-2 py-1.5 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Tutorial (T)</label>
              <input
                type="number"
                min="0"
                value={courseForm.tutorial_hours}
                onChange={(e) => setCourseForm({ ...courseForm, tutorial_hours: parseInt(e.target.value, 10) || 0 })}
                className="w-full text-xs text-center px-2 py-1.5 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Practical (P)</label>
              <input
                type="number"
                min="0"
                value={courseForm.practical_hours}
                onChange={(e) => setCourseForm({ ...courseForm, practical_hours: parseInt(e.target.value, 10) || 0 })}
                className="w-full text-xs text-center px-2 py-1.5 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Credits (C)</label>
              <input
                type="number"
                min="0"
                value={courseForm.credits}
                onChange={(e) => setCourseForm({ ...courseForm, credits: parseInt(e.target.value, 10) || 0 })}
                className="w-full text-xs text-center font-bold px-2 py-1.5 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_lab_check"
              checked={courseForm.is_lab}
              onChange={(e) => setCourseForm({ ...courseForm, is_lab: e.target.checked })}
              className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
            />
            <label htmlFor="is_lab_check" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Mark as Practical / Laboratory Course
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setCourseModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg"
            >
              {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingCourse ? 'Save Changes' : 'Add Course'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Sync to Master Data */}
      <Modal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        title="Sync Allotted Subjects to Master Data"
      >
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 text-xs">
            <div className="flex items-center gap-2 font-bold mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Ready to Sync {allottedCount} Allotted Subjects</span>
            </div>
            <p className="text-emerald-800 leading-relaxed">
              This action will populate or update the Master Data <strong>subject</strong> table for {activeDepartment?.name}. 
              Allotted faculty will be assigned to their respective subjects, and weekly hours will be computed from L+T+P.
            </p>
          </div>

          {totalCourses > allottedCount && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 text-xs">
              <span className="font-bold">Notice:</span> {totalCourses - allottedCount} course(s) are currently unallotted and will be skipped during synchronization.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSyncModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSyncToMasterData}
              disabled={syncing || allottedCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              Confirm & Sync to Master Data
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
