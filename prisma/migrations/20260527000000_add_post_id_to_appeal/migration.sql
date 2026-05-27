-- AlterTable
ALTER TABLE "Appeal" ADD COLUMN     "postId" TEXT;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
