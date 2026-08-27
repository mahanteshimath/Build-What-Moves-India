import { ArrowUpRight, CircleAlert, TriangleAlert } from 'lucide-react'
import { portalIssues } from '../data/portalIssues'
import { checks } from '../rules/checks'

export default function IssuesPage() {
  return (
    <>
      <section className="panel" aria-labelledby="issues-intro-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="issues-intro-heading">
              <CircleAlert aria-hidden size={18} /> What taxpayers run into on the e-Filing
              portal
            </h2>
            <p className="panel__note">
              {portalIssues.length} categories of friction documented in the local research
              report, each one a place where two records disagree and the taxpayer holds the
              contradicting copy. Every category below names the checks in this application
              that report the difference, and the official page that covers the topic.
            </p>
          </div>
        </div>

        <p className="callout callout--warn">
          <TriangleAlert aria-hidden size={17} />
          <span>
            These are <strong>research signals, not official statements</strong>. They record
            what taxpayers reported encountering. They do not describe how the portal works
            internally, and they state no tax or legal outcome. The scale figures the report
            cites &mdash; 14.28 crore registered accounts, 8 to 9 crore active filers, and
            1.25 crore verified returns in the processing queue &mdash; carry the same caveat.
          </span>
        </p>
      </section>

      <section className="panel" aria-labelledby="issues-catalogue-heading">
        <div className="panel__header-row">
          <div>
            <h2 className="panel__heading" id="issues-catalogue-heading">
              Documented issues
            </h2>
            <p className="panel__note">
              All {checks.length} deterministic checks are accounted for across these
              categories.
            </p>
          </div>
        </div>

        <div className="views-catalog-grid">
          {portalIssues.map((issue) => (
            <article key={issue.id} className="view-card">
              <div className="view-card__header">
                <div className="view-card__badges">
                  <span className="view-card__category">{issue.category}</span>
                </div>
                <h3 className="view-card__title">{issue.title}</h3>
                <p className="view-card__desc">{issue.summary}</p>

                <ul className="issue-card__observations">
                  {issue.observations.map((observation) => (
                    <li key={observation}>{observation}</li>
                  ))}
                </ul>

                <div className="issue-card__chips">
                  <span>Reported by:</span>
                  {issue.coveredBy.map((name) => (
                    <code key={name}>{name}</code>
                  ))}
                </div>
              </div>

              <div className="issue-card__links">
                {issue.sources.map((source) => (
                  <a
                    key={source.url}
                    className="finding__source"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{source.label}</span>
                    <ArrowUpRight aria-hidden size={13} />
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
