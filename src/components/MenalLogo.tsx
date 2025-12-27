interface MenalLogoProps {
  style?: React.CSSProperties;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export function MenalLogo({ style, className, onError }: MenalLogoProps) {
  return (
    <img
      src="https://hnmcacgtgnofatbjxtox.supabase.co/storage/v1/object/public/Menal/menal%20kids.png"
      alt="Menal Kids Logo"
      className={className}
      style={{
        display: 'block',
        margin: '0 auto',
        ...style
      }}
      onError={onError}
    />
  );
}