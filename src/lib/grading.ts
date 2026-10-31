/**
 * 服务端判分工具。
 *
 * 考试成绩、正确率属于安全敏感数据，isCorrect 必须由服务端依据
 * 题目的标准答案计算，不得信任客户端提交的结果。
 * 比较规则与前端练习/考试页面保持一致。
 */

const MAX_ANSWER_LENGTH = 2000;

/** 校验并规范化客户端提交的作答内容：仅接受字符串且限制长度 */
export function normalizeUserAnswer(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length > MAX_ANSWER_LENGTH) return null;
  return value;
}

function normalizeMulti(s: string): string {
  return s
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .sort()
    .join(",");
}

export function gradeAnswer(
  type: string,
  answer: string,
  userAnswer: string | null
): boolean {
  if (!userAnswer || !answer) return false;

  switch (type) {
    case "multiple": {
      const given = normalizeMulti(userAnswer);
      return given.length > 0 && given === normalizeMulti(answer);
    }
    case "fillblank":
      return userAnswer.trim().toLowerCase() === answer.trim().toLowerCase();
    case "cloze": {
      const correctParts = answer
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const givenParts = userAnswer
        .split(",")
        .map((s) => s.trim().toLowerCase());
      return (
        correctParts.length > 0 &&
        correctParts.every((part, i) => givenParts[i] === part)
      );
    }
    case "single":
    case "truefalse":
    default:
      return userAnswer.trim() === answer.trim();
  }
}
