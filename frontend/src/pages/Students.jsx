import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import api from '../api/client';



export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [filterClass, setFilterClass] = useState('All');
  const [availableClasses, setAvailableClasses] = useState([]);
  const [formData, setFormData] = useState({
    id: '', name: '', className: '', section: '', year: new Date().getFullYear(),
  });

  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        const data = await api.get('/students');
        if (data && data.students) {
          const formatted = data.students.map(s => ({
            id: s.id,
            student_id: s.student_id,
            name: s.name,
            class_name: s.class_name,
            section: s.section,
            year: s.year,
            faceRegistered: s.has_face_registered,
            status: s.is_active ? 'active' : 'inactive',
          }));
          setStudents(formatted);
        }
        
        const classesData = await api.get('/students/classes').catch(() => []);
        if (Array.isArray(classesData)) {
          setAvailableClasses(classesData);
        }
      } catch (err) {
        console.error("Failed to load students", err);
      } finally {
        setLoading(false);
      }
    };
    loadStudents();
  }, []);

  const filteredStudents = filterClass === 'All'
    ? students
    : students.filter(s => s.class_name === filterClass);

  const columns = [
    { key: 'id', accessor: 'student_id', header: 'Student ID', width: '120px' },
    {
      key: 'name',
      accessor: 'name',
      header: 'Name',
      render: (val) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
      ),
    },
    {
      key: 'classSection',
      accessor: 'class_name',
      header: 'Group & Subgroup',
      render: (_, row) => `${row.class_name || ''} - ${row.section || ''}`
    },
    {
      key: 'year',
      accessor: 'year',
      header: 'Year',
      render: (val) => val,
    },
    {
      key: 'faceRegistered',
      accessor: 'faceRegistered',
      header: 'Face Registered',
      render: (val) => <StatusBadge status={val ? 'yes' : 'no'} />,
    },
    {
      key: 'status',
      accessor: 'status',
      header: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'actions',
      accessor: () => '',
      header: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
            title="Edit"
          >
            ✏️
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      ),
    },
  ];

  const handleEdit = (student) => {
    setEditStudent(student);
    setFormData({
      id: student.student_id,
      name: student.name,
      className: student.class_name || '',
      section: student.section || '',
      year: student.year,
    });
    setShowModal(true);
  };

  const handleDelete = async (student) => {
    if (confirm(`Delete student ${student.name}?`)) {
      try {
        await api.delete(`/students/${student.id}`);
        setStudents(prev => prev.filter(s => s.id !== student.id));
      } catch (err) {
        alert(err.message || 'Failed to delete student');
      }
    }
  };

  const handleAdd = () => {
    setEditStudent(null);
    setFormData({ id: '', name: '', className: '', section: '', year: new Date().getFullYear() });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editStudent) {
        const payload = {
          name: formData.name,
          class_name: formData.className,
          section: formData.section,
          year: formData.year,
        };
        const updated = await api.put(`/students/${editStudent.id}`, payload);
        setStudents(prev => prev.map(s =>
          s.id === editStudent.id
            ? {
                id: updated.id,
                student_id: updated.student_id,
                name: updated.name,
                class_name: updated.class_name,
                section: updated.section,
                year: updated.year,
                faceRegistered: updated.has_face_registered,
                status: updated.is_active ? 'active' : 'inactive',
              }
            : s
        ));
      } else {
        const payload = {
          student_id: formData.id,
          name: formData.name,
          class_name: formData.className,
          section: formData.section,
          year: formData.year,
        };
        const created = await api.post('/students', payload);
        setStudents(prev => [...prev, {
          id: created.id,
          student_id: created.student_id,
          name: created.name,
          class_name: created.class_name,
          section: created.section,
          year: created.year,
          faceRegistered: created.has_face_registered,
          status: created.is_active ? 'active' : 'inactive',
        }]);
      }
      setShowModal(false);
    } catch (err) {
      alert(err.message || 'Failed to save student');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Students</h2>
          <p>Manage enrolled students and their face registrations</p>
        </div>
        <div className="page-header-right">
          <select
            className="form-select"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            id="filter-class"
            style={{ width: 180 }}
          >
            <option value="All">All</option>
            {availableClasses.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleAdd} id="btn-add-student">
            + Add Student
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredStudents}
        loading={loading}
        searchPlaceholder="Search students by name, ID, or class..."
        id="students-table"
        emptyIcon="🎓"
        emptyTitle="No students found"
        emptySubtitle="Add your first student to get started"
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editStudent ? 'Edit Student' : 'Add Student'}
      >
        <form onSubmit={handleSave} id="student-form">
          <div className="form-group">
            <label className="form-label" htmlFor="student-id">Student ID</label>
            <input
              type="text"
              className="form-input"
              id="student-id"
              placeholder="e.g. STU016"
              value={formData.id}
              onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
              disabled={!!editStudent}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="student-name">Full Name</label>
            <input
              type="text"
              className="form-input"
              id="student-name"
              placeholder="Enter student's full name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="student-class">Group / Class</label>
              <input
                type="text"
                list="modal-classes-list"
                className="form-input"
                id="student-class"
                placeholder="e.g. Class 10, HR"
                value={formData.className}
                onChange={(e) => setFormData(prev => ({ ...prev, className: e.target.value }))}
              />
              <datalist id="modal-classes-list">
                {availableClasses.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="student-section">Subgroup / Section</label>
              <input
                type="text"
                className="form-input"
                id="student-section"
                placeholder="e.g. A, Floor 2"
                value={formData.section}
                onChange={(e) => setFormData(prev => ({ ...prev, section: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="student-year">Year</label>
              <input
                type="number"
                className="form-input"
                id="student-year"
                value={formData.year}
                onChange={(e) => setFormData(prev => ({ ...prev, year: Number(e.target.value) }))}
                min="2000"
                max="2100"
              />
            </div>
          </div>

          <div className="modal-footer" style={{ padding: 'var(--space-4) 0 0', borderTop: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" id="btn-save-student">
              {editStudent ? 'Save Changes' : 'Add Student'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
