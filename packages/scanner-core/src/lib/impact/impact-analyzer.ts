import type {
  ChangeSet,
} from '../contracts/change-set';

export interface ImpactAnalysis {
  sourceFiles: string[];

  dependencyFiles: string[];

  configurationFiles: string[];

  containerFiles: string[];

  ciCdFiles: string[];

  deletedFiles: string[];

  requiresProjectContext: boolean;

  reasons: string[];
}

const SOURCE_EXTENSIONS =
  new Set([
    '.js',
    '.jsx',
    '.ts',
    '.tsx',

    '.php',

    '.py',

    '.java',

    '.go',

    '.cs',

    '.rb',

    '.rs',

    '.c',
    '.cc',
    '.cpp',
    '.h',
    '.hpp',

    '.sql',
  ]);

const DEPENDENCY_FILES =
  new Set([
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',

    'composer.json',
    'composer.lock',

    'requirements.txt',
    'poetry.lock',
    'pyproject.toml',

    'pom.xml',
    'build.gradle',
    'build.gradle.kts',

    'go.mod',
    'go.sum',

    'Cargo.toml',
    'Cargo.lock',
  ]);

const PROJECT_CONTEXT_FILES =
  new Set([
    'tsconfig.json',
    'jsconfig.json',

    'webpack.config.js',
    'webpack.config.ts',

    'vite.config.js',
    'vite.config.ts',

    'nest-cli.json',

    'angular.json',
  ]);

export class ImpactAnalyzer {
  analyze(
    changeSet: ChangeSet,
  ): ImpactAnalysis {
    const changedFiles =
      this.unique([
        ...changeSet.added,
        ...changeSet.modified,
        ...changeSet.renamed.map(
          (file) => file.to,
        ),
      ]);

    const sourceFiles: string[] = [];

    const dependencyFiles: string[] = [];

    const configurationFiles: string[] = [];

    const containerFiles: string[] = [];

    const ciCdFiles: string[] = [];

    const reasons: string[] = [];

    let requiresProjectContext =
      false;

    for (
      const file of changedFiles
    ) {
      const normalized =
        this.normalizePath(
          file,
        );

      const fileName =
        this.basename(
          normalized,
        );

      const lowerFileName =
        fileName.toLowerCase();

      const lowerPath =
        normalized.toLowerCase();

      const extension =
        this.extension(
          normalized,
        );

      /*
       * ------------------------------------------------
       * Source code
       * ------------------------------------------------
       */

      if (
        SOURCE_EXTENSIONS.has(
          extension,
        )
      ) {
        sourceFiles.push(
          normalized,
        );
      }

      /*
       * ------------------------------------------------
       * Dependency manifests
       * ------------------------------------------------
       */

      if (
        DEPENDENCY_FILES.has(
          fileName,
        )
      ) {
        dependencyFiles.push(
          normalized,
        );

        reasons.push(
          `Dépendances modifiées : ${normalized}`,
        );
      }

      /*
       * ------------------------------------------------
       * Project context
       * ------------------------------------------------
       */

      if (
        PROJECT_CONTEXT_FILES.has(
          fileName,
        )
      ) {
        configurationFiles.push(
          normalized,
        );

        requiresProjectContext =
          true;

        reasons.push(
          `Configuration projet modifiée : ${normalized}`,
        );
      }

      /*
       * ------------------------------------------------
       * Container / Docker
       * ------------------------------------------------
       */

      if (
        lowerFileName ===
          'dockerfile' ||
        lowerFileName.startsWith(
          'dockerfile.',
        ) ||
        lowerFileName ===
          'docker-compose.yml' ||
        lowerFileName ===
          'docker-compose.yaml' ||
        lowerFileName ===
          'compose.yml' ||
        lowerFileName ===
          'compose.yaml'
      ) {
        containerFiles.push(
          normalized,
        );

        reasons.push(
          `Configuration conteneur modifiée : ${normalized}`,
        );
      }

      /*
       * ------------------------------------------------
       * CI/CD
       * ------------------------------------------------
       */

      if (
        lowerPath.startsWith(
          '.github/workflows/',
        ) ||
        lowerPath ===
          '.gitlab-ci.yml' ||
        lowerPath.endsWith(
          '/.gitlab-ci.yml',
        ) ||
        lowerPath.endsWith(
          'azure-pipelines.yml',
        )
      ) {
        ciCdFiles.push(
          normalized,
        );

        reasons.push(
          `Pipeline CI/CD modifié : ${normalized}`,
        );
      }

      /*
       * ------------------------------------------------
       * Authentication / Authorization impact
       * ------------------------------------------------
       */

      if (
        this.looksLikeAuthFile(
          normalized,
        )
      ) {
        requiresProjectContext =
          true;

        reasons.push(
          `Zone AUTHN/AUTHZ modifiée : ${normalized}`,
        );
      }

      /*
       * ------------------------------------------------
       * Routing / API surface impact
       * ------------------------------------------------
       */

      if (
        this.looksLikeRoutingFile(
          normalized,
        )
      ) {
        requiresProjectContext =
          true;

        reasons.push(
          `Surface API/routing modifiée : ${normalized}`,
        );
      }

      /*
       * ------------------------------------------------
       * Generic configuration
       * ------------------------------------------------
       */

      if (
        this.looksLikeConfigFile(
          normalized,
        )
      ) {
        configurationFiles.push(
          normalized,
        );
      }
    }

    return {
      sourceFiles:
        this.unique(
          sourceFiles,
        ),

      dependencyFiles:
        this.unique(
          dependencyFiles,
        ),

      configurationFiles:
        this.unique(
          configurationFiles,
        ),

      containerFiles:
        this.unique(
          containerFiles,
        ),

      ciCdFiles:
        this.unique(
          ciCdFiles,
        ),

      deletedFiles:
        this.unique(
          changeSet.deleted.map(
            (file) =>
              this.normalizePath(
                file,
              ),
          ),
        ),

      requiresProjectContext,

      reasons:
        this.unique(
          reasons,
        ),
    };
  }

