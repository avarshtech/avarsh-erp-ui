/** A few things to ask on each master, shown when Laya AI's chat is empty. */
const STARTERS = {
  branch: ['What is the head office branch used for?', 'Add a branch for our Tiruppur unit'],
  buyer: ['Add a buyer for me', 'Does Zara exist already?', 'How do I add a shipping location?'],
  supplier: ['Which suppliers supply trims?', 'Add a fabric supplier from Tiruppur', 'What must a supplier have?'],
  vendor: ['Which vendors do panel printing?', 'Add a job worker for garment washing', 'Whose job-work approval has expired?'],
  category: ['How are items classified?', 'Which categories does costing use?'],
  subcategory: ['Add a sub-category under Fabric', 'What is a sub-category for?'],
  type: ['Why does an item type need attributes?', 'Add an item type for rib fabric'],
  variant: ['What is an attribute for?', 'Add a Colour attribute with choices'],
  uom: ['Which units exist?', 'Add a unit for cones'],
  item: ['How do I add a new fabric?', 'Does 180 GSM single jersey exist?', 'Why can there be only one item per type?'],
  style: ['Add a style for a buyer', 'Why does a style need a buyer?'],
  'size-presets': ['Add a size preset S to XXL', 'Where are size presets used?'],
  'payment-terms': ['Add 30 days credit terms', 'What does advance % mean?'],
  terms: ['Where do terms & conditions appear?', 'Add a new terms template'],
  overhead: ['Add an overhead for testing charges', 'Where are overheads used?'],
  couriers: ['Add a courier', 'What does hand delivery mean?'],
  process: ['What do the process categories mean?', 'Add a garment wash process'],
  parts: ['What is panels per garment?', 'Add a part for a collar'],
  'defect-type': ['Add a defect type', 'Where are defect types used?'],
  'trims-qc-criteria': ['Add a trims QC criterion', 'Where are these criteria used?'],
  'bp-debit-type': ['What does quantity based mean?', 'Add a debit type'],
  'bp-charge-type': ['Add a freight charge type', 'What is default taxable?'],
  'bp-issue-type': ['What does blocking mean?', 'Add an issue type'],
  'bp-tolerance': ['Explain each tolerance', 'Set the quantity tolerance to 2%'],
};

const GENERAL = ['How does this screen work?', 'Search this list for me'];

export const mastersStarters = (key) => STARTERS[key] || GENERAL;
