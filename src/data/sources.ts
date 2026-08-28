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

/* Portal services a person is sent to act on. Each verified reachable. */

export const complyToNotice: OfficialSource = {
  label: 'e-Filing portal — Comply to Notice',
  url: 'https://eportal.incometax.gov.in/iec/foservices/#/pre-login/comply_to_notice',
}

export const authenticateNotice: OfficialSource = {
  label: 'e-Filing portal — Authenticate a notice or order issued by the Department',
  url: 'https://eportal.incometax.gov.in/iec/foservices/#/pre-login/authenticate-notice-issued-by-itd',
}

export const knowPaymentStatus: OfficialSource = {
  label: 'e-Filing portal — Know Tax Payment Status',
  url: 'https://eportal.incometax.gov.in/iec/foservices/#/know-payment-status/payment-information',
}

export const linkAadhaarService: OfficialSource = {
  label: 'e-Filing portal — Link Aadhaar and view status',
  url: 'https://eportal.incometax.gov.in/iec/foservices/#/pre-login/bl-link-aadhaar-landing',
}

export const everifyService: OfficialSource = {
  label: 'e-Filing portal — e-Verify Return',
  url: 'https://eportal.incometax.gov.in/iec/foservices/#/pre-login/eVerifyReturn-bl',
}

export const ePayTaxService: OfficialSource = {
  label: 'e-Filing portal — e-Pay Tax',
  url: 'https://eportal.incometax.gov.in/iec/foservices/#/e-pay-tax-prelogin/user-details',
}

export const grievanceService: OfficialSource = {
  label: 'e-Filing portal — Register a grievance (e-Nivaran)',
  url: 'https://eportal.incometax.gov.in/iec/foservices/#/dashboard/register-grievance',
}

export const tracesPortal: OfficialSource = {
  label: 'TRACES — TDS Reconciliation Analysis and Correction Enabling System',
  url: 'https://www.tdscpc.gov.in/',
}

export const contactUs: OfficialSource = {
  label: 'Income Tax Department — Contact and helpline numbers',
  url: 'https://www.incometax.gov.in/iec/foportal/contact-us',
}

export const officialSources: OfficialSource[] = [
  portalHome,
  itrFaq,
  aisFaq,
  tdsMismatchHelp,
  everifyFaq,
  staticPasswordHelp,
  linkAadhaarHelp,
  complyToNotice,
  authenticateNotice,
  knowPaymentStatus,
  linkAadhaarService,
  everifyService,
  ePayTaxService,
  grievanceService,
  tracesPortal,
  contactUs,
]

