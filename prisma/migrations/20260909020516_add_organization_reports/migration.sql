-- CreateTable
CREATE TABLE "invitation_project_assignments" (
    "id" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_project_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invitation_project_assignments_projectId_idx" ON "invitation_project_assignments"("projectId");

-- CreateIndex
CREATE INDEX "invitation_project_assignments_roleId_idx" ON "invitation_project_assignments"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_project_assignments_invitationId_projectId_key" ON "invitation_project_assignments"("invitationId", "projectId");

-- AddForeignKey
ALTER TABLE "invitation_project_assignments" ADD CONSTRAINT "invitation_project_assignments_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_project_assignments" ADD CONSTRAINT "invitation_project_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_project_assignments" ADD CONSTRAINT "invitation_project_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
