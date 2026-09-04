import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { 
  Building2, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Clock, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  AlertTriangle
} from 'lucide-react';

export default function AdminMasterData() {
  const { user, activeDepartment } = useAuth();
  const { addToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState('subjects'); // 'departments' | 'faculty' | 'semesters' | 'subjects' | 'timeslots'

  // Data states
  const [departments, setDepartments] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [timeslots, setTimeslots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & Edit states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  // Cross-dept faculty conflict state: null | { id, name, department_name, department_code }
  const [conflictFaculty, setConflictFaculty] = useState(null);

  // Delete Confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Load all master datasets — scoped to active department
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const deptId = activeDepartment?.id;
      const [deptRes, facRes, semRes, subRes, tsRes] = await Promise.all([
        api.getDepartments(),
        api.getFaculty(deptId ? { department_id: deptId } : {}),
        api.getSemesters(deptId ? { department_id: deptId } : {}),
        api.getSubjects(deptId ? { department_id: deptId } : {}),
        api.getTimeslots()
      ]);
      setDepartments(deptRes);
      setFaculty(facRes);
      setSemesters(semRes);
      setSubjects(subRes);
      setTimeslots(tsRes);
    } catch (err) {
      addToast(err.message || 'Failed to load master data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [activeDepartment?.id]);

  // All lists are already scoped by the fetch — use directly
  const targetDeptId = activeDepartment?.id ? String(activeDepartment.id) : null;
  const filteredFaculty = faculty;
  const filteredSemesters = semesters;
  const filteredSubjects = subjects;

  // Open Create/Edit modal
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setConflictFaculty(null);
    const defaultDeptId = targetDeptId || activeDepartment?.id || departments[0]?.id || '';
    if (activeSubTab === 'departments') setFormData({ name: '', code: '' });
    if (activeSubTab === 'faculty') setFormData({ faculty_code: '', name: '', password: '', role: 'faculty', department_id: defaultDeptId });
    if (activeSubTab === 'semesters') setFormData({ number: 3, department_id: defaultDeptId, class_room: '', academic_year: '2025-2026', class_advisor: '', mentors: '' });
    if (activeSubTab === 'subjects') {
      setFormData({ 
        subject_code: '', 
        name: '', 
        semester_id: filteredSemesters[0]?.id || '', 
        faculty_id: filteredFaculty[0]?.id || '', 
        weekly_hours: 4, 
        is_lab: false, 
        is_parallel_activity: false, 
        is_generic_activity: false 
      });
    }
    if (activeSubTab === 'timeslots') setFormData({ day: 'Monday', period_number: 1, start_time: '09:00:00', end_time: '09:55:00' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setConflictFaculty(null);
    if (activeSubTab === 'departments') setFormData({ name: item.name, code: item.code || '' });
    if (activeSubTab === 'faculty') setFormData({ faculty_code: item.faculty_code, name: item.name, password: '', role: item.role, department_id: item.department_id });
    if (activeSubTab === 'semesters') setFormData({ number: item.number, department_id: item.department_id, class_room: item.class_room, academic_year: item.academic_year, class_advisor: item.class_advisor || '', mentors: item.mentors || '' });
    if (activeSubTab === 'subjects') setFormData({ subject_code: item.subject_code, name: item.name, semester_id: item.semester_id, faculty_id: item.faculty_id, weekly_hours: item.weekly_hours, is_lab: item.is_lab, is_parallel_activity: Boolean(item.is_parallel_activity), is_generic_activity: Boolean(item.is_generic_activity) });
    if (activeSubTab === 'timeslots') setFormData({ day: item.day, period_number: item.period_number, start_time: item.start_time, end_time: item.end_time });
    setIsModalOpen(true);
  };

  // Submit Add / Edit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeSubTab === 'subjects') {
      if (!formData.semester_id) {
        addToast('Please select a valid semester for this subject. If none exist in this department, create a semester first.', 'error');
        return;
      }
      if (!formData.faculty_id) {
        addToast('Please select a faculty member for this subject.', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      if (activeSubTab === 'departments') {
        if (editingItem) await api.updateDepartment(editingItem.id, formData);
        else await api.createDepartment(formData);
      } else if (activeSubTab === 'faculty') {
        if (editingItem) {
          await api.updateFaculty(editingItem.id, formData);
        } else {
          // Use raw fetch so we can intercept 409 cross-dept conflict without throwing
          const { status, data } = await api.createFacultyRaw(formData);
          if (status === 409 && data.conflict) {
            // Cross-department clash — show confirmation banner, keep modal open
            setConflictFaculty(data.existing);
            setSaving(false);
            return;
          }
          if (status >= 400) {
            // Hard error (same-dept duplicate, validation error, etc.)
            throw new Error(data.error || `Error ${status}`);
          }
          // 201 Created — success
        }
      } else if (activeSubTab === 'semesters') {
        if (editingItem) await api.updateSemester(editingItem.id, formData);
        else await api.createSemester(formData);
      } else if (activeSubTab === 'subjects') {
        if (editingItem) await api.updateSubject(editingItem.id, formData);
        else await api.createSubject(formData);
      } else if (activeSubTab === 'timeslots') {
        if (editingItem) await api.updateTimeslot(editingItem.id, formData);
        else await api.createTimeslot(formData);
      }

      addToast(`${editingItem ? 'Updated' : 'Created'} successfully!`, 'success');
      setIsModalOpen(false);
      setConflictFaculty(null);
      fetchAllData();
    } catch (err) {
      addToast(err.message || 'Operation failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Action
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (activeSubTab === 'departments') await api.deleteDepartment(itemToDelete.id);
      else if (activeSubTab === 'faculty') await api.deleteFaculty(itemToDelete.id);
      else if (activeSubTab === 'semesters') await api.deleteSemester(itemToDelete.id);
      else if (activeSubTab === 'subjects') await api.deleteSubject(itemToDelete.id);
      else if (activeSubTab === 'timeslots') await api.deleteTimeslot(itemToDelete.id);

      addToast('Item deleted successfully', 'success');
      setDeleteModalOpen(false);
      setItemToDelete(null);
      fetchAllData();
    } catch (err) {
      addToast(err.message || 'Delete failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveSubTab('subjects')}
            className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeSubTab === 'subjects' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Subjects ({filteredSubjects.length})
          </button>
          <button
            onClick={() => setActiveSubTab('faculty')}
            className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeSubTab === 'faculty' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Faculty ({filteredFaculty.length})
          </button>
          <button
            onClick={() => setActiveSubTab('semesters')}
            className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeSubTab === 'semesters' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Semesters ({filteredSemesters.length})
          </button>
          <button
            onClick={() => setActiveSubTab('timeslots')}
            className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeSubTab === 'timeslots' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            Timeslots ({timeslots.length})
          </button>
          <button
            onClick={() => setActiveSubTab('departments')}
            className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeSubTab === 'departments' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Departments ({departments.length})
          </button>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New {activeSubTab.slice(0, -1)}
        </button>
      </div>

      {/* Main Table Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
          <p className="text-sm text-slate-500">Loading master data...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Subjects Table */}
          {activeSubTab === 'subjects' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Subject Name</th>
                    <th className="py-3 px-4">Semester</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Faculty Assigned</th>
                    <th className="py-3 px-4">Weekly Hours</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubjects.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{sub.subject_code}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{sub.name}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          Semester {sub.semester_number || sub.semester_id}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {sub.department_name ? (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            {sub.department_name}
                            {sub.department_code && (
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                                {sub.department_code}
                              </span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {sub.faculty_name} <span className="text-xs text-slate-600">({sub.faculty_code})</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{sub.weekly_hours} hrs/week</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          sub.is_lab ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {sub.is_lab ? 'Laboratory' : 'Theory'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(sub)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setItemToDelete(sub); setDeleteModalOpen(true); }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Faculty Table */}
          {activeSubTab === 'faculty' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Faculty Name</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFaculty.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{f.faculty_code}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{f.name}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase ${
                          f.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {f.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {f.department_name || `Dept #${f.department_id}`}
                        {f.department_code && (
                          <span className="ml-1.5 font-mono text-[10px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                            {f.department_code}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(f)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setItemToDelete(f); setDeleteModalOpen(true); }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Semesters Table */}
          {activeSubTab === 'semesters' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Semester Number</th>
                    <th className="py-3 px-4">Classroom</th>
                    <th className="py-3 px-4">Academic Year</th>
                    <th className="py-3 px-4">Advisor & Mentors</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSemesters.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">Semester {s.number} (S{s.number})</td>
                      <td className="py-3 px-4 font-mono font-medium text-emerald-700">{s.class_room}</td>
                      <td className="py-3 px-4 text-slate-600">{s.academic_year}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {s.class_advisor ? (
                          <div>
                            <span className="font-semibold text-slate-800">{s.class_advisor}</span>
                            {s.mentors && <div className="text-[11px] text-slate-500 mt-0.5">Mentors: {s.mentors}</div>}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {s.department_name || `Dept #${s.department_id}`}
                        {s.department_code && (
                          <span className="ml-1.5 font-mono text-[10px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded">
                            {s.department_code}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(s)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setItemToDelete(s); setDeleteModalOpen(true); }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Timeslots Table */}
          {activeSubTab === 'timeslots' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Day</th>
                    <th className="py-3 px-4">Period Number</th>
                    <th className="py-3 px-4">Start Time</th>
                    <th className="py-3 px-4">End Time</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {timeslots.map((ts) => (
                    <tr key={ts.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">{ts.day}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 text-slate-800">
                          Period {ts.period_number}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{ts.start_time}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{ts.end_time}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(ts)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setItemToDelete(ts); setDeleteModalOpen(true); }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Departments Table */}
          {activeSubTab === 'departments' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Department Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500">#{d.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{d.name}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                        {d.code || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(d)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setItemToDelete(d); setDeleteModalOpen(true); }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingItem ? 'Edit' : 'Add New'} ${activeSubTab.slice(0, -1)}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Departments Form */}
          {activeSubTab === 'departments' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Mechanical Engineering"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Department Code</label>
                <input
                  type="text"
                  required
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. MECH"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none uppercase font-mono"
                />
              </div>
            </div>
          )}

          {/* Faculty Form */}
          {activeSubTab === 'faculty' && (
            <>
              {/* Cross-department conflict banner */}
              {conflictFaculty && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 text-lg leading-none">⚠️</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Faculty code already registered in another department</p>
                      <p className="text-xs text-amber-600 mt-0.5">Is this the same person?</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white border border-amber-100 rounded-lg px-3 py-2.5">
                    <span className="text-2xl">👤</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{conflictFaculty.name}</p>
                      <p className="text-xs text-slate-500">
                        {conflictFaculty.department_name}
                        {conflictFaculty.department_code && (
                          <span className="ml-1 inline-block bg-slate-100 text-slate-600 font-mono text-[10px] px-1.5 py-0.5 rounded">
                            {conflictFaculty.department_code}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setConflictFaculty(null);
                        addToast(`${conflictFaculty.name} is already in the system and can be assigned to subjects in your department.`, 'success');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      ✅ Yes, same person
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConflictFaculty(null);
                        setFormData({ ...formData, faculty_code: '' });
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      ✎ No, use a different code
                    </button>
                  </div>
                </div>
              )}

              {/* Faculty form fields — hide when conflict is shown */}
              {!conflictFaculty && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Faculty Code</label>
                    <input
                      type="text"
                      required
                      value={formData.faculty_code || ''}
                      onChange={(e) => setFormData({ ...formData, faculty_code: e.target.value })}
                      placeholder="e.g. FAC105"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Dr. Jane Smith"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Password {editingItem && <span className="text-xs text-slate-400 font-normal">(Leave blank to keep current)</span>}
                    </label>
                    <input
                      type="password"
                      required={!editingItem}
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Role</label>
                      <select
                        value={formData.role || 'faculty'}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                      >
                        <option value="faculty">Faculty</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Department</label>
                      <select
                        value={formData.department_id || ''}
                        onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} {d.code ? `(${d.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Semesters Form */}
          {activeSubTab === 'semesters' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Semester Number</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={formData.number || ''}
                    onChange={(e) => setFormData({ ...formData, number: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Class Room</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LH-301"
                    value={formData.class_room || ''}
                    onChange={(e) => setFormData({ ...formData, class_room: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Academic Year</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2025-2026"
                    value={formData.academic_year || '2025-2026'}
                    onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Department</label>
                  <select
                    value={formData.department_id || ''}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.code ? `(${d.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Class Advisor</label>
                  <input
                    type="text"
                    placeholder="e.g. Mrs. Safmina P.K"
                    value={formData.class_advisor || ''}
                    onChange={(e) => setFormData({ ...formData, class_advisor: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Mentors</label>
                  <input
                    type="text"
                    placeholder="e.g. Mr. Uttam Bhise / Mr. Ede Naveen"
                    value={formData.mentors || ''}
                    onChange={(e) => setFormData({ ...formData, mentors: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* Subjects Form */}
          {activeSubTab === 'subjects' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Subject Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS301"
                    value={formData.subject_code || ''}
                    onChange={(e) => setFormData({ ...formData, subject_code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Subject Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Data Structures"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Semester</label>
                  {filteredSemesters.length === 0 ? (
                    <div className="p-2 border border-rose-200 bg-rose-50 rounded-lg text-xs text-rose-700">
                      No semesters in this department. Please create a semester first.
                    </div>
                  ) : (
                    <select
                      required
                      value={formData.semester_id || ''}
                      onChange={(e) => setFormData({ ...formData, semester_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    >
                      <option value="">Select Semester</option>
                      {filteredSemesters.map((s) => (
                        <option key={s.id} value={s.id}>
                          Semester {s.number} ({s.class_room}){s.department_name ? ` • ${s.department_name}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Faculty In-Charge</label>
                  <select
                    required
                    value={formData.faculty_id || ''}
                    onChange={(e) => setFormData({ ...formData, faculty_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                  >
                    <option value="">Select Faculty</option>
                    {(filteredFaculty.length > 0 ? filteredFaculty : faculty).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.faculty_code}){f.department_name ? ` • ${f.department_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Weekly Hours</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={formData.weekly_hours || 4}
                    onChange={(e) => setFormData({ ...formData, weekly_hours: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="pt-5">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.is_lab || false}
                      onChange={(e) => setFormData({ ...formData, is_lab: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    Is Laboratory Session?
                  </label>
                </div>
              </div>
              {/* Activity type flags */}
              <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Special Activity Flags</span>
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_parallel_activity || false}
                    onChange={(e) => setFormData({ ...formData, is_parallel_activity: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                  />
                  <span>Parallel Activity <span className="text-xs font-normal text-slate-500">(NSS/PE – two groups share same slot)</span></span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_generic_activity || false}
                    onChange={(e) => setFormData({ ...formData, is_generic_activity: e.target.checked })}
                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                  <span>Generic Activity <span className="text-xs font-normal text-slate-500">(Library, Mentoring, Placement – no faculty clash)</span></span>
                </label>
              </div>
            </>
          )}

          {/* Timeslots Form */}
          {activeSubTab === 'timeslots' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Day</label>
                  <select
                    value={formData.day || 'Monday'}
                    onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Period Number</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={formData.period_number || 1}
                    onChange={(e) => setFormData({ ...formData, period_number: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Start Time</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={formData.start_time || '09:00:00'}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">End Time</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={formData.end_time || '09:55:00'}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingItem ? 'Save Changes' : 'Create Item'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Deletion"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 text-rose-600 bg-rose-50 p-3 rounded-lg">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-rose-900">
              Are you sure you want to delete this record? This action cannot be undone and will cascade to associated timetable entries.
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
