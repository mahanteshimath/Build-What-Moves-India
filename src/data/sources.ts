import type { OfficialSource } from '../domain/tax'

/** Only URLs verified as reachable during research belong here. */
export const portalHome: OfficialSource = {
  label: 'Income Tax Department — e-Filing portal',
  url: 'https://www.incometax.gov.in/iec/foportal/',
}

export const itrFaq: OfficialSource = {
  label: 'Income Tax Department — File ITR-1 (Sahaj) FAQs',
  url: 'https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/ITR1-FAQ',
}

export const officialSources: OfficialSource[] = [portalHome, itrFaq]
