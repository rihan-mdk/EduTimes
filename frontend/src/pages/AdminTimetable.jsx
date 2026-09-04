import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  Sparkles, 
  Download, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Clock, 
  Coffee, 
  Utensils 
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

// Standard period timings (7 periods/day)
const PERIOD_TIMES = {
  1: '09:00 - 09:55',
  2: '09:55 - 10:50',
  3: '11:10 - 12:05',
  4: '12:05 - 13:00',
  5: '13:50 - 14:40',
  6: '14:40 - 15:30',
  7: '15:30 - 16:15',
};

export default function AdminTimetable() {
  const { addToast } = useToast();
  const gridRef = useRef(null);

  // Core Data
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [timeslots, setTimeslots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Manual Edit State (Slot click)
  const [selectedSlot, setSelectedSlot] = useState(null); // { day, period_number, timeslot_id, existingEntries }
  const [selectedOccupantIndex, setSelectedOccupantIndex] = useState(0);
  const [replaceEntireSlot, setReplaceEntireSlot] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [customSessionType, setCustomSessionType] = useState('theory');
  const [clashWarning, setClashWarning] = useState(null);
  const [validating, setValidating] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [semRes, subRes, tsRes] = await Promise.all([
          api.getSemesters(),
          api.getSubjects(),
          api.getTimeslots()
        ]);
        setSemesters(semRes);
        setSubjects(subRes);
        setTimeslots(tsRes);

        if (semRes.length > 0) {
          setSelectedSemesterId(semRes[0].id);
          setAcademicYear(semRes[0].academic_year || '2026-27');
        }
      } catch (err) {
        addToast(err.message || 'Failed to initialize timetable view', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Fetch timetable entries whenever selected semester or academic year changes
  const fetchTimetable = async () => {
    if (!selectedSemesterId) return;
    try {
      const entries = await api.getTimetable({
        semester_id: selectedSemesterId,
        academic_year: academicYear
      });
      setTimetableEntries(entries);
    } catch (err) {
      addToast(err.message || 'Failed to fetch timetable entries', 'error');
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [selectedSemesterId, academicYear]);

  const currentSemester = semesters.find(s => String(s.id) === String(selectedSemesterId));
  const semesterSubjects = subjects.filter(s => String(s.semester_id) === String(selectedSemesterId));

  // Build Grid Map: Key `day_period` -> Array of entries (supports parallel activities)
  const gridMap = new Map();
  timetableEntries.forEach(entry => {
    const key = `${entry.day}_${entry.period_number}`;
    if (!gridMap.has(key)) {
      gridMap.set(key, [entry]);
    } else {
      gridMap.get(key).push(entry);
    }
  });

  // 1. Auto-generate Timetable for ALL Semesters
  const handleAutoGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.autoGenerateTimetable(academicYear, true);
      addToast(res.message || 'Timetable generated with 0 clashes!', 'success');
      await fetchTimetable();
    } catch (err) {
      const errMsg = err.data?.error || err.message || 'Failed to generate timetable';
      addToast(errMsg, 'error', 6000);
    } finally {
      setGenerating(false);
    }
  };

  // 2. Clear Timetable
  const handleClearSemester = async () => {
    if (!window.confirm(`Are you sure you want to clear the timetable for Semester ${currentSemester?.number}?`)) return;
    try {
      await api.clearTimetable({ semester_id: selectedSemesterId, academic_year: academicYear });
      addToast('Semester timetable cleared.', 'info');
      fetchTimetable();
    } catch (err) {
      addToast(err.message || 'Failed to clear timetable', 'error');
    }
  };

  // 3. Slot Click: Open Manual Edit
  const handleSlotClick = (day, period_number) => {
    const existingEntriesList = gridMap.get(`${day}_${period_number}`) || [];
    const firstEntry = existingEntriesList[0] || null;
    
    let ts = timeslots.find(t => t.day === day && t.period_number === period_number);
    const timeslot_id = ts ? ts.id : (firstEntry ? firstEntry.timeslot_id : null);

    setSelectedSlot({
      day,
      period_number,
      timeslot_id,
      existingEntries: existingEntriesList
    });
    setSelectedOccupantIndex(0);
    setReplaceEntireSlot(false);
    setSelectedSubjectId(firstEntry ? String(firstEntry.subject_id) : '');
    setCustomSessionType(firstEntry?.session_type || (firstEntry?.is_lab ? 'lab' : 'theory'));
    setClashWarning(null);
    setEditModalOpen(true);
  };

  // Switch which occupant is being edited inside a shared parallel slot
  const handleSelectOccupant = (index) => {
    setSelectedOccupantIndex(index);
    setReplaceEntireSlot(false);
    setClashWarning(null);
    if (!selectedSlot) return;

    if (index === 'new') {
      setSelectedSubjectId('');
      setCustomSessionType('activity');
    } else {
      const entry = selectedSlot.existingEntries[index];
      setSelectedSubjectId(entry ? String(entry.subject_id) : '');
      setCustomSessionType(entry?.session_type || (entry?.is_lab ? 'lab' : 'theory'));
    }
  };

  // Quick delete single occupant from slot
  const handleDeleteOccupant = async (occupantEntry) => {
    if (!occupantEntry?.id) return;
    setSavingSlot(true);
    try {
      await api.deleteTimetableEntry(occupantEntry.id);
      addToast(`Removed ${occupantEntry.subject_code} from this slot.`, 'success');
      setEditModalOpen(false);
      fetchTimetable();
    } catch (err) {
      addToast(err.message || 'Failed to remove occupant', 'error');
    } finally {
      setSavingSlot(false);
    }
  };

  // 4. Validate move / check clash when changing subject in slot modal
  const handleSubjectChange = async (newSubjectId, isReplaceSlot = replaceEntireSlot) => {
    setSelectedSubjectId(newSubjectId);
    setClashWarning(null);

    if (!newSubjectId) {
      return; // Clearing slot has no clash
    }

    // Intelligently default session type when subject is selected:
    // 1. Activity if generic or parallel
    // 2. Lab if subject is_lab or adjacent period on same day has same subject (continuous session!)
    // 3. Theory otherwise
    const chosenSub = semesterSubjects.find(s => String(s.id) === String(newSubjectId));
    if (chosenSub) {
      if (chosenSub.is_generic_activity || chosenSub.is_parallel_activity) {
        setCustomSessionType('activity');
      } else if (chosenSub.is_lab) {
        setCustomSessionType('lab');
      } else {
        const curDay = selectedSlot?.day;
        const curPeriod = selectedSlot?.period_number;
        const isAdjacentSameSub = 
          (curPeriod > 1 && (gridMap.get(`${curDay}_${curPeriod - 1}`) || []).some(e => String(e.subject_id) === String(newSubjectId))) ||
          ((gridMap.get(`${curDay}_${curPeriod + 1}`) || []).some(e => String(e.subject_id) === String(newSubjectId)));
        
        if (isAdjacentSameSub || Number(chosenSub.block_session_hours) > 1) {
          setCustomSessionType('lab');
        } else {
          setCustomSessionType('theory');
        }
      }
    }

    if (!selectedSlot?.timeslot_id) {
      addToast('Cannot find matching timeslot in database.', 'error');
      return;
    }

    const currentEntry = selectedOccupantIndex !== 'new' 
      ? selectedSlot.existingEntries[selectedOccupantIndex] 
      : null;

    // When replacing the entire slot, all occupants will be deleted.
    // Pass their IDs as exclude_entry_ids so the clash check ignores them.
    const excludeIds = isReplaceSlot
      ? selectedSlot.existingEntries.map(e => e.id).filter(Boolean)
      : [];

    setValidating(true);
    try {
      const checkRes = await api.validateMove({
        id: currentEntry?.id || null,
        replace_slot: isReplaceSlot,
        exclude_entry_ids: excludeIds,
        subject_id: parseInt(newSubjectId, 10),
        semester_id: parseInt(selectedSemesterId, 10),
        timeslot_id: selectedSlot.timeslot_id,
        academic_year: academicYear
      });

      if (!checkRes.isValid) {
        setClashWarning(checkRes.error || 'Clash detected with another schedule entry.');
      } else {
        setClashWarning(null);
      }
    } catch (err) {
      setClashWarning(err.message || 'Failed to validate clash');
    } finally {
      setValidating(false);
    }
  };

  // Helper: derive session_type from a subject object
  const deriveSessionType = (subject) => {
    if (!subject) return 'theory';
    if (subject.is_generic_activity || subject.is_parallel_activity) return 'activity';
    if (subject.is_lab) return 'lab';
    return 'theory';
  };

  // 5. Save Manual Slot Update
  const handleSaveSlot = async () => {
    if (clashWarning) {
      addToast('Cannot save slot while clash is present. Resolve or cancel.', 'error');
      return;
    }

    const currentEntry = selectedOccupantIndex !== 'new' 
      ? selectedSlot.existingEntries[selectedOccupantIndex] 
      : null;

    const selectedSubject = semesterSubjects.find(s => String(s.id) === String(selectedSubjectId));
    const sessionType = customSessionType || deriveSessionType(selectedSubject);

    setSavingSlot(true);
    try {
      if (!selectedSubjectId) {
        // Remove specific occupant entry if cleared
        if (currentEntry) {
          await api.deleteTimetableEntry(currentEntry.id);
          addToast('Occupant removed successfully', 'success');
        }
      } else {
        const payload = {
          subject_id: parseInt(selectedSubjectId, 10),
          semester_id: parseInt(selectedSemesterId, 10),
          timeslot_id: selectedSlot.timeslot_id,
          academic_year: academicYear,
          replace_slot: replaceEntireSlot,
          session_type: sessionType
        };

        if (replaceEntireSlot) {
          // Use the first occupant as the entry to update (updating it changes subject_id to new one)
          // The controller will delete all other occupants automatically
          const anchorEntry = selectedSlot.existingEntries[0];
          if (anchorEntry) {
            await api.updateTimetableEntry(anchorEntry.id, payload);
          } else {
            await api.createTimetableEntry(payload);
          }
          addToast('Slot converted to single subject successfully', 'success');
        } else if (currentEntry) {
          await api.updateTimetableEntry(currentEntry.id, payload);
          addToast('Slot occupant updated successfully', 'success');
        } else {
          await api.createTimetableEntry(payload);
          addToast('Slot scheduled successfully', 'success');
        }
      }

      setEditModalOpen(false);
      fetchTimetable();
    } catch (err) {
      const errMsg = err.data?.error || err.message || 'Failed to save slot';
      setClashWarning(errMsg);
    } finally {
      setSavingSlot(false);
    }
  };

  // 6. PDF Export Feature
  const handleExportPDF = async () => {
    if (!gridRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(gridRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
      pdf.save(`Timetable_Semester_${currentSemester?.number || 'View'}_${academicYear}.pdf`);
      addToast('Timetable PDF exported successfully!', 'success');
    } catch (err) {
      addToast('Failed to export PDF: ' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Semester Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
        {/* Semester Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Semester:</span>
          {semesters.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedSemesterId(s.id);
                setAcademicYear(s.academic_year || '2025-2026');
              }}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                String(selectedSemesterId) === String(s.id)
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Semester {s.number} (S{s.number})</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                String(selectedSemesterId) === String(s.id) ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-200 text-slate-600'
              }`}>
                {s.class_room}
              </span>
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleAutoGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Solvers...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Timetable (All Semesters)</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exporting || timetableEntries.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export PDF
          </button>

          <button
            onClick={handleClearSemester}
            disabled={timetableEntries.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 hover:text-rose-600 hover:bg-rose-50 text-sm font-medium rounded-lg transition-colors"
            title="Clear current semester entries"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Timetable Grid Container (Exportable ref) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 overflow-hidden">
        {/* Printable / View Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Semester {currentSemester?.number || ''} Weekly Schedule
            </h2>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
              <span>Room: <strong className="text-slate-800 font-mono">{currentSemester?.class_room}</strong></span>
              <span>•</span>
              <span>Academic Year: <strong className="text-slate-800">{academicYear}</strong></span>
              <span>•</span>
              <span className="text-emerald-700 font-medium">{timetableEntries.length} periods scheduled</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block" /> Theory
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> Lab
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300 inline-block" /> Block
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-teal-100 border border-teal-300 inline-block" /> Activity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300 inline-block" /> Parallel
            </span>
          </div>
        </div>

        {/* Weekly Grid */}
        <div ref={gridRef} className="bg-white p-2">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-center">
              {/* Table Header: Days & Periods with Breaks */}
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider">
                  <th className="border border-slate-300 py-3 px-2 w-28 bg-slate-200">Day / Time</th>
                  
                  {/* Period 1 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 1</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[1]}</div>
                  </th>

                  {/* Period 2 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 2</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[2]}</div>
                  </th>

                  {/* Tea Break Column */}
                  <th className="border border-slate-300 py-2 px-1 w-12 bg-amber-50/70 text-amber-800 font-semibold text-[11px]">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <Coffee className="w-3.5 h-3.5 text-amber-700" />
                      <span className="writing-vertical text-[10px] tracking-tight">Tea Break</span>
                      <span className="text-[9px] font-mono">10:50-11:10</span>
                    </div>
                  </th>

                  {/* Period 3 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 3</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[3]}</div>
                  </th>

                  {/* Period 4 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 4</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[4]}</div>
                  </th>

                  {/* Lunch Break Column */}
                  <th className="border border-slate-300 py-2 px-1 w-12 bg-amber-50/70 text-amber-800 font-semibold text-[11px]">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <Utensils className="w-3.5 h-3.5 text-amber-700" />
                      <span className="writing-vertical text-[10px] tracking-tight">Lunch Break</span>
                      <span className="text-[9px] font-mono">13:00-13:50</span>
                    </div>
                  </th>

                  {/* Period 5 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 5</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[5]}</div>
                  </th>

                  {/* Period 6 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 6</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[6]}</div>
                  </th>

                  {/* Period 7 */}
                  <th className="border border-slate-300 py-2 px-1 min-w-[120px]">
                    <div>Period 7</div>
                    <div className="text-[10px] font-mono font-normal text-slate-500">{PERIOD_TIMES[7]}</div>
                  </th>
                </tr>
              </thead>

              {/* Grid Rows for Each Day (Monday - Saturday) */}
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day} className="h-20">
                    {/* Day Name */}
                    <td className="border border-slate-300 bg-slate-50 font-bold text-slate-900 text-xs px-2 py-3">
                      {day}
                    </td>

                    {/* Period 1 */}
                    <td 
                      onClick={() => handleSlotClick(day, 1)}
                      className="border border-slate-300 p-1.5 transition-colors cursor-pointer hover:bg-emerald-50/50"
                    >
                      <SlotCell entries={gridMap.get(`${day}_1`)} />
                    </td>

                    {/* Period 2 */}
                    <td 
                      onClick={() => handleSlotClick(day, 2)}
                      className="border border-slate-300 p-1.5 transition-colors cursor-pointer hover:bg-emerald-50/50"
                    >
                      <SlotCell entries={gridMap.get(`${day}_2`)} />
                    </td>

                    {/* Tea Break Cell */}
                    <td className="border border-slate-300 bg-amber-50/40 text-amber-700 text-[10px] font-medium p-1">
                      <div className="h-full flex items-center justify-center text-slate-400 font-mono">
                        ||
                      </div>
                    </td>

                    {/* Period 3 */}
                    <td 
                      onClick={() => handleSlotClick(day, 3)}
                      className="border border-slate-300 p-1.5 transition-colors cursor-pointer hover:bg-emerald-50/50"
                    >
                      <SlotCell entries={gridMap.get(`${day}_3`)} />
                    </td>

                    {/* Period 4 */}
                    <td 
                      onClick={() => handleSlotClick(day, 4)}
                      className="border border-slate-300 p-1.5 transition-colors cursor-pointer hover:bg-emerald-50/50"
                    >
                      <SlotCell entries={gridMap.get(`${day}_4`)} />
                    </td>

                    {/* Lunch Break Cell */}
                    <td className="border border-slate-300 bg-amber-50/40 text-amber-700 text-[10px] font-medium p-1">
                      <div className="h-full flex items-center justify-center text-slate-400 font-mono">
                        ||
                      </div>
                    </td>

                    {/* Period 5 */}
                    <td 
                      onClick={() => handleSlotClick(day, 5)}
                      className="border border-slate-300 p-1.5 transition-colors cursor-pointer hover:bg-emerald-50/50"
                    >
                      <SlotCell entries={gridMap.get(`${day}_5`)} />
                    </td>

                    {/* Period 6 */}
                    <td 
                      onClick={() => handleSlotClick(day, 6)}
                      className="border border-slate-300 p-1.5 transition-colors cursor-pointer hover:bg-emerald-50/50"
                    >
                      <SlotCell entries={gridMap.get(`${day}_6`)} />
                    </td>

                    {/* Period 7 */}
                    <td 
                      onClick={() => handleSlotClick(day, 7)}
                      className="border border-slate-300 p-1.5 transition-colors cursor-pointer hover:bg-emerald-50/50"
                    >
                      <SlotCell entries={gridMap.get(`${day}_7`)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Slot Edit & Live Clash Validation Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Slot: ${selectedSlot?.day} - Period ${selectedSlot?.period_number} (${PERIOD_TIMES[selectedSlot?.period_number || 1]})`}
      >
        <div className="space-y-4">
          {/* Occupant Selector Tabs for Parallel Slots */}
          {selectedSlot?.existingEntries?.length > 0 && (
            <div className="space-y-2 pb-2 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Occupants in this Timeslot:
                </label>
                {selectedSlot.existingEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !replaceEntireSlot;
                      setReplaceEntireSlot(nextState);
                      if (selectedSubjectId) {
                        handleSubjectChange(selectedSubjectId, nextState);
                      }
                    }}
                    className={`text-xs font-semibold px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                      replaceEntireSlot
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                        : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                    }`}
                  >
                    <span>{replaceEntireSlot ? '✓ Replacing entire slot with 1 class' : '🔄 Replace all occupants with 1 class'}</span>
                  </button>
                )}
              </div>

              {!replaceEntireSlot && (
                <div className="flex flex-wrap items-center gap-2">
                  {selectedSlot.existingEntries.map((entry, idx) => (
                    <div key={entry.id || idx} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleSelectOccupant(idx)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-l-lg border transition-all flex items-center gap-1.5 ${
                          selectedOccupantIndex === idx
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{entry.subject_code}</span>
                        <span className="text-[10px] font-normal opacity-90">({entry.faculty_name})</span>
                        {entry.is_parallel_activity && (
                          <span className="text-[8px] bg-purple-200 text-purple-900 px-1 py-0.2 rounded font-mono">
                            PARALLEL
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOccupant(entry)}
                        className="px-2 py-1.5 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-l-0 border-slate-200 rounded-r-lg transition-colors"
                        title="Remove this occupant"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* If there is 1 parallel activity in this slot, allow adding a 2nd parallel occupant */}
                  {selectedSlot.existingEntries.length === 1 && selectedSlot.existingEntries[0].is_parallel_activity && (
                    <button
                      type="button"
                      onClick={() => handleSelectOccupant('new')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border border-dashed transition-all flex items-center gap-1 ${
                        selectedOccupantIndex === 'new'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100'
                      }`}
                    >
                      <span>+ Add Parallel Activity (PE/NSS)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {replaceEntireSlot
                ? 'Select Single Subject to Replace Entire Slot:'
                : selectedOccupantIndex === 'new' 
                  ? 'Select 2nd Parallel Subject to Coexist in this Slot:'
                  : `Select Subject (Occupant ${selectedOccupantIndex + 1}):`}
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value, replaceEntireSlot)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium"
            >
              <option value="">-- Empty Slot (Remove / Free) --</option>
              {semesterSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.subject_code} - {sub.name} ({sub.faculty_name}) {sub.is_lab ? '[LAB]' : ''} {sub.is_parallel_activity ? '[PARALLEL]' : ''} {sub.is_generic_activity ? '[ACTIVITY]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Session Type / Classification Toggle */}
          {selectedSubjectId && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Session Type / Classification:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCustomSessionType('theory')}
                  className={`py-2 px-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    customSessionType === 'theory'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>📘 Theory (1h)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomSessionType('lab')}
                  className={`py-2 px-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    customSessionType === 'lab'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>🔬 Lab / Practical</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomSessionType('activity')}
                  className={`py-2 px-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    customSessionType === 'activity'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>⚡ Activity</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {customSessionType === 'lab'
                  ? '🔬 Marked as Lab / Practical (e.g. continuous multi-hour practical for subjects sharing the same code).'
                  : customSessionType === 'activity'
                  ? '⚡ Marked as Activity (Library, Mentoring, Placement, or Parallel).'
                  : '📘 Marked as standard 1-hour Theory class.'}
              </p>
            </div>
          )}

          {/* Validation Status Indicator */}
          {validating && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>Checking real-time faculty and semester clash constraints...</span>
            </div>
          )}

          {/* Inline Clash Error Message */}
          {clashWarning && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium space-y-1">
              <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>CLASH DETECTED - CANNOT SCHEDULE</span>
              </div>
              <p className="leading-relaxed">{clashWarning}</p>
            </div>
          )}

          {/* No Clash / Valid Indicator */}
          {!validating && !clashWarning && selectedSubjectId && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Zero clashes found. Faculty and semester are free for this slot.</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSlot}
              disabled={savingSlot || !!clashWarning || validating}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-40 transition-colors"
            >
              {savingSlot && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Slot
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Session type styling config
const SESSION_STYLES = {
  theory:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-950',   badge: 'bg-blue-200 text-blue-800',   label: null },
  lab:      { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-950',  badge: 'bg-amber-200 text-amber-800',  label: 'LAB' },
  block:    { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-950', badge: 'bg-orange-200 text-orange-800', label: 'BLOCK' },
  activity: { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-950',   badge: 'bg-teal-200 text-teal-800',   label: 'ACTIVITY' },
};

// Slot Renderer Component (supports single or parallel split sessions)
function SlotCell({ entries }) {
  const items = Array.isArray(entries) ? entries : (entries ? [entries] : []);

  if (items.length === 0) {
    return (
      <div className="h-full min-h-[58px] flex items-center justify-center text-slate-300 hover:text-slate-400 text-xs border border-transparent rounded-lg">
        <span className="text-[11px] font-mono text-slate-300">+ Free</span>
      </div>
    );
  }

  // Multiple occupants in same slot = parallel activities (NSS/PE split)
  if (items.length > 1) {
    return (
      <div className="h-full min-h-[58px] flex flex-col justify-between gap-1 p-0.5">
        {items.map((entry, idx) => (
          <div
            key={entry.id || idx}
            className="p-1 rounded bg-purple-50 border border-purple-200 text-purple-950 text-left shadow-2xs"
          >
            <div className="flex items-center justify-between font-bold">
              <span className="font-mono text-[10px]">{entry.subject_code}</span>
              <span className="text-[8px] font-bold bg-purple-200 text-purple-800 px-1 rounded">PARALLEL</span>
            </div>
            <div className="truncate text-[9px] font-medium text-slate-700">{entry.subject_name}</div>
            <div className="truncate text-[8px] text-slate-500">👤 {entry.faculty_name}</div>
          </div>
        ))}
      </div>
    );
  }

  const entry = items[0];
  // Use session_type from the entry if available, fall back to is_lab flag
  const sessionType = entry.session_type || (entry.is_lab ? 'lab' : 'theory');
  const style = SESSION_STYLES[sessionType] || SESSION_STYLES.theory;

  return (
    <div className={`h-full min-h-[58px] p-1.5 rounded-md flex flex-col justify-center text-left border shadow-xs transition-transform hover:scale-[1.02] ${style.bg} ${style.border} ${style.text}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono font-bold text-xs tracking-tight">{entry.subject_code}</span>
        {style.label && (
          <span className={`text-[9px] font-bold uppercase px-1 py-0.2 rounded ${style.badge}`}>
            {style.label}
          </span>
        )}
      </div>
      <div className="text-[11px] font-medium text-slate-700 truncate leading-snug mt-0.5">
        {entry.subject_name}
      </div>
      <div className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
        👤 {entry.faculty_name}
      </div>
    </div>
  );
}
