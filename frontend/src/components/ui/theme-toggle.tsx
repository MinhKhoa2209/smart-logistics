import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className={cn(
        'relative h-9 w-9 rounded-lg flex items-center justify-center transition-colors',
        'hover:bg-accent text-muted-foreground hover:text-foreground',
        className
      )}
    >
      <Sun className={cn('h-4 w-4 transition-all duration-300', theme === 'dark' ? 'scale-0 opacity-0 absolute' : 'scale-100 opacity-100')} />
      <Moon className={cn('h-4 w-4 transition-all duration-300', theme === 'light' ? 'scale-0 opacity-0 absolute' : 'scale-100 opacity-100')} />
    </button>
  );
}
