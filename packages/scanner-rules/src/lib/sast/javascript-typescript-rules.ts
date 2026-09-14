import * as ts from 'typescript';

import type {
  SastRule,
} from './sast-rule';

function isIdentifierNamed(
  node: ts.Node,
  name: string,
): boolean {
  return (
    ts.isIdentifier(node) &&
    node.text === name
  );
}

function getPropertyName(
  expression:
    ts.Expression,
): string | null {
  if (
    ts.isPropertyAccessExpression(
      expression,
    )
  ) {
    return expression.name.text;
  }

  if (
    ts.isIdentifier(
      expression,
    )
  ) {
    return expression.text;
  }

  return null;
}

function isDynamicExpression(
  expression:
    ts.Expression,
): boolean {
  if (
    ts.isStringLiteral(
      expression,
    ) ||
    ts.isNoSubstitutionTemplateLiteral(
      expression,
    )
  ) {
    return false;
  }

  if (
    ts.isTemplateExpression(
      expression,
    )
  ) {
    return true;
  }

  if (
    ts.isBinaryExpression(
      expression,
    ) &&
    expression.operatorToken.kind ===
      ts.SyntaxKind.PlusToken
  ) {
    return true;
  }

  return (
    ts.isIdentifier(
      expression,
    ) ||
    ts.isCallExpression(
      expression,
    ) ||
    ts.isPropertyAccessExpression(
      expression,
    )
  );
}

function getStringLiteralValue(
  expression:
    ts.Expression | undefined,
): string | null {
  if (!expression) {
    return null;
  }

  if (
    ts.isStringLiteral(
      expression,
    ) ||
    ts.isNoSubstitutionTemplateLiteral(
      expression,
    )
  ) {
    return expression.text;
  }

  return null;
}

