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
  Pencil
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
        const [semRes, subRes, tsRes] = await Promise.all([
          api.getSemesters(),
          api.getSubjects(),
          api.getTimeslots()
        ]);
        setSemesters(semRes);
        setSubjects(subRes);
        setTimeslots(tsRes);

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

  return (
    <div className="space-y-6">
      {/* Top Header & Semester Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
        {/* Semester Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Semester:</span>
          {filteredSemesters.length === 0 ? (
            <span className="text-xs text-slate-400 italic px-2">No semesters configured for this department</span>
          ) : (
            filteredSemesters.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedSemesterId(s.id);
                  setAcademicYear(s.academic_year || '2025-2026');
                  setLastAction(null);
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
            ))
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Permanent Undo Button — clickable only when an operation has been performed */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={!lastAction || undoing}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg border transition-all ${
              lastAction && !undoing
                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 hover:border-amber-400 shadow-sm cursor-pointer'
                : 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed pointer-events-none'
            }`}
            title={lastAction ? `Undo: ${lastAction.description}` : 'No operations to undo'}
          >
            {undoing ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            ) : (
              <RotateCcw className={`w-4 h-4 ${lastAction ? 'text-amber-700' : 'text-slate-300'}`} />
            )}
            <span>Undo</span>
            {lastAction && !undoing && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 text-slate-700 hover:text-rose-600 hover:bg-rose-50 text-sm font-medium rounded-lg transition-colors"
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
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                {activeDepartment ? `${activeDepartment.name} — ` : ''}Semester {currentSemester?.number || ''} Weekly Schedule
              </h2>
              {activeDepartment?.code && (
                <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  {activeDepartment.code}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2.5">
              <span>Room: <strong className="text-slate-800 font-mono">{currentSemester?.class_room || 'Not set'}</strong></span>
              <span>•</span>
              <span>Academic Year: <strong className="text-slate-800">{academicYear}</strong></span>
              {currentSemester?.class_advisor && (
                <>
                  <span>•</span>
                  <span>Advisor: <strong className="text-slate-800">{currentSemester.class_advisor}</strong></span>
                </>
              )}
              {currentSemester?.mentors && (
                <>
                  <span>•</span>
                  <span>Mentors: <strong className="text-slate-800">{currentSemester.mentors}</strong></span>
                </>
              )}
              <span>•</span>
              <button
                type="button"
                onClick={handleOpenSemesterModal}
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold hover:underline cursor-pointer text-xs"
                title="Edit Classroom, Class Advisor, and Mentors"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit Details</span>
              </button>
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
                      onDragOver={(e) => handleDragOver(e, day, 1)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, 1)}
                      className={`border border-slate-300 p-1.5 transition-colors cursor-pointer ${
                        dragOverKey === `${day}_1` ? 'bg-emerald-100 border-emerald-400 border-2' : 'hover:bg-emerald-50/50'
                      }`}
                    >
                      <SlotCell entries={gridMap.get(`${day}_1`)} onDragStart={(e, entry) => handleDragStart(e, entry, day, 1)} />
                    </td>

                    {/* Period 2 */}
                    <td
                      onClick={() => handleSlotClick(day, 2)}
                      onDragOver={(e) => handleDragOver(e, day, 2)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, 2)}
                      className={`border border-slate-300 p-1.5 transition-colors cursor-pointer ${
                        dragOverKey === `${day}_2` ? 'bg-emerald-100 border-emerald-400 border-2' : 'hover:bg-emerald-50/50'
                      }`}
                    >
                      <SlotCell entries={gridMap.get(`${day}_2`)} onDragStart={(e, entry) => handleDragStart(e, entry, day, 2)} />
                    </td>

                    {/* Tea Break Cell */}
                    <td className="border border-slate-300 bg-amber-50/40 text-amber-700 text-[10px] font-medium p-1">
                      <div className="h-full flex items-center justify-center text-slate-400 font-mono">||</div>
                    </td>

                    {/* Period 3 */}
                    <td
                      onClick={() => handleSlotClick(day, 3)}
                      onDragOver={(e) => handleDragOver(e, day, 3)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, 3)}
                      className={`border border-slate-300 p-1.5 transition-colors cursor-pointer ${
                        dragOverKey === `${day}_3` ? 'bg-emerald-100 border-emerald-400 border-2' : 'hover:bg-emerald-50/50'
                      }`}
                    >
                      <SlotCell entries={gridMap.get(`${day}_3`)} onDragStart={(e, entry) => handleDragStart(e, entry, day, 3)} />
                    </td>

                    {/* Period 4 */}
                    <td
                      onClick={() => handleSlotClick(day, 4)}
                      onDragOver={(e) => handleDragOver(e, day, 4)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, 4)}
                      className={`border border-slate-300 p-1.5 transition-colors cursor-pointer ${
                        dragOverKey === `${day}_4` ? 'bg-emerald-100 border-emerald-400 border-2' : 'hover:bg-emerald-50/50'
                      }`}
                    >
                      <SlotCell entries={gridMap.get(`${day}_4`)} onDragStart={(e, entry) => handleDragStart(e, entry, day, 4)} />
                    </td>

                    {/* Lunch Break Cell */}
                    <td className="border border-slate-300 bg-amber-50/40 text-amber-700 text-[10px] font-medium p-1">
                      <div className="h-full flex items-center justify-center text-slate-400 font-mono">||</div>
                    </td>

                    {/* Period 5 */}
                    <td
                      onClick={() => handleSlotClick(day, 5)}
                      onDragOver={(e) => handleDragOver(e, day, 5)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, 5)}
                      className={`border border-slate-300 p-1.5 transition-colors cursor-pointer ${
                        dragOverKey === `${day}_5` ? 'bg-emerald-100 border-emerald-400 border-2' : 'hover:bg-emerald-50/50'
                      }`}
                    >
                      <SlotCell entries={gridMap.get(`${day}_5`)} onDragStart={(e, entry) => handleDragStart(e, entry, day, 5)} />
                    </td>

                    {/* Period 6 */}
                    <td
                      onClick={() => handleSlotClick(day, 6)}
                      onDragOver={(e) => handleDragOver(e, day, 6)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, 6)}
                      className={`border border-slate-300 p-1.5 transition-colors cursor-pointer ${
                        dragOverKey === `${day}_6` ? 'bg-emerald-100 border-emerald-400 border-2' : 'hover:bg-emerald-50/50'
                      }`}
                    >
                      <SlotCell entries={gridMap.get(`${day}_6`)} onDragStart={(e, entry) => handleDragStart(e, entry, day, 6)} />
                    </td>

                    {/* Period 7 */}
                    <td
                      onClick={() => handleSlotClick(day, 7)}
                      onDragOver={(e) => handleDragOver(e, day, 7)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, 7)}
                      className={`border border-slate-300 p-1.5 transition-colors cursor-pointer ${
                        dragOverKey === `${day}_7` ? 'bg-emerald-100 border-emerald-400 border-2' : 'hover:bg-emerald-50/50'
                      }`}
                    >
                      <SlotCell entries={gridMap.get(`${day}_7`)} onDragStart={(e, entry) => handleDragStart(e, entry, day, 7)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Subject Legend Table (below grid, part of PDF export) ── */}
          {timetableEntries.length > 0 && (() => {
            // Deduplicate subjects that appear in this semester's timetable
            const seen = new Set();
            const legendRows = timetableEntries
              .filter(e => { if (seen.has(e.subject_code)) return false; seen.add(e.subject_code); return true; })
              .sort((a, b) => a.subject_code.localeCompare(b.subject_code));
            return (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <table className="w-full border-collapse border border-slate-300 text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
                      <th className="border border-slate-300 px-3 py-2 text-left w-28">Subject Code</th>
                      <th className="border border-slate-300 px-3 py-2 text-left">Subject Name</th>
                      <th className="border border-slate-300 px-3 py-2 text-left">Faculty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legendRows.map((entry) => (
                      <tr key={entry.subject_code} className="even:bg-slate-50 hover:bg-emerald-50/40 transition-colors">
                        <td className="border border-slate-300 px-3 py-1.5 font-mono font-bold text-xs text-slate-800">
                          {entry.subject_code}
                        </td>
                        <td className="border border-slate-300 px-3 py-1.5 text-xs text-slate-700">
                          {entry.subject_name}
                        </td>
                        <td className="border border-slate-300 px-3 py-1.5 text-xs text-slate-600">
                          {entry.faculty_name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Moving slot spinner overlay */}
      {movingSlot && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl px-6 py-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <span className="text-sm font-semibold text-slate-700">Moving subject...</span>
          </div>
        </div>
      )}

      {/* Parallel / Replace Confirmation Dialog */}
      {parallelDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full mx-4 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
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
                <span className="text-slate-600">
                  Current: <strong>{parallelDialog.targetEntries[0]?.subject_code}</strong> — {parallelDialog.targetEntries[0]?.subject_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span className="text-slate-600">
                  Incoming: <strong>{parallelDialog.drag.subjectCode}</strong>
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Run both subjects in parallel, or replace the current subject?
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmParallel}
                  disabled={parallelDialog.targetEntries.length >= 2}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-40"
                  title="Schedule both subjects in parallel"
                >
                  ✅ Yes, make parallel
                </button>
                <button
                  type="button"
                  onClick={handleReplaceSlot}
                  className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1"
                  title={`Replace ${parallelDialog.targetEntries[0]?.subject_code} with ${parallelDialog.drag.subjectCode}`}
                >
                  🔄 No, replace {parallelDialog.targetEntries[0]?.subject_code}
                </button>
              </div>
              <button
                type="button"
                onClick={handleDismissParallel}
                className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-colors"
              >
                Cancel (Leave unchanged)
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
          color: '#000000',
        }}
        className="p-6 font-sans bg-white text-black border-2 border-black box-border"
      >
        {/* 1. Official Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
          <div className="w-24 text-center">
            <div className="border-2 border-black px-2 py-0.5 font-serif font-black text-sm tracking-tighter inline-block">
              YIT
            </div>
            <div className="text-[8px] font-bold tracking-wider font-mono text-slate-800">YENEPOYA</div>
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-black tracking-wide uppercase font-serif text-black leading-tight">
              YENEPOYA INSTITUTE OF TECHNOLOGY
            </h1>
            <p className="text-[10px] text-slate-800 font-semibold tracking-wide">
              NH-13, Thodar, Moodbidri - 574225
            </p>
            <p className="text-xs font-bold text-black mt-0.5">
              Department of {activeDepartment?.name || 'Computer Science and Engineering'}
            </p>
            <p className="text-xs font-extrabold uppercase tracking-wider text-black mt-0.5">
              TIME TABLE - {((currentSemester?.number || 1) % 2 === 1) ? 'ODD' : 'EVEN'} SEMESTER (AY {academicYear})
            </p>
          </div>
          <div className="w-24 text-right text-[10px] font-mono text-slate-800">
            {activeDepartment?.code && (
              <span className="border border-black px-1.5 py-0.5 font-bold uppercase">{activeDepartment.code}</span>
            )}
          </div>
        </div>

        {/* 2. Metadata Sub-Header */}
        <div className="grid grid-cols-3 border border-black text-[11px] font-bold uppercase mb-2 text-center py-1 bg-slate-50">
          <div className="border-r border-black px-2">
            CLASS: {(() => {
              const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII' };
              const r = currentSemester ? ROMAN[currentSemester.number] : null;
              return r ? `${r} SEMESTER` : `SEMESTER ${currentSemester?.number || ''}`;
            })()}
          </div>
          <div className="border-r border-black px-2">
            CLASS ROOM: {currentSemester?.class_room || 'LLH-01'}
          </div>
          <div className="px-2">
            W.E.F: {currentSemester?.academic_year || academicYear}
          </div>
        </div>

        {/* 3. Timetable Grid */}
        <table className="w-full border-collapse border border-black text-center text-xs mb-3 table-fixed">
          <thead>
            <tr className="bg-slate-100 text-black font-bold text-[10px] uppercase">
              <th className="border border-black py-1.5 px-1 w-24">Day \ Time</th>
              <th className="border border-black py-1 px-1">
                <div>09:00AM - 09:55AM</div>
                <div className="text-[9px] font-normal font-mono">Period 1</div>
              </th>
              <th className="border border-black py-1 px-1">
                <div>09:55AM - 10:50AM</div>
                <div className="text-[9px] font-normal font-mono">Period 2</div>
              </th>
              <th className="border border-black py-1 px-0.5 w-7 text-[8px] bg-slate-100">
                TEA
              </th>
              <th className="border border-black py-1 px-1">
                <div>11:10AM - 12:05PM</div>
                <div className="text-[9px] font-normal font-mono">Period 3</div>
              </th>
              <th className="border border-black py-1 px-1">
                <div>12:05PM - 01:00PM</div>
                <div className="text-[9px] font-normal font-mono">Period 4</div>
              </th>
              <th className="border border-black py-1 px-0.5 w-7 text-[8px] bg-slate-100">
                LUNCH
              </th>
              <th className="border border-black py-1 px-1">
                <div>01:50PM - 02:40PM</div>
                <div className="text-[9px] font-normal font-mono">Period 5</div>
              </th>
              <th className="border border-black py-1 px-1">
                <div>02:40PM - 03:30PM</div>
                <div className="text-[9px] font-normal font-mono">Period 6</div>
              </th>
              <th className="border border-black py-1 px-1">
                <div>03:30PM - 04:15PM</div>
                <div className="text-[9px] font-normal font-mono">Period 7</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dIdx) => {
              const p1 = gridMap.get(`${day}_1`) || [];
              const p2 = gridMap.get(`${day}_2`) || [];
              const p3 = gridMap.get(`${day}_3`) || [];
              const p4 = gridMap.get(`${day}_4`) || [];
              const p5 = gridMap.get(`${day}_5`) || [];
              const p6 = gridMap.get(`${day}_6`) || [];
              const p7 = gridMap.get(`${day}_7`) || [];

              const renderPrintCell = (items) => {
                if (!items || items.length === 0) return <span className="text-slate-300 font-mono text-[9px]">—</span>;
                if (items.length === 1) {
                  const it = items[0];
                  return (
                    <div className="font-mono font-bold text-[11px] text-black leading-tight">
                      <span>{it.subject_code}</span>
                      {(it.is_lab || it.session_type === 'lab') && (
                        <span className="block text-[8px] font-sans font-semibold text-slate-600">(LAB)</span>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col justify-center gap-0.5 text-[9px] leading-tight">
                    {items.map((it, idx) => (
                      <div key={idx} className={idx > 0 ? "border-t border-slate-400 pt-0.5" : ""}>
                        <span className="font-mono font-bold">{it.subject_code}</span>
                      </div>
                    ))}
                  </div>
                );
              };

              return (
                <tr key={day} className="h-10">
                  <td className="border border-black bg-slate-50 font-bold text-black text-[11px] uppercase tracking-wider py-1 px-1">
                    {day}
                  </td>

                  {/* Period 1 & 2 */}
                  <td className="border border-black p-1">{renderPrintCell(p1)}</td>
                  <td className="border border-black p-1">{renderPrintCell(p2)}</td>

                  {/* Tea Break: spanning all 6 rows */}
                  {dIdx === 0 && (
                    <td rowSpan={6} className="border border-black bg-slate-50 text-center py-2 px-0.5 w-7">
                      <div className="flex flex-col items-center justify-center font-bold text-[8px] tracking-widest text-slate-800 leading-tight">
                        <span>T</span>
                        <span>E</span>
                        <span>A</span>
                        <span className="my-1 text-[6px]">•</span>
                        <span>B</span>
                        <span>R</span>
                        <span>E</span>
                        <span>A</span>
                        <span>K</span>
                      </div>
                    </td>
                  )}

                  {/* Period 3 & 4 */}
                  <td className="border border-black p-1">{renderPrintCell(p3)}</td>
                  <td className="border border-black p-1">{renderPrintCell(p4)}</td>

                  {/* Lunch Break: spanning all 6 rows */}
                  {dIdx === 0 && (
                    <td rowSpan={6} className="border border-black bg-slate-50 text-center py-2 px-0.5 w-7">
                      <div className="flex flex-col items-center justify-center font-bold text-[8px] tracking-widest text-slate-800 leading-tight">
                        <span>L</span>
                        <span>U</span>
                        <span>N</span>
                        <span>C</span>
                        <span>H</span>
                        <span className="my-1 text-[6px]">•</span>
                        <span>B</span>
                        <span>R</span>
                        <span>E</span>
                        <span>A</span>
                        <span>K</span>
                      </div>
                    </td>
                  )}

                  {/* Period 5, 6, 7 */}
                  <td className="border border-black p-1">{renderPrintCell(p5)}</td>
                  <td className="border border-black p-1">{renderPrintCell(p6)}</td>
                  <td className="border border-black p-1">{renderPrintCell(p7)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 4. Subject Legend Table */}
        {(() => {
          const seen = new Set();
          const printLegend = timetableEntries
            .filter(e => {
              if (!e.subject_code || seen.has(e.subject_code)) return false;
              seen.add(e.subject_code);
              return true;
            })
            .sort((a, b) => a.subject_code.localeCompare(b.subject_code));

          const advisor = currentSemester?.class_advisor || '—';
          const mentors = currentSemester?.mentors || '—';

          return (
            <div className="border border-black mb-3 text-xs">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-100 text-black font-bold text-[10px] uppercase border-b border-black">
                    <th className="border-r border-black px-2 py-1 w-32">Subject Code</th>
                    <th className="border-r border-black px-2 py-1">Subject</th>
                    <th className="px-2 py-1 w-72">Faculty</th>
                  </tr>
                </thead>
                <tbody>
                  {printLegend.map((it, idx) => (
                    <tr key={it.subject_code || idx} className="border-b border-slate-300 text-[10px]">
                      <td className="border-r border-black px-2 py-0.5 font-mono font-bold text-black">
                        {it.subject_code}
                      </td>
                      <td className="border-r border-black px-2 py-0.5 text-slate-800">
                        {it.subject_name}
                      </td>
                      <td className="px-2 py-0.5 text-slate-800">
                        {it.faculty_name || '—'}
                      </td>
                    </tr>
                  ))}
                  {/* Advisor and Mentors footer row */}
                  <tr className="bg-slate-50 font-semibold text-[10px] text-black">
                    <td colSpan={2} className="border-r border-black px-2 py-1">
                      <strong>Class Advisor:</strong> {advisor}
                    </td>
                    <td className="px-2 py-1">
                      <strong>Mentors:</strong> {mentors}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* 5. Signatures Footer */}
        <div className="grid grid-cols-3 text-center text-xs font-bold pt-4 mt-2">
          <div>
            <div className="h-5" />
            <div className="border-t border-black pt-1 inline-block min-w-[170px]">
              Time Table Coordinator
            </div>
          </div>
          <div>
            <div className="h-5" />
            <div className="border-t border-black pt-1 inline-block min-w-[170px]">
              Head of the Department
            </div>
          </div>
          <div>
            <div className="h-5" />
            <div className="border-t border-black pt-1 inline-block min-w-[170px]">
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
  theory:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-950',   badge: 'bg-blue-200 text-blue-800',   label: null },
  lab:      { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-950',  badge: 'bg-amber-200 text-amber-800',  label: 'LAB' },
  block:    { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-950', badge: 'bg-orange-200 text-orange-800', label: 'BLOCK' },
  activity: { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-950',   badge: 'bg-teal-200 text-teal-800',   label: 'ACT' },
};

// Compact Slot Renderer — shows subject code + session badge only.
// Full details (name, faculty) are in the legend table below the grid.
function SlotCell({ entries, onDragStart }) {
  const items = Array.isArray(entries) ? entries : (entries ? [entries] : []);

  if (items.length === 0) {
    return (
      <div className="h-full min-h-[58px] flex items-center justify-center">
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
            draggable
            onDragStart={(e) => { e.stopPropagation(); onDragStart && onDragStart(e, entry); }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-between px-1.5 py-1 rounded bg-purple-50 border border-purple-200 cursor-grab active:cursor-grabbing active:opacity-60 transition-opacity"
          >
            <span className="font-mono font-bold text-[11px] text-purple-900">{entry.subject_code}</span>
            <span className="text-[8px] font-bold bg-purple-200 text-purple-800 px-1 rounded">PAR</span>
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
      className={`h-full min-h-[58px] px-2 py-1.5 rounded-md flex items-center justify-between border shadow-xs cursor-grab active:cursor-grabbing active:opacity-60 transition-opacity select-none ${style.bg} ${style.border} ${style.text}`}
    >
      <span className="font-mono font-bold text-xs tracking-tight">{entry.subject_code}</span>
      {style.label && (
        <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${style.badge}`}>
          {style.label}
        </span>
      )}
    </div>
  );
}
