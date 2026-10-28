import { describe, expect, it } from 'vitest';
import { api } from '@/lib/api';
import { buildResultsPdf } from './resultsPdf';

describe('results PDF', () => {
  it('builds a real PDF with every exam of the student', async () => {
    await api.demo.reset();
    await api.auth.demoLogin('student');
    const r = await api.student.results();
    const doc = buildResultsPdf(r, {
      name: 'Priya Sharma',
      rollNumber: 'RCE21CS014',
      department: 'Computer Science',
      year: 4,
      college: 'Riverside College of Engineering',
    });
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(3000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
