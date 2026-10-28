import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StudentResults } from '@/lib/api';

type Who = { name: string; rollNumber: string; department: string; year: number; college: string };

export function buildResultsPdf(r: StudentResults, who: Who): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const teal: [number, number, number] = [15, 118, 110];
  doc
    .setFont('helvetica', 'bold')
    .setFontSize(16)
    .setTextColor(...teal)
    .text(who.college, 40, 50);
  doc
    .setFont('helvetica', 'normal')
    .setFontSize(10)
    .setTextColor(100)
    .text('Statement of results (generated from the Student Support Portal)', 40, 66);
  doc.setTextColor(20).setFontSize(10.5);
  const lines: [string, string][] = [
    ['Name', who.name],
    ['Roll number', who.rollNumber],
    ['Department / year', `${who.department}, year ${who.year}`],
    [
      'CGPA',
      r.cgpa != null ? `${r.cgpa.toFixed(2)} (${r.creditsCompleted} credits)` : 'Not available yet',
    ],
  ];
  lines.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold').text(`${k}:`, 40, 92 + i * 15);
    doc.setFont('helvetica', 'normal').text(v, 150, 92 + i * 15);
  });
  let y = 92 + lines.length * 15 + 10;
  for (const sem of r.semesters)
    for (const ex of sem.exams) {
      doc
        .setFont('helvetica', 'bold')
        .setFontSize(12)
        .setTextColor(...teal)
        .text(`Semester ${sem.semester} · ${ex.examType}`, 40, y + 14);
      autoTable(doc, {
        startY: y + 22,
        margin: { left: 40, right: 40 },
        styles: { fontSize: 9.5, cellPadding: 4 },
        headStyles: { fillColor: [241, 245, 249], textColor: 60 },
        head: [['Code', 'Subject', 'Credits', 'Marks', 'Grade', 'Points']],
        body: ex.subjects.map((s) => [
          s.code,
          s.name,
          String(s.credits),
          `${s.marks} / ${s.maxMarks}`,
          s.grade,
          String(s.gradePoint),
        ]),
        foot: [
          [
            '',
            'Total',
            '',
            `${ex.totalMarks} / ${ex.totalMax}`,
            `${ex.percentage}%`,
            ex.sgpa != null ? `SGPA ${ex.sgpa.toFixed(2)}` : '',
          ],
        ],
        footStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'bold' },
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 4 && d.cell.raw === 'F')
            d.cell.styles.textColor = [190, 18, 60];
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }
  doc
    .setFontSize(8)
    .setTextColor(120)
    .text(
      `Generated on ${new Date().toLocaleString('en-IN')}. For reference only; the official marks card is issued by the examination office.`,
      40,
      Math.min(y + 20, 810),
    );
  return doc;
}

export const downloadResultsPdf = (r: StudentResults, who: Who) =>
  buildResultsPdf(r, who).save(`results-${who.rollNumber}.pdf`);
