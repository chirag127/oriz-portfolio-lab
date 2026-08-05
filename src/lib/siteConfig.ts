import type { OrizSiteConfig } from '@chirag127/astro-shell/types'

export const SITE_CONFIG: OrizSiteConfig = {
  slug: 'portfolio-lab',
  name: 'Portfolio Lab',
  origin: 'https://portfolio-lab.oriz.in',
  tagline: 'Plot the efficient frontier, find your max-Sharpe portfolio',
  description:
    'Free browser-only portfolio studio for India. Plot equity, global value, gold, REITs and debt in risk/return space, find the max-Sharpe allocation on the capital-market line, project bear/base/bull and Monte Carlo outcomes, and read the honest downside of every assumption. No sign-up needed; optional account syncs saved portfolios across devices.',
}

/** Site-specific niceties. */
export const SITE_EMOJI = '📈'
