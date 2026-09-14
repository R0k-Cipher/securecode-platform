import type {
  PrismaClient,
} from '@prisma/client';

/*
|--------------------------------------------------------------------------
| PERMISSIONS
|--------------------------------------------------------------------------
|
| Les permissions ne donnent aucun accès toutes seules.
|
| Elles sont attachées à un Role.
|
| Ensuite :
|
| OrganizationMember -> Role ORGANIZATION
| ProjectMember      -> Role PROJECT
|
*/

const permissions = [
  /*
  |--------------------------------------------------------------------------
  | ORGANIZATION
  |--------------------------------------------------------------------------
  */

  {
    code: 'organization:read',
    name: 'Lire une organisation',
    description:
      "Consulter les informations d'une organisation",
  },

  {
    code: 'organization:update',
    name: 'Modifier une organisation',
    description:
      "Modifier les informations d'une organisation",
  },

  {
    code: 'organization:delete',
    name: 'Supprimer une organisation',
    description:
      'Supprimer une organisation',
  },

  {
    code:'organization-report:read',
    name:'Lire les rapports organisation',
    description:
      'Lire les rapports organisation',
  },

  {
    code:'organization-report:export',
    name:'Générer les rapports organisation',
    description:
      'Générer les rapports organisation',
  },

  /*
  |--------------------------------------------------------------------------
  | ORGANIZATION MEMBERS
  |--------------------------------------------------------------------------
  */

  {
    code: 'member:read',
    name: 'Lire les membres',
    description:
      "Consulter les membres d'une organisation",
  },

  {
    code: 'member:invite',
    name: 'Inviter un membre',
    description:
      "Inviter un utilisateur dans l'organisation",
  },

  {
    code: 'member:update',
    name: 'Modifier un membre',
    description:
      "Modifier le rôle organisationnel d'un membre",
  },

  {
    code: 'member:delete',
    name: 'Supprimer un membre',
    description:
      "Retirer un membre de l'organisation",
  },

  /*
  |--------------------------------------------------------------------------
  | INVITATIONS
  |--------------------------------------------------------------------------
  */

  {
    code: 'invitation:read',
    name: 'Lire les invitations',
    description:
      "Consulter les invitations d'une organisation",
  },

  {
    code: 'invitation:cancel',
    name: 'Annuler une invitation',
    description:
      'Annuler une invitation en attente',
  },

  /*
  |--------------------------------------------------------------------------
  | PROJECT
  |--------------------------------------------------------------------------
  */
{
    code: 'project:list',
    name: 'Lister les projets',
    description:
      "Lister les projets accessibles dans l'organisation",
  },
  {
    code: 'project:create',
    name: 'Créer un projet',
    description:
      "Créer un projet dans l'organisation",
  },

  {
    code: 'project:read',
    name: 'Lire un projet',
    description:
      'Consulter un projet',
  },

  {
    code: 'project:update',
    name: 'Modifier un projet',
    description:
      'Modifier un projet',
  },

  {
    code: 'project:delete',
    name: 'Supprimer un projet',
    description:
      'Supprimer un projet',
  },

  {
    code: 'project:archive',
    name: 'Archiver un projet',
    description:
      'Archiver un projet actif',
  },

  {
    code: 'project:restore',
    name: 'Restaurer un projet',
    description:
      'Restaurer un projet archivé',
  },

  /*
  |--------------------------------------------------------------------------
  | PROJECT MEMBERS
  |--------------------------------------------------------------------------
  */


  {
    code: 'project-member:read',
    name: 'Consulter les membres du projet',
    description:
      'Consulter les utilisateurs affectés au projet',
  },

  {
    code: 'project-member:manage',
    name: 'Gérer les membres du projet',
    description:
      'Ajouter, modifier ou retirer les membres du projet',
  },

  /*
  |--------------------------------------------------------------------------
  | GIT CONNECTION
  |--------------------------------------------------------------------------
  */

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
      "Consulter les connexions Git de l'organisation",
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

  /*
  |--------------------------------------------------------------------------
  | REPOSITORIES
  |--------------------------------------------------------------------------
  */

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
      'Consulter les dépôts Git du projet',
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

  /*
  |--------------------------------------------------------------------------
  | SCANS
  |--------------------------------------------------------------------------
  */

  {
    code: 'scan:create',
    name: 'Lancer une analyse',
    description:
      'Créer et lancer une analyse de sécurité',
  },

  {
    code: 'scan:read',
    name: 'Lire les analyses',
    description:
      'Consulter les analyses de sécurité',
  },

  {
    code: 'scan:cancel',
    name: 'Annuler une analyse',
    description:
      'Annuler une analyse en cours',
  },

  /*
  |--------------------------------------------------------------------------
  | FINDINGS
  |--------------------------------------------------------------------------
  */

  {
    code: 'finding:read',
    name: 'Lire les vulnérabilités',
    description:
      'Consulter les vulnérabilités détectées',
  },

  {
    code: 'finding:update',
    name: 'Modifier une vulnérabilité',
    description:
      "Modifier le statut ou les informations d'une vulnérabilité",
  },

  {
    code: 'finding:assign',
    name: 'Assigner une vulnérabilité',
    description:
      'Assigner une vulnérabilité à un membre du projet',
  },

  /*
  |--------------------------------------------------------------------------
  | REPORTS
  |--------------------------------------------------------------------------
  */

  {
    code: 'report:read',
    name: 'Lire les rapports',
    description:
      'Consulter les rapports de sécurité',
  },

  {
    code: 'report:export',
    name: 'Exporter les rapports',
    description:
      'Exporter les rapports de sécurité',
  },

  /*
  |--------------------------------------------------------------------------
  | AUDIT
  |--------------------------------------------------------------------------
  */

  {
    code: 'audit-log:read',
    name: "Lire les journaux d'audit",
    description:
      "Consulter l'historique des actions",
  },
] as const;

