import { TutorAvatar } from '../lib/avatars';

const SIZE_MAP = {
  xs:  { box: 24,  font: 10, border: 1.5 },
  sm:  { box: 28,  font: 12, border: 1.5 },
  md:  { box: 40,  font: 16, border: 2 },
  lg:  { box: 56,  font: 22, border: 2 },
  xl:  { box: 80,  font: 30, border: 2.5 },
};

interface Props {
  avatar: TutorAvatar;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}

export default function AvatarCircle({ avatar, size = 'md', className = '' }: Props) {
  const { box, font, border } = SIZE_MAP[size];
  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 font-semibold select-none ${className}`}
      style={{
        width: box,
        height: box,
        minWidth: box,
        fontSize: font,
        backgroundColor: avatar.bgColor,
        color: avatar.textColor,
        border: `${border}px solid ${avatar.borderColor}`,
        fontFamily: "'GFS Didot', 'Palatino Linotype', Georgia, serif",
      }}
      title={`${avatar.name} · ${avatar.era}`}
    >
      {avatar.symbol}
    </div>
  );
}
