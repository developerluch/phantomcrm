import type { Sale } from '../../../types/portal'

// Normalize for matching: lowercase, strip everything but a–z 0–9.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Static lookup of normalized header tokens to Sale fields. Built once at
// module load so suggestMapping() is a pure dictionary check per header.
const HEADER_TO_FIELD: Record<string, keyof Sale> = {
  // clientName
  clientname: 'clientName',
  name: 'clientName',
  fullname: 'clientName',
  client: 'clientName',
  // insuredName (also wins on the bare token "insured")
  insuredname: 'insuredName',
  insured: 'insuredName',
  // clientDOB
  dob: 'clientDOB',
  clientdob: 'clientDOB',
  dateofbirth: 'clientDOB',
  birthdate: 'clientDOB',
  birthday: 'clientDOB',
  // clientAddress
  address: 'clientAddress',
  clientaddress: 'clientAddress',
  streetaddress: 'clientAddress',
  mailingaddress: 'clientAddress',
  // clientPhone
  phone: 'clientPhone',
  clientphone: 'clientPhone',
  contactphone: 'clientPhone',
  phonenumber: 'clientPhone',
  mobile: 'clientPhone',
  cell: 'clientPhone',
  // clientEmail
  email: 'clientEmail',
  clientemail: 'clientEmail',
  emailaddress: 'clientEmail',
  // carrier
  carrier: 'carrier',
  carriername: 'carrier',
  insurancecarrier: 'carrier',
  insurer: 'carrier',
  company: 'carrier',
  // policyNumber
  policyno: 'policyNumber',
  policynumber: 'policyNumber',
  polnum: 'policyNumber',
  policyid: 'policyNumber',
  policy: 'policyNumber',
  // policyType
  policytype: 'policyType',
  type: 'policyType',
  producttype: 'policyType',
  coveragetype: 'policyType',
  // productName
  productname: 'productName',
  product: 'productName',
  // premium (incl. annualized / AP — collapsed to same field per Wave-3 spec)
  premium: 'premium',
  monthlypremium: 'premium',
  monthly: 'premium',
  mopremium: 'premium',
  mo: 'premium',
  annualpremium: 'premium',
  annualizedpremium: 'premium',
  annualizedap: 'premium',
  ap: 'premium',
  // faceAmount
  face: 'faceAmount',
  faceamount: 'faceAmount',
  coverage: 'faceAmount',
  facevalue: 'faceAmount',
  deathbenefit: 'faceAmount',
  benefit: 'faceAmount',
  // paymentMode
  paymentmode: 'paymentMode',
  mode: 'paymentMode',
  paymentfrequency: 'paymentMode',
  // agentId
  agent: 'agentId',
  agentid: 'agentId',
  writingagent: 'agentId',
  producer: 'agentId',
  producerid: 'agentId',
  // status
  status: 'status',
  // commission
  commission: 'commission',
  // notes
  notes: 'notes',
  comments: 'notes',
  remarks: 'notes',
  // submittedAt
  submitted: 'submittedAt',
  submittedat: 'submittedAt',
  submitdate: 'submittedAt',
  // issuedAt
  issued: 'issuedAt',
  issuedat: 'issuedAt',
  issuedate: 'issuedAt',
  // approvedAt
  approved: 'approvedAt',
  approvedat: 'approvedAt',
  approveddate: 'approvedAt',
  // paidAt
  paid: 'paidAt',
  paidat: 'paidAt',
  paiddate: 'paidAt',
}

export function suggestMapping(csvHeaders: string[]): Record<string, keyof Sale | null> {
  const out: Record<string, keyof Sale | null> = {}
  for (const header of csvHeaders) {
    const key = normalize(header)
    out[header] = HEADER_TO_FIELD[key] ?? null
  }
  return out
}

// Human labels for the column-mapper Select. Excludes internal fields
// (id, createdAt, updatedAt, agent, agentFirstName, agentLastName, contactId)
// because they are server-owned or computed.
export const SALE_FIELD_LABELS: Record<
  Exclude<
    keyof Sale,
    'id' | 'createdAt' | 'updatedAt' | 'agent' | 'agentFirstName' | 'agentLastName' | 'contactId'
  >,
  string
> = {
  agentId: 'Agent ID',
  clientName: 'Client Name',
  policyType: 'Policy Type',
  carrier: 'Carrier',
  premium: 'Premium',
  commission: 'Commission',
  status: 'Status',
  submittedAt: 'Submitted Date',
  approvedAt: 'Approved Date',
  issuedAt: 'Issued Date',
  paidAt: 'Paid Date',
  policyNumber: 'Policy Number',
  notes: 'Notes',
  clientDOB: 'DOB',
  clientAddress: 'Address',
  clientPhone: 'Phone',
  clientEmail: 'Email',
  faceAmount: 'Face Amount',
  paymentMode: 'Payment Mode',
  transcript: 'Transcript',
  productName: 'Product Name',
  insuredName: 'Insured Name',
  postcardSentAt: 'Postcard Sent',
}
