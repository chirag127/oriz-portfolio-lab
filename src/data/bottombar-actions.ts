import type { BottomBarAction } from '@chirag127/astro-chrome/BottomBar.astro'

export const bottomBarActions: BottomBarAction[] = [
  { icon: '⌂', label: 'Home', href: '/' },
  { icon: '❓', label: 'Questionnaire', href: '/questionnaire/' },
  { icon: '◎', label: 'Portfolio', href: '/portfolio/' },
  { icon: '∑', label: 'Methodology', href: '/methodology/' },
  { icon: '☰', label: 'Menu', href: '#sb-toggle' },
]
