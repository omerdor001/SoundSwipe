-- AlterTable
ALTER TABLE "User" ADD COLUMN     "spotifyAccessToken" TEXT,
ADD COLUMN     "spotifyId" TEXT,
ADD COLUMN     "spotifyRefreshToken" TEXT,
ADD COLUMN     "spotifyTokenExpiry" TIMESTAMP(3);
