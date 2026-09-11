import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
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
  Utensils,
  Building2,
  RotateCcw,
  Pencil,
  Layers,
  ChevronDown,
  FileText,
  FileSpreadsheet
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

// Merged time display for 2-hour and 3-hour continuous lab blocks
const MERGED_PERIOD_TIMES = {
  '1_2': '09:00 - 10:50',
  '3_4': '11:10 - 13:00',
  '5_6': '13:50 - 15:30',
  '6_7': '14:40 - 16:15',
  '5_7': '13:50 - 16:15',
};

// Segments within a day separated by break columns: [1, 2], [3, 4], [5, 6, 7]
// Detects 2-hour or 3-hour continuous lab or block-theory sessions strictly within each segment.
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

  const createMergeInfo = (span, timeRange, entry) => {
    const isLab = Boolean(entry?.is_lab || entry?.session_type === 'lab');
    const tag = isLab ? `[LAB - ${span}H]` : `[THEORY - ${span}H]`;
    return { span, timeRange, isLab, tag };
  };

  // Segment 1: [1, 2]
  const e1 = getLabEntryAt(1);
  const e2 = getLabEntryAt(2);
  if (sameLab(e1, e2)) {
    mergeMap.set(1, createMergeInfo(2, MERGED_PERIOD_TIMES['1_2'], e1));
    skipPeriods.add(2);
  }

  // Segment 2: [3, 4]
  const e3 = getLabEntryAt(3);
  const e4 = getLabEntryAt(4);
  if (sameLab(e3, e4)) {
    mergeMap.set(3, createMergeInfo(2, MERGED_PERIOD_TIMES['3_4'], e3));
    skipPeriods.add(4);
  }

  // Segment 3: [5, 6, 7]
  const e5 = getLabEntryAt(5);
  const e6 = getLabEntryAt(6);
  const e7 = getLabEntryAt(7);

  if (sameLab(e5, e6) && sameLab(e6, e7)) {
    // 3-hour continuous lab
    mergeMap.set(5, createMergeInfo(3, MERGED_PERIOD_TIMES['5_7'], e5));
    skipPeriods.add(6);
    skipPeriods.add(7);
  } else if (sameLab(e5, e6)) {
    // 2-hour lab across 5-6
    mergeMap.set(5, createMergeInfo(2, MERGED_PERIOD_TIMES['5_6'], e5));
    skipPeriods.add(6);
  } else if (sameLab(e6, e7)) {
    // 2-hour lab across 6-7
    mergeMap.set(6, createMergeInfo(2, MERGED_PERIOD_TIMES['6_7'], e6));
    skipPeriods.add(7);
  }

  return { mergeMap, skipPeriods };
}