/*
|--------------------------------------------------------------------------
| ROLES
|--------------------------------------------------------------------------
|
| IMPORTANT :
|
| PLATFORM_ADMIN n'existe PAS ici.
|
| PLATFORM_ADMIN est géré exclusivement par :
|
| User.platformRole = PLATFORM_ADMIN
|
*/

const roles = [
  /*
  |--------------------------------------------------------------------------
  | ORGANIZATION — OWNER
  |--------------------------------------------------------------------------
  |
  | Contrôle total de son entreprise.
  |
  | OWNER peut voir et administrer tous les projets
  | de son organisation sans ProjectMember obligatoire.
  |
  */

  {
    code: 'OWNER',

    name:
      'Propriétaire',

    description:
      "Propriétaire de l'organisation",

    scope:
      'ORGANIZATION',

    isSystem:
      true,

    permissions:
      permissions.map(
        (permission) =>
          permission.code,
      ),
  },

  /*
  |--------------------------------------------------------------------------
  | ORGANIZATION — ADMIN
  |--------------------------------------------------------------------------
  |
  | Administration de l'entreprise.
  |
  | IMPORTANT :
  |
  | ADMIN n'obtient PAS automatiquement les droits sur tous
  | les projets.
  |
  | Pour administrer Project A :
  |
  | ProjectMember -> PROJECT_ADMIN
  |
  */

  {
    code:
      'ADMIN',

    name:
      "Administrateur d'organisation",

    description:
      "Administration de l'organisation sans privilège automatique sur tous les projets",

    scope:
      'ORGANIZATION',

    isSystem:
      true,

  permissions: [
    'organization:read',
    'organization:update',

    'member:read',
    'member:invite',
    'member:update',
    'member:delete',

    'invitation:read',
    'invitation:cancel',

    'project:list',
    'project:create',

    'organization-report:read',
    'organization-report:export',

    'git-connection:create',
    'git-connection:read',
    'git-connection:update',
    'git-connection:delete',

    'audit-log:read',
  ],
  },

  /*
  |--------------------------------------------------------------------------
  | PROJECT — PROJECT ADMIN
  |--------------------------------------------------------------------------
  |
  | Contrôle complet UNIQUEMENT du projet affecté.
  |
  */


  {
    code: 'MEMBER',

    name: 'Membre',

    description:
      "Membre standard de l'organisation affecté à un ou plusieurs projets",

    scope: 'ORGANIZATION',

    isSystem: true,

    permissions: [
      'organization:read',
      'member:read',
      'project:list',
    ],

  },

  {
    code:
      'PROJECT_ADMIN',

    name:
      'Administrateur du projet',

    description:
      'Contrôle complet sur le projet auquel il est affecté',

    scope:
      'PROJECT',

    isSystem:
      true,

    permissions: [
      'project:read',
      'project:update',
      'project:delete',
      'project:archive',
      'project:restore',

      'project-member:read',
      'project-member:manage',

      'repository:create',
      'repository:read',
      'repository:update',
      'repository:delete',
      'repository:sync',

      'organization-report:read',
      'organization-report:export',

      'scan:create',
      'scan:read',
      'scan:cancel',

      'finding:read',
      'finding:update',
      'finding:assign',

      'report:read',
      'report:export',

      'audit-log:read',
    ],
  },

  /*
  |--------------------------------------------------------------------------
  | PROJECT — MANAGER
  |--------------------------------------------------------------------------
  */

  {
    code:
      'MANAGER',

    name:
      'Manager',

    description:
      'Gestion opérationnelle du projet et de son équipe',

    scope:
      'PROJECT',

    isSystem:
      true,

    permissions: [
      'project:read',
      'project:update',

      'project-member:read',
      'project-member:manage',

      'repository:create',
      'repository:read',
      'repository:update',
      'repository:sync',

      'organization-report:read',
      'organization-report:export',

      'scan:create',
      'scan:read',
      'scan:cancel',

      'finding:read',
      'finding:update',
      'finding:assign',

      'report:read',
      'report:export',
    ],
  },

  /*
  |--------------------------------------------------------------------------
  | PROJECT — SECURITY ANALYST
  |--------------------------------------------------------------------------
  */

  {
    code:
      'SECURITY_ANALYST',

    name:
      'Analyste sécurité',

    description:
      'Analyse et traite les vulnérabilités du projet',

    scope:
      'PROJECT',

    isSystem:
      true,

    permissions: [
      'project:read',

      'project-member:read',

      'repository:read',
      'repository:sync',

      'organization-report:read',
      'organization-report:export',

      'scan:create',
      'scan:read',
      'scan:cancel',

      'finding:read',
      'finding:update',
      'finding:assign',

      'report:read',
      'report:export',
    ],
  },

  /*
  |--------------------------------------------------------------------------
  | PROJECT — DEVELOPER
  |--------------------------------------------------------------------------
  */

  {
    code:
      'DEVELOPER',

    name:
      'Développeur',

    description:
      'Développeur affecté uniquement aux projets sélectionnés',

    scope:
      'PROJECT',

    isSystem:
      true,

    permissions: [
      'project:read',

      'project-member:read',

      'repository:read',
      'repository:sync',

      'scan:create',
      'scan:read',

      'finding:read',
      'finding:update',

      'report:read',
    ],
  },

  /*
  |--------------------------------------------------------------------------
  | PROJECT — AUDITOR
  |--------------------------------------------------------------------------
  */

  {
    code:
      'AUDITOR',

    name:
      'Auditeur',

    description:
      'Accès audit en lecture au projet affecté',

    scope:
      'PROJECT',

    isSystem:
      true,

    permissions: [
      'project:read',

      'project-member:read',

      'repository:read',

      'scan:read',

      'finding:read',

      'report:read',
      'report:export',

      'audit-log:read',
    ],
  },

  /*
  |--------------------------------------------------------------------------
  | PROJECT — VIEWER
  |--------------------------------------------------------------------------
  */

  {
    code:
      'VIEWER',

    name:
      'Lecteur',

    description:
      'Accès lecture seule au projet affecté',

    scope:
      'PROJECT',

    isSystem:
      true,

    permissions: [
      'project:read',

      'repository:read',

      'scan:read',

      'finding:read',

      'report:read',
    ],
  },
] as const;

