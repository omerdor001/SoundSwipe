-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "features" JSONB,
ADD COLUMN     "previewUrl" TEXT,
ADD COLUMN     "spotifyUrl" TEXT;
