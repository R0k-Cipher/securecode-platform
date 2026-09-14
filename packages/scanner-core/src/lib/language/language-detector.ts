import type {
  LanguageDetection,
  SupportedLanguage,
} from '../contracts/language';

const EXTENSION_LANGUAGE_MAP =
  new Map<
    string,
    SupportedLanguage
  >([
    ['.js', 'JAVASCRIPT'],
    ['.jsx', 'JAVASCRIPT'],
    ['.mjs', 'JAVASCRIPT'],
    ['.cjs', 'JAVASCRIPT'],

    ['.ts', 'TYPESCRIPT'],
    ['.tsx', 'TYPESCRIPT'],
    ['.mts', 'TYPESCRIPT'],
    ['.cts', 'TYPESCRIPT'],

    ['.py', 'PYTHON'],

    ['.php', 'PHP'],

    ['.java', 'JAVA'],

    ['.go', 'GO'],

    ['.cs', 'CSHARP'],

    ['.rb', 'RUBY'],

    ['.rs', 'RUST'],

    ['.sql', 'SQL'],
  ]);

export class LanguageDetector {
  detect(
    filePath: string,
  ): LanguageDetection {
    const normalized =
      filePath
        .replace(/\\/g, '/')
        .toLowerCase();

    const fileName =
      normalized
        .split('/')
        .at(-1) ??
      normalized;

    const dotIndex =
      fileName.lastIndexOf('.');

    if (dotIndex < 0) {
      return {
        language:
          'UNKNOWN',

        confidence:
          0,
      };
    }

    const extension =
      fileName.slice(
        dotIndex,
      );

    const language =
      EXTENSION_LANGUAGE_MAP.get(
        extension,
      );

    if (!language) {
      return {
        language:
          'UNKNOWN',

        confidence:
          0,
      };
    }

    return {
      language,

      confidence:
        1,
    };
  }
}
