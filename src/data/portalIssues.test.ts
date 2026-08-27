import { describe, expect, it } from 'vitest'
import { checks } from '../rules/checks'
import { portalIssues } from './portalIssues'
import { officialSources } from './sources'

const checkNames = new Set(checks.map((check) => check.name))

describe('portal issues', () => {
  it('reads real check names off the rules module', () => {
    expect(checkNames.has('challanCredit')).toBe(true)
    expect(checkNames.size).toBe(checks.length)
  })

  it('gives every issue a unique id and non-empty copy', () => {
    const ids = portalIssues.map((issue) => issue.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const issue of portalIssues) {
      expect(issue.category.length).toBeGreaterThan(0)
      expect(issue.title.length).toBeGreaterThan(0)
      expect(issue.summary.length).toBeGreaterThan(0)
      expect(issue.observations.length).toBeGreaterThan(0)
    }
  })

  it('cites only checks that exist', () => {
    for (const issue of portalIssues) {
      expect(issue.coveredBy.length).toBeGreaterThan(0)
      for (const name of issue.coveredBy) {
        expect(checkNames).toContain(name)
      }
    }
  })

  it('accounts for every check', () => {
    const cited = new Set(portalIssues.flatMap((issue) => issue.coveredBy))
    expect([...checkNames].filter((name) => !cited.has(name))).toEqual([])
  })

  it('links only official sources held in sources.ts', () => {
    for (const issue of portalIssues) {
      expect(issue.sources.length).toBeGreaterThan(0)
      for (const source of issue.sources) {
        expect(officialSources).toContain(source)
      }
    }
  })
})
