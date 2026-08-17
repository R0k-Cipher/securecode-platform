import type { PrismaClient } from '@prisma/client';

const permissions = [
  {
    code: 'organization:read',
    name: 'Lire une organisation',
    description: "Consulter les informations d'une organisation",
  },
  {
    code: 'organization:update',
    name: 'Modifier une organisation',
    description: "Modifier les informations d'une organisation",
  },
  {
    code: 'organization:delete',
    name: 'Supprimer une organisation',
    description: 'Supprimer une organisation',
  },

  {
    code: 'member:read',
    name: 'Lire les membres',
    description: "Consulter les membres d'une organisation",
  },
  {
    code: 'member:invite',
    name: 'Inviter un membre',
    description: "Inviter un utilisateur dans l'organisation",
  },
  {
    code: 'member:update',
    name: 'Modifier un membre',
    description: "Modifier le rôle d'un membre",
  },
  {
    code: 'member:delete',
    name: 'Supprimer un membre',
    description: "Retirer un membre de l'organisation",
  },

  {
    code: 'invitation:read',
    name: 'Lire les invitations',
    description: "Consulter les invitations d'une organisation",
  },
  {
    code: 'invitation:cancel',
    name: 'Annuler une invitation',
    description: 'Annuler une invitation en attente',
  },

  {
    code: 'project:create',
    name: 'Créer un projet',
    description: 'Créer un projet',
  },
  {
    code: 'project:read',
    name: 'Lire un projet',
    description: 'Consulter les projets',
  },
  {
    code: 'project:update',
    name: 'Modifier un projet',
    description: 'Modifier un projet',
  },
  {
    code: 'project:delete',
    name: 'Supprimer un projet',
    description: 'Supprimer un projet',
  },
  {
    code: 'project:archive',
    name: 'Archiver un projet',
    description: 'Archiver un projet actif',
  },
  {
    code: 'project:restore',
    name: 'Restaurer un projet',
    description: 'Restaurer un projet archivé',
  },

  {
    code: 'scan:create',
    name: 'Lancer une analyse',
    description: 'Créer et lancer une analyse de sécurité',
  },
  {
    code: 'scan:read',
    name: 'Lire les analyses',
    description: 'Consulter les analyses de sécurité',
  },
  {
    code: 'scan:cancel',
    name: 'Annuler une analyse',
    description: 'Annuler une analyse en cours',
  },

  {
    code: 'finding:read',
    name: 'Lire les vulnérabilités',
    description: 'Consulter les vulnérabilités détectées',
  },
  {
    code: 'finding:update',
    name: 'Modifier une vulnérabilité',
    description: "Modifier le statut ou les informations d'une vulnérabilité",
  },

  {
    code: 'report:read',
    name: 'Lire les rapports',
    description: 'Consulter les rapports de sécurité',
  },
  {
    code: 'report:export',
    name: 'Exporter les rapports',
    description: 'Exporter les rapports de sécurité',
  },

  {
    code: 'audit-log:read',
    name: "Lire les journaux d'audit",
    description: "Consulter l'historique des actions",
  },

  {
    code: 'repository:create',
    name: 'Connecter un dépôt',
    description:
      'Connecter un dépôt Git à un projet',
  },
  {
    code: 'repository:read',
    name: 'Consulter les dépôts',
    description:
      'Consulter les dépôts Git des projets',
  },
  {
    code: 'repository:update',
    name: 'Modifier un dépôt',
    description:
      'Modifier, archiver ou restaurer un dépôt',
  },
  {
    code: 'repository:delete',
    name: 'Supprimer un dépôt',
    description:
      'Supprimer définitivement un dépôt',
  },
  {
    code: 'repository:sync',
    name: 'Synchroniser un dépôt',
    description:
      'Synchroniser les informations d’un dépôt Git',
  },
  {
  code: 'git-connection:create',
  name: 'Créer une connexion Git',
  description:
    'Connecter un compte GitHub ou GitLab',
  },
  {
    code: 'git-connection:read',
    name: 'Consulter les connexions Git',
    description:
      'Consulter les connexions Git de l’organisation',
  },
  {
    code: 'git-connection:update',
    name: 'Modifier une connexion Git',
    description:
      'Modifier, révoquer ou réactiver une connexion Git',
  },
  {
    code: 'git-connection:delete',
    name: 'Supprimer une connexion Git',
    description:
      'Supprimer une connexion Git',
  },
] as const;

