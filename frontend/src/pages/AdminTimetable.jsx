import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { YIT_LOGO_BASE64 } from '../assets/yitLogoBase64.js';
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
  UserX,
  Plus,
  CalendarOff,
  ChevronRight,
  Info,
  GraduationCap
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

export default function AdminTimetable({ onNavigateToMasterData }) {
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
  // For block (2h lab/theory) drags, the full block info is stored atomically:
  // { isBlock, span, entries: [{id, timeslot_id, ...}, ...], subjectId, subjectCode, sessionType, fromDay, fromPeriods: [p, p+1], fromTimeslotIds: [id1, id2] }
  // For single-slot drags: { isBlock: false, entryId, subjectId, subjectCode, fromTimeslotId, fromDay, fromPeriod, sessionType }
  const dragState = useRef(null);
  const [dragOverKeys, setDragOverKeys] = useState(new Set()); // set of 'Day_P' strings highlighted during drag-over
  const [parallelDialog, setParallelDialog] = useState(null); // { drag, targetEntries, targetTimeslotId, targetDay, targetPeriod }
  const [movingSlot, setMovingSlot] = useState(false);
  const [lastAction, setLastAction] = useState(null); // { type, description, data }
  const [undoing, setUndoing] = useState(false);

  // Context Menu state (Right-click slot to remove)
  const [contextMenu, setContextMenu] = useState(null); // { x, y, day, period, isBlock, span, entries }

  // Dismiss context menu on click outside, scroll, or Escape key
  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Semester Info Edit Modal state (Classroom, Advisor, Mentors)
  const [semesterModalOpen, setSemesterModalOpen] = useState(false);
  const [semesterFormData, setSemesterFormData] = useState({ class_room: '', class_advisor: '', mentors: '' });
  const [savingSemesterInfo, setSavingSemesterInfo] = useState(false);

  // Faculty External Commitments (busy slots) state
  const [busySlots, setBusySlots] = useState([]);
  const [busySlotsExpanded, setBusySlotsExpanded] = useState(false);
  const [busySlotForm, setBusySlotForm] = useState({ faculty_id: '', timeslot_ids: [], reason: '' });
  const [savingBusySlot, setSavingBusySlot] = useState(false);
  const [removingBusySlotId, setRemovingBusySlotId] = useState(null);
  const [busySlotsLoading, setBusySlotsLoading] = useState(false);

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const deptId = activeDepartment?.id;
        const [semRes, subRes, tsRes, calRes, facRes] = await Promise.all([
          api.getSemesters(deptId ? { department_id: deptId } : {}),
          api.getSubjects(deptId ? { department_id: deptId } : {}),
          api.getTimeslots(),
          api.getCalendar().catch(() => []),
          api.getFaculty(deptId ? { department_id: deptId } : {}).catch(() => [])
        ]);
        setSemesters(semRes || []);
        setSubjects(subRes || []);
        setTimeslots(tsRes || []);
        setCalendarDates(Array.isArray(calRes) ? calRes : []);
        setFacultyList(Array.isArray(facRes) ? facRes : []);

        const activeSemList = activeDepartment?.id
          ? (semRes || []).filter(s => String(s.department_id) === String(activeDepartment.id))
          : (semRes || []);

        if (activeSemList.length > 0) {
          setSelectedSemesterId(activeSemList[0].id);
          setAcademicYear(activeSemList[0].academic_year || '2026-27');
        } else {
          // Strict multi-tenant isolation: NEVER fall back to another department's semesters!
          setSelectedSemesterId('');
          setTimetableEntries([]);
        }
      } catch (err) {
        addToast(err.message || 'Failed to initialize timetable view', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [activeDepartment?.id]);

  // Filter semesters by active department if set
  const filteredSemesters = activeDepartment?.id
    ? semesters.filter(s => String(s.department_id) === String(activeDepartment.id))
    : semesters;

  // Filter subjects by active department if set
  const filteredSubjects = activeDepartment?.id
    ? subjects.filter(s => String(s.department_id) === String(activeDepartment.id))
    : subjects;

  // Filter faculty by active department if set
  const filteredFaculty = activeDepartment?.id
    ? facultyList.filter(f => String(f.department_id) === String(activeDepartment.id))
    : facultyList;

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
  }, [activeDepartment?.id, semesters]);

  // Fetch timetable entries whenever selected semester or academic year changes
  const fetchTimetable = async () => {
    if (!selectedSemesterId) {
      setTimetableEntries([]);
      return;
    }
    // Verify that selectedSemesterId belongs to the active department
    if (activeDepartment?.id && filteredSemesters.length > 0) {
      const belongsToDept = filteredSemesters.some(s => String(s.id) === String(selectedSemesterId));
      if (!belongsToDept) {
        setSelectedSemesterId(filteredSemesters[0]?.id || '');
        setTimetableEntries([]);
        return;
      }
    }
    try {
      const entries = await api.getTimetable({
        semester_id: selectedSemesterId,
        academic_year: academicYear,
        department_id: activeDepartment?.id
      });
      setTimetableEntries(entries || []);
    } catch (err) {
      addToast(err.message || 'Failed to fetch timetable entries', 'error');
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [selectedSemesterId, academicYear]);

  // Fetch faculty busy slots whenever the academic year or panel opens
  const fetchBusySlots = async () => {
    setBusySlotsLoading(true);
    try {
      const slots = await api.getFacultyBusySlots({ academic_year: academicYear });
      setBusySlots(Array.isArray(slots) ? slots : []);
    } catch (err) {
      addToast('Failed to load external commitments.', 'error');
    } finally {
      setBusySlotsLoading(false);
    }
  };

  useEffect(() => {
    if (busySlotsExpanded) fetchBusySlots();
  }, [busySlotsExpanded, academicYear]);

  const handleAddBusySlots = async () => {
    if (!busySlotForm.faculty_id || busySlotForm.timeslot_ids.length === 0) {
      addToast('Select a faculty member and at least one period.', 'error');
      return;
    }
    setSavingBusySlot(true);
    try {
      await api.createFacultyBusySlots({
        faculty_id: parseInt(busySlotForm.faculty_id, 10),
        timeslot_ids: busySlotForm.timeslot_ids.map(Number),
        academic_year: academicYear,
        reason: busySlotForm.reason.trim() || null,
      });
      addToast('External commitment saved successfully.', 'success');
      setBusySlotForm({ faculty_id: '', timeslot_ids: [], reason: '' });
      fetchBusySlots();
    } catch (err) {
      addToast(err.data?.error || err.message || 'Failed to save commitment.', 'error');
    } finally {
      setSavingBusySlot(false);
    }
  };

  const handleRemoveBusySlot = async (id) => {
    setRemovingBusySlotId(id);
    try {
      await api.deleteFacultyBusySlot(id);
      setBusySlots(prev => prev.filter(s => s.id !== id));
      addToast('Commitment removed.', 'success');
    } catch (err) {
      addToast(err.data?.error || err.message || 'Failed to remove commitment.', 'error');
    } finally {
      setRemovingBusySlotId(null);
    }
  };

  // Toggle a timeslot_id in the busy slot form multi-select
  const toggleBusyTimeslot = (tsId) => {
    setBusySlotForm(prev => {
      const ids = new Set(prev.timeslot_ids);
      if (ids.has(tsId)) ids.delete(tsId);
      else ids.add(tsId);
      return { ...prev, timeslot_ids: Array.from(ids) };
    });
  };

  const currentSemester = filteredSemesters.find(s => String(s.id) === String(selectedSemesterId));
  const semesterSubjects = filteredSubjects.filter(s => String(s.semester_id) === String(selectedSemesterId));

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
  // Segments within a day: break between P2–P3 (tea) and P4–P5 (lunch).
  // A 2-hour block must stay inside the same segment.
  const BREAK_BEFORE = new Set([3, 5]); // period numbers that start after a break

  const getBlockDestinationPeriods = (startPeriod, span) => {
    // Returns [p, p+1, ...] only if all periods in the window are within the same segment.
    const result = [startPeriod];
    for (let i = 1; i < span; i++) {
      const next = startPeriod + i;
      if (BREAK_BEFORE.has(next)) return null; // would cross a break — invalid
      if (next > 7) return null;
      result.push(next);
    }
    return result;
  };

  const handleDragStart = (e, entry, day, period, blockEntries = null, blockSpan = 1) => {
    if (blockEntries && blockEntries.length > 1) {
      // Block (multi-hour) drag — drag the entire block atomically
      dragState.current = {
        isBlock: true,
        span: blockSpan,
        entries: blockEntries,
        subjectId: blockEntries[0].subject_id,
        subjectCode: blockEntries[0].subject_code,
        sessionType: blockEntries[0].session_type || (blockEntries[0].is_lab ? 'lab' : 'theory'),
        fromDay: day,
        fromPeriods: blockEntries.map(e => {
          const ts = timeslots.find(t => t.id === e.timeslot_id);
          return ts ? ts.period_number : period;
        }),
        fromTimeslotIds: blockEntries.map(e => e.timeslot_id),
      };
    } else {
      // Single-slot drag
      dragState.current = {
        isBlock: false,
        entryId: entry.id,
        subjectId: entry.subject_id,
        subjectCode: entry.subject_code,
        fromTimeslotId: entry.timeslot_id,
        fromDay: day,
        fromPeriod: period,
        sessionType: entry.session_type || (entry.is_lab ? 'lab' : 'theory'),
      };
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, day, period) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const drag = dragState.current;
    if (drag?.isBlock) {
      const destPeriods = getBlockDestinationPeriods(period, drag.span);
      if (destPeriods) {
        setDragOverKeys(new Set(destPeriods.map(p => `${day}_${p}`)));
      } else {
        setDragOverKeys(new Set([`${day}_${period}`]));
      }
    } else {
      setDragOverKeys(new Set([`${day}_${period}`]));
    }
  };

  const handleDragLeave = () => {
    setDragOverKeys(new Set());
  };

  const handleDrop = async (e, day, period) => {
    e.preventDefault();
    setDragOverKeys(new Set());

    const drag = dragState.current;
    if (!drag) return;
    dragState.current = null;

    if (drag.isBlock) {
      // ── Block (2h+) atomic drop ──
      const destPeriods = getBlockDestinationPeriods(period, drag.span);
      if (!destPeriods) {
        addToast('Cannot place a lab block across a break period.', 'error');
        return;
      }

      // Same position — no-op
      if (drag.fromDay === day && JSON.stringify(drag.fromPeriods) === JSON.stringify(destPeriods)) return;

      // Resolve destination timeslot IDs
      const destTimeslots = destPeriods.map(p => timeslots.find(t => t.day === day && t.period_number === p));
      if (destTimeslots.some(t => !t)) {
        addToast('No timeslot configured for one or more target periods.', 'error');
        return;
      }

      await executeBlockDragMove(drag, day, destPeriods, destTimeslots);
    } else {
      // ── Single-slot drop ──
      if (drag.fromDay === day && drag.fromPeriod === period) return;

      const targetTs = timeslots.find(t => t.day === day && t.period_number === period);
      if (!targetTs) {
        addToast('No timeslot configured for this cell.', 'error');
        return;
      }

      const targetEntries = gridMap.get(`${day}_${period}`) || [];
      if (targetEntries.length === 0) {
        await executeDragMove(drag, targetTs.id, day, period);
      } else {
        setParallelDialog({
          drag,
          targetEntries,
          targetTimeslotId: targetTs.id,
          targetDay: day,
          targetPeriod: period,
        });
      }
    }
  };

  const executeBlockDragMove = async (drag, targetDay, destPeriods, destTimeslots) => {
    setMovingSlot(true);
    try {
      const allFromIds = drag.fromTimeslotIds;

      // Validate each destination slot: exclude the dragged entries themselves from clash check
      for (let i = 0; i < drag.entries.length; i++) {
        const entry = drag.entries[i];
        const destTs = destTimeslots[i];

        // Skip if same timeslot — already there
        if (entry.timeslot_id === destTs.id) continue;

        const checkRes = await api.validateMove({
          id: entry.id,
          replace_slot: false,
          exclude_entry_ids: drag.entries.map(e => e.id),
          subject_id: drag.subjectId,
          semester_id: parseInt(selectedSemesterId, 10),
          timeslot_id: destTs.id,
          academic_year: academicYear,
        });

        if (!checkRes.isValid) {
          addToast(`Cannot move block: ${checkRes.error || 'Clash detected at destination'}`, 'error', 5000);
          return;
        }
      }

      // Move each entry atomically
      await Promise.all(drag.entries.map((entry, i) =>
        api.updateTimetableEntry(entry.id, {
          subject_id: drag.subjectId,
          semester_id: parseInt(selectedSemesterId, 10),
          timeslot_id: destTimeslots[i].id,
          academic_year: academicYear,
          session_type: drag.sessionType,
          replace_slot: false,
        })
      ));

      setLastAction({
        type: 'BLOCK_MOVE',
        description: `Move ${drag.subjectCode} block to ${targetDay} P${destPeriods.join('-')}`,
        data: {
          entries: drag.entries.map((e, i) => ({
            entryId: e.id,
            subjectId: drag.subjectId,
            subjectCode: drag.subjectCode,
            sessionType: drag.sessionType,
            fromTimeslotId: allFromIds[i],
          })),
        },
      });

      addToast(`Moved ${drag.subjectCode} block to ${targetDay} P${destPeriods.join('–')}`, 'success');
      fetchTimetable();
    } catch (err) {
      addToast(err.data?.error || err.message || 'Block move failed', 'error');
    } finally {
      setMovingSlot(false);
    }
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
      } else if (lastAction.type === 'BLOCK_MOVE') {
        // Restore each block entry atomically to its original timeslot
        const { entries } = lastAction.data;
        await Promise.all(entries.map(e =>
          api.updateTimetableEntry(e.entryId, {
            subject_id: e.subjectId,
            semester_id: parseInt(selectedSemesterId, 10),
            timeslot_id: e.fromTimeslotId,
            academic_year: academicYear,
            session_type: e.sessionType,
            replace_slot: false,
          })
        ));
        addToast(`Undone: Returned ${entries[0]?.subjectCode} block to its original position`, 'success');
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
      } else if (lastAction.type === 'REMOVE') {
        const { deletedEntries } = lastAction.data;
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
        addToast(`Undone: Restored removed subject(s)`, 'success');
      }

      setLastAction(null);
      fetchTimetable();
    } catch (err) {
      addToast(err.data?.error || err.message || 'Failed to undo action', 'error');
    } finally {
      setUndoing(false);
    }
  };

  // Explicit remove handler for slots (single, parallel, or atomic block sessions)
  const handleRemoveSlot = async (entryOrEntries, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const entriesToRemove = Array.isArray(entryOrEntries) ? entryOrEntries : (entryOrEntries ? [entryOrEntries] : []);
    if (entriesToRemove.length === 0) return;

    setMovingSlot(true);
    try {
      for (const entry of entriesToRemove) {
        await api.deleteTimetableEntry(entry.id);
      }

      const codes = [...new Set(entriesToRemove.map(it => it.subject_code).filter(Boolean))].join(', ');
      setLastAction({
        type: 'REMOVE',
        description: `Remove ${codes || 'slot'}`,
        data: {
          deletedEntries: entriesToRemove.map(entry => ({
            subject_id: entry.subject_id,
            semester_id: entry.semester_id,
            timeslot_id: entry.timeslot_id,
            academic_year: entry.academic_year,
            session_type: entry.session_type || (entry.is_lab ? 'lab' : 'theory'),
            subject_code: entry.subject_code,
          })),
        },
      });

      addToast(`Removed ${codes || 'slot'} successfully.`, 'success');
      fetchTimetable();
    } catch (err) {
      addToast(err.data?.error || err.message || 'Failed to remove slot', 'error');
    } finally {
      setMovingSlot(false);
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

  // Quick delete occupant from slot (handles both single occupants and atomic block sessions)
  const handleDeleteOccupant = async (occupantEntry) => {
    if (!occupantEntry?.id) return;
    setEditModalOpen(false);

    // Check if this occupant is part of a continuous block/lab session on this day
    const sub = subjects.find(s => String(s.id) === String(occupantEntry.subject_id));
    const isBlockOrLab = Boolean(
      occupantEntry.is_lab ||
      occupantEntry.session_type === 'lab' ||
      sub?.is_lab ||
      (sub && (Number(sub.block_session_count) > 0 || Number(sub.block_session_hours) > 1))
    );

    let entriesToRemove = [occupantEntry];
    if (isBlockOrLab && selectedSlot) {
      const curDay = selectedSlot.day;
      const allDayEntries = [];
      for (let p = 1; p <= 7; p++) {
        const es = gridMap.get(`${curDay}_${p}`) || [];
        es.forEach(e => {
          if (String(e.subject_id) === String(occupantEntry.subject_id)) {
            allDayEntries.push(e);
          }
        });
      }
      if (allDayEntries.length > 1) {
        entriesToRemove = allDayEntries;
      }
    }

    await handleRemoveSlot(entriesToRemove);
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

  // 7. Word Export Feature (Full-page institutional layout with logo & seamless table block, editable .doc)
  const handleExportWord = () => {
    try {
      const semNum = currentSemester?.number || '';
      const deptName = activeDepartment?.name || 'Department of Computer Science and Engineering';
      const deptCode = activeDepartment?.code || 'DEPT';
      const semType = ((currentSemester?.number || 1) % 2 === 1) ? 'ODD' : 'EVEN';
      const classRoom = currentSemester?.class_room || 'LLH-04';
      const advisor = currentSemester?.class_advisor || '—';
      const mentors = currentSemester?.mentors || '—';

      const esc = (v) => String(v === null || v === undefined ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // Only display subject codes in the timetable grid cells
      const getSlotText = (day, p) => {
        const entries = gridMap.get(`${day}_${p}`) || [];
        if (entries.length === 0) return '';
        return entries
          .map(e => esc(e.subject_code || ''))
          .filter(Boolean)
          .join(' / ');
      };

      const thStyle = 'border:1.0pt solid #000000;mso-border-alt:solid #000000 1.0pt;padding:3pt 2pt;background-color:#f2f2f2;font-family:"Times New Roman",serif;font-size:8pt;font-weight:bold;text-align:center;line-height:1.1;';
      const tdStyle = 'border:1.0pt solid #000000;mso-border-alt:solid #000000 1.0pt;padding:3pt 2pt;font-family:"Times New Roman",serif;font-size:9.5pt;font-weight:bold;text-align:center;line-height:1.1;';
      const tdBreakStyle = 'border:1.0pt solid #000000;mso-border-alt:solid #000000 1.0pt;padding:2pt 1pt;font-family:"Times New Roman",serif;font-size:7.5pt;font-weight:bold;text-align:center;background-color:#f9f9f9;width:22pt;line-height:1.1;';
      const tdDayStyle = 'border:1.0pt solid #000000;mso-border-alt:solid #000000 1.0pt;padding:3pt 4pt;font-family:"Times New Roman",serif;font-size:9pt;font-weight:bold;text-align:center;background-color:#f4f4f4;line-height:1.1;';
      const legHeadStyle = 'border:1.0pt solid #000000;mso-border-alt:solid #000000 1.0pt;padding:3pt 5pt;background-color:#f2f2f2;font-family:"Times New Roman",serif;font-size:9pt;font-weight:bold;line-height:1.1;';
      const legTdStyle = 'border:1.0pt solid #000000;mso-border-alt:solid #000000 1.0pt;padding:2.5pt 5pt;font-family:"Times New Roman",serif;font-size:8.5pt;line-height:1.15;';

      // Build timetable rows (strictly subject codes only in grid)
      let dayRowsHtml = '';
      DAYS.forEach((day) => {
        const getMergeableSlot = (p) => {
          const es = gridMap.get(`${day}_${p}`) || [];
          if (es.length !== 1) return null;
          const e = es[0];
          const sub = subjects.find(s => String(s.id) === String(e.subject_id));
          const isLab = Boolean(e.is_lab || e.session_type === 'lab' || sub?.is_lab);
          const isBlock = Boolean((sub && (Number(sub.block_session_count) > 0 || Number(sub.block_session_hours) > 1)) || e.session_type === 'block');
          if (isLab || isBlock) return { ...e, is_lab: isLab, is_block: isBlock };
          return null;
        };
        const { mergeMap, skipPeriods } = computeLabMerges(getMergeableSlot);

        let cells = `<td style="${tdDayStyle}">${esc(day.toUpperCase())}</td>`;
        const addedMerged = new Set();

        const renderCell = (p) => {
          if (skipPeriods.has(p)) return '';
          const mergeInfo = mergeMap.get(p);
          if (mergeInfo && !addedMerged.has(p)) {
            addedMerged.add(p);
            const items = gridMap.get(`${day}_${p}`) || [];
            const e = items[0];
            // Only subject code in merged block
            const content = esc(e?.subject_code || '');
            return `<td colspan="${mergeInfo.span}" style="${tdStyle}">${content}</td>`;
          }
          if (mergeInfo) return '';
          return `<td style="${tdStyle}">${getSlotText(day, p)}</td>`;
        };

        cells += renderCell(1);
        cells += renderCell(2);
        cells += `<td style="${tdBreakStyle}">TEA<br/>BREAK</td>`;
        cells += renderCell(3);
        cells += renderCell(4);
        cells += `<td style="${tdBreakStyle}">LUNCH<br/>BREAK</td>`;
        cells += renderCell(5);
        cells += renderCell(6);
        cells += renderCell(7);

        dayRowsHtml += `<tr style="page-break-inside:avoid;mso-height-rule:exactly;height:22pt;">${cells}</tr>`;
      });

      // Build subject legend (full 3-column reference: Subject Code | Subject | Faculty)
      const seen = new Set();
      const legendEntries = timetableEntries
        .filter(e => {
          if (!e.subject_code || seen.has(e.subject_code)) return false;
          seen.add(e.subject_code);
          return true;
        })
        .sort((a, b) => (a.subject_code || '').localeCompare(b.subject_code || ''));

      let legendRowsHtml = '';
      legendEntries.forEach(e => {
        const sub = subjects.find(s => String(s.id) === String(e.subject_id)) || {};
        const facInfo = resolveFacultyInfo(sub || e);
        legendRowsHtml += `<tr style="page-break-inside:avoid;mso-height-rule:exactly;">
          <td style="${legTdStyle};text-align:center;font-weight:bold;">${esc(e.subject_code || sub.code || '')}</td>
          <td style="${legTdStyle};text-align:left;font-weight:normal;">${esc(e.subject_name || sub.name || '')}</td>
          <td style="${legTdStyle};text-align:left;font-weight:normal;">${esc(facInfo.name)}${facInfo.code ? ` [${esc(facInfo.code)}]` : ''}</td>
        </tr>`;
      });
      if (!legendRowsHtml) {
        legendRowsHtml = `<tr style="page-break-inside:avoid;"><td style="${legTdStyle}" colspan="3">No subjects assigned</td></tr>`;
      }

      const timeHeaderCells = `
        <th style="${thStyle};width:10%;">
          Day &nbsp; Time &rarr;<br/><span style="font-size:7pt;">&darr;</span>
        </th>
        <th style="${thStyle}">9:00AM<br/>To<br/>09:55PM</th>
        <th style="${thStyle}">9:55AM<br/>To<br/>10:50AM</th>
        <th style="${thStyle};background-color:#f9f9f9;width:22pt;">TEA<br/>BREAK</th>
        <th style="${thStyle}">11:10AM<br/>To<br/>12:05PM</th>
        <th style="${thStyle}">12:05PM<br/>To<br/>01:00PM</th>
        <th style="${thStyle};background-color:#f9f9f9;width:22pt;">LUNCH<br/>BREAK</th>
        <th style="${thStyle}">01:50PM<br/>To<br/>02:40PM</th>
        <th style="${thStyle}">02:40PM<br/>To<br/>03:30PM</th>
        <th style="${thStyle}">03:30PM<br/>To<br/>4:15PM</th>
      `;

      const todayStr = new Date().toLocaleDateString('en-GB');

      const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>Timetable - ${esc(deptCode)} Semester ${semNum} AY ${esc(academicYear)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page Section1 {
    size: 841.9pt 595.3pt;
    mso-page-orientation: landscape;
    margin: 20.0pt 25.0pt 20.0pt 25.0pt;
    mso-header-margin: 12.0pt;
    mso-footer-margin: 12.0pt;
  }
  div.Section1 {
    page: Section1;
  }
  * {
    margin: 0;
    padding: 0;
    mso-margin-top-alt: 0pt;
    mso-margin-bottom-alt: 0pt;
    mso-para-margin: 0pt;
    mso-para-margin-top: 0pt;
    mso-para-margin-bottom: 0pt;
  }
  p, div, span, td, th {
    margin: 0;
    padding: 0;
    mso-margin-top-alt: 0pt;
    mso-margin-bottom-alt: 0pt;
    mso-para-margin: 0pt;
    mso-para-margin-top: 0pt;
    mso-para-margin-bottom: 0pt;
  }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 9.5pt;
    color: #000000;
    margin: 0;
    padding: 0;
  }
  table {
    page-break-inside: avoid;
    mso-table-lspace: 0pt;
    mso-table-rspace: 0pt;
  }
  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  table.mso-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5pt solid #000000;
    mso-border-alt: solid #000000 1.5pt;
  }
  table.mso-table th, table.mso-table td {
    border: 1.0pt solid #000000;
    mso-border-alt: solid #000000 1.0pt;
  }
</style>
</head>
<body>
<div class="Section1">

<!-- 1. Institutional Header with Official Logo (Left) and Centered Institution Info -->
<table border="0" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:none;margin-bottom:5pt;">
  <tr>
    <td style="width:75px;vertical-align:middle;text-align:left;border:none;padding:0;">
      <img src="${YIT_LOGO_BASE64}" width="68" height="68" alt="YIT Logo" style="width:68px;height:68px;display:block;" />
    </td>
    <td style="vertical-align:middle;text-align:center;border:none;padding:0 8px;">
      <div style="font-size:15.5pt;font-weight:bold;font-family:'Times New Roman',serif;letter-spacing:0.02em;text-transform:uppercase;line-height:1.15;margin:0;">
        YENEPOYA INSTITUTE OF TECHNOLOGY
      </div>
      <div style="font-size:8.5pt;font-family:'Times New Roman',serif;margin:1.5pt 0 0 0;">
        NH-13, Thodar, Moodbidri - 574225
      </div>
      <div style="font-size:10.5pt;font-weight:bold;font-family:'Times New Roman',serif;margin:2pt 0 0 0;">
        Department of ${esc(deptName)}
      </div>
      <div style="font-size:10.5pt;font-weight:bold;font-family:'Times New Roman',serif;text-transform:uppercase;margin:2pt 0 0 0;">
        TIME TABLE - ${semType} SEMESTER (AY ${esc(academicYear)})
      </div>
    </td>
    <td style="width:75px;border:none;padding:0;"></td>
  </tr>
</table>

<!-- 2. Seamless Unified Institutional Table (Class Info + Grid + Legend + Advisor) -->
<!-- Part A: Class Information Bar -->
<table border="1" cellspacing="0" cellpadding="0" class="mso-table" style="margin-bottom:0;border-bottom:none;">
  <tr style="page-break-inside:avoid;height:20pt;">
    <td style="width:33%;border:1.0pt solid #000;mso-border-alt:solid #000 1.0pt;padding:3.5pt 6pt;font-weight:bold;text-align:left;font-size:10pt;">
      CLASS: ${esc(romanSemester)} SEMESTER
    </td>
    <td style="width:34%;border:1.0pt solid #000;mso-border-alt:solid #000 1.0pt;padding:3.5pt 6pt;font-weight:bold;text-align:center;font-size:10pt;">
      CLASS ROOM: ${esc(classRoom)}
    </td>
    <td style="width:33%;border:1.0pt solid #000;mso-border-alt:solid #000 1.0pt;padding:3.5pt 6pt;font-weight:bold;text-align:right;font-size:10pt;">
      W.E.F: ${esc(wefDate)}
    </td>
  </tr>
</table>

<!-- Part B: Timetable Schedule Grid (Codes Only) -->
<table border="1" cellspacing="0" cellpadding="0" class="mso-table" style="margin-top:0;margin-bottom:0;border-top:none;border-bottom:none;">
  <thead>
    <tr style="page-break-inside:avoid;">${timeHeaderCells}</tr>
  </thead>
  <tbody>
    ${dayRowsHtml}
  </tbody>
</table>

<!-- Part C: Subject & Faculty Reference Legend -->
<table border="1" cellspacing="0" cellpadding="0" class="mso-table" style="margin-top:0;margin-bottom:0;border-top:none;border-bottom:none;">
  <thead>
    <tr style="page-break-inside:avoid;">
      <th style="${legHeadStyle};width:14%;text-align:center;">Subject Code</th>
      <th style="${legHeadStyle};width:43%;text-align:left;">Subject</th>
      <th style="${legHeadStyle};width:43%;text-align:left;">Faculty</th>
    </tr>
  </thead>
  <tbody>
    ${legendRowsHtml}
  </tbody>
</table>

<!-- Part D: Class Advisor & Mentors Section -->
<table border="1" cellspacing="0" cellpadding="0" class="mso-table" style="margin-top:0;margin-bottom:0;border-top:none;">
  <tr style="page-break-inside:avoid;height:20pt;">
    <td style="width:50%;border:1.0pt solid #000;mso-border-alt:solid #000 1.0pt;padding:3.5pt 8pt;font-size:9.5pt;">
      <strong>Class Advisor:</strong> ${esc(advisor)}
    </td>
    <td style="width:50%;border:1.0pt solid #000;mso-border-alt:solid #000 1.0pt;padding:3.5pt 8pt;font-size:9.5pt;">
      <strong>Mentors:</strong> ${esc(mentors)}
    </td>
  </tr>
</table>

<p style="font-size:7pt;color:#777777;text-align:right;margin-top:10pt;margin-bottom:0;font-family:'Times New Roman',serif;">Generated on ${todayStr}</p>

</div>
</body>
</html>`;

      const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Timetable_${deptCode}_Sem_${semNum || 'View'}_${academicYear}.doc`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast('Timetable exported as Word document successfully!', 'success');
      setExportDropdownOpen(false);
    } catch (err) {
      addToast('Failed to export Word document: ' + err.message, 'error');
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
            disabled={timetableEntries.length === 0 || filteredSemesters.length === 0}
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
            disabled={generating || filteredSemesters.length === 0}
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

          {/* Export as Word Button */}
          <button
            type="button"
            onClick={handleExportWord}
            disabled={exporting || timetableEntries.length === 0 || filteredSemesters.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Export Timetable as Word Document (.doc)"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Export as Word</span>
          </button>
        </div>
      </section>

      {/* When No Semesters in Department */}
      {filteredSemesters.length === 0 ? (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-4 border border-orange-100">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">
            No Semesters Configured for {activeDepartment?.name || 'this department'}
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">
            This department currently has no semesters configured. To schedule classes and generate timetables, add semesters and subjects in Master Data.
          </p>
          {onNavigateToMasterData && (
            <button
              type="button"
              onClick={onNavigateToMasterData}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-sm shadow-orange-500/20 transition cursor-pointer"
            >
              <span>Configure Semesters in Master Data</span>
            </button>
          )}
        </section>
      ) : (
        <>
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
                    <Coffee className="w-3 h-3 text-amber-600" />
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
                    <Utensils className="w-3 h-3 text-orange-500" />
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
                  const isDragOver = dragOverKeys.has(`${day}_${p}`);
                  return (
                    <td
                      key={p}
                      colSpan={mergeInfo ? mergeInfo.span : 1}
                      onClick={() => handleSlotClick(day, p)}
                      onContextMenu={(e) => {
                        const entries = gridMap.get(`${day}_${p}`) || [];
                        if (entries.length === 0) return;
                        e.preventDefault();
                        e.stopPropagation();

                        let blockEntries = entries;
                        if (mergeInfo) {
                          blockEntries = [];
                          for (let s = 0; s < mergeInfo.span; s++) {
                            (gridMap.get(`${day}_${p + s}`) || []).forEach(item => blockEntries.push(item));
                          }
                        }

                        const menuWidth = 240;
                        const menuHeight = 130;
                        const x = e.clientX + menuWidth > window.innerWidth ? Math.max(10, window.innerWidth - menuWidth - 10) : e.clientX;
                        const y = e.clientY + menuHeight > window.innerHeight ? Math.max(10, window.innerHeight - menuHeight - 10) : e.clientY;

                        setContextMenu({
                          x,
                          y,
                          day,
                          period: p,
                          isBlock: Boolean(mergeInfo),
                          span: mergeInfo?.span || 1,
                          entries: blockEntries,
                        });
                      }}
                      onDragOver={(e) => handleDragOver(e, day, p)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, p)}
                      className={`p-1.5 border-r border-slate-200 transition-colors cursor-pointer ${
                        isDragOver ? 'bg-orange-100/70 ring-2 ring-orange-400 ring-inset' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {mergeInfo ? (() => {
                          // Collect all entries in the merged block window for atomic dragging
                          const blockEntries = [];
                          for (let s = 0; s < mergeInfo.span; s++) {
                            (gridMap.get(`${day}_${p + s}`) || []).forEach(item => blockEntries.push(item));
                          }
                          return (
                            <MergedLabCell
                              entry={(gridMap.get(`${day}_${p}`) || [])[0]}
                              timeRange={mergeInfo.timeRange}
                              span={mergeInfo.span}
                              onDragStart={(e, entry) => handleDragStart(e, entry, day, p, blockEntries, mergeInfo.span)}
                            />
                          );
                        })() : (
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
      </>
      )}

      {/* 4. Faculty External Commitments (Busy Slots) */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Collapsible Header */}
        <button
          type="button"
          onClick={() => setBusySlotsExpanded(prev => !prev)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <CalendarOff className="w-4 h-4 text-slate-600" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-slate-800">Faculty External Commitments</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Mark faculty busy periods from other departments (e.g. 1st year classes). These are excluded from scheduling and clash detection.
              </div>
            </div>
            {busySlots.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold flex-shrink-0">
                {busySlots.length} marked
              </span>
            )}
          </div>
          <ChevronRight
            className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${busySlotsExpanded ? 'rotate-90' : ''}`}
          />
        </button>

        {busySlotsExpanded && (
          <div className="border-t border-slate-100 p-5 space-y-6">

            {/* Info note */}
            <div className="flex items-start gap-3 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3">
              <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-600 leading-relaxed">
                Periods marked here are treated as unavailable for the selected faculty member. The auto-scheduler will automatically avoid these slots, and manual drag-and-drop will warn you if a clash occurs.
              </p>
            </div>

            {/* Add Commitment Form */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Add Commitment</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Faculty selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Faculty Member</label>
                  <select
                    value={busySlotForm.faculty_id}
                    onChange={e => setBusySlotForm(prev => ({ ...prev, faculty_id: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition appearance-none"
                  >
                    <option value="">Select faculty...</option>
                    {filteredFaculty.filter(f => f.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name)).map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.faculty_code})</option>
                    ))}
                  </select>
                </div>

                {/* Reason / note */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Reason <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Sem 1 — C Programming"
                    value={busySlotForm.reason}
                    onChange={e => setBusySlotForm(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition"
                  />
                </div>
              </div>

              {/* Period grid selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600">Busy Periods <span className="text-slate-400 font-normal">— select one or more slots</span></label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-3 py-2 font-semibold text-slate-500 border-b border-r border-slate-200 w-24">Day</th>
                        {PERIODS.map(p => (
                          <th key={p} className="px-2 py-2 font-semibold text-slate-500 border-b border-r border-slate-200 text-center last:border-r-0">
                            P{p}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day, di) => (
                        <tr key={day} className={di % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                          <td className="px-3 py-2 font-medium text-slate-600 border-r border-slate-200 text-xs">{day.slice(0, 3)}</td>
                          {PERIODS.map(p => {
                            const ts = timeslots.find(t => t.day === day && t.period_number === p);
                            if (!ts) return <td key={p} className="border-r border-slate-100 last:border-r-0" />;
                            const selected = busySlotForm.timeslot_ids.includes(ts.id);
                            return (
                              <td key={p} className="border-r border-slate-100 last:border-r-0 text-center py-1.5 px-1">
                                <button
                                  type="button"
                                  title={`${day} Period ${p} (${ts.start_time?.slice(0,5)} – ${ts.end_time?.slice(0,5)})`}
                                  onClick={() => toggleBusyTimeslot(ts.id)}
                                  className={`w-7 h-7 rounded-md text-[11px] font-semibold transition-colors ${
                                    selected
                                      ? 'bg-slate-800 text-white ring-2 ring-slate-800/30'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  }`}
                                >
                                  {selected ? 'X' : p}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {busySlotForm.timeslot_ids.length > 0 && (
                  <p className="text-[11px] text-slate-500 pl-1">{busySlotForm.timeslot_ids.length} period{busySlotForm.timeslot_ids.length > 1 ? 's' : ''} selected</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddBusySlots}
                disabled={savingBusySlot || !busySlotForm.faculty_id || busySlotForm.timeslot_ids.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {savingBusySlot ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Save Commitment
              </button>
            </div>

            {/* Existing Commitments List */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Existing Commitments
                {busySlots.length > 0 && <span className="ml-2 font-normal text-slate-400">({busySlots.length} total)</span>}
              </h3>

              {busySlotsLoading ? (
                <div className="flex items-center gap-2 py-4 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : busySlots.length === 0 ? (
                <div className="py-6 flex flex-col items-center gap-2 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  <UserX className="w-8 h-8 text-slate-300" />
                  <p className="text-sm">No external commitments marked for {academicYear}.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {/* Group by faculty for readability */}
                  {Object.entries(
                    busySlots.reduce((acc, s) => {
                      const key = `${s.faculty_id}`;
                      if (!acc[key]) acc[key] = { faculty_name: s.faculty_name, faculty_code: s.faculty_code, slots: [] };
                      acc[key].slots.push(s);
                      return acc;
                    }, {})
                  ).map(([facultyId, { faculty_name, faculty_code, slots }]) => (
                    <div key={facultyId} className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-xs font-semibold text-slate-700">{faculty_name}</span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{faculty_code}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {slots.map(slot => (
                          <div
                            key={slot.id}
                            className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg pl-2.5 pr-1 py-1"
                          >
                            <div className="text-[11px] text-slate-700">
                              <span className="font-semibold">{slot.day?.slice(0, 3)}</span>
                              <span className="text-slate-400 mx-1">&middot;</span>
                              <span>P{slot.period_number}</span>
                              {slot.reason && (
                                <span className="text-slate-400 ml-1.5">— {slot.reason}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              title="Remove commitment"
                              disabled={removingBusySlotId === slot.id}
                              onClick={() => handleRemoveBusySlot(slot.id)}
                              className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-red-50 hover:text-red-500 text-slate-400 transition-colors disabled:opacity-40"
                            >
                              {removingBusySlotId === slot.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <X className="w-3 h-3" />
                              }
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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

      {/* Right-Click Context Menu for Slot Deletion */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-xl shadow-xl py-1.5 min-w-[210px] text-xs animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100 select-none"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Header info */}
          <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>{contextMenu.day} • Period {contextMenu.period}</span>
            {contextMenu.isBlock && (
              <span className="text-[9px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded font-bold uppercase">
                {contextMenu.span}h Block
              </span>
            )}
          </div>

          <div className="py-1">
            {contextMenu.isBlock ? (
              <button
                type="button"
                onClick={() => {
                  const entries = contextMenu.entries;
                  setContextMenu(null);
                  handleRemoveSlot(entries);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50/80 transition-colors text-left cursor-pointer font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  Remove {contextMenu.entries[0]?.subject_code} ({contextMenu.span}h Block)
                </span>
              </button>
            ) : contextMenu.entries.length > 1 ? (
              <>
                {contextMenu.entries.map((entry, idx) => (
                  <button
                    key={entry.id || idx}
                    type="button"
                    onClick={() => {
                      setContextMenu(null);
                      handleRemoveSlot(entry);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50/80 transition-colors text-left cursor-pointer font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Remove {entry.subject_code}</span>
                  </button>
                ))}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const entries = contextMenu.entries;
                      setContextMenu(null);
                      handleRemoveSlot(entries);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-700 hover:bg-rose-50/80 transition-colors text-left cursor-pointer font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Clear Entire Slot (All)</span>
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const entry = contextMenu.entries[0];
                  setContextMenu(null);
                  handleRemoveSlot(entry);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50/80 transition-colors text-left cursor-pointer font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  Remove {contextMenu.entries[0]?.subject_code || 'Slot'}
                </span>
              </button>
            )}
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
          fontFamily: "'Times New Roman', Times, serif",
          border: '1.5px solid #000',
          padding: '12px 14px',
          boxSizing: 'border-box',
          color: '#000',
        }}
      >
        {/* 1. Institutional Header */}
        <div style={{ position: 'relative', borderBottom: '1.5px solid #000', paddingBottom: '6px', marginBottom: '5px', textAlign: 'center' }}>
          {/* Logo on the left */}
          <div style={{ position: 'absolute', left: '4px', top: '0px', width: '82px', height: '82px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={YIT_LOGO_BASE64}
              alt="YIT Logo"
              style={{ width: '80px', height: '80px', objectFit: 'contain', display: 'block' }}
            />
          </div>
          {/* Centre text */}
          <div style={{ paddingLeft: '85px', paddingRight: '85px' }}>
            <div style={{ fontSize: '19px', fontWeight: 'bold', fontFamily: "'Times New Roman', Times, serif", letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.15 }}>
              YENEPOYA INSTITUTE OF TECHNOLOGY
            </div>
            <div style={{ fontSize: '10.5px', marginTop: '2px', fontFamily: "'Times New Roman', Times, serif" }}>
              NH-13, Thodar, Moodbidri - 574225
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: 'bold', marginTop: '2px', fontFamily: "'Times New Roman', Times, serif" }}>
              Department of {activeDepartment?.name || 'Artificial Intelligence and Machine Learning'}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '2px', textTransform: 'uppercase', fontFamily: "'Times New Roman', Times, serif", letterSpacing: '0.03em' }}>
              TIME TABLE - {((currentSemester?.number || 1) % 2 === 1) ? 'ODD' : 'EVEN'} SEMESTER (AY {academicYear})
            </div>
          </div>
        </div>

        {/* 2. Class Info Bar */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
          <tbody>
            <tr>
              <td style={{ border: '1.5px solid #000', padding: '4px 8px', fontWeight: 'bold', fontSize: '10.5px', textAlign: 'left', width: '33%', fontFamily: "'Times New Roman', Times, serif" }}>
                CLASS: {romanSemester} SEMESTER
              </td>
              <td style={{ border: '1.5px solid #000', padding: '4px 8px', fontWeight: 'bold', fontSize: '10.5px', textAlign: 'center', width: '34%', fontFamily: "'Times New Roman', Times, serif" }}>
                CLASS ROOM: {currentSemester?.class_room || 'LLH-01'}
              </td>
              <td style={{ border: '1.5px solid #000', padding: '4px 8px', fontWeight: 'bold', fontSize: '10.5px', textAlign: 'right', width: '33%', fontFamily: "'Times New Roman', Times, serif" }}>
                W.E.F: {wefDate}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 3. Main Timetable Grid (All rows in single tbody for perfect rowSpan across all 7 rows) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '100px' }} />
            <col />
            <col />
            <col style={{ width: '28px' }} />
            <col />
            <col />
            <col style={{ width: '28px' }} />
            <col />
            <col />
            <col />
          </colgroup>
          <tbody>
            {/* Row 0: Time Header Row */}
            <tr style={{ height: '42px' }}>
              <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontFamily: "'Times New Roman', Times, serif", fontSize: '9.5px', verticalAlign: 'middle', backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold' }}>Day</span>
                  <span style={{ fontWeight: 'bold' }}>Time &rarr;</span>
                </div>
                <div style={{ fontSize: '9px', lineHeight: 1 }}>&darr;</div>
              </th>
              {[
                { top: '9:00AM', to: 'To', bot: '09:55PM' },
                { top: '9:55AM', to: 'To', bot: '10:50AM' },
              ].map((t, i) => (
                <th key={i} style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontFamily: "'Times New Roman', Times, serif", fontSize: '9px', fontWeight: 'bold', verticalAlign: 'middle' }}>
                  <div>{t.top}</div>
                  <div style={{ fontSize: '8px', fontWeight: 'normal' }}>{t.to}</div>
                  <div>{t.bot}</div>
                </th>
              ))}
              {/* Tea Break Column: Spans this header row + all 6 weekday rows = rowSpan 7 */}
              <td
                rowSpan={7}
                style={{
                  border: '1px solid #000',
                  padding: '2px 0',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  backgroundColor: '#fff',
                  width: '28px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 'bold', fontSize: '8.5px', fontFamily: "'Times New Roman', Times, serif", lineHeight: '1.25' }}>
                  <span>T</span>
                  <span>E</span>
                  <span>A</span>
                  <div style={{ height: '14px' }} />
                  <span>B</span>
                  <span>R</span>
                  <span>E</span>
                  <span>A</span>
                  <span>K</span>
                </div>
              </td>
              {[
                { top: '11:10AM', to: 'To', bot: '12:05PM' },
                { top: '12:05PM', to: 'To', bot: '01:00PM' },
              ].map((t, i) => (
                <th key={i} style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontFamily: "'Times New Roman', Times, serif", fontSize: '9px', fontWeight: 'bold', verticalAlign: 'middle' }}>
                  <div>{t.top}</div>
                  <div style={{ fontSize: '8px', fontWeight: 'normal' }}>{t.to}</div>
                  <div>{t.bot}</div>
                </th>
              ))}
              {/* Lunch Break Column: Spans this header row + all 6 weekday rows = rowSpan 7 */}
              <td
                rowSpan={7}
                style={{
                  border: '1px solid #000',
                  padding: '2px 0',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  backgroundColor: '#fff',
                  width: '28px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 'bold', fontSize: '8.5px', fontFamily: "'Times New Roman', Times, serif", lineHeight: '1.25' }}>
                  <span>L</span>
                  <span>U</span>
                  <span>N</span>
                  <span>C</span>
                  <span>H</span>
                  <div style={{ height: '14px' }} />
                  <span>B</span>
                  <span>R</span>
                  <span>E</span>
                  <span>A</span>
                  <span>K</span>
                </div>
              </td>
              {[
                { top: '01:50PM', to: 'To', bot: '02:40PM' },
                { top: '02:40PM', to: 'To', bot: '03:30PM' },
                { top: '03:30PM', to: 'To', bot: '4:15PM' },
              ].map((t, i) => (
                <th key={i} style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontFamily: "'Times New Roman', Times, serif", fontSize: '9px', fontWeight: 'bold', verticalAlign: 'middle' }}>
                  <div>{t.top}</div>
                  <div style={{ fontSize: '8px', fontWeight: 'normal' }}>{t.to}</div>
                  <div>{t.bot}</div>
                </th>
              ))}
            </tr>

            {/* Rows 1-6: Weekdays */}
            {DAYS.map((day) => {
              const getMergeableSlot = (p) => {
                const es = gridMap.get(`${day}_${p}`) || [];
                if (es.length !== 1) return null;
                const e = es[0];
                const sub = subjects.find(s => String(s.id) === String(e.subject_id));
                const isLab = Boolean(e.is_lab || e.session_type === 'lab' || sub?.is_lab);
                const isBlock = Boolean((sub && (Number(sub.block_session_count) > 0 || Number(sub.block_session_hours) > 1)) || e.session_type === 'block');
                if (isLab || isBlock) return { ...e, is_lab: isLab, is_block: isBlock };
                return null;
              };

              const { mergeMap, skipPeriods } = computeLabMerges(getMergeableSlot);

              const renderPrintCell = (items) => {
                if (!items || items.length === 0) return null;
                if (items.length === 1) {
                  const it = items[0];
                  const sub = subjects.find(s => String(s.id) === String(it.subject_id));
                  const fac = resolveFacultyInfo(sub || it);
                  const isLab = Boolean(it.is_lab || it.session_type === 'lab' || sub?.is_lab);
                  const isBlock = Boolean((sub && (Number(sub.block_session_count) > 0 || Number(sub.block_session_hours) > 1)) || it.session_type === 'block');
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.25 }}>
                      <span style={{ fontFamily: "'Times New Roman', Times, serif", fontWeight: 'bold', fontSize: '10.5px' }}>{it.subject_code}</span>
                      {fac.code && <span style={{ fontFamily: 'monospace', fontSize: '8px', color: '#333' }}>[{fac.code}]</span>}
                      {isLab && <span style={{ fontSize: '7px', fontWeight: 'bold' }}>[LAB]</span>}
                      {!isLab && isBlock && <span style={{ fontSize: '7px', fontWeight: 'bold' }}>[BLOCK]</span>}
                      {!isLab && !isBlock && it.session_type === 'activity' && <span style={{ fontSize: '7px' }}>[ACT]</span>}
                    </div>
                  );
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                    {items.map((it, idx) => {
                      const sub = subjects.find(s => String(s.id) === String(it.subject_id));
                      const fac = resolveFacultyInfo(sub || it);
                      return (
                        <div key={idx} style={idx > 0 ? { borderTop: '1px solid #ccc', paddingTop: '1px', textAlign: 'center', width: '100%' } : { textAlign: 'center', width: '100%' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '9px' }}>{it.subject_code}</span>
                          {fac.code && <span style={{ fontFamily: 'monospace', fontSize: '7.5px', color: '#555', marginLeft: '2px' }}>[{fac.code}]</span>}
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
                    <td key={p} colSpan={mergeInfo.span} style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fff' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.25 }}>
                        <span style={{ fontFamily: "'Times New Roman', Times, serif", fontWeight: 'bold', fontSize: '10.5px' }}>{entry?.subject_code}</span>
                        {fac.code && <span style={{ fontFamily: 'monospace', fontSize: '8px', color: '#333' }}>[{fac.code}]</span>}
                        <span style={{ fontSize: '7.5px', fontWeight: 'bold', marginTop: '1px' }}>{mergeInfo.tag}</span>
                        <span style={{ fontSize: '7px', color: '#555' }}>{mergeInfo.timeRange}</span>
                      </div>
                    </td>
                  );
                }

                return (
                  <td key={p} style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fff' }}>
                    {renderPrintCell(items)}
                  </td>
                );
              };

              return (
                <tr key={day} style={{ height: '36px' }}>
                  <td style={{ border: '1px solid #000', padding: '2px 4px', fontFamily: "'Times New Roman', Times, serif", fontWeight: 'bold', fontSize: '10px', textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fff' }}>
                    {day.toUpperCase()}
                  </td>
                  {renderPrintPeriodTd(1)}
                  {renderPrintPeriodTd(2)}
                  {/* Tea Break is spanned from row 0 */}
                  {renderPrintPeriodTd(3)}
                  {renderPrintPeriodTd(4)}
                  {/* Lunch Break is spanned from row 0 */}
                  {renderPrintPeriodTd(5)}
                  {renderPrintPeriodTd(6)}
                  {renderPrintPeriodTd(7)}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 4. Subject Legend Table — 3 columns: Subject Code | Subject | Faculty */}
        {(() => {
          const seen = new Set();
          const printLegend = timetableEntries
            .filter(e => {
              if (!e.subject_code || seen.has(e.subject_code)) return false;
              seen.add(e.subject_code);
              return true;
            })
            .sort((a, b) => (a.subject_code || '').localeCompare(b.subject_code || ''));

          const advisor = currentSemester?.class_advisor || '';
          const mentors = currentSemester?.mentors || '';

          const cellBase = { border: '1px solid #000', padding: '3px 8px', fontFamily: "'Times New Roman', Times, serif", fontSize: '9.5px', verticalAlign: 'middle', height: '22px' };
          const headBase = { ...cellBase, fontWeight: 'bold', textAlign: 'center', backgroundColor: '#fff', fontSize: '10px' };

          // Ensure minimum 4 rows in subject table for visual balance matching reference
          const displayRows = [...printLegend];
          while (displayRows.length < 4) {
            displayRows.push(null);
          }

          return (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
                <thead>
                  <tr>
                    <th style={{ ...headBase, width: '14%' }}>Subject Code</th>
                    <th style={{ ...headBase, width: '43%' }}>Subject</th>
                    <th style={{ ...headBase, width: '43%' }}>Faculty</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((it, idx) => {
                    if (!it) {
                      return (
                        <tr key={`empty_${idx}`}>
                          <td style={cellBase}>&nbsp;</td>
                          <td style={cellBase}>&nbsp;</td>
                          <td style={cellBase}>&nbsp;</td>
                        </tr>
                      );
                    }
                    const sub = subjects.find(s => String(s.id) === String(it.subject_id));
                    const facInfo = resolveFacultyInfo(sub || it);
                    return (
                      <tr key={it.subject_code || idx}>
                        <td style={{ ...cellBase, fontFamily: "'Times New Roman', Times, serif", fontWeight: 'bold', fontSize: '9.5px', textAlign: 'center' }}>
                          {it.subject_code}
                        </td>
                        <td style={{ ...cellBase, textAlign: 'left' }}>
                          {it.subject_name || sub?.name || ''}
                        </td>
                        <td style={{ ...cellBase, textAlign: 'left' }}>
                          {facInfo.name}
                          {facInfo.code && <span style={{ fontSize: '8.5px', color: '#444', marginLeft: '6px', fontFamily: 'monospace' }}>[{facInfo.code}]</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* 5. Class Advisor & Mentors */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '4px 10px', fontFamily: "'Times New Roman', Times, serif", fontSize: '10px', width: '50%' }}>
                      <strong>Class Advisor:</strong> {advisor}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '4px 10px', fontFamily: "'Times New Roman', Times, serif", fontSize: '10px', width: '50%' }}>
                      <strong>Mentors:</strong> {mentors}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          );
        })()}

        {/* 6. Signature Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', paddingTop: '28px' }}>
          {['Time Table Coordinator', 'Head of the Department', 'Principal'].map((label) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ height: '28px' }} />
              <div style={{ borderTop: '1px solid #000', minWidth: '180px', paddingTop: '3px', fontFamily: "'Times New Roman', Times, serif", fontWeight: 'bold', fontSize: '10px' }}>
                <div>{label}</div>
              </div>
            </div>
          ))}
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
      className={`h-14 sm:h-15 border rounded-xl p-2 flex flex-col justify-between transition shadow-xs hover:shadow cursor-grab active:cursor-grabbing active:opacity-60 select-none ${cardBg}`}
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
  const sessionType = entry.session_type ||
    (entry.is_generic_activity ? 'activity' :
    (entry.is_parallel_activity ? 'activity' :
    (entry.is_lab ? 'lab' : 'theory')));
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
          {sessionType === 'activity' ? 'ACT' : (sessionType === 'lab' ? 'LAB' : (sessionType === 'block' ? 'BLK' : '1h'))}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] leading-tight">
        <span className="text-slate-600 truncate font-medium">{entry.faculty_code || entry.faculty_name || (entry.is_generic_activity ? 'Activity' : '')}</span>
        {entry.room_number && (
          <span className="text-[9px] text-slate-400 font-mono shrink-0">{entry.room_number}</span>
        )}
      </div>
    </div>
  );
}
