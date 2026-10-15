import { useTheme } from '../theme/context'
import { PALETTES } from '../theme/palettes'

// Three colored dots in the header. Click one to recolor the app; the choice is remembered.
export default function ThemeSwitcher() {
  const { key, choose } = useTheme()
  return (
    <div role="radiogroup" aria-label="Color theme" className="flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1.5 ring-1 ring-white/10">
      {Object.entries(PALETTES).map(([paletteKey, p]) => {
        const active = paletteKey === key
        return (
          <button
            key={paletteKey}
            role="radio"
            aria-checked={active}
            aria-label={p.name}
            title={p.name}
            onClick={() => choose(paletteKey)}
            className={`h-5 w-5 rounded-full transition duration-200 hover:scale-125 active:scale-90 ${
              active ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-base' : 'opacity-70 hover:opacity-100'
            }`}
            style={{ background: `linear-gradient(135deg, ${p.accent1}, ${p.accent2})` }}
          />
        )
      })}
    </div>
  )
}
