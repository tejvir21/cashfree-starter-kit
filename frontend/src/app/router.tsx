import { createBrowserRouter } from 'react-router-dom';
import { PaymentPage } from '@/pages/payment';
import { NotFoundPage } from '@/pages/not-found';

export const router = createBrowserRouter([
  {
    path: '/',
    children: [
      { index: true, Component: PaymentPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
]);
