import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Save,
  Loader2,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';

export default function FacultyPreferenceSheet() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [courses, setCourses] = useState([]);
  const [preferences, setPreferences] = useState({}); // { [courseId]: 1 or 2 }
  const [saving, setSaving] = useState(false);

  const fetchSheetData = async () => {
    setLoading(true);
    try {
      const res = await api.getFacultyAllotmentSheet();
      setSession(res.session);
      setCourses(res.courses || []);

      // Map existing preferences { course_id: preference_level }
      const prefMap = {};
      if (res.preferences && Array.isArray(res.preferences)) {
        res.preferences.forEach(p => {
          prefMap[p.course_id] = p.preference_level;
        });
      }
      setPreferences(prefMap);
    } catch (err) {
      addToast(err.message || 'Failed to load course preference sheet', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheetData();
  }, [user?.id]);

  const handleTogglePreference = (course, level) => {
    // Check if session is open
    if (!session || session.status !== 'open') {
      addToast('Preferences can only be modified when the allotment cycle is Open.', 'warning');
      return;
    }

    // Real-Time Guard: If already allotted to someone else, block selection!
    if (course.is_allotted && !course.is_allotted_to_me) {
      addToast(`Course "${course.course_name}" is already allotted to ${course.allotted_faculty_name || 'another faculty'}.`, 'error');
      return;
    }

    setPreferences(prev => {
      const currentLevel = prev[course.id];
      const updated = { ...prev };

      if (currentLevel === level) {
        // Deselect
        delete updated[course.id];
      } else {
        // If selecting Choice 1, remove any other course with Choice 1 if needed, or allow per-semester
        // Here we assign this course as Choice 1 or Choice 2
        updated[course.id] = level;
      }
      return updated;
    });
  };

  const handleSavePreferences = async () => {
    if (!session?.id) return;
    setSaving(true);
    try {
      const choicesArray = Object.entries(preferences).map(([courseId, level]) => ({
        course_id: parseInt(courseId, 10),
        preference_level: level
      }));

      await api.submitFacultyCoursePreferences({
        session_id: session.id,
        choices: choicesArray
      });

      addToast('Your course preferences have been recorded successfully!', 'success');
      // Refresh sheet to verify latest state
      await fetchSheetData();
    } catch (err) {
      addToast(err.message || 'Failed to save course preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
        <p className="text-sm text-slate-500">Loading course preference sheet...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">No Active Allotment Cycle</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          The department administration has not opened a subject preference submission cycle yet. Please check back later.
        </p>
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

  const choice1Count = Object.values(preferences).filter(v => v === 1).length;
  const choice2Count = Object.values(preferences).filter(v => v === 2).length;
  const isOpen = session.status === 'open';

  return (
    <div className="space-y-6">
      {/* Top Banner & Status */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
              {session.academic_year} · {session.semester_type} SEMESTER
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              session.status === 'open' ? 'bg-emerald-100 text-emerald-800' :
              session.status === 'in_review' ? 'bg-amber-100 text-amber-800' :
              session.status === 'allotted' ? 'bg-blue-100 text-blue-800' :
              session.status === 'synced' ? 'bg-purple-100 text-purple-800' :
              'bg-slate-100 text-slate-700'
            }`}>
              {session.status === 'open' ? 'Submissions Open' :
               session.status === 'in_review' ? 'In Review' :
               session.status === 'allotted' ? 'Allotments Finalized' :
               session.status === 'synced' ? 'Synced to Master' : 'Draft'}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">{session.title}</h2>
          {session.instructions && (
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">{session.instructions}</p>
          )}
        </div>

        {/* Selected Counts & Save */}
        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-slate-500 hidden sm:block">
            <div>Choice 1: <strong className="text-orange-600 font-bold">{choice1Count}</strong></div>
            <div>Choice 2: <strong className="text-blue-600 font-bold">{choice2Count}</strong></div>
          </div>
          <button
            onClick={handleSavePreferences}
            disabled={!isOpen || saving}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-xs transition-colors ${
              isOpen
                ? 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Preferences
          </button>
        </div>
      </div>

      {/* Institutional Document Canvas (Styled like the Yenepoya Word Form) */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-sm p-6 sm:p-8">
        {/* Document Header */}
        <div className="text-center pb-6 border-b border-slate-200">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 uppercase">
            YENEPOYA INSTITUTE OF TECHNOLOGY
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">NH-13, Thodar, Moodbidri - 574225</p>
          <p className="text-sm font-bold text-slate-800 mt-1">{session.department_name}</p>
          <div className="inline-block border-b-2 border-slate-900 pb-0.5 mt-2">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900">
              SUBJECT ALLOTMENT / COURSE PREFERENCES - {session.semester_type} SEMESTER ({session.academic_year})
            </span>
          </div>
        </div>

        {/* Semester Tables */}
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
                      <th className="py-2.5 px-3 border-r border-slate-200">Course Name</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 w-24 text-center font-mono">Code</th>
                      <th className="py-2.5 px-2 border-r border-slate-200 w-10 text-center">L</th>
                      <th className="py-2.5 px-2 border-r border-slate-200 w-10 text-center">T</th>
                      <th className="py-2.5 px-2 border-r border-slate-200 w-10 text-center">P</th>
                      <th className="py-2.5 px-2 border-r border-slate-200 w-12 text-center">Credits</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 w-24 text-center">Choice 1</th>
                      <th className="py-2.5 px-3 border-r border-slate-200 w-24 text-center">Choice 2</th>
                      <th className="py-2.5 px-3 w-40 text-center">Status / Allotment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {semCourses.map((course, idx) => {
                      const pref = preferences[course.id];
                      const isChoice1 = pref === 1;
                      const isChoice2 = pref === 2;
                      const isAllottedToOther = course.is_allotted && !course.is_allotted_to_me;
                      const isAllottedToMe = course.is_allotted_to_me;

                      return (
                        <tr
                          key={course.id}
                          className={`transition-colors ${
                            isAllottedToMe
                              ? 'bg-emerald-50/50'
                              : isAllottedToOther
                              ? 'bg-slate-50/80 opacity-80'
                              : isChoice1
                              ? 'bg-orange-50/40'
                              : isChoice2
                              ? 'bg-blue-50/30'
                              : 'hover:bg-slate-50/40'
                          }`}
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

                          {/* Choice 1 Button */}
                          <td className="py-2 px-3 border-r border-slate-200 text-center">
                            {isAllottedToOther ? (
                              <button
                                disabled
                                title={`Already allotted to ${course.allotted_faculty_name}`}
                                className="w-full py-1 px-2 text-[11px] font-semibold rounded bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                              >
                                Blocked
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={!isOpen}
                                onClick={() => handleTogglePreference(course, 1)}
                                className={`w-full py-1 px-2 text-[11px] font-bold rounded transition-colors ${
                                  isChoice1
                                    ? 'bg-orange-500 text-white shadow-xs'
                                    : 'bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-600 border border-slate-300 hover:border-orange-300'
                                } ${!isOpen ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                              >
                                {isChoice1 ? '1st Choice' : 'Select 1'}
                              </button>
                            )}
                          </td>

                          {/* Choice 2 Button */}
                          <td className="py-2 px-3 border-r border-slate-200 text-center">
                            {isAllottedToOther ? (
                              <button
                                disabled
                                title={`Already allotted to ${course.allotted_faculty_name}`}
                                className="w-full py-1 px-2 text-[11px] font-semibold rounded bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                              >
                                Blocked
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={!isOpen}
                                onClick={() => handleTogglePreference(course, 2)}
                                className={`w-full py-1 px-2 text-[11px] font-bold rounded transition-colors ${
                                  isChoice2
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-300 hover:border-blue-300'
                                } ${!isOpen ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                              >
                                {isChoice2 ? '2nd Choice' : 'Select 2'}
                              </button>
                            )}
                          </td>

                          {/* Status / Allotment Info */}
                          <td className="py-2 px-3 text-center">
                            {isAllottedToMe ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Allotted to You
                              </span>
                            ) : isAllottedToOther ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-300 cursor-help"
                                title={`Course allotted to ${course.allotted_faculty_name}`}
                              >
                                <Lock className="w-3 h-3 text-slate-400" />
                                Allotted to {course.allotted_faculty_name?.split(' ')?.[1] || course.allotted_faculty_name || 'Faculty'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">Available</span>
                            )}
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

        {/* Note / Guide at bottom of document */}
        <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-400" />
            <span>Choice 1 is given primary weightage; Choice 2 serves as backup.</span>
          </div>
          <div>
            Session: <strong className="text-slate-700 font-semibold">{session.academic_year} ({session.semester_type})</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