/*
|--------------------------------------------------------------------------
| SEED
|--------------------------------------------------------------------------
*/

export async function seedRbac(
  prisma: PrismaClient,
): Promise<void> {
  console.log(
    'Création des permissions RBAC...',
  );

  /*
   * Permissions
   */

  for (
    const permission
    of permissions
  ) {
    await prisma.permission.upsert({
      where: {
        code:
          permission.code,
      },

      update: {
        name:
          permission.name,

        description:
          permission.description,
      },

      create: {
        code:
          permission.code,

        name:
          permission.name,

        description:
          permission.description,
      },
    });
  }

  console.log(
    'Création des rôles RBAC...',
  );

  /*
   * Roles
   */

  for (
    const roleDefinition
    of roles
  ) {
    const role =
      await prisma.role.upsert({
        where: {
          code:
            roleDefinition.code,
        },

        update: {
          name:
            roleDefinition.name,

          description:
            roleDefinition.description,

          scope:
            roleDefinition.scope,

          isSystem:
            roleDefinition.isSystem,
        },

        create: {
          code:
            roleDefinition.code,

          name:
            roleDefinition.name,

          description:
            roleDefinition.description,

          scope:
            roleDefinition.scope,

          isSystem:
            roleDefinition.isSystem,
        },
      });

    /*
     * On remplace complètement
     * les permissions du rôle.
     */

    await prisma.rolePermission.deleteMany({
      where: {
        roleId:
          role.id,
      },
    });

    const rolePermissions =
      await prisma.permission.findMany({
        where: {
          code: {
            in: [
              ...roleDefinition.permissions,
            ],
          },
        },

        select: {
          id:
            true,

          code:
            true,
        },
      });

    /*
     * Vérification stricte :
     *
     * aucune permission définie dans un rôle
     * ne doit être absente de la DB.
     */

    if (
      rolePermissions.length !==
      roleDefinition.permissions.length
    ) {
      const foundCodes =
        new Set(
          rolePermissions.map(
            (
              permission,
            ) =>
              permission.code,
          ),
        );

      const missingCodes =
        roleDefinition.permissions.filter(
          (
            code,
          ) =>
            !foundCodes.has(
              code,
            ),
        );

      throw new Error(
        `Permissions introuvables pour le rôle ${roleDefinition.code}: ${missingCodes.join(', ')}`,
      );
    }

    if (
      rolePermissions.length >
      0
    ) {
      await prisma.rolePermission.createMany({
        data:
          rolePermissions.map(
            (
              permission,
            ) => ({
              roleId:
                role.id,

              permissionId:
                permission.id,
            }),
          ),

        skipDuplicates:
          true,
      });
    }
  }

  console.log(
    'Seed RBAC terminé avec succès.',
  );
}
