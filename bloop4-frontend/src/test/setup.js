import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Sense `globals: true`, Testing Library no desmunta els components entre tests.
afterEach(cleanup);
