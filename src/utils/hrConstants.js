export const HOLIDAY_TYPES = [
  { value: 'NATIONAL', label: 'National Holiday', color: 'red' },
  { value: 'FESTIVAL', label: 'Festival Holiday', color: 'orange' },
  { value: 'RESTRICTED', label: 'Restricted Holiday', color: 'blue' },
];

export const EMPLOYEE_CATEGORY = [
  { value: 'WORKER', label: 'Worker' },
  { value: 'STAFF', label: 'Staff' },
];

export const LEAVE_ACCRUAL_TYPES = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'AS_NEEDED', label: 'As Needed' },
];

export const INDIAN_STATES = [
  { value: 'AN', label: 'Andaman and Nicobar Islands' },
  { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' },
  { value: 'BR', label: 'Bihar' },
  { value: 'CH', label: 'Chandigarh' },
  { value: 'CG', label: 'Chhattisgarh' },
  { value: 'DD', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { value: 'DL', label: 'Delhi' },
  { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' },
  { value: 'JK', label: 'Jammu and Kashmir' },
  { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'KL', label: 'Kerala' },
  { value: 'LA', label: 'Ladakh' },
  { value: 'LD', label: 'Lakshadweep' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' },
  { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' },
  { value: 'OD', label: 'Odisha' },
  { value: 'PY', label: 'Puducherry' },
  { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TS', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' },
  { value: 'WB', label: 'West Bengal' },
];

export const HR_STATUS_COLORS = {
  active: 'green',
  inactive: 'default',
};

// ── Employee Constants ──

export const EMPLOYEE_STATUS = [
  { value: 'ACTIVE', label: 'Active', color: 'success' },
  { value: 'INACTIVE', label: 'Inactive', color: 'default' },
  { value: 'TERMINATED', label: 'Terminated', color: 'error' },
  { value: 'ABSCONDED', label: 'Absconded', color: 'warning' },
  { value: 'RETIRED', label: 'Retired', color: 'processing' },
];

export const EMPLOYEE_TYPE = [
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'TEMPORARY', label: 'Temporary' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'TRAINEE', label: 'Trainee' },
];

export const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'TRANSGENDER', label: 'Transgender' },
];

export const MARITAL_STATUS = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'MARRIED', label: 'Married' },
  { value: 'WIDOWED', label: 'Widowed' },
  { value: 'DIVORCED', label: 'Divorced' },
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const PAYMENT_MODES = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
];

export const DOCUMENT_TYPES = [
  { value: 'AADHAR', label: 'Aadhar Card' },
  { value: 'PAN', label: 'PAN Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'BANK_PASSBOOK', label: 'Bank Passbook' },
  { value: 'EDUCATIONAL', label: 'Educational Certificate' },
  { value: 'EXPERIENCE', label: 'Experience Certificate' },
  { value: 'MEDICAL', label: 'Medical Certificate' },
  { value: 'OTHER', label: 'Other' },
];

export const RELATIONSHIP_TYPES = ['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'];

export const EMPLOYEE_GRADE = ['A_PLUS', 'A', 'B_PLUS', 'B', 'C'];

// ── Attendance & Leave Constants ──

export const ATTENDANCE_STATUS = [
  { value: 'PRESENT', label: 'Present', color: '#52c41a', tag: 'success' },
  { value: 'ABSENT', label: 'Absent', color: '#ff4d4f', tag: 'error' },
  { value: 'HALF_DAY', label: 'Half Day', color: '#faad14', tag: 'warning' },
  { value: 'WEEKLY_OFF', label: 'Weekly Off', color: '#d9d9d9', tag: 'default' },
  { value: 'NATIONAL_HOLIDAY', label: 'Holiday', color: '#722ed1', tag: 'purple' },
  { value: 'LEAVE', label: 'Leave', color: '#1677ff', tag: 'processing' },
  { value: 'ON_DUTY', label: 'On Duty', color: '#13c2c2', tag: 'cyan' },
];

export const LEAVE_STATUS = [
  { value: 'PENDING', label: 'Pending', color: 'processing' },
  { value: 'APPROVED', label: 'Approved', color: 'success' },
  { value: 'REJECTED', label: 'Rejected', color: 'error' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'default' },
];

export const PUNCH_TYPE = [
  { value: 'IN', label: 'In' },
  { value: 'OUT', label: 'Out' },
];

export const GATE_PASS_TYPE = [
  { value: 'ON_DUTY', label: 'On Duty' },
  { value: 'GATE_PASS', label: 'Gate Pass' },
];

export const HALF_DAY_TYPE = [
  { value: 'FIRST_HALF', label: 'First Half' },
  { value: 'SECOND_HALF', label: 'Second Half' },
];

// ── Payroll Constants ──

export const PAYROLL_STATUS = [
  { value: 'DRAFT', label: 'Draft', color: 'default' },
  { value: 'PROCESSED', label: 'Processed', color: 'processing' },
  { value: 'APPROVED', label: 'Approved', color: 'success' },
  { value: 'PAID', label: 'Paid', color: 'green' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'default' },
];

export const LOAN_STATUS = [
  { value: 'ACTIVE', label: 'Active', color: 'processing' },
  { value: 'FULLY_RECOVERED', label: 'Fully Recovered', color: 'success' },
  { value: 'WRITTEN_OFF', label: 'Written Off', color: 'warning' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'default' },
];

export const PF_RATE = 0.12;
export const PF_CEILING = 15000;
export const ESI_EMPLOYEE_RATE = 0.0075;
export const ESI_EMPLOYER_RATE = 0.0325;
export const ESI_CEILING = 21000;

export const ADVANCE_STATUS = [
  { value: 'PENDING', label: 'Pending', color: 'processing' },
  { value: 'RECOVERED', label: 'Recovered', color: 'success' },
  { value: 'WAIVED', label: 'Waived', color: 'warning' },
];

// ── Bonus Constants ──

export const BONUS_STATUS = [
  { value: 'DRAFT', label: 'Draft', color: 'default' },
  { value: 'CALCULATED', label: 'Calculated', color: 'processing' },
  { value: 'APPROVED', label: 'Approved', color: 'success' },
  { value: 'PAID', label: 'Paid', color: 'green' },
];

// ── F&F Constants ──

export const FNF_STATUS = [
  { value: 'DRAFT', label: 'Draft', color: 'default' },
  { value: 'CALCULATED', label: 'Calculated', color: 'processing' },
  { value: 'APPROVED', label: 'Approved', color: 'success' },
  { value: 'SETTLED', label: 'Settled', color: 'green' },
];

export const SEPARATION_REASONS = [
  { value: 'RESIGNATION', label: 'Resignation' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'ABSCONDED', label: 'Absconded' },
  { value: 'CONTRACT_END', label: 'Contract End' },
  { value: 'DEATH', label: 'Death' },
];

// ── Statutory Constants ──

export const PT_RETURN_STATUS = [
  { value: 'DRAFT', label: 'Draft', color: 'default' },
  { value: 'CALCULATED', label: 'Calculated', color: 'processing' },
  { value: 'FILED', label: 'Filed', color: 'success' },
];

export const EL_ENCASHMENT_STATUS = [
  { value: 'DRAFT', label: 'Draft', color: 'default' },
  { value: 'CALCULATED', label: 'Calculated', color: 'processing' },
  { value: 'APPROVED', label: 'Approved', color: 'success' },
  { value: 'PAID', label: 'Paid', color: 'green' },
];

export const GRATUITY_FACTOR_NUM = 15;
export const GRATUITY_FACTOR_DEN = 26;
export const MIN_GRATUITY_YEARS = 5;
