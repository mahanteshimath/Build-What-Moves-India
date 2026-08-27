import type { OfficialSource } from '../domain/tax'

/** Only official URLs verified as reachable belong here. */
export const portalHome: OfficialSource = {
  label: 'Income Tax Department — e-Filing Portal',
  url: 'https://www.incometax.gov.in/iec/foportal/',
}

export const itrFaq: OfficialSource = {
  label: 'Income Tax Department — File ITR-1 (Sahaj) FAQs',
  url: 'https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/ITR1-FAQ',
}

export const aisFaq: OfficialSource = {
  label: 'Income Tax Department — Annual Information Statement (AIS) FAQs',
  url: 'https://www.incometax.gov.in/iec/foportal/ais-faq',
}

export const tdsMismatchHelp: OfficialSource = {
  label: 'Income Tax Department — Tax Credit Mismatch (Form 26AS) Help',
  url: 'https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/tax-credit-mismatch/tax-UM',
}

export const everifyFaq: OfficialSource = {
  label: 'Income Tax Department — e-Verification 30-Day Timeline & Condonation',
  url: 'https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/itr-v-faqs30-days-timeline-e-verification-returns-faq',
}

export const staticPasswordHelp: OfficialSource = {
  label: 'Income Tax Department — Static Password Generation (Low Network / OTP Delay)',
  url: 'https://www.incometax.gov.in/iec/foportal/help/how-to-generate-e-filing-static-password',
}

export const linkAadhaarHelp: OfficialSource = {
  label: 'Income Tax Department — Link Aadhaar with PAN (Section 234H Guidelines)',
  url: 'https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/link-aadhaar',
}

export const officialSources: OfficialSource[] = [
  portalHome,
  itrFaq,
  aisFaq,
  tdsMismatchHelp,
  everifyFaq,
  staticPasswordHelp,
  linkAadhaarHelp,
]

