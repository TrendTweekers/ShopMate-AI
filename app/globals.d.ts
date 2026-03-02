declare module "*.css";

declare namespace JSX {
  interface IntrinsicElements {
    "ui-nav-menu": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}

interface Window {
  umami?: {
    track: (eventName: string, eventData?: Record<string, unknown>) => void;
  };
}
