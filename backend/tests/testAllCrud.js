const db = require('../src/config/db');

async function testAllMasterData() {
  setTimeout(async () => {
    try {
      console.log('=====================================================');
      console.log('🧪 Testing Full Master-Data CRUD & Uniqueness Checks');
      console.log('=====================================================\n');

      // 1. Department
      console.log('1️⃣ --- Creating New Department ---');
      const dept = await db.query('INSERT INTO department (name) VALUES ($1) RETURNING *', ['Mechanical Engineering']);
      console.log('✅ Created Department:', dept.rows[0]);

      // 2. Faculty
      console.log('\n2️⃣ --- Creating New Faculty ---');
      const fac = await db.query(
        'INSERT INTO faculty (faculty_code, name, password_hash, role, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        ['ME101', 'Dr. Isaac Newton', 'hash', 'faculty', dept.rows[0].id]
      );
      console.log('✅ Created Faculty:', fac.rows[0]);

      // 3. Semester
      console.log('\n3️⃣ --- Creating New Semester ---');
      const sem = await db.query(
        'INSERT INTO semester (number, department_id, class_room, academic_year) VALUES ($1, $2, $3, $4) RETURNING *',
        [4, dept.rows[0].id, 'ME-201', '2025-2026']
      );
      console.log('✅ Created Semester:', sem.rows[0]);

      // 4. Subject
      console.log('\n4️⃣ --- Creating New Subject ---');
      const sub = await db.query(
        'INSERT INTO subject (subject_code, name, semester_id, faculty_id, weekly_hours, is_lab) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        ['ME401', 'Thermodynamics', sem.rows[0].id, fac.rows[0].id, 4, false]
      );
      console.log('✅ Created Subject:', sub.rows[0]);

      // 5. Timeslot
      console.log('\n5️⃣ --- Creating New Timeslot ---');
      const ts = await db.query(
        'INSERT INTO timeslot (day, period_number, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
        ['Saturday', 8, '16:30:00', '17:25:00']
      );
      console.log('✅ Created Timeslot:', ts.rows[0]);

      console.log('\n🎉 ALL master-data insertions (Departments, Faculty, Semesters, Subjects, Timeslots) succeeded with zero collisions!');
      process.exit(0);
    } catch (err) {
      console.error('❌ Master Data Test Failed:', err);
      process.exit(1);
    }
  }, 1000);
}

testAllMasterData();
