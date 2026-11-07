import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function ClassroomToolButton({ children, disabled = false, hint, onClick }: {
  children: ReactNode;
  disabled?: boolean;
  hint: string;
  onClick?: () => void;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current?.getBoundingClientRect();
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!button || !tooltip) return;
      const beside = button.right + 12;
      const left = Math.max(8, Math.min(beside, window.innerWidth - tooltip.width - 8));
      const top = beside + tooltip.width <= window.innerWidth - 8
        ? button.top + (button.height - tooltip.height) / 2
        : button.top - tooltip.height - 12;
      setPosition({ left, top: Math.max(8, Math.min(top, window.innerHeight - tooltip.height - 8)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, hint]);

  return <>
    <button ref={buttonRef} type="button" className="lab-stage-tool" aria-disabled={disabled || undefined}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}
      onClick={() => { if (!disabled) { setOpen(false); onClick?.(); } }}>
      {children}
    </button>
    {open && createPortal(<div ref={tooltipRef} id={id} role="tooltip" className="classroom-tool-tooltip" style={position}>{hint}</div>, document.body)}
  </>;
}
