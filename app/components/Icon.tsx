type IconName = "search" | "heart" | "bag" | "truck" | "lock" | "diamond" | "headset" | "arrow" | "close" | "menu" | "user" | "card" | "chevron-down" | "chevron-left" | "chevron-right" | "plus" | "reset" | "more" | "calendar" | "arrow-left" | "warning";
export default function Icon({ name, ...props }: { name: IconName } & React.SVGProps<SVGSVGElement>) {
  const paths: Record<IconName, React.ReactNode> = {
    warning: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    "chevron-left": <path d="m15 6-6 6 6 6" />,
    "chevron-right": <path d="m9 6 6 6-6 6" />,
    "arrow-left": <path d="M20 12H4m6-6-6 6 6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>,
    more: <><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6M17 2v6M3 11h18M7 15h2M12 15h2M7 18h2M12 18h2" /></>,
    user: <><circle cx="12" cy="7" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3H4Z" /></>,
    card: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 9h20M6 15h4" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    heart: <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" />,
    bag: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
    truck: <><path d="M2 4h12v13H2zM14 9h4l4 5v3h-8" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
    diamond: <><path d="m3 4-2 5 11 13L23 9l-3-5H3ZM1 9h22M8 4 6 9l6 13 6-13-3-5" /></>,
    headset: <><path d="M3 14v-3a9 9 0 0 1 18 0v3M21 18v1a3 3 0 0 1-3 3h-5" /><rect x="1" y="11" width="5" height="8" rx="2" /><rect x="18" y="11" width="5" height="8" rx="2" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}


