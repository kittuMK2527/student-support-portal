export interface DeptDef {
  code: string;
  name: string;
  topics: [string, string, number][];
} // [course, teacher, credits]

export const CURRICULUM: Record<string, DeptDef[]> = {
  col_rce: [
    {
      code: 'CS',
      name: 'Computer Science',
      topics: [
        ['Data Structures', 'Dr. S. Krishnan', 4],
        ['Database Systems', 'Prof. R. Bhat', 4],
        ['Operating Systems', 'Dr. N. Varghese', 4],
        ['Computer Networks', 'Prof. A. Mishra', 3],
        ['Software Engineering', 'Dr. K. Sundaram', 3],
      ],
    },
    {
      code: 'ME',
      name: 'Mechanical',
      topics: [
        ['Thermodynamics', 'Dr. P. Banerjee', 4],
        ['Fluid Mechanics', 'Prof. L. Fernandes', 4],
        ['Machine Design', 'Dr. T. Joseph', 4],
        ['Manufacturing Processes', 'Prof. V. Iyer', 3],
        ['Engineering Drawing', 'Dr. M. Pillai', 3],
      ],
    },
    {
      code: 'EC',
      name: 'Electronics',
      topics: [
        ['Signals and Systems', 'Dr. A. Rao', 4],
        ['Digital Electronics', 'Prof. S. Menon', 4],
        ['Analog Circuits', 'Dr. R. Gupta', 4],
        ['Microprocessors', 'Prof. D. Nair', 3],
        ['Communication Systems', 'Dr. H. Shah', 3],
      ],
    },
  ],
  col_gasc: [
    {
      code: 'BC',
      name: 'Commerce',
      topics: [
        ['Financial Accounting', 'Dr. L. Narayan', 4],
        ['Business Law', 'Prof. J. Thomas', 4],
        ['Cost Accounting', 'Dr. S. Reddy', 4],
        ['Income Tax', 'Prof. K. Das', 3],
        ['Business Economics', 'Dr. P. Joshi', 3],
      ],
    },
    {
      code: 'PS',
      name: 'Psychology',
      topics: [
        ['General Psychology', 'Dr. A. Menon', 4],
        ['Developmental Psychology', 'Prof. R. Pillai', 4],
        ['Research Methods', 'Dr. N. Kapoor', 4],
        ['Social Psychology', 'Prof. M. George', 3],
        ['Statistics for Psychology', 'Dr. V. Rao', 3],
      ],
    },
    {
      code: 'MA',
      name: 'Mathematics',
      topics: [
        ['Real Analysis', 'Dr. K. Iyer', 4],
        ['Linear Algebra', 'Prof. S. Bose', 4],
        ['Differential Equations', 'Dr. R. Verma', 4],
        ['Probability', 'Prof. T. Khan', 3],
        ['Numerical Methods', 'Dr. G. Nair', 3],
      ],
    },
  ],
  col_lbs: [
    {
      code: 'MF',
      name: 'MBA Finance',
      topics: [
        ['Corporate Finance', 'Dr. R. Malhotra', 4],
        ['Investment Analysis', 'Prof. A. Sen', 4],
        ['Financial Markets', 'Dr. P. Shetty', 4],
        ['Risk Management', 'Prof. N. Jain', 3],
        ['Business Analytics', 'Dr. S. Kulkarni', 3],
      ],
    },
    {
      code: 'MM',
      name: 'MBA Marketing',
      topics: [
        ['Marketing Management', 'Dr. V. Chopra', 4],
        ['Consumer Behaviour', 'Prof. M. Rao', 4],
        ['Digital Marketing', 'Dr. A. Fernandes', 4],
        ['Brand Management', 'Prof. K. Hegde', 3],
        ['Sales Management', 'Dr. R. Bhat', 3],
      ],
    },
  ],
};