  private looksLikeAuthFile(
    file: string,
  ): boolean {
    const lowered =
      file.toLowerCase();

    return (
      lowered.includes(
        '/auth/',
      ) ||
      lowered.includes(
        'auth.service',
      ) ||
      lowered.includes(
        'auth.controller',
      ) ||
      lowered.includes(
        'authentication',
      ) ||
      lowered.includes(
        'authorization',
      ) ||
      lowered.includes(
        'permission',
      ) ||
      lowered.includes(
        'rbac',
      ) ||
      lowered.includes(
        'guard',
      )
    );
  }

  private looksLikeRoutingFile(
    file: string,
  ): boolean {
    const lowered =
      file.toLowerCase();

    return (
      lowered.includes(
        'route',
      ) ||
      lowered.includes(
        'router',
      ) ||
      lowered.includes(
        'controller',
      )
    );
  }

  private looksLikeConfigFile(
    file: string,
  ): boolean {
    const lowered =
      file.toLowerCase();

    return (
      lowered.endsWith(
        '.yaml',
      ) ||
      lowered.endsWith(
        '.yml',
      ) ||
      lowered.endsWith(
        '.toml',
      ) ||
      lowered.endsWith(
        '.ini',
      ) ||
      lowered.endsWith(
        '.conf',
      ) ||
      lowered.endsWith(
        '.properties',
      ) ||
      lowered.endsWith(
        '.env',
      ) ||
      lowered.includes(
        '.env.',
      )
    );
  }

  private normalizePath(
    file: string,
  ): string {
    return file
      .replace(/\\/g, '/')
      .replace(/^\.\/+/,'');
  }

  private basename(
    file: string,
  ): string {
    const parts =
      file.split('/');

    return (
      parts.at(-1) ??
      file
    );
  }

  private extension(
    file: string,
  ): string {
    const name =
      this.basename(
        file,
      );

    const index =
      name.lastIndexOf(
        '.',
      );

    if (
      index <=
      0
    ) {
      return '';
    }

    return name
      .slice(
        index,
      )
      .toLowerCase();
  }

  private unique<T>(
    values: T[],
  ): T[] {
    return [
      ...new Set(
        values,
      ),
    ];
  }
}
