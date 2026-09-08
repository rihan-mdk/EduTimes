import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  BookOpen, 
  MapPin, 
  Loader2, 
  CheckCircle2, 
  Coffee, 
  Utensils,
  UserCheck
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_TIMES = {
  1: { start: '09:00:00', end: '09:55:00', label: '09:00 - 09:55' },
  2: { start: '09:55:00', end: '10:50:00', label: '09:55 - 10:50' },
  3: { start: '11:10:00', end: '12:05:00', label: '11:10 - 12:05' },
  4: { start: '12:05:00', end: '13:00:00', label: '12:05 - 13:00' },
  5: { start: '13:50:00', end: '14:40:00', label: '13:50 - 14:40' },
  6: { start: '14:40:00', end: '15:30:00', label: '14:40 - 15:30' },
  7: { start: '15:30:00', end: '16:15:00', label: '15:30 - 16:15' },
};

export default function FacultyDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [timetableEntries, setTimetableEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Current real-time clock & day calculation
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchFacultySchedule = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const entries = await api.getTimetable({ faculty_id: user.id });
      setTimetableEntries(entries);
    } catch (err) {
      addToast(err.message || 'Failed to fetch your schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultySchedule();
  }, [user]);

  // Today's Day Name
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDayName = dayNames[currentTime.getDay()];
  const formattedTodayDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Filter today's classes
  const todayClasses = timetableEntries
    .filter((e) => e.day === todayDayName)
    .sort((a, b) => a.period_number - b.period_number);

  // Helper to convert time string to minutes
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  // Find Current & Next Class
  let currentClass = null;
  let nextClass = null;

  for (const entry of todayClasses) {
    const periodInfo = PERIOD_TIMES[entry.period_number];
    if (periodInfo) {
      const startMin = timeToMinutes(periodInfo.start);
      const endMin = timeToMinutes(periodInfo.end);

      if (currentMinutes >= startMin && currentMinutes <= endMin) {
        currentClass = entry;
      } else if (currentMinutes < startMin && !nextClass) {
        nextClass = entry;
      }
    }
  }

  // Build Grid Map for Full Week: Key `day_period` -> Entry
  const gridMap = new Map();
  timetableEntries.forEach((entry) => {
    gridMap.set(`${entry.day}_${entry.period_number}`, entry);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner: Today's Status & Next/Current Class Highlight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Welcome & Date Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-orange-500 uppercase tracking-wider">Faculty Portal</div>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Hello, {user?.name}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 font-medium">
              <CalendarIcon className="w-4 h-4 text-slate-400" />
              <span>{formattedTodayDate}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total Assigned Classes:</span>
            <strong className="text-slate-900 font-bold">{timetableEntries.length} hrs / week</strong>
          </div>
        </div>

        {/* Current Class Card */}
        <div className={`p-5 rounded-xl border shadow-sm transition-all ${
          currentClass 
            ? 'bg-orange-50 border-orange-300 text-orange-950 ring-2 ring-orange-500/20' 
            : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              Current Ongoing Class
            </span>
            {currentClass && (
              <span className="text-xs font-mono bg-orange-200 text-orange-900 px-2 py-0.5 rounded font-bold">
                Period {currentClass.period_number}
              </span>
            )}
          </div>

          {currentClass ? (
            <div className="mt-3 space-y-1.5">
              <div className="font-mono font-bold text-lg text-orange-900">{currentClass.subject_code}</div>
              <div className="text-sm font-semibold text-orange-950">{currentClass.subject_name}</div>
              <div className="flex items-center gap-3 text-xs text-orange-800 pt-1 font-medium">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Room {currentClass.class_room} (Semester {currentClass.semester_number})
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5" /> {PERIOD_TIMES[currentClass.period_number]?.label}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center justify-center py-3 text-slate-400 text-xs">
              <CheckCircle2 className="w-6 h-6 text-slate-300 mb-1" />
              <span>No class in session right now.</span>
            </div>
          )}
        </div>

        {/* Next Upcoming Class Card */}
        <div className={`p-5 rounded-xl border shadow-sm transition-all ${
          nextClass 
            ? 'bg-blue-50 border-blue-200 text-blue-950' 
            : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Next Scheduled Class Today
            </span>
            {nextClass && (
              <span className="text-xs font-mono bg-blue-200 text-blue-900 px-2 py-0.5 rounded font-bold">
                Period {nextClass.period_number}
              </span>
            )}
          </div>

          {nextClass ? (
            <div className="mt-3 space-y-1.5">
              <div className="font-mono font-bold text-lg text-blue-900">{nextClass.subject_code}</div>
              <div className="text-sm font-semibold text-blue-950">{nextClass.subject_name}</div>
              <div className="flex items-center gap-3 text-xs text-blue-800 pt-1 font-medium">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Room {nextClass.class_room} (Semester {nextClass.semester_number})
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5" /> {PERIOD_TIMES[nextClass.period_number]?.label}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center justify-center py-3 text-slate-400 text-xs">
              <CheckCircle2 className="w-6 h-6 text-slate-300 mb-1" />
              <span>No more classes scheduled for today!</span>
            </div>
          )}
        </div>
      </div>

      {/* Full Week Schedule Grid for Faculty */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Your Full Weekly Teaching Schedule</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive timetable across all semesters you are assigned to teach.
            </p>
          </div>
          <div className="text-xs font-mono bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700">
            Faculty Code: <strong className="text-slate-900">{user?.faculty_code}</strong>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
            <p className="text-sm text-slate-500">Loading your schedule...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-center text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider">
                  <th className="border border-slate-300 py-3 px-2 w-28 bg-slate-200">Day / Period</th>
                  
                  {/* Period 1 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 1</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[1].label}</div>
                  </th>

                  {/* Period 2 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 2</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[2].label}</div>
                  </th>

                  {/* Tea Break */}
                  <th className="border border-slate-300 py-2 px-1 w-10 bg-amber-50/70 text-amber-800 font-semibold text-[10px]">
                    <Coffee className="w-3.5 h-3.5 text-amber-700 mx-auto" />
                  </th>

                  {/* Period 3 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 3</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[3].label}</div>
                  </th>

                  {/* Period 4 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 4</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[4].label}</div>
                  </th>

                  {/* Lunch Break */}
                  <th className="border border-slate-300 py-2 px-1 w-10 bg-amber-50/70 text-amber-800 font-semibold text-[10px]">
                    <Utensils className="w-3.5 h-3.5 text-amber-700 mx-auto" />
                  </th>

                  {/* Period 5 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 5</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[5].label}</div>
                  </th>

                  {/* Period 6 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 6</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[6].label}</div>
                  </th>

                  {/* Period 7 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 7</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[7].label}</div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {DAYS.map((day) => {
                  const isToday = day === todayDayName;
                  return (
                    <tr key={day} className={`h-20 ${isToday ? 'bg-orange-50/30' : ''}`}>
                      <td className={`border border-slate-300 font-bold text-xs px-2 py-3 ${
                        isToday ? 'bg-orange-100 text-orange-950 font-black' : 'bg-slate-50 text-slate-900'
                      }`}>
                        <div className="flex flex-col items-center">
                          <span>{day}</span>
                          {isToday && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 mt-0.5 rounded bg-orange-500 text-white">
                              Today
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="border border-slate-300 p-1.5">
                        <FacultySlotCell entry={gridMap.get(`${day}_1`)} />
                      </td>

                      <td className="border border-slate-300 p-1.5">
                        <FacultySlotCell entry={gridMap.get(`${day}_2`)} />
                      </td>

                      <td className="border border-slate-300 bg-amber-50/30 text-slate-300 text-xs">
                        ||
                      </td>

                      <td className="border border-slate-300 p-1.5">
                        <FacultySlotCell entry={gridMap.get(`${day}_3`)} />
                      </td>

                      <td className="border border-slate-300 p-1.5">
                        <FacultySlotCell entry={gridMap.get(`${day}_4`)} />
                      </td>

                      <td className="border border-slate-300 bg-amber-50/30 text-slate-300 text-xs">
                        ||
                      </td>

                      <td className="border border-slate-300 p-1.5">
                        <FacultySlotCell entry={gridMap.get(`${day}_5`)} />
                      </td>

                      <td className="border border-slate-300 p-1.5">
                        <FacultySlotCell entry={gridMap.get(`${day}_6`)} />
                      </td>

                      <td className="border border-slate-300 p-1.5">
                        <FacultySlotCell entry={gridMap.get(`${day}_7`)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FacultySlotCell({ entry }) {
  if (!entry) {
    return (
      <div className="h-full min-h-[58px] flex items-center justify-center text-slate-300 text-xs font-dashed">
        <span className="text-[11px] font-mono text-slate-300">— Free —</span>
      </div>
    );
  }

  const isLab = entry.is_lab;

  return (
    <div className={`h-full min-h-[58px] p-2 rounded-md flex flex-col justify-center text-left border shadow-xs ${
      isLab 
        ? 'bg-amber-50 border-amber-300 text-amber-950' 
        : 'bg-blue-50 border-blue-300 text-blue-950'
    }`}>
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-xs">{entry.subject_code}</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-white/80 border border-slate-200">
          S{entry.semester_number} ({entry.class_room})
        </span>
      </div>
      <div className="text-[11px] font-medium text-slate-800 truncate leading-snug mt-0.5">
        {entry.subject_name}
      </div>
    </div>
  );
}
