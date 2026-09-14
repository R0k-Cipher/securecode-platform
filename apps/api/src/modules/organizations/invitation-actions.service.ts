import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, NotificationType } from '@prisma/client';
import { PrismaService } from '@securecode-platform/database';

@Injectable()
export class InvitationActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async accept(userId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        role: { select: { id: true, code: true, name: true } },
      },
    });

    if (!invitation) throw new NotFoundException('Invitation introuvable.');
    if (invitation.acceptedAt) throw new BadRequestException('Invitation déjà acceptée.');
    if (invitation.revokedAt) throw new BadRequestException('Invitation révoquée.');
    if (invitation.expiresAt <= new Date()) throw new BadRequestException('Invitation expirée.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    if (user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
      throw new ForbiddenException("Cette invitation n'appartient pas à votre compte.");
    }

    const member = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId,
          },
        },
      });

      const created = existing ?? await tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId,
          roleId: invitation.roleId,
          invitedById: invitation.invitedById,
          joinedAt: new Date(),
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      const notifications = await tx.notification.findMany({
        where: { userId, type: NotificationType.INVITATION, readAt: null },
        select: { id: true, metadata: true },
      });
      const ids = notifications
        .filter((n) => (n.metadata as Record<string, unknown> | null)?.['invitationId'] === invitation.id)
        .map((n) => n.id);
      if (ids.length) {
        await tx.notification.updateMany({ where: { id: { in: ids } }, data: { readAt: new Date() } });
      }

      await tx.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          actorId: userId,
          action: AuditAction.ACCEPT_INVITATION,
          resourceType: 'Invitation',
          resourceId: invitation.id,
          description: `${user.email} a accepté l'invitation`,
          metadata: { roleId: invitation.roleId },
        },
      });

      return created;
    });

    return { success: true, member, organization: invitation.organization, role: invitation.role };
  }

  async decline(userId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable.');
    if (invitation.acceptedAt) throw new BadRequestException('Invitation déjà acceptée.');
    if (invitation.revokedAt) return { success: true };

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    if (user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
      throw new ForbiddenException("Cette invitation n'appartient pas à votre compte.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
      const notifications = await tx.notification.findMany({
        where: { userId, type: NotificationType.INVITATION, readAt: null },
        select: { id: true, metadata: true },
      });
      const ids = notifications
        .filter((n) => (n.metadata as Record<string, unknown> | null)?.['invitationId'] === invitation.id)
        .map((n) => n.id);
      if (ids.length) await tx.notification.updateMany({ where: { id: { in: ids } }, data: { readAt: new Date() } });
      await tx.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          actorId: userId,
          action: AuditAction.UPDATE,
          resourceType: 'Invitation',
          resourceId: invitation.id,
          description: `${user.email} a refusé l'invitation`,
          metadata: { invitationStatus: 'DECLINED' },
        },
      });
    });
    return { success: true };
  }
}
