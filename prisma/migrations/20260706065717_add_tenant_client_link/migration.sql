-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clientRecordId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientRecordId_fkey" FOREIGN KEY ("clientRecordId") REFERENCES "Record"("id") ON DELETE SET NULL ON UPDATE CASCADE;
