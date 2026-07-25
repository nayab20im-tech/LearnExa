const Quiz = require('../models/Quiz.model');
const Question = require('../models/Question.model');
const Subject = require('../models/Subject.model');
const User = require('../models/User.model');
const Submission = require('../models/Submission.model');

const {
  notifyManyStudents
} = require('../services/notification.service');

const {
  generateQuizWithAI
} = require('../services/aiQuiz.service');

const {
  uploadFromBuffer
} = require('../services/upload.service');

const {
  parseQuizImport
} = require('../utils/quizImport');

const {
  generateUniqueAccessCode,
  matchesQuizAccessCode,
  normalizeAccessCode
} = require('../services/quizAccess.service');

const uniqueIds = (ids = []) => {
  const seen = new Set();

  return ids
    .filter(Boolean)
    .map((id) => id.toString())
    .filter((id) => {
      if (seen.has(id)) {
        return false;
      }

      seen.add(id);
      return true;
    });
};

const resolveQuizAudienceStudents = async (subjectDoc) => {
  if (!subjectDoc) {
    return [];
  }

  const assignedStudents = await User.find({
    role: 'Student',
    status: 'Active',
    assignedModules: subjectDoc._id
  }).select('_id');

  return uniqueIds([
    ...(subjectDoc.enrolledStudents || []),
    ...assignedStudents.map((student) => student._id)
  ]);
};

/*
 * When a quiz does not use a predefined Subject document,
 * it is made available to every active student.
 *
 * The teacher's typed subject/topic is stored in the
 * quiz category field.
 */
const resolveAllActiveStudents = async () => {
  const students = await User.find({
    role: 'Student',
    status: 'Active'
  }).select('_id');

  return uniqueIds(
    students.map((student) => student._id)
  );
};

const notifyQuizPublished = async (
  quiz,
  subjectDoc = null
) => {
  const subject =
    subjectDoc ||
    (quiz.subject
      ? await Subject.findById(quiz.subject)
      : null);

  const studentIds = subject
    ? await resolveQuizAudienceStudents(subject)
    : uniqueIds(quiz.targetStudents || []);

  if (studentIds.length === 0) {
    return;
  }

  const message =
    `New assessment "${quiz.title}" has been published. ` +
    'Use the access code shared by your teacher to begin.';

  await notifyManyStudents(
    studentIds,
    message,
    'quiz_published',
    quiz._id,
    'New Quiz Published'
  );
};

/**
 * @desc    Get all quizzes filtered by role
 * @route   GET /api/quizzes
 * @access  Private
 */
