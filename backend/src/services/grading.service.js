const axios = require('axios');

/**
 * Gemini AI Grading Service
 * Evaluates short answer responses against a rubric.
 * Falls back to keyword-matching if GEMINI_API_KEY is not set.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Evaluate a short answer using Gemini AI
 * @param {string} question - The question text
 * @param {string} studentAnswer - The student's response
 * @param {string} rubric - Teacher-defined rubric/keywords
 * @param {number} maxMarks - Maximum marks for this question
 * @returns {Object} { score, confidence, feedback, missingConcepts }
 */
const evaluateWithGemini = async (question, studentAnswer, rubric, maxMarks) => {
  const prompt = `You are an academic evaluator for a university assessment system. Evaluate the following student answer.

QUESTION: ${question}

STUDENT ANSWER: ${studentAnswer}

EVALUATION RUBRIC / KEY CONCEPTS: ${rubric}

MAXIMUM MARKS: ${maxMarks}

Please evaluate the student's answer and respond with a JSON object in this exact format:
{
  "score": <number between 0 and ${maxMarks}>,
  "confidence": <percentage between 0 and 100>,
  "feedback": "<detailed feedback explaining the grade>",
  "missingConcepts": ["<concept 1>", "<concept 2>"],
  "strengths": "<what the student did well>",
  "weakAreas": "<areas needing improvement>"
}

Scoring guidelines:
- Full marks (${maxMarks}): Complete, accurate, well-structured answer covering all rubric points
- Partial marks: Partially correct, missing some key concepts
- Low marks: Minimal understanding shown
- Zero: Irrelevant or completely incorrect

Respond ONLY with the JSON object, no additional text.`;

  try {
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000,
        },
      },
      { timeout: 60000 }
    );

    const rawText =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid Gemini response format');

    const result = JSON.parse(jsonMatch[0]);

    return {
      score: Math.min(Math.max(parseFloat(result.score) || 0, 0), maxMarks),
      confidence: Math.min(Math.max(parseInt(result.confidence) || 75, 0), 100),
      feedback: result.feedback || 'No feedback provided.',
      missingConcepts: Array.isArray(result.missingConcepts)
        ? result.missingConcepts
        : [],
      strengths: result.strengths || '',
      weakAreas: result.weakAreas || '',
      provider: 'gemini',
    };
  } catch (error) {
    console.warn(
      'Gemini AI evaluation failed, falling back to keyword matching:',
      error.message
    );
    return keywordMatchingFallback(studentAnswer, rubric, maxMarks);
  }
};

/**
 * Fallback keyword-matching grading when Gemini API is unavailable
 */
const keywordMatchingFallback = (studentAnswer, rubric, maxMarks) => {
  if (!studentAnswer || studentAnswer.trim().length < 10) {
    return {
      score: 0,
      confidence: 95,
      feedback: 'Answer is too short or empty.',
      missingConcepts: rubric ? rubric.split(',').map((k) => k.trim()) : [],
      provider: 'keyword_fallback',
    };
  }

  const keywords = rubric
    ? rubric
        .split(/[,.\n]/)
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 2)
    : [];

  if (keywords.length === 0) {
    // No rubric - grade based on answer length
    const wordCount = studentAnswer.trim().split(/\s+/).length;
    const baseScore = Math.min(wordCount / 50, 1) * maxMarks;
    return {
      score: parseFloat(baseScore.toFixed(1)),
      confidence: 40,
      feedback:
        'Auto-graded based on response length. Teacher review recommended.',
      missingConcepts: [],
      provider: 'keyword_fallback',
    };
  }

  const answerLower = studentAnswer.toLowerCase();
  const matchedKeywords = keywords.filter((kw) => answerLower.includes(kw));
  const matchRatio = matchedKeywords.length / keywords.length;
  const rawScore = matchRatio * maxMarks;

  const missingConcepts = keywords
    .filter((kw) => !answerLower.includes(kw))
    .map((kw) => kw.charAt(0).toUpperCase() + kw.slice(1));

  let feedback;
  if (matchRatio >= 0.8) {
    feedback = `Excellent response! Covers most key concepts (${matchedKeywords.length}/${keywords.length} keywords matched).`;
  } else if (matchRatio >= 0.5) {
    feedback = `Good attempt. Covers ${matchedKeywords.length}/${keywords.length} key concepts. Review missing areas.`;
  } else if (matchRatio >= 0.2) {
    feedback = `Partial answer. Only ${matchedKeywords.length}/${keywords.length} key concepts addressed.`;
  } else {
    feedback = `Answer needs improvement. Missing most key concepts.`;
  }

  return {
    score: parseFloat(rawScore.toFixed(1)),
    confidence: 65 + Math.floor(matchRatio * 20),
    feedback,
    missingConcepts,
    provider: 'keyword_fallback',
  };
};

/**
 * Main evaluation function - uses Gemini if available, falls back to keyword matching
 */
const evaluateShortAnswer = async (question, studentAnswer, rubric, maxMarks = 10) => {
  if (GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 0) {
    return await evaluateWithGemini(question, studentAnswer, rubric, maxMarks);
  }
  return keywordMatchingFallback(studentAnswer, rubric, maxMarks);
};

/**
 * Grade all MCQ answers automatically
 */
const gradeMCQAnswer = (studentAnswer, correctAnswer, marks) => {
  const isCorrect =
    studentAnswer &&
    correctAnswer &&
    studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  return {
    isCorrect: isCorrect || false,
    score: isCorrect ? marks : 0,
  };
};

module.exports = {
  evaluateShortAnswer,
  gradeMCQAnswer,
  keywordMatchingFallback,
};
