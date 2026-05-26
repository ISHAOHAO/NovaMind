-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuestionStatus" ADD VALUE 'REVIEWING';
ALTER TYPE "QuestionStatus" ADD VALUE 'NEEDS_REVISION';

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "importance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isAiGenerated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "QuestionBank" ADD COLUMN     "reviewTemplateId" TEXT;

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewerDailyStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reviewedCount" INTEGER NOT NULL DEFAULT 0,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "needsRevisionCount" INTEGER NOT NULL DEFAULT 0,
    "avgReviewTime" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewerDailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exam_userId_idx" ON "Exam"("userId");

-- CreateIndex
CREATE INDEX "Exam_status_idx" ON "Exam"("status");

-- CreateIndex
CREATE INDEX "Exam_userId_status_idx" ON "Exam"("userId", "status");

-- CreateIndex
CREATE INDEX "Exam_createdAt_idx" ON "Exam"("createdAt");

-- CreateIndex
CREATE INDEX "ExamQuestion_examId_idx" ON "ExamQuestion"("examId");

-- CreateIndex
CREATE INDEX "ExamQuestion_questionId_idx" ON "ExamQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_questionId_key" ON "ExamQuestion"("examId", "questionId");

-- CreateIndex
CREATE INDEX "ReviewTemplate_category_idx" ON "ReviewTemplate"("category");

-- CreateIndex
CREATE INDEX "ReviewTemplate_isDefault_idx" ON "ReviewTemplate"("isDefault");

-- CreateIndex
CREATE INDEX "ReviewerDailyStats_userId_idx" ON "ReviewerDailyStats"("userId");

-- CreateIndex
CREATE INDEX "ReviewerDailyStats_date_idx" ON "ReviewerDailyStats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerDailyStats_userId_date_key" ON "ReviewerDailyStats"("userId", "date");

-- CreateIndex
CREATE INDEX "Note_userId_importance_idx" ON "Note"("userId", "importance");

-- CreateIndex
CREATE INDEX "Note_isAiGenerated_idx" ON "Note"("isAiGenerated");

-- CreateIndex
CREATE INDEX "QuestionBank_reviewedById_idx" ON "QuestionBank"("reviewedById");

-- CreateIndex
CREATE INDEX "QuestionBank_status_createdAt_idx" ON "QuestionBank"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserQuestionRecord_userId_isCorrect_idx" ON "UserQuestionRecord"("userId", "isCorrect");

-- CreateIndex
CREATE INDEX "UserQuestionRecord_userId_createdAt_idx" ON "UserQuestionRecord"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_reviewTemplateId_fkey" FOREIGN KEY ("reviewTemplateId") REFERENCES "ReviewTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