const getQuizzes = async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === 'Teacher') {
      query.createdBy = req.user.id;
    } else if (req.user.role === 'Student') {
      const enrolledSubjects = await Subject.find({
        isActive: true,
        enrolledStudents: req.user.id
      }).select('_id');

      const subjectIds = uniqueIds([
        ...enrolledSubjects.map(
          (subject) => subject._id
        ),
        ...(req.user.assignedModules || [])
      ]);

      const attemptedQuizIds = await Submission.find({
        student: req.user.id
      }).distinct('quiz');

      const audienceConditions = [
        {
          targetStudents: req.user._id
        },

        ...(subjectIds.length > 0
          ? [
              {
                subject: {
                  $in: subjectIds
                }
              }
            ]
          : [])
      ];

      query = {
        status: 'published',

        _id: {
          $nin: attemptedQuizIds
        },

        $and: [
          {
            $or: audienceConditions
          },

          {
            $or: [
              {
                expiresAt: null
              },

              {
                expiresAt: {
                  $exists: false
                }
              },

              {
                expiresAt: {
                  $gt: new Date()
                }
              }
            ]
          }
        ]
      };
    }

    let quizzesQuery = Quiz.find(query)
      .populate('subject', 'name code')
      .populate('createdBy', 'name')
      .sort({
        createdAt: -1
      });

    // Access codes are visible only to teacher/admin.
    if (req.user.role === 'Student') {
      quizzesQuery = quizzesQuery.select('-accessCode');
    }

    const quizzes = await quizzesQuery;

    return res.status(200).json({
      success: true,
      count: quizzes.length,
      quizzes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get one quiz with questions
 * @route   GET /api/quizzes/:id
 * @access  Private
 */
const getQuizById = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('subject', 'name code')
      .populate('createdBy', 'name');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    /*
     * Students must open the quiz through the access-code
     * endpoint so that the code is verified first.
     */
    if (req.user.role === 'Student') {
      return res.status(403).json({
        success: false,
        message:
          'Enter the quiz access code before opening this assessment.'
      });
    }

    const questions = await Question.find({
      quiz: quiz._id
    }).sort({
      orderIndex: 1
    });

    return res.status(200).json({
      success: true,

      quiz: {
        ...quiz.toJSON(),
        questions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Find an available quiz using its access code
 * @route   POST /api/quizzes/access/by-code
 * @access  Private/Student
 */
const findQuizByAccessCode = async (req, res, next) => {
  try {
    const accessCode = normalizeAccessCode(
      req.body.accessCode
    );

    if (!accessCode) {
      return res.status(400).json({
        success: false,
        message: 'Quiz access code is required.'
      });
    }

    const quiz = await Quiz.findOne({
      accessCode,
      status: 'published'
    })
      .select('-accessCode')
      .populate('subject', 'name code')
      .populate('createdBy', 'name');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message:
          'No published quiz was found for this access code.'
      });
    }

    if (
      quiz.expiresAt &&
      new Date(quiz.expiresAt) <= new Date()
    ) {
      return res.status(410).json({
        success: false,
        message: 'This quiz has expired.'
      });
    }

    const attempted = await Submission.exists({
      student: req.user.id,
      quiz: quiz._id
    });

    if (attempted) {
      return res.status(409).json({
        success: false,
        message: 'You have already attempted this quiz.'
      });
    }

    return res.status(200).json({
      success: true,
      quiz
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify a code and open a quiz for a student
 * @route   POST /api/quizzes/:id/access
 * @access  Private/Student
 */
const accessQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('subject', 'name code')
      .populate('createdBy', 'name');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    if (quiz.status !== 'published') {
      return res.status(403).json({
        success: false,
        message: 'This quiz is not currently available.'
      });
    }

    if (
      quiz.expiresAt &&
      new Date(quiz.expiresAt) <= new Date()
    ) {
      return res.status(410).json({
        success: false,
        message: 'This quiz has expired.'
      });
    }

    if (
      !matchesQuizAccessCode(
        quiz,
        req.body.accessCode
      )
    ) {
      return res.status(403).json({
        success: false,
        message: 'The quiz access code is incorrect.'
      });
    }

    const attempted = await Submission.exists({
      student: req.user.id,
      quiz: quiz._id
    });

    if (attempted) {
      return res.status(409).json({
        success: false,
        message: 'You have already attempted this quiz.'
      });
    }

    const questions = await Question.find({
      quiz: quiz._id
    })
      .select('-correctAnswer -rubric')
      .sort({
        orderIndex: 1
      });

    const quizObject = quiz.toJSON();

    delete quizObject.accessCode;

    return res.status(200).json({
      success: true,

      quiz: {
        ...quizObject,
        questions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate a new access code for a quiz
 * @route   PATCH /api/quizzes/:id/access-code/regenerate
 * @access  Private/Teacher
 */
const regenerateQuizAccessCode = async (
  req,
  res,
  next
) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    if (
      quiz.createdBy.toString() !== req.user.id &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You are not authorized to change this quiz access code.'
      });
    }

    quiz.accessCode = await generateUniqueAccessCode();

    await quiz.save();

    return res.status(200).json({
      success: true,
      message:
        'A new quiz access code has been generated.',
      accessCode: quiz.accessCode
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create quiz with questions
 * @route   POST /api/quizzes
 * @access  Private/Teacher
 */
const createQuiz = async (req, res, next) => {
  let createdQuiz = null;

  try {
    const {
      title,
      description,
      subject,
      category,
      timeLimit,
      difficulty,
      questions,
      expiresAt,
      status,
      evaluationMode = 'teacher_review',
      attachments = []
    } = req.body;

    const requestedStatus =
      status === 'published'
        ? 'published'
        : 'draft';

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Quiz title is required.'
      });
    }

    if (!category || !String(category).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject or topic is required.'
      });
    }

    const parsedTimeLimit = Number(timeLimit);

    if (
      !Number.isFinite(parsedTimeLimit) ||
      parsedTimeLimit < 1
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Time limit must be at least 1 minute.'
      });
    }

    if (
      ![
        'automatic',
        'teacher_review'
      ].includes(evaluationMode)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Evaluation mode must be automatic or teacher_review.'
      });
    }

    if (
      !Array.isArray(questions) ||
      questions.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'A quiz must contain at least one question.'
      });
    }

    let selectedSubject = null;

    /*
     * A predefined subject is optional.
     * The teacher may enter any free-text category/topic.
     */
    if (subject) {
      selectedSubject = await Subject.findById(subject);

      if (!selectedSubject) {
        return res.status(404).json({
          success: false,
          message: 'Selected subject not found.'
        });
      }

      if (
        req.user.role === 'Teacher' &&
        (
          !selectedSubject.teacherId ||
          selectedSubject.teacherId.toString() !==
            req.user.id
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            'You can only create quizzes for subjects assigned to you.'
        });
      }
    }

    const normalizedQuestions = questions.map(
      (question, index) => {
        const type =
          question.type === 'short'
            ? 'short'
            : 'mcq';

        const text = String(
          question.text || ''
        ).trim();

        const marks = Number(question.marks);

        if (!text) {
          const validationError = new Error(
            `Question ${index + 1} must contain a question statement.`
          );

          validationError.statusCode = 400;

          throw validationError;
        }

        if (
          !Number.isFinite(marks) ||
          marks < 0.5
        ) {
          const validationError = new Error(
            `Question ${index + 1} must have at least 0.5 marks.`
          );

          validationError.statusCode = 400;

          throw validationError;
        }

        if (type === 'mcq') {
          const options = Array.isArray(
            question.options
          )
            ? question.options.map((option) =>
                String(option || '').trim()
              )
            : [];

          const correctAnswer = String(
            question.correctAnswer || ''
          ).trim();

          if (
            options.length < 2 ||
            options.some((option) => !option)
          ) {
            const validationError = new Error(
              `Question ${index + 1} must have at least two completed options.`
            );

            validationError.statusCode = 400;

            throw validationError;
          }

          if (
            !correctAnswer ||
            !options.includes(correctAnswer)
          ) {
            const validationError = new Error(
              `Question ${index + 1} must have a valid correct answer.`
            );

            validationError.statusCode = 400;

            throw validationError;
          }

          return {
            type,
            text,
            options,
            correctAnswer,
            rubric: null,

            hint: String(
              question.hint || ''
            ).trim(),

            marks,

            orderIndex:
              question.orderIndex ?? index
          };
        }

        return {
          type,
          text,
          correctAnswer: null,

          rubric: String(
            question.rubric || ''
          ).trim(),

          hint: String(
            question.hint || ''
          ).trim(),

          marks,

          orderIndex:
            question.orderIndex ?? index
        };
      }
    );

    const targetStudents = selectedSubject
      ? await resolveQuizAudienceStudents(
          selectedSubject
        )
      : await resolveAllActiveStudents();

    createdQuiz = await Quiz.create({
      title: String(title).trim(),

      description: description
        ? String(description).trim()
        : '',

      subject: selectedSubject
        ? selectedSubject._id
        : null,

      category: String(category).trim(),

      timeLimit: parsedTimeLimit,

      difficulty,

      createdBy: req.user.id,

      status: requestedStatus,

      publishedAt:
        requestedStatus === 'published'
          ? new Date()
          : null,

      expiresAt: expiresAt || null,

      targetStudents,

      accessCode:
        await generateUniqueAccessCode(),

      evaluationMode,

      attachments: Array.isArray(attachments)
        ? attachments
        : []
    });

    /*
     * Insert every question in one database operation.
     * This prevents long publishing delays and frontend timeouts.
     */
    const savedQuestions = await Question.insertMany(
      normalizedQuestions.map((question) => ({
        ...question,
        quiz: createdQuiz._id
      }))
    );

    createdQuiz.questions = savedQuestions.map(
      (question) => question._id
    );

    createdQuiz.totalMarks = savedQuestions.reduce(
      (total, question) =>
        total + Number(question.marks || 0),
      0
    );

    await createdQuiz.save();

    /*
     * Notification failure must not make successful
     * quiz publication appear unsuccessful.
     */
    if (createdQuiz.status === 'published') {
      notifyQuizPublished(
        createdQuiz,
        selectedSubject
      ).catch((notificationError) => {
        console.error(
          'Quiz published, but student notifications could not be created:',
          notificationError.message
        );
      });
    }

    return res.status(201).json({
      success: true,

      message:
        createdQuiz.status === 'published'
          ? 'Quiz created and published successfully.'
          : 'Quiz created successfully.',

      quiz: createdQuiz
    });
  } catch (error) {
    /*
     * Remove a partially created quiz if saving
     * its questions failed.
     */
    if (createdQuiz?._id) {
      await Promise.allSettled([
        Question.deleteMany({
          quiz: createdQuiz._id
        }),

        Quiz.findByIdAndDelete(
          createdQuiz._id
        )
      ]);
    }

    next(error);
  }
};

