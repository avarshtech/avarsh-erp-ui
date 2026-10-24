/**
 * Every word on the payslip, in English and Tamil.
 *
 * <p>Not an i18n framework. This repo has none, and the payslip is the only bilingual
 * thing in it - the form is printed and handed to a worker on the floor, so both
 * languages appear together on the same sheet rather than one being chosen. Installing
 * i18next to translate one printed form would be a dependency with a single caller and
 * a second place for these words to drift out of step.</p>
 *
 * <p>The Tamil is taken from the Form 25B slip this layout reproduces, not translated
 * afresh: these are the words the floor already reads, and "pay slip Tamil" from a
 * dictionary would be a different document.</p>
 */
export const L = {
  // Document
  payslip: { en: 'PAY SLIP', ta: 'சம்பளச் சீட்டு' },
  formNo: { en: 'FORM : 25B', ta: 'படிவம் : 25B' },
  salaryMonth: { en: 'Salary Month', ta: 'சம்பள மாதம்' },

  // Who
  name: { en: 'Name', ta: 'பெயர்' },
  fatherHusbandName: { en: 'F/H Name', ta: 'த/க பெயர்' },
  dept: { en: 'Dept', ta: 'துறை' },
  designation: { en: 'Designation', ta: 'பதவி' },
  idNo: { en: 'ID No.', ta: 'ஐடி எண்' },
  pfNo: { en: 'PF No', ta: 'பி.எஃப் எண்' },
  esiNo: { en: 'ESI No.', ta: 'ஈ.எஸ்.ஐ எண்' },
  joinDate: { en: 'Join Dt', ta: 'சேர்ந்த தேதி' },
  bankAcNo: { en: 'Bank A/c No.', ta: 'வங்கிக் கணக்கு எண்' },

  // Days
  earnDays: { en: 'Earn Days', ta: 'சம்பள நாட்கள்' },
  lopDays: { en: 'LOP Days', ta: 'இழப்பு நாட்கள்' },
  nhDays: { en: 'NH Days', ta: 'தேசிய விடுமுறை' },
  otHours: { en: 'O.T Hours', ta: 'ஓ.டி மணி நேரம்' },
  leaveDetails: { en: 'Leave Details', ta: 'விடுமுறை விவரங்கள்' },

  // Table headings
  particulars: { en: 'PARTICULARS', ta: 'விவரங்கள்' },
  actuals: { en: 'ACTUALS', ta: 'தற்போதைய சம்பளம்' },
  earnings: { en: 'EARNINGS', ta: 'வருமானம்' },
  deductionDetails: { en: 'DEDUCTIONS DETAILS', ta: 'கழிக்கப்படும் விவரங்கள்' },
  amount: { en: 'AMOUNT', ta: 'தொகை' },

  // Earnings lines
  basic: { en: 'Basic Salary', ta: 'அடிப்படை சம்பளம்' },
  da: { en: 'DA', ta: 'பஞ்சப்படி' },
  hra: { en: 'HRA', ta: 'வீட்டு வாடகைப்படி' },
  conveyance: { en: 'Conveyance', ta: 'பயணப்படி' },
  washing: { en: 'Washing Allowance', ta: 'சலவைப் படி' },
  otherAllowance: { en: 'Others', ta: 'மற்ற கொடுப்பனவுகள்' },
  arrears: { en: 'Arrears', ta: 'நிலுவை' },
  incentive: { en: 'Incentive', ta: 'ஊக்கத்தொகை' },
  attdBonus: { en: 'Attd. Bonus', ta: 'அட்டெண்டன்ஸ் போனஸ்' },
  ot: { en: 'O T / Hr', ta: 'மிகை நேரம்' },

  // Deduction lines
  esi: { en: 'ESI', ta: 'காப்பீடு' },
  pf: { en: 'PF', ta: 'வைப்பு நிதி' },
  profTax: { en: 'Prof Tax', ta: 'தொழில் வரி' },
  lwf: { en: 'LWF', ta: 'தொழிலாளர் நிதி' },
  advance: { en: 'Advance', ta: 'முன் பணம்' },
  lateArrival: { en: 'Late Arrival', ta: 'தாமதமாக வருகை' },
  loan: { en: 'Loan', ta: 'கடன்' },
  otherDeductions: { en: 'Others', ta: 'மற்றவை' },
  tds: { en: 'TDS', ta: 'வருமான வரி' },

  // Totals
  grossSalary: { en: 'Gross Salary', ta: 'மொத்த சம்பளம்' },
  earnedSalary: { en: 'Earned Salary', ta: 'ஈட்டிய சம்பளம்' },
  deductions: { en: 'Deductions', ta: 'பிடித்தங்கள்' },
  netSalary: { en: 'Net Salary', ta: 'நிகர் சம்பளம்' },
  totalAmount: { en: 'Total Amount', ta: 'மொத்த தொகை' },
  netAmount: { en: 'Net Amount', ta: 'நிகர் தொகை' },
  total: { en: 'Total', ta: 'மொத்தம்' },

  // Employer side
  employerContributions: { en: 'Employer Contributions', ta: 'முதலாளர் பங்களிப்பு' },
  pfEmployer: { en: 'PF (Employer)', ta: 'வைப்பு நிதி (முதலாளர்)' },
  esiEmployer: { en: 'ESI (Employer)', ta: 'காப்பீடு (முதலாளர்)' },
  costToCompany: { en: 'Cost to Company', ta: 'நிறுவனச் செலவு' },

  // Signatures
  employeeSignature: { en: 'Signature of Employee', ta: 'ஊழியரின் கையொப்பம்' },
  managerSignature: { en: 'Signature of Manager', ta: 'மேலாளரின் கையொப்பம்' },
};

export default L;
