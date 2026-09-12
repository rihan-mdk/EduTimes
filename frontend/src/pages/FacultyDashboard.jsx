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

const MERGED_PERIOD_TIMES = {
  '1_2': '09:00 - 10:50',
  '3_4': '11:10 - 13:00',
  '5_6': '13:50 - 15:30',
  '6_7': '14:40 - 16:15',
  '5_7': '13:50 - 16:15',
};

function computeLabMerges(getLabEntryAt) {
  const mergeMap = new Map();
  const skipPeriods = new Set();

  const sameLab = (e1, e2) => {
    if (!e1 || !e2) return false;
    const id1 = e1.subject_id || e1.id;
    const id2 = e2.subject_id || e2.id;
    if (id1 && id2 && String(id1) === String(id2)) return true;
    return Boolean(e1.subject_code && e1.subject_code === e2.subject_code);
  };

  const e1 = getLabEntryAt(1);
  const e2 = getLabEntryAt(2);
  if (sameLab(e1, e2)) {
    mergeMap.set(1, { span: 2, timeRange: MERGED_PERIOD_TIMES['1_2'] });
    skipPeriods.add(2);
  }

  const e3 = getLabEntryAt(3);
  const e4 = getLabEntryAt(4);
  if (sameLab(e3, e4)) {
    mergeMap.set(3, { span: 2, timeRange: MERGED_PERIOD_TIMES['3_4'] });
    skipPeriods.add(4);
  }

  const e5 = getLabEntryAt(5);
  const e6 = getLabEntryAt(6);
  const e7 = getLabEntryAt(7);

  if (sameLab(e5, e6) && sameLab(e6, e7)) {
    mergeMap.set(5, { span: 3, timeRange: MERGED_PERIOD_TIMES['5_7'] });
    skipPeriods.add(6);
    skipPeriods.add(7);
  } else if (sameLab(e5, e6)) {
    mergeMap.set(5, { span: 2, timeRange: MERGED_PERIOD_TIMES['5_6'] });
    skipPeriods.add(6);
  } else if (sameLab(e6, e7)) {
    mergeMap.set(6, { span: 2, timeRange: MERGED_PERIOD_TIMES['6_7'] });
    skipPeriods.add(7);
  }

  return { mergeMap, skipPeriods };
}

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
            <table className="w-full border-collapse text-left table-fixed">
              {/* Responsive Column sizing fitting standard viewports */}
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[11.8%]" />
                <col className="w-[11.8%]" />
                <col className="w-[4.7%]" />
                <col className="w-[11.8%]" />
                <col className="w-[11.8%]" />
                <col className="w-[4.7%]" />
                <col className="w-[11.8%]" />
                <col className="w-[11.8%]" />
                <col className="w-[11.8%]" />
              </colgroup>

              {/* Table Header */}
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/90 text-slate-700 divide-x divide-slate-200/60">
                  <th className="py-2.5 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100/60" scope="col">
                    DAY / TIME
                  </th>
                  
                  {/* Period 1 */}
                  <th className="py-2 px-1 text-center" scope="col">
                    <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 1</span>
                    <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[1].label}</span>
                  </th>

                  {/* Period 2 */}
                  <th className="py-2 px-1 text-center" scope="col">
                    <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 2</span>
                    <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[2].label}</span>
                  </th>

                  {/* Tea Break */}
                  <th className="py-2 px-0.5 text-center bg-amber-50/60 border-x border-amber-100" scope="col">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[11px]">☕</span>
                      <span className="text-[9.5px] font-bold text-amber-800 uppercase tracking-tighter mt-0.5">Tea</span>
                      <span className="text-[8.5px] font-medium text-amber-600/80">10:50-11:10</span>
                    </div>
                  </th>

                  {/* Period 3 */}
                  <th className="py-2 px-1 text-center" scope="col">
                    <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 3</span>
                    <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[3].label}</span>
                  </th>

                  {/* Period 4 */}
                  <th className="py-2 px-1 text-center" scope="col">
                    <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 4</span>
                    <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[4].label}</span>
                  </th>

                  {/* Lunch Break */}
                  <th className="py-2 px-0.5 text-center bg-orange-50/60 border-x border-orange-100" scope="col">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[11px]">🍽️</span>
                      <span className="text-[9.5px] font-bold text-orange-800 uppercase tracking-tighter mt-0.5">Lunch</span>
                      <span className="text-[8.5px] font-medium text-orange-600/80">13:00-13:50</span>
                    </div>
                  </th>

                  {/* Period 5 */}
                  <th className="py-2 px-1 text-center" scope="col">
                    <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 5</span>
                    <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[5].label}</span>
                  </th>

                  {/* Period 6 */}
                  <th className="py-2 px-1 text-center" scope="col">
                    <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 6</span>
                    <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[6].label}</span>
                  </th>

                  {/* Period 7 */}
                  <th className="py-2 px-1 text-center" scope="col">
                    <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 7</span>
                    <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[7].label}</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {DAYS.map((day) => {
                  const isToday = day === todayDayName;

                  const isLabSlot = (p) => {
                    const e = gridMap.get(`${day}_${p}`);
                    if (!e) return null;
                    return (e.session_type === 'lab' || e.is_lab) ? e : null;
                  };
                  const { mergeMap, skipPeriods } = computeLabMerges(isLabSlot);

                  const renderPeriodTd = (p) => {
                    if (skipPeriods.has(p)) return null;
                    const mergeInfo = mergeMap.get(p);
                    return (
                      <td key={p} colSpan={mergeInfo ? mergeInfo.span : 1} className="p-1 align-top">
                        <FacultySlotCell
                          entry={gridMap.get(`${day}_${p}`)}
                          span={mergeInfo ? mergeInfo.span : 1}
                          timeRange={mergeInfo?.timeRange}
                        />
                      </td>
                    );
                  };

                  return (
                    <tr key={day} className={`divide-x divide-slate-200/60 border-b border-slate-200/80 transition-colors ${isToday ? 'bg-orange-50/20' : 'hover:bg-slate-50/40'}`}>
                      <td className={`p-2 text-center align-middle font-bold text-xs ${
                        isToday ? 'bg-orange-50/80 text-orange-900 border-l-4 border-l-orange-500' : 'bg-slate-50/80 text-slate-700'
                      }`}>
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-bold text-xs">{day.slice(0, 3)}</span>
                          <span className="text-[10px] font-normal text-slate-400 hidden sm:inline">{day.slice(3)}</span>
                          {isToday && (
                            <span className="text-[9px] font-black uppercase px-1 py-0.2 mt-1 rounded bg-orange-500 text-white shadow-xs">
                              Today
                            </span>
                          )}
                        </div>
                      </td>

                      {renderPeriodTd(1)}
                      {renderPeriodTd(2)}

                      {/* Tea Break Column */}
                      <td className="p-0 text-center bg-amber-50/30 border-x border-amber-100/60 align-middle">
                        <div className="h-full min-h-[62px] flex items-center justify-center text-amber-300 select-none">
                          <span className="text-[10px] font-mono tracking-widest rotate-90 text-amber-400/80">|||</span>
                        </div>
                      </td>

                      {renderPeriodTd(3)}
                      {renderPeriodTd(4)}

                      {/* Lunch Break Column */}
                      <td className="p-0 text-center bg-orange-50/30 border-x border-orange-100/60 align-middle">
                        <div className="h-full min-h-[62px] flex items-center justify-center text-orange-300 select-none">
                          <span className="text-[10px] font-mono tracking-widest rotate-90 text-orange-400/80">|||</span>
                        </div>
                      </td>

                      {renderPeriodTd(5)}
                      {renderPeriodTd(6)}
                      {renderPeriodTd(7)}
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

function FacultySlotCell({ entry, span = 1, timeRange }) {
  if (!entry) {
    return (
      <div className="h-full min-h-[62px] flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/40 text-slate-300">
        <span className="text-[10px] font-mono tracking-wider text-slate-300 select-none">— Free —</span>
      </div>
    );
  }

  const isLab = entry.is_lab || entry.session_type === 'lab';

  return (
    <div className={`h-full min-h-[62px] p-1.5 rounded-lg flex flex-col justify-between text-left border shadow-xs transition-all hover:shadow-sm ${
      isLab 
        ? 'bg-amber-50/80 border-amber-200 text-amber-950' 
        : 'bg-blue-50/80 border-blue-200 text-blue-950'
    }`}>
      <div>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="font-mono font-bold text-xs truncate">{entry.subject_code}</span>
            {span > 1 && (
              <span className="text-[9px] font-black px-1 py-0.2 rounded bg-amber-400/90 text-amber-950 shrink-0">
                {span}h
              </span>
            )}
          </div>
          <span className="text-[9.5px] font-semibold px-1 py-0.2 rounded bg-white/90 border border-slate-200/80 text-slate-600 shrink-0">
            S{entry.semester_number} ({entry.class_room})
          </span>
        </div>
        <div className="text-[11px] font-medium text-slate-700 truncate leading-snug mt-0.5" title={entry.subject_name}>
          {entry.subject_name}
        </div>
      </div>
      {timeRange && (
        <div className="text-[9px] font-mono text-amber-700/80 mt-0.5">
          {timeRange}
        </div>
      )}
    </div>
  );
}
