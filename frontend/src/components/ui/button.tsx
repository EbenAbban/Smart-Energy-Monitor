import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95',
  {
    variants: {
      variant: {
        default: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20',
        destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20',
        outline: 'border border-gray-700 light:border-gray-300 bg-transparent hover:bg-gray-800 text-gray-200 light:text-gray-700 light:hover:bg-gray-100',
        secondary: 'bg-gray-800 light:bg-gray-100 text-gray-200 light:text-gray-700 hover:bg-gray-700 light:hover:bg-gray-200',
        ghost: 'hover:bg-gray-800 light:hover:bg-gray-100 text-gray-300 light:text-gray-600 hover:text-white light:hover:text-gray-900',
        link: 'text-emerald-400 light:text-emerald-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

const MotionButton = motion(Button)

export { Button, buttonVariants, MotionButton }
