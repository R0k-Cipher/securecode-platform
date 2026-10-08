# SecureCode — Règles de développement

1. Aucun contrôleur ne contient de logique métier.
2. Aucun scanner ne communique directement avec Prisma.
3. Aucune règle de scan ne dépend de NestJS.
4. Chaque module possède une responsabilité clairement définie.
5. Aucun token GitHub ou GitLab n’est renvoyé au frontend.
6. Tous les tokens stockés sont chiffrés.
7. Tous les webhooks sont authentifiés par signature ou secret.
8. Tous les événements webhook sont idempotents.
9. Chaque job BullMQ peut être relancé sans créer de doublons.
10. Chaque finding est traçable jusqu’au fichier, commit, scanner et règle.
11. L’échec d’un scanner ne doit pas arrêter les autres scanners.
12. Les DTO sont distincts des modèles Prisma.
13. Les échanges entre modules utilisent des contrats typés.
14. Toutes les entrées externes sont validées.
15. Le code d’un dépôt analysé n’est jamais exécuté automatiquement.
16. Les workspaces temporaires sont isolés et supprimés après traitement.
17. Les secrets et données sensibles sont masqués dans les logs.
18. Toutes les migrations Prisma sont versionnées.
19. Chaque fonctionnalité métier possède des tests adaptés.
20. Toute décision architecturale importante est documentée dans docs/decisions.