export default function AdminTimetable() {
  const { activeDepartment } = useAuth();
  const { addToast } = useToast();
  const gridRef = useRef(null);
  const printRef = useRef(null);

  // Core Data
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [timeslots, setTimeslots] = useState([]);
  const [calendarDates, setCalendarDates] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setExportDropdownOpen(false);
      }
    }
    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportDropdownOpen]);

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

  // Drag & Drop state
  const dragState = useRef(null); // { entryId, subjectId, fromTimeslotId, fromDay, fromPeriod, sessionType }
  const [dragOverKey, setDragOverKey] = useState(null); // 'Monday_3' — for cell highlight
  const [parallelDialog, setParallelDialog] = useState(null); // { drag, targetEntries, targetTimeslotId, targetDay, targetPeriod }
  const [movingSlot, setMovingSlot] = useState(false);
  const [lastAction, setLastAction] = useState(null); // { type, description, data }
  const [undoing, setUndoing] = useState(false);

  // Semester Info Edit Modal state (Classroom, Advisor, Mentors)
  const [semesterModalOpen, setSemesterModalOpen] = useState(false);
  const [semesterFormData, setSemesterFormData] = useState({ class_room: '', class_advisor: '', mentors: '' });
  const [savingSemesterInfo, setSavingSemesterInfo] = useState(false);

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [semRes, subRes, tsRes, calRes, facRes] = await Promise.all([
          api.getSemesters(),
          api.getSubjects(),
          api.getTimeslots(),
          api.getCalendar().catch(() => []),
          api.getFaculty().catch(() => [])
        ]);
        setSemesters(semRes);
        setSubjects(subRes);
        setTimeslots(tsRes);
        setCalendarDates(Array.isArray(calRes) ? calRes : []);
        setFacultyList(Array.isArray(facRes) ? facRes : []);

        const activeSemList = activeDepartment?.id
          ? semRes.filter(s => String(s.department_id) === String(activeDepartment.id))
          : semRes;

        if (activeSemList.length > 0) {
          setSelectedSemesterId(activeSemList[0].id);
          setAcademicYear(activeSemList[0].academic_year || '2026-27');
        } else if (semRes.length > 0) {
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

  // Filter semesters by active department if set
  const filteredSemesters = activeDepartment?.id
    ? semesters.filter(s => String(s.department_id) === String(activeDepartment.id))
    : semesters;

  // Sync selectedSemesterId if department changes
  useEffect(() => {
    if (filteredSemesters.length > 0) {
      const exists = filteredSemesters.some(s => String(s.id) === String(selectedSemesterId));
      if (!exists) {
        setSelectedSemesterId(filteredSemesters[0].id);
        setAcademicYear(filteredSemesters[0].academic_year || '2026-27');
      }
    } else {
      setSelectedSemesterId('');
      setTimetableEntries([]);
    }
  }, [activeDepartment, semesters]);

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

  // Determine Roman Numeral representation of current semester
  const romanSemester = React.useMemo(() => {
    const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII' };
    const num = currentSemester?.number;
    return ROMAN[num] || (num ? `${num}th` : 'III');
  }, [currentSemester]);

  // Derive W.E.F (With Effect From) date from first working day of academic_calendar (DD.MM.YYYY)
  const wefDate = React.useMemo(() => {
    if (!calendarDates || calendarDates.length === 0) return '01.09.2026';
    const workingDays = [...calendarDates]
      .filter(c => c.type === 'working' && c.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (workingDays.length === 0) return '01.09.2026';
    const firstDate = workingDays[0].date;
    const parts = firstDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return firstDate;
  }, [calendarDates]);

  // Fast lookup map for faculty records
  const facultyMap = React.useMemo(() => {
    const map = new Map();
    (facultyList || []).forEach(f => {
      if (f && f.id) map.set(String(f.id), f);
    });
    return map;
  }, [facultyList]);

  // Robust resolver for faculty in-charge name & code from subjects or timetable entries
  const resolveFacultyInfo = (entryOrSub) => {
    if (!entryOrSub) return { name: '—', code: '' };
    const facId = entryOrSub.faculty_id;
    if (facId && facultyMap.has(String(facId))) {
      const f = facultyMap.get(String(facId));
      return { name: f.name || '—', code: f.faculty_code || '' };
    }
    if (entryOrSub.subject_id) {
      const sub = subjects.find(s => String(s.id) === String(entryOrSub.subject_id));
      if (sub?.faculty_id && facultyMap.has(String(sub.faculty_id))) {
        const f = facultyMap.get(String(sub.faculty_id));
        return { name: f.name || sub.faculty_name || '—', code: f.faculty_code || sub.faculty_code || '' };
      }
      if (sub?.faculty_name) {
        return { name: sub.faculty_name, code: sub.faculty_code || '' };
      }
    }
    return {
      name: entryOrSub.faculty_name || '—',
      code: entryOrSub.faculty_code || ''
    };
  };

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

  // 1. Auto-generate Timetable for Department Semesters
  const handleAutoGenerate = async () => {
    if (filteredSemesters.length === 0) {
      addToast('No semesters found in this department to generate timetable for.', 'warning');
      return;
    }
    setGenerating(true);
    try {
      const deptId = activeDepartment?.id || null;
      const res = await api.autoGenerateTimetable(academicYear, true, deptId);
      addToast(res.message || 'Timetable generated with 0 clashes!', 'success');
      setLastAction(null);
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
      setLastAction(null);
      addToast('Semester timetable cleared.', 'info');
      fetchTimetable();
    } catch (err) {
      addToast(err.message || 'Failed to clear timetable', 'error');
    }
  };

  // ── Drag & Drop Handlers ───────────────────────────────────────
  const handleDragStart = (e, entry, day, period) => {
    dragState.current = {
      entryId: entry.id,
      subjectId: entry.subject_id,
      subjectCode: entry.subject_code,
      fromTimeslotId: entry.timeslot_id,
      fromDay: day,
      fromPeriod: period,
      sessionType: entry.session_type || (entry.is_lab ? 'lab' : 'theory'),
    };
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, day, period) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverKey(`${day}_${period}`);
  };

  const handleDragLeave = () => {
    setDragOverKey(null);
  };

  const handleDrop = async (e, day, period) => {
    e.preventDefault();
    setDragOverKey(null);

    const drag = dragState.current;
    if (!drag) return;

    // Same cell — no-op
    if (drag.fromDay === day && drag.fromPeriod === period) return;

    const targetTs = timeslots.find(t => t.day === day && t.period_number === period);
    if (!targetTs) {
      addToast('No timeslot configured for this cell.', 'error');
      return;
    }

    const targetEntries = gridMap.get(`${day}_${period}`) || [];

    if (targetEntries.length === 0) {
      // Empty cell — move directly
      await executeDragMove(drag, targetTs.id, day, period);
    } else {
      // Occupied — prompt parallel or replace
      setParallelDialog({
        drag,
        targetEntries,
        targetTimeslotId: targetTs.id,
        targetDay: day,
        targetPeriod: period,
      });
    }

    dragState.current = null;
  };

  const executeDragMove = async (drag, targetTimeslotId, targetDay, targetPeriod) => {
    setMovingSlot(true);
    try {
      // Validate clash at destination first
      const checkRes = await api.validateMove({
        id: drag.entryId,
        replace_slot: false,
        exclude_entry_ids: [drag.entryId],
        subject_id: drag.subjectId,
        semester_id: parseInt(selectedSemesterId, 10),
        timeslot_id: targetTimeslotId,
        academic_year: academicYear,
      });

      if (!checkRes.isValid) {
        addToast(`Cannot move: ${checkRes.error || 'Clash detected at destination'}`, 'error', 5000);
        return;
      }

      // Move: update entry to new timeslot
      await api.updateTimetableEntry(drag.entryId, {
        subject_id: drag.subjectId,
        semester_id: parseInt(selectedSemesterId, 10),
        timeslot_id: targetTimeslotId,
        academic_year: academicYear,
        session_type: drag.sessionType,
        replace_slot: false,
      });

      // Save action for Undo
      setLastAction({
        type: 'MOVE',
        description: `Move ${drag.subjectCode} to ${targetDay} P${targetPeriod}`,
        data: {
          entryId: drag.entryId,
          fromTimeslotId: drag.fromTimeslotId,
          fromDay: drag.fromDay,
          fromPeriod: drag.fromPeriod,
          sessionType: drag.sessionType,
          subjectId: drag.subjectId,
          subjectCode: drag.subjectCode,
        },
      });

      addToast(`Moved ${drag.subjectCode} to ${targetDay} P${targetPeriod}`, 'success');
      fetchTimetable();
    } catch (err) {
      addToast(err.data?.error || err.message || 'Move failed', 'error');
    } finally {
      setMovingSlot(false);
    }
  };

  const handleConfirmParallel = async () => {
    if (!parallelDialog) return;
    const { drag, targetTimeslotId, targetDay, targetPeriod } = parallelDialog;
    setParallelDialog(null);
    setMovingSlot(true);
    try {
      // Validate clash for the dropped subject at target
      const checkRes = await api.validateMove({
        id: null,
        replace_slot: false,
        exclude_entry_ids: [drag.entryId],
        subject_id: drag.subjectId,
        semester_id: parseInt(selectedSemesterId, 10),
        timeslot_id: targetTimeslotId,
        academic_year: academicYear,
      });

      if (!checkRes.isValid) {
        addToast(`Cannot add as parallel: ${checkRes.error || 'Clash detected'}`, 'error', 5000);
        return;
      }

      // Move: update the entry to target timeslot (adds alongside existing)
      await api.updateTimetableEntry(drag.entryId, {
        subject_id: drag.subjectId,
        semester_id: parseInt(selectedSemesterId, 10),
        timeslot_id: targetTimeslotId,
        academic_year: academicYear,
        session_type: 'activity',
        replace_slot: false,
      });

      // Save action for Undo
      setLastAction({
        type: 'PARALLEL',
        description: `Add ${drag.subjectCode} as parallel at ${targetDay} P${targetPeriod}`,
        data: {
          entryId: drag.entryId,
          fromTimeslotId: drag.fromTimeslotId,
          fromDay: drag.fromDay,
          fromPeriod: drag.fromPeriod,
          sessionType: drag.sessionType,
          subjectId: drag.subjectId,
          subjectCode: drag.subjectCode,
        },
      });

      addToast(`${drag.subjectCode} added as parallel to ${targetDay} P${targetPeriod}`, 'success');
      fetchTimetable();
    } catch (err) {
      addToast(err.data?.error || err.message || 'Failed to add parallel', 'error');
    } finally {
      setMovingSlot(false);
    }
  };

  const handleReplaceSlot = async () => {
    if (!parallelDialog) return;
    const { drag, targetEntries, targetTimeslotId, targetDay, targetPeriod } = parallelDialog;
    setParallelDialog(null);
    setMovingSlot(true);

    try {
      const targetCodes = targetEntries.map(e => e.subject_code).join(', ');
      const excludeIds = [drag.entryId, ...targetEntries.map(e => e.id)];

      // Validate move with replace_slot: true
      const checkRes = await api.validateMove({
        id: drag.entryId,
        replace_slot: true,
        exclude_entry_ids: excludeIds,
        subject_id: drag.subjectId,
        semester_id: parseInt(selectedSemesterId, 10),
        timeslot_id: targetTimeslotId,
        academic_year: academicYear,
      });

      if (!checkRes.isValid) {
        addToast(`Cannot replace: ${checkRes.error || 'Clash detected'}`, 'error', 5000);
        return;
      }

      // Update the dragged entry to the target slot, replacing existing occupant(s)
      await api.updateTimetableEntry(drag.entryId, {
        subject_id: drag.subjectId,
        semester_id: parseInt(selectedSemesterId, 10),
        timeslot_id: targetTimeslotId,
        academic_year: academicYear,
        session_type: drag.sessionType,
        replace_slot: true,
      });

      // Save for Undo
      setLastAction({
        type: 'REPLACE',
        description: `Replace ${targetCodes} with ${drag.subjectCode} at ${targetDay} P${targetPeriod}`,
        data: {
          movedEntry: {
            entryId: drag.entryId,
            fromTimeslotId: drag.fromTimeslotId,
            fromDay: drag.fromDay,
            fromPeriod: drag.fromPeriod,
            sessionType: drag.sessionType,
            subjectId: drag.subjectId,
            subjectCode: drag.subjectCode,
          },
          deletedEntries: targetEntries.map(e => ({
            subject_id: e.subject_id,
            semester_id: e.semester_id,
            timeslot_id: e.timeslot_id,
            academic_year: e.academic_year,
            session_type: e.session_type || (e.is_lab ? 'lab' : 'theory'),
            subject_code: e.subject_code,
          })),
        },
      });

      addToast(`Replaced ${targetCodes} with ${drag.subjectCode}`, 'success');
      fetchTimetable();
    } catch (err) {
      addToast(err.data?.error || err.message || 'Failed to replace slot', 'error');
    } finally {
      setMovingSlot(false);
    }
  };

  const handleDismissParallel = () => {
    setParallelDialog(null);
  };

  const handleUndo = async () => {
    if (!lastAction || undoing) return;
    setUndoing(true);

    try {
      if (lastAction.type === 'MOVE' || lastAction.type === 'PARALLEL') {
        const { entryId, fromTimeslotId, sessionType, subjectId, subjectCode } = lastAction.data;
        await api.updateTimetableEntry(entryId, {
          subject_id: subjectId,
          semester_id: parseInt(selectedSemesterId, 10),
          timeslot_id: fromTimeslotId,
          academic_year: academicYear,
          session_type: sessionType,
          replace_slot: false,
        });
        addToast(`Undone: Returned ${subjectCode} to its original slot`, 'success');
      } else if (lastAction.type === 'REPLACE') {
        const { movedEntry, deletedEntries } = lastAction.data;

        // 1. Move the dragged entry back to its original slot
        await api.updateTimetableEntry(movedEntry.entryId, {
          subject_id: movedEntry.subjectId,
          semester_id: parseInt(selectedSemesterId, 10),
          timeslot_id: movedEntry.fromTimeslotId,
          academic_year: academicYear,
          session_type: movedEntry.sessionType,
          replace_slot: false,
        });

        // 2. Re-create the deleted entries that were replaced
        for (const entry of deletedEntries) {
          await api.createTimetableEntry({
            subject_id: entry.subject_id,
            semester_id: entry.semester_id,
            timeslot_id: entry.timeslot_id,
            academic_year: entry.academic_year,
            session_type: entry.session_type,
            replace_slot: false,
          });
        }
        addToast(`Undone: Restored replaced subject(s) and returned ${movedEntry.subjectCode}`, 'success');
      }

      setLastAction(null);
      fetchTimetable();
    } catch (err) {
      addToast(err.data?.error || err.message || 'Failed to undo action', 'error');
    } finally {
      setUndoing(false);
    }
  };
  // ── End Drag & Drop ────────────────────────────────────────────

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

  // 5.1 Edit Semester Info (Classroom, Advisor, Mentors)
  const handleOpenSemesterModal = () => {
    if (!currentSemester) return;
    setSemesterFormData({
      class_room: currentSemester.class_room || '',
      class_advisor: currentSemester.class_advisor || '',
      mentors: currentSemester.mentors || '',
    });
    setSemesterModalOpen(true);
  };

  const handleSaveSemesterInfo = async (e) => {
    e.preventDefault();
    if (!currentSemester) return;
    setSavingSemesterInfo(true);
    try {
      const updated = await api.updateSemester(currentSemester.id, {
        number: currentSemester.number,
        department_id: currentSemester.department_id,
        academic_year: currentSemester.academic_year,
        class_room: semesterFormData.class_room.trim(),
        class_advisor: semesterFormData.class_advisor.trim(),
        mentors: semesterFormData.mentors.trim(),
      });
      setSemesters(prev => prev.map(s => String(s.id) === String(currentSemester.id) ? { ...s, ...updated } : s));
      addToast('Semester information updated successfully!', 'success');
      setSemesterModalOpen(false);
    } catch (err) {
      addToast(err.message || 'Failed to update semester info', 'error');
    } finally {
      setSavingSemesterInfo(false);
    }
  };

  // 6. PDF Export Feature (Official Institutional Single-Page Template)
  const handleExportPDF = async () => {
    const exportTarget = printRef.current || gridRef.current;
    if (!exportTarget) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(exportTarget, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          const printable = clonedDoc.getElementById('pdf-printable-timetable');
          if (printable) {
            printable.style.position = 'relative';
            printable.style.left = '0px';
            printable.style.top = '0px';
            printable.style.display = 'block';
            printable.style.visibility = 'visible';
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm
      const margin = 8; // 8mm margin
      const maxW = pageWidth - (margin * 2); // 281mm
      const maxH = pageHeight - (margin * 2); // 194mm

      // Strictly bound within both width and height to guarantee no vertical or horizontal cut-off
      let renderW = maxW;
      let renderH = (canvas.height * maxW) / canvas.width;

      if (renderH > maxH) {
        renderH = maxH;
        renderW = (canvas.width * maxH) / canvas.height;
      }

      // Center horizontally and vertically within available printable area
      const x = margin + (maxW - renderW) / 2;
      const y = margin + (maxH - renderH) / 2;

      pdf.addImage(imgData, 'PNG', x, y, renderW, renderH);
      pdf.save(`Timetable_${activeDepartment?.code || 'Dept'}_Sem_${currentSemester?.number || 'View'}_${academicYear}.pdf`);
      addToast('Timetable PDF exported successfully in official format!', 'success');
    } catch (err) {
      addToast('Failed to export PDF: ' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  // 7. CSV Export Feature (Strict 10-Column Format, Capitalized Headers, Double-Quoted)
  const handleExportCSV = () => {
    try {
      const semNum = currentSemester?.number || '';
      const deptName = activeDepartment?.name || 'Department of Computer Science and Engineering';
      const deptCode = activeDepartment?.code || 'DEPT';
      const semType = ((currentSemester?.number || 1) % 2 === 1) ? 'ODD' : 'EVEN';

      // Always pad array to exact 10 columns to guarantee no ragged layout in spreadsheets
      const padRow = (arr, len = 10) => {
        const res = [...arr];
        while (res.length < len) {
          res.push('');
        }
        return res.slice(0, len);
      };

      // Ensure all cells are properly double-quoted and internal quotes escaped
      const escapeCSV = (val) => {
        const str = val === null || val === undefined ? '' : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const rows = [];

      // Header block (all rows padded to 10 cols)
      rows.push(padRow([`YENEPOYA INSTITUTE OF TECHNOLOGY - DEPARTMENT OF ${deptName.toUpperCase()}`]));
      rows.push(padRow([`CLASS: ${romanSemester} SEMESTER | CLASS ROOM: ${currentSemester?.class_room || 'LLH-04'} | W.E.F: ${wefDate} | AY ${academicYear} (${semType} SEMESTER)`]));
      rows.push(padRow([]));

      // 1. Timetable Matrix Section
      rows.push(padRow(['TIMETABLE SCHEDULE MATRIX']));
      rows.push(padRow([]));
      rows.push(padRow([
        'DAY',
        'PERIOD 1 (09:00 AM - 09:55 AM)',
        'PERIOD 2 (09:55 AM - 10:50 AM)',
        'TEA BREAK (10:50 AM - 11:10 AM)',
        'PERIOD 3 (11:10 AM - 12:05 PM)',
        'PERIOD 4 (12:05 PM - 01:00 PM)',
        'LUNCH BREAK (01:00 PM - 01:50 PM)',
        'PERIOD 5 (01:50 PM - 02:40 PM)',
        'PERIOD 6 (02:40 PM - 03:30 PM)',
        'PERIOD 7 (03:30 PM - 04:15 PM)'
      ]));

      // Daily rows
      DAYS.forEach((day) => {
        const getMergeableSlot = (p) => {
          const es = gridMap.get(`${day}_${p}`) || [];
          if (es.length !== 1) return null;
          const e = es[0];
          const sub = subjects.find(s => String(s.id) === String(e.subject_id));
          const isLab = Boolean(e.is_lab || e.session_type === 'lab' || sub?.is_lab);
          const isBlock = Boolean((sub && (Number(sub.block_session_count) > 0 || Number(sub.block_session_hours) > 1)) || e.session_type === 'block');
          if (isLab || isBlock) {
            return { ...e, is_lab: isLab, is_block: isBlock };
          }
          return null;
        };

        const { mergeMap } = computeLabMerges(getMergeableSlot);

        const getSlotText = (p) => {
          const entries = gridMap.get(`${day}_${p}`) || [];
          if (entries.length === 0) return '—';
          return entries.map(e => {
            const sub = subjects.find(s => String(s.id) === String(e.subject_id));
            const fac = resolveFacultyInfo(sub || e);
            const facStr = fac.code ? ` [${fac.code}]` : (fac.name !== '—' ? ` [${fac.name}]` : '');

            let typeTag = '';
            if (mergeMap.has(p)) {
              typeTag = ` ${mergeMap.get(p).tag}`;
            } else if (e.is_lab || e.session_type === 'lab') {
              typeTag = ' [LAB]';
            } else if (e.session_type === 'activity') {
              typeTag = ' [ACT]';
            }
            return `${e.subject_code || ''}${facStr}${typeTag}`;
          }).join(' / ');
        };

        rows.push(padRow([
          day.toUpperCase(),
          getSlotText(1),
          getSlotText(2),
          'TEA BREAK',
          getSlotText(3),
          getSlotText(4),
          'LUNCH BREAK',
          getSlotText(5),
          getSlotText(6),
          getSlotText(7)
        ]));
      });

      rows.push(padRow([]));

      // 2. Faculty Reference Legend Section
      rows.push(padRow(['FACULTY AND SUBJECT REFERENCE LEGEND']));
      rows.push(padRow([]));
      rows.push(padRow([
        'SUBJECT CODE',
        'SUBJECT TITLE',
        'FACULTY IN-CHARGE',
        'FACULTY CODE',
        'SESSION TYPE',
        'WEEKLY HOURS'
      ]));

      const seen = new Set();
      const legendRows = timetableEntries
        .filter(e => {
          if (!e.subject_code || seen.has(e.subject_code)) return false;
          seen.add(e.subject_code);
          return true;
        })
        .sort((a, b) => (a.subject_code || '').localeCompare(b.subject_code || ''));

      legendRows.forEach(e => {
        const sub = subjects.find(s => String(s.id) === String(e.subject_id)) || {};
        const facInfo = resolveFacultyInfo(sub || e);
        const isLab = Boolean(e.is_lab || e.session_type === 'lab' || sub.is_lab);
        const isBlock = Boolean((sub && (Number(sub.block_session_count) > 0 || Number(sub.block_session_hours) > 1)) || e.session_type === 'block');
        const sessionTypeStr = isLab ? 'Laboratory' : isBlock ? 'Block Theory' : (e.session_type === 'activity' ? 'Activity' : 'Theory');

        rows.push(padRow([
          e.subject_code || sub.code || '',
          e.subject_name || sub.name || '',
          facInfo.name,
          facInfo.code,
          sessionTypeStr,
          String(sub.weekly_hours || e.weekly_hours || '')
        ]));
      });

      rows.push(padRow([]));

      // 3. Class Administration Details Section
      rows.push(padRow(['CLASS ADMINISTRATION DETAILS']));
      rows.push(padRow([]));
      rows.push(padRow(['CLASS ROOM', currentSemester?.class_room || 'LLH-04']));
      rows.push(padRow(['CLASS ADVISOR', currentSemester?.class_advisor || '—']));
      rows.push(padRow(['MENTORS', currentSemester?.mentors || '—']));
      rows.push(padRow([]));

      // Footer
      const todayStr = new Date().toLocaleDateString('en-GB');
      rows.push(padRow([`Generated on ${todayStr} - Smart Timetable Scheduler`]));

      // Build and trigger download
      const csvContent = '\uFEFF' + rows.map(r => r.map(escapeCSV).join(',')).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Timetable_${deptCode}_Sem_${semNum || 'View'}_${academicYear}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast('Timetable CSV exported successfully!', 'success');
      setExportDropdownOpen(false);
    } catch (err) {
      addToast('Failed to export CSV: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-5 pb-10">
      {/* 1. Semester Controls & Action Bar */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Semester Switcher Segmented Control */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase hidden lg:inline">Semester:</span>
          <div className="flex items-center p-1 bg-slate-100 rounded-xl gap-1 overflow-x-auto">
            {filteredSemesters.length === 0 ? (
              <span className="text-xs text-slate-400 italic px-3 py-1.5">No semesters configured for this department</span>
            ) : (
              filteredSemesters.map((s) => {
                const isActive = String(selectedSemesterId) === String(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedSemesterId(s.id);
                      setAcademicYear(s.academic_year || '2025-2026');
                      setLastAction(null);
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                    }`}
                  >
                    <span>Semester {s.number} <span className={isActive ? 'opacity-85 font-normal' : 'text-slate-400 font-normal'}>(S{s.number})</span></span>
                    {s.class_room && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        isActive ? 'bg-black/15 text-white font-bold' : 'bg-slate-200/70 text-slate-600 font-medium'
                      }`}>
                        {s.class_room}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Undo Button */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={!lastAction || undoing}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition shadow-xs ${
              lastAction && !undoing
                ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 cursor-pointer'
                : 'bg-slate-50 border-slate-200/60 text-slate-300 cursor-not-allowed pointer-events-none'
            }`}
            title={lastAction ? `Undo: ${lastAction.description}` : 'No operations to undo'}
          >
            {undoing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
            ) : (
              <RotateCcw className={`w-3.5 h-3.5 ${lastAction ? 'text-slate-600' : 'text-slate-300'}`} />
            )}
            <span>Undo</span>
            {lastAction && !undoing && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClearSemester}
            disabled={timetableEntries.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50/50 border border-slate-200 hover:border-rose-200 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            title="Clear current semester entries"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          {/* Generate Timetable Hero CTA */}
          <button
            type="button"
            onClick={handleAutoGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl shadow-sm shadow-orange-500/20 disabled:opacity-50 transition cursor-pointer"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Solvers...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Timetable <span className="hidden sm:inline">(All Semesters)</span></span>
              </>
            )}
          </button>

          {/* Export Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              type="button"
              onClick={() => setExportDropdownOpen(prev => !prev)}
              disabled={exporting || timetableEntries.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>Export</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {exportDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    handleExportPDF();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-800">Export as PDF</div>
                    <div className="text-[10px] text-slate-400 font-normal">Official Institutional Format (.pdf)</div>
                  </div>
                </button>

                <div className="border-t border-slate-100 my-0.5" />

                <button
                  type="button"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    handleExportCSV();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-800">Export as CSV</div>
                    <div className="text-[10px] text-slate-400 font-normal">Spreadsheet / Excel Format (.csv)</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Schedule Header & Metadata Card */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Title and Metadata */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {activeDepartment ? `${activeDepartment.name} — ` : ''}Semester {currentSemester?.number || ''} Weekly Schedule
              </h1>
              {activeDepartment?.code && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold text-[11px]">
                  {activeDepartment.code}
                </span>
              )}
            </div>

            {/* Metadata Pill Badges */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Room:</span>
                <span className="font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                  {currentSemester?.class_room || 'Not set'}
                </span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Academic Year:</span>
                <span className="font-medium text-slate-700">{academicYear}</span>
              </div>
              {currentSemester?.class_advisor && (
                <>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Advisor:</span>
                    <span className="font-medium text-slate-700">{currentSemester.class_advisor}</span>
                  </div>
                </>
              )}
              {currentSemester?.mentors && (
                <>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Mentors:</span>
                    <span className="font-medium text-slate-700">{currentSemester.mentors}</span>
                  </div>
                </>
              )}
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={handleOpenSemesterModal}
                className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium transition cursor-pointer"
                title="Edit Classroom, Class Advisor, and Mentors"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>
            </div>
          </div>

          {/* Right: Status & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:border-l lg:border-slate-100 lg:pl-6">
            {/* Periods Counter */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/50">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>{timetableEntries.length} periods scheduled</span>
            </div>

            {/* Interactive Legend Pill Bar */}
            <div className="flex items-center gap-2.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-100" />
                <span className="font-medium">Theory</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-100" />
                <span className="font-medium">Lab</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-400 ring-2 ring-orange-100" />
                <span className="font-medium">Block</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                <span className="font-medium">Activity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-purple-100" />
                <span className="font-medium">Parallel</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Modern Timetable Grid Section */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col p-4 sm:p-5">
        <div ref={gridRef} className="overflow-x-auto">
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
                <th className="py-2 px-1.5 text-center" scope="col">
                  <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 1</span>
                  <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[1]}</span>
                </th>
                <th className="py-2 px-1.5 text-center" scope="col">
                  <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 2</span>
                  <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[2]}</span>
                </th>
                {/* Tea Break Header */}
                <th className="py-2 px-0.5 text-center bg-amber-50/60 border-x border-amber-100" scope="col">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[11px]">☕</span>
                    <span className="text-[9.5px] font-bold text-amber-800 uppercase tracking-tighter mt-0.5">Tea</span>
                    <span className="text-[8.5px] font-medium text-amber-600/80">10:50-11:10</span>
                  </div>
                </th>
                <th className="py-2 px-1.5 text-center" scope="col">
                  <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 3</span>
                  <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[3]}</span>
                </th>
                <th className="py-2 px-1.5 text-center" scope="col">
                  <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 4</span>
                  <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[4]}</span>
                </th>
                {/* Lunch Break Header */}
                <th className="py-2 px-0.5 text-center bg-orange-50/60 border-x border-orange-100" scope="col">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[11px]">🍽️</span>
                    <span className="text-[9.5px] font-bold text-orange-800 uppercase tracking-tighter mt-0.5">Lunch</span>
                    <span className="text-[8.5px] font-medium text-orange-600/80">13:00-13:50</span>
                  </div>
                </th>
                <th className="py-2 px-1.5 text-center" scope="col">
                  <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 5</span>
                  <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[5]}</span>
                </th>
                <th className="py-2 px-1.5 text-center" scope="col">
                  <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 6</span>
                  <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[6]}</span>
                </th>
                <th className="py-2 px-1.5 text-center" scope="col">
                  <span className="block text-xs font-bold text-slate-800 tracking-tight">PERIOD 7</span>
                  <span className="block text-[10px] font-normal text-slate-400 font-mono mt-0.5">{PERIOD_TIMES[7]}</span>
                </th>
              </tr>
            </thead>

            {/* Table Body with Grid Slots */}
            <tbody className="divide-y divide-slate-200">
              {DAYS.map((day) => {
                const getMergeableSlot = (p) => {
                  const es = gridMap.get(`${day}_${p}`) || [];
                  if (es.length !== 1) return null;
                  const e = es[0];
                  const sub = subjects.find(s => String(s.id) === String(e.subject_id));
                  const isLab = Boolean(e.is_lab || e.session_type === 'lab' || sub?.is_lab);
                  const isBlock = Boolean((sub && (Number(sub.block_session_count) > 0 || Number(sub.block_session_hours) > 1)) || e.session_type === 'block');
                  if (isLab || isBlock) {
                    return { ...e, is_lab: isLab, is_block: isBlock };
                  }
                  return null;
                };

                const { mergeMap, skipPeriods } = computeLabMerges(getMergeableSlot);

                const renderPeriodTd = (p) => {
                  if (skipPeriods.has(p)) return null;
                  const mergeInfo = mergeMap.get(p);
                  const isDragOver = dragOverKey === `${day}_${p}`;
                  return (
                    <td
                      key={p}
                      colSpan={mergeInfo ? mergeInfo.span : 1}
                      onClick={() => handleSlotClick(day, p)}
                      onDragOver={(e) => handleDragOver(e, day, p)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, p)}
                      className={`p-1.5 border-r border-slate-200 transition-colors cursor-pointer ${
                        isDragOver ? 'bg-orange-100/70 ring-2 ring-orange-400 ring-inset' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {mergeInfo ? (
                        <MergedLabCell
                          entry={(gridMap.get(`${day}_${p}`) || [])[0]}
                          timeRange={mergeInfo.timeRange}
                          span={mergeInfo.span}
                          onDragStart={(e, entry) => handleDragStart(e, entry, day, p)}
                        />
                      ) : (
                        <SlotCell
                          entries={gridMap.get(`${day}_${p}`)}
                          onDragStart={(e, entry) => handleDragStart(e, entry, day, p)}
                        />
                      )}
                    </td>
                  );
                };

                return (
                  <tr key={day} className="hover:bg-slate-50/40 transition-colors">
                    {/* Day Name */}
                    <td className="px-2 py-2 font-bold text-xs text-slate-700 text-center bg-slate-50/70 border-r border-slate-200">
                      <span className="hidden xl:inline">{day}</span>
                      <span className="xl:hidden">{day.slice(0, 3).toUpperCase()}</span>
                    </td>

                    {renderPeriodTd(1)}
                    {renderPeriodTd(2)}

                    {/* Tea Break Separator Strip */}
                    <td className="bg-amber-50/20 text-center border-r border-amber-100 py-1">
                      <div className="flex flex-col items-center justify-center select-none gap-1">
                        <span className="w-1 h-1 rounded-full bg-amber-300"></span>
                        <span className="w-1 h-1 rounded-full bg-amber-300"></span>
                        <span className="w-1 h-1 rounded-full bg-amber-300"></span>
                      </div>
                    </td>

                    {renderPeriodTd(3)}
                    {renderPeriodTd(4)}

                    {/* Lunch Break Separator Strip */}
                    <td className="bg-orange-50/20 text-center border-r border-orange-100 py-1">
                      <div className="flex flex-col items-center justify-center select-none gap-1">
                        <span className="w-1 h-1 rounded-full bg-orange-300"></span>
                        <span className="w-1 h-1 rounded-full bg-orange-300"></span>
                        <span className="w-1 h-1 rounded-full bg-orange-300"></span>
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

        {/* ── Subject Reference Legend (below grid) ── */}
        {timetableEntries.length > 0 && (() => {
          const seen = new Set();
          const legendRows = timetableEntries
            .filter(e => { if (seen.has(e.subject_code)) return false; seen.add(e.subject_code); return true; })
            .sort((a, b) => (a.subject_code || '').localeCompare(b.subject_code || ''));
          return (
            <div className="mt-6 border-t border-slate-200/80 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Subject & Faculty Reference</h3>
                <span className="text-[11px] text-slate-400">{legendRows.length} subjects allocated</span>
              </div>
              <div className="rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200">
                      <th className="px-4 py-2.5 w-32 font-mono">Code</th>
                      <th className="px-4 py-2.5">Subject Name</th>
                      <th className="px-4 py-2.5 w-72">Faculty In-Charge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {legendRows.map((entry) => {
                      const sub = subjects.find(s => String(s.id) === String(entry.subject_id));
                      const facInfo = resolveFacultyInfo(sub || entry);
                      return (
                        <tr key={entry.subject_code} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-2 font-mono font-bold text-slate-900">
                            {entry.subject_code}
                          </td>
                          <td className="px-4 py-2 text-slate-700 font-medium">
                            {entry.subject_name || sub?.name}
                          </td>
                          <td className="px-4 py-2 text-slate-600">
                            <span>{facInfo.name}</span>
                            {facInfo.code && (
                              <span className="font-mono text-[10px] text-slate-400 ml-1.5">[{facInfo.code}]</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </section>

      {/* Moving slot spinner overlay */}
      {movingSlot && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl px-6 py-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span className="text-sm font-semibold text-slate-700">Moving subject...</span>
          </div>
        </div>
      )}

      {/* Parallel / Replace Confirmation Dialog */}
      {parallelDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full mx-4 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Top-right Cancel Cross Icon */}
            <button
              type="button"
              onClick={handleDismissParallel}
              aria-label="Cancel"
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-bold text-slate-900 text-base">Slot Already Occupied</p>
                <p className="text-xs text-slate-500 mt-1">
                  Dropping <span className="font-mono font-bold text-slate-800">{parallelDialog.drag.subjectCode}</span> onto{' '}
                  <span className="font-semibold text-slate-700">{parallelDialog.targetDay} P{parallelDialog.targetPeriod}</span> which already contains{' '}
                  <span className="font-mono font-bold text-slate-800">{parallelDialog.targetEntries[0]?.subject_code}</span>.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                <span className="text-slate-600 truncate">
                  Current: <strong>{parallelDialog.targetEntries[0]?.subject_code}</strong> — {parallelDialog.targetEntries[0]?.subject_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                <span className="text-slate-600 truncate">
                  Incoming: <strong>{parallelDialog.drag.subjectCode}</strong>
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Run both subjects in parallel, or replace the current subject?
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmParallel}
                disabled={parallelDialog.targetEntries.length >= 2}
                className="flex-1 py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                title="Schedule both subjects in parallel"
              >
                Yes, make parallel
              </button>
              <button
                type="button"
                onClick={handleReplaceSlot}
                className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
                title={`Replace ${parallelDialog.targetEntries[0]?.subject_code} with ${parallelDialog.drag.subjectCode}`}
              >
                No, replace {parallelDialog.targetEntries[0]?.subject_code}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    className={`text-xs font-semibold px-2 py-1 rounded transition-colors flex items-center gap-1 ${replaceEntireSlot
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
                        className={`px-3 py-1.5 text-xs font-bold rounded-l-lg border transition-all flex items-center gap-1.5 ${selectedOccupantIndex === idx
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
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
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border border-dashed transition-all flex items-center gap-1 ${selectedOccupantIndex === 'new'
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
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white font-medium"
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
                  className={`py-2 px-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${customSessionType === 'theory'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <span>📘 Theory (1h)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomSessionType('lab')}
                  className={`py-2 px-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${customSessionType === 'lab'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  <span>🔬 Lab / Practical</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomSessionType('activity')}
                  className={`py-2 px-2.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${customSessionType === 'activity'
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
              <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
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
            <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0" />
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
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-40 transition-colors"
            >
              {savingSlot && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Slot
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Semester Info Modal (Class Advisor / Mentors) ── */}
      <Modal
        isOpen={semesterModalOpen}
        onClose={() => setSemesterModalOpen(false)}
        title="Edit Semester Details"
      >
        <form onSubmit={handleSaveSemesterInfo} className="space-y-5">
          <p className="text-sm text-slate-500 -mt-2">
            Update the class room, class advisor, and mentors for{' '}
            <strong className="text-slate-700">
              Semester {currentSemester?.number}
            </strong>
            .
          </p>

          {/* Class Room */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Class Room
            </label>
            <input
              type="text"
              value={semesterFormData.class_room}
              onChange={e =>
                setSemesterFormData(prev => ({ ...prev, class_room: e.target.value }))
              }
              placeholder="e.g. Room 301 / CS Lab"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>

          {/* Class Advisor */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Class Advisor
            </label>
            <input
              type="text"
              value={semesterFormData.class_advisor}
              onChange={e =>
                setSemesterFormData(prev => ({ ...prev, class_advisor: e.target.value }))
              }
              placeholder="e.g. Prof. Ravi Kumar"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>

          {/* Mentors */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
              Mentors
              <span className="ml-1 font-normal text-slate-400 normal-case">
                (separate multiple mentors with " / ")
              </span>
            </label>
            <input
              type="text"
              value={semesterFormData.mentors}
              onChange={e =>
                setSemesterFormData(prev => ({ ...prev, mentors: e.target.value }))
              }
              placeholder="e.g. Prof. Aisha / Prof. Nair"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSemesterModalOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSemesterInfo}
              className="px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {savingSemesterInfo ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Saving…
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Official Institutional Print Layout for High-Res Single-Page PDF Export ── */}
      <div
        id="pdf-printable-timetable"
        ref={printRef}
        style={{
          position: 'absolute',
          left: '-99999px',
          top: 0,
          width: '1120px',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif",
        }}
        className="p-5 bg-white text-slate-900 border-2 border-slate-900 box-border"
      >
        {/* 1. Official Centered Header Block */}
        <div className="text-center border-b-2 border-slate-900 pb-2 mb-2 relative">
          <div className="absolute left-1 top-0 border-2 border-slate-900 px-3 py-1 font-serif font-black text-sm tracking-wider">
            YIT
          </div>
          {activeDepartment?.code && (
            <div className="absolute right-1 top-0 border border-slate-800 bg-slate-50 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase">
              DEPT: {activeDepartment.code}
            </div>
          )}
          <h1 className="text-[17px] font-black tracking-wide uppercase font-serif text-slate-950 leading-tight">
            Yenepoya Institute of Technology
          </h1>
          <p className="text-[9px] text-slate-600 font-medium tracking-normal">
            NH-13, Thodar, Moodbidri, Mangalore, Karnataka - 574225
          </p>
          <p className="text-[12px] font-extrabold text-slate-900 mt-0.5">
            Department of {activeDepartment?.name || 'Computer Science and Engineering'}
          </p>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-800 mt-0.5">
            AY {academicYear} • {((currentSemester?.number || 1) % 2 === 1) ? 'ODD' : 'EVEN'} SEMESTER
          </div>
        </div>

        {/* 2. Class-Info Bar */}
        <div className="border border-slate-800 text-[10px] font-bold uppercase mb-2 text-center py-1 bg-slate-50 flex items-center justify-center divide-x divide-slate-800">
          <div className="px-5">
            <span className="text-slate-600 font-semibold mr-1">CLASS:</span>
            <span className="text-slate-950 font-black">{romanSemester} SEMESTER</span>
          </div>
          <div className="px-5">
            <span className="text-slate-600 font-semibold mr-1">CLASS ROOM:</span>
            <span className="text-slate-950 font-black">{currentSemester?.class_room || 'LLH-04'}</span>
          </div>
          <div className="px-5">
            <span className="text-slate-600 font-semibold mr-1">W.E.F:</span>
            <span className="text-slate-950 font-black">{wefDate}</span>
          </div>
        </div>

        {/* 3. Official Timetable Grid */}
        <table className="w-full border-collapse border border-slate-800 text-center text-xs mb-2.5 table-fixed">
          <thead className="bg-slate-100">
            <tr className="text-slate-900 font-bold text-[9px] uppercase">
              <th className="border border-slate-800 py-1 px-1 w-[80px]">DAY \ PERIOD</th>
              <th className="border border-slate-800 py-1 px-1">
                <div>PERIOD 1</div>
                <div className="text-[7.5px] font-mono font-normal text-slate-600">09:00 - 09:55</div>
              </th>
              <th className="border border-slate-800 py-1 px-1">
                <div>PERIOD 2</div>
                <div className="text-[7.5px] font-mono font-normal text-slate-600">09:55 - 10:50</div>
              </th>
              <th className="border border-slate-800 py-1 px-0.5 w-[24px] text-[7.5px] bg-slate-200/80 text-slate-800 font-extrabold">
                TEA
              </th>
              <th className="border border-slate-800 py-1 px-1">
                <div>PERIOD 3</div>
                <div className="text-[7.5px] font-mono font-normal text-slate-600">11:10 - 12:05</div>
              </th>
              <th className="border border-slate-800 py-1 px-1">
                <div>PERIOD 4</div>
                <div className="text-[7.5px] font-mono font-normal text-slate-600">12:05 - 13:00</div>
              </th>
              <th className="border border-slate-800 py-1 px-0.5 w-[24px] text-[7.5px] bg-slate-200/80 text-slate-800 font-extrabold">
                LUNCH
              </th>
              <th className="border border-slate-800 py-1 px-1">
                <div>PERIOD 5</div>
                <div className="text-[7.5px] font-mono font-normal text-slate-600">13:50 - 14:40</div>
              </th>
              <th className="border border-slate-800 py-1 px-1">
                <div>PERIOD 6</div>
                <div className="text-[7.5px] font-mono font-normal text-slate-600">14:40 - 15:30</div>
              </th>
              <th className="border border-slate-800 py-1 px-1">
                <div>PERIOD 7</div>
                <div className="text-[7.5px] font-mono font-normal text-slate-600">15:30 - 16:15</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dIdx) => {
              const getMergeableSlot = (p) => {
                const es = gridMap.get(`${day}_${p}`) || [];
                if (es.length !== 1) return null;
                const e = es[0];
                const sub = subjects.find(s => String(s.id) === String(e.subject_id));
                const isLab = Boolean(e.is_lab || e.session_type === 'lab' || sub?.is_lab);
                const isBlock = Boolean((sub && (Number(sub.block_session_count) > 0 || Number(sub.block_session_hours) > 1)) || e.session_type === 'block');
                if (isLab || isBlock) {
                  return { ...e, is_lab: isLab, is_block: isBlock };
                }
                return null;
              };

              const { mergeMap, skipPeriods } = computeLabMerges(getMergeableSlot);

              const renderPrintCell = (items) => {
                if (!items || items.length === 0) return <span className="text-slate-300 font-mono text-[10px]">—</span>;
                if (items.length === 1) {
                  const it = items[0];
                  const sub = subjects.find(s => String(s.id) === String(it.subject_id));
                  const fac = resolveFacultyInfo(sub || it);
                  const isLab = Boolean(it.is_lab || it.session_type === 'lab' || sub?.is_lab);
                  const isBlock = Boolean((sub && (Number(sub.block_session_count) > 0 || Number(sub.block_session_hours) > 1)) || it.session_type === 'block');

                  return (
                    <div className="h-full flex flex-col items-center justify-center py-0.5 leading-tight">
                      <span className="font-mono font-bold text-[11px] text-slate-950 tracking-tight">{it.subject_code}</span>
                      {fac.code && (
                        <span className="text-[7.5px] font-mono text-slate-600">[{fac.code}]</span>
                      )}
                      {isLab ? (
                        <span className="text-[7px] font-mono font-bold text-slate-700 mt-0.5">[LAB]</span>
                      ) : isBlock ? (
                        <span className="text-[7px] font-mono font-bold text-slate-700 mt-0.5">[BLOCK]</span>
                      ) : it.session_type === 'activity' ? (
                        <span className="text-[7px] font-mono font-semibold text-slate-600 mt-0.5">[ACT]</span>
                      ) : null}
                    </div>
                  );
                }

                // Parallel activities (NSS/PE): stacked slots within the cell, not overlapping, with subject code & faculty code
                return (
                  <div className="h-full flex flex-col items-center justify-center gap-0.5 py-0.5 leading-tight">
                    {items.map((it, idx) => {
                      const sub = subjects.find(s => String(s.id) === String(it.subject_id));
                      const fac = resolveFacultyInfo(sub || it);
                      return (
                        <div key={idx} className={idx > 0 ? "border-t border-slate-300 pt-0.5 w-full text-center" : "w-full text-center"}>
                          <span className="font-mono font-bold text-[9px] text-slate-950">{it.subject_code}</span>
                          {fac.code && (
                            <span className="text-[7.5px] font-mono font-semibold text-slate-600 ml-1">[{fac.code}]</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              };

              const renderPrintPeriodTd = (p) => {
                if (skipPeriods.has(p)) return null;
                const mergeInfo = mergeMap.get(p);
                const items = gridMap.get(`${day}_${p}`) || [];

                if (mergeInfo) {
                  const entry = items[0];
                  const sub = subjects.find(s => String(s.id) === String(entry?.subject_id));
                  const fac = resolveFacultyInfo(sub || entry);

                  return (
                    <td key={p} colSpan={mergeInfo.span} style={{ backgroundColor: '#ffffff' }} className="border border-slate-800 p-1 text-center align-middle">
                      <div className="h-full flex flex-col items-center justify-center py-0.5 leading-tight">
                        <span className="font-mono font-bold text-[11.5px] text-slate-950 tracking-tight">{entry?.subject_code}</span>
                        {fac.code && (
                          <span className="text-[8px] font-mono font-semibold text-slate-600">[{fac.code}]</span>
                        )}
                        <span className="text-[8px] font-mono font-bold text-slate-800 uppercase tracking-wide mt-0.5">
                          {mergeInfo.tag}
                        </span>
                        <span className="text-[7.5px] font-mono text-slate-500">
                          {mergeInfo.timeRange}
                        </span>
                      </div>
                    </td>
                  );
                }

                return (
                  <td key={p} style={{ backgroundColor: '#ffffff' }} className="border border-slate-800 p-1 align-middle">
                    {renderPrintCell(items)}
                  </td>
                );
              };

              return (
                <tr key={day} className="h-9">
                  <td className="border border-slate-800 bg-slate-100/70 font-bold text-slate-950 text-[10px] uppercase tracking-wider py-0.5 px-1 align-middle">
                    {day}
                  </td>

                  {/* Period 1 & 2 */}
                  {renderPrintPeriodTd(1)}
                  {renderPrintPeriodTd(2)}

                  {/* Tea Break: spanning all 6 rows */}
                  {dIdx === 0 && (
                    <td rowSpan={6} className="border border-slate-800 bg-slate-100 text-center py-1 px-0.5 w-[24px] align-middle">
                      <div className="flex flex-col items-center justify-center font-bold text-[7.5px] tracking-widest text-slate-700 leading-tight">
                        <span>T</span>
                        <span>E</span>
                        <span>A</span>
                        <span className="my-0.5 text-[5px] text-slate-500">•</span>
                        <span>B</span>
                        <span>R</span>
                        <span>E</span>
                        <span>A</span>
                        <span>K</span>
                      </div>
                    </td>
                  )}

                  {/* Period 3 & 4 */}
                  {renderPrintPeriodTd(3)}
                  {renderPrintPeriodTd(4)}

                  {/* Lunch Break: spanning all 6 rows */}
                  {dIdx === 0 && (
                    <td rowSpan={6} className="border border-slate-800 bg-slate-100 text-center py-1 px-0.5 w-[24px] align-middle">
                      <div className="flex flex-col items-center justify-center font-bold text-[7.5px] tracking-widest text-slate-700 leading-tight">
                        <span>L</span>
                        <span>U</span>
                        <span>N</span>
                        <span>C</span>
                        <span>H</span>
                        <span className="my-0.5 text-[5px] text-slate-500">•</span>
                        <span>B</span>
                        <span>R</span>
                        <span>E</span>
                        <span>A</span>
                        <span>K</span>
                      </div>
                    </td>
                  )}

                  {/* Period 5, 6, 7 */}
                  {renderPrintPeriodTd(5)}
                  {renderPrintPeriodTd(6)}
                  {renderPrintPeriodTd(7)}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 4. Faculty Legend Table (2-Column Format Sorted by Subject Code Ascending) */}
        {(() => {
          const seen = new Set();
          const printLegend = timetableEntries
            .filter(e => {
              if (!e.subject_code || seen.has(e.subject_code)) return false;
              seen.add(e.subject_code);
              return true;
            })
            .sort((a, b) => (a.subject_code || '').localeCompare(b.subject_code || ''));

          const advisor = currentSemester?.class_advisor || '—';
          const mentors = currentSemester?.mentors || '—';

          return (
            <div className="border border-slate-800 mb-2.5 text-xs">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold text-[9px] uppercase border-b border-slate-800">
                    <th className="border-r border-slate-800 px-3 py-1">Subject Code & Title</th>
                    <th className="px-3 py-1 w-72">Faculty In-Charge</th>
                  </tr>
                </thead>
                <tbody>
                  {printLegend.map((it, idx) => {
                    const sub = subjects.find(s => String(s.id) === String(it.subject_id));
                    const facInfo = resolveFacultyInfo(sub || it);
                    return (
                      <tr key={it.subject_code || idx} className="border-b border-slate-200 even:bg-slate-50/50 text-[9.5px]">
                        <td className="border-r border-slate-800 px-3 py-0.5 text-slate-900">
                          <span className="font-mono font-bold text-slate-950 mr-2">{it.subject_code}</span>
                          <span className="text-slate-800 font-medium">{it.subject_name || sub?.name}</span>
                        </td>
                        <td className="px-3 py-0.5 text-slate-900 font-medium">
                          <span>{facInfo.name}</span>
                          {facInfo.code && (
                            <span className="font-mono text-[8.5px] text-slate-600 font-normal ml-1.5">[{facInfo.code}]</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Advisor and Mentors footer row */}
                  <tr className="bg-slate-100/70 border-t border-slate-800 font-semibold text-[9.5px] text-slate-900">
                    <td className="border-r border-slate-800 px-3 py-1">
                      <strong className="text-slate-950 font-bold">Class Advisor:</strong>{' '}
                      <span className="text-slate-800 font-medium">{advisor}</span>
                    </td>
                    <td className="px-3 py-1">
                      <strong className="text-slate-950 font-bold">Mentors:</strong>{' '}
                      <span className="text-slate-800 font-medium">{mentors}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* 5. Institutional Signatures Footer */}
        <div className="grid grid-cols-3 text-center text-[10.5px] font-bold pt-1.5">
          <div>
            <div className="h-4" />
            <div className="border-t border-slate-800 pt-0.5 inline-block min-w-[170px] text-slate-900">
              Time Table Coordinator
            </div>
          </div>
          <div>
            <div className="h-4" />
            <div className="border-t border-slate-800 pt-0.5 inline-block min-w-[170px] text-slate-900">
              Head of Department
            </div>
          </div>
          <div>
            <div className="h-4" />
            <div className="border-t border-slate-800 pt-0.5 inline-block min-w-[170px] text-slate-900">
              <div>Principal</div>
              <div className="text-[7px] font-normal text-slate-600 uppercase mt-0.5 leading-tight">
                Yenepoya Institute of Technology<br />
                N.H.13, Thodar, Moodbidri - 574225
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Session type styling config
const SESSION_STYLES = {
  theory: { bg: 'bg-blue-50/50 hover:bg-blue-50/80', border: 'border-blue-200/80', text: 'text-blue-950', badge: 'bg-blue-100 text-blue-800', label: 'Theory' },
  lab: { bg: 'bg-amber-50/60 hover:bg-amber-50', border: 'border-amber-200', text: 'text-amber-950', badge: 'bg-amber-200/70 text-amber-900', label: 'LAB' },
  block: { bg: 'bg-orange-50/60 hover:bg-orange-50', border: 'border-orange-200', text: 'text-orange-950', badge: 'bg-orange-200/70 text-orange-900', label: 'BLOCK' },
  activity: { bg: 'bg-emerald-50/50 hover:bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-950', badge: 'bg-emerald-100 text-emerald-800', label: 'ACT' },
};

// Merged Lab Cell — rendered when 2 or 3 consecutive periods share the same lab/block subject.
function MergedLabCell({ entry, timeRange, span = 2, onDragStart }) {
  if (!entry) {
    return (
      <div className="h-14 sm:h-15 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center text-slate-400 text-xs font-medium transition-colors">
        + Free
      </div>
    );
  }

  const isLab = Boolean(entry.is_lab || entry.session_type === 'lab');
  const cardBg = isLab
    ? 'bg-amber-50/70 hover:bg-amber-100/60 border-amber-200/90'
    : 'bg-orange-50/70 hover:bg-orange-100/60 border-orange-200/90';
  const textCode = isLab ? 'text-amber-950' : 'text-orange-950';
  const textFac = isLab ? 'text-amber-800/90' : 'text-orange-800/90';
  const badgeBg = isLab ? 'bg-amber-200 text-amber-900' : 'bg-orange-200 text-orange-900';
  const hoursBg = isLab ? 'bg-amber-100 text-amber-800' : 'bg-orange-100 text-orange-800';
  const labelText = isLab ? 'LAB' : 'BLOCK';

  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart && onDragStart(e, entry); }}
      onClick={(e) => e.stopPropagation()}
      className={`group relative h-14 sm:h-15 border rounded-xl p-2 flex flex-col justify-between transition shadow-xs hover:shadow cursor-grab active:cursor-grabbing active:opacity-60 select-none ${cardBg}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`font-bold text-xs ${textCode} truncate tracking-tight`}>{entry.subject_code}</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`px-1 py-0.2 rounded font-bold text-[9px] uppercase ${badgeBg}`}>{labelText}</span>
          <span className={`px-1 py-0.2 rounded font-semibold text-[9px] ${hoursBg}`}>{span}h</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-1 text-[10px] leading-tight">
        <span className={`font-medium ${textFac} truncate`}>{entry.faculty_code || entry.faculty_name}</span>
        <span className="text-[9.5px] font-mono text-slate-400 shrink-0">{timeRange}</span>
      </div>
    </div>
  );
}

// Compact Slot Renderer — shows subject code, faculty, session badge & duration.
function SlotCell({ entries, onDragStart }) {
  const items = Array.isArray(entries) ? entries : (entries ? [entries] : []);

  if (items.length === 0) {
    return (
      <div className="h-14 sm:h-15 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-500 text-xs font-medium transition-colors">
        + Free
      </div>
    );
  }

  // Multiple occupants in same slot = parallel activities (NSS/PE split)
  if (items.length > 1) {
    return (
      <div className="h-14 sm:h-15 bg-purple-50/60 hover:bg-purple-50 border border-purple-200 rounded-xl p-1 flex flex-col justify-around transition shadow-xs hover:shadow">
        {items.map((entry, idx) => (
          <div
            key={entry.id || idx}
            draggable
            onDragStart={(e) => { e.stopPropagation(); onDragStart && onDragStart(e, entry); }}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between px-1.5 py-0.5 bg-white/90 rounded border border-purple-100 cursor-grab active:cursor-grabbing active:opacity-60 transition text-[10px]"
          >
            <span className="font-mono font-bold text-purple-900 truncate">{entry.subject_code}</span>
            <span className="text-[8.5px] font-bold text-purple-700 bg-purple-100 px-1 rounded shrink-0">PAR</span>
          </div>
        ))}
      </div>
    );
  }

  const entry = items[0];
  const sessionType = entry.session_type || (entry.is_lab ? 'lab' : 'theory');
  const style = SESSION_STYLES[sessionType] || SESSION_STYLES.theory;

  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart && onDragStart(e, entry); }}
      onClick={(e) => e.stopPropagation()}
      className={`h-14 sm:h-15 border rounded-xl p-2 flex flex-col justify-between transition shadow-xs hover:shadow cursor-grab active:cursor-grabbing active:opacity-60 select-none ${style.bg} ${style.border} ${style.text}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-xs tracking-tight truncate">{entry.subject_code}</span>
        <span className={`text-[9px] font-bold uppercase px-1 py-0.2 rounded shrink-0 ${style.badge}`}>
          {sessionType === 'theory' ? '1h' : (sessionType === 'activity' ? 'ACT' : (sessionType === 'lab' ? 'LAB' : sessionType))}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] leading-tight">
        <span className="text-slate-600 truncate font-medium">{entry.faculty_code || entry.faculty_name}</span>
        {entry.room_number && (
          <span className="text-[9px] text-slate-400 font-mono shrink-0">{entry.room_number}</span>
        )}
      </div>
    </div>
  );
}
