/**
 * Every word on the payslip, in English, Tamil and Hindi.
 *
 * <p>Not an i18n framework. This repo has none, and the payslip is the only
 * multilingual thing in it - the form is printed and handed to a worker on the floor,
 * so all three languages appear together on the same sheet rather than one being
 * chosen. Installing i18next to translate one printed form would be a dependency with
 * a single caller and a second place for these words to drift out of step.</p>
 *
 * <p>Hindi is on the sheet because the floor is not only Tamil-reading: workers from
 * the north read it and nothing else on the form. A wage slip somebody cannot read is
 * a wage slip they cannot check.</p>
 *
 * <p>The Tamil is taken from the Form 25B slip this layout reproduces, not translated
 * afresh: these are the words the floor already reads, and "pay slip Tamil" from a
 * dictionary would be a different document.</p>
 */
export const L = {
  // Document
  payslip: { en: 'PAY SLIP', ta: 'சம்பளச் சீட்டு', hi: 'वेतन पर्ची' },
  formNo: { en: 'FORM : 25B', ta: 'படிவம் : 25B', hi: 'प्रपत्र : 25B' },
  salaryMonth: { en: 'Salary Month', ta: 'சம்பள மாதம்', hi: 'वेतन माह' },

  // Who
  name: { en: 'Name', ta: 'பெயர்', hi: 'नाम' },
  fatherHusbandName: { en: 'F/H Name', ta: 'த/க பெயர்', hi: 'पिता/पति का नाम' },
  dept: { en: 'Dept', ta: 'துறை', hi: 'विभाग' },
  designation: { en: 'Designation', ta: 'பதவி', hi: 'पदनाम' },
  idNo: { en: 'ID No.', ta: 'ஐடி எண்', hi: 'आईडी सं.' },
  pfNo: { en: 'PF No', ta: 'பி.எஃப் எண்', hi: 'पी.एफ. सं.' },
  esiNo: { en: 'ESI No.', ta: 'ஈ.எஸ்.ஐ எண்', hi: 'ई.एस.आई. सं.' },
  joinDate: { en: 'Join Dt', ta: 'சேர்ந்த தேதி', hi: 'कार्यग्रहण तिथि' },
  bankAcNo: { en: 'Bank A/c No.', ta: 'வங்கிக் கணக்கு எண்', hi: 'बैंक खाता सं.' },

  // Days
  earnDays: { en: 'Earn Days', ta: 'சம்பள நாட்கள்', hi: 'वेतन दिवस' },
  lopDays: { en: 'LOP Days', ta: 'இழப்பு நாட்கள்', hi: 'अवैतनिक दिवस' },
  nhDays: { en: 'NH Days', ta: 'அரசு விடுமுறை', hi: 'सरकारी अवकाश' },
  otHours: { en: 'O.T Hours', ta: 'ஓ.டி மணி நேரம்', hi: 'ओ.टी. घंटे' },
  leaveDetails: { en: 'Leave Details', ta: 'விடுமுறை விவரங்கள்', hi: 'अवकाश विवरण' },

  // Table headings
  particulars: { en: 'PARTICULARS', ta: 'விவரங்கள்', hi: 'विवरण' },
  actuals: { en: 'ACTUALS', ta: 'தற்போதைய சம்பளம்', hi: 'वास्तविक वेतन' },
  earnings: { en: 'EARNINGS', ta: 'வருமானம்', hi: 'अर्जित वेतन' },
  deductionDetails: { en: 'DEDUCTIONS DETAILS', ta: 'கழிக்கப்படும் விவரங்கள்', hi: 'कटौती विवरण' },
  amount: { en: 'AMOUNT', ta: 'தொகை', hi: 'राशि' },

  // Earnings lines
  basic: { en: 'Basic Salary', ta: 'அடிப்படை சம்பளம்', hi: 'मूल वेतन' },
  da: { en: 'DA', ta: 'பஞ்சப்படி', hi: 'महंगाई भत्ता' },
  hra: { en: 'HRA', ta: 'வீட்டு வாடகைப்படி', hi: 'मकान किराया भत्ता' },
  conveyance: { en: 'Conveyance', ta: 'பயணப்படி', hi: 'यात्रा भत्ता' },
  otherAllowance: { en: 'Others', ta: 'மற்ற கொடுப்பனவுகள்', hi: 'अन्य भत्ते' },
  arrears: { en: 'Arrears', ta: 'நிலுவை', hi: 'बकाया' },
  incentive: { en: 'Incentive', ta: 'ஊக்கத்தொகை', hi: 'प्रोत्साहन राशि' },
  attdBonus: { en: 'Attd. Bonus', ta: 'அட்டெண்டன்ஸ் போனஸ்', hi: 'उपस्थिति बोनस' },
  ot: { en: 'O T / Hr', ta: 'மிகை நேரம்', hi: 'ओ.टी. / घंटा' },

  // Deduction lines
  esi: { en: 'ESI', ta: 'காப்பீடு', hi: 'ई.एस.आई.' },
  pf: { en: 'PF', ta: 'வைப்பு நிதி', hi: 'भविष्य निधि' },
  profTax: { en: 'Prof Tax', ta: 'தொழில் வரி', hi: 'व्यवसाय कर' },
  lwf: { en: 'LWF', ta: 'தொழிலாளர் நிதி', hi: 'श्रमिक कल्याण निधि' },
  advance: { en: 'Advance', ta: 'முன் பணம்', hi: 'अग्रिम' },
  lateArrival: { en: 'Late Arrival', ta: 'தாமதமாக வருகை', hi: 'विलंब से आगमन' },
  loan: { en: 'Loan', ta: 'கடன்', hi: 'ऋण' },
  otherDeductions: { en: 'Others', ta: 'மற்றவை', hi: 'अन्य' },
  tds: { en: 'TDS', ta: 'வருமான வரி', hi: 'स्रोत कर कटौती' },

  // Totals
  grossSalary: { en: 'Gross Salary', ta: 'மொத்த சம்பளம்', hi: 'सकल वेतन' },
  earnedSalary: { en: 'Earned Salary', ta: 'ஈட்டிய சம்பளம்', hi: 'अर्जित वेतन' },
  deductions: { en: 'Deductions', ta: 'பிடித்தங்கள்', hi: 'कटौती' },
  netSalary: { en: 'Net Salary', ta: 'நிகர் சம்பளம்', hi: 'शुद्ध वेतन' },
  totalAmount: { en: 'Total Amount', ta: 'மொத்த தொகை', hi: 'कुल राशि' },
  netAmount: { en: 'Net Amount', ta: 'நிகர் தொகை', hi: 'शुद्ध राशि' },
  total: { en: 'Total', ta: 'மொத்தம்', hi: 'कुल' },

  // Employer side
  employerContributions: { en: 'Employer Contributions', ta: 'முதலாளர் பங்களிப்பு', hi: 'नियोक्ता अंशदान' },
  pfEmployer: { en: 'PF (Employer)', ta: 'வைப்பு நிதி (முதலாளர்)', hi: 'भविष्य निधि (नियोक्ता)' },
  esiEmployer: { en: 'ESI (Employer)', ta: 'காப்பீடு (முதலாளர்)', hi: 'ई.एस.आई. (नियोक्ता)' },
  costToCompany: { en: 'Cost to Company', ta: 'நிறுவனச் செலவு', hi: 'कंपनी पर कुल व्यय' },

  // Signatures
  employeeSignature: { en: 'Signature of Employee', ta: 'ஊழியரின் கையொப்பம்', hi: 'कर्मचारी के हस्ताक्षर' },
  managerSignature: { en: 'Signature of Manager', ta: 'மேலாளரின் கையொப்பம்', hi: 'प्रबंधक के हस्ताक्षर' },
};

export default L;
