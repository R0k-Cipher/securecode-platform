export interface SecretRule {
  id: string;

  title: string;

  description: string;

  severity:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';

  pattern: RegExp;

  recommendation: string;

  confidence: number;
}

export const SECRET_RULES:
  SecretRule[] = [
  {
    id:
      'SECRET-GENERIC-API-KEY',

    title:
      'Clé API potentiellement exposée',

    description:
      'Une valeur ressemblant à une clé API est présente dans le code source.',

    severity:
      'HIGH',

    pattern:
      /\b(?:api[_-]?key|apikey)\b\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/gi,

    recommendation:
      'Stocker les secrets dans un gestionnaire de secrets ou dans des variables d’environnement sécurisées.',

    confidence:
      0.85,
  },

  {
    id:
      'SECRET-GENERIC-PASSWORD',

    title:
      'Mot de passe potentiellement codé en dur',

    description:
      'Une valeur ressemblant à un mot de passe est codée directement dans le fichier.',

    severity:
      'HIGH',

    pattern:
      /\b(?:password|passwd|pwd)\b\s*[:=]\s*["'][^"']{8,}["']/gi,

    recommendation:
      'Ne jamais stocker un mot de passe directement dans le code source.',

    confidence:
      0.8,
  },

  {
    id:
      'SECRET-JWT',

    title:
      'JWT potentiellement exposé',

    description:
      'Un token ayant la structure d’un JWT a été détecté.',

    severity:
      'HIGH',

    pattern:
      /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,

    recommendation:
      'Révoquer le token s’il est actif et utiliser un stockage sécurisé.',

    confidence:
      0.9,
  },

  {
    id:
      'SECRET-PRIVATE-KEY',

    title:
      'Clé privée exposée',

    description:
      'Un bloc de clé privée semble présent dans le repository.',

    severity:
      'CRITICAL',

    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,

    recommendation:
      'Retirer immédiatement la clé privée du repository, la révoquer et effectuer une rotation.',

    confidence:
      0.99,
  },

  {
    id:
      'SECRET-AWS-ACCESS-KEY',

    title:
      'AWS Access Key potentiellement exposée',

    description:
      'Une valeur correspondant au format d’une AWS Access Key a été détectée.',

    severity:
      'CRITICAL',

    pattern:
      /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,

    recommendation:
      'Révoquer immédiatement la clé AWS et effectuer une rotation des identifiants.',

    confidence:
      0.98,
  },
];
