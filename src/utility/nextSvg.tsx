import React from "react";
import Svg, { SvgProps, Path } from "react-native-svg";

interface StarIconProps extends SvgProps {
  /** Color to fill the icon */
  fillColor?: string;
}

/**
 * StarIcon renders a 16x16 star SVG icon.
 * Accepts all SvgProps (width, height, style, etc.) and an optional fillColor.
 */
const NextSvg: React.FC<StarIconProps> = ({
  width = 16,
  height = 16,
  fillColor = "#03045E",
  ...svgProps
}) => (
  <Svg width="9" height="13" viewBox="0 0 9 13" fill="none">
    <Path
      d="M8.5 6.47997C8.5 6.85816 8.34029 7.18232 8.07412 7.39843L2.11179 12.7471C1.68591 13.1253 1.04709 13.0713 0.72768 12.639C0.408269 12.2068 0.408269 11.6125 0.83415 11.2343L6.05119 6.58803C6.10442 6.534 6.10442 6.47997 6.05119 6.37192L0.83415 1.7256C0.408269 1.34742 0.408269 0.699093 0.780915 0.320904C1.15356 -0.057284 1.73915 -0.111311 2.16503 0.212851L8.12735 5.50749C8.34029 5.77762 8.5 6.10178 8.5 6.47997Z"
      fill="#FAFAFA"
    />
  </Svg>
);

export default NextSvg;