const roles = [
  {
    code: 'OWNER',
    name: 'Propriétaire',
    description: "Propriétaire de l'organisation",
    isSystem: true,
    permissions: permissions.map((permission) => permission.code),
  },
  {
    code: 'ADMIN',
    name: 'Administrateur',
    description: "Administrateur de l'organisation",
    isSystem: true,
    permissions: [
      'organization:read',
      'organization:update',

      'member:read',
      'member:invite',
      'member:update',
      'member:delete',

      'invitation:read',
      'invitation:cancel',

      'project:create',
      'project:read',
      'project:update',
      'project:delete',
      'project:archive',
      'project:restore',

      'git-connection:create',
      'git-connection:read',
      'git-connection:update',
      'git-connection:delete',

      'scan:create',
      'scan:read',
      'scan:cancel',

      'finding:read',
      'finding:update',

      'report:read',
      'report:export',

      'audit-log:read',

      'repository:create',
      'repository:read',
      'repository:update',
      'repository:delete',
      'repository:sync',
    ],
  },
  {
    code: 'MANAGER',
    name: 'Manager',
    description: 'Gestionnaire des projets et des équipes',
    isSystem: true,
    permissions: [
      'organization:read',

      'member:read',
      'member:invite',

      'invitation:read',

      'project:create',
      'project:read',
      'project:update',
      'project:archive',
      'project:restore',

      'git-connection:create',
      'git-connection:read',
      'git-connection:update',

      'scan:create',
      'scan:read',
      'scan:cancel',

      'finding:read',
      'finding:update',

      'report:read',
      'report:export',

      'repository:create',
      'repository:read',
      'repository:update',
      'repository:sync',
    ],
  },
  {
    code: 'SECURITY_ANALYST',
    name: 'Analyste sécurité',
    description: 'Analyse les vulnérabilités et les résultats des scans',
    isSystem: true,
    permissions: [
      'organization:read',

      'member:read',

      'project:read',

      'git-connection:read',

      'scan:create',
      'scan:read',
      'scan:cancel',

      'finding:read',
      'finding:update',

      'report:read',
      'report:export',

      'repository:read',
      'repository:sync',
    ],
  },
  {
    code: 'DEVELOPER',
    name: 'Développeur',
    description: 'Développeur membre des projets',
    isSystem: true,
    permissions: [
      'organization:read',

      'member:read',

      'project:read',

      'git-connection:read',

      'scan:create',
      'scan:read',

      'finding:read',
      'finding:update',

      'report:read',
      'repository:read',
      'repository:sync',
    ],
  },
  {
    code: 'AUDITOR',
    name: 'Auditeur',
    description: "Auditeur disposant d'un accès en lecture",
    isSystem: true,
    permissions: [
      'organization:read',

      'member:read',

      'project:read',

      'git-connection:read',

      'scan:read',

      'finding:read',

      'report:read',
      'report:export',

      'audit-log:read',

      'repository:read',

    ],
  },
  {
    code: 'VIEWER',
    name: 'Lecteur',
    description: 'Accès limité en lecture seule',
    isSystem: true,
    permissions: [
      'organization:read',
      'member:read',
      'project:read',
      'git-connection:read',
      'scan:read',
      'finding:read',
      'report:read',
      'repository:read',
    ],
  },
] as const;

export async function seedRbac(
  prisma: PrismaClient,
): Promise<void> {
  console.log('Création des permissions RBAC...');

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {
        name: permission.name,
        description: permission.description,
      },
      create: {
        code: permission.code,
        name: permission.name,
        description: permission.description,
      },
    });
  }

  console.log('Création des rôles RBAC...');

  for (const roleDefinition of roles) {
    const role = await prisma.role.upsert({
      where: {
        code: roleDefinition.code,
      },
      update: {
        name: roleDefinition.name,
        description: roleDefinition.description,
        isSystem: roleDefinition.isSystem,
      },
      create: {
        code: roleDefinition.code,
        name: roleDefinition.name,
        description: roleDefinition.description,
        isSystem: roleDefinition.isSystem,
      },
    });

    /*
     * Cette suppression rend le seed idempotent :
     * chaque exécution remplace les anciennes associations
     * par la configuration actuelle.
     */
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
      },
    });

    const rolePermissions =
      await prisma.permission.findMany({
        where: {
          code: {
            in: [...roleDefinition.permissions],
          },
        },
        select: {
          id: true,
          code: true,
        },
      });

    if (
      rolePermissions.length !==
      roleDefinition.permissions.length
    ) {
      const foundCodes = new Set(
        rolePermissions.map(
          (permission) => permission.code,
        ),
      );

      const missingCodes =
        roleDefinition.permissions.filter(
          (code) => !foundCodes.has(code),
        );

      throw new Error(
        `Permissions introuvables pour le rôle ${roleDefinition.code}: ${missingCodes.join(', ')}`,
      );
    }

    await prisma.rolePermission.createMany({
      data: rolePermissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  console.log('Seed RBAC terminé avec succès.');
}
