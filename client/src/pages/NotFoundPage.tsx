import { Link } from 'react-router-dom';
import { CakeSlice } from 'lucide-react';
import { buttonStyles } from '../components/ui/button-styles';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 pt-20 text-center">
      <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-peach-50 text-plum">
        <CakeSlice className="size-9" aria-hidden />
      </span>
      <h1 className="mt-5 font-display text-4xl font-semibold text-plum">This page crumbled</h1>
      <p className="mt-2 text-cocoa-soft">We couldn’t find what you were looking for. The menu is still fresh, though.</p>
      <Link to="/menu" className={buttonStyles({ className: 'mt-6' })}>
        Browse the menu
      </Link>
    </div>
  );
}
