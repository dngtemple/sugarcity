import { cva } from 'class-variance-authority';

export const buttonStyles = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        plum: 'bg-plum text-cream shadow-soft hover:bg-plum-700',
        cherry: 'bg-cherry text-white shadow-soft hover:bg-cherry-700',
        outline: 'border-2 border-plum/15 bg-card text-plum hover:border-plum/35 hover:bg-plum-50',
        soft: 'bg-plum-50 text-plum hover:bg-plum-100',
        ghost: 'text-plum hover:bg-plum-50',
        whatsapp: 'bg-[#25D366] text-[#0B3D21] shadow-soft hover:brightness-95',
      },
      size: {
        sm: 'h-11 px-4 text-sm',
        md: 'h-12 px-6 text-[15px]',
        lg: 'h-14 px-7 text-base',
        icon: 'size-11',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'plum', size: 'md' },
  }
);
