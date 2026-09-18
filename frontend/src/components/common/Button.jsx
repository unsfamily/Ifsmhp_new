import { Link } from 'react-router-dom';

const variantClasses = {
  primary:
    'bg-forum-600 text-white hover:bg-forum-700 focus-visible:ring-forum-600 shadow-sm',
  secondary:
    'bg-brass-500 text-white hover:bg-brass-600 focus-visible:ring-brass-500 shadow-sm',
  outline:
    'border border-forum-600 text-forum-700 hover:bg-forum-50 focus-visible:ring-forum-600 bg-transparent',
  ghost:
    'text-forum-700 hover:bg-forum-50 focus-visible:ring-forum-600 bg-transparent',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base sm:px-7',
};

export default function Button(props) {
  const { variant = 'primary', size = 'md', className = '', children, ...rest } = props;

  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-50 disabled:cursor-not-allowed';

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  if ('as' in props && props.as === 'link') {
    const { as: _as, ...linkRest } = rest;
    return (
      <Link className={classes} {...linkRest}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