export const JAVASCRIPT_TYPESCRIPT_SAST_RULES:
  SastRule[] = [
  /*
   * --------------------------------------------------
   * eval()
   * --------------------------------------------------
   */
  {
    id:
      'SAST-JS-001',

    title:
      'Utilisation de eval()',

    description:
      'eval() permet l’exécution dynamique de code JavaScript et peut conduire à une injection de code.',

    severity:
      'HIGH',

    category:
      'CODE_INJECTION',

    cweId:
      'CWE-95',

    owaspCategory:
      'A03:2021-Injection',

    recommendation:
      'Supprimer eval() et utiliser une logique explicite ne nécessitant pas l’interprétation dynamique de code.',

    confidence:
      0.98,

    match(
      node,
    ) {
      if (
        !ts.isCallExpression(
          node,
        )
      ) {
        return null;
      }

      if (
        !isIdentifierNamed(
          node.expression,
          'eval',
        )
      ) {
        return null;
      }

      return {
        node,
      };
    },
  },

  /*
   * --------------------------------------------------
   * new Function(...)
   * --------------------------------------------------
   */
  {
    id:
      'SAST-JS-002',

    title:
      'Construction dynamique de fonction',

    description:
      'new Function() compile dynamiquement du code JavaScript et peut introduire une injection de code.',

    severity:
      'HIGH',

    category:
      'CODE_INJECTION',

    cweId:
      'CWE-95',

    owaspCategory:
      'A03:2021-Injection',

    recommendation:
      'Éviter new Function() et remplacer la génération dynamique de code par une implémentation statique.',

    confidence:
      0.98,

    match(
      node,
    ) {
      if (
        !ts.isNewExpression(
          node,
        )
      ) {
        return null;
      }

      if (
        !isIdentifierNamed(
          node.expression,
          'Function',
        )
      ) {
        return null;
      }

      return {
        node,
      };
    },
  },

  /*
   * --------------------------------------------------
   * child_process.exec(dynamic)
   * execSync(dynamic)
   * --------------------------------------------------
   */
  {
    id:
      'SAST-NODE-001',

    title:
      'Commande système construite dynamiquement',

    description:
      'Une commande système semble être construite à partir d’une expression dynamique avant exécution.',

    severity:
      'CRITICAL',

    category:
      'COMMAND_INJECTION',

    cweId:
      'CWE-78',

    owaspCategory:
      'A03:2021-Injection',

    recommendation:
      'Éviter exec/execSync avec des commandes dynamiques. Utiliser spawn/execFile avec des arguments séparés et strictement validés.',

    confidence:
      0.9,

    match(
      node,
    ) {
      if (
        !ts.isCallExpression(
          node,
        )
      ) {
        return null;
      }

      const method =
        getPropertyName(
          node.expression,
        );

      if (
        method !== 'exec' &&
        method !== 'execSync'
      ) {
        return null;
      }

      const command =
        node.arguments[0];

      if (
        !command ||
        !isDynamicExpression(
          command,
        )
      ) {
        return null;
      }

      return {
        node,

        metadata: {
          method,
        },
      };
    },
  },

  /*
   * --------------------------------------------------
   * SQL query construite par concat/template
   * --------------------------------------------------
   */
  {
    id:
      'SAST-SQL-001',

    title:
      'Requête SQL construite dynamiquement',

    description:
      'Une requête SQL semble être construite par concaténation ou interpolation avant son exécution.',

    severity:
      'HIGH',

    category:
      'SQL_INJECTION',

    cweId:
      'CWE-89',

    owaspCategory:
      'A03:2021-Injection',

    recommendation:
      'Utiliser exclusivement des requêtes paramétrées ou les mécanismes de binding de l’ORM.',

    confidence:
      0.82,

    match(
      node,
    ) {
      if (
        !ts.isCallExpression(
          node,
        )
      ) {
        return null;
      }

      const method =
        getPropertyName(
          node.expression,
        );

      const sqlMethods =
        new Set([
          'query',
          'execute',
          'raw',
          '$queryRawUnsafe',
          '$executeRawUnsafe',
        ]);

      if (
        !method ||
        !sqlMethods.has(
          method,
        )
      ) {
        return null;
      }

      const query =
        node.arguments[0];

      if (!query) {
        return null;
      }

      /*
       * Les méthodes Prisma explicitement
       * Unsafe sont toujours considérées
       * comme nécessitant une revue.
       */
      if (
        method ===
          '$queryRawUnsafe' ||
        method ===
          '$executeRawUnsafe'
      ) {
        return {
          node,

          confidence:
            0.9,

          metadata: {
            method,
          },
        };
      }

      if (
        !isDynamicExpression(
          query,
        )
      ) {
        return null;
      }

      return {
        node,

        metadata: {
          method,
        },
      };
    },
  },

  /*
   * --------------------------------------------------
   * MD5 / SHA1
   * --------------------------------------------------
   */
  {
    id:
      'SAST-CRYPTO-001',

    title:
      'Algorithme de hachage faible',

    description:
      'MD5 ou SHA-1 est utilisé comme fonction de hachage cryptographique.',

    severity:
      'MEDIUM',

    category:
      'WEAK_CRYPTOGRAPHY',

    cweId:
      'CWE-328',

    owaspCategory:
      'A02:2021-Cryptographic Failures',

    recommendation:
      'Utiliser SHA-256 ou une fonction adaptée au contexte. Pour les mots de passe, utiliser Argon2, scrypt ou bcrypt.',

    confidence:
      0.96,

    match(
      node,
    ) {
      if (
        !ts.isCallExpression(
          node,
        )
      ) {
        return null;
      }

      const method =
        getPropertyName(
          node.expression,
        );

      if (
        method !==
        'createHash'
      ) {
        return null;
      }

      const algorithm =
        getStringLiteralValue(
          node.arguments[0],
        )
          ?.toLowerCase();

      if (
        algorithm !==
          'md5' &&
        algorithm !==
          'sha1'
      ) {
        return null;
      }

      return {
        node,

        metadata: {
          algorithm,
        },
      };
    },
  },

  /*
   * --------------------------------------------------
   * rejectUnauthorized: false
   * --------------------------------------------------
   */
  {
    id:
      'SAST-TLS-001',

    title:
      'Validation TLS désactivée',

    description:
      'La validation du certificat TLS est explicitement désactivée avec rejectUnauthorized: false.',

    severity:
      'HIGH',

    category:
      'TLS_CONFIGURATION',

    cweId:
      'CWE-295',

    owaspCategory:
      'A07:2021-Identification and Authentication Failures',

    recommendation:
      'Ne pas désactiver la validation des certificats TLS. Configurer correctement la chaîne de confiance.',

    confidence:
      0.99,

    match(
      node,
    ) {
      if (
        !ts.isPropertyAssignment(
          node,
        )
      ) {
        return null;
      }

      const propertyName =
        ts.isIdentifier(
          node.name,
        ) ||
        ts.isStringLiteral(
          node.name,
        )
          ? node.name.text
          : null;

      if (
        propertyName !==
        'rejectUnauthorized'
      ) {
        return null;
      }

      if (
        node.initializer.kind !==
        ts.SyntaxKind.FalseKeyword
      ) {
        return null;
      }

      return {
        node,
      };
    },
  },

  /*
   * --------------------------------------------------
   * JWT ignoreExpiration:true
   * --------------------------------------------------
   */
  {
    id:
      'SAST-JWT-001',

    title:
      'Expiration JWT ignorée',

    description:
      'La vérification JWT semble être configurée pour ignorer l’expiration du token.',

    severity:
      'HIGH',

    category:
      'AUTHENTICATION',

    cweId:
      'CWE-613',

    owaspCategory:
      'A07:2021-Identification and Authentication Failures',

    recommendation:
      'Ne pas utiliser ignoreExpiration: true dans les contrôles JWT de production.',

    confidence:
      0.97,

    match(
      node,
    ) {
      if (
        !ts.isPropertyAssignment(
          node,
        )
      ) {
        return null;
      }

      const propertyName =
        ts.isIdentifier(
          node.name,
        ) ||
        ts.isStringLiteral(
          node.name,
        )
          ? node.name.text
          : null;

      if (
        propertyName !==
        'ignoreExpiration'
      ) {
        return null;
      }

      if (
        node.initializer.kind !==
        ts.SyntaxKind.TrueKeyword
      ) {
        return null;
      }

      return {
        node,
      };
    },
  },

  /*
   * --------------------------------------------------
   * innerHTML = dynamic
   * --------------------------------------------------
   */
  {
    id:
      'SAST-XSS-001',

    title:
      'Affectation dynamique à innerHTML',

    description:
      'Une valeur dynamique est affectée directement à innerHTML, ce qui peut permettre une injection HTML/XSS.',

    severity:
      'HIGH',

    category:
      'XSS',

    cweId:
      'CWE-79',

    owaspCategory:
      'A03:2021-Injection',

    recommendation:
      'Éviter innerHTML pour les données non fiables et utiliser des APIs DOM sûres ou un mécanisme d’échappement adapté.',

    confidence:
      0.8,

    match(
      node,
    ) {
      if (
        !ts.isBinaryExpression(
          node,
        )
      ) {
        return null;
      }

      if (
        node.operatorToken.kind !==
        ts.SyntaxKind.EqualsToken
      ) {
        return null;
      }

      if (
        !ts.isPropertyAccessExpression(
          node.left,
        ) ||
        node.left.name.text !==
          'innerHTML'
      ) {
        return null;
      }

      if (
        !isDynamicExpression(
          node.right,
        )
      ) {
        return null;
      }

      return {
        node,
      };
    },
  },
];