/**
 * @desc    Update quiz and questions
 * @route   PUT /api/quizzes/:id
 * @access  Private/Teacher
 */
const updateQuiz = async (req, res, next) => {
  try {
    const {
      title,
      description,
      subject,
      category,
      timeLimit,
      difficulty,
      questions,
      expiresAt,
      status,
      evaluationMode,
      attachments
    } = req.body;

    const quiz = await Quiz.findById(
      req.params.id
    );

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    if (
      quiz.createdBy.toString() !==
        req.user.id &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You are not authorized to update this quiz'
      });
    }

    const wasPublished =
      quiz.status === 'published';

    const nextStatus =
      status || quiz.status;

    let selectedSubject = null;

    if (subject) {
      selectedSubject = await Subject.findById(
        subject
      );

      if (!selectedSubject) {
        return res.status(404).json({
          success: false,
          message: 'Selected subject not found'
        });
      }

      if (
        req.user.role === 'Teacher' &&
        (
          !selectedSubject.teacherId ||
          selectedSubject.teacherId.toString() !==
            req.user.id
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            'You can only update quizzes for your assigned subjects'
        });
      }
    } else if (quiz.subject) {
      selectedSubject = await Subject.findById(
        quiz.subject
      );
    }

    if (title !== undefined) {
      quiz.title = String(title).trim();
    }

    if (description !== undefined) {
      quiz.description = String(
        description || ''
      ).trim();
    }

    if (category !== undefined) {
      quiz.category = String(category).trim();
    }

    if (timeLimit !== undefined) {
      const parsedTimeLimit = Number(timeLimit);

      if (
        !Number.isFinite(parsedTimeLimit) ||
        parsedTimeLimit < 1
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Time limit must be at least 1 minute.'
        });
      }

      quiz.timeLimit = parsedTimeLimit;
    }

    if (difficulty !== undefined) {
      quiz.difficulty = difficulty;
    }

    if (evaluationMode !== undefined) {
      if (
        ![
          'automatic',
          'teacher_review'
        ].includes(evaluationMode)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Evaluation mode must be automatic or teacher_review.'
        });
      }

      quiz.evaluationMode = evaluationMode;
    }

    if (!quiz.accessCode) {
      quiz.accessCode =
        await generateUniqueAccessCode();
    }

    if (expiresAt !== undefined) {
      quiz.expiresAt = expiresAt || null;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        'subject'
      )
    ) {
      quiz.subject = selectedSubject
        ? selectedSubject._id
        : null;
    }

    quiz.status = nextStatus;

    quiz.targetStudents = selectedSubject
      ? await resolveQuizAudienceStudents(
          selectedSubject
        )
      : await resolveAllActiveStudents();

    if (Array.isArray(attachments)) {
      quiz.attachments = attachments;
    }

    if (
      !wasPublished &&
      quiz.status === 'published'
    ) {
      quiz.publishedAt = new Date();
    }

    if (Array.isArray(questions)) {
      if (questions.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            'A quiz must contain at least one question.'
        });
      }

      const normalizedQuestions = questions.map(
        (question, index) => {
          const type =
            question.type === 'short'
              ? 'short'
              : 'mcq';

          const text = String(
            question.text || ''
          ).trim();

          const marks = Number(question.marks);

          if (!text) {
            const validationError = new Error(
              `Question ${index + 1} must contain a question statement.`
            );

            validationError.statusCode = 400;

            throw validationError;
          }

          if (
            !Number.isFinite(marks) ||
            marks < 0.5
          ) {
            const validationError = new Error(
              `Question ${index + 1} must have at least 0.5 marks.`
            );

            validationError.statusCode = 400;

            throw validationError;
          }

          if (type === 'mcq') {
            const options = Array.isArray(
              question.options
            )
              ? question.options.map((option) =>
                  String(option || '').trim()
                )
              : [];

            const correctAnswer = String(
              question.correctAnswer || ''
            ).trim();

            if (
              options.length < 2 ||
              options.some((option) => !option)
            ) {
              const validationError = new Error(
                `Question ${index + 1} must have at least two completed options.`
              );

              validationError.statusCode = 400;

              throw validationError;
            }

            if (
              !correctAnswer ||
              !options.includes(correctAnswer)
            ) {
              const validationError = new Error(
                `Question ${index + 1} must have a valid correct answer.`
              );

              validationError.statusCode = 400;

              throw validationError;
            }

            return {
              type,
              text,
              options,
              correctAnswer,
              rubric: null,

              hint: String(
                question.hint || ''
              ).trim(),

              marks,

              orderIndex:
                question.orderIndex ?? index
            };
          }

          return {
            type,
            text,
            correctAnswer: null,

            rubric: String(
              question.rubric || ''
            ).trim(),

            hint: String(
              question.hint || ''
            ).trim(),

            marks,

            orderIndex:
              question.orderIndex ?? index
          };
        }
      );

      await Question.deleteMany({
        quiz: quiz._id
      });

      const savedQuestions =
        await Question.insertMany(
          normalizedQuestions.map((question) => ({
            ...question,
            quiz: quiz._id
          }))
        );

      quiz.questions = savedQuestions.map(
        (question) => question._id
      );

      quiz.totalMarks = savedQuestions.reduce(
        (total, question) =>
          total + Number(question.marks || 0),
        0
      );
    }

    await quiz.save();

    if (
      !wasPublished &&
      quiz.status === 'published'
    ) {
      notifyQuizPublished(
        quiz,
        selectedSubject
      ).catch((notificationError) => {
        console.error(
          'Quiz published, but student notifications could not be created:',
          notificationError.message
        );
      });
    }

    return res.status(200).json({
      success: true,

      message:
        !wasPublished &&
        quiz.status === 'published'
          ? 'Quiz updated and published successfully'
          : 'Quiz updated successfully',

      quiz
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Publish quiz
 * @route   PATCH /api/quizzes/:id/publish
 * @access  Private/Teacher
 */
const publishQuiz = async (
  req,
  res,
  next
) => {
  try {
    const quiz = await Quiz.findById(
      req.params.id
    );

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    if (
      quiz.createdBy.toString() !==
        req.user.id &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You are not authorized to publish this quiz'
      });
    }

    const wasPublished =
      quiz.status === 'published';

    quiz.status = 'published';

    if (!quiz.accessCode) {
      quiz.accessCode =
        await generateUniqueAccessCode();
    }

    if (!wasPublished) {
      quiz.publishedAt = new Date();
    }

    const selectedSubject = quiz.subject
      ? await Subject.findById(quiz.subject)
      : null;

    quiz.targetStudents = selectedSubject
      ? await resolveQuizAudienceStudents(
          selectedSubject
        )
      : await resolveAllActiveStudents();

    await quiz.save();

    if (!wasPublished) {
      notifyQuizPublished(
        quiz,
        selectedSubject
      ).catch((notificationError) => {
        console.error(
          'Quiz published, but student notifications could not be created:',
          notificationError.message
        );
      });
    }

    return res.status(200).json({
      success: true,
      message:
        'Quiz published to the system successfully',
      quiz
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete quiz and questions
 * @route   DELETE /api/quizzes/:id
 * @access  Private/Teacher
 */
const deleteQuiz = async (
  req,
  res,
  next
) => {
  try {
    const quiz = await Quiz.findById(
      req.params.id
    );

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    if (
      quiz.createdBy.toString() !==
        req.user.id &&
      req.user.role !== 'Admin'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You are not authorized to delete this quiz'
      });
    }

    await Question.deleteMany({
      quiz: quiz._id
    });

    await Quiz.findByIdAndDelete(
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message:
        'Quiz and all its questions deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate quiz using Gemini AI
 * @route   POST /api/quizzes/generate-ai
 * @access  Private/Teacher
 */
const generateQuizQuestionsWithAI = async (
  req,
  res
) => {
  try {
    const {
      topic,
      numberOfQuestions = 5,
      mcqCount = 0,
      shortCount = 0,
      difficulty = 'medium',
      questionType = 'mcq'
    } = req.body;

    if (
      !topic ||
      topic.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required'
      });
    }

    if (
      ![
        'easy',
        'medium',
        'hard'
      ].includes(difficulty)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Difficulty must be easy, medium, or hard'
      });
    }

    if (
      ![
        'mcq',
        'short',
        'mixed'
      ].includes(questionType)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Question type must be mcq, short, or mixed'
      });
    }

    let generatedQuestions = [];

    if (questionType === 'mixed') {
      const requestedMcqs =
        Number(mcqCount);

      const requestedShortAnswers =
        Number(shortCount);

      const total =
        requestedMcqs +
        requestedShortAnswers;

      if (
        !Number.isInteger(requestedMcqs) ||
        requestedMcqs < 1
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Select at least one multiple-choice question.'
        });
      }

      if (
        !Number.isInteger(
          requestedShortAnswers
        ) ||
        requestedShortAnswers < 1
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Select at least one short-answer question.'
        });
      }

      if (total > 20) {
        return res.status(400).json({
          success: false,
          message:
            'The total number of questions cannot exceed 20.'
        });
      }

      const [
        mcqs,
        shortAnswers
      ] = await Promise.all([
        generateQuizWithAI({
          topic: topic.trim(),

          numberOfQuestions:
            requestedMcqs,

          difficulty,

          questionType: 'mcq'
        }),

        generateQuizWithAI({
          topic: topic.trim(),

          numberOfQuestions:
            requestedShortAnswers,

          difficulty,

          questionType: 'short'
        })
      ]);

      const maxLength = Math.max(
        mcqs.length,
        shortAnswers.length
      );

      for (
        let index = 0;
        index < maxLength;
        index += 1
      ) {
        if (mcqs[index]) {
          generatedQuestions.push(
            mcqs[index]
          );
        }

        if (shortAnswers[index]) {
          generatedQuestions.push(
            shortAnswers[index]
          );
        }
      }
    } else {
      const requestedCount =
        questionType === 'mcq'
          ? Number(mcqCount) ||
            Number(numberOfQuestions)
          : Number(shortCount) ||
            Number(numberOfQuestions);

      if (
        !Number.isInteger(requestedCount) ||
        requestedCount < 1 ||
        requestedCount > 20
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Number of questions must be between 1 and 20'
        });
      }

      generatedQuestions =
        await generateQuizWithAI({
          topic: topic.trim(),

          numberOfQuestions:
            requestedCount,

          difficulty,

          questionType
        });
    }

    return res.status(200).json({
      success: true,

      message:
        'Questions generated successfully',

      questions: generatedQuestions,

      count: generatedQuestions.length,

      breakdown: {
        mcq: generatedQuestions.filter(
          (question) =>
            question.type === 'mcq'
        ).length,

        short: generatedQuestions.filter(
          (question) =>
            question.type === 'short'
        ).length
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message:
        error.message ||
        'Failed to generate quiz questions'
    });
  }
};

