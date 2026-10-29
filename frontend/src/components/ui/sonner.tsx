'use client';

import * as React from 'react';
import { Toaster as SonnerToaster, toast as sonner } from 'sonner';

export function Toaster() {
  return <SonnerToaster position="bottom-right" richColors />;
}

export { sonner as toast };
