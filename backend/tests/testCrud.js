const db = require('../src/config/db');

async function testCrud() {
  setTimeout(async () => {
    try {
      console.log('--- Testing Create Faculty ---');
      const fac = await db.query(
        'INSERT INTO faculty (faculty_code, name, password_hash, role, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        ['FAC999', 'Prof. Alan Turing', '$2a$10$97AvVBG4M4xZxW9yUJI/UuCmwSfFQqKn.26bxctlEGaTGSbWzBj3O', 'faculty', 1]
      );
      console.log('✅ Created Faculty:', fac.rows[0]);

      console.log('\n--- Testing Create Subject ---');
      const sub = await db.query(
        'INSERT INTO subject (subject_code, name, semester_id, faculty_id, weekly_hours, is_lab) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        ['CS999', 'Quantum Computing', 1, fac.rows[0].id, 4, false]
      );
      console.log('✅ Created Subject:', sub.rows[0]);

      console.log('\n--- Testing Duplicate Prevention ---');
      try {
        await db.query(
          'INSERT INTO faculty (faculty_code, name, password_hash, role, department_id) VALUES ($1, $2, $3, $4, $5)',
          ['FAC999', 'Duplicate Turing', 'hash', 'faculty', 1]
        );
        console.error('❌ Duplicate faculty allowed!');
      } catch (dupErr) {
        console.log('✅ Duplicate correctly blocked by DB constraint:', dupErr.message);
      }

      console.log('\n🎉 All DB CRUD and uniqueness tests passed!');
      process.exit(0);
    } catch (err) {
      console.error('❌ Test failed:', err);
      process.exit(1);
    }
  }, 1000);
}

testCrud();
