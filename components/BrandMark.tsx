import { useTheme } from '@rootnative/core'
import Svg, { Circle, Mask, Path, Rect } from 'react-native-svg'

/**
 * The Reelist mark: a film reel with a play button as its hub. This is the
 * flat one-color version — the 3D icon artwork (assets/logo/) does not stay
 * legible below ~40 px. Defaults to the theme primary so it tracks the scheme.
 * SVG source of truth: assets/logo/play-reel.svg.
 */
export function BrandMark({ size = 26, color }: { size?: number; color?: string }) {
  const theme = useTheme()

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Mask id="reel-holes">
        <Rect x={-10} y={-10} width={120} height={120} fill="#fff" />
        <Circle cx={50} cy={18.5} r={6.5} fill="#000" />
        <Circle cx={77.3} cy={34.2} r={6.5} fill="#000" />
        <Circle cx={77.3} cy={65.8} r={6.5} fill="#000" />
        <Circle cx={50} cy={81.5} r={6.5} fill="#000" />
        <Circle cx={22.7} cy={65.8} r={6.5} fill="#000" />
        <Circle cx={22.7} cy={34.2} r={6.5} fill="#000" />
        <Path
          d="M44.5 37.5 L66.5 50 L44.5 62.5 Z"
          fill="#000"
          stroke="#000"
          strokeWidth={7}
          strokeLinejoin="round"
        />
      </Mask>
      <Circle
        cx={50}
        cy={50}
        r={45}
        fill={color ?? theme.colors.primary}
        mask="url(#reel-holes)"
      />
    </Svg>
  )
}