/**
 * @desc    Import quiz file
 * @route   POST /api/quizzes/import
 * @access  Private/Teacher
 */
const importQuizFile = async (
  req,
  res,
  next
) => {
  let createdQuiz = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Import file is required.'
      });
    }

    const payload = parseQuizImport(
      req.file.buffer,
      req.file.originalname
    );

    const {
      title: importedTitle,
      category: importedCategory,
      timeLimit: importedTimeLimit,
      description: importedDescription,
      questions: importedQuestions,
      subject: importedSubject
    } = payload;

    const {
      subjectId,
      status = 'published',
      description,
      category,
      title,
      evaluationMode = 'teacher_review'
    } = req.body;

    const requestedStatus =
      status === 'published'
        ? 'published'
        : 'draft';

    const quizTitle =
      title ||
      importedTitle ||
      `Imported Quiz ${Date.now()}`;

    const quizCategory =
      category ||
      importedCategory ||
      'Imported';

    const quizTimeLimit =
      parseInt(importedTimeLimit, 10) || 30;

    const quizDescription =
      description ||
      importedDescription ||
      '';

    const quizQuestions =
      Array.isArray(importedQuestions)
        ? importedQuestions
        : [];

    if (quizQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          'Imported quiz must contain at least one question.'
      });
    }

    let selectedSubject = null;

    const finalSubjectId =
      subjectId ||
      importedSubject ||
      null;

    if (finalSubjectId) {
      selectedSubject =
        await Subject.findById(
          finalSubjectId
        );

      if (!selectedSubject) {
        selectedSubject =
          await Subject.findOne({
            code: finalSubjectId
              .toString()
              .trim()
              .toUpperCase()
          });
      }

      if (!selectedSubject) {
        return res.status(404).json({
          success: false,
          message:
            'Subject not found for quiz import.'
        });
      }

      if (
        req.user.role === 'Teacher' &&
        (
          !selectedSubject.teacherId ||
          selectedSubject.teacherId.toString() !==
            req.user.id
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            'You can only import quizzes for your assigned subjects.'
        });
      }
    }

    const targetStudents = selectedSubject
      ? await resolveQuizAudienceStudents(
          selectedSubject
        )
      : await resolveAllActiveStudents();

    createdQuiz = await Quiz.create({
      title: quizTitle,

      description: quizDescription,

      subject: selectedSubject
        ? selectedSubject._id
        : null,

      category: quizCategory,

      timeLimit: quizTimeLimit,

      difficulty: 'Intermediate',

      createdBy: req.user.id,

      status: requestedStatus,

      publishedAt:
        requestedStatus === 'published'
          ? new Date()
          : null,

      expiresAt: null,

      targetStudents,

      accessCode:
        await generateUniqueAccessCode(),

      evaluationMode: [
        'automatic',
        'teacher_review'
      ].includes(evaluationMode)
        ? evaluationMode
        : 'teacher_review',

      attachments: []
    });

    const normalizedQuestions = quizQuestions.map(
      (question, index) => {
        const questionType =
          question.type === 'mcq'
            ? 'mcq'
            : 'short';

        return {
          quiz: createdQuiz._id,

          type: questionType,

          text:
            question.text ||
            question.questionText ||
            question.prompt ||
            'Imported question',

          options:
            questionType === 'mcq'
              ? question.options || []
              : undefined,

          correctAnswer:
            questionType === 'mcq'
              ? question.correctAnswer || ''
              : null,

          rubric:
            questionType === 'short'
              ? question.rubric || ''
              : null,

          hint: question.hint || '',

          marks:
            parseFloat(
              question.marks || 1
            ) || 1,

          orderIndex:
            question.orderIndex ?? index
        };
      }
    );

    const savedQuestions =
      await Question.insertMany(
        normalizedQuestions
      );

    createdQuiz.questions =
      savedQuestions.map(
        (question) => question._id
      );

    createdQuiz.totalMarks =
      savedQuestions.reduce(
        (total, question) =>
          total + Number(question.marks || 0),
        0
      );

    await createdQuiz.save();

    if (createdQuiz.status === 'published') {
      notifyQuizPublished(
        createdQuiz,
        selectedSubject
      ).catch((notificationError) => {
        console.error(
          'Imported quiz published, but notifications failed:',
          notificationError.message
        );
      });
    }

    return res.status(201).json({
      success: true,

      message:
        createdQuiz.status === 'published'
          ? 'Quiz imported and published successfully.'
          : 'Quiz imported and saved as draft successfully.',

      quiz: createdQuiz
    });
  } catch (error) {
    if (createdQuiz?._id) {
      await Promise.allSettled([
        Question.deleteMany({
          quiz: createdQuiz._id
        }),

        Quiz.findByIdAndDelete(
          createdQuiz._id
        )
      ]);
    }

    next(error);
  }
};

/**
 * @desc    Upload quiz attachment
 * @route   POST /api/quizzes/upload
 * @access  Private/Teacher
 */
const uploadQuizAttachment = async (
  req,
  res,
  next
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          'Attachment file is required.'
      });
    }

    const result =
      await uploadFromBuffer(req);

    return res.status(201).json({
      success: true,

      attachment: {
        filename:
          req.file.originalname,

        url:
          result.secure_url,

        publicId:
          result.public_id,

        mimeType:
          req.file.mimetype,

        size:
          req.file.size
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQuizzes,
  getQuizById,
  findQuizByAccessCode,
  accessQuiz,
  regenerateQuizAccessCode,
  createQuiz,
  updateQuiz,
  publishQuiz,
  deleteQuiz,
  generateQuizQuestionsWithAI,
  uploadQuizAttachment,
  importQuizFile
};