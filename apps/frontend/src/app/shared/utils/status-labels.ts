export const SCAN_STATUS_LABELS:
  Record<string, string> = {
  QUEUED:
    'En attente',

  PREPARING:
    'Préparation',

  DOWNLOADING:
    'Téléchargement',

  DETECTING:
    'Détection',

  SCANNING:
    'Analyse',

  PROCESSING_RESULTS:
    'Traitement des résultats',

  CALCULATING_SCORE:
    'Calcul du score',

  GENERATING_REPORT:
    'Génération du rapport',

  COMPLETED:
    'Terminé',

  FAILED:
    'Échec',

  CANCELLED:
    'Annulé',
};

export const REPOSITORY_SYNC_STATUS_LABELS:
  Record<string, string> = {
  NOT_SYNCED:
    'Non synchronisé',

  PENDING:
    'En attente',

  QUEUED:
    'En file',

  RUNNING:
    'Synchronisation',

  COMPLETED:
    'Synchronisé',

  FAILED:
    'Échec',
};

export const FINDING_STATUS_LABELS:
  Record<string, string> = {
  DETECTED:
    'Détecté',

  TO_REVIEW:
    'À vérifier',

  CONFIRMED:
    'Confirmé',

  ASSIGNED:
    'Assigné',

  IN_PROGRESS:
    'En cours',

  READY_FOR_RETEST:
    'Prêt pour retest',

  FALSE_POSITIVE:
    'Faux positif',

  ACCEPTED_RISK:
    'Risque accepté',

  FIXED:
    'Corrigé',

  REOPENED:
    'Réouvert',

  CLOSED:
    'Fermé',
};

export function scanStatusLabel(
  status: string,
): string {
  return (
    SCAN_STATUS_LABELS[
      status
    ] ?? status
  );
}

export function repositorySyncStatusLabel(
  status: string,
): string {
  return (
    REPOSITORY_SYNC_STATUS_LABELS[
      status
    ] ?? status
  );
}

export function findingStatusLabel(
  status: string,
): string {
  return (
    FINDING_STATUS_LABELS[
      status
    ] ?? status
  );
}
