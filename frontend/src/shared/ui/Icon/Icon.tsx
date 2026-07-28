import type { SVGProps } from 'react';
import type { IconName } from './iconNames';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName;
  /** Square size in px. Matches the prototype, which sized icons inline. */
  size?: number;
  /** Accessible label. Omit for decorative icons — they are hidden instead. */
  label?: string;
};

export function Icon({ name, size = 20, label, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ flex: 'none', ...props.style }}
      {...props}
    >
      <use href={`#i-${name}`} />
    </svg>
  );
}
