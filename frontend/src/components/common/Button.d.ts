import { ButtonHTMLAttributes, ReactNode } from 'react';
import { LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface BaseButtonProps {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
  className?: string;
}

interface ButtonAsButton extends BaseButtonProps, ButtonHTMLAttributes<HTMLButtonElement> {
  as?: 'button';
}

interface ButtonAsLink extends BaseButtonProps, LinkProps {
  as: 'link';
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

export default function Button(props: ButtonProps): JSX.Element;
