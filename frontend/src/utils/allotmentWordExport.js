/**
 * Allotment Word Document (.doc) Exporter
 * Generates institutional Word document matching AIML-Subject_Allotment_PREFERENCES.docx
 */

export function exportAllotmentToWord({ session, courses, departmentName = 'Department of Artificial Intelligence and Machine Learning' }) {
  if (!session || !courses || courses.length === 0) {
    throw new Error('No allotment data available to export.');
  }

  // Group courses by semester
  const semesterGroups = {};
  courses.forEach(course => {
    const sem = course.semester_name || 'General';
    if (!semesterGroups[sem]) semesterGroups[sem] = [];
    semesterGroups[sem].push(course);
  });

  const acadYear = session.academic_year || '2026-27';
  const semType = (session.semester_type || 'ODD').toUpperCase();

  // Generate tables for each semester
  const semesterTablesHtml = Object.entries(semesterGroups).map(([semName, semCourses]) => {
    const rowsHtml = semCourses.map((c, idx) => {
      // Choice 1 text
      const c1Text = (c.choice_1 && c.choice_1.length > 0)
        ? c.choice_1.map(a => a.faculty_name).join(', ')
        : '-';

      // Choice 2 text
      const c2Text = (c.choice_2 && c.choice_2.length > 0)
        ? c.choice_2.map(a => a.faculty_name).join(', ')
        : '-';

      // Allotted faculty
      const allottedText = c.allotted_faculty_name || (c.is_allotted ? 'Allotted' : '-');

      return `
        <tr style="height: 22pt;">
          <td align="center" style="border: 1px solid #000; padding: 4px; font-size: 10pt;">${idx + 1}</td>
          <td align="left" style="border: 1px solid #000; padding: 4px; font-size: 10pt; font-weight: 500;">${c.course_name}</td>
          <td align="center" style="border: 1px solid #000; padding: 4px; font-size: 10pt; font-family: 'Courier New', monospace; font-weight: bold;">${c.course_code}</td>
          <td align="center" style="border: 1px solid #000; padding: 4px; font-size: 10pt;">${c.lecture_hours || 0}</td>
          <td align="center" style="border: 1px solid #000; padding: 4px; font-size: 10pt;">${c.tutorial_hours || 0}</td>
          <td align="center" style="border: 1px solid #000; padding: 4px; font-size: 10pt;">${c.practical_hours || 0}</td>
          <td align="center" style="border: 1px solid #000; padding: 4px; font-size: 10pt; font-weight: bold;">${c.credits || 0}</td>
          <td align="left" style="border: 1px solid #000; padding: 4px; font-size: 9.5pt;">${c1Text}</td>
          <td align="left" style="border: 1px solid #000; padding: 4px; font-size: 9.5pt;">${c2Text}</td>
          <td align="left" style="border: 1px solid #000; padding: 4px; font-size: 10pt; font-weight: bold; background-color: ${c.is_allotted ? '#f0fdf4' : '#ffffff'};">${allottedText}</td>
        </tr>
      `;
    }).join('');

    return `
      <div style="margin-top: 14pt; margin-bottom: 6pt;">
        <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase; background-color: #f1f5f9; padding: 5px 8px; border: 1px solid #000; border-bottom: none;">
          ${semName}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; border: 1.5px solid #000;" border="1" cellspacing="0" cellpadding="0">
          <thead>
            <tr style="background-color: #f8fafc; font-weight: bold; text-align: center; height: 26pt;">
              <th style="border: 1px solid #000; padding: 4px; width: 4%;">#</th>
              <th style="border: 1px solid #000; padding: 4px; width: 28%; text-align: left;">Course Name</th>
              <th style="border: 1px solid #000; padding: 4px; width: 10%;">Course Code</th>
              <th style="border: 1px solid #000; padding: 4px; width: 3%;">L</th>
              <th style="border: 1px solid #000; padding: 4px; width: 3%;">T</th>
              <th style="border: 1px solid #000; padding: 4px; width: 3%;">P</th>
              <th style="border: 1px solid #000; padding: 4px; width: 4%;">Credits</th>
              <th style="border: 1px solid #000; padding: 4px; width: 18%; text-align: left;">Choice 1</th>
              <th style="border: 1px solid #000; padding: 4px; width: 15%; text-align: left;">Choice 2</th>
              <th style="border: 1px solid #000; padding: 4px; width: 12%; text-align: left;">FACULTY</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  // Complete HTML Word document
  const wordHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>Subject Allotment - ${acadYear}</title>
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
        @page {
          size: A4 portrait;
          margin: 0.5in 0.5in 0.5in 0.5in;
          mso-header-margin: 0.2in;
          mso-footer-margin: 0.2in;
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 10pt;
          color: #000000;
          line-height: 1.15;
          margin: 0;
          padding: 0;
        }
        table {
          mso-displayed-decimal-separator: ".";
          mso-displayed-thousand-separator: ",";
          border-collapse: collapse;
        }
        p {
          margin: 0;
          padding: 0;
        }
      </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 12pt;">
        <h2 style="font-size: 14pt; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
          YENEPOYA INSTITUTE OF TECHNOLOGY
        </h2>
        <p style="font-size: 9.5pt; margin: 2pt 0 0 0;">NH-13, Thodar, Moodbidri - 574225</p>
        <p style="font-size: 11pt; font-weight: bold; margin: 3pt 0 0 0;">${departmentName}</p>
        <div style="font-size: 11pt; font-weight: bold; text-decoration: underline; margin-top: 4pt; text-transform: uppercase;">
          SUBJECT ALLOTMENT & COURSE PREFERENCES - ${semType} SEMESTER (${acadYear})
        </div>
      </div>

      ${semesterTablesHtml}

      <div style="margin-top: 36pt;">
        <table style="width: 100%; border: none; font-family: 'Times New Roman', Times, serif;" border="0">
          <tr>
            <td align="left" style="width: 33%; font-weight: bold; font-size: 10pt;">
              Time Table Coordinator
            </td>
            <td align="center" style="width: 34%; font-weight: bold; font-size: 10pt;">
              Head of the Department
            </td>
            <td align="right" style="width: 33%; font-weight: bold; font-size: 10pt;">
              Principal
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;

  // Trigger download as .doc file
  const blob = new Blob(['\ufeff' + wordHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  const fileName = `Subject_Allotment_${acadYear.replace(/\s+/g, '_')}_${semType}.doc`;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}
