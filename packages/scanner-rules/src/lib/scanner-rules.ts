export * from '../lib/sast/language-sast-scanner';

export * from './sast/python/python-sast-scanner';

export * from './sast/php/php-sast-scanner';

export * from './sast/java/java-sast-scanner';

export function scannerRules(): string {
  return 'scanner-rules';
}
