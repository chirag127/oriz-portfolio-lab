import type { BottomBarAction } from '@chirag127/astro-chrome/BottomBar.astro'

export const bottomBarActions: BottomBarAction[] = [
  { icon: '▚', label: 'Home', href: '/' },
  { icon: '◔', label: 'Profile', href: '/questionnaire/' },
  { icon: '◈', label: 'Studio', href: '/portfolio/' },
  { icon: 'ƒ', label: 'Method', href: '/methodology/' },
  { icon: '≡', label: 'Menu', href: '#sb-toggle' },
]
