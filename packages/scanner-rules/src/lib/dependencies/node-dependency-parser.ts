import type {
  NormalizedDependency,
} from '@securecode-platform/scanner-core';

interface PackageJson {
  dependencies?: Record<
    string,
    string
  >;

  devDependencies?: Record<
    string,
    string
  >;
}

interface PackageLockPackage {
  name?: string;

  version?: string;

  dev?: boolean;
}

interface PackageLock {
  lockfileVersion?: number;

  packages?: Record<
    string,
    PackageLockPackage
  >;

  dependencies?: Record<
    string,
    {
      version?: string;

      dev?: boolean;

      dependencies?: Record<
        string,
        unknown
      >;
    }
  >;
}

export class NodeDependencyParser {
  parsePackageLock(
    content: string,
    manifestPath: string,
  ): NormalizedDependency[] {
    let data:
      PackageLock;

    try {
      data =
        JSON.parse(
          content,
        ) as PackageLock;
    } catch {
      throw new Error(
        `package-lock.json invalide : ${manifestPath}`,
      );
    }

    /*
     * package-lock v2 / v3.
     */
    if (
      data.packages &&
      typeof data.packages ===
        'object'
    ) {
      return this.parsePackagesMap(
        data.packages,
        manifestPath,
      );
    }

    /*
     * Ancien package-lock v1.
     */
    if (
      data.dependencies &&
      typeof data.dependencies ===
        'object'
    ) {
      return Object.entries(
        data.dependencies,
      )
        .filter(
          (
            [, value],
          ) =>
            Boolean(
              value.version,
            ),
        )
        .map(
          (
            [
              name,
              value,
            ],
          ) => ({
            name,

            version:
              value.version as string,

            ecosystem:
              'NPM' as const,

            manifestPath,

            direct:
              true,

            development:
              value.dev ??
              false,
          }),
        );
    }

    return [];
  }

  parsePackageJson(
    content: string,
    manifestPath: string,
  ): NormalizedDependency[] {
    let data:
      PackageJson;

    try {
      data =
        JSON.parse(
          content,
        ) as PackageJson;
    } catch {
      throw new Error(
        `package.json invalide : ${manifestPath}`,
      );
    }

    const dependencies:
      NormalizedDependency[] = [];

    this.appendPackageJsonSection(
      dependencies,
      data.dependencies,
      manifestPath,
      false,
    );

    this.appendPackageJsonSection(
      dependencies,
      data.devDependencies,
      manifestPath,
      true,
    );

    return dependencies;
  }

  private parsePackagesMap(
    packages:
      Record<
        string,
        PackageLockPackage
      >,

    manifestPath:
      string,
  ): NormalizedDependency[] {
    const dependencies:
      NormalizedDependency[] = [];

    for (
      const [
        packagePath,
        pkg,
      ] of Object.entries(
        packages,
      )
    ) {
      /*
       * "" représente le projet racine.
       */
      if (
        packagePath ===
        ''
      ) {
        continue;
      }

      if (
        !pkg.version
      ) {
        continue;
      }

      const name =
        pkg.name ??
        this.extractPackageName(
          packagePath,
        );

      if (!name) {
        continue;
      }

      dependencies.push({
        name,

        version:
          pkg.version,

        ecosystem:
          'NPM',

        manifestPath,

        /*
         * node_modules/a
         * = direct
         *
         * node_modules/a/node_modules/b
         * = transitif
         */
        direct:
          this.isDirectPackage(
            packagePath,
          ),

        development:
          pkg.dev ??
          false,
      });
    }

    return this.unique(
      dependencies,
    );
  }

  private appendPackageJsonSection(
    output:
      NormalizedDependency[],

    dependencies:
      Record<
        string,
        string
      > |
      undefined,

    manifestPath:
      string,

    development:
      boolean,
  ): void {
    if (!dependencies) {
      return;
    }

    for (
      const [
        name,
        rawVersion,
      ] of Object.entries(
        dependencies,
      )
    ) {
      const version =
        this.extractExactVersion(
          rawVersion,
        );

      /*
       * package.json contient souvent :
       *
       * ^1.2.3
       * ~1.2.3
       * workspace:*
       * github:...
       *
       * OSV doit idéalement recevoir une
       * version réellement résolue.
       */
      if (!version) {
        continue;
      }

      output.push({
        name,

        version,

        ecosystem:
          'NPM',

        manifestPath,

        direct:
          true,

        development,
      });
    }
  }

  private extractExactVersion(
    value: string,
  ): string | null {
    const normalized =
      value.trim();

    /*
     * Une version exacte uniquement.
     */
    if (
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(
        normalized,
      )
    ) {
      return normalized;
    }

    return null;
  }

  private extractPackageName(
    packagePath:
      string,
  ): string | null {
    const marker =
      'node_modules/';

    const index =
      packagePath.lastIndexOf(
        marker,
      );

    if (
      index <
      0
    ) {
      return null;
    }

    return packagePath
      .slice(
        index +
          marker.length,
      )
      .trim() ||
      null;
  }

  private isDirectPackage(
    packagePath:
      string,
  ): boolean {
    const normalized =
      packagePath
        .replace(/\\/g, '/')
    const occurrences =
      normalized
        .split(
          'node_modules/',
        )
        .length -
      1;

    return (
      occurrences ===
      1
    );
  }

  private unique(
    dependencies:
      NormalizedDependency[],
  ): NormalizedDependency[] {
    const map =
      new Map<
        string,
        NormalizedDependency
      >();

    for (
      const dependency of
        dependencies
    ) {
      const key =
        [
          dependency.ecosystem,
          dependency.name,
          dependency.version,
        ].join(
          ':',
        );

      if (
        !map.has(key)
      ) {
        map.set(
          key,
          dependency,
        );
      }
    }

    return [
      ...map.values(),
    ];
  }
}
