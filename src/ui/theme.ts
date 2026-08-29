export const themeStorageKey = 'babyboel-theme'
export const themes = ['light', 'dark'] as const
export type Theme = (typeof themes)[number]

export function isTheme(value: unknown): value is Theme {
  return themes.some((theme) => theme === value)
}

export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  themeStorageKey,
)});if(${JSON.stringify(themes)}.includes(t)){document.documentElement.dataset.theme=t}}catch(e){}})()`
